import json
from pathlib import Path

from app.services.vector_store import retrieve

ROOT_DIR = Path(__file__).resolve().parents[3]
QUESTIONS_FILE = ROOT_DIR / "evaluation" / "questions.json"


def run_retrieval_evaluation(top_k_values: list[int] | None = None):
    if not QUESTIONS_FILE.exists():
        raise FileNotFoundError(
            "Create evaluation/questions.json before running evaluation."
        )

    questions = json.loads(QUESTIONS_FILE.read_text(encoding="utf-8"))
    top_k_values = top_k_values or [1, 3, 5, 10]

    results = []

    for k in top_k_values:
        hits = 0
        answerable_count = 0

        for item in questions:
            if not item.get("answerable", True):
                continue

            answerable_count += 1
            found = retrieve(
                item["question"],
                [item["expected_document_id"]],
                k
            )

            expected = item["expected_text"].strip().lower()
            matched = any(
                expected in result["text"].lower()
                for result in found
            )

            if matched:
                hits += 1

            results.append({
                "question": item["question"],
                "top_k": k,
                "hit": matched,
                "retrieved_chunk_ids": [
                    result["chunk_id"] for result in found
                ]
            })

        hit_rate = hits / answerable_count if answerable_count else 0

        results.append({
            "summary": True,
            "top_k": k,
            "hits": hits,
            "answerable_questions": answerable_count,
            "hit_rate": round(hit_rate, 4)
        })

    output = ROOT_DIR / "evaluation" / "v1-results.json"
    output.write_text(json.dumps(results, indent=2), encoding="utf-8")

    return results
