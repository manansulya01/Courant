"use client";

import { useEffect, useRef, useState } from "react";

type ChatLine = { role: "you" | "teacher"; text: string };
type ModelMessage = { role: "system" | "user" | "assistant"; content: string };
type LocalEngine = {
  chat: {
    completions: {
      create: (input: { messages: ModelMessage[]; temperature: number; max_tokens: number }) => Promise<{
        choices?: Array<{ message?: { content?: string | null } }>;
      }>;
    };
  };
};
type SpeechResultEvent = Event & {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

const pageStyle = {
  background: "#f7f6f2",
  color: "#252722",
  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
};

export default function LocalTutorPage() {
  const [prompt, setPrompt] = useState("");
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [listening, setListening] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("The local model has not been downloaded yet.");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [level, setLevel] = useState("intermediate");
  const [speaking, setSpeaking] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraStatus, setCameraStatus] = useState("Camera is off. Turn it on for a private self-preview.");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const engineRef = useRef<LocalEngine | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    streamRef.current?.getTracks().forEach(track => track.stop());
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  async function toggleCamera() {
    if (cameraOn) {
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setCameraOn(false);
      setCameraStatus("Camera is off.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("Camera preview is not supported in this browser. You can continue with voice or text.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setCameraOn(true);
      setCameraStatus("Your camera preview stays on this device. The local tutor does not analyse video.");
      stream.getVideoTracks().forEach(track => {
        track.onended = () => {
          setCameraOn(false);
          setCameraStatus("Camera preview stopped.");
          streamRef.current = null;
        };
      });
    } catch {
      setCameraStatus("Camera permission was not granted or the camera is unavailable. Check browser permissions and try again.");
    }
  }

  async function ensureModel(): Promise<LocalEngine> {
    if (engineRef.current) return engineRef.current;
    if (!(typeof navigator !== "undefined" && "gpu" in navigator)) {
      throw new Error("WebGPU is unavailable in this browser. Use a compatible, up-to-date browser and device, or use Courant's hosted conversation room.");
    }
    setStatus("Preparing the local model. The first download may take a few minutes…");
    const webllm = await import("@mlc-ai/web-llm");
    const engine = await webllm.CreateMLCEngine("Llama-3.2-1B-Instruct-q4f16_1-MLC", {
      initProgressCallback: (report: { progress?: number; text?: string }) => {
        setProgress(Math.round(Math.max(0, Math.min(1, report.progress ?? 0)) * 100));
        setStatus(report.text || "Downloading model weights…");
      },
    });
    engineRef.current = engine as LocalEngine;
    setReady(true);
    setProgress(100);
    setStatus("Ready — replies are generated on this device.");
    return engineRef.current;
  }

  function startListening() {
    const speechWindow = window as SpeechWindow;
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatus("Speech input is not supported by this browser. You can still type, or use Courant's hosted talk room.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const resultEvent = event as SpeechResultEvent;
      let transcript = "";
      for (let index = resultEvent.resultIndex; index < resultEvent.results.length; index += 1) {
        transcript += resultEvent.results[index][0].transcript;
      }
      if (transcript.trim()) setPrompt(transcript.trim());
    };
    recognition.onerror = () => {
      setStatus("Microphone speech recognition stopped. Check browser permission or type your message instead.");
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
      setStatus("Listening… speak naturally in English.");
    } catch {
      setListening(false);
      setStatus("The microphone could not start. Check browser permission and try again.");
    }
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = prompt.trim();
    if (!text || loading) return;
    setLoading(true);
    setLines(current => [...current, { role: "you", text }]);
    setPrompt("");
    try {
      const engine = await ensureModel();
      const history = [...lines, { role: "you" as const, text }];
      const messages: ModelMessage[] = [
        {
          role: "system",
          content: `You are Courant, a kind, natural English conversation teacher. The learner's level is ${level}. Reply in clear, concise English. If the learner makes a meaningful mistake, gently show a natural corrected version and give one short explanation. Continue the conversation with one relevant question. Be encouraging, not robotic. Do not claim to have heard audio or seen video.`,
        },
        ...history.slice(-12).map(line => ({
          role: line.role === "you" ? "user" as const : "assistant" as const,
          content: line.text,
        })),
      ];
      const result = await engine.chat.completions.create({ messages, temperature: 0.7, max_tokens: 220 });
      const reply = String(result.choices?.[0]?.message?.content || "").trim();
      if (!reply) throw new Error("The local model returned an empty reply. Please try again.");
      setLines(current => [...current, { role: "teacher", text: reply }]);
      if (voiceEnabled && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(reply);
        utterance.onstart = () => setSpeaking(true);
        utterance.onend = () => setSpeaking(false);
        utterance.onerror = () => setSpeaking(false);
        const englishVoice = window.speechSynthesis.getVoices().find(voice => /^en(-|_)/i.test(voice.lang));
        if (englishVoice) utterance.voice = englishVoice;
        utterance.rate = 0.94;
        window.speechSynthesis.speak(utterance);
      } else {
        setSpeaking(false);
      }
      setStatus("Ready — your conversation stays in this page unless you choose to share it.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "The local tutor could not respond.";
      setStatus(message);
      setLines(current => [...current, { role: "teacher", text: `I couldn't answer just now: ${message}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ ...pageStyle, minHeight: "100vh", padding: "clamp(20px, 5vw, 64px)" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <a href="/" style={{ color: "#676a60", textDecoration: "none", fontSize: 14 }}>← Courant</a>
        <header style={{ margin: "40px 0 28px" }}>
          <p style={{ color: "#6b725d", letterSpacing: ".12em", textTransform: "uppercase", fontSize: 12, fontWeight: 700 }}>Private practice · on-device AI</p>
          <h1 style={{ fontSize: "clamp(34px, 6vw, 54px)", letterSpacing: "-.045em", lineHeight: 1.05, fontWeight: 600, margin: "12px 0" }}>A little practice goes a long way.</h1>
          <p style={{ color: "#66695f", lineHeight: 1.7, maxWidth: 620 }}>Practise with a small language model running on your device, a simple animated teacher, and optional camera self-preview. Speak or type naturally. No avatar or conversation API is used in this room.</p>
        </header>

        <section style={{ background: "#fff", border: "1px solid #e8e7df", borderRadius: 20, padding: 22, marginBottom: 18 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ minWidth: 220, flex: 1 }}>
              <strong style={{ display: "block", marginBottom: 5 }}>Local tutor model</strong>
              <span role="status" style={{ color: "#72746c", fontSize: 13 }}>{status}</span>
            </div>
            <button type="button" onClick={() => { setLoading(true); ensureModel().catch(error => setStatus(error instanceof Error ? error.message : "Could not load model.")).finally(() => setLoading(false)); }} disabled={loading || ready} style={{ border: 0, borderRadius: 999, background: "#343b2d", color: "white", padding: "12px 18px", cursor: "pointer", opacity: loading || ready ? .6 : 1 }}>{ready ? "Model ready" : loading ? "Loading…" : "Load local model"}</button>
          </div>
          <div aria-label={`Model download progress ${progress}%`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} style={{ height: 5, background: "#efeee8", borderRadius: 99, overflow: "hidden", marginTop: 18 }}>
            <div style={{ width: `${progress}%`, height: "100%", background: "#87916f", transition: "width .2s" }} />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center", marginTop: 18 }}>
            <label style={{ fontSize: 14, color: "#55584f" }}>Your level
              <select value={level} onChange={event => setLevel(event.target.value)} style={{ marginLeft: 8, border: "1px solid #deded5", borderRadius: 8, padding: "8px 10px", background: "#fff" }}>
                <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
              </select>
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: "#55584f" }}><input type="checkbox" checked={voiceEnabled} onChange={event => setVoiceEnabled(event.target.checked)} /> Speak replies aloud</label>
          </div>
          <p style={{ fontSize: 12, color: "#77796f", lineHeight: 1.6, margin: "14px 0 0" }}>The model weights download on first use and require WebGPU. Speech recognition is provided by your browser and may use its own online service; spoken replies use installed system voices and may not work offline on every device.</p>
        </section>

        <section aria-label="Local teacher and camera preview" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 14, marginBottom: 18 }}>
          <div style={{ background: "#e9ede3", border: "1px solid #dfe4d8", borderRadius: 20, padding: 20, minHeight: 250, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
            <span style={{ position: "absolute", top: 16, left: 18, color: "#66715c", fontSize: 11, fontWeight: 700, letterSpacing: ".12em" }}>COURANT · LOCAL TEACHER</span>
            <svg viewBox="0 0 220 190" role="img" aria-label={speaking ? "Animated teacher speaking" : "Animated teacher ready"} style={{ width: "min(100%, 220px)", height: 180, marginTop: 20 }}>
              <ellipse cx="110" cy="178" rx="78" ry="10" fill="#d4ddce"/>
              <path d="M48 181c4-37 27-55 62-55s58 18 62 55" fill="#6f8066"/>
              <path d="M58 73c0-43 22-66 53-66 35 0 56 26 53 68l-9 37H68z" fill="#4c5546"/>
              <ellipse cx="110" cy="83" rx="53" ry="62" fill="#e9bfa0"/>
              <path d="M57 75c-4-39 16-67 53-68 36-1 55 24 55 59-12-7-22-18-27-31-17 18-44 27-81 25z" fill="#4c5546"/>
              <path d="M83 82q8-7 16 0" fill="none" stroke="#5b493f" strokeWidth="3" strokeLinecap="round"/>
              <path d="M122 82q8-7 16 0" fill="none" stroke="#5b493f" strokeWidth="3" strokeLinecap="round"/>
              <circle cx="91" cy="91" r="3" fill="#3c3935"/><circle cx="130" cy="91" r="3" fill="#3c3935"/>
              <path d="M109 92l-4 13 8 2" fill="none" stroke="#c68e72" strokeWidth="2" strokeLinecap="round"/>
              {speaking ? <ellipse cx="110" cy="119" rx="10" ry="9" fill="#8f4f4a" stroke="#79413e" strokeWidth="2"/> : <path d="M98 118q12 10 24 0" fill="none" stroke="#9b5c55" strokeWidth="3" strokeLinecap="round"/>}
              <path d="M68 150q42 22 84 0" fill="none" stroke="#829477" strokeWidth="3" opacity=".65"/>
            </svg>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#53614c", fontSize: 13, marginTop: 2 }}>
              <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 99, background: speaking ? "#6c9369" : "#aab19f", boxShadow: speaking ? "0 0 0 4px #d6e2d0" : "none" }} />
              {speaking ? "Speaking" : loading ? "Thinking" : "Ready to practise"}
            </div>
          </div>
          <div style={{ background: "#252b27", border: "1px solid #39433d", borderRadius: 20, padding: 14, minHeight: 250, display: "flex", flexDirection: "column", justifyContent: "space-between", overflow: "hidden" }}>
            <div style={{ color: "#e8eee5", fontSize: 11, fontWeight: 700, letterSpacing: ".12em", padding: "3px 4px 10px" }}>YOUR CAMERA</div>
            <div style={{ position: "relative", flex: 1, minHeight: 170, borderRadius: 13, overflow: "hidden", background: "radial-gradient(ellipse at center, #536158 0%, #303a34 72%)", display: "grid", placeItems: "center" }}>
              <video ref={videoRef} autoPlay muted playsInline aria-label="Your private camera preview" style={{ width: "100%", height: "100%", position: "absolute", inset: 0, objectFit: "cover", transform: "scaleX(-1)", display: cameraOn ? "block" : "none" }} />
              {!cameraOn && <div style={{ textAlign: "center", color: "#d6ded3", padding: 18 }}><div aria-hidden="true" style={{ fontSize: 30, marginBottom: 8 }}>◉</div><p style={{ fontSize: 13, margin: 0 }}>Camera preview is off</p><p style={{ fontSize: 11, color: "#aeb9ad", margin: "6px 0 0" }}>Your camera is never started without your tap.</p></div>}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, paddingTop: 12 }}>
              <span role="status" style={{ color: "#c5d0c2", fontSize: 11, lineHeight: 1.4, flex: 1 }}>{cameraStatus}</span>
              <button type="button" onClick={toggleCamera} style={{ border: "1px solid #657568", borderRadius: 999, padding: "10px 13px", color: "white", background: cameraOn ? "#5a4944" : "#536b58", fontSize: 12, cursor: "pointer", flexShrink: 0 }}>{cameraOn ? "Turn camera off" : "Turn camera on"}</button>
            </div>
          </div>
        </section>

        <section style={{ background: "#fff", border: "1px solid #e8e7df", borderRadius: 20, overflow: "hidden" }}>
          <div aria-live="polite" style={{ minHeight: 280, maxHeight: "50vh", overflowY: "auto", padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
            {lines.length === 0 && <div style={{ margin: "auto", maxWidth: 420, textAlign: "center", padding: "40px 0" }}><div aria-hidden="true" style={{ fontSize: 28, marginBottom: 10 }}>✳</div><h2 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 8px" }}>What would you like to practise?</h2><p style={{ color: "#77796f", lineHeight: 1.6, margin: 0 }}>Try “Help me practise introducing myself at a new school.”</p></div>}
            {lines.map((line, index) => <div key={index} style={{ alignSelf: line.role === "you" ? "flex-end" : "flex-start", maxWidth: "88%", borderRadius: 16, padding: "12px 15px", background: line.role === "you" ? "#e9eddf" : "#f5f4ef", lineHeight: 1.65, whiteSpace: "pre-wrap" }}><div style={{ fontSize: 11, color: "#77796f", marginBottom: 4 }}>{line.role === "you" ? "YOU" : "COURANT · LOCAL TUTOR"}</div>{line.text}</div>)}
            {loading && <p style={{ color: "#77796f", fontSize: 14 }}>Thinking on your device…</p>}
          </div>
          <form onSubmit={sendMessage} style={{ borderTop: "1px solid #eeede6", padding: 14, display: "flex", flexWrap: "wrap", gap: 10 }}>
            <input value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="Write or dictate something in English…" aria-label="Message to the local English tutor" style={{ minWidth: 0, flex: "1 1 220px", border: "1px solid #e2e1d9", borderRadius: 12, padding: "14px 15px", background: "#fff", color: "#252722", font: "inherit" }} />
            <button type="button" onClick={startListening} aria-pressed={listening} style={{ border: "1px solid #deded5", borderRadius: 12, padding: "0 15px", minHeight: 48, background: listening ? "#e9eddf" : "#fff", color: "#343b2d", cursor: "pointer" }}>{listening ? "Stop listening" : "Speak"}</button>
            <button type="submit" disabled={loading || !prompt.trim()} style={{ border: 0, borderRadius: 12, padding: "0 18px", minHeight: 48, background: "#343b2d", color: "white", cursor: "pointer", opacity: loading || !prompt.trim() ? .55 : 1 }}>Send</button>
          </form>
        </section>
        <p style={{ marginTop: 16, fontSize: 12, color: "#77796f", lineHeight: 1.6 }}>Local inference is experimental and device-dependent. The animated teacher is a lightweight visual companion, not a photorealistic avatar; the camera is a private self-preview and is not analysed by the local model. For real-time voice/video AI, use the regular <a href="/talk" style={{ textDecoration: "underline" }}>Courant conversation room</a> when its provider credentials are configured.</p>
      </div>
    </main>
  );
}
