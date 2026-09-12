import { useEffect, useState } from "react";
import { ArrowLeft, Code2, Database, Globe, RefreshCw, Server } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../../services/api";
import "./developer-dashboard.css";
import AIChatbot from "../../components/ai/AIChatbot";

export default function SystemDevelopment() {
  const navigate = useNavigate();
  const [health, setHealth] = useState("Checking");
  const [checkedAt, setCheckedAt] = useState("");
  const [error, setError] = useState("");

  async function checkSystem() {
    setError("");
    setHealth("Checking");
    try {
      const result = await api.health();
      setHealth(result.status || "Online");
    } catch (err) {
      setHealth("Unavailable");
      setError(err instanceof Error ? err.message : "Health check failed.");
    } finally {
      setCheckedAt(new Date().toLocaleString());
    }
  }

  useEffect(() => { void checkSystem(); }, []);

  return (
    <div className="developer-module-shell">
      <main className="developer-module-main">
        <div className="developer-module-header">
          <div>
            <button className="developer-back" onClick={() => navigate("/app/developer")}><ArrowLeft size={16} /> Developer Console</button>
            <h1>System Development</h1>
            <p>Developer workspace for reviewing EduSphere's application layers and service connectivity.</p>
          </div>
          <button className="developer-action" onClick={() => void checkSystem()}><RefreshCw size={15} /> Check Services</button>
        </div>

        {error && <div className="developer-error">{error}</div>}

        <section className="developer-module-grid">
          <article className="developer-module-card">
            <Globe size={22} />
            <h2>Frontend</h2>
            <p>Current React application workspace.</p>
            <div className="developer-code-block">Vite + React + TypeScript</div>
          </article>
          <article className="developer-module-card">
            <Server size={22} />
            <h2>Backend API</h2>
            <p>Live backend connectivity check.</p>
            <div className={`developer-health ${health === "Unavailable" ? "offline" : ""}`} style={{marginTop:14}}>
              <span className="developer-health-dot" /> {health}
            </div>
          </article>
          <article className="developer-module-card">
            <button
              type="button"
              className="developer-module-card developer-module-card-button"
              onClick={() => navigate("/app/developer/data-layer")}
            >
              <Database size={22} />
              <h2>Data Layer</h2>
              <p>
                Backend-managed database services. No database credentials are exposed
                in the browser.
              </p>
              <span className="developer-action" style={{ marginTop: 16, alignSelf: "flex-start" }}>
                Open Data Layer →
              </span>
            </button>
          </article>
        </section>

        <section className="developer-module-card" style={{marginTop:16}}>
          <button
            type="button"
            className="developer-module-card developer-module-card-button"
            onClick={() => navigate("/app/developer/development-workspace")}
          >
            <Code2 size={22} />
            <h2>Development Workspace</h2>
            <p>
              Use the project source and backend services for implementation. This
              console deliberately avoids exposing secrets or server environment values.
            </p>

            {checkedAt && (
              <div className="developer-muted" style={{ marginTop: 12 }}>
                Last service check: {checkedAt}
              </div>
            )}

            <span className="developer-action" style={{ marginTop: 16, alignSelf: "flex-start" }}>
              Open Workspace →
            </span>
          </button>
        </section>
      </main>
      <AIChatbot/>
    </div>
  );
}
