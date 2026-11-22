"use client";

import { useEffect, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };
type VoiceStyle = "auto" | "feminine" | "masculine";
type VoiceLike = SpeechSynthesisVoice;
type SpeechRecognitionResultLike = { 0?: { transcript?: string } };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<SpeechRecognitionResultLike> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

export default function TalkingAI() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const [voiceStyle, setVoiceStyle] = useState<VoiceStyle>("auto");
  const [availableVoices, setAvailableVoices] = useState<VoiceLike[]>([]);
  const [voiceLabel, setVoiceLabel] = useState("Automatic natural voice");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "NEAS APEX is ready. Ask about rope access, renewables, offshore operations, HSEQ, training or business development." },
  ]);
  const endRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, open]);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const loadVoices = () => setAvailableVoices(window.speechSynthesis.getVoices());
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, []);

  function languageFor(text: string) {
    if (/[\\u0E00-\\u0E7F]/.test(text)) return "th-TH";
    if (/[\\u3040-\\u30FF]/.test(text)) return "ja-JP";
    if (/[\\u4E00-\\u9FFF]/.test(text)) return "zh-CN";
    if (/[\\uAC00-\\uD7AF]/.test(text)) return "ko-KR";
    if (/[\\u0600-\\u06FF]/.test(text)) return "ar";
    if (/[\\u0400-\\u04FF]/.test(text)) return "ru-RU";
    if (/[\\u0900-\\u097F]/.test(text)) return "hi-IN";
    if (/[ñáéíóú¿¡]/i.test(text)) return "es-ES";
    return navigator.language || "en-US";
  }

  function speakNaturally(text: string) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const lang = languageFor(text);
    const sameLanguage = availableVoices.filter((voice) => voice.lang.toLowerCase().split("-")[0] === lang.toLowerCase().split("-")[0]);
    const genderPattern = voiceStyle === "feminine" ? /female|woman|samantha|zira|jenny|aria|susan|victoria/i : voiceStyle === "masculine" ? /male|man|david|guy|mark|daniel|alex/i : null;
    const preferred = genderPattern ? sameLanguage.find((voice) => genderPattern.test(voice.name)) : undefined;
    const voice = preferred || sameLanguage.find((item) => item.default) || sameLanguage[0] || availableVoices.find((item) => item.default) || availableVoices[0];
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voice?.lang || lang;
    if (voice) {
      utterance.voice = voice;
      setVoiceLabel(voice.name + " · " + voice.lang);
    } else {
      setVoiceLabel("Browser default · " + lang);
    }
    utterance.rate = 0.98;
    utterance.pitch = voiceStyle === "feminine" ? 1.04 : voiceStyle === "masculine" ? 0.94 : 1;
    window.speechSynthesis.speak(utterance);
  }

  async function sendMessage(text = input) {
    const value = text.trim();
    if (!value || busy) return;
    const next: Message[] = [...messages, { role: "user", content: value }];
    setMessages(next);
    setInput("");
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/talking-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.filter((m) => m.role !== "assistant" || next.indexOf(m) > 0).slice(-20) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Talking AI request failed.");
      const answer = String(data.reply || "");
      setMessages((current) => [...current, { role: "assistant", content: answer }]);
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(answer);
        utterance.lang = "en-US";
        utterance.rate = 1;
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reach Talking AI.");
    } finally {
      setBusy(false);
    }
  }

  function toggleListening() {
    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setError("Voice input is not supported in this browser. You can still type your message.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const recognition = new Recognition();
    recognition.lang = navigator.language || "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript || "";
      if (transcript) setInput((current) => current ? current + " " + transcript : transcript);
    };
    recognition.onerror = () => {
      setError("Microphone input failed. Check browser microphone permission.");
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setError("");
    setListening(true);
    recognition.start();
  }

  const buttonStyle: React.CSSProperties = {
    border: "1px solid rgba(202,147,50,.42)", background: "rgba(202,147,50,.12)",
    color: "#EBC07E", borderRadius: 10, padding: "9px 12px", cursor: "pointer",
  };

  return (
    <div style={{ position: "fixed", right: 22, bottom: 22, zIndex: 80, fontFamily: "Arial, sans-serif" }}>
      {open && (
        <section aria-label="NEAS APEX Talking AI" style={{
          width: "min(390px, calc(100vw - 28px))", height: "min(590px, calc(100vh - 105px))",
          display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: 18,
          border: "1px solid rgba(202,147,50,.4)", background: "rgba(7,29,41,.97)",
          boxShadow: "0 18px 60px rgba(0,0,0,.55)", color: "#f5f0e7", backdropFilter: "blur(20px)",
        }}>
          <header style={{ padding: "15px 17px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(202,147,50,.22)" }}>
            <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: "50%", background: "#CA9332", boxShadow: "0 0 14px #CA9332" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, letterSpacing: ".16em", color: "#EBC07E" }}>NEAS APEX</div>
              <div style={{ fontSize: 10, opacity: .58, marginTop: 3 }}>TALKING AI · PREVIEW</div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close Talking AI" style={{ ...buttonStyle, padding: "5px 10px" }}>×</button>
          </header>
          <div style={{ padding: "9px 13px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid rgba(202,147,50,.14)", flexWrap: "wrap" }}><label htmlFor="apex-voice-style" style={{ fontSize: 10, opacity: .7 }}>VOICE</label><select id="apex-voice-style" value={voiceStyle} onChange={(event) => setVoiceStyle(event.target.value as VoiceStyle)} style={{ background: "#071D29", color: "#EBC07E", border: "1px solid rgba(202,147,50,.35)", borderRadius: 8, padding: "5px 7px", fontSize: 10 }}><option value="auto">Auto-select</option><option value="feminine">Feminine voice</option><option value="masculine">Masculine voice</option></select><span style={{ fontSize: 9, opacity: .5, marginLeft: "auto" }}>Language: automatic · {voiceLabel}</span></div>\n          <div aria-live="polite" style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 11 }}>
            {messages.map((message, index) => (
              <div key={index} style={{
                alignSelf: message.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "88%", padding: "10px 12px", borderRadius: 13,
                background: message.role === "user" ? "rgba(202,147,50,.2)" : "rgba(255,255,255,.07)",
                border: "1px solid rgba(255,255,255,.08)", fontSize: 12, lineHeight: 1.55, whiteSpace: "pre-wrap",
              }}>{message.content}</div>
            ))}
            {busy && <div style={{ fontSize: 11, opacity: .65 }}>APEX is thinking…</div>}
            <div ref={endRef} />
          </div>
          {error && <div role="alert" style={{ padding: "0 14px 9px", color: "#f3a79a", fontSize: 11 }}>{error}</div>}
          <form onSubmit={(event) => { event.preventDefault(); void sendMessage(); }} style={{ padding: 12, borderTop: "1px solid rgba(202,147,50,.22)", display: "flex", gap: 7 }}>
            <button type="button" onClick={toggleListening} aria-label={listening ? "Stop microphone" : "Start microphone"} style={{ ...buttonStyle, background: listening ? "rgba(190,70,60,.25)" : buttonStyle.background }}>{listening ? "■" : "🎙"}</button>
            <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask NEAS APEX…" aria-label="Message NEAS APEX" style={{
              minWidth: 0, flex: 1, borderRadius: 10, border: "1px solid rgba(255,255,255,.15)",
              background: "rgba(0,0,0,.25)", color: "white", padding: "10px 11px", outline: "none", fontSize: 12,
            }} />
            <button type="submit" disabled={busy || !input.trim()} style={{ ...buttonStyle, opacity: busy || !input.trim() ? .45 : 1 }}>Send</button>
          </form>
          <div style={{ padding: "0 13px 10px", fontSize: 9, opacity: .48 }}>Multilingual replies follow your language. Voice choice uses voices available on this device; first microphone use requires permission.</div>
        </section>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
        <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} style={{
          border: "1px solid #CA9332", borderRadius: 30, padding: "12px 17px",
          background: "#071D29", color: "#EBC07E", fontSize: 11, letterSpacing: ".12em",
          boxShadow: "0 5px 24px rgba(0,0,0,.4)", cursor: "pointer",
        }}>{open ? "CLOSE APEX AI" : "TALK TO APEX AI"}</button>
      </div>
    </div>
  );
}
