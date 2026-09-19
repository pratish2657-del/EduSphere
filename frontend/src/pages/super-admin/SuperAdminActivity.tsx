import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  BookOpen,
  Building2,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Search,
  Shield,
  UserRound,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./super-admin-activity.css";
import AIChatBot from "../../components/ai/AIChatbot";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

type ActivityItem = {
  activity_type: string;
  reference_id: number;
  action: string;
  subject?: string;
  actor?: string;
  occurred_at?: string;
  description?: string;
};

type ActivityResponse = {
  count: number;
  activities: ActivityItem[];
  note?: string;
};

async function api<T>(endpoint: string): Promise<T> {
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
        : `Request failed (${response.status})`,
    );
  }

  return data as T;
}

function iconFor(type: string) {
  switch (type) {
    case "USER":
      return UserRound;
    case "COURSE":
      return BookOpen;
    case "ADMIN_APPLICATION":
      return Shield;
    case "EVENT":
      return Building2;
    default:
      return Activity;
  }
}

function labelFor(type: string) {
  switch (type) {
    case "USER":
      return "User";
    case "COURSE":
      return "Course";
    case "ADMIN_APPLICATION":
      return "Admin Application";
    case "EVENT":
      return "Event";
    default:
      return type;
  }
}

function formatDate(value?: string) {
  if (!value) return "Unknown time";

  const raw = String(value).trim();
  const hasTimezone = /(?:Z|[+-]\\d{2}:?\\d{2})$/i.test(raw);
  const normalized =
    !hasTimezone &&
    /^\\d{4}-\\d{2}-\\d{2}[ T]\\d{2}:\\d{2}:\\d{2}/.test(raw)
      ? `${raw.replace(" ", "T")}Z`
      : raw;

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function SuperAdminActivity() {
  const navigate = useNavigate();

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadActivity = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (type) params.set("activity_type", type);
      if (search.trim()) params.set("search", search.trim());
      params.set("limit", "250");

      const data = await api<ActivityResponse>(
        `/super-admin/activity/?${params.toString()}`,
      );

      setActivities(data.activities || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load system activity.",
      );
    } finally {
      setLoading(false);
    }
  }, [search, type]);

  useEffect(() => {
    const timer = window.setTimeout(loadActivity, 250);
    return () => window.clearTimeout(timer);
  }, [loadActivity]);

  const counts = useMemo(() => {
    return {
      users: activities.filter((a) => a.activity_type === "USER").length,
      courses: activities.filter((a) => a.activity_type === "COURSE").length,
      applications: activities.filter(
        (a) => a.activity_type === "ADMIN_APPLICATION",
      ).length,
    };
  }, [activities]);

  return (
    <div className="saa-page">
      <div className="saa-shell">
        <header className="saa-header">
          <div className="saa-heading">
            <button
              className="saa-icon"
              onClick={() => navigate("/app/super-admin")}
            >
              <ArrowLeft size={18} />
            </button>

            <div>
              <span>SUPER ADMIN • PLATFORM</span>
              <h1>System Activity</h1>
            </div>
          </div>

          <button className="saa-secondary" onClick={loadActivity}>
            <RefreshCw size={16} /> Refresh
          </button>
        </header>

        <section className="saa-stats">
          <div>
            <Activity size={20} />
            <span>Activity Records</span>
            <strong>{activities.length}</strong>
          </div>

          <div>
            <UserRound size={20} />
            <span>User Activity</span>
            <strong>{counts.users}</strong>
          </div>

          <div>
            <BookOpen size={20} />
            <span>Course Activity</span>
            <strong>{counts.courses}</strong>
          </div>

          <div>
            <Shield size={20} />
            <span>Admin Applications</span>
            <strong>{counts.applications}</strong>
          </div>
        </section>

        <section className="saa-panel">
          <div className="saa-toolbar">
            <div className="saa-search">
              <Search size={17} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search activity, user, action..."
              />
            </div>

            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All Activity</option>
              <option value="USER">Users</option>
              <option value="COURSE">Courses</option>
              <option value="ADMIN_APPLICATION">Admin Applications</option>
              <option value="EVENT">Events</option>
            </select>
          </div>

          {error && (
            <div className="saa-error">
              <XCircle size={17} />
              {error}
            </div>
          )}

          {loading ? (
            <div className="saa-empty">
              <RefreshCw className="saa-spin" size={28} />
              <strong>Loading system activity</strong>
              <span>Reading recent platform records...</span>
            </div>
          ) : activities.length === 0 ? (
            <div className="saa-empty">
              <Activity size={32} />
              <strong>No activity found</strong>
              <span>Try another filter or search term.</span>
            </div>
          ) : (
            <div className="saa-feed">
              {activities.map((item, index) => {
                const Icon = iconFor(item.activity_type);

                return (
                  <article
                    className="saa-item"
                    key={`${item.activity_type}-${item.reference_id}-${index}`}
                  >
                    <div className="saa-item-icon">
                      <Icon size={18} />
                    </div>

                    <div className="saa-item-main">
                      <div className="saa-item-top">
                        <div>
                          <span className="saa-type">
                            {labelFor(item.activity_type)}
                          </span>
                          <h3>{item.subject || "Platform activity"}</h3>
                        </div>

                        <span className="saa-time">
                          <Clock3 size={13} />
                          {formatDate(item.occurred_at)}
                        </span>
                      </div>

                      <p>{item.description || item.action}</p>

                      <div className="saa-meta">
                        <span className="saa-action">{item.action}</span>
                        {item.actor && (
                          <span>
                            Actor: <b>{item.actor}</b>
                          </span>
                        )}
                        <span>Ref #{item.reference_id}</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <div className="saa-note">
            <CheckCircle2 size={14} />
            Activity shown here is based on records currently stored by
            EduSphere.
          </div>
        </section>
      </div>
      <AIChatBot />
    </div>
  );
}
