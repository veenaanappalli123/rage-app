
# RAG Application

A document question-answering application developed for the AI Systems Integration and Operations course.

## Features

### V1
- Upload and delete Markdown and plain-text documents.
- Configure chunk size and overlap.
- Generate embeddings using Sentence Transformers.
- Store and retrieve vectors with ChromaDB.
- Ask questions using an OpenAI-compatible LLM API.
- Display answers and source references.

### V2
- Separate Kestrel and own-document corpora.
- Compare retrieval configurations.
- Evaluate HitRate@k and Recall@k.
- Run no-context LLM baselines.
- Analyse corpus vocabulary and question words in the Words tab.
- Record manual answer grades.

## Architecture

Document indexing:

File -> Text -> Chunks -> Embeddings -> ChromaDB

Question answering:

Question -> Query embedding -> Dense retrieval -> LLM -> Answer and references

## Requirements

- Python 3.11 or 3.12
- Node.js
- npm

## Backend setup

From the repository root:

```bash
python -m venv .venv
source .venv/Scripts/activate
pip install -r backend/requirements.txt
```

Copy `.env.example` to `.env` and configure the LLM provider credentials.

Start the backend from the repository root:

```bash
uvicorn app.main:app --app-dir backend --reload --port 8000
```

API documentation: http://localhost:8000/docs

## Frontend setup

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

## V2 corpora

The two source corpora are stored in:

- `data/kestrel/`
- `data/own/`

Their question sets are:

- `evaluation/kestrel_questions.jsonl`
- `evaluation/own_questions.jsonl`

Index both corpora from the repository root:

```bash
curl -X POST "http://localhost:8000/api/v2/index/kestrel?chunk_size=800&overlap=100"
curl -X POST "http://localhost:8000/api/v2/index/own?chunk_size=800&overlap=100"
```

Check indexed corpora:

```bash
curl http://localhost:8000/api/v2/corpora
```

## V2 evaluation

Run the evaluation from the repository root:

```bash
curl -X POST http://localhost:8000/api/v2/evaluate
```

The generated files are saved under `evaluation/results/`:

- `v2-retrieval-results.json`
- `v2-no-context-results.json`

The retrieval evaluation compares chunk configurations and reports HitRate@k and Recall@k.

## Words analysis

1. Start the backend and frontend.
2. Open the application at http://localhost:3000.
3. Select the **Words** tab.
4. Choose Kestrel or Own corpus.
5. Select Corpus vocabulary to inspect words and their chunk mappings.
6. Select Question analysis to see which question words occur in the corpus and the chunks containing them.

## Manual grading

1. Open the **Manual grading** tab.
2. Enter the corpus, question ID, question, expected answer and generated answer.
3. Select Correct, Partial, Wrong or Unsupported.
4. Add a short explanation.
5. Save the grade.
6. Export the saved grades as `v2-manual-grades.json`.

Manual grades are stored in the browser's local storage until exported. Keep the exported JSON with the evaluation results.

## About page

The separate page is available at:

http://localhost:3000/about

It is intentionally not linked from the main application.

## Environment variables

See `.env.example`. Never commit `.env`, `.env.local` or API credentials.
