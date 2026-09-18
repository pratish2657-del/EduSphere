import "./professor-verification.css";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import AIChatbot from "../../components/ai/AIChatbot";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

type PendingProfessor = {
  professor_id?: number;
  user_id?: number;
  full_name?: string;
  email?: string;
  employee_id?: string;
  department?: string;
  designation?: string;
  specialization?: string;
  institution_name?: string;
  university_code?: string;
  verification_status?: string;
  submitted_at?: string;
};

type PendingResponse = {
  professors?: PendingProfessor[];
  count?: number;
};

async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
      ...(options?.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const detail =
      data && typeof data === "object" && "detail" in data
        ? (data as { detail?: unknown }).detail
        : undefined;

    throw new Error(
      typeof detail === "string"
        ? detail
        : `Request failed with status ${response.status}`,
    );
  }

  return data as T;
}

function formatDate(value?: string) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ProfessorVerification() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [pending, setPending] = useState<PendingProfessor[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PendingProfessor | null>(null);
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadPending = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await apiRequest<PendingProfessor[] | PendingResponse>(
        "/admin/professors/pending",
      );

      setPending(
        Array.isArray(result) ? result : result?.professors ?? [],
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load professor verification requests.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPending();
  }, [loadPending]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pending;

    return pending.filter((professor) =>
      [
        professor.full_name,
        professor.email,
        professor.employee_id,
        professor.department,
        professor.designation,
        professor.specialization,
        professor.university_code,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [pending, search]);

  const processVerification = async (
    professor: PendingProfessor,
    status: "VERIFIED" | "REJECTED",
  ) => {
    const professorId = professor.professor_id;

    if (professorId == null) {
      setError("This request does not contain a professor ID.");
      return;
    }

    setProcessingId(professorId);
    setError("");
    setNotice("");

    try {
      await apiRequest(`/admin/professors/${professorId}/verify`, {
        method: "PUT",
        body: JSON.stringify({
          status,
          remarks:
            remarks.trim() ||
            (status === "VERIFIED"
              ? "Verified by institution administrator."
              : "Rejected by institution administrator."),
        }),
      });

      setPending((current) =>
        current.filter((item) => item.professor_id !== professorId),
      );

      setSelected(null);
      setRemarks("");

      setNotice(
        status === "VERIFIED"
          ? `${professor.full_name || "Professor"} has been verified successfully.`
          : `${professor.full_name || "Professor"} has been rejected.`,
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to process professor verification.",
      );
    } finally {
      setProcessingId(null);
    }
  };

  const displayName =
    user?.full_name || user?.email?.split("@")[0] || "Admin";

  return (
    <div className="prof-verification-page" style={styles.page}>
      <div style={styles.glowOne} />
      <div style={styles.glowTwo} />

      <main className="prof-verification-main" style={styles.main}>
        <header className="prof-verification-header" style={styles.header}>
          <div style={styles.headerLeft}>
            <button
              type="button"
              style={styles.backButton}
              onClick={() => navigate("/app/admin")}
              aria-label="Back to admin dashboard"
            >
              <ArrowLeft size={18} />
            </button>

            <div>
              <span style={styles.eyebrow}>INSTITUTIONAL OPERATIONS</span>
              <h1 style={styles.title}>Professor Verification</h1>
              <p style={styles.subtitle}>
                Review and verify professor profiles submitted to your institution.
              </p>
            </div>
          </div>

          <button
            type="button"
            style={styles.refreshButton}
            onClick={() => void loadPending()}
            disabled={loading}
          >
            <RefreshCw size={16} style={loading ? styles.spin : undefined} />
            Refresh
          </button>
        </header>

        <section className="prof-verification-summary" style={styles.summaryGrid}>
          <div className="prof-verification-summary-card" style={styles.summaryCard}>
            <div style={styles.summaryIcon}>
              <Clock3 size={19} />
            </div>
            <div>
              <span>Pending applications </span>
              <strong>{loading ? "…" : pending.length}</strong>
            </div>
          </div>

          <div className="prof-verification-summary-card" style={styles.summaryCard}>
            <div style={styles.summaryIcon}>
              <ShieldCheck size={19} />
            </div>
            <div>
              <span>Access scope</span>
              <strong> Institution </strong>
            </div>
          </div>

          <div className="prof-verification-summary-card" style={styles.summaryCard}>
            <div style={styles.summaryIcon}>
              <UserRound size={19} />
            </div>
            <div>
              <span>Reviewer </span>
              <strong>{displayName}</strong>
            </div>
          </div>
        </section>

        {error ? (
          <div style={styles.errorBanner}>
            <XCircle size={18} />
            <span>{error}</span>
            <button
              type="button"
              style={styles.dismiss}
              onClick={() => setError("")}
            >
              <X size={15} />
            </button>
          </div>
        ) : null}

        {notice ? (
          <div style={styles.noticeBanner}>
            <CheckCircle2 size={18} />
            <span>{notice}</span>
            <button
              type="button"
              style={styles.dismiss}
              onClick={() => setNotice("")}
            >
              <X size={15} />
            </button>
          </div>
        ) : null}

        <section className="prof-verification-panel" style={styles.panel}>
          <div className="prof-verification-panel-header" style={styles.panelHeader}>
            <div>
              <span style={styles.panelEyebrow}>VERIFICATION QUEUE</span>
              <h2 style={styles.panelTitle}>Pending Professor Profiles</h2>
              <p style={styles.panelSubtitle}>
                Verify eligible faculty members or reject incomplete applications.
              </p>
            </div>

            <div className="prof-verification-search" style={styles.searchBox}>
              <Search size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, email, department..."
              />
            </div>
          </div>

          {loading ? (
            <div style={styles.emptyState}>
              <RefreshCw size={25} style={styles.spin} />
              <strong>Loading verification queue…</strong>
            </div>
          ) : filtered.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>
                <CheckCircle2 size={28} />
              </div>
              <strong>
                {search ? "No matching applications" : "Verification queue is clear"}
              </strong>
              <span>
                {search
                  ? "Try a different search term."
                  : "There are no professor profiles waiting for review."}
              </span>
            </div>
          ) : (
            <div style={styles.list}>
              {filtered.map((professor) => {
                const id = professor.professor_id;
                const busy = id != null && processingId === id;

                return (
                  <article
                    className="prof-verification-application"
                    key={id ?? professor.user_id ?? professor.email}
                    style={styles.application}
                  >
                    <div style={styles.avatar}>
                      {(professor.full_name || "P").slice(0, 1).toUpperCase()}
                    </div>

                    <div className="prof-verification-person" style={styles.person}>
                      <div className="prof-verification-name-row" style={styles.nameRow}>
                        <h3>{professor.full_name || "Professor"}</h3>
                        <span style={styles.pendingBadge}>PENDING</span>
                      </div>

                      <div style={styles.metaRow}>
                        <span>
                          <Mail size={13} />
                          {professor.email || "Email unavailable"}
                        </span>
                        <span>
                          <UserRound size={13} />
                          {professor.employee_id || "Employee ID unavailable"}
                        </span>
                      </div>

                      <p style={styles.roleLine}>
                        {professor.designation || "Faculty"}
                        <span>•</span>
                        {professor.department || "Department not specified"}
                        {professor.specialization ? (
                          <>
                            <span>•</span>
                            {professor.specialization}
                          </>
                        ) : null}
                      </p>

                      <small style={styles.submitted}>
                        Submitted {formatDate(professor.submitted_at)}
                      </small>
                    </div>

                    <div className="prof-verification-row-actions" style={styles.rowActions}>
                      <button
                        type="button"
                        style={styles.detailsButton}
                        onClick={() => {
                          setSelected(professor);
                          setRemarks("");
                        }}
                      >
                        Details
                        <ChevronRight size={15} />
                      </button>

                      <button
                        type="button"
                        style={styles.verifyButton}
                        disabled={busy}
                        onClick={() =>
                          void processVerification(professor, "VERIFIED")
                        }
                      >
                        <CheckCircle2 size={15} />
                        Verify
                      </button>

                      <button
                        type="button"
                        style={styles.rejectButton}
                        disabled={busy}
                        onClick={() => {
                          setSelected(professor);
                          setRemarks("");
                        }}
                      >
                        <XCircle size={15} />
                        Reject
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {selected ? (
        <div
          style={styles.overlay}
          onMouseDown={() => setSelected(null)}
        >
          <div
            style={styles.modal}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div style={styles.modalHeader}>
              <div>
                <span style={styles.panelEyebrow}>APPLICATION REVIEW</span>
                <h2 style={styles.modalTitle}>
                  {selected.full_name || "Professor"}
                </h2>
              </div>

              <button
                type="button"
                style={styles.modalClose}
                onClick={() => setSelected(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="prof-verification-detail-grid" style={styles.detailGrid}>
              <Detail label="Email" value={selected.email} />
              <Detail label="Employee ID" value={selected.employee_id} />
              <Detail label="Department" value={selected.department} />
              <Detail label="Designation" value={selected.designation} />
              <Detail label="Specialization" value={selected.specialization} />
              <Detail
                label="Institution"
                value={selected.institution_name || selected.university_code}
              />
              <Detail
                label="Submitted"
                value={formatDate(selected.submitted_at)}
              />
              <Detail
                label="Status"
                value={selected.verification_status || "PENDING"}
              />
            </div>

            <label style={styles.remarkLabel}>
              Review remarks
              <textarea
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                placeholder="Optional remarks for this decision..."
                rows={4}
                style={styles.textarea}
              />
            </label>

            <div className="prof-verification-modal-actions" style={styles.modalActions}>
              <button
                type="button"
                style={styles.rejectLarge}
                disabled={processingId === selected.professor_id}
                onClick={() =>
                  void processVerification(selected, "REJECTED")
                }
              >
                <XCircle size={17} />
                Reject Application
              </button>

              <button
                type="button"
                style={styles.verifyLarge}
                disabled={processingId === selected.professor_id}
                onClick={() =>
                  void processVerification(selected, "VERIFIED")
                }
              >
                <CheckCircle2 size={17} />
                Verify Professor
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <AIChatbot />
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string }) {
  return (
    <div style={styles.detail}>
      <span>{label}</span>
      <strong>{value || "—"}</strong>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(135deg, #050b15 0%, #091321 48%, #0c1320 100%)",
    color: "#f8fafc",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    position: "relative",
    overflow: "hidden",
  },
  glowOne: {
    position: "fixed",
    width: 500,
    height: 500,
    borderRadius: "50%",
    background: "rgba(59,130,246,.07)",
    filter: "blur(110px)",
    top: -250,
    right: -180,
    pointerEvents: "none",
  },
  glowTwo: {
    position: "fixed",
    width: 430,
    height: 430,
    borderRadius: "50%",
    background: "rgba(139,92,246,.06)",
    filter: "blur(110px)",
    bottom: -220,
    left: -170,
    pointerEvents: "none",
  },
  main: {
    width: "min(1280px, calc(100% - 48px))",
    margin: "0 auto",
    padding: "32px 0 50px",
    position: "relative",
    zIndex: 1,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
    marginBottom: 25,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 13,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 11,
    border: "1px solid rgba(148,163,184,.12)",
    background: "rgba(255,255,255,.035)",
    color: "#cbd5e1",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    flexShrink: 0,
  },
  eyebrow: {
    color: "#60a5fa",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "1.6px",
  },
  title: {
    margin: "5px 0 4px",
    fontSize: 27,
    letterSpacing: "-.6px",
  },
  subtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: 11,
  },
  refreshButton: {
    border: "1px solid rgba(96,165,250,.18)",
    background: "rgba(59,130,246,.08)",
    color: "#93c5fd",
    borderRadius: 10,
    padding: "9px 12px",
    display: "flex",
    alignItems: "center",
    gap: 7,
    fontSize: 10,
    cursor: "pointer",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 13,
    marginBottom: 15,
  },
  summaryCard: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minHeight: 82,
    padding: "14px 16px",
    borderRadius: 15,
    border: "1px solid rgba(148,163,184,.11)",
    background: "rgba(15,23,42,.66)",
  },
  summaryIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    display: "grid",
    placeItems: "center",
    color: "#93c5fd",
    background: "rgba(59,130,246,.1)",
    flexShrink: 0,
  },
  errorBanner: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "11px 13px",
    borderRadius: 11,
    background: "rgba(244,63,94,.08)",
    border: "1px solid rgba(244,63,94,.18)",
    color: "#fda4af",
    fontSize: 11,
    marginBottom: 12,
  },
  noticeBanner: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "11px 13px",
    borderRadius: 11,
    background: "rgba(34,197,94,.07)",
    border: "1px solid rgba(34,197,94,.15)",
    color: "#86efac",
    fontSize: 11,
    marginBottom: 12,
  },
  dismiss: {
    marginLeft: "auto",
    border: 0,
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
  },
  panel: {
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,.11)",
    background: "rgba(10,18,32,.74)",
    padding: 20,
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 20,
    marginBottom: 17,
  },
  panelEyebrow: {
    color: "#60a5fa",
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: "1.4px",
  },
  panelTitle: {
    margin: "5px 0 3px",
    fontSize: 17,
  },
  panelSubtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: 10,
  },
  searchBox: {
    width: 300,
    height: 38,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0 11px",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,.12)",
    background: "rgba(5,11,21,.55)",
    color: "#64748b",
    flexShrink: 0,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  application: {
    display: "flex",
    alignItems: "center",
    gap: 13,
    padding: "13px 12px",
    borderRadius: 13,
    border: "1px solid rgba(148,163,184,.08)",
    background: "rgba(255,255,255,.018)",
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    display: "grid",
    placeItems: "center",
    background: "linear-gradient(135deg, rgba(37,99,235,.25), rgba(124,58,237,.2))",
    border: "1px solid rgba(96,165,250,.16)",
    color: "#bfdbfe",
    fontWeight: 800,
    flexShrink: 0,
  },
  person: {
    minWidth: 0,
    flex: 1,
  },
  nameRow: {
    display: "flex",
    alignItems: "center",
    gap: 7,
  },
  nameRowH3: {},
  pendingBadge: {
    borderRadius: 999,
    padding: "3px 7px",
    background: "rgba(245,158,11,.1)",
    border: "1px solid rgba(245,158,11,.15)",
    color: "#fbbf24",
    fontSize: 7,
    fontWeight: 800,
    letterSpacing: ".5px",
  },
  metaRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 13,
    marginTop: 4,
    color: "#94a3b8",
    fontSize: 9,
  },
  roleLine: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 9,
  },
  submitted: {
    display: "block",
    color: "#475569",
    fontSize: 8,
    marginTop: 4,
  },
  rowActions: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    flexShrink: 0,
  },
  detailsButton: {
    border: "1px solid rgba(148,163,184,.11)",
    background: "rgba(255,255,255,.025)",
    color: "#94a3b8",
    borderRadius: 8,
    padding: "7px 8px",
    display: "flex",
    alignItems: "center",
    gap: 3,
    fontSize: 9,
    cursor: "pointer",
  },
  verifyButton: {
    border: "1px solid rgba(34,197,94,.18)",
    background: "rgba(34,197,94,.08)",
    color: "#86efac",
    borderRadius: 8,
    padding: "7px 9px",
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 9,
    cursor: "pointer",
  },
  rejectButton: {
    border: "1px solid rgba(244,63,94,.16)",
    background: "rgba(244,63,94,.06)",
    color: "#fda4af",
    borderRadius: 8,
    padding: "7px 9px",
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 9,
    cursor: "pointer",
  },
  emptyState: {
    minHeight: 300,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    color: "#64748b",
    fontSize: 10,
    textAlign: "center",
  },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    color: "#86efac",
    background: "rgba(34,197,94,.08)",
    border: "1px solid rgba(34,197,94,.12)",
    marginBottom: 4,
  },
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 100,
    background: "rgba(0,0,0,.62)",
    backdropFilter: "blur(8px)",
    display: "grid",
    placeItems: "center",
    padding: 20,
  },
  modal: {
    width: "min(680px, 100%)",
    maxHeight: "90vh",
    overflowY: "auto",
    borderRadius: 19,
    border: "1px solid rgba(148,163,184,.15)",
    background: "#0b1322",
    boxShadow: "0 30px 100px rgba(0,0,0,.45)",
    padding: 21,
  },
  modalHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 15,
    marginBottom: 18,
  },
  modalTitle: {
    margin: "5px 0 0",
    fontSize: 21,
  },
  modalClose: {
    width: 34,
    height: 34,
    borderRadius: 9,
    border: "1px solid rgba(148,163,184,.1)",
    background: "rgba(255,255,255,.03)",
    color: "#94a3b8",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0,1fr))",
    gap: 9,
  },
  detail: {
    padding: "11px 12px",
    borderRadius: 10,
    background: "rgba(255,255,255,.025)",
    border: "1px solid rgba(148,163,184,.08)",
  },
  remarkLabel: {
    display: "grid",
    gap: 7,
    marginTop: 15,
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: 700,
  },
  textarea: {
    width: "100%",
    resize: "vertical",
    minHeight: 95,
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,.12)",
    outline: "none",
    background: "#070e1a",
    color: "#e2e8f0",
    padding: 10,
    fontFamily: "inherit",
    fontSize: 11,
    lineHeight: 1.5,
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 15,
  },
  rejectLarge: {
    border: "1px solid rgba(244,63,94,.18)",
    background: "rgba(244,63,94,.08)",
    color: "#fda4af",
    borderRadius: 9,
    padding: "9px 12px",
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 10,
    cursor: "pointer",
  },
  verifyLarge: {
    border: "1px solid rgba(34,197,94,.2)",
    background: "rgba(34,197,94,.1)",
    color: "#86efac",
    borderRadius: 9,
    padding: "9px 12px",
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 10,
    cursor: "pointer",
  },
  spin: {
    animation: "professorVerificationSpin 1s linear infinite",
  },
};

if (typeof document !== "undefined") {
  const id = "edusphere-professor-verification-styles";
  if (!document.getElementById(id)) {
    const style = document.createElement("style");
    style.id = id;
    style.textContent =
      "@keyframes professorVerificationSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }";
    document.head.appendChild(style);
  }
}
