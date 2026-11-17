
import json
import re
from collections import defaultdict
from pathlib import Path

from app.services.v2 import index_corpus, load_questions, retrieve_v2
from app.services.llm import (
    generate_no_context_answer,
    LLMConfigurationError,
    LLMResponseError,
)

ROOT_DIR = Path(__file__).resolve().parents[3]
OUTPUT_DIR = ROOT_DIR / "evaluation" / "results"

CONFIGURATIONS = [
    {"name": "chunks_800_100", "chunk_size": 800, "overlap": 100},
    {"name": "chunks_400_50", "chunk_size": 400, "overlap": 50},
]

TOP_K_VALUES = [1, 3, 5, 10]


def normalize(text):
    return re.sub(r"\s+", " ", text.lower()).strip()


def get_quotes(question):
    return [
        item["quote"] if isinstance(item, dict) else str(item)
        for item in question.get("evidence", [])
    ]


def evaluate_question(question, retrieved):
    quotes = get_quotes(question)
    chunks = [normalize(item["text"]) for item in retrieved]

    quote_hits = [
        any(normalize(quote) in chunk for chunk in chunks)
        for quote in quotes
    ]

    return {
        "id": question["id"],
        "question": question["question"],
        "type": question.get("type", "unspecified"),
        "answerable": question.get("answerable", True),
        "expected_evidence_count": len(quotes),
        "retrieved_evidence_count": sum(quote_hits),
        "hit": any(quote_hits) if quotes else None,
        "recall": (
            round(sum(quote_hits) / len(quote_hits), 4)
            if quotes else None
        ),
        "retrieved_chunks": [
            {
                "chunk_id": item["chunk_id"],
                "filename": item["metadata"]["filename"],
                "chunk_index": item["metadata"]["chunk_index"],
                "distance": item["distance"],
                "text": item["text"],
            }
            for item in retrieved
        ],
    }


def summarize(rows):
    answerable = [r for r in rows if r["answerable"]]
    grouped = defaultdict(list)

    for row in answerable:
        grouped[row["type"]].append(row)

    def metrics(items):
        if not items:
            return {
                "questions": 0,
                "hit_rate": None,
                "recall": None,
            }

        return {
            "questions": len(items),
            "hit_rate": round(
                sum(bool(r["hit"]) for r in items) / len(items), 4
            ),
            "recall": round(
                sum(r["recall"] for r in items) / len(items), 4
            ),
        }

    return {
        "overall": metrics(answerable),
        "by_question_type": {
            kind: metrics(items)
            for kind, items in sorted(grouped.items())
        },
        "unanswerable_questions_excluded": len(rows) - len(answerable),
    }


async def run_v2_evaluation():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    retrieval_output = {
        "method": {
            "hit_rate": (
                "Proportion of answerable questions with at least "
                "one expected evidence quote retrieved."
            ),
            "recall": (
                "Proportion of expected evidence quotes retrieved."
            ),
            "unanswerable": "Excluded from retrieval metrics.",
        },
        "configurations": CONFIGURATIONS,
        "top_k_values": TOP_K_VALUES,
        "corpora": {},
    }

    baseline_output = []

    for corpus_id in ("kestrel", "own"):
        questions = load_questions(corpus_id)

        # Baseline: general knowledge, with no retrieved evidence.
        for question in questions:
            try:
                answer = await generate_no_context_answer(
                    question["question"]
                )

                baseline_output.append({
                    "corpus": corpus_id,
                    "question_id": question["id"],
                    "question": question["question"],
                    "type": question.get("type", "unspecified"),
                    "answerable": question.get("answerable", True),
                    "expected_answer": question.get("expected_answer", ""),
                    "model_answer_without_context": answer,
                    "error": None,
                })

            except (LLMConfigurationError, LLMResponseError) as exc:
                baseline_output.append({
                    "corpus": corpus_id,
                    "question_id": question["id"],
                    "question": question["question"],
                    "type": question.get("type", "unspecified"),
                    "answerable": question.get("answerable", True),
                    "expected_answer": question.get("expected_answer", ""),
                    "model_answer_without_context": None,
                    "error": str(exc),
                })

        corpus_result = {
            "question_count": len(questions),
            "configurations": {},
        }

        for config in CONFIGURATIONS:
            indexing = index_corpus(
                corpus_id,
                config["chunk_size"],
                config["overlap"],
            )

            config_result = {
                "indexing": indexing,
                "top_k": {},
            }

            for k in TOP_K_VALUES:
                question_results = []

                for question in questions:
                    if not question.get("answerable", True):
                        question_results.append({
                            "id": question["id"],
                            "question": question["question"],
                            "type": question.get("type", "unspecified"),
                            "answerable": False,
                            "hit": None,
                            "recall": None,
                            "retrieved_chunks": [],
                        })
                        continue

                    retrieved = retrieve_v2(
                        corpus_id,
                        question["question"],
                        k,
                    )

                    question_results.append(
                        evaluate_question(question, retrieved)
                    )

                config_result["top_k"][str(k)] = {
                    "summary": summarize(question_results),
                    "questions": question_results,
                }

            corpus_result["configurations"][config["name"]] = config_result

        retrieval_output["corpora"][corpus_id] = corpus_result

    retrieval_path = OUTPUT_DIR / "v2-retrieval-results.json"
    baseline_path = OUTPUT_DIR / "v2-no-context-results.json"

    retrieval_path.write_text(
        json.dumps(retrieval_output, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    baseline_path.write_text(
        json.dumps(baseline_output, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    return {
        "status": "completed",
        "retrieval_results": str(retrieval_path.relative_to(ROOT_DIR)),
        "no_context_results": str(baseline_path.relative_to(ROOT_DIR)),
    }

