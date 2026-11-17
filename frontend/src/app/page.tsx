
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

type WordRow = {
  word: string;
  chunk_count: number;
  chunks: string[];
};

type QuestionAnalysis = {
  question_id: string;
  question: string;
  present_words: string[];
  absent_words: string[];
  word_chunks: Record<string, string[]>;
};

type Grade = {
  corpus: string;
  question_id: string;
  question: string;
  expected_answer: string;
  generated_answer: string;
  label: string;
  notes: string;
};

export default function Home() {
  const [tab, setTab] = useState("v1");

  // V1 state
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [chunkSize, setChunkSize] = useState(800);
  const [overlap, setOverlap] = useState(100);
  const [topK, setTopK] = useState(5);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);

  // Shared state
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // V2 Words state
  const [corpus, setCorpus] = useState("kestrel");
  const [wordMode, setWordMode] = useState("corpus");
  const [wordData, setWordData] = useState<{
    total_chunks?: number;
    vocabulary_size?: number;
    words?: WordRow[];
    questions?: QuestionAnalysis[];
  } | null>(null);
  const [wordSearch, setWordSearch] = useState("");

  // Manual grading state
  const [grades, setGrades] = useState<Grade[]>([]);
  const [gradeCorpus, setGradeCorpus] = useState("kestrel");
  const [gradeId, setGradeId] = useState("");
  const [gradeQuestion, setGradeQuestion] = useState("");
  const [expectedAnswer, setExpectedAnswer] = useState("");
  const [generatedAnswer, setGeneratedAnswer] = useState("");
  const [gradeLabel, setGradeLabel] = useState("correct");
  const [gradeNotes, setGradeNotes] = useState("");

  useEffect(() => {
    loadDocuments();
    try {
      const saved = localStorage.getItem("rag-v2-grades");
      if (saved) setGrades(JSON.parse(saved));
    } catch {
      setGrades([]);
    }
  }, []);

  async function loadDocuments() {
    try {
      const response = await fetch(`${API}/documents`);
      if (!response.ok) throw new Error("Could not load documents.");
      setDocuments(await response.json());
    } catch {
      setError("Cannot connect to the backend. Is FastAPI running?");
    }
  }

  async function uploadDocument() {
    if (!file) {
      setError("Choose a .md or .txt file first.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

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

  async function loadWords() {
    setLoading(true);
    setError("");
    setWordData(null);

    try {
      const response = await fetch(
        `${API}/v2/words/${corpus}?mode=${wordMode}`
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Words request failed.");
      setWordData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load words.");
    } finally {
      setLoading(false);
    }
  }

  function saveGrade() {
    if (!gradeQuestion.trim() || !gradeId.trim()) {
      setError("Enter a question ID and question before saving.");
      return;
    }

    const newGrade: Grade = {
      corpus: gradeCorpus,
      question_id: gradeId,
      question: gradeQuestion,
      expected_answer: expectedAnswer,
      generated_answer: generatedAnswer,
      label: gradeLabel,
      notes: gradeNotes,
    };

    const updated = [
      ...grades.filter(
        (item) =>
          !(item.corpus === gradeCorpus && item.question_id === gradeId)
      ),
      newGrade,
    ];

    setGrades(updated);
    localStorage.setItem("rag-v2-grades", JSON.stringify(updated));
    setMessage(`Saved grade for ${gradeId}.`);
    setError("");
  }

  function exportGrades() {
    const blob = new Blob([JSON.stringify(grades, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "v2-manual-grades.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  const filteredWords =
    wordData?.words?.filter((item) =>
      item.word.includes(wordSearch.toLowerCase())
    ) || [];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
            Document intelligence
          </p>
          <h1 className="mt-2 text-4xl font-bold">RAG Application</h1>
          <p className="mt-3 text-slate-400">
            Document retrieval, evaluation and corpus analysis.
          </p>
        </header>

        <nav className="mb-7 flex flex-wrap gap-2 border-b border-slate-800 pb-4">
          {[
            ["v1", "Document Q&A"],
            ["words", "Words"],
            ["grading", "Manual grading"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => {
                setTab(id);
                setError("");
                setMessage("");
              }}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                tab === id
                  ? "bg-blue-600 text-white"
                  : "bg-slate-900 text-slate-300 hover:bg-slate-800"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

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

        {tab === "v1" && (
          <>
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
                  className="rounded-lg bg-blue-600 px-5 py-3 font-semibold disabled:opacity-50"
                >
                  Upload and index
                </button>
              </div>

              <h3 className="mt-7 font-semibold">Available documents</h3>
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
                      />
                      <span className="truncate text-sm">{doc.filename}</span>
                    </label>
                    <button
                      onClick={() => deleteDocument(doc.document_id)}
                      className="shrink-0 text-sm text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                ))}
                {documents.length === 0 && (
                  <p className="text-sm text-slate-500">No documents uploaded.</p>
                )}
              </div>
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
                className="mt-4 rounded-lg bg-emerald-600 px-6 py-3 font-semibold disabled:opacity-50"
              >
                {loading ? "Processing..." : "Ask question"}
              </button>
            </section>

            {answer && (
              <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
                <h2 className="text-xl font-semibold">3. Answer</h2>
                {answer.abstained && (
                  <p className="mt-3 rounded-lg bg-amber-950/40 p-3 text-amber-200">
                    The system could not verify an answer from the selected documents.
                  </p>
                )}
                <p className="mt-4 whitespace-pre-wrap leading-7">{answer.answer}</p>
                <h3 className="mt-7 font-semibold">
                  References ({answer.references.length})
                </h3>
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
              </section>
            )}
          </>
        )}

        {tab === "words" && (
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-2xl font-semibold">Words analysis</h2>
            <p className="mt-2 text-sm text-slate-400">
              Explore vocabulary in a corpus or inspect which question words
              appear in the indexed chunks.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <select
                value={corpus}
                onChange={(e) => {
                  setCorpus(e.target.value);
                  setWordData(null);
                }}
                className="rounded-lg border border-slate-700 bg-slate-950 p-3"
              >
                <option value="kestrel">Kestrel corpus</option>
                <option value="own">Own corpus</option>
              </select>
              <select
                value={wordMode}
                onChange={(e) => {
                  setWordMode(e.target.value);
                  setWordData(null);
                }}
                className="rounded-lg border border-slate-700 bg-slate-950 p-3"
              >
                <option value="corpus">Corpus vocabulary</option>
                <option value="questions">Question analysis</option>
              </select>
              <button
                onClick={loadWords}
                disabled={loading}
                className="rounded-lg bg-blue-600 px-5 py-3 font-semibold disabled:opacity-50"
              >
                {loading ? "Loading..." : "Analyse"}
              </button>
            </div>

            {wordData && wordMode === "corpus" && (
              <>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-slate-950 p-4">
                    <p className="text-sm text-slate-400">Total chunks</p>
                    <p className="mt-1 text-2xl font-bold">
                      {wordData.total_chunks}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-950 p-4">
                    <p className="text-sm text-slate-400">Vocabulary size</p>
                    <p className="mt-1 text-2xl font-bold">
                      {wordData.vocabulary_size}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-950 p-4">
                    <p className="text-sm text-slate-400">Unique words</p>
                    <p className="mt-1 text-2xl font-bold">
                      {wordData.words?.length || 0}
                    </p>
                  </div>
                </div>

                <input
                  value={wordSearch}
                  onChange={(e) => setWordSearch(e.target.value)}
                  placeholder="Search vocabulary..."
                  className="mt-6 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
                />

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-700 text-slate-400">
                      <tr>
                        <th className="p-3">Word</th>
                        <th className="p-3">Chunk count</th>
                        <th className="p-3">Chunk IDs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredWords.map((item) => (
                        <tr key={item.word} className="border-b border-slate-800">
                          <td className="p-3 font-semibold">{item.word}</td>
                          <td className="p-3">{item.chunk_count}</td>
                          <td className="p-3 break-all text-xs text-slate-400">
                            {item.chunks.join(", ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {wordData && wordMode === "questions" && (
              <div className="mt-6 space-y-4">
                {(wordData.questions || []).map((item) => (
                  <details
                    key={item.question_id}
                    className="rounded-lg border border-slate-700 p-4"
                  >
                    <summary className="cursor-pointer font-semibold">
                      {item.question_id}: {item.question}
                    </summary>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <h4 className="font-semibold text-emerald-400">
                          Words found in corpus ({item.present_words.length})
                        </h4>
                        <p className="mt-2 break-words text-sm text-slate-300">
                          {item.present_words.join(", ") || "None"}
                        </p>
                      </div>
                      <div>
                        <h4 className="font-semibold text-red-400">
                          Words absent from corpus ({item.absent_words.length})
                        </h4>
                        <p className="mt-2 break-words text-sm text-slate-300">
                          {item.absent_words.join(", ") || "None"}
                        </p>
                      </div>
                    </div>
                    <h4 className="mt-4 font-semibold">Word-to-chunk mapping</h4>
                    <div className="mt-2 space-y-2">
                      {Object.entries(item.word_chunks).map(([word, chunks]) => (
                        <p key={word} className="break-all text-xs text-slate-400">
                          <span className="font-semibold text-blue-300">{word}:</span>{" "}
                          {chunks.join(", ")}
                        </p>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "grading" && (
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-2xl font-semibold">Manual answer grading</h2>
            <p className="mt-2 text-sm text-slate-400">
              Record human judgments for generated answers. Save one grade per
              question ID and export the results as JSON.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                Corpus
                <select
                  value={gradeCorpus}
                  onChange={(e) => setGradeCorpus(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
                >
                  <option value="kestrel">Kestrel</option>
                  <option value="own">Own corpus</option>
                </select>
              </label>
              <label className="text-sm">
                Question ID
                <input
                  value={gradeId}
                  onChange={(e) => setGradeId(e.target.value)}
                  placeholder="e.g. q01 or O01"
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
                />
              </label>
            </div>

            <label className="mt-4 block text-sm">
              Question
              <textarea
                value={gradeQuestion}
                onChange={(e) => setGradeQuestion(e.target.value)}
                rows={2}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
              />
            </label>

            <label className="mt-4 block text-sm">
              Expected answer
              <textarea
                value={expectedAnswer}
                onChange={(e) => setExpectedAnswer(e.target.value)}
                rows={3}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
              />
            </label>

            <label className="mt-4 block text-sm">
              Generated answer
              <textarea
                value={generatedAnswer}
                onChange={(e) => setGeneratedAnswer(e.target.value)}
                rows={3}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
              />
            </label>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                Human judgment
                <select
                  value={gradeLabel}
                  onChange={(e) => setGradeLabel(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
                >
                  <option value="correct">Correct</option>
                  <option value="partial">Partial</option>
                  <option value="wrong">Wrong</option>
                  <option value="unsupported">Unsupported</option>
                </select>
              </label>
              <label className="text-sm">
                Notes / reason
                <input
                  value={gradeNotes}
                  onChange={(e) => setGradeNotes(e.target.value)}
                  placeholder="Explain the judgment"
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-3"
                />
              </label>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={saveGrade}
                className="rounded-lg bg-emerald-600 px-5 py-3 font-semibold"
              >
                Save grade
              </button>
              <button
                onClick={exportGrades}
                disabled={grades.length === 0}
                className="rounded-lg bg-blue-600 px-5 py-3 font-semibold disabled:opacity-50"
              >
                Export grades JSON
              </button>
            </div>

            <h3 className="mt-8 font-semibold">
              Saved grades ({grades.length})
            </h3>
            <div className="mt-3 space-y-2">
              {grades.map((item) => (
                <div
                  key={`${item.corpus}-${item.question_id}`}
                  className="rounded-lg border border-slate-700 p-3 text-sm"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-semibold">
                      {item.corpus} / {item.question_id}
                    </span>
                    <span className="capitalize text-blue-300">{item.label}</span>
                  </div>
                  <p className="mt-1 text-slate-400">{item.question}</p>
                </div>
              ))}
              {grades.length === 0 && (
                <p className="text-sm text-slate-500">No grades saved yet.</p>
              )}
            </div>
          </section>
        )}

        <footer className="mt-10 border-t border-slate-800 pt-5 text-xs text-slate-500">
          RAG V2 · Dense retrieval · ChromaDB · Sentence Transformers
        </footer>
      </div>
    </main>
  );
}
