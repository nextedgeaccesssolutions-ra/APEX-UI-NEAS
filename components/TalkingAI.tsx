"use client";

import { useEffect, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };
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
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "NEAS APEX is ready. Ask about rope access, renewables, offshore operations, HSEQ, training or business development." },
  ]);
  const endRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, open]);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, []);

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
    recognition.lang = "en-US";
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
          <div aria-live="polite" style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 11 }}>
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
          <div style={{ padding: "0 13px 10px", fontSize: 9, opacity: .48 }}>Voice input uses your browser microphone. Spoken replies use browser speech synthesis.</div>
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
