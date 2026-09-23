import { useCallback, useEffect, useRef, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  BookOpen,
  Building2,
  CheckCircle2,
  Clock3,
  Code2,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  RefreshCw,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Users,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./super-admin-dashboard.css";
import AIChatBot from "../../components/ai/AIChatbot";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

type PendingApplication = {
  user_id: number;
  full_name?: string;
  email?: string;
  institution_name?: string;
  institution_code?: string;
  submitted_at?: string;
};

type DashboardData = {
  institutions?: number;
  total_institutions?: number;
  users?: number;
  total_users?: number;
  students?: number;
  total_students?: number;
  professors?: number;
  total_professors?: number;
  admins?: number;
  total_admins?: number;
  courses?: number;
  total_courses?: number;
  marketplace?: number;
  total_listings?: number;
};

async function apiRequest<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
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

function firstNumber(
  data: DashboardData | null,
  keys: (keyof DashboardData)[],
) {
  for (const key of keys) {
    const value = data?.[key];
    if (typeof value === "number") return value;
  }
  return 0;
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
  value: number;
  description: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="sa-stat-card"
      onClick={onClick}
      disabled={!onClick}
    >
      <div className="sa-stat-icon">
        <Icon size={20} />
      </div>
      <div className="sa-stat-content">
        <span className="sa-stat-label">{label}</span>
        <strong>{value.toLocaleString()}</strong>
        <span className="sa-stat-description">{description}</span>
      </div>
      {onClick && <ArrowRight className="sa-stat-arrow" size={17} />}
    </button>
  );
}

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [data, setData] = useState<DashboardData | null>(null);
  const [applications, setApplications] = useState<PendingApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [audioOn, setAudioOn] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio("/super-admin-lofi-original.wav");
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 1.0;
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.currentTime = 0;
      audioRef.current = null;
    };
  }, []);

  const toggleAmbientMusic = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audioOn) {
      audio.pause();
      setAudioOn(false);
      return;
    }

    try {
      audio.volume = 1.0;
      await audio.play();
      setAudioOn(true);
    } catch (error) {
      console.error("Unable to start Super Admin lo-fi music:", error);
      setAudioOn(false);
    }
  }, [audioOn]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      // These endpoints are intentionally isolated so the dashboard can
      // continue working when one optional platform metric is unavailable.
      const [applicationsResponse, summaryResponse] = await Promise.all([
        apiRequest<{ applications?: PendingApplication[] }>(
          "/admin/admin-applications/pending",
        ),
        apiRequest<DashboardData>("/super-admin/dashboard/summary"),
      ]);

      setApplications(applicationsResponse.applications ?? []);
      setData(summaryResponse);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load Super Admin dashboard.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const displayName =
    user?.full_name || user?.email?.split("@")[0] || "Super Admin";

  const navigationItems = useMemo(
    () => [
      {
        label: "Dashboard",
        icon: LayoutDashboard,
        path: "/app/super-admin",
      },
      {
        label: "Institutions",
        icon: Building2,
        path: "/app/super-admin/institutions",
      },
      {
        label: "Admin Applications",
        icon: ShieldCheck,
        path: "/app/super-admin/admin-requests",
        badge: applications.length || undefined,
      },
      {
        label: "Developer Verification",
        icon: Code2,
        path: "/app/super-admin/developer-verifications",
      },
      {
        label: "Developer Submissions",
        icon: Code2,
        path: "/app/super-admin/developer-submissions",
      },
      {
        label: "Users",
        icon: Users,
        path: "/app/super-admin/users",
      },
      {
        label: "Courses",
        icon: GraduationCap,
        path: "/app/super-admin/courses",
      },
      {
        label: "Library",
        icon: BookOpen,
        path: "/app/super-admin/library",
      },
      {
        label: "System Activity",
        icon: Activity,
        path: "/app/super-admin/activity",
      },
      {
        label: "Marketplace",
        icon: ShoppingCart,
        path: "/app/super-admin/marketplace",
      },
      {
        label: "Marketplace Management",
        icon: Settings,
        path: "/app/super-admin/marketplace-management",
      },
      {
        label: "EduSphere AI",
        icon: Sparkles,
        path: "/app/super-admin/edusphere-ai",
      },
    ],
    [applications.length],
  );

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate("/", { replace: true });
    }
  };

  const stats = [
    {
      icon: Building2,
      label: "Institutions",
      value: firstNumber(data, ["institutions", "total_institutions"]),
      description: "Platform institutions",
      path: "/app/super-admin/institutions",
    },
    {
      icon: ShoppingCart,
      label: "Marketplace",
      value: firstNumber(data, ["marketplace", "total_listings"]),
      description: "Active listings",
      path: "/app/super-admin/marketplace",
    },
    {
      icon: Users,
      label: "Total Users",
      value: firstNumber(data, ["users", "total_users"]),
      description: "Across EduSphere",
      path: "/app/super-admin/users",
    },
    {
      icon: GraduationCap,
      label: "Students",
      value: firstNumber(data, ["students", "total_students"]),
      description: "Student accounts",
      path: "/app/super-admin/users?role=STUDENT",
    },
    {
      icon: Users,
      label: "Professors",
      value: firstNumber(data, ["professors", "total_professors"]),
      description: "Professor accounts",
      path: "/app/super-admin/users?role=PROFESSOR",
    },
    {
      icon: ShieldCheck,
      label: "Admins",
      value: firstNumber(data, ["admins", "total_admins"]),
      description: "Institution admins",
      path: "/app/super-admin/users?role=ADMIN",
    },
    {
      icon: GraduationCap,
      label: "Courses",
      value: firstNumber(data, ["courses", "total_courses"]),
      description: "Platform courses",
      path: "/app/super-admin/courses",
    },
  ];

  if (loading) {
    return (
      <div className="sa-page sa-loading-page">
        <div className="sa-loading-orb">
          <div className="sa-orbit sa-orbit-one" />
          <div className="sa-orbit sa-orbit-two" />
          <div className="sa-core">
            <ShieldCheck size={30} />
          </div>
        </div>
        <h2>Loading Super Admin Control Center</h2>
        <p>Connecting to the EduSphere platform...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sa-page sa-error-page">
        <div className="sa-error-card">
          <div className="sa-error-icon"><XCircle size={28} /></div>
          <h2>Dashboard connection failed</h2>
          <p>{error}</p>
          <div className="sa-actions">
            <button className="sa-primary-btn" onClick={loadDashboard}>
              <RefreshCw size={16} /> Retry
            </button>
            <button className="sa-secondary-btn" onClick={handleLogout}>
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sa-page">
      <div className="sa-shell">
        <aside className={`sa-sidebar ${mobileOpen ? "open" : ""}`}>
          <div className="sa-brand">
            <img src="/edusphere-logo.jpeg" alt="EduSphere" />
            <div>
              <strong>EduSphere</strong>
              <span>SUPER ADMIN</span>
            </div>
          </div>

          <nav>
            <span className="sa-nav-title">PLATFORM</span>
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  className={`sa-nav-item ${item.path === "/app/super-admin" ? "active" : ""}`}
                  onClick={() => {
                    setMobileOpen(false);
                    navigate(item.path);
                  }}
                >
                  <Icon size={17} />
                  <span>{item.label}</span>
                  {item.badge ? <b>{item.badge}</b> : null}
                </button>
              );
            })}
          </nav>

          <div className="sa-sidebar-bottom">
            <div className="sa-account">
              <div className="sa-avatar sa-profile-logo">
                <img
                  src="/edusphere-logo.jpeg"
                  alt="EduSphere"
                />
              </div>
              <div>
                <strong>{displayName}</strong>
                <span>Platform Owner</span>
              </div>
            </div>
            <button className="sa-logout" onClick={handleLogout}>
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </aside>

        {mobileOpen && (
          <button
            className="sa-mobile-backdrop"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
        )}

        <main className="sa-main">
          <header className="sa-topbar">
            <button
              className="sa-menu-btn"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>

            <div className="sa-top-title">
              <span>EDUSPHERE PLATFORM</span>
              <strong>Super Admin Control Center</strong>
            </div>

            <div className="sa-top-actions">
              <button
                className={`sa-music-btn ${audioOn ? "on" : ""}`}
                onClick={toggleAmbientMusic}
                title="Ambient mode"
              >
                <span className="sa-music-bars">
                  <i /><i /><i /><i />
                </span>
                {audioOn ? "Ambient On" : "Ambient"}
              </button>
              <button className="sa-refresh" onClick={loadDashboard} title="Refresh">
                <RefreshCw size={17} />
              </button>
            </div>
          </header>

          <section className="sa-hero">
            <div>
              <span className="sa-eyebrow">PLATFORM CONTROL</span>
              <h1>Welcome, {displayName}</h1>
              <p>
                Manage the entire EduSphere ecosystem from one central control
                center.
              </p>
              <div className="sa-status">
                <span className="sa-status-dot" />
                Super Admin access active
              </div>
            </div>

            <div className="sa-hologram" aria-hidden="true">
              <div className="sa-holo-grid" />
              <div className="sa-holo-ring ring-a" />
              <div className="sa-holo-ring ring-b" />
              <div className="sa-holo-ring ring-c" />
              <div className="sa-holo-core">
                <div className="sa-shield-object">
                  <ShieldCheck size={38} />
                </div>
                <span>CONTROL</span>
              </div>
              <div className="sa-holo-dot dot-a" />
              <div className="sa-holo-dot dot-b" />
              <div className="sa-holo-dot dot-c" />
            </div>
          </section>

          <section className="sa-stats-grid">
            {stats.map((stat) => (
              <StatCard
                key={stat.label}
                icon={stat.icon}
                label={stat.label}
                value={stat.value}
                description={stat.description}
                onClick={() => navigate(stat.path)}
              />
            ))}
          </section>

          <section className="sa-content-grid">
            <div className="sa-panel">
              <div className="sa-panel-head">
                <div>
                  <span>ACCESS CONTROL</span>
                  <h2>Admin Applications</h2>
                </div>
                <button
                  className="sa-link-btn"
                  onClick={() => navigate("/app/super-admin/admin-requests")}
                >
                  View all <ArrowRight size={15} />
                </button>
              </div>

              {applications.length === 0 ? (
                <div className="sa-empty">
                  <CheckCircle2 size={25} />
                  <strong>No pending applications</strong>
                  <span>The admin verification queue is clear.</span>
                </div>
              ) : (
                <div className="sa-application-list">
                  {applications.slice(0, 4).map((application) => (
                    <button
                      type="button"
                      key={application.user_id}
                      className="sa-application"
                      onClick={() =>
                        navigate("/app/super-admin/admin-requests")
                      }
                    >
                      <div className="sa-application-avatar">
                        {(application.full_name || "A").slice(0, 1).toUpperCase()}
                      </div>
                      <div className="sa-application-info">
                        <strong>{application.full_name || "Admin Applicant"}</strong>
                        <span>{application.email || "Email unavailable"}</span>
                        <small>
                          {application.institution_name ||
                            application.institution_code ||
                            "Institution not specified"}
                        </small>
                      </div>
                      <span className="sa-pending">
                        <Clock3 size={13} /> Pending
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="sa-panel">
              <div className="sa-panel-head">
                <div>
                  <span>PLATFORM HEALTH</span>
                  <h2>System Overview</h2>
                </div>
                <Activity size={20} />
              </div>

              <div className="sa-health">
                <div className="sa-health-row">
                  <div><span className="sa-health-dot" /> Authentication</div>
                  <strong>Operational</strong>
                </div>
                <div className="sa-health-row">
                  <div><span className="sa-health-dot" /> Database</div>
                  <strong>Operational</strong>
                </div>
                <div className="sa-health-row">
                  <div><span className="sa-health-dot" /> Platform Access</div>
                  <strong>Operational</strong>
                </div>
                <div className="sa-health-row">
                  <div><span className="sa-health-dot" /> Admin Verification</div>
                  <strong>{applications.length} Pending</strong>
                </div>
              </div>

              <div className="sa-quick-actions">
                <button onClick={() => navigate("/app/super-admin/institutions")}>
                  <Building2 size={16} /> Manage Institutions
                </button>
                <button onClick={() => navigate("/app/super-admin/admin-requests")}>
                  <ShieldCheck size={16} /> Review Admin Requests
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>
      <AIChatBot />
    </div>
  );
}
