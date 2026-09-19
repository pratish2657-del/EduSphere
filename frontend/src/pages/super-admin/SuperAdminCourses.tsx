import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Edit3,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./super-admin-courses.css";
import AIChatbot from "../../components/ai/AIChatbot";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

type Institution = {
  id: number;
  name: string;
  university_code?: string | null;
};

type Program = {
  id: number;
  institution_id: number;
  name: string;
  code: string;
  degree?: string;
  is_active?: boolean;
};

type Course = {
  id: number;
  institution_id: number;
  institution_name?: string;
  university_code?: string | null;
  program_id: number | null;
  program_name?: string | null;
  program_code?: string | null;
  name: string;
  code: string;
  semester: number | null;
  created_at?: string;
};

type FormState = {
  institution_id: string;
  program_id: string;
  name: string;
  code: string;
  semester: string;
};

async function api<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
      ...(options?.headers || {}),
    },
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
        : `Request failed (${response.status})`,
    );
  }
  return data as T;
}

const emptyForm: FormState = {
  institution_id: "",
  program_id: "",
  name: "",
  code: "",
  semester: "1",
};

export default function SuperAdminCourses() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [search, setSearch] = useState("");
  const [institutionFilter, setInstitutionFilter] = useState("");
  const [programFilter, setProgramFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const loadOptions = useCallback(async () => {
    setLoadingOptions(true);
    try {
      const [institutionData, programData] = await Promise.all([
        api<{ institutions?: Institution[] }>("/institutions/"),
        api<{ programs?: Program[] }>("/programs/"),
      ]);
      setInstitutions(institutionData.institutions || []);
      setPrograms(programData.programs || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load course options.",
      );
    } finally {
      setLoadingOptions(false);
    }
  }, []);

  const loadCourses = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (institutionFilter) params.set("institution_id", institutionFilter);
      if (programFilter) params.set("program_id", programFilter);

      const data = await api<{ courses?: Course[] }>(
        `/super-admin/courses/?${params.toString()}`,
      );
      setCourses(data.courses || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load courses.");
    } finally {
      setLoading(false);
    }
  }, [search, institutionFilter, programFilter]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    const timer = window.setTimeout(loadCourses, 250);
    return () => window.clearTimeout(timer);
  }, [loadCourses]);

  const visiblePrograms = useMemo(
    () =>
      form.institution_id
        ? programs.filter(
            (p) =>
              String(p.institution_id) === form.institution_id &&
              p.is_active !== false,
          )
        : [],
    [form.institution_id, programs],
  );

  const filteredPrograms = useMemo(
    () =>
      institutionFilter
        ? programs.filter(
            (p) =>
              String(p.institution_id) === institutionFilter &&
              p.is_active !== false,
          )
        : programs.filter((p) => p.is_active !== false),
    [institutionFilter, programs],
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModal(true);
  };

  const openEdit = (course: Course) => {
    setEditing(course);
    setForm({
      institution_id: String(course.institution_id),
      program_id: String(course.program_id || ""),
      name: course.name,
      code: course.code,
      semester: String(course.semester || 1),
    });
    setModal(true);
  };

  const saveCourse = async () => {
    if (
      !form.institution_id ||
      !form.program_id ||
      !form.name.trim() ||
      !form.code.trim()
    ) {
      setError("Institution, program, course name and code are required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        institution_id: Number(form.institution_id),
        program_id: Number(form.program_id),
        name: form.name.trim(),
        code: form.code.trim(),
        semester: Number(form.semester),
      };

      if (editing) {
        await api(`/super-admin/courses/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await api("/super-admin/courses/", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      setModal(false);
      await loadCourses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save course.");
    } finally {
      setSaving(false);
    }
  };

  const removeCourse = async (course: Course) => {
    if (!window.confirm(`Delete "${course.name}" (${course.code})?`)) return;

    setDeleting(course.id);
    setError("");
    try {
      await api(`/super-admin/courses/${course.id}`, { method: "DELETE" });
      await loadCourses();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete course.",
      );
    } finally {
      setDeleting(null);
    }
  };

  const totalInstitutions = new Set(courses.map((c) => c.institution_id)).size;
  const totalPrograms = new Set(
    courses.map((c) => c.program_id).filter(Boolean),
  ).size;

  return (
    <div className="sac-page">
      <div className="sac-shell">
        <header className="sac-header">
          <div className="sac-title">
            <button className="sac-icon" onClick={() => navigate("/app/super-admin")}>
              <ArrowLeft size={18} />
            </button>
            <div>
              <span>SUPER ADMIN • PLATFORM</span>
              <h1>Global Course Management</h1>
            </div>
          </div>
          <div className="sac-actions">
            <button className="sac-secondary" onClick={loadCourses}>
              <RefreshCw size={16} /> Refresh
            </button>
            <button className="sac-primary" onClick={openCreate} disabled={loadingOptions}>
              <Plus size={17} /> Add Course
            </button>
          </div>
        </header>

        <section className="sac-stats">
          <div><BookOpen size={20}/><span>Total Courses</span><strong>{courses.length}</strong></div>
          <div><Shield size={20}/><span>Institutions</span><strong>{totalInstitutions}</strong></div>
          <div><CheckCircle2 size={20}/><span>Programs</span><strong>{totalPrograms}</strong></div>
          <div><BookOpen size={20}/><span>Access</span><strong>GLOBAL</strong></div>
        </section>

        <section className="sac-panel">
          <div className="sac-toolbar">
            <div className="sac-search">
              <Search size={17}/>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search course, code, institution or program..."
              />
            </div>
            <select value={institutionFilter} onChange={(e) => {
              setInstitutionFilter(e.target.value);
              setProgramFilter("");
            }}>
              <option value="">All Institutions</option>
              {institutions.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
            <select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)}>
              <option value="">All Programs</option>
              {filteredPrograms.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          </div>

          {error && <div className="sac-error"><XCircle size={17}/>{error}</div>}

          {loading ? (
            <div className="sac-empty"><RefreshCw className="sac-spin" size={28}/><strong>Loading courses</strong><span>Reading the global academic catalog...</span></div>
          ) : courses.length === 0 ? (
            <div className="sac-empty"><BookOpen size={30}/><strong>No courses found</strong><span>Create a course or change your filters.</span></div>
          ) : (
            <div className="sac-table-wrap">
              <table className="sac-table">
                <thead>
                  <tr><th>Course</th><th>Institution</th><th>Program</th><th>Semester</th><th>Created</th><th/></tr>
                </thead>
                <tbody>
                  {courses.map((course) => (
                    <tr key={course.id}>
                      <td><div className="sac-course"><div className="sac-course-icon"><BookOpen size={17}/></div><div><strong>{course.name}</strong><span>{course.code} • ID {course.id}</span></div></div></td>
                      <td><strong className="sac-light">{course.institution_name || "—"}</strong><small>{course.university_code || ""}</small></td>
                      <td><strong className="sac-light">{course.program_name || "Unassigned"}</strong><small>{course.program_code || ""}</small></td>
                      <td><span className="sac-semester">Semester {course.semester ?? "—"}</span></td>
                      <td>{course.created_at
                        ? new Date(
                            /(?:Z|[+-]\d{2}:?\d{2})$/i.test(course.created_at)
                              ? course.created_at
                              : `${course.created_at.replace(" ", "T")}Z`
                          ).toLocaleDateString("en-IN", {
                            timeZone: "Asia/Kolkata",
                          })
                        : "—"}</td>
                      <td><div className="sac-row-actions"><button className="sac-edit" onClick={() => openEdit(course)}><Edit3 size={14}/> Edit</button><button className="sac-delete" onClick={() => removeCourse(course)} disabled={deleting === course.id}>{deleting === course.id ? <RefreshCw className="sac-spin" size={14}/> : <Trash2 size={14}/>}</button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {modal && (
        <div className="sac-modal-bg" onMouseDown={() => !saving && setModal(false)}>
          <div className="sac-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="sac-modal-head">
              <div><span>{editing ? "UPDATE COURSE" : "NEW COURSE"}</span><h2>{editing ? "Edit Course" : "Add Course"}</h2></div>
              <button className="sac-icon" onClick={() => setModal(false)} disabled={saving}><X size={18}/></button>
            </div>
            <div className="sac-form">
              <label><span>Institution</span><select value={form.institution_id} onChange={(e) => setForm({...form, institution_id:e.target.value, program_id:""})}><option value="">Select institution</option>{institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
              <label><span>Program</span><select value={form.program_id} onChange={(e) => setForm({...form, program_id:e.target.value})} disabled={!form.institution_id}><option value="">Select program</option>{visiblePrograms.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}</select></label>
              <label><span>Course Name</span><input value={form.name} onChange={(e) => setForm({...form,name:e.target.value})} placeholder="Data Structures and Algorithms"/></label>
              <label><span>Course Code</span><input value={form.code} onChange={(e) => setForm({...form,code:e.target.value})} placeholder="CS301"/></label>
              <label><span>Semester</span><input type="number" min="1" max="12" value={form.semester} onChange={(e) => setForm({...form,semester:e.target.value})}/></label>
            </div>
            <div className="sac-modal-actions"><button className="sac-secondary" onClick={() => setModal(false)} disabled={saving}>Cancel</button><button className="sac-primary" onClick={saveCourse} disabled={saving}>{saving ? "Saving..." : editing ? "Save Changes" : "Create Course"}</button></div>
          </div>
        </div>
      )}
      <AIChatbot />
    </div>
  );
}
