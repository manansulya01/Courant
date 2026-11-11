"use client";

import { useState } from "react";
import Link from "next/link";

type Assignment = {
  format: "courant-offline-assignment";
  version: 1;
  id: string;
  className: string;
  title: string;
  instructions: string;
  dueDate: string;
  createdAt: string;
};
type Submission = {
  format: "courant-offline-submission";
  version: 1;
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  learnerLabel: string;
  response: string;
  submittedAt: string;
};
type ImportedSubmission = Submission & { fileName: string };

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `courant-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function downloadJson(fileName: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function readJson(file: File): Promise<unknown> {
  if (file.size > 512 * 1024) throw new Error(`${file.name} is too large. Choose a file smaller than 512 KB.`);
  return JSON.parse(await file.text()) as unknown;
}

function isAssignment(value: unknown): value is Assignment {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return item.format === "courant-offline-assignment" && item.version === 1 &&
    typeof item.id === "string" && typeof item.title === "string" &&
    typeof item.instructions === "string" && typeof item.className === "string" &&
    typeof item.dueDate === "string";
}

function isSubmission(value: unknown): value is Submission {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return item.format === "courant-offline-submission" && item.version === 1 &&
    typeof item.id === "string" && typeof item.assignmentId === "string" &&
    typeof item.assignmentTitle === "string" && typeof item.learnerLabel === "string" &&
    typeof item.response === "string" && typeof item.submittedAt === "string";
}

const fieldClass = "mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]";
const labelClass = "block text-sm font-semibold text-[var(--ink)]";

export default function OfflineClassroomPage() {
  const [className, setClassName] = useState("");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [learnerLabel, setLearnerLabel] = useState("");
  const [response, setResponse] = useState("");
  const [submissions, setSubmissions] = useState<ImportedSubmission[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  function createAssignment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Assignment = {
      format: "courant-offline-assignment",
      version: 1,
      id: makeId(),
      className: className.trim().slice(0, 80),
      title: title.trim().slice(0, 120),
      instructions: instructions.trim().slice(0, 5000),
      dueDate,
      createdAt: new Date().toISOString(),
    };
    setAssignment(next);
    setSubmissions([]);
    setStatus("Assignment created. Download the file and share it with learners.");
  }

  function downloadAssignment() {
    if (!assignment) return;
    downloadJson(`courant-assignment-${assignment.id.slice(0, 8)}.json`, assignment);
    setStatus("Assignment file downloaded. Share it with your class using your usual school channel.");
  }

  async function importAssignment(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const data = await readJson(file);
      if (!isAssignment(data)) throw new Error("That file is not a supported Courant assignment.");
      setAssignment(data);
      setResponse("");
      setSubmissions([]);
      setStatus(`Loaded “${data.title}”. Write your response below, then export your submission.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not open that assignment.");
    } finally {
      setBusy(false);
    }
  }

  function downloadSubmission() {
    if (!assignment || !response.trim()) return;
    const submission: Submission = {
      format: "courant-offline-submission",
      version: 1,
      id: makeId(),
      assignmentId: assignment.id,
      assignmentTitle: assignment.title,
      learnerLabel: learnerLabel.trim().slice(0, 80) || "Learner",
      response: response.trim().slice(0, 20000),
      submittedAt: new Date().toISOString(),
    };
    downloadJson(`courant-submission-${submission.id.slice(0, 8)}.json`, submission);
    setStatus("Submission downloaded. Send the file to your teacher through your school's approved channel.");
  }

  async function importSubmissions(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!assignment || !files.length) return;
    setBusy(true);
    let accepted = 0;
    const errors: string[] = [];
    const incoming: ImportedSubmission[] = [];
    for (const file of files) {
      try {
        const data = await readJson(file);
        if (!isSubmission(data)) throw new Error("Unsupported submission file.");
        if (data.assignmentId !== assignment.id) throw new Error("This submission belongs to a different assignment.");
        if (!data.response.trim()) throw new Error("The response is empty.");
        incoming.push({ ...data, learnerLabel: data.learnerLabel.slice(0, 80), response: data.response.slice(0, 20000), fileName: file.name });
      } catch (error) {
        errors.push(`${file.name}: ${error instanceof Error ? error.message : "invalid file"}`);
      }
    }
    setSubmissions(current => {
      const known = new Set(current.map(item => item.id));
      const fresh = incoming.filter(item => !known.has(item.id));
      accepted = fresh.length;
      return [...current, ...fresh].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
    });
    setBusy(false);
    setStatus(`${accepted} new submission(s) imported.${errors.length ? ` ${errors.length} file(s) skipped: ${errors.slice(0, 3).join(" · ")}` : ""}`);
  }

  function exportSubmissions() {
    if (!assignment || !submissions.length) return;
    downloadJson(`courant-class-submissions-${assignment.id.slice(0, 8)}.json`, {
      format: "courant-offline-submission-bundle",
      version: 1,
      assignment,
      submissions: submissions.map(({ fileName: _fileName, ...item }) => item),
      exportedAt: new Date().toISOString(),
    });
    setStatus("Class submission bundle downloaded.");
  }

  return (
    <main className="min-h-screen bg-[var(--paper)] px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">← Courant home</Link>
        <header className="my-9 max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--accent)]">No accounts · No server · File-based classroom</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">A classroom that works without a backend.</h1>
          <p className="mt-4 leading-7 text-[var(--muted)]">Teachers create an assignment file. Learners open it, complete the work, and return a submission file. Teachers collect and review submissions on their own device.</p>
        </header>

        <section className="mb-7 grid gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:grid-cols-3 sm:p-6">
          {[
            ["01", "Create", "Teacher prepares one assignment and shares its file."],
            ["02", "Complete", "Learners import the file and write their response."],
            ["03", "Collect", "Teacher imports the returned files and reviews the work."],
          ].map(([number, heading, detail]) => <div key={number}><span className="text-xs font-bold tracking-widest text-[var(--accent)]">{number}</span><h2 className="mt-2 font-semibold">{heading}</h2><p className="mt-1 text-sm leading-6 text-[var(--muted)]">{detail}</p></div>)}
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">Teacher workspace</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Create an assignment</h2>
            <form onSubmit={createAssignment} className="mt-6 space-y-4">
              <div><label className={labelClass} htmlFor="class-name">Class or group label</label><input id="class-name" className={fieldClass} value={className} onChange={event => setClassName(event.target.value)} maxLength={80} placeholder="e.g. English · Group A" required /></div>
              <div><label className={labelClass} htmlFor="assignment-title">Assignment title</label><input id="assignment-title" className={fieldClass} value={title} onChange={event => setTitle(event.target.value)} maxLength={120} placeholder="e.g. A story worth sharing" required /></div>
              <div><label className={labelClass} htmlFor="assignment-instructions">Instructions and learning goals</label><textarea id="assignment-instructions" className={fieldClass} rows={6} value={instructions} onChange={event => setInstructions(event.target.value)} maxLength={5000} placeholder="Explain what learners should write, practise, or demonstrate…" required /></div>
              <div><label className={labelClass} htmlFor="due-date">Due date (optional)</label><input id="due-date" type="date" className={fieldClass} value={dueDate} onChange={event => setDueDate(event.target.value)} /></div>
              <button type="submit" className="w-full rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]">Create assignment file</button>
            </form>
            {assignment && <div className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Current assignment</p>
              <h3 className="mt-2 font-semibold">{assignment.title}</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">{assignment.className}{assignment.dueDate ? ` · Due ${assignment.dueDate}` : ""}</p>
              <button type="button" onClick={downloadAssignment} className="mt-4 rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold">Download assignment JSON</button>
            </div>}
            <div className="mt-6 border-t border-[var(--line)] pt-5">
              <label className={labelClass} htmlFor="import-submissions">Collect learner submissions</label>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Select multiple submission JSON files returned by learners. Only submissions for the current assignment are accepted.</p>
              <input id="import-submissions" type="file" accept="application/json,.json" multiple disabled={!assignment || busy} onChange={importSubmissions} className="mt-3 block w-full text-xs file:mr-3 file:rounded-full file:border-0 file:bg-[var(--accent-soft)] file:px-4 file:py-2 file:text-xs file:font-semibold" />
              {submissions.length > 0 && <div className="mt-4">
                <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold">{submissions.length} submission(s)</p><button type="button" onClick={exportSubmissions} className="text-xs font-semibold text-[var(--accent)] underline underline-offset-4">Export class bundle</button></div>
                <div className="mt-3 space-y-3">{submissions.map(item => <article key={item.id} className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">{item.learnerLabel}</h3><time className="text-[11px] text-[var(--muted)]">{new Date(item.submittedAt).toLocaleString()}</time></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{item.response}</p><p className="mt-2 text-[10px] text-[var(--muted)]">{item.fileName}</p></article>)}</div>
              </div>}
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">Learner workspace</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Complete an assignment</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Open the assignment file shared by your teacher. Your work stays in this page until you download a submission file.</p>
            <label className={labelClass} htmlFor="import-assignment">Assignment file</label>
            <input id="import-assignment" type="file" accept="application/json,.json" disabled={busy} onChange={importAssignment} className="mt-3 block w-full text-xs file:mr-3 file:rounded-full file:border-0 file:bg-[var(--accent-soft)] file:px-4 file:py-2 file:text-xs file:font-semibold" />
            {assignment ? <div className="mt-5 rounded-xl bg-[var(--paper)] p-4 sm:p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">{assignment.className}{assignment.dueDate ? ` · Due ${assignment.dueDate}` : ""}</p>
              <h3 className="mt-2 text-xl font-semibold">{assignment.title}</h3>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{assignment.instructions}</p>
              <div className="mt-5"><label className={labelClass} htmlFor="learner-label">Your name or class nickname</label><input id="learner-label" className={fieldClass} value={learnerLabel} onChange={event => setLearnerLabel(event.target.value)} maxLength={80} placeholder="Use a nickname if you prefer" /></div>
              <div className="mt-4"><label className={labelClass} htmlFor="learner-response">Your response</label><textarea id="learner-response" className={fieldClass} rows={9} value={response} onChange={event => setResponse(event.target.value)} maxLength={20000} placeholder="Take your time. Write naturally…" /></div>
              <div className="mt-2 text-right text-xs text-[var(--muted)]">{response.length.toLocaleString()} / 20,000 characters</div>
              <button type="button" onClick={downloadSubmission} disabled={!response.trim()} className="mt-4 w-full rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Download my submission</button>
            </div> : <div className="mt-5 rounded-xl border border-dashed border-[var(--line)] p-8 text-center text-sm text-[var(--muted)]">Your teacher's instructions will appear here after you import an assignment file.</div>}
          </section>
        </div>

        <p className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 text-xs leading-6 text-[var(--muted)]" role="status">{status || "Files are processed locally in your browser. Nothing is uploaded to Courant."}</p>
        <p className="mt-5 text-xs leading-6 text-[var(--muted)]">This is a manual file-exchange workflow, not a synced classroom platform. It has no sign-in, identity verification, live notifications, automatic grading, or server backups. Anyone holding an assignment or submission file can read or change it; do not put sensitive student information in these files. Use your school's approved channel to share files. Imported submissions are held in this page's memory and are cleared when you close or refresh it, so export a class bundle before leaving.</p>
        <div className="mt-6 flex flex-wrap gap-4 text-sm"><Link href="/offline-practice" className="font-semibold text-[var(--accent)] underline underline-offset-4">Individual practice</Link><Link href="/local-tutor" className="font-semibold text-[var(--accent)] underline underline-offset-4">On-device AI teacher</Link></div>
      </div>
    </main>
  );
}
