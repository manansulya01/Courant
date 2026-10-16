"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";

const scenarios: Record<string, { title: string; opening: string; prompt: string; level: string; minutes: string }> = {
  restaurant: { title: "At the restaurant", opening: "Hello! Welcome in. What would you like to order today?", prompt: "Order a meal, ask a question, and practise polite requests.", level: "Everyday English", minutes: "6 min" },
  "job-interview": { title: "The job interview", opening: "Thanks for joining me. Tell me a little about yourself.", prompt: "Share your experience and what interests you about the role.", level: "Professional", minutes: "8 min" },
  "school-presentation": { title: "Present an idea", opening: "Welcome. What is one idea you would like everyone to understand?", prompt: "Explain an idea clearly, as if speaking to a classroom.", level: "Speaking clearly", minutes: "7 min" },
  storytelling: { title: "Tell a better story", opening: "Tell me about a moment you still remember clearly.", prompt: "Bring a moment to life with a few vivid details.", level: "Creative expression", minutes: "8 min" },
  "host-event": { title: "Welcome the room", opening: "Welcome everyone. How would you open today's event?", prompt: "Welcome an audience and help them feel included.", level: "Presenting", minutes: "10 min" },
  "confident-introduction": { title: "A confident introduction", opening: "Hi there. What would you like to practise today?", prompt: "Introduce yourself in a way that feels natural to you.", level: "Everyday English", minutes: "5 min" },
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
  const [notice, setNotice] = useState("A quiet space to practise. Start whenever you feel ready.");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const imageInput = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const cancelledRecording = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [history, busy, image, error]);

  useEffect(() => () => {
    cancelledRecording.current = true;
    if (recorder.current?.state === "recording") recorder.current.stop();
    if (audioRef.current) audioRef.current.pause();
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  async function speak(text: string) {
    if (!voiceEnabled) return;
    try {
      const res = await fetch("/api/tutor/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("Voice service unavailable");
      const nextUrl = URL.createObjectURL(await res.blob());
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = nextUrl;
      if (audioRef.current) {
        audioRef.current.src = nextUrl;
        await audioRef.current.play();
      }
    } catch {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "en-US";
        utterance.rate = 0.94;
        window.speechSynthesis.speak(utterance);
      }
    }
  }

  async function send(text = draft.trim()) {
    if ((!text && !image) || busy) return;
    setBusy(true);
    setError("");
    setNotice("Your tutor is thinking…");
    const userTurn: ChatTurn = { role: "user", content: text || "Help me describe this picture." };
    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, scenario: scenario.title, history, image: image || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "The tutor could not reply. Please try again.");
      if (typeof data.reply !== "string" || !data.reply.trim()) throw new Error("Your tutor returned an empty reply. Please try again.");
      const assistantTurn: ChatTurn = { role: "assistant", content: data.reply };
      setHistory(old => [...old, userTurn, assistantTurn].slice(-20));
      setDraft("");
      setImage("");
      setImageName("");
      setNotice("A new thought to explore. Take your time.");
      void speak(data.reply);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach your tutor. Please try again.");
      setNotice("Your message is still here. Try again when you're ready.");
    } finally {
      setBusy(false);
    }
  }

  async function startRecording() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("Audio recording isn't supported in this browser. You can type your answer instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find(type => MediaRecorder.isTypeSupported(type));
      const media = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      cancelledRecording.current = false;
      chunks.current = [];
      media.ondataavailable = event => { if (event.data.size) chunks.current.push(event.data); };
      media.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        setRecording(false);
        if (cancelledRecording.current) return;
        const blob = new Blob(chunks.current, { type: media.mimeType || "audio/webm" });
        if (!blob.size) { setError("The recording was empty. Try again, or type your answer."); return; }
        setBusy(true);
        setNotice("Listening to your recording…");
        try {
          const form = new FormData();
          form.append("audio", blob, media.mimeType.includes("mp4") ? "answer.m4a" : "answer.webm");
          form.append("language", "en");
          const res = await fetch("/api/tutor/transcribe", { method: "POST", body: form });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || "Could not understand that recording.");
          if (typeof data.text !== "string" || !data.text.trim()) throw new Error("I couldn't hear any words clearly. Try again in a quieter place.");
          setDraft(data.text);
          setNotice("Your words are ready to review. Edit them if you like, then send.");
        } catch (e) {
          setError(e instanceof Error ? e.message : "Audio transcription failed.");
          setNotice("You can try again or type your answer.");
        } finally {
          setBusy(false);
        }
      };
      recorder.current = media;
      media.start();
      setRecording(true);
      setNotice("Recording… speak naturally, then stop when you're done.");
    } catch {
      setError("Microphone access is needed to record. Allow it in your browser settings, or type your answer instead.");
    }
  }

  function stopRecording() {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  async function pickImage(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Choose an image file."); return; }
    setError("");
    try {
      const compressed = await new Promise<string>((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const picture = new Image();
        picture.onload = () => {
          URL.revokeObjectURL(objectUrl);
          const maxDimension = 1440;
          const scale = Math.min(1, maxDimension / Math.max(picture.naturalWidth, picture.naturalHeight));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(picture.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(picture.naturalHeight * scale));
          const context = canvas.getContext("2d");
          if (!context) { reject(new Error("Picture processing is not available in this browser.")); return; }
          context.drawImage(picture, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.78);
          if (dataUrl.length > 2_500_000) { reject(new Error("That picture is still too large. Choose a smaller image.")); return; }
          resolve(dataUrl);
        };
        picture.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("That picture couldn't be opened. Try a JPEG, PNG, or WebP image.")); };
        picture.src = objectUrl;
      });
      setImage(compressed);
      setImageName(file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That picture couldn't be loaded. Try another image.");
    }
  }

  function begin() {
    setHistory([{ role: "assistant", content: scenario.opening }]);
    setNotice("Conversation started. Speak, type, or show Courant something.");
    void speak(scenario.opening);
  }

  function reset() {
    if (recording) {
      cancelledRecording.current = true;
      stopRecording();
    }
    setHistory([]);
    setDraft("");
    setImage("");
    setImageName("");
    setError("");
    setNotice("Your practice is reset. Start whenever you're ready.");
    if (audioRef.current) audioRef.current.pause();
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--paper)]/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[68px] max-w-[1440px] items-center justify-between px-4 sm:px-7 lg:px-10">
          <Link href="/labs" className="group inline-flex items-center gap-2 text-xs font-semibold text-[var(--muted)] transition hover:text-[var(--ink)]"><span className="transition-transform group-hover:-translate-x-1">←</span> Practice library</Link>
          <Link href="/" aria-label="Courant home" className="flex items-center gap-2 text-lg font-semibold tracking-[-.065em]"><span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--accent)] text-xs text-white">c</span>courant<span className="text-[var(--accent)]">.</span></Link>
          <span className="hidden items-center gap-2 text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--muted)] sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]"/> Private practice</span>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] gap-5 px-3 py-4 sm:px-6 sm:py-7 lg:grid-cols-[minmax(260px,.72fr)_minmax(0,1.28fr)] lg:gap-7 lg:px-10 lg:py-9">
        <aside className="relative flex flex-col overflow-hidden rounded-[26px] border border-[#dfe4d9] bg-[#e9eee6] p-6 sm:p-8 lg:min-h-[720px]">
          <div aria-hidden="true" className="absolute -right-20 -top-20 h-56 w-56 rounded-full border border-[#d3ddcf]"/>
          <div aria-hidden="true" className="absolute -right-12 -top-12 h-40 w-40 rounded-full border border-[#d3ddcf]"/>
          <div className="relative">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[#cbd6c7] bg-white/55 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[.14em] text-[var(--accent)]">{scenario.level}</span>
              <span className="text-[10px] text-[#697365]">{scenario.minutes}</span>
            </div>
            <p className="mt-8 text-[10px] font-bold uppercase tracking-[.19em] text-[var(--accent)]">A moment to rehearse</p>
            <h1 className="mt-4 max-w-sm text-4xl font-medium leading-[1.04] tracking-[-.065em] sm:text-5xl">{scenario.title}<span className="text-[var(--accent)]">.</span></h1>
            <p className="mt-5 max-w-sm text-sm leading-7 text-[#626b5f]">{scenario.prompt}</p>
          </div>

          <div className="relative mt-8 rounded-2xl border border-[#d4ddcf] bg-white/55 p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-[var(--accent)] text-sm font-medium text-white">c.</div>
              <div><p className="text-xs font-semibold">Your learning partner</p><p className="mt-1 text-[10px] text-[#6b7467]">Patient, curious, on your side</p></div>
            </div>
            <p className="mt-5 text-base leading-7 tracking-[-.02em]">You don&apos;t need the perfect words. You just need a place to try them.</p>
          </div>

          <div className="relative mt-7 space-y-4">
            {[
              ["01", "Speak or type", "Find your own way to say it."],
              ["02", "Listen and reflect", "Hear a natural response and keep going."],
              ["03", "Try another way", "Practise until it feels more like you."],
            ].map(([number, title, detail]) => <div key={number} className="flex gap-3"><span className="pt-0.5 font-mono text-[10px] text-[var(--accent)]">{number}</span><div><p className="text-xs font-semibold text-[#394538]">{title}</p><p className="mt-1 text-[11px] leading-5 text-[#6b7467]">{detail}</p></div></div>)}
          </div>
          <div className="relative mt-8 flex items-start gap-2 border-t border-[#d2dbcd] pt-4 text-[10px] leading-5 text-[#697365] lg:mt-auto lg:pt-6"><span className="mt-0.5">↗</span><p>Microphone and photo access are only used when you choose those tools. This prototype does not save your session.</p></div>
        </aside>

        <section aria-label="AI tutor conversation" className="flex min-h-[650px] min-w-0 flex-col overflow-hidden rounded-[26px] border border-[var(--line)] bg-[var(--surface)] shadow-[0_18px_55px_rgba(38,48,37,.045)] sm:min-h-[720px]">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4 sm:px-7 sm:py-5">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full border border-[var(--line)] bg-[var(--paper)] text-sm font-medium text-[var(--accent)]">c.</div>
              <div><p className="text-sm font-semibold tracking-[-.02em]">Courant tutor</p><p className="mt-1 text-[10px] text-[var(--muted)]">One conversation at a time</p></div>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setVoiceEnabled(value => !value)} aria-pressed={voiceEnabled} className="flex items-center gap-2 rounded-full border border-[var(--line)] px-3 py-2 text-[10px] font-semibold text-[var(--muted)] transition hover:bg-[var(--paper)]" title={voiceEnabled ? "Turn spoken replies off" : "Turn spoken replies on"}><span>{voiceEnabled ? "◖" : "◌"}</span><span className="hidden sm:inline">{voiceEnabled ? "Voice on" : "Voice off"}</span></button>
              <span className="hidden items-center gap-2 text-[10px] text-[var(--muted)] sm:flex"><span className={`h-1.5 w-1.5 rounded-full ${busy || recording ? "animate-pulse bg-amber-500" : "bg-[var(--accent)]"}`}/>{recording ? "Recording" : busy ? "Thinking" : "Ready"}</span>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-7 sm:py-7" aria-live="polite" aria-relevant="additions text">
            {!history.length ? (
              <div className="grid min-h-[350px] place-items-center py-8 text-center sm:min-h-[410px]">
                <div className="max-w-sm">
                  <div className="relative mx-auto grid h-20 w-20 place-items-center rounded-full border border-[#dce3d7] bg-[#f0f3ed]"><span className="text-xl font-medium text-[var(--accent)]">c.</span><span className="absolute bottom-1 right-1 h-3 w-3 rounded-full border-2 border-white bg-[var(--accent)]"/></div>
                  <p className="mt-7 text-[10px] font-bold uppercase tracking-[.17em] text-[var(--accent)]">Your practice, your pace</p>
                  <h2 className="mt-3 text-2xl font-medium tracking-[-.045em] sm:text-3xl">Let&apos;s find your words.</h2>
                  <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-[var(--muted)]">Start with a gentle opening, or jump straight into a thought of your own.</p>
                  <button type="button" onClick={begin} className="mt-6 rounded-full bg-[var(--accent)] px-6 py-3.5 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-[var(--accent-hover)]">Begin the conversation <span className="ml-2">↗</span></button>
                </div>
              </div>
            ) : history.map((turn, index) => (
              <div key={index} className={`flex ${turn.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[92%] rounded-[20px] px-4 py-3.5 sm:max-w-[84%] sm:px-5 ${turn.role === "user" ? "rounded-br-md bg-[var(--accent-soft)] text-[var(--ink)]" : "rounded-bl-md border border-[var(--line)] bg-white text-[var(--ink)]"}`}>
                  <p className="mb-2 text-[9px] font-bold uppercase tracking-[.14em] text-[var(--muted)]">{turn.role === "user" ? "You" : "Courant"}</p>
                  <p className="whitespace-pre-wrap text-sm leading-7">{turn.content}</p>
                  {turn.role === "assistant" && <button type="button" onClick={() => void speak(turn.content)} className="mt-3 inline-flex items-center gap-2 text-[10px] font-semibold text-[var(--accent)] transition hover:opacity-70" aria-label="Listen to this reply">◖ Listen to reply</button>}
                </div>
              </div>
            ))}
            {busy && <div className="flex justify-start"><div className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-xs text-[var(--muted)]"><span className="flex gap-1"><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]"/><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)] [animation-delay:150ms]"/><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)] [animation-delay:300ms]"/></span>Finding the right words…</div></div>}
            {image && <div className="ml-auto max-w-[85%] rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-3"><div className="flex items-center justify-between gap-3 text-xs"><span className="truncate font-medium">{imageName || "Picture selected"}</span><button type="button" onClick={() => { setImage(""); setImageName(""); }} className="shrink-0 text-[var(--muted)] underline underline-offset-2">Remove</button></div><Image src={image} alt="Preview of the picture selected for your tutor" width={640} height={360} unoptimized className="mt-3 max-h-48 rounded-xl object-contain"/></div>}
            <div ref={bottomRef}/>
          </div>

          <div className="border-t border-[var(--line)] bg-[#fffefa] p-4 sm:p-6">
            <p aria-live="polite" className="mb-3 text-[11px] leading-5 text-[var(--muted)]">{notice}</p>
            {error && <p role="alert" className="mb-3 rounded-xl border border-[#f0d8ce] bg-[#fbefea] px-4 py-3 text-xs leading-5 text-[#8d3f2d]">{error}</p>}
            <form onSubmit={event => { event.preventDefault(); void send(); }}>
              <label htmlFor="courant-message" className="mb-2 block text-xs font-semibold">Your next thought</label>
              <textarea id="courant-message" value={draft} onChange={event => setDraft(event.target.value.slice(0, 1800))} onKeyDown={event => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); void send(); } }} rows={3} maxLength={1800} placeholder="Write it as you would say it. There is no perfect answer…" className="w-full resize-y rounded-2xl border border-[var(--line)] bg-[var(--paper)] px-4 py-3.5 text-sm leading-6 outline-none transition placeholder:text-[#9a9d95] focus:border-[var(--accent)] focus:bg-white" disabled={busy}/>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" disabled={busy} onClick={() => recording ? stopRecording() : void startRecording()} className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${recording ? "bg-[#f8e9e4] text-[#8d3f2d]" : "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"}`}><span>{recording ? "■" : "◉"}</span>{recording ? "Stop recording" : "Speak"}</button>
                <button type="button" disabled={busy || recording} onClick={() => imageInput.current?.click()} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--line)] px-4 py-2.5 text-xs font-semibold transition hover:bg-[var(--paper)] disabled:cursor-not-allowed disabled:opacity-40">＋ Picture</button>
                <input ref={imageInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={event => { void pickImage(event.target.files?.[0]); event.currentTarget.value = ""; }} aria-label="Choose or take a picture"/>
                <button type="submit" disabled={busy || recording || (!draft.trim() && !image)} className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--line)] bg-white px-5 py-2.5 text-xs font-semibold transition hover:border-[#cbd4c7] hover:bg-[var(--paper)] disabled:cursor-not-allowed disabled:opacity-40">Send <span>↗</span></button>
                <button type="button" disabled={busy || recording || (!history.length && !draft && !image)} onClick={reset} className="min-h-11 rounded-full px-3 py-2 text-xs text-[var(--muted)] transition hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40">Reset</button>
              </div>
            </form>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-3 text-[10px] leading-5 text-[var(--muted)]"><span>Enter a thought · use Ctrl/⌘ + Enter to send</span><span>Sessions are not saved in this prototype</span></div>
            <audio ref={audioRef} className="sr-only" aria-label="Spoken tutor response" />
          </div>
        </section>
      </div>
    </main>
  );
}
