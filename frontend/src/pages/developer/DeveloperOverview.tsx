import { useEffect, useState } from "react";
import {
  Activity,
  ArrowLeft,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api, apiRequest } from "../../services/api";
import type { AuthUser } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import "./developer-dashboard.css";
import AIChatbot from "../../components/ai/AIChatbot";

type DeveloperProfile = Record<string, unknown>;

const DATE_TIME_FIELDS = new Set([
  "created_at",
  "updated_at",
  "submitted_at",
  "verified_at",
]);

function formatDateTime(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const text = String(value).trim();

  /*
   * Backend timestamps are returned in the form:
   *
   * 2026-09-11T18:39:53
   *
   * Format the timestamp without changing the stored clock time.
   */
  const match = text.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/,
  );

  if (!match) {
    return text;
  }

  const [, year, month, day, hour, minute, second = "00"] = match;

  const hourNumber = Number(hour);
  const hour12 = hourNumber % 12 || 12;
  const period = hourNumber >= 12 ? "PM" : "AM";

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const monthName =
    monthNames[Number(month) - 1] ?? month;

  return `${day} ${monthName} ${year}, ${String(hour12).padStart(
    2,
    "0",
  )}:${minute}:${second} ${period}`;
}

function formatProfileLabel(key: string): string {
  return key
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatProfileValue(
  key: string,
  value: unknown,
): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (DATE_TIME_FIELDS.has(key)) {
    return formatDateTime(value);
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

export default function DeveloperOverview() {
  const navigate = useNavigate();
  const { user: contextUser } = useAuth();

  const [user, setUser] = useState<AuthUser | null>(
    contextUser ?? null,
  );

  const [profile, setProfile] =
    useState<DeveloperProfile | null>(null);

  const [health, setHealth] = useState("Checking");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const [me, developerProfile, healthResult] =
        await Promise.all([
          api.auth.me(),
          apiRequest<DeveloperProfile>(
            "/developer/profile",
          ),
          api.health(),
        ]);

      setUser(me);
      setProfile(developerProfile);
      setHealth(
        healthResult.status || "Online",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load developer overview.",
      );

      try {
        const me = await api.auth.me();
        setUser(me);
      } catch {
        // Keep the current user state if the fallback request fails.
      }

      setHealth("Unavailable");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return (
      <div className="developer-module-shell">
        <div className="developer-loading">
          Loading Developer Overview…
        </div>
      </div>
    );
  }

  const profileEntries = profile
    ? Object.entries(profile).filter(
        ([key, value]) =>
          value !== null &&
          value !== "" &&
          key !== "user_id",
      )
    : [];

  return (
    <div className="developer-module-shell">
      <main className="developer-module-main">
        <div className="developer-module-header">
          <div>
            <button
              className="developer-back"
              onClick={() =>
                navigate("/app/developer")
              }
            >
              <ArrowLeft size={16} />
              Developer Console
            </button>

            <h1>Developer Overview</h1>

            <p>
              Account, verification and workspace
              status from your EduSphere developer
              account.
            </p>
          </div>

          <button
            className="developer-action"
            onClick={() => void load()}
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="developer-error">
            {error}
          </div>
        )}

        <section className="developer-module-grid">
          <article className="developer-module-card">
            <UserRound size={22} />

            <h2>Developer Account</h2>

            <div className="developer-list">
              <div className="developer-list-row">
                <span>Name</span>
                <strong>
                  {user?.full_name || "Developer"}
                </strong>
              </div>

              <div className="developer-list-row">
                <span>Email</span>
                <strong>
                  {user?.email || "—"}
                </strong>
              </div>

              <div className="developer-list-row">
                <span>Role</span>

                <span className="developer-pill">
                  {user?.role || "—"}
                </span>
              </div>
            </div>
          </article>

          <article className="developer-module-card">
            <ShieldCheck size={22} />

            <h2>Verification</h2>

            <div className="developer-health">
              <span className="developer-health-dot" />

              {user?.verification_status ||
                "NOT_AVAILABLE"}
            </div>

            <p style={{ marginTop: 12 }}>
              Verification status is controlled by
              the Super Admin workflow.
            </p>
          </article>

          <article className="developer-module-card">
            <Activity size={22} />

            <h2>Platform Health</h2>

            <div
              className={`developer-health ${
                health === "Unavailable"
                  ? "offline"
                  : ""
              }`}
            >
              <span className="developer-health-dot" />

              {health}
            </div>

            <p style={{ marginTop: 12 }}>
              Live response from the EduSphere
              health endpoint.
            </p>
          </article>
        </section>

        <section
          className="developer-module-card"
          style={{ marginTop: 16 }}
        >
          <h2>Developer Profile</h2>

          {profileEntries.length === 0 ? (
            <p>
              No developer profile data returned
              yet. Complete the Developer Profile to
              submit your application.
            </p>
          ) : (
            <div className="developer-list">
              {profileEntries.map(
                ([key, value]) => (
                  <div
                    className="developer-list-row"
                    key={key}
                  >
                    <span>
                      {formatProfileLabel(key)}
                    </span>

                    <strong>
                      {formatProfileValue(
                        key,
                        value,
                      )}
                    </strong>
                  </div>
                ),
              )}
            </div>
          )}
        </section>
      </main>
      <AIChatbot/>
    </div>
  );
}