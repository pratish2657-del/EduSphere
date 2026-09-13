import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import AIChatbot from "../../components/ai/AIChatbot";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

interface Professor {
  professor_id?: number;
  user_id?: number;
  email?: string;
  full_name?: string;
  department?: string;
  designation?: string;
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
  semester?: string | number;
  credits?: number;
  [key: string]: unknown;
}

interface TimetableItem {
  timetable_id?: number;
  day?: string;
  start_time?: string | number | null;
  end_time?: string | number | null;
  room?: string;
  program_name?: string;
  program_code?: string;
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

async function apiRequest<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

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
      const detail = (data as { detail?: unknown }).detail;

      if (typeof detail === "string") {
        message = detail;
      }
    }

    throw new Error(message);
  }

  return data as T;
}

function formatTime(value?: unknown) {
  if (value === undefined || value === null || value === "") {
    return "—";
  }

  // FastAPI/MySQL TIME values are normally returned as strings, but
  // production data can sometimes arrive as a number or structured value.
  // Normalize those shapes before calling string methods.
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "—";

    // MySQL TIME values can be serialized by the API as seconds from midnight.
    // Example: 34200 = 09:30, 36900 = 10:15.
    const totalSeconds = Math.max(0, Math.floor(value));
    const hour = Math.floor(totalSeconds / 3600) % 24;
    const minute = Math.floor((totalSeconds % 3600) / 60);
    const suffix = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const hourValue = record.hour ?? record.hours;
    const minuteValue = record.minute ?? record.minutes;

    if (
      typeof hourValue === "number" &&
      typeof minuteValue === "number" &&
      Number.isFinite(hourValue) &&
      Number.isFinite(minuteValue)
    ) {
      const hour = hourValue;
      const minute = minuteValue;
      const suffix = hour >= 12 ? "PM" : "AM";
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
    }

    return "—";
  }

  const stringValue = String(value).trim();
  if (!stringValue) return "—";

  const parts = stringValue.split(":");

  if (parts.length < 2) return stringValue;

  const hour = Number(parts[0]);
  const minute = parts[1];

  if (Number.isNaN(hour)) return stringValue;

  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${minute} ${suffix}`;
}

function normalizeDay(day?: unknown) {
  if (day === undefined || day === null || day === "") {
    return "Unknown";
  }

  const value = String(day).trim();
  if (!value) return "Unknown";

  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function getCourseName(course: Course) {
  return (
    course.name ||
    course.course_name ||
    course.title ||
    "Untitled Course"
  );
}

function getCourseCode(course: Course) {
  return course.code || course.course_code || "COURSE";
}

function VerificationBadge({ status }: { status?: string }) {
  const normalized = String(status || "").toUpperCase();

  if (normalized === "VERIFIED") {
    return (
      <span style={styles.verifiedBadge}>
        <CheckCircle2 size={14} />
        Verified
      </span>
    );
  }

  if (normalized === "REJECTED") {
    return (
      <span style={styles.rejectedBadge}>
        <ShieldCheck size={14} />
        Rejected
      </span>
    );
  }

  return (
    <span style={styles.pendingBadge}>
      <Clock3 size={14} />
      Pending Verification
    </span>
  );
}

export default function MyCourses() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [dashboard, setDashboard] =
    useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedCourse, setSelectedCourse] =
    useState<Course | null>(null);

  const loadCourses = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await apiRequest<DashboardResponse>(
        "/professor/dashboard/",
      );

      setDashboard(data);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load your courses.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const courses = dashboard?.courses?.items ?? [];
  const timetable = dashboard?.timetable?.items ?? [];

  const courseSchedules = useMemo(() => {
    const map = new Map<number, TimetableItem[]>();

    for (const item of timetable) {
      if (!item.course_id) continue;

      const existing = map.get(item.course_id) ?? [];
      existing.push(item);
      map.set(item.course_id, existing);
    }

    return map;
  }, [timetable]);

  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return courses;

    return courses.filter((course) => {
      const haystack = [
        getCourseName(course),
        getCourseCode(course),
        course.semester,
        course.credits,
      ]
        .filter((value) => value !== undefined && value !== null)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [courses, search]);

  const selectedSchedule = selectedCourse
    ? courseSchedules.get(
        selectedCourse.course_id ?? selectedCourse.id ?? -1,
      ) ?? []
    : [];

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.centerState}>
          <div style={styles.loadingIcon}>
            <Loader2 size={27} style={styles.spinner} />
          </div>

          <h2 style={styles.stateTitle}>Loading My Courses</h2>

          <p style={styles.stateText}>
            Synchronizing your assigned courses with EduSphere...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.page}>
        <div style={styles.centerState}>
          <div style={styles.errorIcon}>
            <X size={27} />
          </div>

          <span style={styles.eyebrow}>COURSE SERVICE</span>

          <h2 style={styles.stateTitle}>
            Courses unavailable
          </h2>

          <p style={styles.stateText}>{error}</p>

          <div style={styles.actionRow}>
            <button
              type="button"
              style={styles.primaryButton}
              onClick={loadCourses}
            >
              <RefreshCw size={16} />
              Retry
            </button>

            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => navigate("/app/professor")}
            >
              <ArrowLeft size={16} />
              Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const professor = dashboard?.professor;

  return (
    <div style={styles.page}>
      <div style={styles.backgroundGlowOne} />
      <div style={styles.backgroundGlowTwo} />

      <main style={styles.container}>
        <header style={styles.header}>
          <button
            type="button"
            style={styles.backButton}
            onClick={() => navigate("/app/professor")}
          >
            <ArrowLeft size={17} />
            Dashboard
          </button>

          <div style={styles.brand}>
            <img
              src="/edusphere-logo.jpeg"
              alt="EduSphere"
              style={styles.logo}
            />

            <div>
              <div style={styles.brandName}>EduSphere</div>
              <div style={styles.brandSubtitle}>
                Professor Workspace
              </div>
            </div>
          </div>

          <VerificationBadge
            status={professor?.verification_status}
          />
        </header>

        <section style={styles.hero}>
          <div>
            <span style={styles.eyebrow}>ACADEMIC CATALOG</span>

            <h1 style={styles.title}>
              My <span style={styles.gradientText}>Courses</span>
            </h1>

            <p style={styles.subtitle}>
              View the courses currently assigned to your professor
              profile and inspect their scheduled teaching slots.
            </p>
          </div>

          <div style={styles.professorChip}>
            <div style={styles.avatar}>
              {String(professor?.full_name || user?.full_name || "P")
                .trim()
                .split(/\s+/)
                .map((part) => part[0] || "")
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>

            <div>
              <strong style={styles.professorName}>
                {professor?.full_name ||
                  user?.full_name ||
                  "Professor"}
              </strong>

              <span style={styles.professorDepartment}>
                {professor?.department || "Academic Faculty"}
              </span>
            </div>
          </div>
        </section>

        <section style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statIcon}>
              <BookOpen size={20} />
            </div>

            <div>
              <span style={styles.statLabel}>ASSIGNED COURSES</span>
              <strong style={styles.statValue}>
                {dashboard?.courses?.count ?? courses.length}
              </strong>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statIcon}>
              <CalendarDays size={20} />
            </div>

            <div>
              <span style={styles.statLabel}>TEACHING SLOTS</span>
              <strong style={styles.statValue}>
                {dashboard?.timetable?.count ?? timetable.length}
              </strong>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statIcon}>
              <GraduationCap size={20} />
            </div>

            <div>
              <span style={styles.statLabel}>DEPARTMENT</span>
              <strong style={styles.statValueSmall}>
                {professor?.department || "—"}
              </strong>
            </div>
          </div>
        </section>

        <section style={styles.toolbar}>
          <div style={styles.searchBox}>
            <Search size={17} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search course name or code..."
              style={styles.searchInput}
            />
          </div>

          <div style={styles.resultCount}>
            {filteredCourses.length}{" "}
            {filteredCourses.length === 1 ? "course" : "courses"}
          </div>

          <button
            type="button"
            style={styles.refreshButton}
            onClick={loadCourses}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </section>

        {courses.length === 0 ? (
          <section style={styles.emptyState}>
            <div style={styles.emptyIcon}>
              <BookOpen size={30} />
            </div>

            <span style={styles.eyebrow}>NO COURSE DATA</span>

            <h2 style={styles.emptyTitle}>
              No courses assigned yet
            </h2>

            <p style={styles.emptyText}>
              Your professor account does not currently have any
              course assignments in EduSphere.
            </p>
          </section>
        ) : filteredCourses.length === 0 ? (
          <section style={styles.emptyState}>
            <div style={styles.emptyIcon}>
              <Search size={30} />
            </div>

            <span style={styles.eyebrow}>NO MATCHES</span>

            <h2 style={styles.emptyTitle}>
              No matching courses
            </h2>

            <p style={styles.emptyText}>
              Try another course name or course code.
            </p>
          </section>
        ) : (
          <section style={styles.courseGrid}>
            {filteredCourses.map((course, index) => {
              const id = course.course_id ?? course.id ?? index;
              const name = getCourseName(course);
              const code = getCourseCode(course);
              const schedules =
                courseSchedules.get(
                  course.course_id ?? course.id ?? -1,
                ) ?? [];

              return (
                <article
                  key={id}
                  style={styles.courseCard}
                  onClick={() => setSelectedCourse(course)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" ||
                      event.key === " "
                    ) {
                      event.preventDefault();
                      setSelectedCourse(course);
                    }
                  }}
                >
                  <div style={styles.courseTop}>
                    <div style={styles.courseIcon}>
                      <BookOpen size={21} />
                    </div>

                    <span style={styles.courseCode}>
                      {code}
                    </span>
                  </div>

                  <h2 style={styles.courseTitle}>{name}</h2>

                  <div style={styles.courseMeta}>
                    <div>
                      <span style={styles.metaLabel}>
                        COURSE ID
                      </span>
                      <strong style={styles.metaValue}>
                        {course.course_id ??
                          course.id ??
                          "—"}
                      </strong>
                    </div>

                    <div>
                      <span style={styles.metaLabel}>
                        SCHEDULES
                      </span>
                      <strong style={styles.metaValue}>
                        {schedules.length}
                      </strong>
                    </div>

                    {course.credits !== undefined && (
                      <div>
                        <span style={styles.metaLabel}>
                          CREDITS
                        </span>
                        <strong style={styles.metaValue}>
                          {course.credits}
                        </strong>
                      </div>
                    )}
                  </div>

                  <div style={styles.courseFooter}>
                    <span>
                      {schedules.length
                        ? `${schedules.length} teaching ${
                            schedules.length === 1
                              ? "slot"
                              : "slots"
                          }`
                        : "No timetable slot"}
                    </span>

                    <span style={styles.viewDetails}>
                      View details →
                    </span>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </main>

      <AIChatbot />

      {selectedCourse && (
        <div
          style={styles.modalBackdrop}
          onMouseDown={() => setSelectedCourse(null)}
        >
          <div
            style={styles.modal}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div style={styles.modalHeader}>
              <div>
                <span style={styles.eyebrow}>COURSE DETAILS</span>
                <h2 style={styles.modalTitle}>
                  {getCourseName(selectedCourse)}
                </h2>
                <p style={styles.modalCode}>
                  {getCourseCode(selectedCourse)}
                </p>
              </div>

              <button
                type="button"
                style={styles.closeButton}
                onClick={() => setSelectedCourse(null)}
                aria-label="Close course details"
              >
                <X size={18} />
              </button>
            </div>

            <div style={styles.detailGrid}>
              <div style={styles.detailCard}>
                <BookOpen size={18} />
                <span>Course ID</span>
                <strong>
                  {selectedCourse.course_id ??
                    selectedCourse.id ??
                    "—"}
                </strong>
              </div>

              {selectedCourse.credits !== undefined && (
                <div style={styles.detailCard}>
                  <GraduationCap size={18} />
                  <span>Credits</span>
                  <strong>{selectedCourse.credits}</strong>
                </div>
              )}

              {selectedCourse.semester !== undefined && (
                <div style={styles.detailCard}>
                  <CalendarDays size={18} />
                  <span>Semester</span>
                  <strong>{selectedCourse.semester}</strong>
                </div>
              )}
            </div>

            <div style={styles.scheduleSection}>
              <div style={styles.scheduleHeading}>
                <div>
                  <span style={styles.eyebrow}>
                    TEACHING TIMETABLE
                  </span>
                  <h3 style={styles.scheduleTitle}>
                    Scheduled slots
                  </h3>
                </div>
              </div>

              {selectedSchedule.length === 0 ? (
                <div style={styles.noSchedule}>
                  No timetable entries are currently available
                  for this course.
                </div>
              ) : (
                <div style={styles.scheduleList}>
                  {selectedSchedule.map((item, index) => (
                    <div
                      key={
                        item.timetable_id ??
                        `${item.course_id}-${item.day}-${index}`
                      }
                      style={styles.scheduleItem}
                    >
                      <div style={styles.scheduleDay}>
                        <CalendarDays size={16} />
                        {normalizeDay(item.day)}
                      </div>

                      <div style={styles.scheduleTime}>
                        <Clock3 size={16} />
                        {formatTime(item.start_time)} –{" "}
                        {formatTime(item.end_time)}
                      </div>

                      <div style={styles.scheduleRoom}>
                        <span>ROOM</span>
                        <strong>{item.room || "—"}</strong>
                      </div>

                      <div style={styles.scheduleSectionName}>
                        <span>SECTION</span>
                        <strong>
                          {item.section_name ||
                            item.section_code ||
                            "—"}
                        </strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh",
    background:
      "radial-gradient(circle at 10% 5%, rgba(99,102,241,.14), transparent 27%), radial-gradient(circle at 90% 15%, rgba(124,58,237,.12), transparent 25%), #050507",
    color: "#f7f7fb",
    overflowX: "hidden",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  backgroundGlowOne: {
    position: "fixed",
    width: 280,
    height: 280,
    left: -150,
    top: 180,
    borderRadius: "50%",
    background: "rgba(99,102,241,.08)",
    filter: "blur(70px)",
    pointerEvents: "none",
  },
  backgroundGlowTwo: {
    position: "fixed",
    width: 300,
    height: 300,
    right: -160,
    bottom: 60,
    borderRadius: "50%",
    background: "rgba(139,92,246,.07)",
    filter: "blur(80px)",
    pointerEvents: "none",
  },
  container: {
    width: "min(1180px, calc(100% - 40px))",
    margin: "0 auto",
    padding: "24px 0 50px",
    position: "relative",
    zIndex: 1,
  },
  header: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    gap: 18,
    marginBottom: 48,
  },
  backButton: {
    justifySelf: "start",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    border: "1px solid rgba(255,255,255,.11)",
    background: "rgba(255,255,255,.045)",
    color: "#d6d6df",
    borderRadius: 10,
    padding: "10px 13px",
    cursor: "pointer",
    fontWeight: 700,
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  logo: {
    width: 42,
    height: 42,
    objectFit: "contain",
    borderRadius: 11,
    border: "1px solid rgba(255,255,255,.1)",
    background: "rgba(255,255,255,.04)",
  },
  brandName: {
    fontSize: 13,
    fontWeight: 850,
    textTransform: "uppercase",
    letterSpacing: ".15em",
  },
  brandSubtitle: {
    marginTop: 2,
    color: "#777784",
    fontSize: 10,
  },
  verifiedBadge: {
    justifySelf: "end",
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    padding: "8px 11px",
    borderRadius: 999,
    color: "#b9f6cf",
    background: "rgba(34,197,94,.09)",
    border: "1px solid rgba(34,197,94,.2)",
    fontSize: 11,
    fontWeight: 750,
  },
  rejectedBadge: {
    justifySelf: "end",
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    padding: "8px 11px",
    borderRadius: 999,
    color: "#fecaca",
    background: "rgba(239,68,68,.09)",
    border: "1px solid rgba(239,68,68,.2)",
    fontSize: 11,
    fontWeight: 750,
  },
  pendingBadge: {
    justifySelf: "end",
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    padding: "8px 11px",
    borderRadius: 999,
    color: "#ddd6fe",
    background: "rgba(139,92,246,.09)",
    border: "1px solid rgba(139,92,246,.2)",
    fontSize: 11,
    fontWeight: 750,
  },
  hero: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 28,
    marginBottom: 28,
  },
  eyebrow: {
    display: "inline-flex",
    color: "#8d8d9d",
    fontSize: 10,
    fontWeight: 850,
    letterSpacing: ".18em",
  },
  title: {
    margin: "9px 0 0",
    fontSize: "clamp(36px, 5vw, 57px)",
    lineHeight: 1,
    letterSpacing: "-.045em",
    fontWeight: 850,
  },
  gradientText: {
    background:
      "linear-gradient(90deg, #fff, #c4b5fd 48%, #818cf8)",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
  },
  subtitle: {
    maxWidth: 690,
    margin: "16px 0 0",
    color: "#92929f",
    fontSize: 14,
    lineHeight: 1.7,
  },
  professorChip: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 13px",
    border: "1px solid rgba(255,255,255,.09)",
    background: "rgba(255,255,255,.035)",
    borderRadius: 14,
    minWidth: 205,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 11,
    display: "grid",
    placeItems: "center",
    background: "linear-gradient(135deg, #6366f1, #7c3aed)",
    color: "#fff",
    fontSize: 12,
    fontWeight: 850,
  },
  professorName: {
    display: "block",
    fontSize: 12,
  },
  professorDepartment: {
    display: "block",
    color: "#777784",
    fontSize: 10,
    marginTop: 2,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0,1fr))",
    gap: 12,
    marginBottom: 18,
  },
  statCard: {
    display: "flex",
    alignItems: "center",
    gap: 13,
    padding: 16,
    border: "1px solid rgba(255,255,255,.09)",
    background: "rgba(255,255,255,.035)",
    borderRadius: 15,
  },
  statIcon: {
    width: 41,
    height: 41,
    display: "grid",
    placeItems: "center",
    borderRadius: 11,
    color: "#c4b5fd",
    background: "rgba(99,102,241,.11)",
    border: "1px solid rgba(99,102,241,.17)",
  },
  statLabel: {
    display: "block",
    color: "#777784",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: ".12em",
  },
  statValue: {
    display: "block",
    marginTop: 4,
    fontSize: 24,
    lineHeight: 1,
  },
  statValueSmall: {
    display: "block",
    marginTop: 4,
    fontSize: 14,
    lineHeight: 1.2,
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    margin: "22px 0 17px",
  },
  searchBox: {
    flex: 1,
    minWidth: 180,
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "11px 13px",
    border: "1px solid rgba(255,255,255,.1)",
    background: "rgba(255,255,255,.035)",
    borderRadius: 11,
    color: "#858592",
  },
  searchInput: {
    width: "100%",
    border: 0,
    outline: 0,
    background: "transparent",
    color: "#f7f7fb",
    fontSize: 12,
  },
  resultCount: {
    padding: "9px 11px",
    borderRadius: 9,
    background: "rgba(255,255,255,.045)",
    color: "#a2a2af",
    fontSize: 10,
    fontWeight: 750,
    whiteSpace: "nowrap",
  },
  refreshButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    border: "1px solid rgba(255,255,255,.1)",
    background: "rgba(255,255,255,.045)",
    color: "#d7d7df",
    borderRadius: 10,
    padding: "10px 12px",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 750,
  },
  courseGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0,1fr))",
    gap: 14,
  },
  courseCard: {
    padding: 19,
    border: "1px solid rgba(255,255,255,.09)",
    background:
      "linear-gradient(145deg, rgba(255,255,255,.055), rgba(255,255,255,.025))",
    borderRadius: 17,
    cursor: "pointer",
    transition: "180ms ease",
    outline: "none",
  },
  courseTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  courseIcon: {
    width: 42,
    height: 42,
    display: "grid",
    placeItems: "center",
    borderRadius: 12,
    color: "#c4b5fd",
    background: "rgba(99,102,241,.11)",
    border: "1px solid rgba(99,102,241,.18)",
  },
  courseCode: {
    padding: "6px 8px",
    borderRadius: 7,
    color: "#aaa9b8",
    background: "rgba(255,255,255,.045)",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: ".08em",
  },
  courseTitle: {
    margin: "18px 0 17px",
    fontSize: 21,
    letterSpacing: "-.025em",
  },
  courseMeta: {
    display: "grid",
    gridTemplateColumns: "repeat(3,1fr)",
    gap: 8,
  },
  metaLabel: {
    display: "block",
    color: "#666672",
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: ".11em",
  },
  metaValue: {
    display: "block",
    marginTop: 4,
    fontSize: 11,
    color: "#c6c6cf",
  },
  courseFooter: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 19,
    paddingTop: 13,
    borderTop: "1px solid rgba(255,255,255,.07)",
    color: "#777784",
    fontSize: 10,
  },
  viewDetails: {
    color: "#a5b4fc",
    fontWeight: 750,
  },
  emptyState: {
    textAlign: "center",
    padding: "70px 20px",
    border: "1px dashed rgba(255,255,255,.12)",
    borderRadius: 18,
    background: "rgba(255,255,255,.025)",
  },
  emptyIcon: {
    width: 58,
    height: 58,
    margin: "0 auto 18px",
    display: "grid",
    placeItems: "center",
    borderRadius: 16,
    color: "#a5b4fc",
    background: "rgba(99,102,241,.1)",
  },
  emptyTitle: {
    margin: "9px 0 7px",
    fontSize: 22,
  },
  emptyText: {
    maxWidth: 520,
    margin: "0 auto",
    color: "#858591",
    fontSize: 12,
    lineHeight: 1.65,
  },
  centerState: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: 24,
  },
  loadingIcon: {
    width: 58,
    height: 58,
    display: "grid",
    placeItems: "center",
    borderRadius: 17,
    color: "#a5b4fc",
    background: "rgba(99,102,241,.1)",
    border: "1px solid rgba(99,102,241,.15)",
  },
  spinner: {
    animation: "edusphere-course-spin 1s linear infinite",
  },
  stateTitle: {
    margin: "17px 0 7px",
    fontSize: 23,
  },
  stateText: {
    maxWidth: 520,
    color: "#858591",
    fontSize: 13,
    lineHeight: 1.65,
  },
  errorIcon: {
    width: 58,
    height: 58,
    display: "grid",
    placeItems: "center",
    borderRadius: 17,
    color: "#fca5a5",
    background: "rgba(239,68,68,.09)",
    border: "1px solid rgba(239,68,68,.18)",
  },
  actionRow: {
    display: "flex",
    gap: 9,
    marginTop: 15,
  },
  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    border: 0,
    borderRadius: 10,
    padding: "11px 14px",
    color: "#fff",
    background: "linear-gradient(135deg,#6366f1,#7c3aed)",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 800,
  },
  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    border: "1px solid rgba(255,255,255,.1)",
    borderRadius: 10,
    padding: "11px 14px",
    color: "#d5d5de",
    background: "rgba(255,255,255,.045)",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 750,
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 50,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    background: "rgba(0,0,0,.72)",
    backdropFilter: "blur(9px)",
  },
  modal: {
    width: "min(760px, 100%)",
    maxHeight: "calc(100vh - 40px)",
    overflowY: "auto",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 20,
    background: "#0b0b10",
    boxShadow: "0 30px 100px rgba(0,0,0,.55)",
    padding: 22,
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    alignItems: "flex-start",
  },
  modalTitle: {
    margin: "8px 0 3px",
    fontSize: 27,
    letterSpacing: "-.03em",
  },
  modalCode: {
    margin: 0,
    color: "#858591",
    fontSize: 11,
  },
  closeButton: {
    width: 36,
    height: 36,
    display: "grid",
    placeItems: "center",
    border: "1px solid rgba(255,255,255,.1)",
    background: "rgba(255,255,255,.045)",
    color: "#c8c8d1",
    borderRadius: 10,
    cursor: "pointer",
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3,1fr)",
    gap: 9,
    marginTop: 22,
  },
  detailCard: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: 13,
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 12,
    background: "rgba(255,255,255,.03)",
    color: "#a5a5b2",
    fontSize: 10,
  },
  scheduleSection: {
    marginTop: 25,
  },
  scheduleHeading: {
    marginBottom: 12,
  },
  scheduleTitle: {
    margin: "7px 0 0",
    fontSize: 17,
  },
  scheduleList: {
    display: "grid",
    gap: 8,
  },
  scheduleItem: {
    display: "grid",
    gridTemplateColumns: "1.1fr 1.4fr .8fr .9fr",
    alignItems: "center",
    gap: 10,
    padding: 12,
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 11,
    background: "rgba(255,255,255,.025)",
  },
  scheduleDay: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    color: "#d6d6df",
    fontSize: 11,
    fontWeight: 700,
  },
  scheduleTime: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    color: "#aaa9b6",
    fontSize: 10,
  },
  scheduleRoom: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    fontSize: 9,
    color: "#72727e",
  },
  scheduleSectionName: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    fontSize: 9,
    color: "#72727e",
  },
  noSchedule: {
    padding: 20,
    borderRadius: 12,
    background: "rgba(255,255,255,.03)",
    color: "#858591",
    fontSize: 11,
    textAlign: "center",
  },
};

const styleId = "edusphere-my-courses-keyframes";

if (typeof document !== "undefined" && !document.getElementById(styleId)) {
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    @keyframes edusphere-course-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @media (max-width: 800px) {
      .edusphere-my-courses-placeholder {}
    }
  `;
  document.head.appendChild(style);
}
