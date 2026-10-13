"use client";
import { use, useRef, useState } from "react";
import Link from "next/link";

const scenarios: Record<string, { title: string; opening: string; prompt: string }> = {
  restaurant: { title: "At the restaurant", opening: "Hello! Welcome in. What would you like to order today?", prompt: "Order a meal, ask a question, and practise polite requests." },
  "job-interview": { title: "The job interview", opening: "Thanks for joining me. Tell me a little about yourself.", prompt: "Share your experience and what interests you about the role." },
  "school-presentation": { title: "Present an idea", opening: "Welcome. What is one idea you would like everyone to understand?", prompt: "Explain an idea clearly, as if speaking to a classroom." },
  storytelling: { title: "Tell a better story", opening: "Tell me about a moment you still remember clearly.", prompt: "Bring a moment to life with a few vivid details." },
  "host-event": { title: "Welcome the room", opening: "Welcome everyone. How would you open today's event?", prompt: "Welcome an audience and help them feel included." },
  "confident-introduction": { title: "A confident introduction", opening: "Hi there. What would you like to practise today?", prompt: "Introduce yourself in a way that feels natural to you." }
};
type ChatTurn = { role: "user" | "assistant"; content: string };
export default function Lab({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const scenario = scenarios[slug] || scenarios["confident-introduction"];
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [image, setImage] = useState("");
  const [imageName, setImageName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("Your coach is ready. Choose a way to practise.");
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const imageInput = useRef<HTMLInputElement | null>(null);

  async function speak(text: string) {
    try {
      const res = await fetch("/api/tutor/speech", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      if (!res.ok) throw new Error("Voice service unavailable");
      const url = URL.createObjectURL(await res.blob());
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = url; await audioRef.current.play(); }
    } catch {
      if ("speechSynthesis" in window) { window.speechSynthesis.cancel(); window.speechSynthesis.speak(new SpeechSynthesisUtterance(text)); }
    }
  }
  async function send(text = draft.trim()) {
    if ((!text && !image) || busy) return;
    setBusy(true); setError(""); setNotice("Thinking about your answer…");
    const userTurn: ChatTurn = { role: "user", content: text || "Help me describe this picture." };
    try {
      const res = await fetch("/api/tutor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, scenario: scenario.title, history, image: image || undefined }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "The tutor could not reply.");
      setHistory(old => [...old, userTurn, { role: "assistant", content: data.reply }].slice(-24));
      setDraft(""); setImage(""); setImageName(""); setNotice("Courant replied. Listen, then keep the conversation going.");
      await speak(data.reply);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not reach your tutor."); setNotice("Ready when you are."); }
    finally { setBusy(false); }
  }
  async function startRecording() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { setError("Audio recording isn't supported in this browser. Type your answer instead."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find(t => MediaRecorder.isTypeSupported(t));
      const media = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      media.ondataavailable = e => { if (e.data.size) chunks.current.push(e.data); };
      media.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        setRecording(false); setBusy(true); setNotice("Listening to your recording…");
        try {
          const blob = new Blob(chunks.current, { type: media.mimeType || "audio/webm" });
          const form = new FormData(); form.append("audio", blob, media.mimeType.includes("mp4") ? "answer.m4a" : "answer.webm"); form.append("language", "en");
          const res = await fetch("/api/tutor/transcribe", { method: "POST", body: form });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Could not understand that recording.");
          if (!data.text?.trim()) throw new Error("I couldn't hear any words clearly. Try again in a quieter place.");
          setDraft(data.text); setNotice("Your speech has been transcribed. Review it, then send it to your coach.");
        } catch (e) { setError(e instanceof Error ? e.message : "Audio transcription failed."); setNotice("Ready when you are."); }
        finally { setBusy(false); }
      };
      recorder.current = media; media.start(); setRecording(true); setNotice("Recording… speak naturally, then stop when you're done.");
    } catch { setError("Microphone access is needed to record. Allow it in your iPad or browser settings, or type your answer."); }
  }
  function stopRecording() { if (recorder.current?.state === "recording") recorder.current.stop(); }
  async function pickImage(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Choose an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Please choose an image under 5 MB."); return; }
    try {
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(); reader.onerror = reject; reader.readAsDataURL(file); });
      setImage(data); setImageName(file.name); setError("");
    } catch { setError("That picture couldn't be loaded. Try another image."); }
  }
  function begin() { setHistory([{ role: "assistant", content: scenario.opening }]); void speak(scenario.opening); setNotice("Conversation started. Speak, type, or show Courant something."); }
  function reset() { if (recording) stopRecording(); setHistory([]); setDraft(""); setImage(""); setImageName(""); setError(""); setNotice("Your practice is reset. Start whenever you're ready."); if (audioRef.current) audioRef.current.pause(); }

  return <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
    <header className="flex min-h-[72px] items-center justify-between border-b border-[var(--line)] px-4 sm:px-8">
      <Link href="/labs" className="text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)]">← Practice library</Link>
      <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-[-.06em]"><span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--accent)] text-xs text-white">c</span>courant<span className="text-[var(--accent)]">.</span></Link>
      <span className="hidden text-[10px] uppercase tracking-[.15em] text-[var(--muted)] sm:block">AI practice room</span>
    </header>
    <div className="mx-auto grid max-w-[1160px] gap-6 px-4 py-7 sm:px-7 sm:py-10 lg:grid-cols-[.8fr_1.2fr]">
      <aside className="flex flex-col rounded-[22px] bg-[#e9ede4] p-6 sm:p-8">
        <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">A moment to rehearse</p>
        <h1 className="mt-5 text-3xl font-medium leading-tight tracking-[-.05em] sm:text-4xl">{scenario.title}</h1>
        <p className="mt-4 text-sm leading-6 text-[#626b5f]">{scenario.prompt}</p>
        <div className="my-8 border-t border-[#cbd5c6] pt-6"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#626b5f]">Your AI learning partner</p><p className="mt-3 text-lg leading-7 tracking-[-.02em]">Listen, respond, look around, and learn at your own pace.</p></div>
        <div className="space-y-4 border-t border-[#cbd5c6] pt-5">{["Practise real conversations by voice or text", "Hear natural spoken responses", "Use a picture to explore words and ideas"].map((x, i) => <div key={x} className="flex items-center gap-3 text-xs text-[#626b5f]"><span className="font-mono text-[var(--accent)]">0{i + 1}</span>{x}</div>)}</div>
        <p className="mt-7 text-[10px] leading-5 text-[#626b5f]">Designed for touch screens and iPad-sized layouts. Microphone and camera permissions are only requested when you choose those features.</p>
      </aside>
      <section className="flex min-h-[620px] flex-col rounded-[22px] border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7">
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-5"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--muted)]">Conversation</p><p className="mt-1 text-sm font-semibold">Your Courant tutor</p></div><span className="flex items-center gap-2 text-[10px] text-[var(--muted)]"><span className={`h-2 w-2 rounded-full ${busy ? "animate-pulse bg-amber-500" : "bg-[var(--accent)]"}`}/>{busy ? "Working…" : "Ready when you are"}</span></div>
        <div className="flex-1 space-y-3 py-6">
          {!history.length ? <div className="grid min-h-[280px] place-items-center text-center"><div className="max-w-sm"><div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-[var(--line)] text-xl text-[var(--accent)]">c.</div><h2 className="mt-5 text-xl font-medium tracking-[-.03em]">Let's learn by talking.</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Start a real conversation with your AI tutor, or ask about a picture.</p><button type="button" onClick={begin} className="mt-5 rounded-full bg-[var(--accent)] px-5 py-3 text-xs font-semibold text-white hover:opacity-90">Start this lesson →</button></div></div> : history.map((m, i) => <div key={i} className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-6 ${m.role === "user" ? "ml-auto bg-[var(--accent-soft)]" : "border border-[var(--line)] bg-white"}`}><p className="mb-1 text-[9px] font-bold uppercase tracking-[.14em] text-[var(--muted)]">{m.role === "user" ? "You" : "Courant"}</p>{m.content}</div>)}
          {image && <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-3 text-xs">Picture ready: {imageName}<button type="button" onClick={() => { setImage(""); setImageName(""); }} className="ml-3 underline">Remove</button><img src={image} alt="Image selected for the tutor to describe" className="mt-3 max-h-44 rounded-lg object-contain" /></div>}
        </div>
        <p aria-live="polite" className="mb-3 text-[11px] text-[var(--muted)]">{notice}</p>
        {error && <p role="alert" className="mb-3 rounded-xl bg-[#f8e9e4] p-3 text-xs leading-5 text-[#8d3f2d]">{error}</p>}
        <label className="text-xs font-semibold">Your message<textarea value={draft} onChange={e => setDraft(e.target.value)} rows={3} placeholder="Write a response, ask a question, or describe what you'd like to learn…" className="mt-2 w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4 text-sm leading-6 outline-none focus:border-[var(--accent)]" /></label>
        <div className="mt-3 flex flex-wrap gap-2 sm:gap-3">
          <button type="button" disabled={busy} onClick={() => recording ? stopRecording() : void startRecording()} className={`rounded-full px-4 py-3 text-xs font-semibold transition disabled:opacity-40 ${recording ? "bg-[#f8e9e4] text-[#8d3f2d]" : "bg-[var(--accent)] text-white hover:opacity-90"}`}>{recording ? "Stop recording ■" : "Speak ◉"}</button>
          <button type="button" disabled={busy} onClick={() => imageInput.current?.click()} className="rounded-full border border-[var(--line)] px-4 py-3 text-xs font-semibold hover:bg-[#f1f0e9] disabled:opacity-40">Show a picture +</button>
          <input ref={imageInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { void pickImage(e.target.files?.[0]); e.currentTarget.value = ""; }} aria-label="Choose or take a picture" />
          <button type="button" disabled={busy || (!draft.trim() && !image)} onClick={() => void send()} className="rounded-full border border-[var(--line)] px-4 py-3 text-xs font-semibold hover:bg-[#f1f0e9] disabled:cursor-not-allowed disabled:opacity-40">Send →</button>
          <button type="button" disabled={busy} onClick={reset} className="ml-auto px-2 py-3 text-xs text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-40">Reset</button>
        </div>
        <audio ref={audioRef} className="mt-3 hidden" controls />
        <p className="mt-4 text-[10px] leading-5 text-[var(--muted)]">AI voice, audio transcription, and image understanding require an OpenAI API key configured on the server. Your API key is never sent to this page. This prototype does not save your session.</p>
      </section>
    </div>
  </main>;
}
