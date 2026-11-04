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
  const engineRef = useRef<LocalEngine | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

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
        const englishVoice = window.speechSynthesis.getVoices().find(voice => /^en(-|_)/i.test(voice.lang));
        if (englishVoice) utterance.voice = englishVoice;
        utterance.rate = 0.94;
        window.speechSynthesis.speak(utterance);
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
          <p style={{ color: "#66695f", lineHeight: 1.7, maxWidth: 620 }}>Practise everyday conversations with a small language model running on your device. Use your voice when your browser supports speech recognition, or type naturally. This is a private text-and-voice practice room, not a live video avatar.</p>
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
        <p style={{ marginTop: 16, fontSize: 12, color: "#77796f", lineHeight: 1.6 }}>Local inference is experimental and device-dependent. If the model cannot run on your device, use the regular <a href="/talk" style={{ textDecoration: "underline" }}>Courant conversation room</a>.</p>
      </div>
    </main>
  );
}
