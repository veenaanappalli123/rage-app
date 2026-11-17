## V2: Evaluation and corpus analysis

### Start the application

From the repository root, start the backend:

```bash
uvicorn app.main:app --app-dir backend --reload --port 8000
```

In a second terminal, start the frontend:

```bash
cd frontend
npm run dev
```

The frontend is available at `http://localhost:3000` and the API at `http://localhost:8000/api`.

### V2 corpora

V2 evaluates two corpora:

- `kestrel`: the five-document Kestrel knowledge base.
- `own`: `technology-skills.md`, the project’s networking and cybersecurity corpus.

The saved question sets are `evaluation/kestrel_questions.jsonl` and `evaluation/own_questions.jsonl`.

### Run V2 evaluation

With the backend running, send:

```bash
curl -X POST http://localhost:8000/api/v2/evaluate
```

The evaluation outputs are saved under `evaluation/results/`. The retrieval evaluation compares chunk sizes 800/100 and 400/50 at top-k values 1, 3, 5 and 10. Unanswerable questions are excluded from HitRate and Recall.

### Retrieve and optionally generate an answer

Retrieval-only is the default:

```bash
curl -X POST http://localhost:8000/api/v2/retrieve \
  -H "Content-Type: application/json" \
  -d '{"corpus_id":"kestrel","question":"How do I troubleshoot KST-5031?","top_k":10}'
```

To request an answer generated from the retrieved evidence, set `generate` to `true`:

```bash
curl -X POST http://localhost:8000/api/v2/retrieve \
  -H "Content-Type: application/json" \
  -d '{"corpus_id":"kestrel","question":"How do I troubleshoot KST-5031?","top_k":10,"generate":true}'
```

### Words tab

Open the **Words** tab in the frontend.

- **Corpus mode** shows the vocabulary, word counts, total chunks, and the chunks containing a selected word.
- **Questions mode** shows the words in each saved question, which words occur in the corpus, which chunks contain them, and which words are absent.

Choose the corpus (`kestrel` or `own`) to inspect its vocabulary.

### Evaluation artifacts

Important outputs include:

- `evaluation/results/v2-retrieval-results.json`
- `evaluation/results/v2-no-context-results.json`
- `evaluation/results/kestrel-generated-answers.jsonl`
- `evaluation/results/own-generated-answers.jsonl`
- `evaluation/results/manual-grading.csv`

The `/about` page is intentionally not linked from the main frontend navigation.
