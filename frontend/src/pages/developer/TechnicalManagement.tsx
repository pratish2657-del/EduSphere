import { useEffect, useState } from "react";
import { Activity, AlertTriangle, ArrowLeft, CheckCircle2, RefreshCw, ShieldCheck, Wifi } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../../services/api";
import "./developer-dashboard.css";
import AIChatbot from "../../components/ai/AIChatbot";

export default function TechnicalManagement() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Checking");
  const [lastChecked, setLastChecked] = useState("");
  const [error, setError] = useState("");

  async function runDiagnostics() {
    setStatus("Checking");
    setError("");
    try {
      const result = await api.health();
      setStatus(result.status || "Online");
    } catch (err) {
      setStatus("Unavailable");
      setError(err instanceof Error ? err.message : "Technical check failed.");
    } finally {
      setLastChecked(new Date().toLocaleString());
    }
  }

  useEffect(() => { void runDiagnostics(); }, []);

  const online = status !== "Unavailable" && status !== "Checking";

  return (
    <div className="developer-module-shell">
      <main className="developer-module-main">
        <div className="developer-module-header">
          <div>
            <button className="developer-back" onClick={() => navigate("/app/developer")}><ArrowLeft size={16} /> Developer Console</button>
            <h1>Technical Management</h1>
            <p>Review service connectivity and safe technical diagnostics for EduSphere.</p>
          </div>
          <button className="developer-action" onClick={() => void runDiagnostics()}><RefreshCw size={15} /> Run Diagnostics</button>
        </div>

        {error && <div className="developer-error"><AlertTriangle size={15} /> {error}</div>}

        <section className="developer-module-grid">
          <article className="developer-module-card">
            {online ? <CheckCircle2 size={22} /> : <AlertTriangle size={22} />}
            <h2>API Health</h2>
            <div className={`developer-health ${status === "Unavailable" ? "offline" : ""}`}>
              <span className="developer-health-dot" /> {status}
            </div>
          </article>
          <article className="developer-module-card">
            <Wifi size={22} />
            <h2>Connectivity</h2>
            <p>The browser can reach the configured EduSphere API endpoint when the health check succeeds.</p>
            <div className="developer-pill" style={{display:"inline-block",marginTop:14}}>{online ? "CONNECTED" : "CHECK REQUIRED"}</div>
          </article>
          <article className="developer-module-card">
            <ShieldCheck size={22} />
            <h2>Security</h2>
            <p>Secrets and server environment values remain backend-side and are not displayed in this console.</p>
          </article>
        </section>

        <section className="developer-module-grid" style={{marginTop:16}}>
          <article className="developer-module-card">
            <Activity size={22} />
            <h2>Diagnostic Result</h2>
            <p>{online ? "Core API health endpoint responded successfully." : "The API health endpoint could not be reached successfully."}</p>
          </article>
          <article className="developer-module-card">
            <h2>Last Checked</h2>
            <div className="developer-metric">{lastChecked || "—"}</div>
            <p>Local browser time.</p>
          </article>
          <article className="developer-module-card">
            <Activity size={22} />
            <h2>Next Step</h2>
            <p>Review safe developer activity logs for recent profile and Library actions without exposing secrets or server configuration.</p>
            <button className="developer-action" style={{marginTop:14}} onClick={() => navigate("/app/developer/system-logs")}>
              View System Logs
            </button>
          </article>
        </section>
      </main>
      <AIChatbot/>
    </div>
  );
}
