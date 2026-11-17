from pydantic import BaseModel, Field


class AskRequest(BaseModel):
    question: str = Field(min_length=3, max_length=2000)
    document_ids: list[str] = Field(min_length=1)
    chunk_size: int = Field(default=800, ge=100, le=5000)
    chunk_overlap: int = Field(default=100, ge=0, le=1000)
    top_k: int = Field(default=5, ge=1, le=20)


class Reference(BaseModel):
    chunk_id: str
    document_id: str
    filename: str
    chunk_index: int
    text: str


class AnswerResponse(BaseModel):
    answer: str
    references: list[Reference]
    abstained: bool = False


class DocumentResponse(BaseModel):
    document_id: str
    filename: str
    chunks: int
    message: str


class EvaluationQuestion(BaseModel):
    question: str
    expected_answer: str
    expected_document_id: str
    expected_text: str
    answerable: bool = True
