
# RAG Application

A document question-answering application built progressively from V1 to V4
for the AI Systems Integration and Operations course.

## V1 scope

- Upload and delete Markdown and plain-text documents.
- Configure chunk size and overlap.
- Generate embeddings using Sentence Transformers.
- Store and retrieve vectors with ChromaDB.
- Ask questions using an OpenAI-compatible LLM API.
- Display grounded answers and source references.
- Run a repeatable retrieval evaluation.

## Architecture

Document upload:
File -> Text -> Chunks -> Embeddings -> ChromaDB

Question answering:
Question -> Query embedding -> Dense retrieval -> LLM -> Validated answer

## Requirements

- Python 3.11 or 3.12
- Node.js
- npm

## Backend setup

```bash
python -m venv .venv
source .venv/Scripts/activate
pip install -r backend/requirements.txt
```

Copy `.env.example` to `.env` and configure your LLM provider.

Run the API from the repository root:

```bash
uvicorn app.main:app --app-dir backend --reload --port 8000
```

API documentation: http://localhost:8000/docs

## Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

## Evaluation

Create an evaluation question set in `evaluation/questions.json`.
For every answerable question, include the expected document ID and an exact
phrase from the source passage.

Run from the repository root:

```bash
PYTHONPATH=backend python backend/run_evaluation.py
```

Results are written to `evaluation/v1-results.json`.

## Environment variables

See `.env.example`. Never commit `.env` or API credentials.
