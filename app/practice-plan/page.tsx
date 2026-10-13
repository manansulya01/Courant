"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Goal = "conversation" | "pronunciation" | "listening" | "confidence";
type Level = "beginner" | "intermediate" | "advanced";

const goals: { id: Goal; title: string; detail: string }[] = [
  { id: "conversation", title: "Speak naturally", detail: "Everyday conversations and real-life situations" },
  { id: "pronunciation", title: "Pronunciation", detail: "Clearer sounds, stress, and rhythm" },
  { id: "listening", title: "Understand more", detail: "Follow speech at natural speed" },
  { id: "confidence", title: "Build confidence", detail: "Presentations, storytelling, and speaking up" },
];

const drills: Record<Goal, { title: string; minutes: number; detail: string }[]> = {
  conversation: [
    { title: "Warm-up conversation", minutes: 3, detail: "Answer three easy questions aloud without stopping to edit yourself." },
    { title: "Real-world role-play", minutes: 7, detail: "Practise a situation such as ordering food, meeting someone, or asking for help." },
    { title: "Say it a better way", minutes: 3, detail: "Choose one useful correction and repeat the improved sentence in your own words." },
  ],
  pronunciation: [
    { title: "Listen closely", minutes: 3, detail: "Listen to a short phrase twice and notice its stressed words." },
    { title: "Shadow the speaker", minutes: 7, detail: "Repeat the phrase with the same rhythm, pausing between attempts." },
    { title: "Record and reflect", minutes: 3, detail: "Record one attempt and choose one sound or word to practise again." },
  ],
  listening: [
    { title: "Focused listening", minutes: 3, detail: "Listen once for the main idea, without reading a transcript." },
    { title: "Listen for details", minutes: 7, detail: "Listen again and identify key facts, intent, and unfamiliar phrases." },
    { title: "Retell the message", minutes: 3, detail: "Summarise what you heard aloud in two or three sentences." },
  ],
  confidence: [
    { title: "Find your opening", minutes: 3, detail: "Say your first sentence aloud three times until it feels comfortable." },
    { title: "Speak with structure", minutes: 7, detail: "Give a short talk with a clear beginning, two ideas, and a conclusion." },
    { title: "One kind review", minutes: 3, detail: "Name one strength and one small thing to try in your next attempt." },
  ],
};

export default function PracticePlanPage() {
  const [goal, setGoal] = useState<Goal>("conversation");
  const [level, setLevel] = useState<Level>("beginner");
  const [minutes, setMinutes] = useState(15);
  const [started, setStarted] = useState(false);

  const plan = useMemo(() => {
    const multiplier = minutes / 13;
    return drills[goal].map((drill) => ({
      ...drill,
      minutes: Math.max(1, Math.round(drill.minutes * multiplier)),
    }));
  }, [goal, minutes]);

  const levelNote: Record<Level, string> = {
    beginner: "Use short sentences. You can pause, think, and try again.",
    intermediate: "Add details, connect your ideas, and try a second way to express them.",
    advanced: "Aim for nuance, natural phrasing, and more precise vocabulary.",
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
      <nav className="mb-10 flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold tracking-tight">courant<span className="text-stone-400">.</span></Link>
        <Link href="/labs" className="text-sm text-stone-600 transition hover:text-stone-950">Explore learning labs ↗</Link>
      </nav>

      <div className="max-w-2xl">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Your next step</p>
        <h1 className="text-4xl font-medium leading-tight tracking-tight text-stone-950 sm:text-5xl">A practice plan that fits you.</h1>
        <p className="mt-4 text-base leading-7 text-stone-600">Small, focused sessions build real communication skills. Choose what matters to you today; Courant will shape a simple session around it.</p>
      </div>

      <section className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-8 rounded-3xl border border-stone-200 bg-white p-5 sm:p-8">
          <fieldset>
            <legend className="mb-3 text-sm font-semibold text-stone-900">What would you like to work on?</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {goals.map((item) => (
                <button key={item.id} type="button" onClick={() => { setGoal(item.id); setStarted(false); }} aria-pressed={goal === item.id}
                  className={`rounded-2xl border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-700 ${goal === item.id ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 bg-stone-50 text-stone-900 hover:border-stone-400"}`}>
                  <span className="block text-sm font-semibold">{item.title}</span>
                  <span className={`mt-1 block text-xs leading-5 ${goal === item.id ? "text-stone-300" : "text-stone-500"}`}>{item.detail}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-sm font-semibold text-stone-900">Where are you starting from?</legend>
            <div className="flex flex-wrap gap-2">
              {(["beginner", "intermediate", "advanced"] as Level[]).map((item) => (
                <button key={item} type="button" onClick={() => setLevel(item)} aria-pressed={level === item}
                  className={`rounded-full border px-4 py-2 text-sm capitalize transition ${level === item ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 text-stone-600 hover:border-stone-400"}`}>{item}</button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-sm font-semibold text-stone-900">How much time do you have?</legend>
            <div className="flex gap-2">
              {[5, 10, 15, 20].map((value) => (
                <button key={value} type="button" onClick={() => { setMinutes(value); setStarted(false); }} aria-pressed={minutes === value}
                  className={`flex-1 rounded-xl border px-3 py-3 text-sm font-medium transition ${minutes === value ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 text-stone-600 hover:border-stone-400"}`}>{value} min</button>
              ))}
            </div>
          </fieldset>
          <button type="button" onClick={() => setStarted(true)} className="w-full rounded-full bg-stone-900 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-stone-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-700">Build my session</button>
        </div>

        <aside className="h-fit rounded-3xl bg-[#f3f0e9] p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Your session</p>
            <span className="rounded-full bg-white/80 px-3 py-1 text-xs text-stone-600">{minutes} minutes</span>
          </div>
          <h2 className="mt-4 text-2xl font-medium tracking-tight text-stone-950">{goals.find((item) => item.id === goal)?.title}</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">{levelNote[level]}</p>
          <div className="my-6 h-px bg-stone-300" />
          <ol className="space-y-5">
            {plan.map((drill, index) => (
              <li key={drill.title} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-stone-300 bg-white text-xs font-semibold text-stone-700">{String(index + 1).padStart(2, "0")}</span>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold text-stone-900">{drill.title}</h3>
                    <span className="shrink-0 text-xs text-stone-500">{drill.minutes} min</span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-stone-600">{drill.detail}</p>
                </div>
              </li>
            ))}
          </ol>
          {started && <p role="status" className="mt-6 rounded-xl border border-stone-300 bg-white/70 p-3 text-sm leading-6 text-stone-700">Your plan is ready. Open a learning lab to practise with the current tutor prototype. Session progress is not saved to an account yet.</p>}
          <Link href="/labs" className="mt-7 flex w-full items-center justify-center rounded-full border border-stone-400 px-5 py-3 text-sm font-semibold text-stone-900 transition hover:bg-white">Go to learning labs ↗</Link>
          <p className="mt-4 text-xs leading-5 text-stone-500">This is a local plan generator, not yet connected to a saved learner profile or live adaptive AI engine.</p>
        </aside>
      </section>
    </main>
  );
}
