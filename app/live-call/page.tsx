"use client";

import AppShell from "@/components/AppShell";
import { useCallback, useEffect, useRef, useState } from "react";

type CallMode = "voice" | "video";
type EnglishLevel = "beginner" | "intermediate" | "advanced";
type CallStatus = "idle" | "connecting" | "connected" | "ending";
type Line = { id: string; role: "you" | "courant" | "note"; text: string };

const starters = [
  { label: "Everyday conversation", value: "a friendly everyday English conversation" },
  { label: "Job interview", value: "a realistic job interview in English" },
  { label: "School & presentations", value: "school, presentations, and speaking confidently in class" },
  { label: "Travel", value: "travelling, hotels, restaurants, and asking for directions" },
];

export default function LiveCallPage() {
  const [mode, setMode] = useState<CallMode>("voice");
  const [status, setStatus] = useState<CallStatus>("idle");
  const [statusText, setStatusText] = useState("Your private practice room is ready.");
  const [error, setError] = useState("");
  const [scenario, setScenario] = useState(starters[0].value);
  const [lines, setLines] = useState<Line[]>([]);
  const [muted, setMuted] = useState(false);
  const [strictCorrections, setStrictCorrections] = useState(false);
  const [level, setLevel] = useState<EnglishLevel>("intermediate");
  const [recap, setRecap] = useState("");
  const [recapBusy, setRecapBusy] = useState(false);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const idRef = useRef(0);
  const statusRef = useRef<CallStatus>("idle");

  const addLine = useCallback((role: Line["role"], text: string) => {
    const cleaned = text.trim();
    if (!cleaned) return;
    setLines(current => [...current.slice(-79), { id: String(++idRef.current), role, text: cleaned }]);
  }, []);

  useEffect(() => { transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" }); }, [lines]);

  const endCall = useCallback(() => {
    statusRef.current = "ending";
    setStatus("ending");
    if (peerRef.current) {
      peerRef.current.ontrack = null;
      peerRef.current.onconnectionstatechange = null;
      peerRef.current.close();
      peerRef.current = null;
    }
    if (channelRef.current) {
      channelRef.current.onmessage = null;
      channelRef.current.close();
      channelRef.current = null;
    }
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    setMuted(false);
    setStatus("idle");
    statusRef.current = "idle";
    setStatusText("Call ended. Your conversation stays on this screen until you leave or start a new call.");
  }, []);

  useEffect(() => () => {
    peerRef.current?.close();
    streamRef.current?.getTracks().forEach(track => track.stop());
    channelRef.current?.close();
  }, []);

  useEffect(() => {
    if (status !== "connected" || mode !== "video") return;
    const interval = window.setInterval(() => {
      const channel = channelRef.current;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!channel || channel.readyState !== "open" || !video || !canvas || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || channel.bufferedAmount > 900_000) return;
      const ratio = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9;
      canvas.width = 640;
      canvas.height = Math.round(640 / ratio);
      const context = canvas.getContext("2d");
      if (!context) return;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageUrl = canvas.toDataURL("image/jpeg", 0.55);
      channel.send(JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            { type: "input_text", text: "A recent camera frame from this live English practice call. Use only relevant visible context, and do not interrupt the conversation just to describe the image." },
            { type: "input_image", image_url: imageUrl, detail: "low" },
          ],
        },
      }));
    }, 6000);
    return () => window.clearInterval(interval);
  }, [mode, status]);

  function sendEvent(event: Record<string, unknown>) {
    const channel = channelRef.current;
    if (channel?.readyState === "open") channel.send(JSON.stringify(event));
  }

  async function startCall() {
    if (statusRef.current !== "idle") return;
    setError("");
    setLines([]);
    setRecap("");
    setStatus("connecting");
    statusRef.current = "connecting";
    setStatusText("Requesting microphone permission…");

    let stream: MediaStream | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
        throw new Error("Live calls need a modern browser with microphone access. On iPad, use Safari over HTTPS.");
      }
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: mode === "video" ? { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } : false,
      });
      streamRef.current = stream;
      if (videoRef.current && mode === "video") {
        videoRef.current.srcObject = stream;
        void videoRef.current.play().catch(() => undefined);
      }

      setStatusText("Opening your encrypted live audio connection…");
      const sessionResponse = await fetch("/api/tutor/realtime-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, level, scenario: strictCorrections ? `${scenario}. The learner wants strict English correction: point out each meaningful grammar, word choice, and phrasing issue, while staying encouraging.` : scenario }),
      });
      const sessionData = await sessionResponse.json();
      if (!sessionResponse.ok) throw new Error(sessionData.error || "The live tutor could not start.");
      if (typeof sessionData.clientSecret !== "string") throw new Error("The live session was not configured correctly.");

      const peer = new RTCPeerConnection();
      peerRef.current = peer;
      stream.getAudioTracks().forEach(track => peer.addTrack(track, stream!));
      peer.ontrack = event => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
          void remoteAudioRef.current.play().catch(() => undefined);
        }
      };
      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "connected" && statusRef.current === "connecting") {
          statusRef.current = "connected";
          setStatus("connected");
          setStatusText(mode === "video" ? "Live video practice is on. Courant receives a small camera snapshot every few seconds." : "Live voice practice is on. Speak naturally; Courant will respond and coach you.");
        } else if ((peer.connectionState === "failed" || peer.connectionState === "disconnected") && statusRef.current === "connected") {
          setStatusText("The connection was interrupted. End the call and reconnect if needed.");
        }
      };

      const channel = peer.createDataChannel("oai-events");
      channelRef.current = channel;
      channel.onopen = () => {
        setStatusText(mode === "video" ? "Connected. Say hello—Courant can hear you and receive periodic video snapshots." : "Connected. Say hello whenever you're ready.");
        sendEvent({
          type: "conversation.item.create",
          item: { type: "message", role: "user", content: [{ type: "input_text", text: "Start our English practice call now. Briefly introduce yourself, ask me one friendly opening question, and help me improve my English naturally as we talk." }] },
        });
        sendEvent({ type: "response.create" });
      };
      channel.onmessage = event => {
        let payload: Record<string, unknown>;
        try { payload = JSON.parse(String(event.data)) as Record<string, unknown>; } catch { return; }
        const type = String(payload.type || "");
        if (type === "input_audio_buffer.speech_started") setStatusText("Listening to you…");
        if (type === "input_audio_buffer.speech_stopped") setStatusText("Working on a natural reply and a useful correction…");
        if (type === "conversation.item.input_audio_transcription.completed") {
          const transcript = typeof payload.transcript === "string" ? payload.transcript : "";
          if (transcript) addLine("you", transcript);
        }
        if (type === "response.output_audio_transcript.done" || type === "response.audio_transcript.done") {
          const transcript = typeof payload.transcript === "string" ? payload.transcript : "";
          if (transcript) addLine("courant", transcript);
        }
        if (type === "error") {
          const detail = payload.error && typeof payload.error === "object" ? (payload.error as Record<string, unknown>).message : null;
          setError(typeof detail === "string" ? detail : "The live voice service reported an error.");
        }
        if (type === "response.done") setStatusText("Your turn. Keep talking naturally; you can interrupt Courant at any time.");
      };

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const answerResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionData.clientSecret}`, "Content-Type": "application/sdp" },
        body: offer.sdp,
      });
      if (!answerResponse.ok) {
        const detail = await answerResponse.text().catch(() => "");
        throw new Error(answerResponse.status === 401 || answerResponse.status === 403
          ? "The live call token was rejected. Check Realtime API access and try again."
          : `Could not connect the live call (${answerResponse.status}). ${detail.slice(0, 140)}`);
      }
      const answer = await answerResponse.text();
      await peer.setRemoteDescription({ type: "answer", sdp: answer });
    } catch (cause) {
      stream?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      peerRef.current?.close();
      peerRef.current = null;
      channelRef.current?.close();
      channelRef.current = null;
      statusRef.current = "idle";
      setStatus("idle");
      setError(cause instanceof Error ? cause.message : "The live call could not start. Check your microphone permission and connection.");
      setStatusText("No call is active.");
    }
  }

  function toggleMute() {
    const next = !muted;
    streamRef.current?.getAudioTracks().forEach(track => { track.enabled = !next; });
    setMuted(next);
    setStatusText(next ? "Microphone muted." : "Microphone on. Your turn to speak.");
  }

  async function createRecap() {
    if (recapBusy || !lines.some(line => line.role === "you")) return;
    setRecapBusy(true);
    setError("");
    try {
      const history = lines.filter(line => line.role === "you" || line.role === "courant").slice(-10).map(line => ({ role: line.role === "you" ? "user" : "assistant", content: line.text }));
      const response = await fetch("/api/tutor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scenario: "Post-call English learning recap", history, message: `Give me a useful post-call learning recap for a ${level} English learner after a ${scenario}. Use only evidence from this transcript. Format with short headings: 1) Two things I did well, 2) Up to three exact corrections with the natural version and a very short reason, 3) Three useful phrases to practise, 4) One 30-second speaking challenge. If the transcript does not support a claim, say so instead of inventing mistakes. Do not claim to evaluate accent or pronunciation from transcript text. Keep it encouraging and practical.` }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create your learning recap.");
      const text = String(data.reply || "").trim();
      if (!text) throw new Error("The tutor returned an empty recap. Please try again.");
      setRecap(text);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create your learning recap."); }
    finally { setRecapBusy(false); }
  }

  function clearTranscript() {
    setLines([]);
    setError("");
    setStatusText(status === "connected" ? "Transcript cleared from this screen. The call is still active." : "Your private practice room is ready.");
  }

  const active = status === "connected" || status === "connecting";

  return <AppShell>
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-col justify-between gap-5 border-b border-[var(--line)] pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">Courant live coach</p>
          <h1 className="mt-3 text-4xl font-medium tracking-[-.055em] sm:text-5xl">Speak freely. Improve in real time.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">Have a real-time voice call or turn on your camera. Courant listens, talks back naturally, and gives small, useful English corrections as you go.</p>
        </div>
        <a href="/talk" className="w-fit rounded-full border border-[var(--line)] px-4 py-2.5 text-xs font-semibold">← Turn-based practice</a>
      </header>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex rounded-full border border-[var(--line)] bg-[var(--surface)] p-1" role="group" aria-label="Call type">
          <button type="button" onClick={() => setMode("voice")} disabled={active} className={`rounded-full px-5 py-2.5 text-sm font-medium disabled:opacity-40 ${mode === "voice" ? "bg-[var(--ink)] text-white" : "text-[var(--muted)]"}`}>Voice call</button>
          <button type="button" onClick={() => setMode("video")} disabled={active} className={`rounded-full px-5 py-2.5 text-sm font-medium disabled:opacity-40 ${mode === "video" ? "bg-[var(--ink)] text-white" : "text-[var(--muted)]"}`}>Video call</button>
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <input type="checkbox" checked={strictCorrections} disabled={active} onChange={event => setStrictCorrections(event.target.checked)} className="accent-[var(--accent)]"/>
          Correct me more thoroughly
        </label>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <section className="overflow-hidden rounded-[28px] border border-[var(--line)] bg-[var(--surface)]">
          <div className="relative flex min-h-[350px] flex-col items-center justify-center overflow-hidden bg-[#171b1a] p-6 text-center text-white sm:min-h-[450px]">
            <div className="absolute inset-0 opacity-30" aria-hidden="true" style={{ background: "radial-gradient(circle at 50% 45%, #738b7e 0, transparent 42%)" }}/>
            {mode === "video" && active ? <video ref={videoRef} autoPlay muted playsInline className="absolute bottom-4 right-4 z-20 h-32 w-24 rounded-2xl border border-white/30 object-cover shadow-xl sm:h-40 sm:w-32"/> : null}
            <div className={`relative z-10 grid h-28 w-28 place-items-center rounded-full border border-white/15 bg-white/10 shadow-2xl backdrop-blur-sm sm:h-36 sm:w-36 ${status === "connected" ? "animate-pulse" : ""}`}>
              <div className="grid h-20 w-20 place-items-center rounded-full bg-[#e8eee8] text-3xl text-[#263b32] sm:h-28 sm:w-28" aria-hidden="true">✳</div>
            </div>
            <p className="relative z-10 mt-6 text-xl font-medium">{status === "connected" ? "Courant is here." : status === "connecting" ? "Setting up your call…" : "Your English conversation partner"}</p>
            <p className="relative z-10 mt-2 max-w-sm text-sm leading-6 text-white/70">{statusText}</p>
            {mode === "video" && active && <span className="absolute left-4 top-4 rounded-full bg-black/55 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider">Camera on</span>}
            {status === "connected" && <span className="absolute right-4 top-4 flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider"><span className="h-2 w-2 rounded-full bg-emerald-400"/> Live</span>}
          </div>

          <div className="p-4 sm:p-5">
            {!active ? <div className="space-y-4">
              <label className="block text-xs font-semibold text-[var(--muted)]" htmlFor="call-scenario">What would you like to practise?</label>
              <select id="call-scenario" value={scenario} onChange={event => setScenario(event.target.value)} className="w-full rounded-xl border border-[var(--line)] bg-transparent px-3 py-3 text-sm outline-none">
                {starters.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <label className="block text-xs font-semibold text-[var(--muted)]" htmlFor="english-level">Your English level</label>
              <select id="english-level" value={level} onChange={event => setLevel(event.target.value as EnglishLevel)} className="w-full rounded-xl border border-[var(--line)] bg-transparent px-3 py-3 text-sm outline-none">
                <option value="beginner">Beginner — build confidence</option><option value="intermediate">Intermediate — speak more naturally</option><option value="advanced">Advanced — fluency and nuance</option>
              </select>
              <button type="button" onClick={() => void startCall()} className="w-full rounded-full bg-[var(--accent)] px-5 py-3.5 text-sm font-semibold text-white transition hover:opacity-90">Start {mode === "video" ? "video" : "voice"} call ↗</button>
              <p className="text-center text-xs leading-5 text-[var(--muted)]">Your browser will ask for {mode === "video" ? "microphone and camera" : "microphone"} access. The call uses an encrypted WebRTC connection and a short-lived session token.</p>
            </div> : <div className="flex flex-wrap justify-center gap-2">
              <button type="button" onClick={toggleMute} disabled={status !== "connected"} className="rounded-full border border-[var(--line)] px-4 py-3 text-sm font-medium disabled:opacity-40">{muted ? "Unmute microphone" : "Mute microphone"}</button>
              <button type="button" onClick={clearTranscript} className="rounded-full border border-[var(--line)] px-4 py-3 text-sm font-medium">Clear transcript</button>
              <button type="button" onClick={endCall} className="rounded-full bg-[#9d403c] px-5 py-3 text-sm font-semibold text-white">End call</button>
            </div>}
          </div>
        </section>

        <section className="flex min-h-[460px] flex-col rounded-[28px] border border-[var(--line)] bg-[var(--surface)]">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
            <div><h2 className="text-base font-semibold">Live conversation</h2><p className="mt-1 text-xs text-[var(--muted)]">Your words and Courant’s spoken coaching</p></div>
            <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">{status === "connected" ? "Live" : "Private"}</span>
          </div>
          <div ref={transcriptRef} aria-live="polite" className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            {!lines.length && <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-[var(--accent-soft)] text-xl text-[var(--accent)]" aria-hidden="true">↗</div>
              <p className="mt-4 text-sm font-medium">Your conversation appears here.</p>
              <p className="mt-2 max-w-xs text-xs leading-5 text-[var(--muted)]">Corrections are part of the spoken conversation too, so you can practise saying the more natural version right away.</p>
            </div>}
            {lines.map(line => <article key={line.id} className={line.role === "you" ? "ml-7" : line.role === "courant" ? "mr-4" : ""}>
              <p className="mb-1 text-[9px] font-bold uppercase tracking-[.14em] text-[var(--muted)]">{line.role === "you" ? "You said" : line.role === "courant" ? "Courant · coach" : "Note"}</p>
              <p className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${line.role === "you" ? "bg-[var(--accent)] text-white" : "bg-[#f0efe9] text-[var(--ink)]"}`}>{line.text}</p>
            </article>)}
          </div>
          <div className="border-t border-[var(--line)] px-5 py-3 text-xs leading-5 text-[var(--muted)]">{status === "connected" ? "Speak normally. Pause when you want Courant to reply. You can interrupt it naturally." : "The live transcript is kept in this page's memory only; it is not saved to your account."}</div>
        </section>
      </div>

      {!active && lines.some(line => line.role === "you") && <section className="mt-5 rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--accent)]">After your call</p><h2 className="mt-2 text-xl font-medium">Turn the conversation into progress.</h2><p className="mt-1 text-sm leading-6 text-[var(--muted)]">Get specific corrections and a short speaking challenge based on what was actually said.</p></div><button type="button" onClick={() => void createRecap()} disabled={recapBusy} className="shrink-0 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{recapBusy ? "Preparing recap…" : recap ? "Refresh learning recap ↻" : "Create learning recap ↗"}</button></div>{recap && <div className="mt-5 whitespace-pre-wrap rounded-2xl bg-[var(--accent-soft)] p-4 text-sm leading-7 text-[var(--ink)]">{recap}</div>}</section>}
      {error && <div role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--line)] p-4"><p className="text-sm font-semibold">Natural corrections</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Useful grammar and phrasing tips woven into the conversation—not a wall of red marks.</p></div>
        <div className="rounded-2xl border border-[var(--line)] p-4"><p className="text-sm font-semibold">Talk at your pace</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Speak, pause, ask for a repeat, or interrupt the AI. Switch to stricter corrections when you want.</p></div>
        <div className="rounded-2xl border border-[var(--line)] p-4"><p className="text-sm font-semibold">Video with consent</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Video mode sends a compressed camera snapshot every six seconds for visual context; it is not a continuous video stream to the model.</p></div>
      </div>
      <canvas ref={canvasRef} className="hidden" aria-hidden="true"/>
      <audio ref={remoteAudioRef} autoPlay className="hidden"/>
    </div>
  </AppShell>;
}
