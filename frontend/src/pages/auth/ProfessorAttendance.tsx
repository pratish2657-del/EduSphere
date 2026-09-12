import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, CalendarDays, Check, CheckCircle2,
  ClipboardCheck, Clock3, Loader2, RefreshCw, Search, ShieldCheck, Users, X, XCircle
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import AIChatbot from "../../components/ai/AIChatbot";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

type Course = {
  course_id: number;
  course_name: string;
  course_code?: string;
  semester?: number;
};

type Student = {
  user_id: number;
  full_name: string;
  email?: string;
  enrollment_number?: string;
  student_id?: string;
  section_name?: string;
  section_code?: string;
  semester?: number;
  is_active?: boolean;
  courses?: Course[];
};

type AttendanceRow = {
  id: number;
  student_id: number;
  student_name: string;
  course_id: number;
  course_name: string;
  course_code?: string;
  attendance_date: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | string;
};

type StudentsResponse = {
  students?: Student[];
  total?: number;
  count?: number;
};

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });

  let data: any = null;
  try { data = await response.json(); } catch {}

  if (!response.ok) {
    throw new Error(
      typeof data?.detail === "string"
        ? data.detail
        : `Request failed with status ${response.status}`
    );
  }
  return data as T;
}

function todayISO() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function initials(name?: string) {
  return name?.trim()
    ? name.trim().split(/\s+/).map(x => x[0]).join("").slice(0, 2).toUpperCase()
    : "ST";
}

const statusMeta = {
  PRESENT: { label: "Present", icon: CheckCircle2, cls: "pa-present" },
  ABSENT: { label: "Absent", icon: XCircle, cls: "pa-absent" },
  LATE: { label: "Late", icon: Clock3, cls: "pa-late" },
  EXCUSED: { label: "Excused", icon: ShieldCheck, cls: "pa-excused" },
} as const;

export default function ProfessorAttendance() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [courseId, setCourseId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [view, setView] = useState<"mark" | "history">("mark");
  const [marks, setMarks] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const loadCourses = useCallback(async () => {
    const data: any = await request("/professor/dashboard/");
    const list = data?.courses?.items ?? [];
    const normalized = list
      .map((x: any) => ({
        course_id: Number(x.course_id ?? x.id ?? 0),
        course_name: x.course_name ?? x.name ?? "Course",
        course_code: x.course_code ?? x.code,
        semester: x.semester,
      }))
      .filter((x: Course) => x.course_id > 0);
    setCourses(normalized);
    if (!courseId && normalized.length) setCourseId(String(normalized[0].course_id));
  }, [courseId]);

  const loadStudents = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        course_id: courseId,
        page: "1",
        limit: "100",
      });
      const data = await request<StudentsResponse>(`/professor/students/?${params}`);
      const list = (data.students ?? []).filter(s =>
        s.courses?.some(c => String(c.course_id) === courseId)
      );
      setStudents(list);
      const initial: Record<number, string> = {};
      list.forEach(s => { initial[s.user_id] = "PRESENT"; });
      setMarks(initial);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load students.");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  const loadHistory = useCallback(async () => {
    if (!courseId) return;
    setHistoryLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (date) params.set("attendance_date", date);
      const data = await request<{ attendance?: AttendanceRow[] }>(
        `/attendance/course/${courseId}${params.toString() ? `?${params}` : ""}`
      );
      setRecords(data.attendance ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load attendance history.");
    } finally {
      setHistoryLoading(false);
    }
  }, [courseId, date]);

  useEffect(() => {
    loadCourses().catch(e => setError(e instanceof Error ? e.message : "Unable to load courses."));
  }, [loadCourses]);

  useEffect(() => {
    if (view === "mark") loadStudents();
    else loadHistory();
  }, [view, loadStudents, loadHistory]);

  const selectedCourse = courses.find(c => String(c.course_id) === courseId);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter(s => {
      if (!q) return true;
      return [s.full_name, s.email, s.enrollment_number, s.student_id, s.section_name]
        .filter(Boolean).some(v => String(v).toLowerCase().includes(q));
    });
  }, [students, search]);

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter(r => {
      const matchesSearch = !q || [r.student_name, r.course_code, r.course_name]
        .filter(Boolean).some(v => String(v).toLowerCase().includes(q));
      return matchesSearch && (statusFilter === "ALL" || r.status === statusFilter);
    });
  }, [records, search, statusFilter]);

  const counts = useMemo(() => {
    const values = Object.values(marks);
    return {
      total: students.length,
      present: values.filter(x => x === "PRESENT").length,
      absent: values.filter(x => x === "ABSENT").length,
      late: values.filter(x => x === "LATE").length,
      excused: values.filter(x => x === "EXCUSED").length,
    };
  }, [students.length, marks]);

  const setAll = (status: string) => {
    const next: Record<number, string> = {};
    filteredStudents.forEach(s => { next[s.user_id] = status; });
    setMarks(prev => ({ ...prev, ...next }));
  };

  const markAttendance = async () => {
    if (!courseId || !students.length) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      let created = 0;
      for (const student of students) {
        await request("/attendance/", {
          method: "POST",
          body: JSON.stringify({
            student_id: student.user_id,
            course_id: Number(courseId),
            attendance_date: date,
            status: marks[student.user_id] || "PRESENT",
          }),
        });
        created++;
      }
      setNotice(`Attendance saved for ${created} student${created === 1 ? "" : "s"}.`);
      setView("history");
      await loadHistory();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to save attendance. Existing records are protected from duplicates."
      );
    } finally {
      setSaving(false);
    }
  };

  const updateRecord = async (id: number, status: string) => {
    try {
      await request(`/attendance/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      setRecords(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update attendance.");
    }
  };

  const summary = useMemo(() => {
    const rows = filteredRecords;
    return {
      total: rows.length,
      present: rows.filter(r => r.status === "PRESENT").length,
      absent: rows.filter(r => r.status === "ABSENT").length,
      late: rows.filter(r => r.status === "LATE").length,
      excused: rows.filter(r => r.status === "EXCUSED").length,
    };
  }, [filteredRecords]);

  return (
    <div className="pa-page">
      <style>{css}</style>

      <div className="pa-orb pa-orb-a" />
      <div className="pa-orb pa-orb-b" />

      <header className="pa-topbar">
        <button className="pa-back" onClick={() => navigate("/app/professor")}>
          <ArrowLeft size={17} /> Dashboard
        </button>
        <div className="pa-brand">
          <div className="pa-brand-icon"><ClipboardCheck size={21} /></div>
          <div><strong>EduSphere</strong><span>Professor Workspace</span></div>
        </div>
        <div className="pa-user"><span>{initials(user?.full_name ?? undefined)}</span><b>{user?.full_name || "Professor"}</b></div>
      </header>

      <main className="pa-shell">
        <section className="pa-hero">
          <div>
            <div className="pa-eyebrow"><span /> ACADEMIC MANAGEMENT</div>
            <h1>Attendance <em>Control Center</em></h1>
            <p>Mark, review and correct attendance for students enrolled in your assigned courses.</p>
          </div>
          <div className="pa-hero-3d">
            <div className="pa-3d-ring r1" /><div className="pa-3d-ring r2" />
            <div className="pa-3d-core"><ClipboardCheck size={38} /></div>
          </div>
        </section>

        <section className="pa-controls">
          <div className="pa-field">
            <label>Course</label>
            <select value={courseId} onChange={e => setCourseId(e.target.value)}>
              {!courses.length && <option value="">No assigned courses</option>}
              {courses.map(c => <option key={c.course_id} value={c.course_id}>
                {c.course_code ? `${c.course_code} — ` : ""}{c.course_name}
              </option>)}
            </select>
          </div>
          <div className="pa-field">
            <label>Date</label>
            <div className="pa-date"><CalendarDays size={17} /><input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          </div>
          <div className="pa-field pa-search">
            <label>Search students</label>
            <div className="pa-input"><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, enrollment no..." /></div>
          </div>
          <button className="pa-refresh" onClick={() => view === "mark" ? loadStudents() : loadHistory()} title="Refresh">
            <RefreshCw size={18} />
          </button>
        </section>

        <section className="pa-tabs">
          <button className={view === "mark" ? "active" : ""} onClick={() => setView("mark")}>
            <ClipboardCheck size={17} /> Mark Attendance
          </button>
          <button className={view === "history" ? "active" : ""} onClick={() => setView("history")}>
            <Clock3 size={17} /> Attendance History
          </button>
        </section>

        {notice && <div className="pa-notice"><CheckCircle2 size={18} /> {notice}<button onClick={() => setNotice("")}><X size={15}/></button></div>}
        {error && <div className="pa-error"><XCircle size={18} /> {error}<button onClick={() => setError("")}><X size={15}/></button></div>}

        {view === "mark" ? (
          <>
            <section className="pa-stats">
              <Stat label="Students" value={counts.total} icon={Users} />
              <Stat label="Present" value={counts.present} icon={CheckCircle2} cls="green" />
              <Stat label="Absent" value={counts.absent} icon={XCircle} cls="red" />
              <Stat label="Late / Excused" value={counts.late + counts.excused} icon={Clock3} cls="purple" />
            </section>

            <section className="pa-panel">
              <div className="pa-panel-head">
                <div><span className="pa-kicker">LIVE ROSTER</span><h2>{selectedCourse?.course_code || "Course"} <small>{selectedCourse?.course_name || "Select a course"}</small></h2></div>
                <div className="pa-bulk">
                  <button onClick={() => setAll("PRESENT")}><Check size={15}/> All Present</button>
                  <button onClick={() => setAll("ABSENT")}><X size={15}/> All Absent</button>
                </div>
              </div>

              {loading ? (
                <Empty icon={Loader2} title="Loading roster..." text="Fetching students enrolled in this course." spin />
              ) : !filteredStudents.length ? (
                <Empty icon={Users} title="No students found" text="No enrolled students match your current search." />
              ) : (
                <div className="pa-table-wrap">
                  <table className="pa-table">
                    <thead><tr><th>Student</th><th>Enrollment</th><th>Section</th><th>Status</th></tr></thead>
                    <tbody>
                      {filteredStudents.map((s, i) => (
                        <tr key={s.user_id}>
                          <td><div className="pa-student"><span className={`pa-avatar a${i % 5}`}>{initials(s.full_name)}</span><div><b>{s.full_name}</b><small>{s.email || "Student account"}</small></div></div></td>
                          <td>{s.enrollment_number || s.student_id || "—"}</td>
                          <td>{s.section_name || s.section_code || "—"}</td>
                          <td>
                            <div className="pa-statuses">
                              {(["PRESENT","ABSENT","LATE","EXCUSED"] as const).map(st => {
                                const M = statusMeta[st]; const Icon = M.icon;
                                return <button key={st} className={`${M.cls} ${marks[s.user_id] === st ? "selected" : ""}`} onClick={() => setMarks(p => ({...p, [s.user_id]: st}))}><Icon size={14}/>{M.label}</button>
                              })}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="pa-panel-foot">
                <span>{filteredStudents.length} of {students.length} students</span>
                <button className="pa-save" disabled={saving || !students.length} onClick={markAttendance}>
                  {saving ? <><Loader2 size={17} className="spin"/> Saving...</> : <><Check size={17}/> Save Attendance</>}
                </button>
              </div>
            </section>
          </>
        ) : (
          <section className="pa-panel">
            <div className="pa-panel-head">
              <div><span className="pa-kicker">RECENT RECORDS</span><h2>{selectedCourse?.course_code || "Course"} <small>{date}</small></h2></div>
              <select className="pa-filter" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="ALL">All statuses</option><option value="PRESENT">Present</option><option value="ABSENT">Absent</option><option value="LATE">Late</option><option value="EXCUSED">Excused</option>
              </select>
            </div>

            <div className="pa-history-summary">
              <Mini label="Total" value={summary.total}/><Mini label="Present" value={summary.present}/><Mini label="Absent" value={summary.absent}/><Mini label="Late" value={summary.late}/><Mini label="Excused" value={summary.excused}/>
            </div>

            {historyLoading ? <Empty icon={Loader2} title="Loading history..." text="Fetching attendance records." spin /> :
             !filteredRecords.length ? <Empty icon={ClipboardCheck} title="No attendance records" text="There are no records for the selected course/date." /> :
             <div className="pa-table-wrap"><table className="pa-table"><thead><tr><th>Student</th><th>Date</th><th>Course</th><th>Status</th></tr></thead><tbody>
              {filteredRecords.map(r => <tr key={r.id}><td><div className="pa-student"><span className="pa-avatar a1">{initials(r.student_name)}</span><div><b>{r.student_name}</b><small>ID #{r.student_id}</small></div></div></td><td>{r.attendance_date}</td><td>{r.course_code || r.course_name}</td><td><select className={`pa-record-status ${String(r.status).toLowerCase()}`} value={r.status} onChange={e => updateRecord(r.id, e.target.value)}><option value="PRESENT">Present</option><option value="ABSENT">Absent</option><option value="LATE">Late</option><option value="EXCUSED">Excused</option></select></td></tr>)}
             </tbody></table></div>}
          </section>
        )}

        <footer className="pa-footer">© {new Date().getFullYear()} EduSphere <span>•</span> Professor Attendance</footer>
      </main>
      <AIChatbot />
    </div>
  );
}

function Stat({ label, value, icon: Icon, cls = "" }: any) {
  return <div className={`pa-stat ${cls}`}><div><span>{label}</span><strong>{value}</strong></div><Icon size={23}/></div>;
}
function Mini({ label, value }: any) { return <div><span>{label}</span><b>{value}</b></div>; }
function Empty({ icon: Icon, title, text, spin = false }: any) { return <div className="pa-empty"><Icon size={30} className={spin ? "spin" : ""}/><h3>{title}</h3><p>{text}</p></div>; }

const css = `
.pa-page{min-height:100vh;background:radial-gradient(circle at 8% 5%,rgba(59,130,246,.18),transparent 26%),radial-gradient(circle at 92% 18%,rgba(168,85,247,.16),transparent 25%),#060a13;color:#edf4ff;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow-x:hidden}
.pa-orb{position:fixed;border-radius:50%;filter:blur(70px);pointer-events:none;opacity:.35}.pa-orb-a{width:280px;height:280px;background:#2563eb;top:35%;left:-160px}.pa-orb-b{width:250px;height:250px;background:#9333ea;right:-140px;bottom:8%}
.pa-topbar{height:72px;border-bottom:1px solid rgba(148,163,184,.13);display:flex;align-items:center;justify-content:space-between;padding:0 30px;background:rgba(5,9,17,.72);backdrop-filter:blur(18px);position:relative;z-index:3}
.pa-back{border:0;background:rgba(255,255,255,.055);color:#cbd5e1;border:1px solid rgba(148,163,184,.13);border-radius:11px;padding:9px 13px;display:flex;gap:8px;align-items:center;cursor:pointer}.pa-back:hover{background:rgba(255,255,255,.1)}
.pa-brand{display:flex;align-items:center;gap:10px}.pa-brand-icon{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;background:linear-gradient(135deg,#2563eb,#9333ea);box-shadow:0 8px 30px rgba(59,130,246,.25)}.pa-brand strong{display:block;font-size:14px}.pa-brand span{display:block;font-size:10px;color:#718096;letter-spacing:.12em;text-transform:uppercase}.pa-user{display:flex;align-items:center;gap:9px;color:#cbd5e1;font-size:12px}.pa-user span{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#3b82f6,#a855f7);font-size:11px;font-weight:800}
.pa-shell{width:min(1380px,calc(100% - 48px));margin:auto;padding:30px 0 45px;position:relative;z-index:1}
.pa-hero{min-height:215px;border:1px solid rgba(148,163,184,.13);border-radius:24px;padding:30px 38px;display:flex;align-items:center;justify-content:space-between;overflow:hidden;background:linear-gradient(110deg,rgba(37,99,235,.19),rgba(91,33,182,.13) 55%,rgba(15,23,42,.7));box-shadow:0 25px 80px rgba(0,0,0,.25)}.pa-eyebrow{font-size:10px;letter-spacing:.18em;color:#8fb5ff;font-weight:800;display:flex;gap:8px;align-items:center}.pa-eyebrow span{width:7px;height:7px;border-radius:50%;background:#60a5fa;box-shadow:0 0 16px #60a5fa}.pa-hero h1{font-size:clamp(32px,4vw,52px);line-height:1.02;margin:14px 0 12px;letter-spacing:-.04em}.pa-hero h1 em{font-style:normal;background:linear-gradient(90deg,#60a5fa,#c084fc);-webkit-background-clip:text;color:transparent}.pa-hero p{max-width:650px;color:#91a1b8;margin:0;line-height:1.7;font-size:14px}
.pa-hero-3d{width:160px;height:160px;position:relative;display:grid;place-items:center;perspective:700px;margin-right:30px}.pa-3d-core{width:76px;height:76px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 30% 25%,#93c5fd,#2563eb 45%,#312e81);box-shadow:0 0 55px rgba(59,130,246,.55),inset -12px -14px 24px rgba(15,23,42,.5);animation:paFloat 4s ease-in-out infinite}.pa-3d-ring{position:absolute;border:1px solid rgba(125,211,252,.7);border-radius:50%;width:130px;height:45px;transform:rotateX(65deg) rotateZ(18deg);animation:paRing 5s linear infinite}.pa-3d-ring.r2{width:145px;height:55px;transform:rotateY(67deg) rotateZ(-22deg);border-color:rgba(192,132,252,.65);animation-duration:7s}.pa-3d-ring.r1:after,.pa-3d-ring.r2:after{content:"";position:absolute;width:6px;height:6px;border-radius:50%;background:#a5f3fc;top:50%;left:0;box-shadow:0 0 16px #67e8f9}
@keyframes paFloat{50%{transform:translateY(-9px) rotateY(10deg)}}@keyframes paRing{to{transform:rotateX(65deg) rotateZ(378deg)}} 
.pa-controls{margin:20px 0 14px;display:grid;grid-template-columns:1.1fr .7fr 1.3fr auto;gap:12px}.pa-field label{display:block;font-size:10px;color:#718096;text-transform:uppercase;letter-spacing:.12em;font-weight:800;margin:0 0 7px}.pa-field select,.pa-date,.pa-input,.pa-filter{height:44px;width:100%;box-sizing:border-box;background:rgba(15,23,42,.82);border:1px solid rgba(148,163,184,.14);border-radius:12px;color:#e5edf8;padding:0 12px;outline:none}.pa-field select:focus,.pa-input:focus-within{border-color:rgba(96,165,250,.65);box-shadow:0 0 0 3px rgba(59,130,246,.1)}.pa-date,.pa-input{display:flex;align-items:center;gap:9px}.pa-date svg,.pa-input svg{color:#718096}.pa-date input,.pa-input input{border:0;outline:0;background:transparent;color:#e5edf8;width:100%;font:inherit}.pa-refresh{height:44px;margin-top:17px;width:44px;border-radius:12px;border:1px solid rgba(148,163,184,.14);background:rgba(255,255,255,.055);color:#b9c8db;cursor:pointer}.pa-refresh:hover{background:rgba(96,165,250,.12);color:#93c5fd}
.pa-tabs{display:flex;gap:7px;padding:5px;background:rgba(15,23,42,.7);border:1px solid rgba(148,163,184,.12);border-radius:14px;width:max-content}.pa-tabs button{border:0;background:transparent;color:#7f8da3;padding:10px 15px;border-radius:10px;display:flex;gap:8px;align-items:center;cursor:pointer;font-weight:750;font-size:12px}.pa-tabs button.active{background:linear-gradient(135deg,rgba(37,99,235,.8),rgba(109,40,217,.8));color:#fff;box-shadow:0 8px 25px rgba(37,99,235,.2)}
.pa-notice,.pa-error{margin-top:14px;border-radius:12px;padding:11px 13px;display:flex;align-items:center;gap:9px;font-size:12px}.pa-notice{background:rgba(16,185,129,.09);border:1px solid rgba(16,185,129,.2);color:#86efac}.pa-error{background:rgba(239,68,68,.09);border:1px solid rgba(239,68,68,.2);color:#fca5a5}.pa-notice button,.pa-error button{margin-left:auto;background:transparent;border:0;color:inherit;cursor:pointer}
.pa-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0}.pa-stat{border:1px solid rgba(148,163,184,.13);border-radius:16px;padding:17px 18px;background:linear-gradient(145deg,rgba(30,41,59,.68),rgba(15,23,42,.5));display:flex;align-items:center;justify-content:space-between}.pa-stat span{font-size:10px;color:#738198;text-transform:uppercase;letter-spacing:.1em}.pa-stat strong{display:block;font-size:25px;margin-top:5px}.pa-stat>svg{color:#60a5fa}.pa-stat.green>svg{color:#34d399}.pa-stat.red>svg{color:#fb7185}.pa-stat.purple>svg{color:#c084fc}
.pa-panel{border:1px solid rgba(148,163,184,.13);border-radius:18px;background:rgba(10,16,28,.78);overflow:hidden;box-shadow:0 20px 70px rgba(0,0,0,.2)}.pa-panel-head{padding:19px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(148,163,184,.1)}.pa-kicker{font-size:9px;letter-spacing:.16em;color:#718096;font-weight:850}.pa-panel-head h2{margin:5px 0 0;font-size:19px}.pa-panel-head h2 small{font-size:11px;font-weight:500;color:#718096;margin-left:7px}.pa-bulk{display:flex;gap:7px}.pa-bulk button{border:1px solid rgba(148,163,184,.13);background:rgba(255,255,255,.04);color:#aebbd0;border-radius:9px;padding:8px 10px;font-size:11px;cursor:pointer}.pa-bulk button:hover{background:rgba(59,130,246,.1);color:#bfdbfe}
.pa-table-wrap{overflow:auto}.pa-table{width:100%;border-collapse:collapse;min-width:800px}.pa-table th{text-align:left;padding:11px 18px;color:#66758c;font-size:9px;text-transform:uppercase;letter-spacing:.12em;background:rgba(15,23,42,.55)}.pa-table td{padding:12px 18px;border-top:1px solid rgba(148,163,184,.07);color:#aab7c9;font-size:12px}.pa-table tbody tr:hover{background:rgba(59,130,246,.035)}.pa-student{display:flex;align-items:center;gap:10px}.pa-student b{display:block;color:#e6edf7;font-size:12px}.pa-student small{display:block;color:#64748b;font-size:10px;margin-top:3px}.pa-avatar{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;font-size:10px;font-weight:850;color:#fff;background:linear-gradient(135deg,#2563eb,#7c3aed);flex:none}.pa-avatar.a1{background:linear-gradient(135deg,#0891b2,#2563eb)}.pa-avatar.a2{background:linear-gradient(135deg,#7c3aed,#db2777)}.pa-avatar.a3{background:linear-gradient(135deg,#059669,#0d9488)}.pa-avatar.a4{background:linear-gradient(135deg,#ea580c,#db2777)}
.pa-statuses{display:flex;gap:5px;flex-wrap:wrap}.pa-statuses button{display:flex;align-items:center;gap:5px;border:1px solid transparent;border-radius:8px;padding:6px 8px;font-size:10px;font-weight:750;cursor:pointer;opacity:.55}.pa-statuses button.selected{opacity:1;box-shadow:0 0 0 1px currentColor}.pa-present{color:#34d399;background:rgba(16,185,129,.09);border-color:rgba(16,185,129,.14)!important}.pa-absent{color:#fb7185;background:rgba(244,63,94,.09);border-color:rgba(244,63,94,.14)!important}.pa-late{color:#fbbf24;background:rgba(245,158,11,.09);border-color:rgba(245,158,11,.14)!important}.pa-excused{color:#c084fc;background:rgba(168,85,247,.09);border-color:rgba(168,85,247,.14)!important}
.pa-panel-foot{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-top:1px solid rgba(148,163,184,.09);color:#64748b;font-size:11px}.pa-save{border:0;border-radius:10px;padding:10px 15px;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;font-weight:800;display:flex;align-items:center;gap:7px;cursor:pointer;box-shadow:0 10px 25px rgba(37,99,235,.2)}.pa-save:disabled{opacity:.5;cursor:not-allowed}
.pa-empty{text-align:center;padding:60px 20px;color:#607089}.pa-empty svg{color:#5b6c85}.pa-empty h3{color:#cbd5e1;margin:12px 0 5px;font-size:15px}.pa-empty p{font-size:11px;margin:0}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
.pa-history-summary{display:grid;grid-template-columns:repeat(5,1fr);gap:1px;background:rgba(148,163,184,.08);border-bottom:1px solid rgba(148,163,184,.09)}.pa-history-summary>div{padding:13px 17px;background:rgba(10,16,28,.8)}.pa-history-summary span{display:block;color:#66758c;font-size:9px;text-transform:uppercase;letter-spacing:.1em}.pa-history-summary b{display:block;font-size:19px;margin-top:4px}.pa-filter{width:160px;height:38px}.pa-record-status{background:rgba(255,255,255,.04);border:1px solid rgba(148,163,184,.12);border-radius:8px;color:#cbd5e1;padding:6px 8px;font-size:11px}.pa-footer{text-align:center;color:#526078;font-size:10px;padding:25px}.pa-footer span{margin:0 8px}
@media(max-width:900px){.pa-shell{width:min(100% - 24px,700px);padding-top:18px}.pa-topbar{padding:0 14px}.pa-user b{display:none}.pa-hero{padding:25px;min-height:185px}.pa-hero-3d{width:110px;height:110px;margin-right:0}.pa-3d-core{width:62px;height:62px}.pa-3d-ring{width:100px;height:35px}.pa-controls{grid-template-columns:1fr 1fr}.pa-search{grid-column:1/-1}.pa-refresh{margin-top:17px}.pa-stats{grid-template-columns:1fr 1fr}}
@media(max-width:600px){.pa-brand{display:none}.pa-topbar{height:62px}.pa-hero{display:block}.pa-hero-3d{position:absolute;right:15px;top:90px;opacity:.35}.pa-hero h1{font-size:34px;max-width:75%}.pa-controls{grid-template-columns:1fr}.pa-refresh{margin-top:0;width:100%}.pa-tabs{width:100%}.pa-tabs button{flex:1;justify-content:center}.pa-stats{grid-template-columns:1fr 1fr}.pa-panel-head{align-items:flex-start;gap:12px;flex-direction:column}.pa-bulk{width:100%}.pa-bulk button{flex:1}.pa-panel-foot{gap:10px;align-items:stretch;flex-direction:column}.pa-save{justify-content:center}.pa-history-summary{grid-template-columns:repeat(3,1fr)}}
@media(prefers-reduced-motion:reduce){.pa-3d-core,.pa-3d-ring{animation:none}.spin{animation:none}}
`;

export { css };
