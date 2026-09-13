import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Bot, ExternalLink, FileCode2, FolderOpen, GitBranch, RefreshCw, Send, Server, ShieldCheck, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../../services/api";
import AIChatbot from "../../components/ai/AIChatbot";
import "./development-workspace.css";

type CodeFile = {
  id: number;
  filename: string;
  language: string;
  content: string;
  updated_at: string;
  created_at: string;
};

type Submission = {
  id: number;
  file_id: number;
  filename: string;
  language: string;
  description: string;
  status: string;
  remarks?: string | null;
  submitted_at: string;
  reviewed_at?: string | null;
};

const IDE_URL = (import.meta.env.VITE_DEVELOPER_IDE_URL || "").replace(/\/$/, "");

export default function DevelopmentWorkspace() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<CodeFile[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [ideOnline, setIdeOnline] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitOpen, setSubmitOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<CodeFile | null>(null);
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [developerId, setDeveloperId] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);


  const loadWorkspaceData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [fileData, submissionData] = await Promise.all([
        apiRequest<{ developer_id: number; files: CodeFile[] }>("/developer/workspace/files"),
        apiRequest<{ submissions: Submission[] }>("/developer/workspace/submissions"),
      ]);
      const id = Number(fileData.developer_id);
      if (!Number.isInteger(id) || id <= 0) throw new Error("Developer account could not be resolved");
      setDeveloperId(id);
      setFiles(fileData.files ?? []);
      setSubmissions(submissionData.submissions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load Developer workspace data");
    } finally {
      setLoading(false);
    }
  }, []);

  const syncIde = useCallback(async () => {
    setSyncing(true);
    setError("");
    try {
      const result = await apiRequest<{ synced?: Array<{ filename: string }>; skipped?: Array<{ filename: string; reason: string }> }>("/developer/workspace/ide/sync", { method: "POST" });
      const syncedCount = result.synced?.length ?? 0;
      const skippedCount = result.skipped?.length ?? 0;
      setMessage(`Synced ${syncedCount} IDE file${syncedCount === 1 ? "" : "s"} to EduSphere${skippedCount ? ` · ${skippedCount} skipped` : ""}.`);
      await loadWorkspaceData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sync IDE files");
    } finally {
      setSyncing(false);
    }
  }, [loadWorkspaceData]);

  const exportToIde = useCallback(async () => {
    setSyncing(true);
    setError("");
    try {
      const result = await apiRequest<{ exported: number }>("/developer/workspace/ide/export", { method: "POST" });
      setMessage(`Exported ${result.exported ?? 0} saved EduSphere file${result.exported === 1 ? "" : "s"} to your IDE.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to export files to IDE");
    } finally {
      setSyncing(false);
    }
  }, []);

  const checkIde = useCallback(async () => {
    setIdeOnline(null);

    if (!IDE_URL) {
      setIdeOnline(false);
      setError(
        "Developer IDE is not configured for this deployment. Set VITE_DEVELOPER_IDE_URL in Vercel to the public HTTPS URL of the browser IDE service."
      );
      return;
    }

    try {
      const response = await fetch(`${IDE_URL}/healthz`, {
        method: "GET",
        cache: "no-store",
        mode: "cors",
      });
      if (!response.ok) {
        throw new Error(`IDE health check returned HTTP ${response.status}.`);
      }
      setIdeOnline(true);
    } catch {
      setIdeOnline(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspaceData();
    void checkIde();
  }, [loadWorkspaceData, checkIde]);

  const submitFile = async () => {
    if (!selectedFile) return;
    try {
      await apiRequest("/developer/workspace/ide/sync", { method: "POST" });
      await apiRequest<{ message: string }>(`/developer/workspace/files/${selectedFile.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim() || `Submit ${selectedFile.filename} for Super Admin review.` }),
      });
      setMessage(`${selectedFile.filename} submitted for Super Admin review.`);
      setDescription("");
      setSubmitOpen(false);
      setSelectedFile(null);
      const data = await apiRequest<{ submissions: Submission[] }>("/developer/workspace/submissions");
      setSubmissions(data.submissions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to submit file");
    }
  };

  if (loading) {
    return <div className="dw-page dw-loading"><RefreshCw size={28} className="dw-spin" /><h2>Opening Developer Workspace</h2><p>Loading your workspace metadata…</p></div>;
  }

  return (
    <div className="dw-page">
      <header className="dw-topbar">
        <button className="dw-brand" onClick={() => navigate("/app/developer")}><ArrowLeft size={16} /><span>Developer Console</span></button>
        <div className="dw-title"><FileCode2 size={18} /><strong>Development Workspace</strong><span>VS Code-compatible browser IDE</span></div>
        <div className="dw-actions">
          <div className={`dw-ide-status ${ideOnline === true ? "online" : ideOnline === false ? "offline" : "checking"}`}>
            <span /> {ideOnline === true ? "IDE Online" : ideOnline === false ? "IDE Offline" : "Checking IDE"}
          </div>
          <button
            onClick={() => {
              if (!IDE_URL || !developerId) return;
              window.open(
                `${IDE_URL}/?folder=${encodeURIComponent(`/home/coder/workspace/${developerId}`)}`,
                "_blank",
                "noopener,noreferrer",
              );
            }}
            disabled={!IDE_URL || !developerId || ideOnline !== true}
          >
            <ExternalLink size={15} /> Open IDE
          </button>
          <button className="dw-ai" onClick={() => window.dispatchEvent(new Event("edusphere-open-ai"))}><Bot size={15} /> AI</button>
        </div>
      </header>

      <div className="dw-layout">
        <aside className="dw-rail">
          <div className="dw-rail-section">
            <div className="dw-rail-title"><FolderOpen size={14} /> WORKSPACE</div>
            <div className="dw-rail-note">Your browser IDE runs in an isolated Developer workspace. EduSphere source code and secrets are not mounted into it. Use <b>Sync IDE</b> after saving code; submissions always sync the IDE first.</div>
          </div>

          <div className="dw-rail-section">
            <div className="dw-rail-title"><FileCode2 size={14} /> SAVED EDUSPHERE FILES</div>
            {files.length ? files.slice(0, 12).map(file => (
              <div className="dw-file-row" key={file.id}>
                <FileCode2 size={13} />
                <span title={file.filename}>{file.filename}</span>
                <button title={`Submit ${file.filename}`} onClick={() => { setSelectedFile(file); setSubmitOpen(true); }}><Send size={12} /></button>
              </div>
            )) : <div className="dw-empty">No files saved through the EduSphere submission workspace yet.</div>}
          </div>

          <div className="dw-rail-section">
            <div className="dw-rail-title"><Send size={14} /> SUBMISSIONS</div>
            {submissions.length ? submissions.slice(0, 8).map(item => (
              <div className="dw-submission" key={item.id}>
                <span>{item.filename}</span>
                <em className={item.status.toLowerCase()}>{item.status}</em>
              </div>
            )) : <div className="dw-empty">No submissions yet.</div>}
          </div>

          <div className="dw-safety-card">
            <ShieldCheck size={18} />
            <strong>Safe development boundary</strong>
            <span>Accepted submissions are reviewed and downloaded by Super Admin. They never auto-deploy into EduSphere.</span>
          </div>
        </aside>

        <main className="dw-main">
          <div className="dw-ide-header">
            <div>
              <strong>Developer IDE</strong>
              <span>Real browser-hosted VS Code workbench</span>
            </div>
            <div className="dw-ide-actions">
              <button onClick={() => void syncIde()} disabled={syncing}><RefreshCw size={14} className={syncing ? "dw-spin" : ""} /> {syncing ? "Syncing" : "Sync IDE"}</button><button onClick={() => void exportToIde()} disabled={syncing}><FolderOpen size={14} /> Export DB</button><button onClick={() => void checkIde()}><RefreshCw size={14} /> Check</button>
              <button onClick={() => window.open("https://github.com/", "_blank", "noopener,noreferrer")}><GitBranch size={14} /> GitHub</button>
            </div>
          </div>

          {ideOnline === false ? (
            <div className="dw-ide-offline">
              <Server size={34} />
              <h2>Developer IDE is not running</h2>
              <p>
                {IDE_URL
                  ? "The configured browser IDE service is unreachable. Start the IDE service and reload this page."
                  : "This production deployment has no browser IDE URL configured."}
              </p>
              {!IDE_URL && (
                <code>VITE_DEVELOPER_IDE_URL=https://your-public-ide.example.com</code>
              )}
              <button onClick={() => void checkIde()}><RefreshCw size={14} /> Check again</button>
            </div>
          ) : (
            <iframe
              className="dw-ide-frame"
              src={`${IDE_URL}/?folder=${encodeURIComponent(`/home/coder/workspace${developerId ? `/${developerId}` : ""}`)}`}
              title="EduSphere Developer VS Code Workspace"
              allow="clipboard-read; clipboard-write"
            />
          )}

          {error && <div className="dw-toast error">{error}</div>}
          {message && <div className="dw-toast success">{message}</div>}
        </main>
      </div>

      {submitOpen && selectedFile && (
        <div className="dw-modal-backdrop">
          <div className="dw-modal">
            <div className="dw-modal-head">
              <div><strong>Submit file to Super Admin</strong><span>The saved EduSphere workspace copy will enter the review queue.</span></div>
              <button onClick={() => setSubmitOpen(false)}><X size={18} /></button>
            </div>
            <label>File name<input value={selectedFile.filename} readOnly /></label>
            <label>Description<textarea value={description} onChange={e => setDescription(e.target.value)} rows={5} placeholder="Explain what this code does and what you want reviewed." /></label>
            <div className="dw-modal-actions">
              <button onClick={() => setSubmitOpen(false)}>Cancel</button>
              <button className="dw-submit" onClick={() => void submitFile()}><Send size={14} /> Submit for review</button>
            </div>
          </div>
        </div>
      )}

      <AIChatbot />
    </div>
  );
}
