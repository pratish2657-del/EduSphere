import { useEffect, useState } from "react";
import { Activity, ArrowLeft, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api, apiRequest } from "../../services/api";
import "./developer-dashboard.css";
import AIChatbot from "../../components/ai/AIChatbot";

type ActivityLog = {
  id?: number;
  action?: string;
  entity_type?: string;
  entity_id?: number | null;
  details?: unknown;
  created_at?: string;
};

export default function DeveloperSystemLogs() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [verificationStatus, setVerificationStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadLogs() {
    setLoading(true);
    setError("");
    try {
      const [result, me] = await Promise.all([
        apiRequest<{ logs?: ActivityLog[] }>("/developer/library/activity?limit=100"),
        api.auth.me(),
      ]);
      setLogs(result.logs ?? []);
      setVerificationStatus(me.verification_status || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load developer activity logs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadLogs(); }, []);

  return (
    <div className="developer-module-shell">
      <main className="developer-module-main">
        <div className="developer-module-header">
          <div>
            <button className="developer-back" onClick={() => navigate("/app/developer/technical-management")}>
              <ArrowLeft size={16} /> Technical Management
            </button>
            <h1>System Logs</h1>
            <p>Safe developer activity logs from your EduSphere workspace.</p>
          </div>
          <button className="developer-action" onClick={() => void loadLogs()} disabled={loading}>
            <RefreshCw size={15} /> {loading ? "Loading…" : "Refresh Logs"}
          </button>
        </div>

        {error && <div className="developer-error">{error}</div>}

        <section className="developer-module-card">
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <Activity size={22} />
            <div>
              <h2 style={{margin:0}}>Developer Activity</h2>
              <div className="developer-muted">Recent actions performed by your verified Developer account.</div>
            </div>
          </div>

          {loading ? (
            <div className="developer-loading" style={{minHeight:180}}>Loading logs…</div>
          ) : logs.length === 0 ? (
            <div className="developer-muted" style={{padding:"28px 0"}}>No developer activity logs are available yet.</div>
          ) : (
            <div className="developer-list">
              {logs.map((log, index) => (
                <div className="developer-list-row" key={log.id ?? `${log.action}-${index}`}>
                  <div>
                    <strong>{log.action || "Activity"}</strong>
                    <div className="developer-muted">
                      {log.entity_type || "SYSTEM"}
                      {log.entity_id != null ? ` #${log.entity_id}` : ""}
                    </div>
                    <div className="developer-code-block">
                      {log.details && typeof log.details === "object" && Object.keys(log.details as Record<string, unknown>).length > 0
                        ? JSON.stringify(log.details, null, 2)
                        : log.action === "PROFILE_SUBMITTED"
                          ? verificationStatus === "VERIFIED"
                          ? "Developer profile was submitted successfully and has been VERIFIED by Super Admin."
                          : verificationStatus === "REJECTED"
                            ? "Developer profile was submitted, but the application was later REJECTED by Super Admin."
                            : "Developer profile submitted successfully. Verification is pending Super Admin review."
                          : log.action === "LIBRARY_UPDATE"
                            ? "Library resource updated successfully."
                            : log.action === "LIBRARY_DELETE"
                              ? "Library resource deleted successfully."
                              : log.action === "LIBRARY_CREATE"
                                ? "Library resource created successfully."
                                : typeof log.details === "string" && log.details
                                  ? log.details
                                  : "Activity recorded successfully."}
                    </div>
                  </div>
                  <span className="developer-muted">
                    {log.created_at ? new Date(log.created_at).toLocaleString() : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="developer-notice">
          <Activity size={19} />
          <div>
            <strong>Security</strong>
            <span>These logs contain application activity only. Secrets, passwords, API keys and server environment values are never displayed here.</span>
          </div>
        </section>
      </main>
      <AIChatbot/>
    </div>
  );
}
