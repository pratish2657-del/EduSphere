import { useEffect, useState } from "react";
import { Activity, BookOpen, Code2, LayoutDashboard, LogOut, Settings, ShieldCheck, Wrench } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../../services/api";
import type { AuthUser } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import "./developer-dashboard.css";
import AIChatbot from "../../components/ai/AIChatbot";

export default function DeveloperDashboard() {
  const navigate = useNavigate();
  const { user: contextUser, logout } = useAuth();
  const [user, setUser] = useState<AuthUser | null>(contextUser ?? null);
  const [loading, setLoading] = useState(!contextUser);

  useEffect(() => {
    let mounted = true;
    api.auth.me().then((value) => {
      if (mounted) setUser(value);
    }).catch(() => {
      if (mounted) navigate("/access", { replace: true });
    }).finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [navigate]);

  async function handleLogout() {
    try { await logout(); } finally { navigate("/", { replace: true }); }
  }

  if (loading) return <div className="developer-shell"><div className="developer-loading">Loading Developer Dashboard…</div></div>;
  if (!user || user.role !== "DEVELOPER") return null;

  const cards = [
    { title: "Developer Dashboard", description: "Monitor your developer workspace, activity and account status.", icon: LayoutDashboard, action: "Overview", disabled: false },
    { title: "System Development", description: "Build and maintain EduSphere features, integrations and technical systems.", icon: Code2, action: "Open Workspace", disabled: false },
    { title: "Technical Management", description: "Review system health, technical services, logs and configuration areas.", icon: Wrench, action: "Technical Tools", disabled: false },
    { title: "Library Management", description: "Create, edit, publish and delete books, study materials, e-books, notes, PDFs and other academic resources.", icon: BookOpen, action: "Open Library", disabled: false },
  ];

  return (
    <div className="developer-shell">
      <header className="developer-topbar">
        <button className="developer-brand" onClick={() => navigate("/app/developer")}>
          <span className="developer-brand-mark"><img src="/edusphere-logo.jpeg" alt="EduSphere" className="developer-brand-logo" /></span>
          <span><strong>EduSphere</strong><small>Developer Console</small></span>
        </button>
        <div className="developer-user">
          <div><strong>{user.full_name || "Developer"}</strong><small>{user.email}</small></div>
          <button className="developer-logout" onClick={handleLogout}><LogOut size={17} /> Logout</button>
        </div>
      </header>

      <main className="developer-main">
        <section className="developer-hero">
          <div>
            <span className="developer-kicker"><ShieldCheck size={14} /> DEVELOPER ACCESS</span>
            <h1>Developer Dashboard</h1>
            <p>Build, maintain and technically manage EduSphere from one workspace.</p>
          </div>
          <div className="developer-status"><span /> Account active</div>
        </section>

        <section className="developer-grid">
          {cards.map(({ title, description, icon: Icon, action, disabled }) => (
            <article key={title} className={`developer-card ${disabled ? "developer-card-disabled" : ""}`}>
              <div className="developer-card-icon"><Icon size={22} /></div>
              <div className="developer-card-body">
                <span className="developer-card-label">DEVELOPER MODULE</span>
                <h2>{title}</h2>
                <p>{description}</p>
              </div>
              <button
                disabled={disabled}
                onClick={() => {
                  if (disabled) return;
                  if (title === "Developer Dashboard") navigate("/app/developer/overview");
                  else if (title === "System Development") navigate("/app/developer/system-development");
                  else if (title === "Technical Management") navigate("/app/developer/technical-management");
                  else if (title === "Library Management") navigate("/app/developer/library");
                }}
              >
                {disabled ? "Restricted" : action} {disabled ? <ShieldCheck size={15} /> : <Activity size={15} />}
              </button>
            </article>
          ))}
        </section>

        <section className="developer-notice">
          <Settings size={19} />
          <div><strong>Library permission</strong><span>Verified Developers can manage Library content across institutions. Students, Professors and Admins retain view-only access, while Super Admin also retains full Library management.</span></div>
        </section>
      </main>
      <AIChatbot/>
    </div>
  );
}
