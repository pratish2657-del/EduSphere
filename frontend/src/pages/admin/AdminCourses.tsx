import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Edit3,
  GraduationCap,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import AIChatbot from "../../components/ai/AIChatbot";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

type Course = {
  id: number;
  institution_id: number;
  institution_name?: string;
  university_code?: string;
  program_id?: number | null;
  program_name?: string | null;
  program_code?: string | null;
  name: string;
  code: string;
  semester: number;
  created_at?: string;
};

type Program = {
  id: number;
  institution_id: number;
  name: string;
  code: string;
  degree?: string;
  duration_years?: number;
  is_active?: boolean;
};

type CoursesResponse = {
  count?: number;
  courses?: Course[];
};

type ProgramsResponse = {
  count?: number;
  programs?: Program[];
};

type AdminProfile = {
  institution_id?: number;
  institution_name?: string;
  institution_code?: string;
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

export default function AdminCourses() {
  const navigate = useNavigate();

  const [courses, setCourses] = useState<Course[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [profile, setProfile] = useState<AdminProfile | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("ALL");
  const [programFilter, setProgramFilter] = useState("ALL");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [semester, setSemester] = useState("1");
  const [programId, setProgramId] = useState("");

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const adminProfile = await apiRequest<AdminProfile>("/profile/admin");
      setProfile(adminProfile);

      const institutionId = adminProfile.institution_id;

      if (!institutionId) {
        throw new Error(
          "Your Admin Profile does not have an institution assigned.",
        );
      }

      const [courseResponse, programResponse] = await Promise.all([
        apiRequest<CoursesResponse>(
          `/courses/?institution_id=${institutionId}`,
        ),
        apiRequest<ProgramsResponse>(
          `/programs/?institution_id=${institutionId}`,
        ),
      ]);

      setCourses(courseResponse.courses ?? []);
      setPrograms(programResponse.programs ?? []);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load courses.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredCourses = useMemo(() => {
    const q = search.trim().toLowerCase();

    return courses.filter((course) => {
      const matchesSearch =
        !q ||
        [course.name, course.code, course.program_name, course.program_code]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));

      const matchesSemester =
        semesterFilter === "ALL" ||
        String(course.semester) === semesterFilter;

      const matchesProgram =
        programFilter === "ALL" ||
        String(course.program_id ?? "") === programFilter;

      return matchesSearch && matchesSemester && matchesProgram;
    });
  }, [courses, search, semesterFilter, programFilter]);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setCode("");
    setSemester("1");
    setProgramId(programs[0]?.id ? String(programs[0].id) : "");
    setError("");
    setNotice("");
    setModalOpen(true);
  };

  const openEdit = (course: Course) => {
    setEditing(course);
    setName(course.name);
    setCode(course.code);
    setSemester(String(course.semester));
    setProgramId(course.program_id ? String(course.program_id) : "");
    setError("");
    setNotice("");
    setModalOpen(true);
  };

  const saveCourse = async () => {
    const institutionId = profile?.institution_id;

    if (!institutionId) {
      setError("Institution information is unavailable.");
      return;
    }

    if (!name.trim() || !code.trim()) {
      setError("Course name and course code are required.");
      return;
    }

    if (!programId) {
      setError("Please select a program.");
      return;
    }

    const semesterNumber = Number(semester);

    if (
      !Number.isInteger(semesterNumber) ||
      semesterNumber < 1 ||
      semesterNumber > 12
    ) {
      setError("Semester must be between 1 and 12.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      if (editing) {
        await apiRequest(`/courses/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: name.trim(),
            code: code.trim(),
            semester: semesterNumber,
          }),
        });

        setCourses((current) =>
          current.map((course) =>
            course.id === editing.id
              ? {
                  ...course,
                  name: name.trim(),
                  code: code.trim().toUpperCase(),
                  semester: semesterNumber,
                  program_id: Number(programId),
                  program_name:
                    programs.find((p) => p.id === Number(programId))?.name ??
                    course.program_name,
                }
              : course,
          ),
        );

        setNotice("Course updated successfully.");
      } else {
        const created = await apiRequest<{
          course_id: number;
          institution_id: number;
          name: string;
          code: string;
          semester: number;
        }>("/courses/", {
          method: "POST",
          body: JSON.stringify({
            institution_id: institutionId,
            program_id: Number(programId),
            name: name.trim(),
            code: code.trim(),
            semester: semesterNumber,
          }),
        });

        const selectedProgram = programs.find(
          (program) => program.id === Number(programId),
        );

        setCourses((current) => [
          ...current,
          {
            id: created.course_id,
            institution_id: created.institution_id,
            program_id: Number(programId),
            program_name: selectedProgram?.name,
            program_code: selectedProgram?.code,
            name: created.name,
            code: created.code,
            semester: created.semester,
          },
        ]);

        setNotice("Course created successfully.");
      }

      setModalOpen(false);
      setEditing(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save course.",
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteCourse = async (course: Course) => {
    const confirmed = window.confirm(
      `Delete "${course.name}" (${course.code})? This action cannot be undone.`,
    );

    if (!confirmed) return;

    setDeletingId(course.id);
    setError("");
    setNotice("");

    try {
      await apiRequest(`/courses/${course.id}`, {
        method: "DELETE",
      });

      setCourses((current) =>
        current.filter((item) => item.id !== course.id),
      );
      setNotice(`${course.name} was deleted.`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to delete course.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.glowOne} />
      <div style={styles.glowTwo} />

      <main className="admin-courses-main" style={styles.main}>
        <header className="admin-courses-header" style={styles.header}>
          <div style={styles.headingGroup}>
            <button
              type="button"
              style={styles.backButton}
              onClick={() => navigate("/app/admin")}
            >
              <ChevronRight size={17} style={{ transform: "rotate(180deg)" }} />
            </button>

            <div>
              <span style={styles.eyebrow}>ACADEMIC MANAGEMENT</span>
              <h1 style={styles.title}>Courses</h1>
              <p style={styles.subtitle}>
                Create, update, search and manage courses for your institution.
              </p>
            </div>
          </div>

          <div className="admin-courses-header-actions" style={styles.headerActions}>
            <button
              type="button"
              style={styles.refreshButton}
              onClick={() => void loadData()}
              disabled={loading}
            >
              <RefreshCw size={16} style={loading ? styles.spin : undefined} />
              Refresh
            </button>

            <button
              type="button"
              style={styles.addButton}
              onClick={openCreate}
              disabled={programs.length === 0}
            >
              <Plus size={17} />
              Add Course
            </button>
          </div>
        </header>

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

        <section className="admin-courses-stats" style={styles.stats}>
          <div style={styles.statCard}>
            <div style={styles.statIcon}>
              <BookOpen size={19} />
            </div>
            <div>
              <span>Total courses </span>
              <strong>{loading ? "…" : courses.length}</strong>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statIcon}>
              <GraduationCap size={19} />
            </div>
            <div>
              <span>Programs </span>
              <strong>{loading ? "…" : programs.length}</strong>
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statIcon}>
              <BookOpen size={19} />
            </div>
            <div>
              <span>Visible results </span>
              <strong>{loading ? "…" : filteredCourses.length}</strong>
            </div>
          </div>
        </section>

        <section className="admin-courses-panel" style={styles.panel}>
          <div className="admin-courses-toolbar" style={styles.toolbar}>
            <div>
              <span style={styles.panelEyebrow}>COURSE CATALOG</span>
              <h2 style={styles.panelTitle}>Institution Courses</h2>
            </div>

            <div className="admin-courses-filters" style={styles.filters}>
              <div className="admin-courses-search" style={styles.searchBox}>
                <Search size={16} />
                <input
                  className="admin-courses-search-input"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search course..."
                />
              </div>

              <select
                value={semesterFilter}
                onChange={(event) => setSemesterFilter(event.target.value)}
                style={styles.select}
              >
                <option value="ALL">All semesters</option>
                {Array.from({ length: 12 }, (_, index) => index + 1).map(
                  (value) => (
                    <option key={value} value={String(value)}>
                      Semester {value}
                    </option>
                  ),
                )}
              </select>

              <select
                value={programFilter}
                onChange={(event) => setProgramFilter(event.target.value)}
                style={styles.select}
              >
                <option value="ALL">All programs</option>
                {programs.map((program) => (
                  <option key={program.id} value={String(program.id)}>
                    {program.code} — {program.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div style={styles.empty}>
              <RefreshCw size={25} style={styles.spin} />
              <strong>Loading courses…</strong>
            </div>
          ) : filteredCourses.length === 0 ? (
            <div style={styles.empty}>
              <div style={styles.emptyIcon}>
                <BookOpen size={27} />
              </div>
              <strong>
                {courses.length === 0
                  ? "No courses created yet"
                  : "No matching courses"}
              </strong>
              <span>
                {courses.length === 0
                  ? programs.length
                    ? "Create the first course for your institution."
                    : "Create a program first, then add courses."
                  : "Try changing your search or filters."}
              </span>
              {courses.length === 0 && programs.length > 0 ? (
                <button
                  type="button"
                  style={styles.emptyButton}
                  onClick={openCreate}
                >
                  <Plus size={15} />
                  Create Course
                </button>
              ) : null}
            </div>
          ) : (
            <div style={styles.tableWrap}>
              <table className="admin-courses-table" style={styles.table}>
                <thead>
                  <tr>
                    <th>COURSE</th>
                    <th>CODE</th>
                    <th>PROGRAM</th>
                    <th>SEMESTER</th>
                    <th style={{ textAlign: "right" }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCourses.map((course) => (
                    <tr key={course.id}>
                      <td>
                        <div style={styles.courseCell}>
                          <div style={styles.courseIcon}>
                            <BookOpen size={16} />
                          </div>
                          <div style={styles.courseInfo}>
                            <strong style={styles.courseName}>{course.name}</strong>
                            <small style={styles.courseInstitution}>
                              {course.institution_name ||
                                profile?.institution_name ||
                                "Institution course"}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={styles.codeBadge}>{course.code}</span>
                      </td>
                      <td>
                        <div style={styles.programCell}>
                          <strong style={styles.programName}>
                            {course.program_code ||
                              course.program_name ||
                              "Program not linked"}
                          </strong>
                          {course.program_name &&
                          course.program_code &&
                          course.program_name !== course.program_code ? (
                            <small style={styles.programDescription}>
                              {course.program_name}
                            </small>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <span style={styles.semesterBadge}>
                          Semester {course.semester}
                        </span>
                      </td>
                      <td>
                        <div style={styles.actions}>
                          <button
                            type="button"
                            style={styles.editButton}
                            onClick={() => openEdit(course)}
                          >
                            <Edit3 size={14} />
                            Edit
                          </button>
                          <button
                            type="button"
                            style={styles.deleteButton}
                            disabled={deletingId === course.id}
                            onClick={() => void deleteCourse(course)}
                          >
                            {deletingId === course.id ? (
                              <RefreshCw size={14} style={styles.spin} />
                            ) : (
                              <Trash2 size={14} />
                            )}
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer style={styles.footer}>
          <span>
            {profile?.institution_name || "EduSphere Institution"}
          </span>
          <span>EduSphere • Academic Management</span>
        </footer>
      </main>

      {modalOpen ? (
        <div
          style={styles.overlay}
          onMouseDown={() => !saving && setModalOpen(false)}
        >
          <div
            style={styles.modal}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div style={styles.modalHeader}>
              <div>
                <span style={styles.panelEyebrow}>
                  {editing ? "UPDATE COURSE" : "NEW COURSE"}
                </span>
                <h2 style={styles.modalTitle}>
                  {editing ? "Edit Course" : "Create Course"}
                </h2>
                <p style={styles.modalSubtitle}>
                  {editing
                    ? "Update the course information below."
                    : "Add a course to your institution's academic catalog."}
                </p>
              </div>

              <button
                type="button"
                style={styles.modalClose}
                disabled={saving}
                onClick={() => setModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={styles.formGrid}>
              <label className="admin-courses-field" style={styles.field}>
                Course name
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Data Structures and Algorithms"
                  maxLength={255}
                  autoFocus
                />
              </label>

              <label className="admin-courses-field" style={styles.field}>
                Course code
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="e.g. CSE201"
                  maxLength={100}
                />
              </label>

              <label className="admin-courses-field" style={styles.field}>
                Program
                <select
                  value={programId}
                  onChange={(event) => setProgramId(event.target.value)}
                >
                  <option value="">Select program</option>
                  {programs.map((program) => (
                    <option key={program.id} value={String(program.id)}>
                      {program.code} — {program.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="admin-courses-field" style={styles.field}>
                Semester
                <select
                  value={semester}
                  onChange={(event) => setSemester(event.target.value)}
                >
                  {Array.from({ length: 12 }, (_, index) => index + 1).map(
                    (value) => (
                      <option key={value} value={String(value)}>
                        Semester {value}
                      </option>
                    ),
                  )}
                </select>
              </label>
            </div>

            <div style={styles.formInfo}>
              <GraduationCap size={15} />
              <span>
                Institution:{" "}
                <strong>
                  {profile?.institution_name ||
                    profile?.institution_code ||
                    "Current institution"}
                </strong>
              </span>
            </div>

            <div style={styles.modalActions}>
              <button
                type="button"
                style={styles.cancelButton}
                disabled={saving}
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                style={styles.saveButton}
                disabled={saving || programs.length === 0}
                onClick={() => void saveCourse()}
              >
                {saving ? (
                  <RefreshCw size={15} style={styles.spin} />
                ) : editing ? (
                  <CheckCircle2 size={15} />
                ) : (
                  <Plus size={15} />
                )}
                {saving
                  ? "Saving..."
                  : editing
                    ? "Save Changes"
                    : "Create Course"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
    width: 500,
    height: 500,
    borderRadius: "50%",
    background: "rgba(59,130,246,.07)",
    filter: "blur(115px)",
    top: -260,
    right: -170,
    pointerEvents: "none",
  },
  glowTwo: {
    position: "fixed",
    width: 430,
    height: 430,
    borderRadius: "50%",
    background: "rgba(139,92,246,.06)",
    filter: "blur(115px)",
    bottom: -220,
    left: -160,
    pointerEvents: "none",
  },
  main: {
    width: "min(1320px, calc(100% - 48px))",
    margin: "0 auto",
    padding: "31px 0 45px",
    position: "relative",
    zIndex: 1,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 20,
    marginBottom: 23,
  },
  headingGroup: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 39,
    height: 39,
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,.12)",
    background: "rgba(255,255,255,.035)",
    color: "#cbd5e1",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
  },
  eyebrow: {
    color: "#60a5fa",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "1.6px",
  },
  title: {
    margin: "4px 0 4px",
    fontSize: 28,
    letterSpacing: "-.7px",
  },
  subtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: 11,
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 7,
  },
  refreshButton: {
    border: "1px solid rgba(148,163,184,.12)",
    background: "rgba(255,255,255,.035)",
    color: "#94a3b8",
    borderRadius: 9,
    padding: "9px 11px",
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 10,
    cursor: "pointer",
  },
  addButton: {
    border: "1px solid rgba(96,165,250,.22)",
    background: "linear-gradient(135deg, #2563eb, #4f46e5)",
    color: "#fff",
    borderRadius: 9,
    padding: "9px 12px",
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 10,
    fontWeight: 700,
    cursor: "pointer",
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
    marginBottom: 11,
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
    marginBottom: 11,
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
  stats: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
    marginBottom: 14,
  },
  statCard: {
    minHeight: 82,
    display: "flex",
    alignItems: "center",
    gap: 11,
    padding: "13px 15px",
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,.11)",
    background: "rgba(15,23,42,.66)",
  },
  statIcon: {
    width: 37,
    height: 37,
    borderRadius: 10,
    display: "grid",
    placeItems: "center",
    background: "rgba(59,130,246,.1)",
    color: "#93c5fd",
    flexShrink: 0,
  },
  panel: {
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,.11)",
    background: "rgba(10,18,32,.75)",
    padding: 19,
  },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 15,
    marginBottom: 17,
  },
  panelEyebrow: {
    color: "#60a5fa",
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: "1.4px",
  },
  panelTitle: {
    margin: "5px 0 0",
    fontSize: 17,
  },
  filters: {
    display: "flex",
    gap: 7,
    alignItems: "center",
  },
  searchBox: {
    width: 245,
    height: 36,
    display: "flex",
    alignItems: "center",
    gap: 7,
    padding: "0 10px",
    borderRadius: 9,
    border: "1px solid rgba(148,163,184,.12)",
    background: "#070e1a",
    color: "#64748b",
  },
  select: {
    height: 36,
    borderRadius: 9,
    border: "1px solid rgba(148,163,184,.12)",
    background: "#070e1a",
    color: "#94a3b8",
    padding: "0 9px",
    fontSize: 9,
    outline: "none",
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 850,
  },
  courseCell: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    minWidth: 0,
  },
  courseInfo: {
    minWidth: 0,
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },
  courseName: {
    display: "block",
    color: "#e2e8f0",
    fontSize: 10,
    fontWeight: 700,
    lineHeight: 1.35,
    whiteSpace: "normal",
    overflowWrap: "anywhere",
  },
  courseInstitution: {
    display: "block",
    color: "#64748b",
    fontSize: 8,
    lineHeight: 1.35,
    whiteSpace: "normal",
    overflowWrap: "anywhere",
  },
  courseIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    display: "grid",
    placeItems: "center",
    background: "rgba(59,130,246,.1)",
    color: "#93c5fd",
    flexShrink: 0,
  },
  codeBadge: {
    display: "inline-flex",
    padding: "5px 8px",
    borderRadius: 7,
    background: "rgba(139,92,246,.09)",
    border: "1px solid rgba(139,92,246,.14)",
    color: "#c4b5fd",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: ".4px",
  },
  programCell: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  programName: {
    display: "block",
    color: "#e2e8f0",
    fontSize: 10,
    fontWeight: 800,
    lineHeight: 1.3,
    whiteSpace: "normal",
    overflowWrap: "anywhere",
  },
  programDescription: {
    display: "block",
    color: "#94a3b8",
    fontSize: 8,
    lineHeight: 1.35,
    whiteSpace: "normal",
    overflowWrap: "anywhere",
  },
  semesterBadge: {
    display: "inline-flex",
    padding: "5px 8px",
    borderRadius: 7,
    background: "rgba(96,165,250,.07)",
    border: "1px solid rgba(96,165,250,.11)",
    color: "#93c5fd",
    fontSize: 9,
    width: "fit-content",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 5,
  },
  editButton: {
    border: "1px solid rgba(96,165,250,.13)",
    background: "rgba(59,130,246,.06)",
    color: "#93c5fd",
    borderRadius: 7,
    padding: "6px 8px",
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 8,
    cursor: "pointer",
  },
  deleteButton: {
    border: "1px solid rgba(244,63,94,.13)",
    background: "rgba(244,63,94,.05)",
    color: "#fda4af",
    borderRadius: 7,
    padding: "6px 8px",
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 8,
    cursor: "pointer",
  },
  empty: {
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
    width: 55,
    height: 55,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    background: "rgba(59,130,246,.08)",
    border: "1px solid rgba(96,165,250,.12)",
    color: "#93c5fd",
    marginBottom: 3,
  },
  emptyButton: {
    marginTop: 5,
    border: "1px solid rgba(96,165,250,.2)",
    background: "rgba(59,130,246,.09)",
    color: "#93c5fd",
    borderRadius: 8,
    padding: "7px 10px",
    display: "flex",
    alignItems: "center",
    gap: 5,
    fontSize: 9,
    cursor: "pointer",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 100,
    background: "rgba(0,0,0,.64)",
    backdropFilter: "blur(8px)",
    display: "grid",
    placeItems: "center",
    padding: 18,
  },
  modal: {
    width: "min(650px, calc(100vw - 40px)), 100%)",
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,.15)",
    background: "#0b1322",
    boxShadow: "0 30px 100px rgba(0,0,0,.48)",
    padding: 20,
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 15,
    marginBottom: 18,
  },
  modalTitle: {
    margin: "5px 0 4px",
    fontSize: 20,
  },
  modalSubtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: 10,
  },
  modalClose: {
    width: 33,
    height: 33,
    borderRadius: 9,
    border: "1px solid rgba(148,163,184,.1)",
    background: "rgba(255,255,255,.03)",
    color: "#94a3b8",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.5fr) minmax(0, 0.8fr)",
    gap: 12,
    width: "100%",
    minWidth: 0,
  },

  field: {
    display: "grid",
    gap: 6,
    minWidth: 0,
    width: "100%",
    maxWidth: "100%",
    color: "#94a3b8",
    fontSize: 9,
    fontWeight: 700,
  },
  formInfo: {
    marginTop: 13,
    padding: "9px 10px",
    borderRadius: 9,
    border: "1px solid rgba(96,165,250,.1)",
    background: "rgba(59,130,246,.05)",
    color: "#64748b",
    fontSize: 9,
    display: "flex",
    alignItems: "center",
    gap: 7,
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 7,
    marginTop: 17,
  },
  cancelButton: {
    border: "1px solid rgba(148,163,184,.11)",
    background: "rgba(255,255,255,.025)",
    color: "#94a3b8",
    borderRadius: 8,
    padding: "8px 11px",
    fontSize: 9,
    cursor: "pointer",
  },
  saveButton: {
    border: "1px solid rgba(96,165,250,.2)",
    background: "linear-gradient(135deg, #2563eb, #4f46e5)",
    color: "#fff",
    borderRadius: 8,
    padding: "8px 12px",
    display: "flex",
    alignItems: "center",
    gap: 5,
    fontSize: 9,
    fontWeight: 700,
    cursor: "pointer",
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    color: "#475569",
    fontSize: 9,
    padding: "16px 3px 4px",
  },
  spin: {
    animation: "adminCoursesSpin 1s linear infinite",
  },
};

if (typeof document !== "undefined") {
  const id = "edusphere-admin-courses-styles";
  if (!document.getElementById(id)) {
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      @keyframes adminCoursesSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

      .admin-courses-table th {
        padding: 0 14px 11px;
        text-align: left;
        color: #64748b;
        font-size: 8px;
        font-weight: 800;
        letter-spacing: 1px;
        white-space: nowrap;
        border-bottom: 1px solid rgba(148,163,184,.10);
      }

      .admin-courses-table td {
        padding: 13px 14px;
        color: #cbd5e1;
        font-size: 10px;
        vertical-align: middle;
        border-bottom: 1px solid rgba(148,163,184,.07);
      }

      .admin-courses-table tbody tr:hover {
        background: rgba(59,130,246,.025);
      }

      .admin-courses-table tbody tr:last-child td {
        border-bottom: 0;
      }

      .admin-courses-table td:first-child {
        width: 34%;
        min-width: 330px;
      }

      .admin-courses-table td:nth-child(2) {
        width: 110px;
      }

      .admin-courses-table td:nth-child(3) {
        width: 29%;
        min-width: 280px;
        max-width: 360px;
      }

      .admin-courses-table td:nth-child(4) {
        width: 115px;
      }

      .admin-courses-table td:last-child {
        width: 155px;
      }

      .admin-courses-table td strong {
        display: block;
        color: #e2e8f0;
        font-size: 10px;
        font-weight: 700;
        line-height: 1.35;
      }

      .admin-courses-table td small {
        display: block;
        margin-top: 3px;
        color: #64748b;
        font-size: 8px;
        line-height: 1.35;
      }

      .admin-courses-search-input {
        width: 100%;
        min-width: 0;
        border: 0;
        outline: 0;
        background: transparent;
        color: #e2e8f0;
        font: inherit;
        font-size: 10px;
      }

      .admin-courses-search-input::placeholder {
        color: #475569;
      }

      .admin-courses-field input,
      .admin-courses-field select {
        width: 100%;
        height: 39px;
        box-sizing: border-box;
        border: 1px solid rgba(148,163,184,.13);
        border-radius: 9px;
        outline: 0;
        background: #070e1a;
        color: #e2e8f0;
        padding: 0 11px;
        font-size: 10px;
      }

      .admin-courses-field select option,
      .admin-courses-select option {
        background: #0b1322;
        color: #e2e8f0;
      }

      .admin-courses-field input:focus,
      .admin-courses-field select:focus,
      .admin-courses-search-input:focus {
        border-color: rgba(96,165,250,.45);
      }

      @media (max-width: 1000px) {
        .admin-courses-table { min-width: 900px; }
        .admin-courses-table td:first-child { min-width: 270px; }
        .admin-courses-table td:nth-child(3) { min-width: 220px; }
      }

      @media (max-width: 820px) {
        .admin-courses-toolbar { flex-direction: column; align-items: stretch !important; }
        .admin-courses-filters { display: grid !important; grid-template-columns: 1fr 1fr; width: 100%; }
        .admin-courses-search { grid-column: 1 / -1; width: 100% !important; }
      }

      @media (max-width: 620px) {
        .admin-courses-main { width: min(100% - 24px, 1320px) !important; padding-top: 18px !important; }
        .admin-courses-header { align-items: flex-start !important; flex-direction: column; }
        .admin-courses-header-actions { width: 100%; }
        .admin-courses-header-actions button { flex: 1; justify-content: center; }
        .admin-courses-stats { grid-template-columns: 1fr !important; }
        .admin-courses-panel { padding: 13px !important; }
        .admin-courses-filters { grid-template-columns: 1fr !important; }
      }
    `;
    document.head.appendChild(style);
  }
}
