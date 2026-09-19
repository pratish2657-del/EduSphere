import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Clock3,
  MapPin,
  RefreshCw,
  Search,
  BookOpen,
  Users,
  GraduationCap,
  ChevronDown,
  X,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import AIChatbot from "../../components/ai/AIChatbot";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

type TimetableItem = {
  timetable_id?: number;
  day?: string | number | null;
  start_time?: string | number | null;
  end_time?: string | number | null;
  room?: string | number | null;
  academic_year?: string;
  current_year?: number;
  program_name?: string;
  program_code?: string;
  section_name?: string;
  section_code?: string;
  course_id?: number;
  course_name?: string;
  course_code?: string;
};

type TimetableResponse = {
  count?: number;
  timetable?: TimetableItem[];
};

const DAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

const COURSE_ACCENTS = [
  { bg: "#EEF2FF", icon: "#4F46E5", line: "#6366F1" },
  { bg: "#ECFDF5", icon: "#059669", line: "#10B981" },
  { bg: "#FFF7ED", icon: "#EA580C", line: "#F97316" },
  { bg: "#F5F3FF", icon: "#7C3AED", line: "#8B5CF6" },
  { bg: "#EFF6FF", icon: "#2563EB", line: "#3B82F6" },
];

function formatTime(value?: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  // API/database time values may arrive as:
  // - "09:30"
  // - "09:30:00"
  // - number of seconds
  // - another serializable value
  if (typeof value === "number" && Number.isFinite(value)) {
    const totalSeconds = Math.max(0, Math.floor(value));
    const hour = Math.floor(totalSeconds / 3600) % 24;
    const minute = Math.floor((totalSeconds % 3600) / 60);
    const suffix = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;

    return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
  }

  const text = String(value).trim();
  if (!text) return "—";

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

function formatDay(value?: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "Unknown";
  }

  const text = String(value).trim();

  if (!text) {
    return "Unknown";
  }

  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

async function apiRequest<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {}

  if (!response.ok) {
    const detail =
      typeof data === "object" &&
      data !== null &&
      "detail" in data &&
      typeof (data as { detail?: unknown }).detail === "string"
        ? (data as { detail: string }).detail
        : `Request failed with status ${response.status}`;
    throw new Error(detail);
  }

  return data as T;
}

export default function ProfessorTimetable() {
  const [items, setItems] = useState<TimetableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedDay, setSelectedDay] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<TimetableItem | null>(null);

  const loadTimetable = async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const data = await apiRequest<TimetableResponse>("/timetable/professor");
      setItems(Array.isArray(data.timetable) ? data.timetable : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load your timetable.",
      );
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadTimetable();
  }, []);

  const istDayName = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
  }).format(new Date());

  const today =
    DAYS[
      ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        .indexOf(istDayName)
    ];

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();

    return items.filter((item) => {
      if (
        selectedDay !== "ALL" &&
        String(item.day ?? "").trim().toUpperCase() !== selectedDay
      )
        return false;

      if (!q) return true;

      return [
        item.course_name,
        item.course_code,
        item.program_name,
        item.program_code,
        item.section_name,
        item.section_code,
        item.room,
        item.academic_year,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [items, selectedDay, search]);

  const grouped = useMemo(() => {
    const result: Record<string, TimetableItem[]> = {};
    DAYS.forEach((day) => (result[day] = []));

    filteredItems.forEach((item) => {
      const day = String(item.day ?? "").trim().toUpperCase();
      if (!result[day]) result[day] = [];
      result[day].push(item);
    });

    Object.values(result).forEach((list) =>
      list.sort((a, b) =>
        String(a.start_time || "").localeCompare(String(b.start_time || "")),
      ),
    );

    return result;
  }, [filteredItems]);

  const courseCount = new Set(
    items.map((x) => x.course_id).filter(Boolean),
  ).size;

  const sectionCount = new Set(
    items
      .map((x) => x.section_name || x.section_code)
      .filter(Boolean),
  ).size;

  const todayCount = items.filter(
    (x) => String(x.day ?? "").trim().toUpperCase() === today,
  ).length;

  return (
    <div className="prof-timetable-root">
      <style>{`
        * { box-sizing: border-box; }
        .prof-timetable-root {
          min-height: 100vh;
          background:
            radial-gradient(circle at 92% 0%, rgba(99,102,241,.12), transparent 27rem),
            radial-gradient(circle at 4% 18%, rgba(14,165,233,.09), transparent 25rem),
            #f7f9fc;
          color: #111827;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .pt-wrap { max-width: 1500px; margin: 0 auto; padding: 30px 30px 50px; }
        .pt-hero {
          position: relative;
          overflow: hidden;
          border-radius: 24px;
          padding: 30px 32px;
          color: white;
          background: linear-gradient(120deg, #1e3a8a 0%, #4f46e5 48%, #7c3aed 100%);
          box-shadow: 0 18px 45px rgba(79,70,229,.22);
          margin-bottom: 20px;
        }
        .pt-hero:after {
          content: "";
          position: absolute;
          width: 260px;
          height: 260px;
          border-radius: 50%;
          right: -80px;
          top: -120px;
          background: rgba(255,255,255,.12);
        }
        .pt-hero-content { position: relative; z-index: 1; display:flex; justify-content:space-between; align-items:flex-end; gap:20px; }
        .pt-kicker { display:flex; align-items:center; gap:8px; font-size:12px; font-weight:800; letter-spacing:.13em; opacity:.82; }
        .pt-title { margin:7px 0 6px; font-size:34px; line-height:1.08; font-weight:850; letter-spacing:-.035em; }
        .pt-subtitle { margin:0; font-size:14px; opacity:.82; }
        .pt-refresh {
          position:relative; z-index:2;
          display:flex; align-items:center; gap:8px;
          border:1px solid rgba(255,255,255,.25);
          background:rgba(255,255,255,.14);
          color:#fff; border-radius:12px; padding:11px 15px;
          font-weight:800; cursor:pointer; backdrop-filter:blur(8px);
        }
        .pt-refresh:hover { background:rgba(255,255,255,.22); }
        .pt-refresh:disabled { opacity:.7; cursor:not-allowed; }
        .pt-stats { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; margin-bottom:20px; }
        .pt-stat {
          position:relative; overflow:hidden; display:flex; align-items:center; gap:14px;
          background:#fff; border:1px solid #e6eaf0; border-radius:18px; padding:18px;
          box-shadow:0 5px 18px rgba(15,23,42,.045);
        }
        .pt-stat:before { content:""; position:absolute; left:0; top:0; bottom:0; width:4px; background:var(--accent); }
        .pt-stat-icon {
          width:44px; height:44px; border-radius:13px; display:grid; place-items:center;
          background:var(--icon-bg); color:var(--accent); flex:0 0 auto;
        }
        .pt-stat-label { display:block; color:#64748b; font-size:12px; font-weight:650; margin-bottom:3px; }
        .pt-stat-value { display:block; color:#111827; font-size:25px; line-height:1; font-weight:850; }
        .pt-toolbar {
          display:flex; align-items:center; justify-content:space-between; gap:14px;
          padding:14px; margin-bottom:18px; background:#fff; border:1px solid #e6eaf0;
          border-radius:17px; box-shadow:0 5px 18px rgba(15,23,42,.04);
        }
        .pt-controls { display:flex; gap:10px; align-items:center; flex:1; min-width:0; }
        .pt-search {
          max-width:600px; flex:1; min-width:240px; height:44px;
          display:flex; align-items:center; gap:9px; padding:0 13px;
          border:1px solid #e1e6ef; border-radius:12px; color:#64748b; background:#fbfcfe;
        }
        .pt-search:focus-within { border-color:#818cf8; box-shadow:0 0 0 3px rgba(99,102,241,.10); background:#fff; }
        .pt-input { width:100%; border:0; outline:0; background:transparent; color:#111827; font-size:14px; }
        .pt-select-wrap { position:relative; min-width:155px; }
        .pt-select { appearance:none; width:100%; height:44px; padding:0 36px 0 13px; border:1px solid #e1e6ef; border-radius:12px; background:#fbfcfe; color:#334155; font-size:14px; outline:0; }
        .pt-select-icon { position:absolute; right:12px; top:14px; pointer-events:none; color:#64748b; }
        .pt-results { color:#64748b; font-size:13px; font-weight:650; white-space:nowrap; }
        .pt-days { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:18px; }
        .pt-day {
          background:#fff; border:1px solid #e5e9f0; border-radius:19px; overflow:hidden;
          box-shadow:0 7px 24px rgba(15,23,42,.045);
        }
        .pt-day-header {
          display:flex; justify-content:space-between; align-items:center; padding:17px 19px;
          background:linear-gradient(180deg,#fff,#f8faff); border-bottom:1px solid #edf0f5;
        }
        .pt-day-header.today { background:linear-gradient(120deg,#eef2ff,#f5f3ff); }
        .pt-day-kicker { display:block; color:#7c3aed; font-size:10px; font-weight:900; letter-spacing:.13em; margin-bottom:3px; }
        .pt-day-name { margin:0; font-size:18px; font-weight:850; letter-spacing:-.02em; }
        .pt-day-count { min-width:31px; height:31px; display:grid; place-items:center; border-radius:10px; background:#eef2ff; color:#4f46e5; font-size:12px; font-weight:850; }
        .pt-class-list { display:grid; gap:11px; padding:13px; }
        .pt-class {
          position:relative; width:100%; text-align:left; overflow:hidden;
          display:block; border:1px solid #e8ebf1; border-radius:15px; background:#fff;
          padding:16px 16px 14px 19px; cursor:pointer; transition:.18s ease;
        }
        .pt-class:before { content:""; position:absolute; left:0; top:0; bottom:0; width:4px; background:var(--line); }
        .pt-class:hover { transform:translateY(-2px); border-color:#d8dff0; box-shadow:0 12px 25px rgba(15,23,42,.08); }
        .pt-time { display:flex; align-items:center; gap:7px; color:#475569; font-size:12px; font-weight:800; margin-bottom:9px; }
        .pt-course { margin:0; color:#111827; font-size:16px; font-weight:850; line-height:1.25; }
        .pt-code { margin-top:4px; color:#64748b; font-size:11px; font-weight:800; }
        .pt-meta { display:flex; flex-wrap:wrap; gap:8px; margin-top:13px; }
        .pt-pill { display:inline-flex; align-items:center; gap:5px; padding:6px 8px; border-radius:8px; background:#f8fafc; color:#475569; font-size:11px; font-weight:700; }
        .pt-bottom { display:flex; justify-content:space-between; gap:10px; margin-top:12px; padding-top:10px; border-top:1px solid #f0f2f6; color:#64748b; font-size:10px; font-weight:750; }
        .pt-empty {
          min-height:340px; display:flex; align-items:center; justify-content:center; text-align:center;
          background:#fff; border:1px solid #e5e9f0; border-radius:20px; padding:30px;
          box-shadow:0 7px 24px rgba(15,23,42,.04);
        }
        .pt-empty-icon { width:68px; height:68px; border-radius:20px; display:grid; place-items:center; margin:0 auto 14px; background:#eef2ff; color:#6366f1; }
        .pt-empty h2 { margin:0 0 7px; font-size:20px; }
        .pt-empty p { max-width:560px; margin:0; color:#64748b; font-size:14px; line-height:1.65; }
        .pt-action { margin-top:17px; border:0; border-radius:11px; padding:10px 15px; background:#4f46e5; color:#fff; font-weight:800; cursor:pointer; }
        .pt-modal-overlay { position:fixed; inset:0; z-index:1000; display:grid; place-items:center; padding:20px; background:rgba(15,23,42,.52); backdrop-filter:blur(3px); }
        .pt-modal { width:min(680px,100%); max-height:90vh; overflow:auto; background:#fff; border-radius:22px; padding:23px; box-shadow:0 30px 80px rgba(15,23,42,.27); }
        .pt-modal-top { display:flex; justify-content:space-between; gap:16px; }
        .pt-modal-kicker { color:#6366f1; font-size:10px; font-weight:900; letter-spacing:.14em; }
        .pt-modal-title { margin:5px 0 0; font-size:24px; font-weight:850; }
        .pt-close { width:38px; height:38px; display:grid; place-items:center; border:1px solid #e5e7eb; background:#fff; border-radius:11px; cursor:pointer; color:#475569; }
        .pt-detail-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:11px; margin-top:20px; }
        .pt-detail { padding:14px; border:1px solid #e8ebf1; border-radius:13px; background:#fafbfe; }
        .pt-detail span { display:block; color:#64748b; font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; margin-bottom:5px; }
        .pt-detail strong { display:block; color:#1e293b; font-size:13px; line-height:1.45; }
        .pt-modal-footer { display:flex; justify-content:flex-end; margin-top:18px; }
        .pt-close-main { border:0; border-radius:11px; padding:10px 16px; background:#111827; color:#fff; font-weight:800; cursor:pointer; }
        .pt-spin { animation:ptspin .8s linear infinite; }
        @keyframes ptspin { to { transform:rotate(360deg); } }
        @media (max-width:1100px){.pt-wrap{padding:24px 22px 42px}.pt-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.pt-days{grid-template-columns:1fr}.pt-hero-content{align-items:flex-start;flex-direction:column}.pt-hero{padding:27px 28px}.pt-toolbar{align-items:stretch}.pt-controls{flex-wrap:wrap}.pt-search{max-width:none;flex:1 1 300px}.pt-select-wrap{flex:0 1 180px}.pt-days{gap:14px}}@media (max-width:768px){.pt-wrap{padding:18px 14px 34px}.pt-hero{padding:22px 20px;border-radius:19px;margin-bottom:13px}.pt-kicker{font-size:10px}.pt-title{font-size:29px}.pt-subtitle{font-size:11px;line-height:1.55}.pt-refresh{width:100%;justify-content:center;padding:10px 13px;font-size:11px}.pt-stats{grid-template-columns:1fr 1fr;gap:9px;margin-bottom:13px}.pt-stat{padding:12px 11px;gap:8px;border-radius:14px}.pt-stat-icon{width:37px;height:37px;border-radius:10px}.pt-stat-label{font-size:9px}.pt-stat-value{font-size:20px}.pt-toolbar{padding:11px;border-radius:14px;gap:8px;margin-bottom:13px}.pt-controls{flex-direction:column;align-items:stretch;gap:8px}.pt-search,.pt-select-wrap{width:100%;max-width:none;min-width:0;flex:1 1 auto}.pt-search{height:42px}.pt-input{font-size:12px}.pt-select{height:42px;font-size:12px}.pt-results{text-align:left;font-size:10px}.pt-day{border-radius:16px}.pt-day-header{padding:13px 14px}.pt-day-name{font-size:16px}.pt-class-list{gap:8px;padding:9px}.pt-class{padding:13px 13px 12px 16px;border-radius:13px}.pt-time{font-size:10px;margin-bottom:7px}.pt-course{font-size:14px}.pt-code{font-size:9px}.pt-meta{gap:6px;margin-top:9px}.pt-pill{font-size:9px;padding:5px 6px}.pt-bottom{font-size:8px;margin-top:9px;padding-top:8px}.pt-empty{min-height:260px;padding:22px}.pt-empty h2{font-size:17px}.pt-empty p{font-size:11px}.pt-modal-overlay{padding:10px}.pt-modal{max-height:calc(100vh - 20px);padding:17px;border-radius:17px}.pt-modal-title{font-size:20px}.pt-detail-grid{grid-template-columns:1fr;gap:8px;margin-top:15px}.pt-detail{padding:11px}.pt-detail strong{font-size:11px}.pt-modal-footer{margin-top:13px}}@media (max-width:480px){.pt-wrap{padding:13px 10px 28px}.pt-hero{padding:19px 16px}.pt-title{font-size:26px}.pt-stats{gap:7px}.pt-stat{padding:10px 9px}.pt-stat-icon{width:34px;height:34px}.pt-stat-label{font-size:8px}.pt-stat-value{font-size:18px}.pt-toolbar{padding:9px}.pt-day-header{padding:12px}.pt-class{padding:11px 11px 10px 14px}.pt-course{font-size:13px}.pt-class-meta{font-size:8px}.pt-footer{font-size:8px;flex-direction:column;align-items:flex-start}}
      `}</style>

      <main className="pt-wrap">
        <section className="pt-hero">
          <div className="pt-hero-content">
            <div>
              <div className="pt-kicker">
                <Sparkles size={15} />
                PROFESSOR WORKSPACE
              </div>
              <h1 className="pt-title">My Timetable</h1>
              <p className="pt-subtitle">
                Your weekly teaching schedule, courses and classroom assignments.
              </p>
            </div>

            <button
              className="pt-refresh"
              type="button"
              onClick={() => void loadTimetable(true)}
              disabled={refreshing}
            >
              <RefreshCw size={17} className={refreshing ? "pt-spin" : ""} />
              {refreshing ? "Refreshing..." : "Refresh Schedule"}
            </button>
          </div>
        </section>

        <section className="pt-stats">
          <Stat label="Teaching Slots" value={items.length} icon={<CalendarDays />} accent="#4F46E5" bg="#EEF2FF" />
          <Stat label="Courses" value={courseCount} icon={<BookOpen />} accent="#059669" bg="#ECFDF5" />
          <Stat label="Sections" value={sectionCount} icon={<Users />} accent="#EA580C" bg="#FFF7ED" />
          <Stat label="Today's Classes" value={todayCount} icon={<GraduationCap />} accent="#7C3AED" bg="#F5F3FF" />
        </section>

        <section className="pt-toolbar">
          <div className="pt-controls">
            <div className="pt-search">
              <Search size={18} />
              <input
                className="pt-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search course, section, room..."
              />
              {search && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearch("")}
                  style={{ border: 0, background: "transparent", cursor: "pointer", color: "#64748b" }}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="pt-select-wrap">
              <select
                className="pt-select"
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
              >
                <option value="ALL">All Days</option>
                {DAYS.map((day) => (
                  <option key={day} value={day}>
                    {formatDay(day)}
                  </option>
                ))}
              </select>
              <ChevronDown className="pt-select-icon" size={16} />
            </div>
          </div>

          <span className="pt-results">
            {filteredItems.length} {filteredItems.length === 1 ? "class" : "classes"} shown
          </span>
        </section>

        {loading ? (
          <EmptyState loading title="Loading timetable" text="Fetching your assigned classes..." />
        ) : error ? (
          <EmptyState
            title="Couldn't load timetable"
            text={error}
            action={
              <button className="pt-action" onClick={() => void loadTimetable()}>
                Try Again
              </button>
            }
          />
        ) : filteredItems.length === 0 ? (
          <EmptyState
            title={items.length === 0 ? "No classes assigned yet" : "No matching classes"}
            text={
              items.length === 0
                ? "Once an administrator assigns a course and timetable slot to your professor profile, it will appear here automatically."
                : "Try another search term or select a different day."
            }
          />
        ) : (
          <div className="pt-days">
            {DAYS.filter((day) => grouped[day]?.length).map((day) => (
              <section className="pt-day" key={day}>
                <header className={`pt-day-header ${day === today ? "today" : ""}`}>
                  <div>
                    <span className="pt-day-kicker">
                      {day === today ? "TODAY" : "SCHEDULE"}
                    </span>
                    <h2 className="pt-day-name">{formatDay(day)}</h2>
                  </div>
                  <span className="pt-day-count">{grouped[day].length}</span>
                </header>

                <div className="pt-class-list">
                  {grouped[day].map((item, index) => {
                    const accent = COURSE_ACCENTS[index % COURSE_ACCENTS.length];
                    return (
                      <button
                        className="pt-class"
                        style={{ "--line": accent.line } as React.CSSProperties}
                        key={item.timetable_id ?? `${day}-${index}`}
                        type="button"
                        onClick={() => setSelectedItem(item)}
                      >
                        <div className="pt-time">
                          <Clock3 size={15} />
                          {formatTime(item.start_time)} – {formatTime(item.end_time)}
                        </div>

                        <h3 className="pt-course">
                          {item.course_name || "Untitled Course"}
                        </h3>

                        <div className="pt-code">
                          {item.course_code || "COURSE"}
                          {item.course_id ? ` • Course ID ${item.course_id}` : ""}
                        </div>

                        <div className="pt-meta">
                          <span className="pt-pill">
                            <Users size={13} />
                            {item.section_name || item.section_code || "Section"}
                          </span>
                          <span className="pt-pill">
                            <MapPin size={13} />
                            {item.room || "Room not set"}
                          </span>
                        </div>

                        <div className="pt-bottom">
                          <span>
                            {item.program_name || item.program_code || "Program"}
                          </span>
                          <span>
                            Year {item.current_year ?? "—"} <ArrowRight size={11} style={{ verticalAlign: "middle" }} />
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {selectedItem && (
          <div
            className="pt-modal-overlay"
            onMouseDown={(e) => {
              if (e.currentTarget === e.target) setSelectedItem(null);
            }}
          >
            <div className="pt-modal" role="dialog" aria-modal="true">
              <div className="pt-modal-top">
                <div>
                  <span className="pt-modal-kicker">CLASS DETAILS</span>
                  <h2 className="pt-modal-title">
                    {selectedItem.course_name || "Untitled Course"}
                  </h2>
                </div>
                <button className="pt-close" onClick={() => setSelectedItem(null)}>
                  <X size={20} />
                </button>
              </div>

              <div className="pt-detail-grid">
                <Detail label="Course" value={`${selectedItem.course_code || "—"}${selectedItem.course_id ? ` • ID ${selectedItem.course_id}` : ""}`} />
                <Detail label="Day & Time" value={`${formatDay(selectedItem.day)} · ${formatTime(selectedItem.start_time)} – ${formatTime(selectedItem.end_time)}`} />
                <Detail label="Program" value={selectedItem.program_name || selectedItem.program_code || "—"} />
                <Detail label="Section" value={selectedItem.section_name || selectedItem.section_code || "—"} />
                <Detail label="Room" value={String(selectedItem.room || "—")} />
                <Detail label="Academic Year" value={selectedItem.academic_year || "—"} />
              </div>

              <div className="pt-modal-footer">
                <button className="pt-close-main" onClick={() => setSelectedItem(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <AIChatbot />

      
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  accent,
  bg,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
  bg: string;
}) {
  return (
    <div className="pt-stat" style={{ "--accent": accent, "--icon-bg": bg } as React.CSSProperties}>
      <div className="pt-stat-icon">{icon}</div>
      <div>
        <span className="pt-stat-label">{label}</span>
        <strong className="pt-stat-value">{value}</strong>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="pt-detail">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EmptyState({
  title,
  text,
  action,
  loading,
}: {
  title: string;
  text: string;
  action?: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="pt-empty">
      <div>
        <div className="pt-empty-icon">
          {loading ? (
            <RefreshCw className="pt-spin" size={32} />
          ) : (
            <CalendarDays size={34} />
          )}
        </div>
        <h2>{title}</h2>
        <p>{text}</p>
        {action}
      </div>
    </div>
  );
}
