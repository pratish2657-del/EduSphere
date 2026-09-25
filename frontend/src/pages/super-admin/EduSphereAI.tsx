import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, BookOpen, Brain, ChevronRight, FileText, Lightbulb, MessageCircle, Send, Sparkles } from "lucide-react";

type Message = {
  id: number | string;
  role: "user" | "ai";
  text: string;
};

type ConversationMessage = {
  id?: number | string;
  role?: "user" | "assistant" | "ai";
  content?: string;
  message?: string;
  text?: string;
};

type ConversationResponse = {
  conversation_id?: number | string | null;
  messages?: ConversationMessage[];
};

type AskResponse = {
  answer?: string;
  context_used?: boolean;
  ai_available?: boolean;
  conversation_id?: number | string | null;
  detail?: unknown;
};

const suggestions = [
  "Generate notes for a topic",
  "Explain a difficult concept",
  "Create exam questions",
  "Summarize study material",
];


/* =========================================================
   MARKDOWN MESSAGE RENDERER
   Gemini can return Markdown. Render common Markdown here
   instead of displaying symbols such as **, *, # and $.
========================================================= */

const renderInlineMarkdown = (value: string): React.ReactNode[] => {
  const tokens =
    /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|~~[^~]+~~|\$[^$\n]+\$)/g;

  const parts = value.split(tokens);

  return parts.map((part, index) => {
    if (!part) return null;

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="edusphere-ai-inline-code"
          style={markdownStyles.inlineCode}
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    if (
      (part.startsWith("**") && part.endsWith("**")) ||
      (part.startsWith("__") && part.endsWith("__"))
    ) {
      return (
        <strong key={index} style={markdownStyles.strong}>
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (
      (part.startsWith("*") && part.endsWith("*")) ||
      (part.startsWith("_") && part.endsWith("_"))
    ) {
      return (
        <em key={index} style={markdownStyles.em}>
          {part.slice(1, -1)}
        </em>
      );
    }

    if (part.startsWith("~~") && part.endsWith("~~")) {
      return (
        <del key={index} style={markdownStyles.del}>
          {part.slice(2, -2)}
        </del>
      );
    }

    if (part.startsWith("$") && part.endsWith("$")) {
      return (
        <span key={index} style={markdownStyles.mathInline}>
          {part.slice(1, -1)}
        </span>
      );
    }

    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
};

const MarkdownMessage = ({ content }: { content: string }) => {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];

  let codeLines: string[] | null = null;

  const flushCode = () => {
    if (codeLines === null) return;

    blocks.push(
      <pre key={`code-${blocks.length}`} style={markdownStyles.codeBlock}>
        <code>
          {codeLines.join("\n")}
        </code>
      </pre>
    );

    codeLines = null;
  };

  lines.forEach((line, index) => {
    const fence = line.trim().match(/^```(.*)$/);

    if (fence) {
      if (codeLines === null) {
        codeLines = [];
      } else {
        flushCode();
      }
      return;
    }

    if (codeLines !== null) {
      codeLines.push(line);
      return;
    }

    const trimmed = line.trim();

    if (!trimmed) {
      blocks.push(<div key={`space-${index}`} style={{ height: 7 }} />);
      return;
    }

    if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
      blocks.push(
        <hr key={`hr-${index}`} style={markdownStyles.hr} />
      );
      return;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      blocks.push(
        <div
          key={`heading-${index}`}
          style={{
            ...markdownStyles.heading,
            fontSize: level === 1 ? 20 : level === 2 ? 17 : 15,
          }}
        >
          {renderInlineMarkdown(heading[2])}
        </div>
      );
      return;
    }

    const bullet = trimmed.match(/^[-*+]\s+(.+)$/);
    if (bullet) {
      blocks.push(
        <div key={`bullet-${index}`} style={markdownStyles.listRow}>
          <span style={markdownStyles.bullet}>•</span>
          <span>{renderInlineMarkdown(bullet[1])}</span>
        </div>
      );
      return;
    }

    const numbered = trimmed.match(/^(\d+)[.)]\s+(.+)$/);
    if (numbered) {
      blocks.push(
        <div key={`number-${index}`} style={markdownStyles.listRow}>
          <span style={markdownStyles.number}>{numbered[1]}.</span>
          <span>{renderInlineMarkdown(numbered[2])}</span>
        </div>
      );
      return;
    }

    if (trimmed.startsWith(">")) {
      blocks.push(
        <div key={`quote-${index}`} style={markdownStyles.quote}>
          {renderInlineMarkdown(trimmed.replace(/^>\s?/, ""))}
        </div>
      );
      return;
    }

    blocks.push(
      <div key={`paragraph-${index}`} style={markdownStyles.paragraph}>
        {renderInlineMarkdown(line)}
      </div>
    );
  });

  flushCode();

  return <div className="edusphere-ai-markdown">{blocks}</div>;
};

const markdownStyles: Record<string, React.CSSProperties> = {
  paragraph: {
    margin: 0,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
  heading: {
    margin: "10px 0 5px",
    fontWeight: 800,
    lineHeight: 1.25,
    color: "#f8fafc",
  },
  strong: {
    fontWeight: 800,
    color: "#ffffff",
  },
  em: {
    fontStyle: "italic",
  },
  del: {
    opacity: 0.75,
  },
  inlineCode: {
    display: "inline",
    padding: "2px 5px",
    borderRadius: 5,
    background: "rgba(15,23,42,.9)",
    border: "1px solid rgba(148,163,184,.18)",
    color: "#c4b5fd",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: "0.92em",
  },
  codeBlock: {
    margin: "8px 0",
    padding: "12px",
    borderRadius: 10,
    background: "#080d1c",
    border: "1px solid rgba(148,163,184,.16)",
    overflowX: "auto",
    whiteSpace: "pre",
    fontSize: 12,
    lineHeight: 1.55,
    color: "#dbeafe",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
  listRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 7,
    margin: "3px 0",
    overflowWrap: "anywhere",
  },
  bullet: {
    flex: "0 0 auto",
    color: "#a5b4fc",
    fontWeight: 800,
  },
  number: {
    flex: "0 0 auto",
    minWidth: 20,
    color: "#a5b4fc",
    fontWeight: 700,
  },
  quote: {
    margin: "7px 0",
    padding: "7px 10px",
    borderLeft: "3px solid #6366f1",
    background: "rgba(99,102,241,.08)",
    color: "#cbd5e1",
    borderRadius: "0 7px 7px 0",
  },
  hr: {
    border: 0,
    borderTop: "1px solid rgba(148,163,184,.16)",
    margin: "10px 0",
  },
  mathInline: {
    padding: "0 2px",
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontStyle: "italic",
    color: "#ddd6fe",
  },
};

export default function EduSphereAI() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<number | string | null>(null);

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

  const loadConversation = useCallback(async () => {
    try {
      setError("");

      const response = await fetch(`${API_BASE_URL}/ai/conversation`, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      const data = (await response.json().catch(() => null)) as
        | ConversationResponse
        | { detail?: unknown }
        | null;

      if (!response.ok) {
        throw new Error(
          typeof data === "object" &&
          data !== null &&
          "detail" in data &&
          typeof data.detail === "string"
            ? data.detail
            : `Unable to load EduSphere AI conversation (HTTP ${response.status}).`
        );
      }

      const conversation = data as ConversationResponse;

      setConversationId(conversation.conversation_id ?? null);

      const loadedMessages = (conversation.messages ?? [])
        .map((item, index): Message | null => {
          const role =
            item.role === "user"
              ? "user"
              : item.role === "assistant" || item.role === "ai"
                ? "ai"
                : null;

          const content =
            typeof item.content === "string"
              ? item.content
              : typeof item.message === "string"
                ? item.message
                : typeof item.text === "string"
                  ? item.text
                  : "";

          if (!role || !content.trim()) return null;

          return {
            id: item.id ?? `history-${index}`,
            role,
            text: content,
          };
        })
        .filter((item): item is Message => item !== null);

      setMessages(loadedMessages);
    } catch (requestError) {
      setMessages([]);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load EduSphere AI conversation."
      );
    }
  }, []);

  useEffect(() => {
    void loadConversation();
  }, [loadConversation]);

  const clearConversation = async () => {
    try {
      setError("");

      const response = await fetch(`${API_BASE_URL}/ai/conversation`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      const data = (await response.json().catch(() => null)) as
        | { detail?: unknown }
        | null;

      if (!response.ok) {
        throw new Error(
          typeof data?.detail === "string"
            ? data.detail
            : `Unable to clear EduSphere AI conversation (HTTP ${response.status}).`
        );
      }

      setConversationId(null);
      setMessages([]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to clear EduSphere AI conversation."
      );
    }
  };

  const sendMessage = async () => {
    const value = input.trim();
    if (!value || sending) return;

    const userId = `user-${Date.now()}`;
    const assistantId = `assistant-${Date.now()}`;

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
          ...(conversationId != null
            ? { conversation_id: conversationId }
            : {}),
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | AskResponse
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

      if (data?.conversation_id != null) {
        setConversationId(data.conversation_id);
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
    <div className="edusphere-ai-page" style={styles.page}>
      <div style={styles.backgroundGlowOne} />
      <div style={styles.backgroundGlowTwo} />

      <header className="edusphere-ai-header" style={styles.header}>
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

      <main className="edusphere-ai-main" style={styles.main}>
        <section className="edusphere-ai-hero" style={styles.hero}>
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

        <section className="edusphere-ai-content-grid" style={styles.contentGrid}>
          <aside className="edusphere-ai-sidebar-card" style={styles.sidebarCard}>
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

          <section className="edusphere-ai-chat-card" style={styles.chatCard}>
            <div className="edusphere-ai-chat-header" style={styles.chatHeader}>
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
              <div style={styles.headerActions}>
                <button
                  type="button"
                  onClick={() => void clearConversation()}
                  style={styles.clearButton}
                  disabled={sending}
                >
                  New chat
                </button>
                <div style={styles.status}>
                  <span style={styles.statusDot} />
                  Ready
                </div>
              </div>
            </div>

            <div className="edusphere-ai-messages" style={styles.messages}>
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
                    <MarkdownMessage content={message.text} />
                  </div>
                </div>
              ))}
            </div>

            <div className="edusphere-ai-suggestions" style={styles.suggestions}>
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

            <div className="edusphere-ai-composer" style={styles.composer}>
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

/* =========================================================
   RESPONSIVE MOBILE / TABLET
========================================================= */

if (typeof document !== "undefined") {
  const styleId = "edusphere-ai-page-responsive";

  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .edusphere-ai-page,
      .edusphere-ai-page * {
        box-sizing: border-box;
        min-width: 0;
      }

      .edusphere-ai-page {
        width: 100%;
        max-width: 100vw;
        overflow-x: hidden;
      }

      .edusphere-ai-content-grid {
        width: 100%;
      }

      .edusphere-ai-chat-card,
      .edusphere-ai-sidebar-card {
        min-width: 0;
        max-width: 100%;
      }

      .edusphere-ai-chat-card {
        overflow: hidden;
      }

      .edusphere-ai-messages {
        min-width: 0;
        overflow-x: hidden;
        overflow-y: auto;
      }

      .edusphere-ai-message-row {
        min-width: 0;
      }

      @media (max-width: 900px) {
        .edusphere-ai-header {
          height: auto !important;
          min-height: 74px !important;
          padding: 12px 20px !important;
          gap: 10px !important;
          flex-wrap: wrap !important;
        }

        .edusphere-ai-main {
          padding: 28px 20px 40px !important;
        }

        .edusphere-ai-content-grid {
          grid-template-columns: minmax(0, 1fr) !important;
          gap: 16px !important;
        }

        .edusphere-ai-chat-card {
          order: -1;
          min-height: 520px !important;
        }

        .edusphere-ai-sidebar-card {
          width: 100%;
        }

        .edusphere-ai-chat-header {
          gap: 10px !important;
          flex-wrap: wrap !important;
          align-items: flex-start !important;
        }

        .edusphere-ai-header > * {
          max-width: 100%;
        }

        .edusphere-ai-suggestions {
          max-width: 100%;
        }
      }

      @media (max-width: 600px) {
        .edusphere-ai-header {
          padding: 10px 14px !important;
        }

        .edusphere-ai-main {
          padding: 22px 12px 30px !important;
        }

        .edusphere-ai-hero {
          align-items: flex-start !important;
          gap: 12px !important;
          margin-bottom: 20px !important;
        }

        .edusphere-ai-hero h1 {
          font-size: 27px !important;
          line-height: 1.12 !important;
        }

        .edusphere-ai-hero p {
          max-width: 100% !important;
        }

        .edusphere-ai-chat-card {
          min-height: 500px !important;
          border-radius: 16px !important;
        }

        .edusphere-ai-chat-header {
          padding: 12px 13px !important;
        }

        .edusphere-ai-chat-header .edusphere-ai-status {
          display: none;
        }

        .edusphere-ai-messages {
          min-height: 190px !important;
          padding: 14px !important;
        }

        .edusphere-ai-suggestions {
          padding: 0 13px 10px !important;
          gap: 6px !important;
        }

        .edusphere-ai-suggestions button {
          max-width: 100%;
          font-size: 10px !important;
          padding: 6px 8px !important;
        }

        .edusphere-ai-composer {
          margin: 0 12px !important;
          padding: 6px !important;
        }

        .edusphere-ai-composer textarea {
          font-size: 16px !important;
          min-width: 0 !important;
        }

        .edusphere-ai-composer button {
          width: 38px !important;
          height: 38px !important;
        }

        .edusphere-ai-sidebar-card {
          padding: 14px !important;
          border-radius: 16px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }
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
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  clearButton: {
    border: "1px solid rgba(129,140,248,.2)",
    background: "rgba(99,102,241,.06)",
    color: "#a5b4fc",
    borderRadius: 9,
    padding: "6px 9px",
    fontSize: 10,
    fontWeight: 700,
    cursor: "pointer",
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
    overflowWrap: "anywhere",
    wordBreak: "break-word",
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

