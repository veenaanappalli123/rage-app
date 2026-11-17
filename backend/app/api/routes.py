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
