import json
import re
from collections import Counter, defaultdict
from pathlib import Path

import chromadb

from app.core.config import CHROMA_DIR, ROOT_DIR
from app.services.chunking import split_into_chunks
from app.services.embeddings import embed_texts

client = chromadb.PersistentClient(path=str(CHROMA_DIR))
collection = client.get_or_create_collection(
    name="rag_v2_documents",
    metadata={"hnsw:space": "cosine"}
)

CORPORA = {
    "kestrel": ROOT_DIR / "data" / "kestrel",
    "own": ROOT_DIR / "data" / "own",
}

QUESTION_FILES = {
    "kestrel": ROOT_DIR / "evaluation" / "kestrel_questions.jsonl",
    "own": ROOT_DIR / "evaluation" / "own_questions.jsonl",
}


def index_corpus(corpus_id: str, chunk_size: int = 800, overlap: int = 100):
    if corpus_id not in CORPORA:
        raise ValueError("Unknown corpus.")

    folder = CORPORA[corpus_id]
    if not folder.exists():
        raise FileNotFoundError(f"Corpus folder not found: {folder}")

    # Re-index only this corpus. Other corpus and V1 data remain untouched.
    collection.delete(where={"corpus_id": corpus_id})

    indexed_files = 0
    total_chunks = 0

    for path in sorted(folder.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in {".md", ".txt"}:
            continue

        content = path.read_text(encoding="utf-8")
        chunks = split_into_chunks(content, chunk_size, overlap)
        if not chunks:
            continue

        document_id = path.relative_to(folder).as_posix()
        ids = [f"{corpus_id}:{document_id}:{i}" for i in range(len(chunks))]
        vectors = embed_texts(chunks)

        collection.add(
            ids=ids,
            documents=chunks,
            embeddings=vectors,
            metadatas=[
                {
                    "corpus_id": corpus_id,
                    "document_id": document_id,
                    "filename": path.name,
                    "chunk_index": i,
                }
                for i in range(len(chunks))
            ],
        )

        indexed_files += 1
        total_chunks += len(chunks)

    return {
        "corpus": corpus_id,
        "files_indexed": indexed_files,
        "chunks_indexed": total_chunks,
        "chunk_size": chunk_size,
        "overlap": overlap,
    }


def retrieve_v2(
    corpus_id: str,
    question: str,
    top_k: int = 5,
):
    if corpus_id not in CORPORA:
        raise ValueError("Unknown corpus.")
    if top_k < 1 or top_k > 20:
        raise ValueError("top_k must be between 1 and 20.")

    count = collection.count()
    if count == 0:
        return []

    query_vector = embed_texts([question])[0]
    result = collection.query(
        query_embeddings=[query_vector],
        n_results=min(top_k, count),
        where={"corpus_id": corpus_id},
        include=["documents", "metadatas", "distances"],
    )

    documents = result.get("documents", [[]])[0]
    metadatas = result.get("metadatas", [[]])[0]
    ids = result.get("ids", [[]])[0]
    distances = result.get("distances", [[]])[0]

    return [
        {
            "chunk_id": ids[i],
            "text": documents[i],
            "metadata": metadatas[i],
            "distance": distances[i],
        }
        for i in range(len(documents))
    ]


def load_questions(corpus_id: str):
    path = QUESTION_FILES.get(corpus_id)
    if path is None or not path.exists():
        raise FileNotFoundError(f"Question file not found for {corpus_id}.")

    questions = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            questions.append(json.loads(line))
    return questions


def _words(text: str):
    return re.findall(r"[a-zA-Z0-9][a-zA-Z0-9_'-]*", text.lower())


def words_analysis(corpus_id: str, mode: str = "corpus"):
    if corpus_id not in CORPORA:
        raise ValueError("Unknown corpus.")

    if mode == "corpus":
        rows = collection.get(
            where={"corpus_id": corpus_id},
            include=["documents", "metadatas"],
        )
        counts = Counter()
        word_chunks = defaultdict(list)

        for chunk_id, content, metadata in zip(
            rows["ids"], rows["documents"], rows["metadatas"]
        ):
            for word in set(_words(content or "")):
                counts[word] += 1
                word_chunks[word].append(chunk_id)

        return {
            "corpus": corpus_id,
            "total_chunks": len(rows["ids"]),
            "vocabulary_size": len(counts),
            "words": [
                {
                    "word": word,
                    "chunk_count": count,
                    "chunks": word_chunks[word],
                }
                for word, count in counts.most_common()
            ],
        }

    if mode == "questions":
        rows = collection.get(
            where={"corpus_id": corpus_id},
            include=["documents", "metadatas"],
        )
        chunk_words = {
            chunk_id: set(_words(content or ""))
            for chunk_id, content in zip(rows["ids"], rows["documents"])
        }
        all_corpus_words = set().union(*chunk_words.values()) if chunk_words else set()

        results = []
        for question in load_questions(corpus_id):
            question_words = sorted(set(_words(question["question"])))
            present = [word for word in question_words if word in all_corpus_words]
            absent = [word for word in question_words if word not in all_corpus_words]

            matches = {
                word: [
                    chunk_id
                    for chunk_id, words in chunk_words.items()
                    if word in words
                ]
                for word in present
            }

            results.append({
                "question_id": question.get("id"),
                "question": question["question"],
                "present_words": present,
                "absent_words": absent,
                "word_chunks": matches,
            })

        return {"corpus": corpus_id, "questions": results}

    raise ValueError("mode must be 'corpus' or 'questions'")
