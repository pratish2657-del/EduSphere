import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileCheck2,
  LayoutDashboard,
  LogOut,
  Menu,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import "./admin-3d-cone.css";
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

type EventItem = {
  id?: number;
  event_id?: number;
  title?: string;
  description?: string;
  event_type?: string;
  venue?: string;
  organizer?: string;

  start_datetime?: string;
  end_datetime?: string;

  start_time?: string;
  end_time?: string;

  status?: string;
  is_published?: boolean;
};

type EventsResponse = {
  events?: EventItem[];
  count?: number;
};

type PendingResponse = {
  professors?: PendingProfessor[];
  count?: number;
};

type AdminProfile = {
  profile_photo_url?: string | null;
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

function getEventId(event: EventItem) {
  return event.event_id ?? event.id;
}

function formatDate(value?: string) {
  if (!value) return "Date not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function StatCard({
  icon: Icon,
  label,
  value,
  description,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  description: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      style={{
        ...styles.statCard,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div style={styles.statIcon}>
        <Icon size={20} />
      </div>
      <div style={styles.statBody}>
        <span style={styles.statLabel}>{label}</span>
        <strong style={styles.statValue}>{value}</strong>
        <span style={styles.statDescription}>{description}</span>
      </div>
      {onClick && <ChevronRight size={18} style={styles.statArrow} />}
    </button>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [pending, setPending] = useState<PendingProfessor[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [pendingResponse, eventsResponse, profileResponse] =
        await Promise.all([
          apiRequest<PendingProfessor[] | PendingResponse>(
            "/admin/professors/pending",
          ),
          apiRequest<EventItem[] | EventsResponse>("/events/"),
          apiRequest<AdminProfile | { profile?: AdminProfile }>("/profile/admin"),
        ]);

      const pendingList = Array.isArray(pendingResponse)
        ? pendingResponse
        : pendingResponse?.professors ?? [];

      const eventList = Array.isArray(eventsResponse)
        ? eventsResponse
        : eventsResponse?.events ?? [];

      const profile: AdminProfile | null =
        profileResponse &&
        typeof profileResponse === "object" &&
        "profile" in profileResponse
          ? profileResponse.profile ?? null
          : (profileResponse as AdminProfile | null);

      setPending(pendingList);
      setEvents(eventList);
      setAdminProfile(profile ?? null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load the admin dashboard.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate("/", { replace: true });
    }
  };

  const verifyProfessor = async (
    professorId: number,
    status: "VERIFIED" | "REJECTED",
  ) => {
    setActionLoading(professorId);

    try {
      await apiRequest(`/admin/professors/${professorId}/verify`, {
        method: "PUT",
        body: JSON.stringify({
          status,
          remarks:
            status === "VERIFIED"
              ? "Verified by institution administrator."
              : "Rejected by institution administrator.",
        }),
      });

      setPending((current) =>
        current.filter((item) => item.professor_id !== professorId),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to process professor verification.",
      );
    } finally {
      setActionLoading(null);
    }
  };

  const navigationItems = useMemo(
    () => [
      {
        label: "Dashboard",
        icon: LayoutDashboard,
        path: "/app/admin",
        active: true,
      },
      {
        label: "Users",
        icon: Users,
        path: "/app/admin/users",
      },
      {
        label: "Professor Verification",
        icon: ShieldCheck,
        path: "/app/admin/professor-verification",
        badge: pending.length || undefined,
      },
      {
        label: "Courses",
        icon: BookOpen,
        path: "/app/admin/courses",
      },
      {
        label: "Library",
        icon: BookOpen,
        path: "/app/library",
      },
      {
        label: "Timetable",
        icon: CalendarDays,
        path: "/app/admin/timetable",
      },
      {
        label: "Attendance",
        icon: CheckCircle2,
        path: "/app/admin/attendance",
      },
      {
        label: "Results",
        icon: FileCheck2,
        path: "/app/admin/results",
      },
      {
        label: "Events",
        icon: CalendarDays,
        path: "/app/admin/events",
      },
      {
        label: "Marketplace",
        icon: BookOpen,
        path: "/app/admin/marketplace",
      },
      {
        label: "Marketplace Management",
        icon: BookOpen,
        path: "/app/admin/marketplace-management",
      },
      { label: "Marketplace Payouts", icon: BookOpen, path: "/app/admin/marketplace-payouts" },
      { label: "Marketplace Refund", icon: BookOpen, path: "/app/admin/marketplace-refunds"},
      {
        label: "EduSphere AI",
        icon: Sparkles,
        path: "/app/admin/edusphere-ai",
      },
      {
        label: "Profile",
        icon: UserRound,
        path: "/auth/profile/admin",
      },
    ],
    [pending.length],
  );

  const upcomingEvents = useMemo(() => {
    const now = Date.now();

    return events
      .filter((event) => {
        // Prefer the actual event datetime.
        const dateValue = event.start_datetime || event.start_time;

        if (!dateValue) return false;

        const timestamp = new Date(dateValue).getTime();

        return !Number.isNaN(timestamp) && timestamp > now;
      })
      .sort((a, b) => {
        const aValue = a.start_datetime || a.start_time;
        const bValue = b.start_datetime || b.start_time;

        const aTime = aValue
          ? new Date(aValue).getTime()
          : Number.MAX_SAFE_INTEGER;

        const bTime = bValue
          ? new Date(bValue).getTime()
          : Number.MAX_SAFE_INTEGER;

        return aTime - bTime;
      })
      .slice(0, 4);
  }, [events]);

  const displayName =
    user?.full_name || user?.email?.split("@")[0] || "Admin";

  const profileImageUrl = (() => {
    const url = adminProfile?.profile_photo_url;
    if (!url) return "";

    if (
      url.startsWith("http://") ||
      url.startsWith("https://") ||
      url.startsWith("blob:")
    ) {
      return url;
    }

    return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
  })();

  const profileFallback = displayName.slice(0, 1).toUpperCase();

  const quickActions: [string, LucideIcon, string][] = [
    ["Professor Verification", ShieldCheck, "/app/admin/professor-verification"],
    ["Manage Courses", BookOpen, "/app/admin/courses"],
    ["Timetable", CalendarDays, "/app/admin/timetable"],
    ["Attendance", CheckCircle2, "/app/admin/attendance"],
    ["Results", FileCheck2, "/app/admin/results"],
    ["Events", CalendarDays, "/app/admin/events"],
    ["Marketplace", BookOpen, "/app/admin/marketplace"],
    ["Marketplace Management", BookOpen, "/app/admin/marketplace-management"],
    ["Marketplace Payouts", BookOpen, "/app/admin/marketplace-payouts"],
    ["EduSphere AI", Sparkles, "/app/admin/edusphere-ai"],
  ];

  return (
    <div style={styles.page}>
      <style>{`
        * { box-sizing: border-box; }
        .admin-scroll::-webkit-scrollbar { width: 7px; }
        .admin-scroll::-webkit-scrollbar-thumb {
          background: rgba(148,163,184,.20);
          border-radius: 999px;
        }
        .admin-nav:hover { background: rgba(255,255,255,.055) !important; }
        .admin-quick:hover { transform: translateY(-2px); border-color: rgba(96,165,250,.35) !important; }
        .admin-mobile-nav { display: none; }
        @media (max-width: 980px) {
          .admin-sidebar { transform: translateX(-105%); transition: transform .25s ease; }
          .admin-sidebar.open { transform: translateX(0); }
          .admin-mobile-nav { display: flex; }
          .admin-main { margin-left: 0 !important; }
          .admin-grid-4 { grid-template-columns: repeat(2, minmax(0,1fr)) !important; }
          .admin-grid-2 { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 600px) {
          .admin-grid-4 { grid-template-columns: 1fr !important; }
          .admin-main-content { padding: 20px !important; }
          .admin-hero { padding: 22px !important; }
        }
      `}</style>

      <div style={styles.glowOne} />
      <div style={styles.glowTwo} />

      <aside
        className={`admin-sidebar${mobileOpen ? " open" : ""}`}
        style={styles.sidebar}
      >
        <div style={styles.brand}>
          <div style={styles.brandMark}>
            <img
              src="/edusphere-logo.jpeg"
              alt="EduSphere"
              style={styles.brandLogo}
            />
          </div>
          <div>
            <strong style={styles.brandTitle}>EDUSPHERE</strong>
            <span style={styles.brandSub}>ADMIN CONSOLE</span>
          </div>
          <button
            type="button"
            style={styles.closeMobile}
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <div style={styles.rolePill}>
          <span style={styles.roleDot} />
          Institution Administrator
        </div>

        <nav style={styles.nav}>
          <span style={styles.navCaption}>WORKSPACE</span>
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                className="admin-nav"
                style={{
                  ...styles.navItem,
                  ...(item.active ? styles.navItemActive : {}),
                }}
                onClick={() => {
                  setMobileOpen(false);
                  navigate(item.path);
                }}
              >
                <Icon size={18} />
                <span style={{ flex: 1, textAlign: "left" }}>
                  {item.label}
                </span>
                {item.badge ? (
                  <span style={styles.navBadge}>{item.badge}</span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div style={styles.sidebarBottom}>
          <div style={styles.accountCard}>
            <div style={styles.accountAvatar}>
              {profileImageUrl ? (
                <img
                  src={profileImageUrl}
                  alt={`${displayName} profile`}
                  style={styles.profileAvatarImage}
                />
              ) : (
                profileFallback
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <strong style={styles.accountName}>{displayName}</strong>
              <span style={styles.accountEmail}>{user?.email || "Admin"}</span>
            </div>
          </div>

          <button type="button" style={styles.logoutButton} onClick={handleLogout}>
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="admin-main" style={styles.main}>
        <header style={styles.topbar}>
          <button
            type="button"
            className="admin-mobile-nav"
            style={styles.mobileMenu}
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={21} />
          </button>

          <div>
            <span style={styles.topbarEyebrow}>INSTITUTIONAL OPERATIONS</span>
            <h1 style={styles.topbarTitle}>Admin Dashboard</h1>
          </div>

          <div style={styles.topbarActions}>
            <button
              type="button"
              style={styles.iconButton}
              onClick={loadDashboard}
              title="Refresh dashboard"
            >
              <RefreshCw size={18} />
            </button>
            <button type="button" style={styles.iconButton} title="Notifications">
              <Bell size={18} />
            </button>
            <div style={styles.topAvatar}>
              {profileImageUrl ? (
                <img
                  src={profileImageUrl}
                  alt={`${displayName} profile`}
                  style={styles.profileAvatarImage}
                />
              ) : (
                profileFallback
              )}
            </div>
          </div>
        </header>

        <div className="admin-main-content admin-scroll" style={styles.content}>
          {error ? (
            <div style={styles.errorBanner}>
              <XCircle size={18} />
              <span>{error}</span>
              <button
                type="button"
                style={styles.errorRetry}
                onClick={loadDashboard}
              >
                Retry
              </button>
            </div>
          ) : null}

          <section className="admin-hero" style={styles.hero}>
            <div style={styles.heroCopy}>
              <span style={styles.heroKicker}>EDUSPHERE • ADMIN</span>
              <h2 style={styles.heroTitle}>
                Good day, {displayName.split(" ")[0]}.
              </h2>
              <p style={styles.heroText}>
                Manage your institution's academic operations from one
                connected workspace.
              </p>
              <div style={styles.heroMeta}>
                <span>
                  <Clock3 size={15} />
                  {new Date().toLocaleDateString(undefined, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </span>
                <span>
                  <ShieldCheck size={15} />
                  Institution-level access
                </span>
              </div>
            </div>

            <div className="admin-3d-scene" aria-hidden="true">
              <div className="admin-3d-cone-wrap">
                <div className="admin-3d-cone">
                  <div className="admin-3d-cone-face" />
                  <div className="admin-3d-cone-face" />
                  <div className="admin-3d-cone-face" />
                  <div className="admin-3d-cone-face" />
                </div>

                <div className="admin-3d-cone-ring" />

                <div className="admin-3d-cone-core">
                  <ShieldCheck size={18} />
                </div>

                <div className="admin-3d-dot admin-3d-dot-a" />
                <div className="admin-3d-dot admin-3d-dot-b" />
              </div>
            </div>
          </section>

          <section className="admin-grid-4" style={styles.statGrid}>
            <StatCard
              icon={ShieldCheck}
              label="Pending Verification"
              value={loading ? "…" : pending.length}
              description="Professor profiles awaiting review"
              onClick={() => navigate("/app/admin/professor-verification")}
            />
            <StatCard
              icon={CalendarDays}
              label="Events Available"
              value={loading ? "…" : events.length}
              description="Events visible to the institution"
              onClick={() => navigate("/app/admin/events")}
            />
            <StatCard
              icon={Users}
              label="User Management"
              value="Open"
              description="Manage institutional users"
              onClick={() => navigate("/app/admin/users")}
            />
            <StatCard
              icon={Sparkles}
              label="EduSphere AI"
              value="Ready"
              description="Academic assistant for administration"
              onClick={() => navigate("/app/admin/edusphere-ai")}
            />
          </section>

          <section className="admin-grid-2" style={styles.twoColumn}>
            <div style={styles.panel}>
              <div style={styles.panelHeader}>
                <div>
                  <span style={styles.panelEyebrow}>ACTION REQUIRED</span>
                  <h3 style={styles.panelTitle}>Professor Verification</h3>
                  <p style={styles.panelSubtitle}>
                    Review newly submitted professor profiles.
                  </p>
                </div>
                <button
                  type="button"
                  style={styles.viewAll}
                  onClick={() => navigate("/app/admin/professor-verification")}
                >
                  View all <ArrowRight size={15} />
                </button>
              </div>

              {loading ? (
                <div style={styles.emptyState}>
                  <RefreshCw size={22} style={styles.spin} />
                  Loading verification queue…
                </div>
              ) : pending.length === 0 ? (
                <div style={styles.emptyState}>
                  <CheckCircle2 size={28} />
                  <strong>Verification queue is clear</strong>
                  <span>No professor profiles are waiting for review.</span>
                </div>
              ) : (
                <div style={styles.queue}>
                  {pending.slice(0, 4).map((professor) => {
                    const professorId = professor.professor_id;
                    const busy = professorId != null && actionLoading === professorId;

                    return (
                      <div key={professorId ?? professor.user_id} style={styles.queueItem}>
                        <div style={styles.queueAvatar}>
                          {(professor.full_name || "P").slice(0, 1).toUpperCase()}
                        </div>
                        <div style={styles.queueInfo}>
                          <strong style={styles.queueName}>
                            {professor.full_name || "Professor"}
                          </strong>
                          <span style={styles.queueMeta}>
                            {professor.designation || "Faculty"} •{" "}
                            {professor.department || "Department not specified"}
                          </span>
                          <span style={styles.queueEmail}>
                            {professor.email || professor.employee_id || "Profile submitted"}
                          </span>
                        </div>
                        <div style={styles.queueActions}>
                          <button
                            type="button"
                            disabled={busy || professorId == null}
                            style={styles.approveButton}
                            onClick={() =>
                              professorId != null &&
                              verifyProfessor(professorId, "VERIFIED")
                            }
                          >
                            <CheckCircle2 size={15} />
                            Verify
                          </button>
                          <button
                            type="button"
                            disabled={busy || professorId == null}
                            style={styles.rejectButton}
                            onClick={() =>
                              professorId != null &&
                              verifyProfessor(professorId, "REJECTED")
                            }
                          >
                            <XCircle size={15} />
                            Reject
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={styles.panel}>
              <div style={styles.panelHeader}>
                <div>
                  <span style={styles.panelEyebrow}>CAMPUS ACTIVITY</span>
                  <h3 style={styles.panelTitle}>Upcoming Events</h3>
                  <p style={styles.panelSubtitle}>
                    Next events scheduled at your institution.
                  </p>
                </div>
                <button
                  type="button"
                  style={styles.viewAll}
                  onClick={() => navigate("/app/admin/events")}
                >
                  Manage <ArrowRight size={15} />
                </button>
              </div>

              {loading ? (
                <div style={styles.emptyState}>
                  <RefreshCw size={22} style={styles.spin} />
                  Loading events…
                </div>
              ) : upcomingEvents.length === 0 ? (
                <div style={styles.emptyState}>
                  <CalendarDays size={28} />
                  <strong>No upcoming events</strong>
                  <span>Create or publish an event from Events.</span>
                </div>
              ) : (
                <div style={styles.eventList}>
                  {upcomingEvents.map((event) => (
                    <button
                      key={getEventId(event) ??  event.title}
                      type="button"
                      style={styles.eventItem}
                      onClick={() => navigate("/app/admin/events")}
                    >
                      <div style={styles.eventDate}>
                        <span>
                          {event.start_datetime
                            ? formatDate(event.start_datetime).split(" ")[0]
                            : event.start_time
                              ? formatDate(event.start_time).split(" ")[0]
                              : "—"}
                        </span>

                        <small>
                          {event.start_datetime
                            ? formatDate(event.start_datetime).slice(4)
                            : event.start_time
                              ? formatDate(event.start_time).slice(4)
                              : ""}
                          </small>
                      </div>
                      <div style={styles.eventInfo}>
                        <strong style={styles.eventTitle}>
                          {event.title}
                        </strong>

                        <span style={styles.eventMeta}>
                          {event.event_type} • {event.venue}
                        </span>
                      </div>
                      <ChevronRight size={17} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <span style={styles.panelEyebrow}>ADMINISTRATION</span>
                <h3 style={styles.panelTitle}>Quick Actions</h3>
                <p style={styles.panelSubtitle}>
                  Jump directly into the tools you use most.
                </p>
              </div>
            </div>

            <div className="admin-grid-4" style={styles.quickGrid}>
              {quickActions.map(([label, Icon, path]) => {
                return (
                  <button
                    key={String(label)}
                    type="button"
                    className="admin-quick"
                    style={styles.quickCard}
                    onClick={() => navigate(String(path))}
                  >
                    <div style={styles.quickIcon}>
                      <Icon size={19} />
                    </div>
                    <span style={styles.quickLabel}>{String(label)}</span>
                    <ArrowRight size={15} />
                  </button>
                );
              })}
            </div>
          </section>

          <footer style={styles.footer}>
            <span>© {new Date().getFullYear()} EduSphere</span>
            <span>Admin Console • Institution Operations</span>
          </footer>
        </div>
      </main>

      <AIChatbot />
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
    width: 480,
    height: 480,
    borderRadius: "50%",
    background: "rgba(59,130,246,.08)",
    filter: "blur(110px)",
    top: -250,
    right: -160,
    pointerEvents: "none",
  },
  glowTwo: {
    position: "fixed",
    width: 420,
    height: 420,
    borderRadius: "50%",
    background: "rgba(139,92,246,.07)",
    filter: "blur(110px)",
    bottom: -220,
    left: -160,
    pointerEvents: "none",
  },
  sidebar: {
    position: "fixed",
    inset: "0 auto 0 0",
    width: 270,
    padding: "22px 15px",
    background: "rgba(5,11,21,.86)",
    borderRight: "1px solid rgba(148,163,184,.12)",
    backdropFilter: "blur(24px)",
    zIndex: 20,
    display: "flex",
    flexDirection: "column",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 11,
    padding: "4px 9px 18px",
  },
  brandMark: {
    width: 40,
    height: 40,
    borderRadius: 12,
    display: "grid",
    placeItems: "center",
    background: "linear-gradient(135deg, rgba(59,130,246,.24), rgba(139,92,246,.18))",
    border: "1px solid rgba(96,165,250,.28)",
    color: "#93c5fd",
  },

  brandLogo: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    borderRadius: 10,
    display: "block",
  },
  brandTitle: {
    display: "block",
    fontSize: 14,
    letterSpacing: "1.7px",
  },
  brandSub: {
    display: "block",
    marginTop: 3,
    fontSize: 9,
    letterSpacing: "1.5px",
    color: "#64748b",
  },
  closeMobile: {
    display: "none",
    marginLeft: "auto",
    background: "transparent",
    border: 0,
    color: "#94a3b8",
  },
  rolePill: {
    margin: "0 7px 18px",
    padding: "9px 11px",
    borderRadius: 10,
    background: "rgba(255,255,255,.035)",
    border: "1px solid rgba(148,163,184,.10)",
    color: "#94a3b8",
    fontSize: 11,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  roleDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#60a5fa",
    boxShadow: "0 0 12px rgba(96,165,250,.8)",
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  navCaption: {
    color: "#475569",
    fontSize: 9,
    letterSpacing: "1.5px",
    padding: "0 11px 7px",
  },
  navItem: {
    width: "100%",
    border: "1px solid transparent",
    background: "transparent",
    color: "#94a3b8",
    padding: "10px 11px",
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    gap: 11,
    fontSize: 12,
    transition: "all .18s ease",
  },
  navItemActive: {
    background: "linear-gradient(90deg, rgba(59,130,246,.15), rgba(139,92,246,.07))",
    borderColor: "rgba(96,165,250,.17)",
    color: "#f8fafc",
  },
  navBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 999,
    padding: "0 6px",
    display: "grid",
    placeItems: "center",
    background: "rgba(245,158,11,.14)",
    color: "#fbbf24",
    fontSize: 10,
    fontWeight: 800,
  },
  sidebarBottom: {
    marginTop: "auto",
    paddingTop: 14,
    borderTop: "1px solid rgba(148,163,184,.10)",
  },
  accountCard: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 7px",
  },
  accountAvatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    background: "linear-gradient(135deg, #2563eb, #7c3aed)",
    fontSize: 12,
    fontWeight: 800,
  },

  profileAvatarImage: {
    width: "100%",
    height: "100%",
    display: "block",
    objectFit: "cover",
  },
  accountName: {
    display: "block",
    fontSize: 11,
    color: "#e2e8f0",
  },
  accountEmail: {
    display: "block",
    maxWidth: 180,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: 9,
    color: "#64748b",
    marginTop: 2,
  },
  logoutButton: {
    width: "100%",
    border: "1px solid rgba(148,163,184,.10)",
    background: "rgba(255,255,255,.025)",
    color: "#94a3b8",
    borderRadius: 10,
    padding: "9px 11px",
    display: "flex",
    alignItems: "center",
    gap: 9,
    fontSize: 11,
  },
  main: {
    marginLeft: 270,
    minHeight: "100vh",
    position: "relative",
    zIndex: 1,
  },
  topbar: {
    minHeight: 78,
    padding: "17px 32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid rgba(148,163,184,.09)",
    background: "rgba(5,11,21,.34)",
    backdropFilter: "blur(18px)",
  },
  topbarEyebrow: {
    color: "#64748b",
    fontSize: 9,
    letterSpacing: "1.6px",
  },
  topbarTitle: {
    margin: "4px 0 0",
    fontSize: 21,
    letterSpacing: "-.4px",
  },
  topbarActions: {
    display: "flex",
    alignItems: "center",
    gap: 9,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,.12)",
    background: "rgba(255,255,255,.035)",
    color: "#94a3b8",
    display: "grid",
    placeItems: "center",
  },
  topAvatar: {
    width: 36,
    height: 36,
    borderRadius: 11,
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    background: "linear-gradient(135deg, #2563eb, #7c3aed)",
    fontWeight: 800,
    fontSize: 12,
  },
  mobileMenu: {
    width: 38,
    height: 38,
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,.12)",
    background: "rgba(255,255,255,.035)",
    color: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  content: {
    height: "calc(100vh - 78px)",
    overflowY: "auto",
    padding: "28px 32px 35px",
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
    marginBottom: 18,
  },
  errorRetry: {
    marginLeft: "auto",
    background: "transparent",
    border: 0,
    color: "#fecdd3",
    fontWeight: 700,
  },
  hero: {
    minHeight: 230,
    borderRadius: 22,
    border: "1px solid rgba(148,163,184,.12)",
    background:
      "radial-gradient(circle at 78% 45%, rgba(59,130,246,.13), transparent 28%), linear-gradient(135deg, rgba(15,23,42,.94), rgba(10,18,32,.84))",
    padding: "31px 36px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    overflow: "hidden",
    position: "relative",
  },
  heroCopy: {
    maxWidth: 650,
    position: "relative",
    zIndex: 2,
  },
  heroKicker: {
    color: "#60a5fa",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "1.8px",
  },
  heroTitle: {
    fontSize: 34,
    lineHeight: 1.12,
    margin: "11px 0 10px",
    letterSpacing: "-1px",
  },
  heroText: {
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 1.7,
    maxWidth: 610,
    margin: 0,
  },
  heroMeta: {
    marginTop: 19,
    display: "flex",
    gap: 17,
    flexWrap: "wrap",
    color: "#64748b",
    fontSize: 10,
  },
  heroMetaItem: {},
  orb: {
    width: 165,
    height: 165,
    borderRadius: "50%",
    position: "relative",
    display: "grid",
    placeItems: "center",
    marginRight: 45,
  },
  orbRingOne: {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    border: "1px solid rgba(96,165,250,.24)",
    boxShadow: "0 0 45px rgba(59,130,246,.10)",
    animation: "spin 14s linear infinite",
  },
  orbRingTwo: {
    position: "absolute",
    inset: 17,
    borderRadius: "50%",
    border: "1px dashed rgba(167,139,250,.25)",
    animation: "spin 10s linear infinite reverse",
  },
  orbCore: {
    width: 88,
    height: 88,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    color: "#bfdbfe",
    background:
      "radial-gradient(circle at 35% 30%, rgba(147,197,253,.35), rgba(37,99,235,.13) 45%, rgba(76,29,149,.14))",
    border: "1px solid rgba(147,197,253,.28)",
    boxShadow: "inset 0 0 25px rgba(96,165,250,.10), 0 0 45px rgba(59,130,246,.14)",
  },
  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0,1fr))",
    gap: 13,
    marginTop: 15,
  },
  statCard: {
    position: "relative",
    textAlign: "left",
    display: "flex",
    gap: 12,
    minHeight: 122,
    padding: "17px 15px",
    borderRadius: 16,
    border: "1px solid rgba(148,163,184,.11)",
    background: "rgba(15,23,42,.66)",
    color: "#f8fafc",
    transition: "transform .18s ease, border-color .18s ease",
  },
  statIcon: {
    width: 37,
    height: 37,
    borderRadius: 11,
    display: "grid",
    placeItems: "center",
    color: "#93c5fd",
    background: "rgba(59,130,246,.10)",
    flex: "0 0 auto",
  },
  statBody: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  statLabel: {
    color: "#64748b",
    fontSize: 9,
    letterSpacing: ".7px",
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: 23,
    marginTop: 5,
    letterSpacing: "-.5px",
  },
  statDescription: {
    color: "#64748b",
    fontSize: 9,
    lineHeight: 1.45,
    marginTop: 4,
  },
  statArrow: {
    position: "absolute",
    right: 13,
    bottom: 13,
    color: "#475569",
  },
  twoColumn: {
    display: "grid",
    gridTemplateColumns: "1.12fr .88fr",
    gap: 15,
    marginTop: 15,
  },
  panel: {
    borderRadius: 17,
    border: "1px solid rgba(148,163,184,.11)",
    background: "rgba(10,18,32,.73)",
    padding: 20,
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
  },
  panelEyebrow: {
    color: "#60a5fa",
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: "1.4px",
  },
  panelTitle: {
    margin: "5px 0 3px",
    fontSize: 16,
    letterSpacing: "-.25px",
  },
  panelSubtitle: {
    color: "#64748b",
    fontSize: 10,
    margin: 0,
    lineHeight: 1.5,
  },
  viewAll: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    border: 0,
    background: "transparent",
    color: "#93c5fd",
    fontSize: 10,
    whiteSpace: "nowrap",
  },
  queue: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  queueItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 0",
    borderTop: "1px solid rgba(148,163,184,.07)",
  },
  queueAvatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    display: "grid",
    placeItems: "center",
    background: "rgba(96,165,250,.11)",
    border: "1px solid rgba(96,165,250,.15)",
    color: "#bfdbfe",
    fontWeight: 800,
    fontSize: 11,
    flex: "0 0 auto",
  },
  queueInfo: {
    minWidth: 0,
    flex: 1,
  },
  queueName: {
    display: "block",
    fontSize: 11,
  },
  queueMeta: {
    display: "block",
    color: "#94a3b8",
    fontSize: 9,
    marginTop: 2,
  },
  queueEmail: {
    display: "block",
    color: "#475569",
    fontSize: 8,
    marginTop: 2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  queueActions: {
    display: "flex",
    gap: 5,
  },
  approveButton: {
    border: "1px solid rgba(34,197,94,.18)",
    background: "rgba(34,197,94,.08)",
    color: "#86efac",
    borderRadius: 8,
    padding: "7px 8px",
    fontSize: 9,
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  rejectButton: {
    border: "1px solid rgba(244,63,94,.16)",
    background: "rgba(244,63,94,.06)",
    color: "#fda4af",
    borderRadius: 8,
    padding: "7px 8px",
    fontSize: 9,
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  emptyState: {
    minHeight: 180,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    color: "#64748b",
    fontSize: 10,
    textAlign: "center",
  },
  eventList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  eventItem: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 11,
    textAlign: "left",
    border: "1px solid rgba(148,163,184,.08)",
    background: "rgba(255,255,255,.018)",
    color: "#f8fafc",
    borderRadius: 11,
    padding: 10,
  },
  eventDate: {
    width: 42,
    height: 42,
    borderRadius: 10,
    display: "grid",
    placeItems: "center",
    alignContent: "center",
    background: "rgba(139,92,246,.10)",
    color: "#c4b5fd",
    flex: "0 0 auto",
  },
  quickGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0,1fr))",
    gap: 9,
  },
  quickCard: {
    minHeight: 74,
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "12px 11px",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,.09)",
    background: "rgba(255,255,255,.018)",
    color: "#e2e8f0",
    transition: "all .18s ease",
  },
  quickIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    display: "grid",
    placeItems: "center",
    background: "rgba(59,130,246,.09)",
    color: "#93c5fd",
    flex: "0 0 auto",
  },
  quickLabel: {
    fontSize: 10,
    flex: 1,
    textAlign: "left",
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    color: "#475569",
    fontSize: 9,
    padding: "18px 3px 5px",
  },
  eventInfo: {
    minWidth: 0,
    display: "flex",
    alignItems: "baseline",
    gap: 6,
    flexWrap: "wrap",
  },

  eventTitle: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.4,
  },

  eventMeta: {
    color: "#cbd5e1",
    fontSize: 13,
    lineHeight: 1.4,
    whiteSpace: "nowrap",
  },
};

const styleSheet = document.createElement("style");
styleSheet.textContent = `
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;
if (!document.head.querySelector('style[data-edusphere-admin-orb="true"]')) {
  styleSheet.dataset.edusphereAdminOrb = "true";
  document.head.appendChild(styleSheet);
}
