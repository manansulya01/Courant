"use client";

import AppShell from "@/components/AppShell";
import { useEffect, useRef, useState } from "react";

type Turn = { role: "user" | "assistant"; content: string };

export default function TalkPage() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Your English conversation partner is ready.");
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const audio = useRef<HTMLAudioElement | null>(null);
  const bottom = useRef<HTMLDivElement | null>(null);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [turns, busy]);

  async function speak(text: string) {
    try {
      const response = await fetch("/api/tutor/speech", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) throw new Error("Voice service unavailable");
      const url = URL.createObjectURL(await response.blob());
      if (audio.current) {
        const oldUrl = audio.current.dataset.objectUrl;
        if (oldUrl) URL.revokeObjectURL(oldUrl);
        audio.current.dataset.objectUrl = url;
        audio.current.src = url;
        await audio.current.play();
      }
    } catch {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "en-US";
        utterance.rate = 0.96;
        window.speechSynthesis.speak(utterance);
      }
    }
  }

  async function send(message = draft.trim()) {
    if (!message || busy) return;
    setBusy(true); setError(""); setStatus("Thinking about what you said…");
    const previous = turns.slice(-12);
    setTurns(current => [...current, { role: "user", content: message }]);
    setDraft("");
    try {
      const response = await fetch("/api/tutor", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, scenario: "Open English conversation", history: previous }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The tutor could not respond.");
      const reply = String(data.reply || "").trim();
      if (!reply) throw new Error("I didn't get a reply. Please try again.");
      setTurns(current => [...current, { role: "assistant", content: reply }]);
      setStatus("Courant replied. You can answer out loud or type.");
      await speak(reply);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't reach your conversation partner.");
      setStatus("Ready when you are.");
    } finally { setBusy(false); }
  }

  async function startRecording() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("Voice recording is not supported here. Please type your answer instead."); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find(type => MediaRecorder.isTypeSupported(type));
      const media = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      media.ondataavailable = event => { if (event.data.size) chunks.current.push(event.data); };
      media.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        setRecording(false); setBusy(true); setStatus("Understanding your recording…");
        try {
          const blob = new Blob(chunks.current, { type: media.mimeType || "audio/webm" });
          const form = new FormData();
          form.append("audio", blob, media.mimeType.includes("mp4") ? "speech.m4a" : "speech.webm");
          form.append("language", "en");
          const response = await fetch("/api/tutor/transcribe", { method: "POST", body: form });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "I couldn't transcribe that recording.");
          if (!String(data.text || "").trim()) throw new Error("I couldn't hear that clearly. Try again or type your answer.");
          setStatus("I heard: " + data.text);
          setBusy(false);
          await send(String(data.text).trim());
        } catch (e) {
          setError(e instanceof Error ? e.message : "Audio transcription failed.");
          setStatus("Ready when you are."); setBusy(false);
        }
      };
      recorder.current = media; media.start(); setRecording(true);
      setStatus("Listening… speak naturally, then tap Stop speaking.");
    } catch {
      setError("Allow microphone access in your browser settings, then try again.");
    }
  }

  function stopRecording() { if (recorder.current?.state === "recording") recorder.current.stop(); }

  function reset() {
    if (recording) stopRecording();
    window.speechSynthesis?.cancel();
    if (audio.current) audio.current.pause();
    setTurns([]); setDraft(""); setError(""); setStatus("Fresh start. Say hello whenever you're ready.");
  }

  return <AppShell>
    <div className="mx-auto max-w-[900px]">
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--line)] pb-6 sm:flex-row sm:items-end">
        <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">English, out loud</p>
          <h1 className="mt-3 text-4xl font-medium tracking-[-.055em] sm:text-5xl">Just talk.</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted)]">Have a natural English conversation. Speak, listen to a warm spoken reply, and keep going. Mistakes are welcome here.</p>
        </div>
        <button onClick={reset} className="w-fit rounded-full border border-[var(--line)] px-4 py-2.5 text-xs font-semibold">New conversation ↻</button>
      </div>
      <section aria-label="Conversation" aria-live="polite" className="mt-6 flex min-h-[360px] flex-col rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-7">
        {!turns.length && <div className="m-auto max-w-md py-10 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[var(--accent-soft)] text-2xl text-[var(--accent)]" aria-hidden="true">✳</div>
          <h2 className="mt-5 text-xl font-medium">Hi, I’m Courant.</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">We can talk about your day, hobbies, school, travel, or anything you’re curious about. I’ll keep it friendly and help you express yourself naturally.</p>
          <button onClick={() => void send("Hi! Can we have a friendly conversation in English?")} disabled={busy} className="mt-5 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Start talking ↗</button>
        </div>}
        {turns.map((turn, index) => <div key={index} className={`mb-4 flex ${turn.role === "user" ? "justify-end" : "justify-start"}`}>
          <div className={`max-w-[88%] rounded-2xl px-4 py-3 sm:max-w-[78%] ${turn.role === "user" ? "bg-[var(--accent)] text-white" : "bg-[#f0efe9] text-[var(--ink)]"}`}>
            <p className="mb-1 text-[9px] font-bold uppercase tracking-[.14em] opacity-70">{turn.role === "user" ? "You" : "Courant"}</p>
            <p className="whitespace-pre-wrap text-sm leading-6">{turn.content}</p>
            {turn.role === "assistant" && <button onClick={() => void speak(turn.content)} className="mt-2 text-xs font-semibold underline underline-offset-4" aria-label="Play Courant's reply aloud">▶ Listen again</button>}
          </div>
        </div>)}
        {busy && <p className="text-sm text-[var(--muted)]" role="status">Courant is listening and thinking…</p>}
        <div ref={bottom}/>
      </section>
      <div className="mt-4 rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-3 sm:p-4">
        <label htmlFor="english-reply" className="sr-only">Your reply in English</label>
        <textarea id="english-reply" value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="Write what you’d say… (Enter to send)" rows={2} className="w-full resize-y bg-transparent px-2 py-2 text-sm outline-none placeholder:text-[var(--muted)]" disabled={busy || recording}/>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
          <p className="text-xs text-[var(--muted)]">{status}</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={recording ? stopRecording : () => void startRecording()} disabled={busy} className={`rounded-full border px-4 py-2.5 text-xs font-semibold disabled:opacity-50 ${recording ? "border-red-300 text-red-700" : "border-[var(--line)]"}`}>{recording ? "■ Stop speaking" : "🎙 Speak in English"}</button>
            <button onClick={() => void send()} disabled={busy || !draft.trim()} className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-40">Send ↗</button>
          </div>
        </div>
      </div>
      {error && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <p className="mt-4 text-xs leading-5 text-[var(--muted)]">Voice mode uses microphone permission and sends your recording to Courant’s configured transcription service. AI replies can make mistakes. You can type instead, and you control when recording starts and stops.</p>
      <audio ref={audio} className="hidden" />
    </div>
  </AppShell>;
}
