import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import type { FormEvent } from "react";
import {
  Bot,
  ChevronDown,
  Loader2,
  MessageCircle,
  Send,
  Sparkles,
  X,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

type AIResponse = {
  answer: string;
  course_id: number | null;
  context_used: boolean;
  ai_available: boolean;
};

type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  contextUsed?: boolean;
};

/* =========================================================
   ROLE-BASED STARTER PROMPTS
========================================================= */

const STARTER_PROMPTS = {
  STUDENT: [
    "What should I focus on in my current semester?",
    "Help me understand my academic progress.",
    "Which subjects should I prioritize?",
    "How can I improve my attendance?",
    "Explain a topic from my courses.",
    "Help me prepare for my upcoming exams.",
    "What should I study today?",
    "Give me a quick revision plan.",
    "Help me understand my results.",
    "Which course should I focus on more?",
    "Create a study plan for me.",
    "What can I do to improve my academic performance?",
  ],

  PROFESSOR: [
    "Give me an overview of my current courses.",
    "Which students may need academic attention?",
    "Help me analyze my students' attendance.",
    "How can I improve student performance?",
    "Help me plan my upcoming classes.",
    "Summarize my academic workload.",
    "Suggest ways to support struggling students.",
    "Help me analyze my students' results.",
    "Which students have low attendance?",
    "Give me insights about my courses.",
    "Help me prepare for my next class.",
    "What academic areas need my attention?",
  ],

  DEVELOPER: [
    "Give me an overview of my developer workspace.",

    "What should I focus on in the current development environment?",

    "Help me review the health of the EduSphere system.",

    "Check the backend API and explain its current status.",

    "Help me understand the frontend application structure.",

    "Give me an overview of the data layer.",

    "Help me identify technical areas that need attention.",

    "Show me the latest developer activity and explain it.",

    "Help me review system logs.",

    "What development tasks should I prioritize today?",

    "Help me troubleshoot an EduSphere technical issue.",

    "Give me a summary of the current system connectivity.",

    "Help me understand the available developer tools.",

    "What should I check before deploying a new feature?",

    "Help me plan a new EduSphere feature.",

    "Review the technical architecture of EduSphere.",

    "Help me identify possible API or backend issues.",

    "What security considerations should I review as a developer?",
  ],

  ADMIN: [
    "Give me an overview of the institution.",
    "What academic areas need attention?",
    "Help me analyze student performance.",
    "How is overall attendance looking?",
    "Which courses or departments need attention?",
    "Give me important administrative insights.",
    "Help me identify academic trends.",
    "What should I prioritize today?",
    "Give me an overview of student activity.",
    "Which academic areas are performing poorly?",
    "Help me understand institutional performance.",
    "What should I review as an administrator?",
  ],

  SUPER_ADMIN: [
    "Give me an overview of the entire platform.",
    "What are the most important platform insights?",
    "Help me analyze institutional performance.",
    "What should I prioritize as a super admin?",
    "Give me an overview of users and activity.",
    "What academic trends should I watch?",
    "Help me identify areas needing attention.",
    "Give me a platform health summary.",
    "What are the most important system-level insights?",
    "Help me analyze overall academic performance.",
    "Which institutions or areas need attention?",
    "What should I review today?",
  ],
};

/* =========================================================
   NORMALIZE ROLE
========================================================= */

const normalizeRole = (role: string): string => {
  const value = role
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  if (
    value === "SUPERADMIN" ||
    value === "SUPER_ADMIN"
  ) {
    return "SUPER_ADMIN";
  }

  if (
    value === "PROFESSOR" ||
    value === "TEACHER" ||
    value === "FACULTY"
  ) {
    return "PROFESSOR";
  }

  if (
    value === "ADMIN" ||
    value === "ADMINISTRATOR"
  ) {
    return "ADMIN";
  }

  if (value === "DEVELOPER") {
    return "DEVELOPER";
  }

  if (value === "STUDENT") {
    return "STUDENT";
  }

  return "STUDENT";
};

/* =========================================================
   RANDOM PROMPTS
========================================================= */

const getRandomPrompts = (role: string): string[] => {
  const normalizedRole = normalizeRole(role);

  const prompts =
    STARTER_PROMPTS[
      normalizedRole as keyof typeof STARTER_PROMPTS
    ] || STARTER_PROMPTS.STUDENT;

  return [...prompts]
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
};


/* =========================================================
   MARKDOWN / BASIC MATH RENDERER

   Gemini returns Markdown such as **bold**, *italic*, headings,
   lists, code fences and $math$. React renders strings literally,
   so we parse the common Markdown formats here instead of showing
   the Markdown symbols to the user.
========================================================= */

const renderInlineMarkdown = (
  value: string,
  keyPrefix = "inline",
): ReactNode[] => {
  const tokenPattern =
    /(`[^`\n]+`|\$\$[^$]*\$\$|\$[^$\n]+\$|\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|\*[^*\n]+\*|_[^_\n]+_)/g;

  const parts = value.split(tokenPattern);

  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`;

    if (!part) return null;

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={key} className="edusphere-ai-inline-code">
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith("$$") && part.endsWith("$$")) {
      return (
        <span key={key} className="edusphere-ai-math">
          {part.slice(2, -2).trim()}
        </span>
      );
    }

    if (part.startsWith("$") && part.endsWith("$")) {
      return (
        <span key={key} className="edusphere-ai-inline-math">
          {part.slice(1, -1).trim()}
        </span>
      );
    }

    if (
      (part.startsWith("**") && part.endsWith("**")) ||
      (part.startsWith("__") && part.endsWith("__"))
    ) {
      return (
        <strong key={key}>
          {renderInlineMarkdown(part.slice(2, -2), `${key}-bold`)}
        </strong>
      );
    }

    if (part.startsWith("~~") && part.endsWith("~~")) {
      return (
        <del key={key}>
          {renderInlineMarkdown(part.slice(2, -2), `${key}-strike`)}
        </del>
      );
    }

    if (
      (part.startsWith("*") && part.endsWith("*")) ||
      (part.startsWith("_") && part.endsWith("_"))
    ) {
      return (
        <em key={key}>
          {renderInlineMarkdown(part.slice(1, -1), `${key}-italic`)}
        </em>
      );
    }

    return <span key={key}>{part}</span>;
  });
};

const renderMarkdown = (markdown: string): ReactNode => {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const output: ReactNode[] = [];

  let codeLines: string[] = [];
  let codeLanguage = "";
  let inCodeBlock = false;
  let listItems: { type: "ul" | "ol"; text: string }[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;

    const groups: {
      type: "ul" | "ol";
      items: string[];
    }[] = [];

    for (const item of listItems) {
      const last = groups[groups.length - 1];

      if (last && last.type === item.type) {
        last.items.push(item.text);
      } else {
        groups.push({
          type: item.type,
          items: [item.text],
        });
      }
    }

    groups.forEach((group, groupIndex) => {
      const Tag = group.type;

      output.push(
        <Tag
          key={`list-${output.length}-${groupIndex}`}
          className="edusphere-ai-markdown-list"
        >
          {group.items.map((item, itemIndex) => (
            <li key={`item-${itemIndex}`}>
              {renderInlineMarkdown(
                item,
                `list-${output.length}-${groupIndex}-${itemIndex}`,
              )}
            </li>
          ))}
        </Tag>,
      );
    });

    listItems = [];
  };

  const flushCode = () => {
    if (!inCodeBlock) return;

    output.push(
      <div
        key={`code-${output.length}`}
        className="edusphere-ai-code-block"
      >
        {codeLanguage && (
          <div className="edusphere-ai-code-language">
            {codeLanguage}
          </div>
        )}
        <pre>
          <code>{codeLines.join("\n")}</code>
        </pre>
      </div>,
    );

    codeLines = [];
    codeLanguage = "";
    inCodeBlock = false;
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Fenced code block.
    if (trimmed.startsWith("```")) {
      flushList();

      if (inCodeBlock) {
        flushCode();
      } else {
        inCodeBlock = true;
        codeLanguage = trimmed.slice(3).trim();
      }

      return;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      return;
    }

    // Blank line.
    if (!trimmed) {
      flushList();

      output.push(
        <div
          key={`space-${index}`}
          className="edusphere-ai-markdown-spacer"
        />,
      );
      return;
    }

    // Headings.
    const headingMatch = line.match(/^\s*(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushList();

      const level = Math.min(headingMatch[1].length, 6);
      const headingText = headingMatch[2];

      const HeadingTag = `h${level}` as
        | "h1"
        | "h2"
        | "h3"
        | "h4"
        | "h5"
        | "h6";

      output.push(
        <HeadingTag
          key={`heading-${index}`}
          className={`edusphere-ai-markdown-h${level}`}
        >
          {renderInlineMarkdown(headingText, `heading-${index}`)}
        </HeadingTag>,
      );
      return;
    }

    // Horizontal rule.
    if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) {
      flushList();
      output.push(
        <hr
          key={`rule-${index}`}
          className="edusphere-ai-markdown-rule"
        />,
      );
      return;
    }

    // Unordered list.
    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    if (unordered) {
      listItems.push({
        type: "ul",
        text: unordered[1],
      });
      return;
    }

    // Ordered list.
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (ordered) {
      listItems.push({
        type: "ol",
        text: ordered[1],
      });
      return;
    }

    // Blockquote.
    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) {
      flushList();

      output.push(
        <blockquote
          key={`quote-${index}`}
          className="edusphere-ai-markdown-quote"
        >
          {renderInlineMarkdown(quote[1], `quote-${index}`)}
        </blockquote>,
      );
      return;
    }

    // Normal paragraph.
    flushList();

    output.push(
      <p
        key={`paragraph-${index}`}
        className="edusphere-ai-markdown-paragraph"
      >
        {renderInlineMarkdown(line, `paragraph-${index}`)}
      </p>,
    );
  });

  flushList();

  if (inCodeBlock) {
    flushCode();
  }

  return <>{output}</>;
};

/* =========================================================
   AI CHATBOT
========================================================= */

export default function AIChatbot() {
  const { user } = useAuth();

  /*
   * IMPORTANT:
   * The role comes directly from useAuth().
   */
  const userRole = normalizeRole(
    user?.role || "STUDENT"
  );

  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(
    []
  );
  const [minimized, setMinimized] = useState(false);

  const [starterPrompts, setStarterPrompts] = useState<
    string[]
  >(() => getRandomPrompts(userRole));

  const messageId = useRef(0);

  const messagesEndRef =
    useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const openAssistant = () => {
      setOpen(true);
      setMinimized(false);
      if (messages.length === 0) setStarterPrompts(getRandomPrompts(userRole));
    };
    window.addEventListener("edusphere-open-ai", openAssistant);
    return () => window.removeEventListener("edusphere-open-ai", openAssistant);
  }, [messages.length, userRole]);

  /* =======================================================
     UPDATE PROMPTS WHEN USER ROLE CHANGES
  ======================================================= */

  useEffect(() => {
    if (messages.length === 0) {
      setStarterPrompts(
        getRandomPrompts(userRole)
      );
    }
  }, [userRole, messages.length]);

  /* =======================================================
     GENERATE RANDOM PROMPTS WHEN CHAT OPENS
  ======================================================= */

  useEffect(() => {
    if (open && messages.length === 0) {
      setStarterPrompts(
        getRandomPrompts(userRole)
      );
    }
  }, [open, userRole, messages.length]);

  /* =======================================================
     AUTO SCROLL
  ======================================================= */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, sending]);

  /* =======================================================
     ASK AI
  ======================================================= */

  const askAI = async (text: string) => {
    const trimmed = text.trim();

    if (!trimmed || sending) return;

    const userMessage: ChatMessage = {
      id: ++messageId.current,
      role: "user",
      content: trimmed,
    };

    setMessages((current) => [
      ...current,
      userMessage,
    ]);

    setMessage("");
    setError("");
    setSending(true);
    setMinimized(false);

    try {
      const response = await fetch(
        `${API_BASE_URL}/ai/ask`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: trimmed,
          }),
        }
      );

      const data = (await response
        .json()
        .catch(() => null)) as
        | AIResponse
        | { detail?: unknown }
        | null;

      if (!response.ok) {
        const errorData = data as {
          detail?: unknown;
        } | null;

        const detail =
          typeof errorData?.detail === "string"
            ? errorData.detail
            : typeof errorData?.detail ===
                  "object" &&
                errorData.detail !== null &&
                "answer" in errorData.detail
              ? String(
                  (
                    errorData.detail as {
                      answer?: unknown;
                    }
                  ).answer ||
                    "EduSphere AI is currently unavailable."
                )
              : "Unable to reach EduSphere AI.";

        throw new Error(detail);
      }

      const result = data as AIResponse;

      setMessages((current) => [
        ...current,
        {
          id: ++messageId.current,
          role: "assistant",
          content:
            result.answer ||
            "EduSphere AI did not return an answer.",
          contextUsed: result.context_used,
        },
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to EduSphere AI."
      );
    } finally {
      setSending(false);
    }
  };

  /* =======================================================
     FORM SUBMIT
  ======================================================= */

  const handleSubmit = (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    void askAI(message);
  };

  /* =======================================================
     CLEAR CONVERSATION
  ======================================================= */

  const clearConversation = () => {
    setMessages([]);
    setError("");
    setMessage("");

    setStarterPrompts(
      getRandomPrompts(userRole)
    );
  };

  /* =======================================================
     ROLE DISPLAY
  ======================================================= */

  const roleLabel =
    userRole === "SUPER_ADMIN"
      ? "Super Admin Assistant"
      : userRole === "PROFESSOR"
        ? "Professor Assistant"
        : userRole === "ADMIN"
          ? "Admin Assistant"
            : userRole === "DEVELOPER"
              ? "Developer Assistant"
                : "Student Assistant";

  /* =======================================================
     UI
  ======================================================= */

  const chatbotUI = (
    <>
      {/* =================================================
          FLOATING AI BUTTON
      ================================================= */}

      {!open && (
        <button
          type="button"
          aria-label="Open EduSphere AI"
          onClick={() => {
            setOpen(true);

            if (messages.length === 0) {
              setStarterPrompts(
                getRandomPrompts(userRole)
              );
            }
          }}
          className="edusphere-ai-floating-button"
          style={styles.floatingButton}
        >
          <span style={styles.floatingPulse} />

          <Bot size={22} />

          <span style={styles.floatingLabel}>
            AI
          </span>
        </button>
      )}

      {/* =================================================
          CHAT WINDOW
      ================================================= */}

      {open && (
        <section
          aria-label="EduSphere AI Assistant"
          className="edusphere-ai-chat-window"
          style={{
            ...styles.chatWindow,
            ...(minimized
              ? styles.chatWindowMinimized
              : {}),
          }}
        >
          {/* =================================================
              HEADER
          ================================================= */}

          <header style={styles.header}>
            <div style={styles.headerIdentity}>
              <div style={styles.botOrb}>
                <Sparkles size={18} />
              </div>

              <div>
                <div style={styles.titleRow}>
                  <strong style={styles.title}>
                    EduSphere AI
                  </strong>

                  <span style={styles.liveBadge}>
                    ONLINE
                  </span>
                </div>

                <span style={styles.subtitle}>
                  Academic intelligence assistant
                </span>
              </div>
            </div>

            <div style={styles.headerActions}>
              <button
                type="button"
                aria-label={
                  minimized
                    ? "Expand AI"
                    : "Minimize AI"
                }
                onClick={() =>
                  setMinimized(
                    (value) => !value
                  )
                }
                style={styles.iconButton}
              >
                <ChevronDown
                  size={17}
                  style={{
                    transform: minimized
                      ? "rotate(180deg)"
                      : "none",
                  }}
                />
              </button>

              <button
                type="button"
                aria-label="Close AI"
                onClick={() => setOpen(false)}
                style={styles.iconButton}
              >
                <X size={17} />
              </button>
            </div>
          </header>

          {/* =================================================
              MAIN CONTENT
          ================================================= */}

          {!minimized && (
            <>
              <div style={styles.body}>
                {messages.length === 0 ? (
                  <div style={styles.emptyState}>
                    <div style={styles.emptyOrb}>
                      <MessageCircle size={23} />
                    </div>

                    <h3 style={styles.emptyTitle}>
                      How can I help with your
                      academics?
                    </h3>

                    <p style={styles.emptyText}>
                      Ask about your EduSphere
                      academic context, courses,
                      results, timetable,
                      attendance, or a concept
                      you are studying.
                    </p>

                    {/* ROLE */}

                    <div style={styles.roleBadge}>
                      <Sparkles size={10} />

                      {roleLabel}
                    </div>

                    {/* RANDOM PROMPTS */}

                    <div style={styles.starterList}>
                      {starterPrompts.map(
                        (prompt) => (
                          <button
                            key={prompt}
                            type="button"
                            onClick={() =>
                              void askAI(prompt)
                            }
                            style={
                              styles.starterButton
                            }
                            disabled={sending}
                          >
                            {prompt}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={styles.messageList}>
                    {messages.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          ...styles.messageRow,
                          justifyContent:
                            item.role === "user"
                              ? "flex-end"
                              : "flex-start",
                        }}
                      >
                        {item.role ===
                          "assistant" && (
                          <div
                            style={
                              styles.messageAvatar
                            }
                          >
                            <Bot size={14} />
                          </div>
                        )}

                        <div
                          style={{
                            ...styles.messageBubble,
                            ...(item.role ===
                            "user"
                              ? styles.userBubble
                              : styles.assistantBubble),
                          }}
                        >
                          <div
                            className="edusphere-ai-message-content"
                            style={
                              styles.messageContent
                            }
                          >
                            {renderMarkdown(item.content)}
                          </div>

                          {item.role ===
                            "assistant" &&
                            item.contextUsed && (
                              <div
                                style={
                                  styles.contextBadge
                                }
                              >
                                EduSphere context
                                used
                              </div>
                            )}
                        </div>
                      </div>
                    ))}

                    {/* THINKING */}

                    {sending && (
                      <div
                        style={styles.messageRow}
                      >
                        <div
                          style={
                            styles.messageAvatar
                          }
                        >
                          <Bot size={14} />
                        </div>

                        <div
                          style={{
                            ...styles.messageBubble,
                            ...styles.assistantBubble,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <Loader2
                            size={14}
                            style={styles.spin}
                          />

                          Thinking...
                        </div>
                      </div>
                    )}

                    <div
                      ref={messagesEndRef}
                    />
                  </div>
                )}

                {/* ERROR */}

                {error && (
                  <div style={styles.errorBox}>
                    <span>{error}</span>

                    <button
                      type="button"
                      onClick={() =>
                        setError("")
                      }
                      style={
                        styles.errorClose
                      }
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}
              </div>

              {/* =================================================
                  FOOTER
              ================================================= */}

              <div style={styles.footer}>
                {messages.length > 0 && (
                  <div style={styles.footerTop}>
                    <span
                      style={styles.disclaimer}
                    >
                      Answers use available
                      EduSphere context.
                    </span>

                    <button
                      type="button"
                      onClick={
                        clearConversation
                      }
                      style={
                        styles.clearButton
                      }
                      disabled={sending}
                    >
                      Clear
                    </button>
                  </div>
                )}

                <form
                  onSubmit={handleSubmit}
                  style={styles.form}
                >
                  <input
                    value={message}
                    onChange={(event) =>
                      setMessage(
                        event.target.value
                      )
                    }
                    placeholder="Ask EduSphere AI..."
                    maxLength={5000}
                    disabled={sending}
                    className="edusphere-ai-chat-input"
                    style={styles.input}
                  />

                  <button
                    type="submit"
                    aria-label="Send message"
                    disabled={
                      !message.trim() ||
                      sending
                    }
                    style={{
                      ...styles.sendButton,
                      opacity:
                        !message.trim() ||
                        sending
                          ? 0.45
                          : 1,
                    }}
                  >
                    {sending ? (
                      <Loader2
                        size={17}
                        style={styles.spin}
                      />
                    ) : (
                      <Send size={17} />
                    )}
                  </button>
                </form>
              </div>
            </>
          )}
        </section>
      )}
    </>
  );

  // Render outside page containers so parent overflow/transform rules
  // cannot clip or hide the floating AI control on mobile/tablet.
  return typeof document !== "undefined"
    ? createPortal(chatbotUI, document.body)
    : null;
}

/* =========================================================
   RESPONSIVE AI OVERLAY
========================================================= */

if (typeof document !== "undefined") {
  const responsiveStyleId = "edusphere-ai-responsive";

  if (!document.getElementById(responsiveStyleId)) {
    const style = document.createElement("style");
    style.id = responsiveStyleId;
    style.textContent = `
      .edusphere-ai-floating-button,
      .edusphere-ai-chat-window {
        box-sizing: border-box !important;
        max-width: calc(100vw - 20px) !important;
      }

      .edusphere-ai-floating-button {
        z-index: 2147483647 !important;
        touch-action: manipulation;
      }

      .edusphere-ai-chat-window {
        z-index: 2147483647 !important;
        max-height: calc(100dvh - 32px) !important;
      }

      @media (max-width: 900px) {
        .edusphere-ai-floating-button {
          right: max(16px, env(safe-area-inset-right)) !important;
          bottom: max(18px, env(safe-area-inset-bottom)) !important;
          width: 56px !important;
          height: 56px !important;
        }

        .edusphere-ai-chat-window {
          left: 12px !important;
          right: 12px !important;
          bottom: max(12px, env(safe-area-inset-bottom)) !important;
          width: auto !important;
          height: min(680px, calc(100dvh - 24px)) !important;
          max-height: calc(100dvh - 24px) !important;
          border-radius: 18px !important;
        }

        .edusphere-ai-chat-window .edusphere-ai-chat-input {
          font-size: 16px !important;
        }
      }

      @media (max-width: 600px) {
        .edusphere-ai-floating-button {
          right: 14px !important;
          bottom: max(14px, env(safe-area-inset-bottom)) !important;
          width: 54px !important;
          height: 54px !important;
        }

        .edusphere-ai-chat-window {
          left: 8px !important;
          right: 8px !important;
          bottom: max(8px, env(safe-area-inset-bottom)) !important;
          height: min(700px, calc(100dvh - 16px)) !important;
          max-height: calc(100dvh - 16px) !important;
          border-radius: 16px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }
}

/* =========================================================
   STYLES
========================================================= */

const styles: Record<
  string,
  React.CSSProperties
> = {
  floatingButton: {
    position: "fixed",
    right: 24,
    bottom: 24,
    zIndex: 1000,
    width: 58,
    height: 58,
    borderRadius: "50%",
    border:
      "1px solid rgba(129,140,248,0.42)",
    background:
      "linear-gradient(145deg, rgba(79,70,229,0.92), rgba(14,116,144,0.88))",
    color: "#e0e7ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow:
      "0 14px 40px rgba(0,0,0,0.42), 0 0 34px rgba(99,102,241,0.28)",
  },

  floatingPulse: {
    position: "absolute",
    inset: -6,
    borderRadius: "50%",
    border:
      "1px solid rgba(103,232,249,0.18)",
    pointerEvents: "none",
  },

  floatingLabel: {
    position: "absolute",
    right: -3,
    bottom: -3,
    minWidth: 19,
    height: 19,
    padding: "0 5px",
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    background: "#0f172a",
    border:
      "1px solid rgba(103,232,249,0.32)",
    color: "#67e8f9",
    fontSize: 8,
    fontWeight: 900,
    letterSpacing: "0.05em",
  },

  chatWindow: {
    position: "fixed",
    right: 24,
    bottom: 24,
    zIndex: 1000,
    width:
      "min(410px, calc(100vw - 32px))",
    height:
      "min(650px, calc(100vh - 48px))",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderRadius: 22,
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.98), rgba(2,6,23,0.98))",
    border:
      "1px solid rgba(129,140,248,0.24)",
    boxShadow:
      "0 30px 90px rgba(0,0,0,0.55), 0 0 60px rgba(79,70,229,0.12)",
    backdropFilter: "blur(22px)",
  },

  chatWindowMinimized: {
    height: "auto",
  },

  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "14px 15px",
    borderBottom:
      "1px solid rgba(148,163,184,0.09)",
    background:
      "rgba(15,23,42,0.72)",
  },

  headerIdentity: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },

  botOrb: {
    width: 38,
    height: 38,
    flex: "0 0 38px",
    display: "grid",
    placeItems: "center",
    borderRadius: 12,
    color: "#c7d2fe",
    background:
      "radial-gradient(circle, rgba(129,140,248,0.35), rgba(34,211,238,0.08))",
    border:
      "1px solid rgba(129,140,248,0.24)",
    boxShadow:
      "0 0 24px rgba(99,102,241,0.15)",
  },

  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: 7,
  },

  title: {
    color: "#f8fafc",
    fontSize: 13,
    letterSpacing: "-0.01em",
  },

  liveBadge: {
    padding: "3px 5px",
    borderRadius: 999,
    color: "#67e8f9",
    background:
      "rgba(34,211,238,0.08)",
    border:
      "1px solid rgba(103,232,249,0.14)",
    fontSize: 6,
    fontWeight: 900,
    letterSpacing: "0.12em",
  },

  subtitle: {
    display: "block",
    marginTop: 3,
    color: "#64748b",
    fontSize: 8,
  },

  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 4,
  },

  iconButton: {
    width: 30,
    height: 30,
    display: "grid",
    placeItems: "center",
    border:
      "1px solid rgba(148,163,184,0.09)",
    borderRadius: 9,
    background:
      "rgba(15,23,42,0.72)",
    color: "#64748b",
    cursor: "pointer",
  },

  body: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    padding: 15,
  },

  emptyState: {
    minHeight: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },

  emptyOrb: {
    width: 52,
    height: 52,
    display: "grid",
    placeItems: "center",
    margin: "0 auto 16px",
    borderRadius: 16,
    color: "#a5b4fc",
    background:
      "radial-gradient(circle, rgba(99,102,241,0.24), rgba(34,211,238,0.07), transparent 72%)",
    border:
      "1px solid rgba(129,140,248,0.2)",
  },

  emptyTitle: {
    margin: "0 auto",
    maxWidth: 290,
    color: "#e2e8f0",
    textAlign: "center",
    fontSize: 16,
    lineHeight: 1.35,
  },

  emptyText: {
    maxWidth: 320,
    margin: "9px auto 12px",
    color: "#64748b",
    textAlign: "center",
    fontSize: 10,
    lineHeight: 1.6,
  },

  roleBadge: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    width: "fit-content",
    margin: "0 auto 14px",
    padding: "5px 9px",
    borderRadius: 999,
    color: "#67e8f9",
    background:
      "rgba(34,211,238,0.06)",
    border:
      "1px solid rgba(103,232,249,0.12)",
    fontSize: 7,
    fontWeight: 800,
    letterSpacing: "0.04em",
  },

  starterList: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
  },

  starterButton: {
    width: "100%",
    padding: "10px 11px",
    borderRadius: 11,
    border:
      "1px solid rgba(129,140,248,0.13)",
    background:
      "rgba(30,41,59,0.42)",
    color: "#a5b4fc",
    textAlign: "left",
    fontSize: 9,
    lineHeight: 1.45,
    cursor: "pointer",
  },

  messageList: {
    display: "flex",
    flexDirection: "column",
    gap: 11,
  },

  messageRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 7,
  },

  messageAvatar: {
    width: 25,
    height: 25,
    flex: "0 0 25px",
    display: "grid",
    placeItems: "center",
    borderRadius: 8,
    color: "#a5b4fc",
    background:
      "rgba(99,102,241,0.10)",
    border:
      "1px solid rgba(129,140,248,0.13)",
  },

  messageBubble: {
    maxWidth: "82%",
    padding: "9px 11px",
    borderRadius: 13,
    fontSize: 10,
    lineHeight: 1.6,
    whiteSpace: "normal",
  },

  userBubble: {
    color: "#e0f2fe",
    background:
      "rgba(37,99,235,0.18)",
    border:
      "1px solid rgba(96,165,250,0.16)",
    borderBottomRightRadius: 4,
  },

  assistantBubble: {
    color: "#cbd5e1",
    background:
      "rgba(30,41,59,0.72)",
    border:
      "1px solid rgba(148,163,184,0.10)",
    borderBottomLeftRadius: 4,
  },

  messageContent: {
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  },

  contextBadge: {
    marginTop: 7,
    color: "#67e8f9",
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: "0.03em",
    opacity: 0.8,
  },

  errorBox: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 11,
    padding: "9px 10px",
    borderRadius: 10,
    color: "#fda4af",
    background:
      "rgba(244,63,94,0.07)",
    border:
      "1px solid rgba(244,63,94,0.14)",
    fontSize: 9,
    lineHeight: 1.5,
  },

  errorClose: {
    display: "grid",
    placeItems: "center",
    border: 0,
    background: "transparent",
    color: "#fda4af",
    cursor: "pointer",
    padding: 0,
  },

  footer: {
    padding: "9px 11px 11px",
    borderTop:
      "1px solid rgba(148,163,184,0.08)",
    background:
      "rgba(2,6,23,0.62)",
  },

  footerTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 7,
  },

  disclaimer: {
    color: "#475569",
    fontSize: 7,
  },

  clearButton: {
    border: 0,
    background: "transparent",
    color: "#818cf8",
    cursor: "pointer",
    fontSize: 8,
    fontWeight: 700,
  },

  form: {
    display: "flex",
    alignItems: "center",
    gap: 7,
  },

  input: {
    flex: 1,
    minWidth: 0,
    height: 39,
    padding: "0 11px",
    borderRadius: 11,
    border:
      "1px solid rgba(148,163,184,0.12)",
    outline: "none",
    background:
      "rgba(15,23,42,0.86)",
    color: "#e2e8f0",
    fontSize: 10,
  },

  sendButton: {
    width: 39,
    height: 39,
    flex: "0 0 39px",
    display: "grid",
    placeItems: "center",
    borderRadius: 11,
    border:
      "1px solid rgba(129,140,248,0.24)",
    background:
      "rgba(99,102,241,0.18)",
    color: "#c7d2fe",
    cursor: "pointer",
  },

  spin: {
    animation:
      "edusphere-ai-spin 0.9s linear infinite",
  },
};

/* =========================================================
   ANIMATION
========================================================= */

if (typeof document !== "undefined") {
  const styleId =
    "edusphere-ai-chatbot-animation";

  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");

    style.id = styleId;

    style.textContent = `
      @keyframes edusphere-ai-spin {
        from {
          transform: rotate(0deg);
        }

        to {
          transform: rotate(360deg);
        }
      }
    `;

    document.head.appendChild(style);
  }
}