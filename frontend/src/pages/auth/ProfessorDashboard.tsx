import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  GraduationCap,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  RefreshCw,
  ShieldCheck,
  Store,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import AIChatbot from "../../components/ai/AIChatbot";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8000";

interface Professor {
  professor_id?: number;
  user_id?: number;
  email?: string;
  full_name?: string;
  phone?: string;
  employee_id?: string;
  department?: string;
  designation?: string;
  specialization?: string;
  subjects?: string;
  academic_experience?: string;
  office_information?: string;
  verification_details?: string;
  profile_completed?: boolean;
  verification_status?: string;
}

interface Course {
  course_id?: number;
  id?: number;
  name?: string;
  course_name?: string;
  code?: string;
  course_code?: string;
  title?: string;
  [key: string]: unknown;
}

interface TimetableItem {
  timetable_id?: number;
  day?: string | number | null;
  start_time?: string | number | null;
  end_time?: string | number | null;
  room?: string | number | null;
  program_id?: number;
  program_name?: string;
  program_code?: string;
  section_id?: number;
  section_name?: string;
  section_code?: string;
  academic_year?: string;
  current_year?: number;
  course_id?: number;
  course_name?: string;
  course_code?: string;
  [key: string]: unknown;
}

interface DashboardResponse {
  message?: string;

  professor: Professor;

  courses?: {
    count: number;
    items: Course[];
  };

  timetable?: {
    count: number;
    items: TimetableItem[];
  };
}

async function apiRequest<T>(
  endpoint: string,
): Promise<T> {
  const response = await fetch(
    `${API_BASE_URL}${endpoint}`,
    {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    },
  );

  let data: unknown = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    if (
      typeof data === "object" &&
      data !== null &&
      "detail" in data
    ) {
      const detail = (
        data as {
          detail?: unknown;
        }
      ).detail;

      if (typeof detail === "string") {
        message = detail;
      }
    }

    throw new Error(message);
  }

  return data as T;
}

function getInitials(
  name?: string,
): string {
  if (!name) {
    return "P";
  }

  return name
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatTime(value?: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const totalSeconds = Math.max(0, Math.floor(value));
    const hour = Math.floor(totalSeconds / 3600) % 24;
    const minute = Math.floor((totalSeconds % 3600) / 60);
    const suffix = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;

    return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
  }

  const text = String(value).trim();
  if (!text) {
    return "—";
  }

  const match = text.match(/^(\d{1,2}):([0-5]\d)/);

  if (!match) {
    return text;
  }

  const hour = Number(match[1]);
  const minute = match[2];

  if (!Number.isFinite(hour)) {
    return text;
  }

  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${minute} ${suffix}`;
}

function normalizeDay(
  day?: string,
): string {
  if (!day) {
    return "Unknown";
  }

  return (
    day.charAt(0).toUpperCase() +
    day.slice(1).toLowerCase()
  );
}

function VerificationBadge({
  status,
}: {
  status?: string;
}) {
  const normalized =
    String(status || "").toUpperCase();

  if (normalized === "VERIFIED") {
    return (
      <span style={styles.verifiedBadge}>
        <CheckCircle2 size={15} />
        Verified
      </span>
    );
  }

  if (normalized === "REJECTED") {
    return (
      <span style={styles.rejectedBadge}>
        <ShieldCheck size={15} />
        Rejected
      </span>
    );
  }

  return (
    <span style={styles.pendingBadge}>
      <Clock3 size={15} />
      Pending Verification
    </span>
  );
}

export default function ProfessorDashboard() {
  const navigate = useNavigate();

  const {
    user,
    logout,
  } = useAuth();

  const [
    dashboard,
    setDashboard,
  ] = useState<
    DashboardResponse | null
  >(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    mobileMenuOpen,
    setMobileMenuOpen,
  ] = useState(false);

  const loadDashboard =
    async () => {
      setLoading(true);
      setError("");

      try {
        const data =
          await apiRequest<DashboardResponse>(
            "/professor/dashboard/",
          );

        setDashboard(data);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load professor dashboard.",
        );
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    loadDashboard();
  }, []);

  const professor =
    dashboard?.professor;

  const courses =
    dashboard?.courses?.items || [];

  const timetable =
    dashboard?.timetable?.items || [];

  const courseCount =
    dashboard?.courses?.count ??
    courses.length;

  const timetableCount =
    dashboard?.timetable?.count ??
    timetable.length;

  const professorName =
    professor?.full_name ||
    user?.full_name ||
    "Professor";

  const professorEmail =
    professor?.email ||
    user?.email ||
    "";

  const handleLogout =
    async () => {
      try {
        await logout();
      } finally {
        navigate("/", {
          replace: true,
        });
      }
    };

  const navigationItems = [
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      active: true,
      onClick: () => navigate("/app/professor"),
    },
    {
      label: "My Courses",
      icon: BookOpen,
      active: false,
      onClick: () => navigate("/app/professor/courses"),
    },
    {
      label: "Students",
      icon: Users,
      active: false,
      onClick: () => navigate("/app/professor/students"),
    },
    {
      label: "Timetable",
      icon: CalendarDays,
      active: false,
      onClick: () => navigate("/app/professor/timetable") ,
    },
    {
      label: "Attendance",
      icon: CheckCircle2,
      active: false,
      onClick: () => navigate("/app/professor/attendance"),
    },
    {
      label: "Results",
      icon: GraduationCap,
      active: false,
      onClick: () => navigate("/app/professor/results"),
    },
    {
      label: "Marketplace",
      icon: Store,
      active: false,
      onClick: () => navigate("/app/professor/marketplace"),
    },
    {
      label: "Library",
      icon: BookOpen,
      active: false,
      onClick: () => navigate("/app/library"),
    },
    {
      label: "Profile",
      icon: UserRound,
      active: false,
      onClick: () =>
        navigate("/auth/profile/professor"),
    },
  ];

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingState}>
          <div style={styles.loadingIcon}>
            <Loader2
              size={28}
              style={styles.spinner}
            />
          </div>

          <h2 style={styles.loadingTitle}>
            Loading Professor Dashboard
          </h2>

          <p style={styles.loadingText}>
            Connecting to your EduSphere
            academic workspace...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.page}>
        <div style={styles.errorState}>
          <div style={styles.errorIcon}>
            <X size={28} />
          </div>

          <h2 style={styles.errorTitle}>
            Dashboard connection failed
          </h2>

          <p style={styles.errorMessage}>
            {error}
          </p>

          <div style={styles.errorActions}>
            <button
              type="button"
              style={styles.primaryButton}
              onClick={loadDashboard}
            >
              <RefreshCw size={17} />
              Retry Connection
            </button>

            <button
              type="button"
              style={styles.secondaryButton}
              onClick={handleLogout}
            >
              <LogOut size={17} />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <style>{`
        /* EduSphere 3D academic orb */
        .edu-3d-scene { width:150px; height:150px; position:relative; perspective:800px; display:grid; place-items:center; }
        .edu-3d-orb { width:105px; height:105px; position:relative; transform-style:preserve-3d; animation:eduOrbFloat 5s ease-in-out infinite; }
        .edu-3d-core {
          position:absolute; inset:21px; border-radius:50%; display:grid; place-items:center; color:#dbeafe;
          background:radial-gradient(circle at 32% 25%,rgba(255,255,255,.32),transparent 18%),radial-gradient(circle at 45% 40%,#3b82f6 0%,#4f46e5 45%,#6d28d9 100%);
          border:1px solid rgba(191,219,254,.55);
          box-shadow:inset -10px -12px 24px rgba(15,23,42,.32),inset 7px 7px 16px rgba(255,255,255,.16),0 0 35px rgba(59,130,246,.34);
          transform:translateZ(22px);
        }
        .edu-3d-ring { position:absolute; inset:2px; border:2px solid rgba(147,197,253,.52); border-radius:50%; transform-style:preserve-3d; }
        .edu-3d-ring-a { transform:rotateX(67deg) rotateZ(-18deg); animation:eduRingA 6s linear infinite; }
        .edu-3d-ring-b { transform:rotateY(67deg) rotateZ(18deg); border-color:rgba(196,181,253,.42); animation:eduRingB 7s linear infinite reverse; }
        .edu-3d-ring-c { transform:rotateX(18deg) rotateY(70deg); border-color:rgba(96,165,250,.32); animation:eduRingC 8s linear infinite; }
        .edu-3d-dot { position:absolute; width:8px; height:8px; border-radius:50%; background:#bfdbfe; box-shadow:0 0 14px rgba(96,165,250,.9); }
        .edu-3d-dot-a { top:14px; right:24px; animation:eduDotA 4s ease-in-out infinite; }
        .edu-3d-dot-b { bottom:19px; left:20px; background:#c4b5fd; box-shadow:0 0 14px rgba(139,92,246,.9); animation:eduDotB 4.7s ease-in-out infinite; }
        .edu-3d-dot-c { top:66px; left:7px; width:5px; height:5px; animation:eduDotC 3.8s ease-in-out infinite; }
        @keyframes eduOrbFloat { 0%,100%{transform:translateY(0) rotateX(2deg) rotateY(-8deg)} 50%{transform:translateY(-8px) rotateX(-4deg) rotateY(12deg)} }
        @keyframes eduRingA { to{transform:rotateX(67deg) rotateZ(342deg)} }
        @keyframes eduRingB { to{transform:rotateY(427deg) rotateZ(18deg)} }
        @keyframes eduRingC { to{transform:rotateX(378deg) rotateY(70deg)} }
        @keyframes eduDotA { 0%,100%{transform:translate3d(0,0,0) scale(1)} 50%{transform:translate3d(8px,-7px,16px) scale(1.2)} }
        @keyframes eduDotB { 0%,100%{transform:translate3d(0,0,0)} 50%{transform:translate3d(-7px,7px,12px)} }
        @keyframes eduDotC { 0%,100%{transform:translate3d(0,0,0)} 50%{transform:translate3d(-4px,-9px,8px)} }
        @media (prefers-reduced-motion: reduce) {
          .edu-3d-orb,.edu-3d-ring,.edu-3d-dot { animation:none !important; }
        }
`}</style>

      {/* Background decoration */}

      <div
        style={styles.backgroundGlowOne}
      />

      <div
        style={styles.backgroundGlowTwo}
      />

      {/* Mobile overlay */}

      {mobileMenuOpen && (
        <div
          style={styles.mobileOverlay}
          onClick={() =>
            setMobileMenuOpen(false)
          }
        />
      )}

      <aside
        style={{
          ...styles.sidebar,
          ...(mobileMenuOpen
            ? styles.sidebarMobileOpen
            : {}),
        }}
      >
        <div style={styles.sidebarHeader}>

          <div
            style={styles.logoContainer}
          >
            <img
              src="/edusphere-logo.jpeg"
              alt="EduSphere"
              style={styles.logo}
            />
          </div>

          <div>
            <div style={styles.brandName}>
              EduSphere
            </div>

            <div style={styles.brandRole}>
              Professor Workspace
            </div>
          </div>

          <button
            type="button"
            style={styles.mobileClose}
            onClick={() =>
              setMobileMenuOpen(false)
            }
          >
            <X size={20} />
          </button>
        </div>

        <nav style={styles.navigation}>
          {navigationItems.map(
            (item) => {
              const Icon =
                item.icon;

              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    item.onClick();
                    setMobileMenuOpen(
                      false,
                    );
                  }}
                  style={{
                    ...styles.navItem,
                    ...(item.active
                      ? styles.navItemActive
                      : {}),
                  }}
                >
                  <Icon size={18} />

                  <span>
                    {item.label}
                  </span>
                </button>
              );
            },
          )}
        </nav>

        <div style={styles.sidebarBottom}>
          <div style={styles.sidebarUser}>
            <div style={styles.smallAvatar}>
              {getInitials(
                professorName,
              )}
            </div>

            <div
              style={
                styles.sidebarUserInfo
              }
            >
              <strong>
                {professorName}
              </strong>

              <span style={{ fontSize: 10, letterSpacing: "0px" }}>
                {professorEmail}
              </span>
            </div>
          </div>

          <button
            type="button"
            style={styles.logoutButton}
            onClick={handleLogout}
          >
            <LogOut size={17} />
            Sign Out
          </button>
        </div>
      </aside>

      <div style={styles.mainWrapper}>

        {/* Top bar */}

        <header style={styles.topbar}>

          <button
            type="button"
            style={styles.menuButton}
            onClick={() =>
              setMobileMenuOpen(true)
            }
          >
            <Menu size={21} />
          </button>

          <div>
            <div style={styles.pageEyebrow}>
              PROFESSOR WORKSPACE
            </div>

            <h1 style={styles.pageTitle}>
              Dashboard
            </h1>
          </div>

          <div style={styles.topbarRight}>
            <VerificationBadge
              status={
                professor?.verification_status
              }
            />

            <button
              type="button"
              style={styles.profileButton}
              onClick={() =>
                navigate(
                  "/auth/profile/professor",
                )
              }
            >
              <div
                style={styles.topAvatar}
              >
                {getInitials(
                  professorName,
                )}
              </div>

              <span>
                {professorName}
              </span>
            </button>
          </div>

        </header>

        <main style={styles.content}>

          {/* Welcome section */}

          <section
            style={styles.welcomeCard}
          >
            <div>
              <div
                style={styles.welcomeEyebrow}
              >
                Welcome back
              </div>

              <h2
                style={styles.welcomeTitle}
              >
                Hello,{" "}
                {professorName}
              </h2>

              <p
                style={styles.welcomeText}
              >
                Manage your courses,
                timetable, students and
                academic activities from
                one place.
              </p>

              <div
                style={
                  styles.professorMeta
                }
              >
                {professor?.designation && (
                  <span>
                    {professor.designation}
                  </span>
                )}

                {professor?.department && (
                  <span>
                    {professor.department}
                  </span>
                )}

                {professor?.employee_id && (
                  <span>
                    ID:{" "}
                    {
                      professor.employee_id
                    }
                  </span>
                )}
              </div>
            </div>

            <div style={styles.welcomeIllustration}>
              <div className="edu-3d-scene" aria-hidden="true">
                <div className="edu-3d-orb">
                  <div className="edu-3d-ring edu-3d-ring-a" />
                  <div className="edu-3d-ring edu-3d-ring-b" />
                  <div className="edu-3d-ring edu-3d-ring-c" />
                  <div className="edu-3d-core">
                    <GraduationCap size={43} strokeWidth={1.25} />
                  </div>
                </div>
                <span className="edu-3d-dot edu-3d-dot-a" />
                <span className="edu-3d-dot edu-3d-dot-b" />
                <span className="edu-3d-dot edu-3d-dot-c" />
              </div>
            </div>
          </section>

          {/* Statistics */}

          <section style={styles.statsGrid}>

            <div
              style={{ ...styles.statCard, cursor: "pointer" }}
              onClick={() => navigate("/app/professor/courses")}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  navigate("/app/professor/courses");
                }
              }}
            >
              <div
                style={styles.statIconBlue}
              >
                <BookOpen size={21} />
              </div>

              <div>
                <span
                  style={
                    styles.statLabel
                  }
                >
                  My Courses
                </span>

                <strong
                  style={
                    styles.statValue
                  }
                >
                  {courseCount}
                </strong>
              </div>

              <ArrowRight
                size={17}
                style={styles.statArrow}
              />
            </div>

            <div
              style={{ ...styles.statCard, cursor: "pointer" }}
              onClick={() => navigate("/app/professor/timetable")}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  navigate("/app/professor/timetable");
                }
              }}
            >
              <div
                style={styles.statIconPurple}
              >
                <CalendarDays
                  size={21}
                />
              </div>

              <div>
                <span
                  style={
                    styles.statLabel
                  }
                >
                  Timetable
                </span>

                <strong
                  style={
                    styles.statValue
                  }
                >
                  {timetableCount}
                </strong>
              </div>

              <ArrowRight
                size={17}
                style={styles.statArrow}
              />
            </div>

            <div style={styles.statCard}>
              <div
                style={styles.statIconGreen}
              >
                <Users size={21} />
              </div>

              <div>
                <span
                  style={
                    styles.statLabel
                  }
                >
                  Department
                </span>

                <strong
                  style={{
                    ...styles.statValueSmall,
                  }}
                >
                  {professor?.department ||
                    "—"}
                </strong>
              </div>
            </div>

            <div style={styles.statCard}>
              <div
                style={styles.statIconOrange}
              >
                <ShieldCheck
                  size={21}
                />
              </div>

              <div>
                <span
                  style={
                    styles.statLabel
                  }
                >
                  Verification
                </span>

                <strong
                  style={
                    styles.statValueSmall
                  }
                >
                  {String(
                    professor?.verification_status ||
                      "PENDING",
                  ).replace(
                    "_",
                    " ",
                  )}
                </strong>
              </div>
            </div>

          </section>

          {/* Main grid */}

          <section style={styles.mainGrid}>

            {/* Courses */}

            <div style={styles.card}>

              <div
                style={
                  styles.cardHeader
                }
              >
                <div>
                  <h2
                    style={
                      styles.cardTitle
                    }
                  >
                    My Courses
                  </h2>

                  <p
                    style={
                      styles.cardSubtitle
                    }
                  >
                    Courses assigned to you
                  </p>
                </div>

                <button
                  type="button"
                  style={
                    styles.cardAction
                  }
                  onClick={() => navigate("/app/professor/courses")}
                >
                  View All
                  <ArrowRight
                    size={15}
                  />
                </button>
              </div>

              {courses.length === 0 ? (
                <div
                  style={
                    styles.emptyState
                  }
                >
                  <BookOpen
                    size={28}
                  />

                  <p>
                    No courses assigned
                    yet.
                  </p>
                </div>
              ) : (
                <div
                  style={
                    styles.courseList
                  }
                >
                  {courses
                    .slice(0, 5)
                    .map(
                      (
                        course,
                        index,
                      ) => {
                        const name =
                          course.name ||
                          course.course_name ||
                          course.title ||
                          "Untitled Course";

                        const code =
                          course.code ||
                          course.course_code ||
                          "—";

                        const id =
                          course.course_id ||
                          course.id ||
                          index;

                        return (
                          <div
                            key={String(
                              id,
                            )}
                            style={
                              styles.courseItem
                            }
                          >
                            <div
                              style={
                                styles.courseIcon
                              }
                            >
                              <BookOpen
                                size={
                                  17
                                }
                              />
                            </div>

                            <div
                              style={
                                styles.courseInfo
                              }
                            >
                              <strong>
                                {name}
                              </strong>

                              <span>
                                {code}
                              </span>
                            </div>

                            <ArrowRight
                              size={
                                16
                              }
                              style={
                                styles.itemArrow
                              }
                            />
                          </div>
                        );
                      },
                    )}
                </div>
              )}

            </div>

            {/* Profile */}

            <div style={styles.card}>

              <div
                style={
                  styles.cardHeader
                }
              >
                <div>
                  <h2
                    style={
                      styles.cardTitle
                    }
                  >
                    Professor Profile
                  </h2>

                  <p
                    style={
                      styles.cardSubtitle
                    }
                  >
                    Your academic information
                  </p>
                </div>

                <button
                  type="button"
                  style={
                    styles.cardAction
                  }
                  onClick={() =>
                    navigate(
                      "/auth/profile/professor",
                    )
                  }
                >
                  Edit
                  <ArrowRight
                    size={15}
                  />
                </button>
              </div>

              <div
                style={
                  styles.profileSummary
                }
              >
                <div
                  style={
                    styles.largeAvatar
                  }
                >
                  {getInitials(
                    professorName,
                  )}
                </div>

                <div
                  style={
                    styles.profileSummaryText
                  }
                >
                  <h3>
                    {professorName}
                  </h3>

                  <p>
                    {professor?.designation ||
                      "Professor"}
                  </p>

                  <span>
                    {professor?.department ||
                      "Department not specified"}
                  </span>
                </div>
              </div>

              <div
                style={
                  styles.profileDetails
                }
              >
                <div
                  style={
                    styles.profileDetail
                  }
                >
                  <span>
                    Employee ID
                  </span>

                  <strong>
                    {professor?.employee_id ||
                      "—"}
                  </strong>
                </div>

                <div
                  style={
                    styles.profileDetail
                  }
                >
                  <span>
                    Specialization
                  </span>

                  <strong>
                    {professor?.specialization ||
                      "—"}
                  </strong>
                </div>

                <div
                  style={
                    styles.profileDetail
                  }
                >
                  <span>
                    Subjects
                  </span>

                  <strong>
                    {professor?.subjects ||
                      "—"}
                  </strong>
                </div>
              </div>

            </div>

          </section>

          {/* Timetable */}

          <section style={styles.card}>

            <div
              style={
                styles.cardHeader
              }
            >
              <div>
                <h2
                  style={
                    styles.cardTitle
                  }
                >
                  Today's / Upcoming Timetable
                </h2>

                <p
                  style={
                    styles.cardSubtitle
                  }
                >
                  Your scheduled academic
                  sessions
                </p>
              </div>

              <button
                type="button"
                style={
                  styles.cardAction
                }
                onClick={() => {}}
              >
                Full Timetable
                <ArrowRight
                  size={15}
                />
              </button>
            </div>

            {timetable.length === 0 ? (
              <div
                style={
                  styles.emptyState
                }
              >
                <CalendarDays
                  size={28}
                />

                <p>
                  No timetable entries
                  available.
                </p>
              </div>
            ) : (
              <div
                style={
                  styles.timetableList
                }
              >
                {timetable
                  .slice(0, 8)
                  .map(
                    (
                      item,
                      index,
                    ) => (
                      <div
                        key={
                          item.timetable_id ||
                          index
                        }
                        style={
                          styles.timetableItem
                        }
                      >
                        <div
                          style={
                            styles.dayBlock
                          }
                        >
                          <span>
                            {normalizeDay(
                              item.day == null
                                ? undefined
                                : String(item.day),
                            )}
                          </span>

                          <strong>
                            {formatTime(
                              item.start_time,
                            )}
                          </strong>
                        </div>

                        <div
                          style={
                            styles.timelineLine
                          }
                        />

                        <div
                          style={
                            styles.timetableInfo
                          }
                        >
                          <strong>
                            {item.course_name ||
                              "Course"}
                          </strong>

                          <span>
                            {item.course_code ||
                              "—"}
                          </span>

                          <div
                            style={
                              styles.timetableMeta
                            }
                          >
                            {item.room && (
                              <span>
                                Room{" "}
                                {
                                  item.room
                                }
                              </span>
                            )}

                            {item.section_name && (
                              <span>
                                Section{" "}
                                {
                                  item.section_name
                                }
                              </span>
                            )}

                            {item.program_name && (
                              <span>
                                {
                                  item.program_name
                                }
                              </span>
                            )}
                          </div>
                        </div>

                        <div
                          style={
                            styles.timeRange
                          }
                        >
                          {formatTime(
                            item.start_time,
                          )}
                          {" – "}
                          {formatTime(
                            item.end_time,
                          )}
                        </div>
                      </div>
                    ),
                  )}
              </div>
            )}

          </section>

          {/* Quick actions */}

          <section style={styles.card}>

            <div
              style={
                styles.cardHeader
              }
            >
              <div>
                <h2
                  style={
                    styles.cardTitle
                  }
                >
                  Quick Actions
                </h2>

                <p
                  style={
                    styles.cardSubtitle
                  }
                >
                  Frequently used professor
                  tools
                </p>
              </div>
            </div>

            <div
              style={
                styles.quickActions
              }
            >

              <button
                type="button"
                style={
                  styles.quickAction
                }
                onClick={() => navigate("/app/professor/courses")}
              >
                <BookOpen size={21} />

                <span>
                  Manage Courses
                </span>

                <ArrowRight
                  size={16}
                />
              </button>

              <button
                type="button"
                style={
                  styles.quickAction
                }
                onClick={() => navigate("/app/professor/students")}
              >
                <Users size={21} />

                <span>
                  View Students
                </span>

                <ArrowRight
                  size={16}
                />
              </button>

              <button
                type="button"
                style={
                  styles.quickAction
                }
                onClick={() => navigate("/app/professor/timetable")}
              >
                <CalendarDays
                  size={21}
                />

                <span>
                  View Timetable
                </span>

                <ArrowRight
                  size={16}
                />
              </button>

              <button
                type="button"
                style={
                  styles.quickAction
                }
                onClick={() =>
                  navigate(
                    "/app/professor/marketplace",
                  )
                }
              >
                <Store size={21} />

                <span>
                  Marketplace
                </span>

                <ArrowRight
                  size={16}
                />
              </button>

              <button
                type="button"
                style={
                  styles.quickAction
                }
                onClick={() =>
                  navigate(
                    "/auth/profile/professor",
                  )
                }
              >
                <UserRound size={21} />

                <span>
                  Edit Profile
                </span>

                <ArrowRight
                  size={16}
                />
              </button>

            </div>

          </section>

        </main>

        <AIChatbot />

        <footer style={styles.footer}>
          <span>
            © {new Date().getFullYear()}{" "}
            EduSphere
          </span>

          <span>
            Professor Workspace
          </span>
        </footer>

      </div>
    </div>
  );
}

/* ==============================================================
   STYLES
============================================================== */

const styles: Record<
  string,
  React.CSSProperties
> = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(135deg, #07111f 0%, #0b1728 50%, #101827 100%)",
    color: "#f8fafc",
    position: "relative",
    overflow: "hidden",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  },

  backgroundGlowOne: {
    position: "fixed",
    width: 460,
    height: 460,
    borderRadius: "50%",
    background:
      "rgba(59, 130, 246, 0.09)",
    filter: "blur(100px)",
    top: -220,
    right: -150,
    pointerEvents: "none",
  },

  backgroundGlowTwo: {
    position: "fixed",
    width: 400,
    height: 400,
    borderRadius: "50%",
    background:
      "rgba(139, 92, 246, 0.08)",
    filter: "blur(100px)",
    bottom: -200,
    left: -150,
    pointerEvents: "none",
  },

  /* SIDEBAR */

  sidebar: {
    position: "fixed",
    top: 0,
    left: 0,
    bottom: 0,
    width: 255,
    background:
      "rgba(7, 15, 28, 0.94)",
    borderRight:
      "1px solid rgba(148, 163, 184, 0.12)",
    zIndex: 50,
    display: "flex",
    flexDirection: "column",
    padding: 18,
    boxSizing: "border-box",
    backdropFilter: "blur(16px)",
  },

  sidebarMobileOpen: {
    transform: "translateX(0)",
  },

  sidebarHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding:
      "4px 4px 20px",
    borderBottom:
      "1px solid rgba(148, 163, 184, 0.10)",
  },

  logoContainer: {
    width: 43,
    height: 43,
    borderRadius: 11,
    overflow: "hidden",
    flexShrink: 0,
    background: "#fff",
    border:
      "1px solid rgba(148, 163, 184, 0.18)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  logo: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },

  brandName: {
    fontSize: 17,
    fontWeight: 800,
    letterSpacing: "-0.02em",
  },

  brandRole: {
    color: "#64748b",
    fontSize: 10,
    marginTop: 2,
  },

  mobileClose: {
    display: "none",
    marginLeft: "auto",
    border: 0,
    background: "transparent",
    color: "#94a3b8",
    cursor: "pointer",
  },

  navigation: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
    paddingTop: 20,
    flex: 1,
  },

  navItem: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 11,
    border: 0,
    borderRadius: 10,
    padding:
      "10px 12px",
    background: "transparent",
    color: "#94a3b8",
    cursor: "pointer",
    textAlign: "left",
    fontSize: 13,
    fontWeight: 600,
  },

  navItemActive: {
    background:
      "rgba(59, 130, 246, 0.13)",
    color: "#93c5fd",
    boxShadow:
      "inset 3px 0 0 #3b82f6",
  },

  sidebarBottom: {
    borderTop:
      "1px solid rgba(148, 163, 184, 0.10)",
    paddingTop: 15,
  },

  sidebarUser: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    marginBottom: 11,
  },

  smallAvatar: {
    width: 35,
    height: 35,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "linear-gradient(135deg, #2563eb, #7c3aed)",
    color: "#fff",
    fontSize: 11,
    fontWeight: 800,
    flexShrink: 0,
  },

  sidebarUserInfo: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },

  logoutButton: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    border:
      "1px solid rgba(148, 163, 184, 0.14)",
    borderRadius: 9,
    padding: "9px 10px",
    background:
      "rgba(15, 23, 42, 0.55)",
    color: "#cbd5e1",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  },

  /* MAIN */

  mainWrapper: {
    marginLeft: 255,
    minHeight: "100vh",
    position: "relative",
    zIndex: 1,
  },

  topbar: {
    minHeight: 72,
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding:
      "12px 30px",
    borderBottom:
      "1px solid rgba(148, 163, 184, 0.10)",
    background:
      "rgba(7, 15, 28, 0.62)",
    backdropFilter: "blur(12px)",
    boxSizing: "border-box",
  },

  menuButton: {
    display: "none",
    border:
      "1px solid rgba(148, 163, 184, 0.15)",
    background:
      "rgba(15, 23, 42, 0.65)",
    color: "#cbd5e1",
    borderRadius: 9,
    padding: 8,
    cursor: "pointer",
  },

  pageEyebrow: {
    color: "#64748b",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "0.12em",
    marginBottom: 2,
  },

  pageTitle: {
    margin: 0,
    fontSize: 21,
    fontWeight: 750,
    letterSpacing: "-0.02em",
  },

  topbarRight: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  profileButton: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    border: 0,
    background: "transparent",
    color: "#cbd5e1",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  },

  topAvatar: {
    width: 33,
    height: 33,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "linear-gradient(135deg, #2563eb, #7c3aed)",
    color: "#fff",
    fontSize: 10,
    fontWeight: 800,
  },

  content: {
    width: "100%",
    maxWidth: 1400,
    margin: "0 auto",
    padding:
      "28px 30px 50px",
    boxSizing: "border-box",
  },

  /* WELCOME */

  welcomeCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 25,
    padding: 27,
    borderRadius: 18,
    background:
      "linear-gradient(135deg, rgba(30, 64, 175, 0.22), rgba(79, 70, 229, 0.13))",
    border:
      "1px solid rgba(96, 165, 250, 0.16)",
    marginBottom: 18,
    overflow: "hidden",
  },

  welcomeEyebrow: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: 750,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 7,
  },

  welcomeTitle: {
    margin: 0,
    fontSize: 27,
    fontWeight: 800,
    letterSpacing: "-0.03em",
  },

  welcomeText: {
    margin:
      "8px 0 14px",
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 1.6,
    maxWidth: 650,
  },

  professorMeta: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
  },

  welcomeIllustration: {
    width: 130,
    height: 130,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#93c5fd",
    background:
      "rgba(59, 130, 246, 0.10)",
    border:
      "1px solid rgba(96, 165, 250, 0.14)",
    flexShrink: 0,
  },

  /* STATS */

  statsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(4, minmax(0, 1fr))",
    gap: 13,
    marginBottom: 18,
  },

  statCard: {
    minHeight: 92,
    padding: 15,
    borderRadius: 14,
    background:
      "rgba(15, 23, 42, 0.72)",
    border:
      "1px solid rgba(148, 163, 184, 0.11)",
    display: "flex",
    alignItems: "center",
    gap: 12,
    position: "relative",
    boxSizing: "border-box",
  },

  statIconBlue: {
    width: 41,
    height: 41,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#93c5fd",
    background:
      "rgba(59, 130, 246, 0.12)",
    flexShrink: 0,
  },

  statIconPurple: {
    width: 41,
    height: 41,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#c4b5fd",
    background:
      "rgba(139, 92, 246, 0.12)",
    flexShrink: 0,
  },

  statIconGreen: {
    width: 41,
    height: 41,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#86efac",
    background:
      "rgba(34, 197, 94, 0.11)",
    flexShrink: 0,
  },

  statIconOrange: {
    width: 41,
    height: 41,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fdba74",
    background:
      "rgba(249, 115, 22, 0.11)",
    flexShrink: 0,
  },

  statLabel: {
    display: "block",
    color: "#64748b",
    fontSize: 10,
    fontWeight: 700,
    marginBottom: 3,
  },

  statValue: {
    display: "block",
    fontSize: 22,
    lineHeight: 1,
    fontWeight: 800,
  },

  statValueSmall: {
    display: "block",
    fontSize: 13,
    lineHeight: 1.3,
    fontWeight: 750,
    maxWidth: 150,
  },

  statArrow: {
    marginLeft: "auto",
    color: "#475569",
  },

  /* MAIN GRID */

  mainGrid: {
    display: "grid",
    gridTemplateColumns:
      "minmax(0, 1.15fr) minmax(320px, 0.85fr)",
    gap: 18,
    marginBottom: 18,
  },

  card: {
    background:
      "rgba(15, 23, 42, 0.72)",
    border:
      "1px solid rgba(148, 163, 184, 0.11)",
    borderRadius: 16,
    padding: 20,
    marginBottom: 18,
    boxSizing: "border-box",
  },

  cardHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 18,
  },

  cardTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 750,
  },

  cardSubtitle: {
    margin:
      "4px 0 0",
    color: "#64748b",
    fontSize: 12,
  },

  cardAction: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    border: 0,
    background: "transparent",
    color: "#93c5fd",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },

  /* COURSES */

  courseList: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
  },

  courseItem: {
    display: "flex",
    alignItems: "center",
    gap: 11,
    padding: 10,
    borderRadius: 10,
    background:
      "rgba(30, 41, 59, 0.42)",
    border:
      "1px solid rgba(148, 163, 184, 0.07)",
  },

  courseIcon: {
    width: 35,
    height: 35,
    borderRadius: 9,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#93c5fd",
    background:
      "rgba(59, 130, 246, 0.10)",
    flexShrink: 0,
  },

  courseInfo: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 2,
    flex: 1,
  },

  itemArrow: {
    color: "#475569",
    flexShrink: 0,
  },

  /* PROFILE */

  profileSummary: {
    display: "flex",
    alignItems: "center",
    gap: 13,
    marginBottom: 18,
  },

  largeAvatar: {
    width: 58,
    height: 58,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "linear-gradient(135deg, #2563eb, #7c3aed)",
    color: "#fff",
    fontSize: 17,
    fontWeight: 800,
    flexShrink: 0,
  },

  profileSummaryText: {
    minWidth: 0,
  },

  profileDetails: {
    display: "flex",
    flexDirection: "column",
    gap: 9,
  },

  profileDetail: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 15,
    paddingBottom: 9,
    borderBottom:
      "1px solid rgba(148, 163, 184, 0.08)",
  },

  /* TIMETABLE */

  timetableList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  timetableItem: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: 12,
    borderRadius: 11,
    background:
      "rgba(30, 41, 59, 0.40)",
    border:
      "1px solid rgba(148, 163, 184, 0.07)",
  },

  dayBlock: {
    width: 88,
    display: "flex",
    flexDirection: "column",
    gap: 3,
    flexShrink: 0,
  },

  timelineLine: {
    width: 2,
    height: 38,
    background:
      "rgba(96, 165, 250, 0.35)",
    borderRadius: 2,
    flexShrink: 0,
  },

  timetableInfo: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    flex: 1,
    minWidth: 0,
  },

  timetableMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 5,
    color: "#64748b",
    fontSize: 10,
  },

  timeRange: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: 650,
    whiteSpace: "nowrap",
  },

  /* QUICK ACTIONS */

  quickActions: {
    display: "grid",
    gridTemplateColumns:
      "repeat(4, minmax(0, 1fr))",
    gap: 10,
  },

  quickAction: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    minHeight: 62,
    padding:
      "11px 12px",
    borderRadius: 11,
    border:
      "1px solid rgba(148, 163, 184, 0.10)",
    background:
      "rgba(30, 41, 59, 0.42)",
    color: "#cbd5e1",
    cursor: "pointer",
    textAlign: "left",
    fontSize: 11,
    fontWeight: 650,
  },

  /* EMPTY */

  emptyState: {
    minHeight: 120,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    color: "#475569",
    textAlign: "center",
  },

  /* BADGES */

  verifiedBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding:
      "6px 9px",
    borderRadius: 999,
    background:
      "rgba(34, 197, 94, 0.10)",
    border:
      "1px solid rgba(34, 197, 94, 0.17)",
    color: "#86efac",
    fontSize: 10,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },

  pendingBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding:
      "6px 9px",
    borderRadius: 999,
    background:
      "rgba(245, 158, 11, 0.10)",
    border:
      "1px solid rgba(245, 158, 11, 0.17)",
    color: "#fcd34d",
    fontSize: 10,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },

  rejectedBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding:
      "6px 9px",
    borderRadius: 999,
    background:
      "rgba(239, 68, 68, 0.10)",
    border:
      "1px solid rgba(239, 68, 68, 0.17)",
    color: "#fca5a5",
    fontSize: 10,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },

  /* LOADING */

  loadingState: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: 20,
    boxSizing: "border-box",
  },

  loadingIcon: {
    width: 60,
    height: 60,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "rgba(59, 130, 246, 0.11)",
    color: "#93c5fd",
    marginBottom: 15,
  },

  spinner: {
    animation:
      "spin 1s linear infinite",
  },

  loadingTitle: {
    margin: 0,
    fontSize: 19,
  },

  loadingText: {
    margin:
      "7px 0 0",
    color: "#64748b",
    fontSize: 13,
  },

  /* ERROR */

  errorState: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: 20,
    boxSizing: "border-box",
  },

  errorIcon: {
    width: 62,
    height: 62,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "rgba(239, 68, 68, 0.11)",
    color: "#fca5a5",
    marginBottom: 15,
  },

  errorTitle: {
    margin: 0,
    fontSize: 20,
  },

  errorMessage: {
    maxWidth: 560,
    margin:
      "8px 0 18px",
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 1.55,
  },

  errorActions: {
    display: "flex",
    gap: 9,
    flexWrap: "wrap",
    justifyContent: "center",
  },

  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    border: 0,
    borderRadius: 9,
    padding:
      "10px 14px",
    background:
      "linear-gradient(135deg, #2563eb, #4f46e5)",
    color: "#fff",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
  },

  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    border:
      "1px solid rgba(148, 163, 184, 0.15)",
    borderRadius: 9,
    padding:
      "10px 14px",
    background:
      "rgba(15, 23, 42, 0.70)",
    color: "#cbd5e1",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 650,
  },

  mobileOverlay: {
    display: "none",
  },

  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 15,
    padding:
      "0 30px 25px",
    color: "#475569",
    fontSize: 10,
  },
};