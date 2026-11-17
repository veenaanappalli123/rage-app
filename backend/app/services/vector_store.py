import chromadb
from app.core.config import CHROMA_DIR
from app.services.embeddings import embed_texts

client = chromadb.PersistentClient(path=str(CHROMA_DIR))
collection = client.get_or_create_collection(
    name="rag_documents",
    metadata={"hnsw:space": "cosine"}
)


def add_chunks(
    document_id: str,
    filename: str,
    chunks: list[str]
) -> None:
    if not chunks:
        return

    vectors = embed_texts(chunks)
    ids = [f"{document_id}_{i}" for i in range(len(chunks))]

    collection.add(
        ids=ids,
        documents=chunks,
        embeddings=vectors,
        metadatas=[
            {
                "document_id": document_id,
                "filename": filename,
                "chunk_index": i
            }
            for i in range(len(chunks))
        ]
    )


def delete_document(document_id: str) -> None:
    collection.delete(where={"document_id": document_id})


def retrieve(
    question: str,
    document_ids: list[str],
    top_k: int
) -> list[dict]:
    query_vector = embed_texts([question])[0]

    result = collection.query(
        query_embeddings=[query_vector],
        n_results=top_k,
        where={"document_id": {"$in": document_ids}},
        include=["documents", "metadatas", "distances"]
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
            "distance": distances[i]
        }
        for i in range(len(documents))
    ]


def document_chunk_count(document_id: str) -> int:
    result = collection.get(
        where={"document_id": document_id},
        include=[]
    )
    return len(result["ids"])
