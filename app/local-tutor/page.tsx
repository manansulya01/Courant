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
  const [lessonMode, setLessonMode] = useState("conversation");
  const [lessonGoal, setLessonGoal] = useState("Speak more naturally and confidently in everyday English.");
  const [speaking, setSpeaking] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraStatus, setCameraStatus] = useState("Camera is off. Turn it on for a private self-preview.");
  const [lessonReview, setLessonReview] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [rememberProgress, setRememberProgress] = useState(false);
  const [savedLearningContext, setSavedLearningContext] = useState("");
  const [memoryLoaded, setMemoryLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const engineRef = useRef<LocalEngine | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("courant-learning-progress-v1");
      if (saved) {
        const parsed = JSON.parse(saved) as { enabled?: boolean; lines?: ChatLine[]; review?: string; level?: string; lessonGoal?: string; lessonMode?: string };
        if (parsed.enabled) {
          setRememberProgress(true);
          if (Array.isArray(parsed.lines)) setLines(parsed.lines.slice(-30));
          if (typeof parsed.review === "string") setSavedLearningContext(parsed.review);
          if (typeof parsed.level === "string") setLevel(parsed.level);
          if (typeof parsed.lessonGoal === "string") setLessonGoal(parsed.lessonGoal);
          if (typeof parsed.lessonMode === "string") setLessonMode(parsed.lessonMode);
        }
      }
    } catch {
      window.localStorage.removeItem("courant-learning-progress-v1");
    } finally {
      setMemoryLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!memoryLoaded) return;
    if (!rememberProgress) {
      window.localStorage.removeItem("courant-learning-progress-v1");
      return;
    }
    try {
      window.localStorage.setItem("courant-learning-progress-v1", JSON.stringify({
        enabled: true, lines: lines.slice(-30), review: savedLearningContext, level, lessonGoal, lessonMode,
      }));
    } catch {
      setStatus("This browser could not save learning progress. Your current lesson still works normally.");
    }
  }, [memoryLoaded, rememberProgress, lines, savedLearningContext, level, lessonGoal, lessonMode]);

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
      throw new Error("This browser does not support WebGPU, which is required for private on-device AI. Try a recent Chrome or Edge browser on a supported device, or use text practice lessons instead.");
    }
    setStatus("Preparing the local model. The first download may take a few minutes…");
    const webllm = await import("@mlc-ai/web-llm");
    const engine = await webllm.CreateMLCEngine("Qwen2.5-1.5B-Instruct-q4f16_1-MLC", {
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
      setStatus("Speech recognition is not available in this browser. You can still type, and Courant can read replies aloud using your device voice.");
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

  async function finishLesson() {
    if (!lines.length || reviewLoading || loading) return;
    setReviewLoading(true);
    setLessonReview("");
    try {
      const engine = await ensureModel();
      const transcript = lines.map(line => `${line.role === "you" ? "Learner" : "Teacher"}: ${line.text}`).join("\n").slice(-9000);
      const result = await engine.chat.completions.create({
        messages: [
          { role: "system", content: "You are an expert, encouraging English teacher. Review this one-to-one lesson transcript. Give a concise learner-friendly lesson report with: 1) what the learner did well, 2) up to three useful corrections with natural alternatives, 3) two vocabulary or expression upgrades, 4) one specific practice task for next time. Be accurate and never invent mistakes. Use clear headings and plain text." },
          { role: "user", content: `Learner level: ${level}. Goal: ${lessonGoal}. Lesson style: ${lessonMode}. Transcript:\n${transcript}` }
        ],
        temperature: 0.3,
        max_tokens: 320
      });
      const review = String(result.choices?.[0]?.message?.content || "").trim();
      if (!review) throw new Error("The lesson review was empty. Please try again.");
      setLessonReview(review);
      setSavedLearningContext(review);
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "Could not create lesson review.");
    } finally {
      setReviewLoading(false);
    }
  }

  function startNewLesson() {
    if (loading || reviewLoading) return;
    window.speechSynthesis?.cancel();
    setLines([]);
    setLessonReview("");
    setPrompt("");
    setStatus("New lesson ready. Tell your teacher what you would like to practise.");
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
          content: `You are Courant, the learner's dedicated one-to-one English tutor. This is a private lesson, not a generic chatbot. Learner level: ${level}. Lesson format: ${lessonMode}. Learner's goal: ${lessonGoal}. Previous learning notes: ${savedLearningContext || "No previous saved lesson notes."}. Lead the lesson actively: ask only ONE question at a time, respond to the meaning of the learner's answer, and choose the next question based on what they said. Keep the conversation warm, natural and age-appropriate. Correct important errors gently using a short natural correction and one brief reason; do not interrupt every sentence to correct tiny errors. Help the learner express their own ideas. For role-play, stay in character and make the scenario realistic. For grammar, explain briefly then ask the learner to make their own example. For pronunciation, give a short phrase to say and explain stress or sounds; do not claim to evaluate audio you cannot access. For conversation, keep a genuine back-and-forth going. Track strengths and recurring mistakes within this conversation. End with one clear next step or one follow-up question. Do not claim to have heard audio or seen video.`,
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
      <style>{`
        @keyframes courant-avatar-float { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-5px) rotate(-.5deg); } }
        @keyframes courant-avatar-blink { 0%,45%,48%,100% { transform: scaleY(1); } 46.5%,47.5% { transform: scaleY(.12); } }
        @keyframes courant-avatar-mouth { 0%,100% { transform: scaleY(.55); } 50% { transform: scaleY(1.18); } }
        @keyframes courant-avatar-glow { 0%,100% { opacity: .25; transform: scale(.96); } 50% { opacity: .55; transform: scale(1.04); } }
        .courant-avatar-art { animation: courant-avatar-float 4.5s ease-in-out infinite; transform-origin: 50% 90%; }
        .courant-avatar-eye { transform-box: fill-box; transform-origin: center; animation: courant-avatar-blink 5.2s ease-in-out infinite; }
        .courant-avatar-mouth { transform-box: fill-box; transform-origin: center; }
        .courant-avatar-speaking .courant-avatar-mouth { animation: courant-avatar-mouth .28s ease-in-out infinite alternate; }
        .courant-avatar-halo { animation: courant-avatar-glow 3.5s ease-in-out infinite; transform-origin: center; }
        @media (prefers-reduced-motion: reduce) { .courant-avatar-art,.courant-avatar-eye,.courant-avatar-mouth,.courant-avatar-halo { animation: none !important; } }
      `}</style>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <a href="/" style={{ color: "#676a60", textDecoration: "none", fontSize: 14 }}>← Courant</a>
        <header style={{ margin: "40px 0 28px" }}>
          <p style={{ color: "#6b725d", letterSpacing: ".12em", textTransform: "uppercase", fontSize: 12, fontWeight: 700 }}>Private practice · on-device AI</p>
          <h1 style={{ fontSize: "clamp(34px, 6vw, 54px)", letterSpacing: "-.045em", lineHeight: 1.05, fontWeight: 600, margin: "12px 0" }}>Your own English teacher, one lesson at a time.</h1>
          <p style={{ color: "#66695f", lineHeight: 1.7, maxWidth: 620 }}>Have a private one-to-one English lesson with a tutor that guides the conversation, adapts to your level, corrects useful mistakes and follows your learning goal. Speak or type naturally.</p>
        </header>

        <section style={{ background: "#fff", border: "1px solid #e8e7df", borderRadius: 20, padding: 22, marginBottom: 18 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ minWidth: 220, flex: 1 }}>
              <strong style={{ display: "block", marginBottom: 5 }}>On-device tutor · compact model</strong>
              <span role="status" style={{ color: "#72746c", fontSize: 13 }}>{status}</span>
            </div>
            <button type="button" onClick={() => { setLoading(true); ensureModel().catch(error => setStatus(error instanceof Error ? error.message : "Could not load model.")).finally(() => setLoading(false)); }} disabled={loading || ready} style={{ border: 0, borderRadius: 999, background: "#343b2d", color: "white", padding: "12px 18px", cursor: "pointer", opacity: loading || ready ? .6 : 1 }}>{ready ? "Model ready" : loading ? "Loading…" : "Prepare tutor"}</button>
          </div>
          <div aria-label={`Model download progress ${progress}%`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} style={{ height: 5, background: "#efeee8", borderRadius: 99, overflow: "hidden", marginTop: 18 }}>
            <div style={{ width: `${progress}%`, height: "100%", background: "#87916f", transition: "width .2s" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 12, marginTop: 18 }}>
            <label style={{ fontSize: 13, color: "#55584f" }}>Lesson style<select value={lessonMode} onChange={event => setLessonMode(event.target.value)} style={{ display: "block", marginTop: 7, width: "100%", border: "1px solid #deded5", borderRadius: 8, padding: "10px", background: "#fff" }}><option value="conversation">Natural conversation</option><option value="roleplay">Real-life role-play</option><option value="grammar">Grammar coaching</option><option value="pronunciation">Pronunciation practice</option></select></label>
            <label style={{ fontSize: 13, color: "#55584f" }}>What do you want to improve?<input value={lessonGoal} onChange={event => setLessonGoal(event.target.value)} maxLength={240} style={{ display: "block", marginTop: 7, width: "100%", border: "1px solid #deded5", borderRadius: 8, padding: "10px", background: "#fff" }} /></label>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center", marginTop: 14 }}>
            <label style={{ fontSize: 14, color: "#55584f" }}>Your level
              <select value={level} onChange={event => setLevel(event.target.value)} style={{ marginLeft: 8, border: "1px solid #deded5", borderRadius: 8, padding: "8px 10px", background: "#fff" }}>
                <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
              </select>
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: "#55584f" }}><input type="checkbox" checked={voiceEnabled} onChange={event => setVoiceEnabled(event.target.checked)} /> Speak replies aloud</label>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: "#55584f" }}><input type="checkbox" checked={rememberProgress} onChange={event => setRememberProgress(event.target.checked)} /> Remember my progress on this device</label>
          </div>
          <p style={{ fontSize: 12, color: "#77796f", lineHeight: 1.6, margin: "14px 0 0" }}>The 1.5B tutor model is larger and needs a capable WebGPU device and more memory. It downloads on first use, then runs on-device. Speech recognition depends on browser support; spoken replies use your device's installed voices. When progress memory is enabled, recent lesson turns and your latest review are saved only in this browser on this device. No voice recordings are stored.</p>
        </section>

        <section aria-label="Local teacher and camera preview" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 14, marginBottom: 18 }}>
          <div style={{ background: "#e9ede3", border: "1px solid #dfe4d8", borderRadius: 20, padding: 20, minHeight: 250, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
            <span style={{ position: "absolute", top: 16, left: 18, color: "#66715c", fontSize: 11, fontWeight: 700, letterSpacing: ".12em" }}>COURANT · LOCAL TEACHER</span>
            <svg viewBox="0 0 220 190" role="img" aria-label={speaking ? "Animated teacher speaking" : "Animated teacher ready"} className={speaking ? "courant-avatar-art courant-avatar-speaking" : "courant-avatar-art"} style={{ width: "min(100%, 220px)", height: 180, marginTop: 20 }}>
              <ellipse className="courant-avatar-halo" cx="110" cy="178" rx="78" ry="10" fill="#d4ddce"/>
              <path d="M48 181c4-37 27-55 62-55s58 18 62 55" fill="#6f8066"/>
              <path d="M58 73c0-43 22-66 53-66 35 0 56 26 53 68l-9 37H68z" fill="#4c5546"/>
              <ellipse cx="110" cy="83" rx="53" ry="62" fill="#e9bfa0"/>
              <path d="M57 75c-4-39 16-67 53-68 36-1 55 24 55 59-12-7-22-18-27-31-17 18-44 27-81 25z" fill="#4c5546"/>
              <path d="M83 82q8-7 16 0" fill="none" stroke="#5b493f" strokeWidth="3" strokeLinecap="round"/>
              <path d="M122 82q8-7 16 0" fill="none" stroke="#5b493f" strokeWidth="3" strokeLinecap="round"/>
              <circle className="courant-avatar-eye" cx="91" cy="91" r="3" fill="#3c3935"/><circle className="courant-avatar-eye" cx="130" cy="91" r="3" fill="#3c3935"/>
              <path d="M109 92l-4 13 8 2" fill="none" stroke="#c68e72" strokeWidth="2" strokeLinecap="round"/>
              {speaking ? <ellipse className="courant-avatar-mouth" cx="110" cy="119" rx="10" ry="9" fill="#8f4f4a" stroke="#79413e" strokeWidth="2"/> : <path className="courant-avatar-mouth" d="M98 118q12 10 24 0" fill="none" stroke="#9b5c55" strokeWidth="3" strokeLinecap="round"/>}
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
            {lines.length === 0 && <div style={{ margin: "auto", maxWidth: 420, textAlign: "center", padding: "40px 0" }}><div aria-hidden="true" style={{ fontSize: 28, marginBottom: 10 }}>✳</div><h2 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 8px" }}>What would you like to practise?</h2><p style={{ color: "#77796f", lineHeight: 1.6, margin: 0 }}>Start with “I want to speak more confidently. Can we talk about my day?”</p></div>}
            {lines.map((line, index) => <div key={index} style={{ alignSelf: line.role === "you" ? "flex-end" : "flex-start", maxWidth: "88%", borderRadius: 16, padding: "12px 15px", background: line.role === "you" ? "#e9eddf" : "#f5f4ef", lineHeight: 1.65, whiteSpace: "pre-wrap" }}><div style={{ fontSize: 11, color: "#77796f", marginBottom: 4 }}>{line.role === "you" ? "YOU" : "COURANT · LOCAL TUTOR"}</div>{line.text}</div>)}
            {loading && <p style={{ color: "#77796f", fontSize: 14 }}>Thinking on your device…</p>}
          </div>
          {lines.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 10, padding: "14px 18px 0" }}>
            <button type="button" onClick={startNewLesson} disabled={loading || reviewLoading} style={{ border: "1px solid #deded5", borderRadius: 999, padding: "9px 14px", background: "#fff", color: "#55584f", fontSize: 12, cursor: "pointer" }}>Start a new lesson</button>
            <button type="button" onClick={finishLesson} disabled={loading || reviewLoading} style={{ border: 0, borderRadius: 999, padding: "9px 14px", background: "#e9eddf", color: "#343b2d", fontSize: 12, cursor: "pointer", opacity: loading || reviewLoading ? .6 : 1 }}>{reviewLoading ? "Preparing your lesson review…" : "Finish lesson & get feedback"}</button>
          </div>}
          {lessonReview && <section aria-live="polite" style={{ margin: "14px 18px", padding: 18, borderRadius: 14, background: "#f4f5ef", border: "1px solid #e2e7dc" }}><h3 style={{ fontSize: 16, fontWeight: 650, margin: "0 0 10px" }}>Your lesson review</h3><p style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.7, color: "#44483f", margin: 0 }}>{lessonReview}</p></section>}
          <form onSubmit={sendMessage} style={{ borderTop: "1px solid #eeede6", padding: 14, display: "flex", flexWrap: "wrap", gap: 10 }}>
            <input value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="Tell your teacher what you would like to talk about…" aria-label="Message to the local English tutor" style={{ minWidth: 0, flex: "1 1 220px", border: "1px solid #e2e1d9", borderRadius: 12, padding: "14px 15px", background: "#fff", color: "#252722", font: "inherit" }} />
            <button type="button" onClick={startListening} aria-pressed={listening} style={{ border: "1px solid #deded5", borderRadius: 12, padding: "0 15px", minHeight: 48, background: listening ? "#e9eddf" : "#fff", color: "#343b2d", cursor: "pointer" }}>{listening ? "Stop listening" : "Speak"}</button>
            <button type="submit" disabled={loading || !prompt.trim()} style={{ border: 0, borderRadius: 12, padding: "0 18px", minHeight: 48, background: "#343b2d", color: "white", cursor: "pointer", opacity: loading || !prompt.trim() ? .55 : 1 }}>Send</button>
          </form>
        </section>
        <p style={{ marginTop: 16, fontSize: 12, color: "#77796f", lineHeight: 1.6 }}>Your tutor follows recent turns in this lesson. If you opt in, Courant also saves a short learning history and your latest lesson review in this browser so the next lesson can build on it. On-device AI needs a WebGPU-capable browser and sufficient device memory. Microphone recognition and system voices vary by device.</p>
      </div>
    </main>
  );
}
