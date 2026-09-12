import React, { useMemo, useState } from "react";
import { Bot, BookOpen, Brain, ChevronRight, FileText, Lightbulb, MessageCircle, Send, Sparkles } from "lucide-react";

type Message = {
  id: number;
  role: "user" | "ai";
  text: string;
};

const suggestions = [
  "Generate notes for a topic",
  "Explain a difficult concept",
  "Create exam questions",
  "Summarize study material",
];

export default function EduSphereAI() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: "ai",
      text:
        "Hello Super Admin! I’m EduSphere AI. I can help you understand academic data, prepare reports, summarize content, and assist with EduSphere administration.",
    },
  ]);

  const quickActions = useMemo(
    () => [
      { icon: BookOpen, title: "Study Notes", text: "Create structured notes from a topic." },
      { icon: Brain, title: "Explain", text: "Break down a difficult concept simply." },
      { icon: FileText, title: "Summarize", text: "Turn long content into key points." },
      { icon: Lightbulb, title: "Ideas", text: "Get ideas for academic activities." },
    ],
    []
  );

  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const sendMessage = async () => {
    const value = input.trim();
    if (!value || sending) return;

    const userId = Date.now();
    const assistantId = userId + 1;

    setMessages((current) => [
      ...current,
      { id: userId, role: "user", text: value },
    ]);
    setInput("");
    setError("");
    setSending(true);

    try {
      const response = await fetch(`${API_BASE_URL}/ai/ask`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: value,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | {
            answer?: string;
            context_used?: boolean;
            ai_available?: boolean;
            detail?: unknown;
          }
        | null;

      if (!response.ok) {
        const detail =
          typeof data?.detail === "string"
            ? data.detail
            : typeof data?.detail === "object" &&
                data.detail !== null &&
                "answer" in data.detail
              ? String(
                  (
                    data.detail as {
                      answer?: unknown;
                    }
                  ).answer || "EduSphere AI is currently unavailable.",
                )
              : `Unable to reach EduSphere AI (HTTP ${response.status}).`;

        throw new Error(detail);
      }

      const answer =
        typeof data?.answer === "string" && data.answer.trim()
          ? data.answer
          : "EduSphere AI did not return an answer.";

      setMessages((current) => [
        ...current,
        {
          id: assistantId,
          role: "ai",
          text: answer,
        },
      ]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to connect to EduSphere AI.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.backgroundGlowOne} />
      <div style={styles.backgroundGlowTwo} />

      <header style={styles.header}>
        <div style={styles.brand}>
          <div style={styles.logoBox}>
            <img src="/edusphere-logo.jpeg" alt="EduSphere" style={styles.logo} />
          </div>
          <div>
            <div style={styles.brandName}>EduSphere</div>
            <div style={styles.brandSub}>ACADEMIC INTELLIGENCE PLATFORM</div>
          </div>
        </div>

        <div style={styles.aiBadge}>
          <Sparkles size={15} />
          <span>EduSphere AI</span>
          <span style={styles.onlineDot} />
          <span style={styles.onlineText}>Online</span>
        </div>
      </header>

      <main style={styles.main}>
        <section style={styles.hero}>
          <div style={styles.heroIcon}>
            <Bot size={28} />
          </div>
          <div>
            <p style={styles.eyebrow}>EDUSPHERE AI ASSISTANT</p>
            <h1 style={styles.title}>How can I help you today?</h1>
            <p style={styles.subtitle}>
              Your intelligent academic assistant for notes, explanations,
              summaries, questions, and EduSphere support.
            </p>
          </div>
        </section>

        <section style={styles.contentGrid}>
          <aside style={styles.sidebarCard}>
            <div style={styles.cardHeading}>
              <MessageCircle size={18} />
              <span>Quick actions</span>
            </div>

            <div style={styles.actionList}>
              {quickActions.map(({ icon: Icon, title, text }) => (
                <button
                  key={title}
                  type="button"
                  style={styles.actionButton}
                  onClick={() => setInput(text)}
                >
                  <span style={styles.actionIcon}>
                    <Icon size={17} />
                  </span>
                  <span style={styles.actionCopy}>
                    <strong>{title}</strong>
                    <small>{text}</small>
                  </span>
                  <ChevronRight size={16} style={{ opacity: 0.45 }} />
                </button>
              ))}
            </div>

            <div style={styles.tipCard}>
              <Sparkles size={17} />
              <div>
                <strong>Tip</strong>
                <p>Be specific about the subject, chapter, and topic for better study responses.</p>
              </div>
            </div>
          </aside>

          <section style={styles.chatCard}>
            <div style={styles.chatHeader}>
              <div style={styles.chatIdentity}>
                <div style={styles.botAvatar}>
                  <Bot size={21} />
                </div>
                <div style={{ display: "grid", gap: 3 }}>
                  <strong>EduSphere AI</strong>
                  <span style={{ color: "#64748b", fontSize: 11 }}>
                    EduSphere intelligent assistant
                  </span>
                </div>
              </div>
              <div style={styles.status}>
                <span style={styles.statusDot} />
                Ready
              </div>
            </div>

            <div style={styles.messages}>
              {messages.map((message) => (
                <div
                  key={message.id}
                  style={{
                    ...styles.messageRow,
                    justifyContent: message.role === "user" ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      ...styles.messageBubble,
                      ...(message.role === "user" ? styles.userBubble : styles.aiBubble),
                    }}
                  >
                    {message.role === "ai" && (
                      <div style={styles.messageLabel}>
                        <Bot size={13} /> EduSphere AI
                      </div>
                    )}
                    <div>{message.text}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={styles.suggestions}>
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  style={styles.suggestion}
                  onClick={() => setInput(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>

            <div style={styles.composer}>
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Ask EduSphere AI anything..."
                rows={2}
                style={styles.textarea}
              />
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={!input.trim() || sending}
                style={{
                  ...styles.sendButton,
                  opacity: input.trim() ? 1 : 0.45,
                }}
                aria-label="Send message"
              >
                {sending ? "…" : <Send size={18} />}
              </button>
            </div>

            {error ? (
              <div style={styles.errorBox} role="alert">
                {error}
              </div>
            ) : null}

            <p style={styles.disclaimer}>
              EduSphere AI can make mistakes. Verify important academic or administrative information.
            </p>
          </section>
        </section>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    position: "relative",
    overflow: "hidden",
    background: "#050817",
    color: "#eef2ff",
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  backgroundGlowOne: {
    position: "absolute",
    width: 420,
    height: 420,
    borderRadius: "50%",
    background: "rgba(80, 70, 220, 0.12)",
    filter: "blur(80px)",
    top: -170,
    right: -100,
    pointerEvents: "none",
  },
  backgroundGlowTwo: {
    position: "absolute",
    width: 360,
    height: 360,
    borderRadius: "50%",
    background: "rgba(30, 120, 255, 0.08)",
    filter: "blur(90px)",
    bottom: -160,
    left: -120,
    pointerEvents: "none",
  },
  header: {
    position: "relative",
    zIndex: 2,
    height: 74,
    padding: "0 32px",
    borderBottom: "1px solid rgba(148, 163, 184, 0.12)",
    background: "rgba(5, 8, 23, 0.88)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { display: "flex", alignItems: "center", gap: 12 },
  logoBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    overflow: "hidden",
    border: "1px solid rgba(129, 140, 248, 0.35)",
    flexShrink: 0,
  },
  logo: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  brandName: { fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" },
  brandSub: { fontSize: 9, letterSpacing: "0.14em", color: "#818cf8", marginTop: 2 },
  aiBadge: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(99, 102, 241, 0.1)",
    border: "1px solid rgba(129, 140, 248, 0.24)",
    color: "#c7d2fe",
    fontSize: 12,
    fontWeight: 700,
  },
  onlineDot: { width: 7, height: 7, borderRadius: "50%", background: "#34d399" },
  onlineText: { color: "#86efac", fontWeight: 600 },
  main: {
    position: "relative",
    zIndex: 1,
    maxWidth: 1320,
    margin: "0 auto",
    padding: "42px 32px 56px",
  },
  hero: { display: "flex", alignItems: "center", gap: 18, marginBottom: 30 },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    display: "grid",
    placeItems: "center",
    background: "linear-gradient(135deg, rgba(99,102,241,.28), rgba(59,130,246,.18))",
    border: "1px solid rgba(129,140,248,.28)",
    boxShadow: "0 15px 45px rgba(79,70,229,.18)",
    color: "#a5b4fc",
    flexShrink: 0,
  },
  eyebrow: { margin: 0, color: "#818cf8", fontSize: 11, fontWeight: 800, letterSpacing: "0.15em" },
  title: { margin: "5px 0 6px", fontSize: 32, lineHeight: 1.1, letterSpacing: "-0.035em" },
  subtitle: { margin: 0, color: "#94a3b8", fontSize: 14, lineHeight: 1.6, maxWidth: 760 },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "310px minmax(0, 1fr)",
    gap: 20,
    alignItems: "stretch",
  },
  sidebarCard: {
    border: "1px solid rgba(148,163,184,.13)",
    borderRadius: 20,
    background: "rgba(15, 23, 42, .72)",
    padding: 18,
  },
  cardHeading: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: 800,
    marginBottom: 14,
  },
  actionList: { display: "grid", gap: 8 },
  actionButton: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 10,
    textAlign: "left",
    border: "1px solid rgba(148,163,184,.09)",
    borderRadius: 14,
    background: "rgba(30,41,59,.45)",
    color: "#e2e8f0",
    padding: 11,
    cursor: "pointer",
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    display: "grid",
    placeItems: "center",
    background: "rgba(99,102,241,.13)",
    color: "#a5b4fc",
    flexShrink: 0,
  },
  actionCopy: { display: "grid", gap: 3, flex: 1 },
  actionCopyStrong: {},
  tipCard: {
    marginTop: 18,
    display: "flex",
    gap: 9,
    padding: 13,
    borderRadius: 14,
    background: "rgba(59,130,246,.07)",
    border: "1px solid rgba(96,165,250,.12)",
    color: "#93c5fd",
  },
  chatCard: {
    minHeight: 590,
    display: "flex",
    flexDirection: "column",
    border: "1px solid rgba(148,163,184,.14)",
    borderRadius: 22,
    background: "rgba(9, 14, 31, .84)",
    boxShadow: "0 25px 80px rgba(0,0,0,.28)",
    overflow: "hidden",
  },
  chatHeader: {
    padding: "15px 18px",
    borderBottom: "1px solid rgba(148,163,184,.1)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chatIdentity: { display: "flex", alignItems: "center", gap: 10 },
  botAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    display: "grid",
    placeItems: "center",
    background: "rgba(99,102,241,.16)",
    color: "#a5b4fc",
  },
  status: { display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#94a3b8" },
  statusDot: { width: 7, height: 7, borderRadius: "50%", background: "#34d399" },
  messages: { flex: 1, padding: 22, overflowY: "auto" },
  messageRow: { display: "flex", marginBottom: 13 },
  messageBubble: {
    maxWidth: "78%",
    padding: "12px 14px",
    borderRadius: 16,
    fontSize: 13,
    lineHeight: 1.6,
  },
  aiBubble: {
    background: "rgba(30,41,59,.72)",
    border: "1px solid rgba(148,163,184,.1)",
    color: "#dbe4f0",
    borderTopLeftRadius: 5,
  },
  userBubble: {
    background: "linear-gradient(135deg, #4f46e5, #2563eb)",
    color: "#fff",
    borderTopRightRadius: 5,
  },
  messageLabel: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    color: "#a5b4fc",
    fontSize: 10,
    fontWeight: 800,
    marginBottom: 5,
  },
  suggestions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 7,
    padding: "0 18px 13px",
  },
  suggestion: {
    border: "1px solid rgba(129,140,248,.2)",
    background: "rgba(99,102,241,.07)",
    color: "#a5b4fc",
    borderRadius: 999,
    padding: "7px 10px",
    fontSize: 11,
    cursor: "pointer",
  },
  composer: {
    margin: "0 18px",
    border: "1px solid rgba(129,140,248,.22)",
    background: "rgba(15,23,42,.72)",
    borderRadius: 15,
    padding: 8,
    display: "flex",
    gap: 8,
    alignItems: "flex-end",
  },
  textarea: {
    flex: 1,
    resize: "none",
    border: 0,
    outline: 0,
    background: "transparent",
    color: "#e2e8f0",
    fontSize: 13,
    lineHeight: 1.5,
    padding: "7px 8px",
    fontFamily: "inherit",
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: 0,
    background: "linear-gradient(135deg, #6366f1, #3b82f6)",
    color: "#fff",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    flexShrink: 0,
  },
  errorBox: {
    margin: "8px 18px 0",
    padding: "9px 11px",
    borderRadius: 10,
    color: "#fda4af",
    background: "rgba(244,63,94,.07)",
    border: "1px solid rgba(244,63,94,.14)",
    fontSize: 11,
    lineHeight: 1.5,
  },
  disclaimer: {
    margin: "9px 18px 14px",
    textAlign: "center",
    color: "#64748b",
    fontSize: 10,
  },
};

