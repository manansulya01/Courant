"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Lesson = {
  id: string;
  category: string;
  title: string;
  description: string;
  prompt: string;
  example: string;
  task: string;
};

const lessons: Lesson[] = [
  { id: "introductions", category: "Speaking", title: "Introduce yourself", description: "Build a clear, natural introduction for a new person.", prompt: "Imagine you are meeting a new classmate. Introduce yourself in 3–5 sentences.", example: "Hi, I’m Aanya. I’m from Bhopal, and I enjoy reading and playing badminton. I’m learning English because I want to speak with more confidence.", task: "Write your own introduction. Try to include your name, where you are from, one interest, and a reason for learning English." },
  { id: "daily-routine", category: "Everyday English", title: "Talk about your day", description: "Practise the present simple and useful time phrases.", prompt: "Describe a normal weekday, from the time you wake up until you go to bed.", example: "I usually wake up at seven. I have breakfast, then I go to school. In the evening, I practise English for twenty minutes.", task: "Write five sentences about your weekday. Use usually, sometimes, and in the evening." },
  { id: "asking-questions", category: "Conversation", title: "Ask better questions", description: "Keep a conversation moving with open questions.", prompt: "You have just met someone who enjoys music. Ask three questions that invite a detailed answer.", example: "What kind of music do you enjoy? When did you become interested in it? Have you been to a live concert recently?", task: "Write three open questions. Start them with what, how, or why." },
  { id: "past-tense", category: "Grammar", title: "Tell a story in the past", description: "Use past-tense verbs to describe a memorable experience.", prompt: "Describe something enjoyable you did last weekend.", example: "Last Saturday, I visited my cousins. We played a board game and cooked dinner together. I had a wonderful time.", task: "Write four sentences about last weekend. Check that your action verbs are in the past tense." },
  { id: "opinions", category: "Fluency", title: "Share an opinion", description: "Give an opinion, explain why, and add an example.", prompt: "Do you think students should read for pleasure every day? Explain your view.", example: "I think reading every day is useful because it builds vocabulary. For example, even a short story can teach you new expressions.", task: "Write your opinion in 4–6 sentences. Include because and for example." },
  { id: "polite-requests", category: "Real-world English", title: "Make a polite request", description: "Sound friendly and respectful in everyday situations.", prompt: "You are in a library and need help finding a book. Ask a librarian politely.", example: "Excuse me, could you help me find a book about astronomy, please?", task: "Write two polite requests. Try could you and would you mind." },
];

const STORAGE_KEY = "courant.offline-practice.v1";

export default function OfflinePracticePage() {
  const [completed, setCompleted] = useState<string[]>([]);
  const [selected, setSelected] = useState(lessons[0].id);
  const [answer, setAnswer] = useState("");
  const [saved, setSaved] = useState(false);
  const [backupStatus, setBackupStatus] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { completed?: unknown; answers?: Record<string, string> };
        if (Array.isArray(parsed.completed)) setCompleted(parsed.completed.filter((id): id is string => typeof id === "string" && lessons.some(lesson => lesson.id === id)));
        if (parsed.answers && typeof parsed.answers === "object") setAnswer(String(parsed.answers[lessons[0].id] || ""));
      }
    } catch {
      // Private browsing or storage restrictions should not prevent practice.
    }
  }, []);

  const lesson = useMemo(() => lessons.find(item => item.id === selected) || lessons[0], [selected]);

  function persist(nextCompleted: string[], nextAnswer: string, lessonId = selected) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const previous = raw ? JSON.parse(raw) as { answers?: Record<string, string> } : {};
      const answers = previous.answers && typeof previous.answers === "object" ? previous.answers : {};
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ completed: nextCompleted, answers: { ...answers, [lessonId]: nextAnswer } }));
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }

  function chooseLesson(id: string) {
    persist(completed, answer);
    setSelected(id);
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) as { answers?: Record<string, string> } : {};
      setAnswer(String(parsed.answers?.[id] || ""));
    } catch {
      setAnswer("");
    }
    setSaved(false);
  }

  function markComplete() {
    const next = completed.includes(lesson.id) ? completed : [...completed, lesson.id];
    setCompleted(next);
    persist(next, answer);
  }

  function exportProgress() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) as { answers?: Record<string, string> } : {};
      const backup = {
        app: "Courant",
        format: "courant-offline-practice",
        version: 1,
        exportedAt: new Date().toISOString(),
        completed,
        answers: parsed.answers && typeof parsed.answers === "object" ? parsed.answers : { [selected]: answer },
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `courant-practice-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setBackupStatus("Backup downloaded. Keep it somewhere safe to restore your work later.");
    } catch {
      setBackupStatus("Your browser could not create a backup. Check storage permissions and try again.");
    }
  }

  async function importProgress(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 1024 * 1024) {
      setBackupStatus("That file is too large. Choose a Courant backup smaller than 1 MB.");
      return;
    }
    try {
      const data = JSON.parse(await file.text()) as {
        format?: unknown;
        version?: unknown;
        completed?: unknown;
        answers?: unknown;
      };
      if (data.format !== "courant-offline-practice" || data.version !== 1) {
        throw new Error("This is not a supported Courant practice backup.");
      }
      if (!Array.isArray(data.completed) || !data.answers || typeof data.answers !== "object" || Array.isArray(data.answers)) {
        throw new Error("The backup file is incomplete or invalid.");
      }
      const validIds = new Set(lessons.map(item => item.id));
      const restoredCompleted = [...new Set(data.completed.filter((id): id is string => typeof id === "string" && validIds.has(id)))];
      const restoredAnswers: Record<string, string> = {};
      for (const [id, value] of Object.entries(data.answers as Record<string, unknown>)) {
        if (validIds.has(id) && typeof value === "string") restoredAnswers[id] = value.slice(0, 20000);
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ completed: restoredCompleted, answers: restoredAnswers }));
      setCompleted(restoredCompleted);
      setAnswer(restoredAnswers[selected] || "");
      setSaved(true);
      setBackupStatus(`Restored ${restoredCompleted.length} completed lessons and ${Object.keys(restoredAnswers).length} saved drafts on this device.`);
    } catch (error) {
      setBackupStatus(error instanceof Error ? error.message : "Could not read that backup file.");
    }
  }

  return (
    <main className="min-h-screen bg-[var(--paper)] px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">← Courant home</Link>
        <header className="my-9 max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--accent)]">No account · No database · Your device</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Keep learning, wherever you are.</h1>
          <p className="mt-4 leading-7 text-[var(--muted)]">A small collection of practical English exercises that works without signing in or connecting to a server. Your answers and progress stay in this browser on this device.</p>
        </header>

        <section className="mb-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-sm font-semibold">Your practice progress</p><p className="mt-1 text-sm text-[var(--muted)]">{completed.length} of {lessons.length} lessons completed</p></div>
            <p className="text-2xl font-semibold tabular-nums">{Math.round(completed.length / lessons.length * 100)}%</p>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--line)]"><div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${completed.length / lessons.length * 100}%` }} /></div>
        </section>

        <section className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
          <div className="min-w-0">
            <h2 className="font-semibold">Keep a copy of your learning</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Export your drafts and progress, or restore them on another device. Your backup stays under your control.</p>
            {backupStatus && <p className="mt-2 text-xs text-[var(--accent)]" role="status">{backupStatus}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={exportProgress} className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold hover:bg-[var(--paper)]">Download backup</button>
            <label className="cursor-pointer rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
              Restore backup
              <input type="file" accept="application/json,.json" onChange={importProgress} className="sr-only" aria-label="Choose a Courant practice backup" />
            </label>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <aside className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
            <h2 className="px-3 py-2 text-sm font-semibold">Practice library</h2>
            <div className="flex flex-col gap-1">
              {lessons.map((item, index) => <button key={item.id} type="button" onClick={() => chooseLesson(item.id)} aria-current={selected === item.id ? "step" : undefined} className={`flex items-start gap-3 rounded-xl p-3 text-left transition ${selected === item.id ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--paper)]"}`}>
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[var(--line)] text-xs">{completed.includes(item.id) ? "✓" : index + 1}</span>
                <span><span className="block text-sm font-semibold">{item.title}</span><span className="mt-0.5 block text-xs text-[var(--muted)]">{item.category}</span></span>
              </button>)}
            </div>
          </aside>

          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--accent)]">{lesson.category}</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">{lesson.title}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">{lesson.description}</p>
            <div className="mt-7 rounded-xl bg-[var(--paper)] p-4 sm:p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Your challenge</p>
              <p className="mt-2 leading-7">{lesson.prompt}</p>
            </div>
            <label htmlFor="practice-answer" className="mt-6 block text-sm font-semibold">Your answer</label>
            <textarea id="practice-answer" value={answer} onChange={event => { setAnswer(event.target.value); setSaved(false); }} rows={7} placeholder="Take your time. Write naturally…" className="mt-2 w-full resize-y rounded-xl border border-[var(--line)] bg-white p-4 leading-7 outline-none focus:border-[var(--accent)]" />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-[var(--muted)]" role="status">{saved ? "Saved on this device" : "Your draft is not saved yet"}</span>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => persist(completed, answer)} className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold hover:bg-[var(--paper)]">Save draft</button>
                <button type="button" onClick={markComplete} disabled={!answer.trim()} className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{completed.includes(lesson.id) ? "Completed ✓" : "Mark complete"}</button>
              </div>
            </div>
            <details className="mt-7 border-t border-[var(--line)] pt-5">
              <summary className="cursor-pointer text-sm font-semibold">See a sample answer and a tip</summary>
              <p className="mt-3 text-sm leading-7">{lesson.example}</p>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{lesson.task}</p>
            </details>
          </section>
        </div>

        <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
          <div><h2 className="font-semibold">Want a conversation partner?</h2><p className="mt-1 text-sm text-[var(--muted)]">Try the optional on-device AI tutor. It needs a compatible browser and a one-time model download.</p></div>
          <Link href="/local-tutor" className="rounded-full border border-[var(--line)] px-5 py-3 text-sm font-semibold hover:bg-[var(--paper)]">Open local tutor ↗</Link>
        </section>
        <p className="mt-6 text-xs leading-6 text-[var(--muted)]">This mode is designed for individual practice. Progress is stored only in this browser; it does not sync automatically, create teacher accounts, or replace classroom assignments. Download a backup before clearing browser data or moving to another device.</p>
      </div>
    </main>
  );
}
