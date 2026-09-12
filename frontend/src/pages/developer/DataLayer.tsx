import { useEffect, useState } from "react";
import { ArrowLeft, Database, RefreshCw, ShieldCheck, Server, Table2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../../services/api";
import "./developer-dashboard.css";
import AIChatbot from "../../components/ai/AIChatbot";

const coreTables = [
  "users", "roles", "developer_profiles", "developer_verifications",
  "developer_activity_logs", "marketplace_products", "marketplace_orders",
  "marketplace_payments", "developer_library_resources",
];

export default function DataLayer() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Checking");
  const [checkedAt, setCheckedAt] = useState("");
  const [error, setError] = useState("");

  async function checkDataLayer() {
    setStatus("Checking");
    setError("");
    try {
      const result = await api.health();
      setStatus(result.status || "healthy");
    } catch (err) {
      setStatus("Unavailable");
      setError(err instanceof Error ? err.message : "Unable to check the data layer.");
    } finally {
      setCheckedAt(new Date().toLocaleString());
    }
  }

  useEffect(() => { void checkDataLayer(); }, []);

  const online = status !== "Unavailable" && status !== "Checking";

  return (
    <div className="developer-module-shell">
      <main className="developer-module-main">
        <div className="developer-module-header">
          <div>
            <button className="developer-back" onClick={() => navigate("/app/developer")}>
              <ArrowLeft size={16} /> Developer Console
            </button>
            <h1>Data Layer</h1>
            <p>Safe visibility into the backend-managed EduSphere data layer.</p>
          </div>
          <button className="developer-action" onClick={() => void checkDataLayer()}>
            <RefreshCw size={15} /> Refresh Status
          </button>
        </div>

        {error && <div className="developer-error">{error}</div>}

        <section className="developer-module-grid">
          <article className="developer-module-card">
            <Database size={22} />
            <h2>Database Service</h2>
            <div className={`developer-health ${online ? "" : "offline"}`}>
              <span className="developer-health-dot" /> {online ? "Available" : status}
            </div>
            <p style={{marginTop:12}}>Database credentials stay server-side and are never exposed to the browser.</p>
          </article>

          <article className="developer-module-card">
            <Server size={22} />
            <h2>Database Engine</h2>
            <div className="developer-metric">MySQL</div>
            <p>EduSphere's backend manages database connections and queries.</p>
          </article>

          <article className="developer-module-card">
            <ShieldCheck size={22} />
            <h2>Access Protection</h2>
            <div className="developer-pill">BACKEND CONTROLLED</div>
            <p style={{marginTop:12}}>The browser never receives database usernames, passwords or connection strings.</p>
          </article>
        </section>

        <section className="developer-module-card" style={{marginTop:16}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <Table2 size={22} />
            <div>
              <h2 style={{margin:0}}>Core Data Domains</h2>
              <div className="developer-muted">Representative application tables managed by the backend.</div>
            </div>
          </div>
          <div className="developer-tool-grid">
            {coreTables.map((table) => (
              <div className="developer-tool" key={table}>
                <div><strong>{table}</strong><span>Backend managed</span></div>
                <span className="developer-pill">PROTECTED</span>
              </div>
            ))}
          </div>
          {checkedAt && <div className="developer-muted" style={{marginTop:16}}>Last status check: {checkedAt}</div>}
        </section>
        <AIChatbot/>
      </main>
    </div>
  );
}
