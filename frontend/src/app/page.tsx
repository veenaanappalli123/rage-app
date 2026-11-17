
"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

type DocumentItem = {
  document_id: string;
  filename: string;
  chunks: number;
};

type Reference = {
  chunk_id: string;
  document_id: string;
  filename: string;
  chunk_index: number;
  text: string;
};

type Answer = {
  answer: string;
  references: Reference[];
  abstained: boolean;
};

export default function Home() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [chunkSize, setChunkSize] = useState(800);
  const [overlap, setOverlap] = useState(100);
  const [topK, setTopK] = useState(5);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadDocuments() {
    try {
      const response = await fetch(`${API}/documents`);
      if (!response.ok) throw new Error("Could not load documents.");
      const data: DocumentItem[] = await response.json();
      setDocuments(data);
    } catch {
      setError("Cannot connect to the backend. Is FastAPI running?");
    }
  }

  useEffect(() => {
    loadDocuments();
  }, []);

  async function uploadDocument() {
    if (!file) {
      setError("Choose a .md or .txt file first.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    setAnswer(null);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("chunk_size", String(chunkSize));
      form.append("chunk_overlap", String(overlap));

      const response = await fetch(`${API}/documents`, {
        method: "POST",
        body: form,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Upload failed.");

      setMessage(`Indexed ${data.filename}: ${data.chunks} chunks created.`);
      setFile(null);
      await loadDocuments();
      setSelected((previous) => [...previous, data.document_id]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteDocument(id: string) {
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API}/documents/${id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Delete failed.");

      setSelected((previous) => previous.filter((item) => item !== id));
      setMessage("Document deleted.");
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  function toggleDocument(id: string) {
    setSelected((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id]
    );
  }

  async function askQuestion() {
    if (question.trim().length < 3) {
      setError("Enter a question with at least 3 characters.");
      return;
    }

    if (selected.length === 0) {
      setError("Select at least one document.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    setAnswer(null);

    try {
      const response = await fetch(`${API}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          document_ids: selected,
          chunk_size: chunkSize,
          chunk_overlap: overlap,
          top_k: topK,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Question failed.");

      setAnswer(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Question failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
            Document intelligence
          </p>
          <h1 className="mt-2 text-4xl font-bold">RAG Application</h1>
          <p className="mt-3 text-slate-400">
            Ask questions about your documents and inspect the evidence behind
            each answer.
          </p>
        </header>

        {error && (
          <div role="alert" className="mb-5 rounded-lg border border-red-700 bg-red-950/40 p-4 text-red-200">
            {error}
          </div>
        )}

        {message && (
          <div role="status" className="mb-5 rounded-lg border border-green-700 bg-green-950/40 p-4 text-green-200">
            {message}
          </div>
        )}

        <section className="mb-7 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-semibold">1. Document management</h2>
          <p className="mt-1 text-sm text-slate-400">
            Upload Markdown or plain-text documents. Each document is split
            into chunks and indexed.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              Chunk size (characters)
              <input
                type="number"
                min={100}
                max={5000}
                value={chunkSize}
                onChange={(e) => setChunkSize(Number(e.target.value))}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
              />
            </label>

            <label className="text-sm">
              Chunk overlap (characters)
              <input
                type="number"
                min={0}
                max={chunkSize - 1}
                value={overlap}
                onChange={(e) => setOverlap(Number(e.target.value))}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              type="file"
              accept=".md,.txt,text/plain"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm"
            />
            <button
              onClick={uploadDocument}
              disabled={loading || !file}
              className="rounded-lg bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Upload and index
            </button>
          </div>

          <h3 className="mt-7 font-semibold">Available documents</h3>
          {documents.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              No documents uploaded yet.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.document_id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 p-3"
                >
                  <label className="flex min-w-0 items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(doc.document_id)}
                      onChange={() => toggleDocument(doc.document_id)}
                      className="h-4 w-4"
                    />
                    <span className="truncate text-sm">{doc.filename}</span>
                  </label>
                  <button
                    onClick={() => deleteDocument(doc.document_id)}
                    className="shrink-0 text-sm text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mb-7 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-semibold">2. Ask your documents</h2>

          <label className="mt-5 block text-sm">
            Number of retrieved chunks (top-k)
            <input
              type="number"
              min={1}
              max={20}
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-3 sm:w-40"
            />
          </label>

          <label className="mt-5 block text-sm">
            Your question
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={4}
              placeholder="Ask something about the selected documents..."
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
            />
          </label>

          <button
            onClick={askQuestion}
            disabled={loading}
            className="mt-4 rounded-lg bg-emerald-600 px-6 py-3 font-semibold hover:bg-emerald-500 disabled:opacity-50"
          >
            {loading ? "Processing..." : "Ask question"}
          </button>
        </section>

        {answer && (
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">3. Answer</h2>
            {answer.abstained && (
              <p className="mt-3 rounded-lg bg-amber-950/40 p-3 text-amber-200">
                The system could not verify an answer from the selected
                documents.
              </p>
            )}
            <p className="mt-4 whitespace-pre-wrap leading-7">{answer.answer}</p>

            <h3 className="mt-7 font-semibold">
              References ({answer.references.length})
            </h3>

            {answer.references.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                No verifiable references were returned.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {answer.references.map((ref) => (
                  <details
                    key={ref.chunk_id}
                    className="rounded-lg border border-slate-700 p-4"
                  >
                    <summary className="cursor-pointer text-sm font-semibold text-blue-300">
                      {ref.filename} — chunk {ref.chunk_index + 1}
                    </summary>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                      {ref.text}
                    </p>
                    <p className="mt-3 break-all text-xs text-slate-500">
                      Chunk ID: {ref.chunk_id}
                    </p>
                  </details>
                ))}
              </div>
            )}
          </section>
        )}

        <footer className="mt-10 border-t border-slate-800 pt-5 text-xs text-slate-500">
          RAG V1 · Dense retrieval · ChromaDB · Sentence Transformers
        </footer>
      </div>
    </main>
  );
}
