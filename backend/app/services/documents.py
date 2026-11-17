
import uuid
from pathlib import Path

from app.core.config import UPLOAD_DIR, MAX_UPLOAD_BYTES, ALLOWED_EXTENSIONS
from app.services.chunking import split_into_chunks
from app.services.vector_store import (
    add_chunks,
    delete_document,
    document_chunk_count
)


def save_document(
    filename: str,
    content: bytes,
    chunk_size: int,
    chunk_overlap: int
) -> dict:
    extension = Path(filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise ValueError("Only .md and .txt files are accepted.")

    if len(content) > MAX_UPLOAD_BYTES:
        raise ValueError("File exceeds the 5 MB upload limit.")

    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ValueError("File must be valid UTF-8 text.") from exc

    if not text.strip():
        raise ValueError("The uploaded document is empty.")

    chunks = split_into_chunks(text, chunk_size, chunk_overlap)
    if not chunks:
        raise ValueError("No text chunks could be created.")

    document_id = str(uuid.uuid4())
    safe_filename = Path(filename).name
    saved_path = UPLOAD_DIR / f"{document_id}{extension}"
    saved_path.write_text(text, encoding="utf-8")

    try:
        add_chunks(document_id, safe_filename, chunks)
    except Exception:
        saved_path.unlink(missing_ok=True)
        raise

    return {
        "document_id": document_id,
        "filename": safe_filename,
        "chunks": len(chunks),
        "path": str(saved_path)
    }


def remove_document(document_id: str) -> None:
    matches = list(UPLOAD_DIR.glob(f"{document_id}.*"))
    if not matches:
        raise FileNotFoundError("Document not found.")

    delete_document(document_id)

    for path in matches:
        path.unlink(missing_ok=True)


def list_documents() -> list[dict]:
    result = []

    for path in UPLOAD_DIR.iterdir():
        if path.is_file() and path.suffix.lower() in ALLOWED_EXTENSIONS:
            document_id = path.stem
            result.append({
                "document_id": document_id,
                "filename": path.name,
                "chunks": document_chunk_count(document_id)
            })

    return result
