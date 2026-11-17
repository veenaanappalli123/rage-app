from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import ValidationError

from app.models.schemas import AskRequest, AnswerResponse, Reference
from app.services.documents import save_document, remove_document, list_documents
from app.services.vector_store import retrieve
from app.services.llm import (
    generate_answer,
    LLMConfigurationError,
    LLMResponseError
)
import json

router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "ok", "service": "rag-backend"}


@router.get("/documents")
async def get_documents():
    return list_documents()


@router.post("/documents")
async def upload_document(
    file: UploadFile = File(...),
    chunk_size: int = Form(800),
    chunk_overlap: int = Form(100)
):
    if chunk_size < 100 or chunk_size > 5000:
        raise HTTPException(400, "Chunk size must be between 100 and 5000.")

    if chunk_overlap < 0 or chunk_overlap >= chunk_size:
        raise HTTPException(
            400, "Overlap must be non-negative and smaller than chunk size."
        )

    try:
        content = await file.read()
        result = save_document(
            file.filename or "",
            content,
            chunk_size,
            chunk_overlap
        )
        result.pop("path", None)
        return result
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    except Exception:
        raise HTTPException(500, "Document indexing failed.")


@router.delete("/documents/{document_id}")
async def delete_document(document_id: str):
    try:
        remove_document(document_id)
        return {"message": "Document deleted.", "document_id": document_id}
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc))
    except Exception:
        raise HTTPException(500, "Document deletion failed.")


@router.post("/ask", response_model=AnswerResponse)
async def ask_question(request: AskRequest):
    try:
        references = retrieve(
            request.question,
            request.document_ids,
            request.top_k
        )

        if not references:
            return AnswerResponse(
                answer="I could not find relevant passages in the selected documents.",
                references=[],
                abstained=True
            )

        raw_response = await generate_answer(request.question, references)
        parsed = json.loads(raw_response)

        selected_ids = set(parsed["citations"])
        reference_models = [
            Reference(
                chunk_id=item["chunk_id"],
                document_id=item["metadata"]["document_id"],
                filename=item["metadata"]["filename"],
                chunk_index=item["metadata"]["chunk_index"],
                text=item["text"]
            )
            for item in references
            if item["chunk_id"] in selected_ids
        ]

        if not reference_models:
            return AnswerResponse(
                answer="The model did not provide a verifiable source citation. Please try again.",
                references=[],
                abstained=True
            )

        return AnswerResponse(
            answer=parsed["answer"],
            references=reference_models,
            abstained=False
        )

    except LLMConfigurationError as exc:
        raise HTTPException(503, str(exc))
    except LLMResponseError as exc:
        raise HTTPException(502, str(exc))
    except ValidationError:
        raise HTTPException(502, "The answer failed response validation.")
    except Exception:
        raise HTTPException(500, "The question could not be processed.")


# V2 endpoints use a separate Chroma collection and do not modify V1.
from app.services.v2 import (
    index_corpus,
    retrieve_v2,
    words_analysis,
)


@router.post("/v2/index/{corpus_id}")
async def v2_index_corpus(
    corpus_id: str,
    chunk_size: int = 800,
    overlap: int = 100,
):
    if chunk_size < 100 or chunk_size > 5000:
        raise HTTPException(400, "Chunk size must be between 100 and 5000.")
    if overlap < 0 or overlap >= chunk_size:
        raise HTTPException(400, "Overlap must be smaller than chunk size.")

    try:
        return index_corpus(corpus_id, chunk_size, overlap)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc))


@router.get("/v2/corpora")
async def v2_corpora():
    from app.services.v2 import CORPORA, collection

    result = []
    for corpus_id, folder in CORPORA.items():
        indexed = collection.get(
            where={"corpus_id": corpus_id},
            include=["metadatas"],
        )
        result.append({
            "corpus": corpus_id,
            "source_folder": str(folder.relative_to(folder.parents[1])),
            "source_exists": folder.exists(),
            "indexed_chunks": len(indexed["ids"]),
        })
    return result


@router.post("/v2/retrieve")
async def v2_retrieve(request: dict):
    corpus_id = request.get("corpus_id")
    question = request.get("question", "")
    top_k = request.get("top_k", 5)

    if not isinstance(question, str) or not question.strip():
        raise HTTPException(400, "A question is required.")

    try:
        results = retrieve_v2(corpus_id, question, int(top_k))
        return {"corpus": corpus_id, "results": results}
    except (ValueError, TypeError) as exc:
        raise HTTPException(400, str(exc))


@router.get("/v2/words/{corpus_id}")
async def v2_words(corpus_id: str, mode: str = "corpus"):
    try:
        return words_analysis(corpus_id, mode)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc))


@router.post("/v2/evaluate")
async def v2_evaluate():
    from app.services.evaluation_v2 import run_v2_evaluation

    try:
        return await run_v2_evaluation()
    except Exception as exc:
        raise HTTPException(500, f"V2 evaluation failed: {exc}")
