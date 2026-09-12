import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  CheckCircle2,
  Edit3,
  GraduationCap,
  Plus,
  RefreshCw,
  Search,
  Save,
  X,
} from "lucide-react";
import AIChatbot from "../../components/ai/AIChatbot";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

type ManagedResult = {
  result_id: number;
  student_profile_id: number;
  student_id: string | null;
  enrollment_number: string | null;
  institution_id: number | null;
  program_name: string | null;
  program_code: string | null;
  academic_year: string | null;
  current_year: number | null;
  section_name: string | null;
  section_code: string | null;
  course_id: number;
  course_name: string;
  course_code: string;
  exam_type: string;
  result_academic_year: string;
  result_semester: number;
  marks_obtained: number | string | null;
  maximum_marks: number | string | null;
  grade: string | null;
  grade_point: number | string | null;
  credits: number | string | null;
  credit_points: number | string | null;
  result_status: string;
  uploaded_by: number;
  uploaded_by_name: string | null;
  created_at: string;
  updated_at: string;
};

type ManagementResponse = {
  count: number;
  results: ManagedResult[];
};

type FormState = {
  enrollment_number: string;
  subject_code: string;
  exam_type: string;
  academic_year: string;
  semester: string;
  grade: string;
  grade_point: string;
  credits: string;
  credit_points: string;
  marks_obtained: string;
  maximum_marks: string;
  result_status: "PASS" | "FAIL" | "ABSENT" | "WITHHELD";
};

const emptyForm: FormState = {
  enrollment_number: "",
  subject_code: "",
  exam_type: "End Semester Examination",
  academic_year: "",
  semester: "",
  grade: "",
  grade_point: "",
  credits: "",
  credit_points: "",
  marks_obtained: "",
  maximum_marks: "",
  result_status: "PASS",
};

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 12px",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.14)",
    background: "rgba(2,6,23,0.55)",
    color: "#e2e8f0",
    outline: "none",
    fontSize: 12,
  };
}

function labelStyle(): React.CSSProperties {
  return {
    display: "block",
    color: "#64748b",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    marginBottom: 7,
  };
}

function normalizeNumber(value: string) {
  return value.trim() === "" ? null : Number(value);
}

export default function ResultsManagementView() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [results, setResults] = useState<ManagedResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [searchEnrollment, setSearchEnrollment] = useState("");
  const [searchSubject, setSearchSubject] = useState("");
  const [searchAcademicYear, setSearchAcademicYear] = useState("");
  const [searchSemester, setSearchSemester] = useState("");

  const loadResults = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (searchEnrollment.trim()) {
        params.set("enrollment_number", searchEnrollment.trim());
      }
      if (searchSubject.trim()) {
        params.set("subject_code", searchSubject.trim());
      }
      if (searchAcademicYear.trim()) {
        params.set("academic_year", searchAcademicYear.trim());
      }
      if (searchSemester.trim()) {
        params.set("semester", searchSemester.trim());
      }

      const query = params.toString();
      const response = await fetch(
        `${API_BASE_URL}/results/manage${query ? `?${query}` : ""}`,
        {
          credentials: "include",
          headers: { Accept: "application/json" },
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          String(data?.detail || data?.message || "Unable to load result records.")
        );
      }

      setResults((data as ManagementResponse).results ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to the results service."
      );
    } finally {
      setLoading(false);
    }
  }, [searchEnrollment, searchSubject, searchAcademicYear, searchSemester]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  const updateField = <K extends keyof FormState>(
    field: K,
    value: FormState[K]
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setNotice("");
  };

  const editResult = (result: ManagedResult) => {
    setEditingId(result.result_id);
    setForm({
      enrollment_number: result.enrollment_number ?? "",
      subject_code: result.course_code ?? "",
      exam_type: result.exam_type ?? "",
      academic_year: result.result_academic_year ?? "",
      semester: String(result.result_semester ?? ""),
      grade: result.grade ?? "",
      grade_point:
        result.grade_point === null ? "" : String(result.grade_point),
      credits: result.credits === null ? "" : String(result.credits),
      credit_points:
        result.credit_points === null ? "" : String(result.credit_points),
      marks_obtained:
        result.marks_obtained === null ? "" : String(result.marks_obtained),
      maximum_marks:
        result.maximum_marks === null ? "" : String(result.maximum_marks),
      result_status:
        (result.result_status as FormState["result_status"]) || "PASS",
    });
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    const semester = Number(form.semester);
    if (!form.enrollment_number.trim() || !form.subject_code.trim()) {
      setError("Enrollment number and subject code are required.");
      setSaving(false);
      return;
    }
    if (!Number.isInteger(semester) || semester < 1 || semester > 12) {
      setError("Semester must be a whole number between 1 and 12.");
      setSaving(false);
      return;
    }

    const payload = {
      enrollment_number: form.enrollment_number.trim(),
      subject_code: form.subject_code.trim(),
      exam_type: form.exam_type.trim(),
      academic_year: form.academic_year.trim(),
      semester,
      marks_obtained: normalizeNumber(form.marks_obtained),
      maximum_marks: normalizeNumber(form.maximum_marks),
      grade: form.grade.trim() || null,
      grade_point: normalizeNumber(form.grade_point),
      credits: normalizeNumber(form.credits),
      credit_points: normalizeNumber(form.credit_points),
      result_status: form.result_status,
    };

    try {
      const response = await fetch(
        `${API_BASE_URL}/results${editingId ? `/${editingId}` : "/"}`,
        {
          method: editingId ? "PUT" : "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          String(data?.detail || data?.message || "Unable to save result.")
        );
      }

      setNotice(
        editingId
          ? "Result updated successfully."
          : "Result entered successfully."
      );
      resetForm();
      await loadResults();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save the result."
      );
    } finally {
      setSaving(false);
    }
  };

  const clearFilters = () => {
    setSearchEnrollment("");
    setSearchSubject("");
    setSearchAcademicYear("");
    setSearchSemester("");
  };

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={hero3d}>
        <div className="results-3d-scene" aria-hidden="true">
          <div className="results-3d-orb">
            <div className="results-3d-ring results-3d-ring-a" />
            <div className="results-3d-ring results-3d-ring-b" />
            <div className="results-3d-core"><GraduationCap size={34} /></div>
          </div>
        </div>
        <div>
          <span style={eyebrow}>ACADEMIC MANAGEMENT</span>
          <h1 style={title}>Results Management</h1>
          <p style={description}>Enter, review and update official examination results for students assigned to your courses.</p>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <span style={eyebrow}>RESULTS MANAGEMENT</span>
          <h2 style={title}>Enter & Manage Grades</h2>
          <p style={description}>
            Record the official Statement of Grades data against a real student
            enrollment number and subject code.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            resetForm();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          style={primaryButton}
        >
          <Plus size={16} />
          New Result
        </button>
      </div>

      <style>{`
        .results-3d-scene{width:76px;height:76px;position:relative;perspective:500px;flex:0 0 auto}
        .results-3d-orb{width:58px;height:58px;position:absolute;left:9px;top:9px;transform-style:preserve-3d;animation:resultsOrbFloat 5s ease-in-out infinite}
        .results-3d-core{position:absolute;inset:11px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#e0e7ff;background:radial-gradient(circle at 35% 30%,#818cf8,#4f46e5 55%,#312e81);box-shadow:0 0 28px rgba(99,102,241,.5);transform:translateZ(16px)}
        .results-3d-ring{position:absolute;inset:0;border:2px solid rgba(129,140,248,.55);border-radius:50%;transform-style:preserve-3d}
        .results-3d-ring-a{transform:rotateX(68deg);animation:resultsRingA 4s linear infinite}
        .results-3d-ring-b{transform:rotateY(68deg);animation:resultsRingB 5s linear infinite}
        @keyframes resultsOrbFloat{50%{transform:translateY(-6px) rotateZ(4deg)}}
        @keyframes resultsRingA{to{transform:rotateX(68deg) rotateZ(360deg)}}
        @keyframes resultsRingB{to{transform:rotateY(68deg) rotateZ(-360deg)}}
        @media(max-width:700px){.results-3d-scene{display:none}}
        @media(prefers-reduced-motion:reduce){.results-3d-orb,.results-3d-ring{animation:none!important}}
      `}</style>

      {(error || notice) && (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: `1px solid ${
              error
                ? "rgba(248,113,113,0.18)"
                : "rgba(74,222,128,0.16)"
            }`,
            background: error
              ? "rgba(127,29,29,0.14)"
              : "rgba(20,83,45,0.14)",
            color: error ? "#fca5a5" : "#86efac",
            fontSize: 11,
          }}
        >
          {error || notice}
        </div>
      )}

      <form onSubmit={submit} style={panel}>
        <div style={panelHeader}>
          <div>
            <span style={cardEyebrow}>
              {editingId ? "EDIT RECORD" : "NEW RECORD"}
            </span>
            <h3 style={panelTitle}>
              {editingId ? `Result #${editingId}` : "Statement of Grades Entry"}
            </h3>
          </div>
          <GraduationCap size={21} color="#a5b4fc" />
        </div>

        <div style={formGrid}>
          <div>
            <label style={labelStyle()}>Enrollment Number *</label>
            <input
              style={inputStyle()}
              value={form.enrollment_number}
              onChange={(e) => updateField("enrollment_number", e.target.value)}
              placeholder="e.g. 2025CSEAI001"
              required
            />
          </div>

          <div>
            <label style={labelStyle()}>Subject Code *</label>
            <input
              style={inputStyle()}
              value={form.subject_code}
              onChange={(e) => updateField("subject_code", e.target.value)}
              placeholder="e.g. ESC301"
              required
            />
          </div>

          <div>
            <label style={labelStyle()}>Exam Type *</label>
            <input
              style={inputStyle()}
              value={form.exam_type}
              onChange={(e) => updateField("exam_type", e.target.value)}
              placeholder="End Semester Examination"
              required
            />
          </div>

          <div>
            <label style={labelStyle()}>Academic Year *</label>
            <input
              style={inputStyle()}
              value={form.academic_year}
              onChange={(e) => updateField("academic_year", e.target.value)}
              placeholder="2026-2027"
              required
            />
          </div>

          <div>
            <label style={labelStyle()}>Semester *</label>
            <input
              style={inputStyle()}
              type="number"
              min={1}
              max={12}
              value={form.semester}
              onChange={(e) => updateField("semester", e.target.value)}
              placeholder="3"
              required
            />
          </div>

          <div>
            <label style={labelStyle()}>Letter Grade</label>
            <input
              style={inputStyle()}
              value={form.grade}
              onChange={(e) =>
                updateField("grade", e.target.value.toUpperCase())
              }
              placeholder="A / A+ / B / F"
            />
          </div>

          <div>
            <label style={labelStyle()}>Grade Point</label>
            <input
              style={inputStyle()}
              type="number"
              min={0}
              step="0.01"
              value={form.grade_point}
              onChange={(e) => updateField("grade_point", e.target.value)}
              placeholder="9.00"
            />
          </div>

          <div>
            <label style={labelStyle()}>Credits</label>
            <input
              style={inputStyle()}
              type="number"
              min={0}
              step="0.5"
              value={form.credits}
              onChange={(e) => updateField("credits", e.target.value)}
              placeholder="4"
            />
          </div>

          <div>
            <label style={labelStyle()}>Credit Points</label>
            <input
              style={inputStyle()}
              type="number"
              min={0}
              step="0.01"
              value={form.credit_points}
              onChange={(e) => updateField("credit_points", e.target.value)}
              placeholder="36.00"
            />
          </div>

          <div>
            <label style={labelStyle()}>Marks Obtained</label>
            <input
              style={inputStyle()}
              type="number"
              min={0}
              step="0.01"
              value={form.marks_obtained}
              onChange={(e) => updateField("marks_obtained", e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div>
            <label style={labelStyle()}>Maximum Marks</label>
            <input
              style={inputStyle()}
              type="number"
              min={0.01}
              step="0.01"
              value={form.maximum_marks}
              onChange={(e) => updateField("maximum_marks", e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div>
            <label style={labelStyle()}>Result Status</label>
            <select
              style={inputStyle()}
              value={form.result_status}
              onChange={(e) =>
                updateField(
                  "result_status",
                  e.target.value as FormState["result_status"]
                )
              }
            >
              <option value="PASS">PASS</option>
              <option value="FAIL">FAIL</option>
              <option value="ABSENT">ABSENT</option>
              <option value="WITHHELD">WITHHELD</option>
            </select>
          </div>
        </div>

        <div
          style={{
            marginTop: 14,
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(99,102,241,0.06)",
            border: "1px solid rgba(129,140,248,0.10)",
            color: "#818cf8",
            fontSize: 10,
          }}
        >
          Credit points are validated server-side as <strong>credits × grade point</strong>.
          Marks are optional because the Statement of Grades can be grade-only.
        </div>

        <div style={actions}>
          <button type="submit" disabled={saving} style={primaryButton}>
            {saving ? <RefreshCw size={15} /> : editingId ? <Save size={15} /> : <CheckCircle2 size={15} />}
            {saving ? "Saving..." : editingId ? "Update Result" : "Save Result"}
          </button>

          {editingId && (
            <button type="button" onClick={resetForm} style={secondaryButton}>
              <X size={15} />
              Cancel Edit
            </button>
          )}
        </div>
      </form>

      <section style={panel}>
        <div style={panelHeader}>
          <div>
            <span style={cardEyebrow}>LIVE DATABASE</span>
            <h3 style={panelTitle}>Existing Result Records</h3>
          </div>
          <button
            type="button"
            onClick={loadResults}
            disabled={loading}
            style={secondaryButton}
          >
            <RefreshCw size={14} />
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        <div style={filterGrid}>
          <div>
            <label style={labelStyle()}>Enrollment</label>
            <input
              style={inputStyle()}
              value={searchEnrollment}
              onChange={(e) => setSearchEnrollment(e.target.value)}
              placeholder="Search enrollment"
            />
          </div>
          <div>
            <label style={labelStyle()}>Subject Code</label>
            <input
              style={inputStyle()}
              value={searchSubject}
              onChange={(e) => setSearchSubject(e.target.value)}
              placeholder="Search subject"
            />
          </div>
          <div>
            <label style={labelStyle()}>Academic Year</label>
            <input
              style={inputStyle()}
              value={searchAcademicYear}
              onChange={(e) => setSearchAcademicYear(e.target.value)}
              placeholder="2026-2027"
            />
          </div>
          <div>
            <label style={labelStyle()}>Semester</label>
            <input
              style={inputStyle()}
              type="number"
              min={1}
              max={12}
              value={searchSemester}
              onChange={(e) => setSearchSemester(e.target.value)}
              placeholder="3"
            />
          </div>
          <button type="button" onClick={clearFilters} style={secondaryButton}>
            <Search size={14} />
            Clear Filters
          </button>
        </div>

        {results.length === 0 ? (
          <div style={empty}>
            <GraduationCap size={28} color="#818cf8" />
            <strong>No result records found</strong>
            <span>Use the form above to enter a student's official grade statement.</span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {results.map((result) => (
              <div key={result.result_id} style={recordRow}>
                <div style={{ minWidth: 0, flex: 1.7 }}>
                  <strong style={recordTitle}>{result.course_name}</strong>
                  <div style={recordMeta}>
                    {result.course_code} · {result.exam_type}
                  </div>
                </div>

                <div style={recordMetric}>
                  <span>ENROLLMENT</span>
                  <strong>{result.enrollment_number || "—"}</strong>
                </div>

                <div style={recordMetric}>
                  <span>GRADE</span>
                  <strong style={{ color: "#a5b4fc" }}>{result.grade || "—"}</strong>
                </div>

                <div style={recordMetric}>
                  <span>POINT</span>
                  <strong>{result.grade_point ?? "—"}</strong>
                </div>

                <div style={recordMetric}>
                  <span>CREDITS</span>
                  <strong>{result.credits ?? "—"}</strong>
                </div>

                <div style={recordMetric}>
                  <span>CREDIT POINTS</span>
                  <strong>{result.credit_points ?? "—"}</strong>
                </div>

                <button
                  type="button"
                  onClick={() => editResult(result)}
                  style={iconButton}
                  title="Edit result"
                >
                  <Edit3 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
        <AIChatbot />
      </section>
    </section>
  );
}

const hero3d: React.CSSProperties = { display:"flex", alignItems:"center", gap:18, padding:"18px 20px", borderRadius:20, background:"linear-gradient(135deg, rgba(30,41,59,.86), rgba(49,46,129,.45))", border:"1px solid rgba(129,140,248,.18)", overflow:"hidden" };

const eyebrow: React.CSSProperties = {
  display: "block",
  color: "#6366f1",
  fontSize: 9,
  fontWeight: 900,
  letterSpacing: "0.16em",
};

const title: React.CSSProperties = {
  margin: "6px 0 7px",
  color: "#f8fafc",
  fontSize: 25,
  letterSpacing: "-0.035em",
};

const description: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 12,
  lineHeight: 1.6,
  maxWidth: 680,
};

const panel: React.CSSProperties = {
  padding: 18,
  borderRadius: 18,
  background: "rgba(15,23,42,0.60)",
  border: "1px solid rgba(148,163,184,0.10)",
  boxShadow: "0 18px 50px rgba(0,0,0,0.16)",
};

const panelHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 16,
};

const cardEyebrow: React.CSSProperties = {
  color: "#475569",
  fontSize: 8,
  fontWeight: 900,
  letterSpacing: "0.13em",
};

const panelTitle: React.CSSProperties = {
  margin: "5px 0 0",
  color: "#e2e8f0",
  fontSize: 15,
};

const formGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 13,
};

const filterGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr)) auto",
  gap: 10,
  marginBottom: 16,
};

const actions: React.CSSProperties = {
  display: "flex",
  gap: 9,
  marginTop: 16,
  flexWrap: "wrap",
};

const primaryButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(129,140,248,0.24)",
  background: "rgba(99,102,241,0.15)",
  color: "#c7d2fe",
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 800,
};

const secondaryButton: React.CSSProperties = {
  ...primaryButton,
  border: "1px solid rgba(148,163,184,0.13)",
  background: "rgba(15,23,42,0.72)",
  color: "#94a3b8",
};

const iconButton: React.CSSProperties = {
  width: 34,
  height: 34,
  flex: "0 0 34px",
  display: "grid",
  placeItems: "center",
  borderRadius: 9,
  border: "1px solid rgba(129,140,248,0.15)",
  background: "rgba(99,102,241,0.09)",
  color: "#a5b4fc",
  cursor: "pointer",
};

const recordRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 13,
  padding: "13px 14px",
  borderRadius: 13,
  background: "rgba(2,6,23,0.40)",
  border: "1px solid rgba(148,163,184,0.08)",
  overflowX: "auto",
};

const recordTitle: React.CSSProperties = {
  display: "block",
  color: "#f8fafc",
  fontSize: 11,
  whiteSpace: "nowrap",
};

const recordMeta: React.CSSProperties = {
  marginTop: 4,
  color: "#64748b",
  fontSize: 9,
  whiteSpace: "nowrap",
};

const recordMetric: React.CSSProperties = {
  minWidth: 72,
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const empty: React.CSSProperties = {
  minHeight: 180,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  color: "#64748b",
  textAlign: "center",
  fontSize: 11,
};
