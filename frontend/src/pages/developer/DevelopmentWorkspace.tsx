import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Bot,
  ExternalLink,
  FileCode2,
  FolderOpen,
  GitBranch,
  RefreshCw,
  Send,
  Server,
  ShieldCheck,
  X,
} from "lucide-react";
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

const IDE_URL = (
  import.meta.env.VITE_DEVELOPER_IDE_URL || ""
).replace(/\/$/, "");

export default function DevelopmentWorkspace() {
  const navigate = useNavigate();

  const [files, setFiles] = useState<CodeFile[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [ideOnline, setIdeOnline] = useState<boolean | null>(null);
  const [workspaceReady, setWorkspaceReady] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitOpen, setSubmitOpen] = useState(false);
  const [selectedFile, setSelectedFile] =
    useState<CodeFile | null>(null);
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [developerId, setDeveloperId] =
    useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);

  /* ============================================================
     LOAD WORKSPACE DATA
  ============================================================ */

  const loadWorkspaceData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [fileData, submissionData] = await Promise.all([
        apiRequest<{
          developer_id: number;
          files: CodeFile[];
        }>("/developer/workspace/files"),

        apiRequest<{
          submissions: Submission[];
        }>("/developer/workspace/submissions"),
      ]);

      const id = Number(fileData.developer_id);

      if (!Number.isInteger(id) || id <= 0) {
        throw new Error(
          "Developer account could not be resolved"
        );
      }

      setDeveloperId(id);
      setFiles(fileData.files ?? []);
      setSubmissions(submissionData.submissions ?? []);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to load Developer workspace data"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  /* ============================================================
     SYNC IDE → EDUSPHERE DATABASE
  ============================================================ */

  const syncIde = useCallback(async () => {
    setSyncing(true);
    setError("");
    setMessage("");

    try {
      const result = await apiRequest<{
        synced?: Array<{ filename: string }>;
        skipped?: Array<{
          filename: string;
          reason: string;
        }>;
      }>("/developer/workspace/ide/sync", {
        method: "POST",
      });

      const syncedCount = result.synced?.length ?? 0;
      const skippedCount = result.skipped?.length ?? 0;

      setMessage(
        `Synced ${syncedCount} IDE file${
          syncedCount === 1 ? "" : "s"
        } to EduSphere${
          skippedCount
            ? ` · ${skippedCount} skipped`
            : ""
        }.`
      );

      await loadWorkspaceData();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to sync IDE files"
      );
    } finally {
      setSyncing(false);
    }
  }, [loadWorkspaceData]);

  /* ============================================================
     EXPORT EDUSPHERE DATABASE → IDE
  ============================================================ */

  const exportToIde = useCallback(async () => {
    setSyncing(true);
    setError("");
    setMessage("");

    try {
      const result = await apiRequest<{
        exported: number;
      }>("/developer/workspace/ide/export", {
        method: "POST",
      });

      setMessage(
        `Exported ${result.exported ?? 0} saved EduSphere file${
          result.exported === 1 ? "" : "s"
        } to your IDE.`
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to export files to IDE"
      );
    } finally {
      setSyncing(false);
    }
  }, []);

  /* ============================================================
     CHECK IDE HEALTH
  ============================================================ */

  const checkIde = useCallback(async () => {
    setIdeOnline(null);
    setWorkspaceReady(false);

    if (!IDE_URL) {
      setIdeOnline(false);

      setError(
        "Developer IDE is not configured for this deployment. Set VITE_DEVELOPER_IDE_URL in Vercel to the public HTTPS URL of the browser IDE service."
      );

      return;
    }

    try {
      const response = await fetch(
        `${IDE_URL}/healthz`,
        {
          method: "GET",
          cache: "no-store",
          mode: "cors",
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          `IDE health check returned HTTP ${response.status}.`
        );
      }

      const contentType =
        response.headers.get("content-type") || "";

      if (
        !contentType
          .toLowerCase()
          .includes("application/json")
      ) {
        throw new Error(
          "IDE health check returned an unexpected response."
        );
      }

      const health =
        (await response.json()) as {
          status?: string;
        };

      if (health.status !== "ok") {
        throw new Error(
          "IDE health check did not report OK."
        );
      }

      setIdeOnline(true);
    } catch {
      setIdeOnline(false);
      setWorkspaceReady(false);
    }
  }, []);

  /* ============================================================
     INITIAL PAGE LOAD
  ============================================================ */

  useEffect(() => {
    void loadWorkspaceData();
    void checkIde();
  }, [loadWorkspaceData, checkIde]);

  /* ============================================================
     INITIALIZE DEVELOPER IDE WORKSPACE
     
     This must happen BEFORE the iframe is loaded.
     
     The backend export endpoint causes the IDE bridge to create:
     
     /home/coder/workspace/<developerId>
  ============================================================ */

  useEffect(() => {
    if (!developerId || ideOnline !== true) {
      return;
    }

    let cancelled = false;

    const initializeIdeWorkspace = async () => {
      setWorkspaceReady(false);
      setError("");
      setMessage("");

      try {
        await apiRequest<{
          exported: number;
        }>("/developer/workspace/ide/export", {
          method: "POST",
        });

        if (!cancelled) {
          setWorkspaceReady(true);
        }
      } catch (e) {
        if (!cancelled) {
          setWorkspaceReady(false);

          setError(
            e instanceof Error
              ? e.message
              : "Unable to initialize Developer IDE workspace"
          );
        }
      }
    };

    void initializeIdeWorkspace();

    return () => {
      cancelled = true;
    };
  }, [developerId, ideOnline]);

  /* ============================================================
     SUBMIT FILE
  ============================================================ */

  const submitFile = async () => {
    if (!selectedFile) {
      return;
    }

    setError("");
    setMessage("");

    try {
      /*
       * Always sync the IDE before submitting.
       */
      await apiRequest(
        "/developer/workspace/ide/sync",
        {
          method: "POST",
        }
      );

      await apiRequest<{ message: string }>(
        `/developer/workspace/files/${selectedFile.id}/submit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            description:
              description.trim() ||
              `Submit ${selectedFile.filename} for Super Admin review.`,
          }),
        }
      );

      setMessage(
        `${selectedFile.filename} submitted for Super Admin review.`
      );

      setDescription("");
      setSubmitOpen(false);
      setSelectedFile(null);

      const data = await apiRequest<{
        submissions: Submission[];
      }>("/developer/workspace/submissions");

      setSubmissions(data.submissions ?? []);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to submit file"
      );
    }
  };

  /* ============================================================
     LOADING
  ============================================================ */

  if (loading) {
    return (
      <div className="dw-page dw-loading">
        <RefreshCw
          size={28}
          className="dw-spin"
        />

        <h2>Opening Developer Workspace</h2>

        <p>
          Loading your workspace metadata…
        </p>
      </div>
    );
  }

  /* ============================================================
     MAIN UI
  ============================================================ */

  return (
    <div className="dw-page">

      {/* ======================================================
          TOP BAR
      ====================================================== */}

      <header className="dw-topbar">

        <button
          className="dw-brand"
          onClick={() =>
            navigate("/app/developer")
          }
        >
          <ArrowLeft size={16} />

          <span>
            Developer Console
          </span>
        </button>

        <div className="dw-title">
          <FileCode2 size={18} />

          <strong>
            Development Workspace
          </strong>

          <span>
            VS Code-compatible browser IDE
          </span>
        </div>

        <div className="dw-actions">

          {/* IDE STATUS */}

          <div
            className={`dw-ide-status ${
              ideOnline === true
                ? "online"
                : ideOnline === false
                  ? "offline"
                  : "checking"
            }`}
          >
            <span />

            {ideOnline === true
              ? "IDE Online"
              : ideOnline === false
                ? "IDE Offline"
                : "Checking IDE"}
          </div>

          {/* OPEN IDE */}

          <button
            onClick={() => {
              if (!IDE_URL || !developerId) {
                return;
              }

              window.open(
                `${IDE_URL}/?folder=${encodeURIComponent(
                  `/home/coder/workspace/${developerId}`
                )}`,
                "_blank",
                "noopener,noreferrer"
              );
            }}
            disabled={
              !IDE_URL ||
              !developerId ||
              ideOnline !== true ||
              !workspaceReady
            }
          >
            <ExternalLink size={15} />

            Open IDE
          </button>

          {/* AI */}

          <button
            className="dw-ai"
            onClick={() =>
              window.dispatchEvent(
                new Event("edusphere-open-ai")
              )
            }
          >
            <Bot size={15} />

            AI
          </button>
        </div>
      </header>

      {/* ======================================================
          MAIN LAYOUT
      ====================================================== */}

      <div className="dw-layout">

        {/* ====================================================
            LEFT RAIL
        ==================================================== */}

        <aside className="dw-rail">

          {/* WORKSPACE */}

          <div className="dw-rail-section">

            <div className="dw-rail-title">
              <FolderOpen size={14} />

              WORKSPACE
            </div>

            <div className="dw-rail-note">
              Your browser IDE runs in an isolated
              Developer workspace. EduSphere source
              code and secrets are not mounted into it.
              Use <b>Sync IDE</b> after saving code;
              submissions always sync the IDE first.
            </div>
          </div>

          {/* SAVED FILES */}

          <div className="dw-rail-section">

            <div className="dw-rail-title">
              <FileCode2 size={14} />

              SAVED EDUSPHERE FILES
            </div>

            {files.length ? (
              files
                .slice(0, 12)
                .map((file) => (
                  <div
                    className="dw-file-row"
                    key={file.id}
                  >
                    <FileCode2 size={13} />

                    <span
                      title={file.filename}
                    >
                      {file.filename}
                    </span>

                    <button
                      title={`Submit ${file.filename}`}
                      onClick={() => {
                        setSelectedFile(file);
                        setSubmitOpen(true);
                      }}
                    >
                      <Send size={12} />
                    </button>
                  </div>
                ))
            ) : (
              <div className="dw-empty">
                No files saved through the
                EduSphere submission workspace yet.
              </div>
            )}
          </div>

          {/* SUBMISSIONS */}

          <div className="dw-rail-section">

            <div className="dw-rail-title">
              <Send size={14} />

              SUBMISSIONS
            </div>

            {submissions.length ? (
              submissions
                .slice(0, 8)
                .map((item) => (
                  <div
                    className="dw-submission"
                    key={item.id}
                  >
                    <span>
                      {item.filename}
                    </span>

                    <em
                      className={item.status.toLowerCase()}
                    >
                      {item.status}
                    </em>
                  </div>
                ))
            ) : (
              <div className="dw-empty">
                No submissions yet.
              </div>
            )}
          </div>

          {/* SAFETY */}

          <div className="dw-safety-card">

            <ShieldCheck size={18} />

            <strong>
              Safe development boundary
            </strong>

            <span>
              Accepted submissions are reviewed
              and downloaded by Super Admin.
              They never auto-deploy into EduSphere.
            </span>
          </div>
        </aside>

        {/* ====================================================
            IDE AREA
        ==================================================== */}

        <main className="dw-main">

          {/* IDE HEADER */}

          <div className="dw-ide-header">

            <div>
              <strong>
                Developer IDE
              </strong>

              <span>
                Real browser-hosted VS Code workbench
              </span>
            </div>

            <div className="dw-ide-actions">

              {/* SYNC IDE */}

              <button
                onClick={() =>
                  void syncIde()
                }
                disabled={syncing}
              >
                <RefreshCw
                  size={14}
                  className={
                    syncing
                      ? "dw-spin"
                      : ""
                  }
                />

                {syncing
                  ? "Syncing"
                  : "Sync IDE"}
              </button>

              {/* EXPORT DB */}

              <button
                onClick={() =>
                  void exportToIde()
                }
                disabled={syncing}
              >
                <FolderOpen size={14} />

                Export DB
              </button>

              {/* CHECK */}

              <button
                onClick={() =>
                  void checkIde()
                }
              >
                <RefreshCw size={14} />

                Check
              </button>

              {/* GITHUB */}

              <button
                onClick={() =>
                  window.open(
                    "https://github.com/",
                    "_blank",
                    "noopener,noreferrer"
                  )
                }
              >
                <GitBranch size={14} />

                GitHub
              </button>
            </div>
          </div>

          {/* ==================================================
              IDE CONTENT
          ================================================== */}

          {ideOnline === false ? (

            <div className="dw-ide-offline">

              <Server size={34} />

              <h2>
                Developer IDE is not running
              </h2>

              <p>
                {IDE_URL
                  ? "The configured browser IDE service is unreachable. Start the IDE service and reload this page."
                  : "This production deployment has no browser IDE URL configured."}
              </p>

              {!IDE_URL && (
                <code>
                  VITE_DEVELOPER_IDE_URL=https://your-public-ide.example.com
                </code>
              )}

              <button
                onClick={() =>
                  void checkIde()
                }
              >
                <RefreshCw size={14} />

                Check again
              </button>
            </div>

          ) : !workspaceReady ? (

            <div className="dw-ide-offline">

              <RefreshCw
                size={34}
                className="dw-spin"
              />

              <h2>
                Preparing Developer Workspace
              </h2>

              <p>
                Initializing your isolated IDE workspace…
              </p>

            </div>

          ) : (

            <iframe
              className="dw-ide-frame"
              src={`${IDE_URL}/?folder=${encodeURIComponent(
                `/home/coder/workspace/${developerId}`
              )}`}
              title="EduSphere Developer VS Code Workspace"
              allow="clipboard-read; clipboard-write"
            />

          )}

          {/* ERROR TOAST */}

          {error && (
            <div className="dw-toast error">
              {error}
            </div>
          )}

          {/* SUCCESS TOAST */}

          {message && (
            <div className="dw-toast success">
              {message}
            </div>
          )}
        </main>
      </div>

      {/* ======================================================
          SUBMIT MODAL
      ====================================================== */}

      {submitOpen && selectedFile && (

        <div className="dw-modal-backdrop">

          <div className="dw-modal">

            <div className="dw-modal-head">

              <div>

                <strong>
                  Submit file to Super Admin
                </strong>

                <span>
                  The saved EduSphere workspace copy
                  will enter the review queue.
                </span>

              </div>

              <button
                onClick={() => {
                  setSubmitOpen(false);
                  setSelectedFile(null);
                }}
              >
                <X size={18} />
              </button>

            </div>

            {/* FILE NAME */}

            <label>
              File name

              <input
                value={selectedFile.filename}
                readOnly
              />
            </label>

            {/* DESCRIPTION */}

            <label>
              Description

              <textarea
                value={description}
                onChange={(e) =>
                  setDescription(e.target.value)
                }
                rows={5}
                placeholder="Explain what this code does and what you want reviewed."
              />
            </label>

            {/* ACTIONS */}

            <div className="dw-modal-actions">

              <button
                onClick={() => {
                  setSubmitOpen(false);
                  setSelectedFile(null);
                }}
              >
                Cancel
              </button>

              <button
                className="dw-submit"
                onClick={() =>
                  void submitFile()
                }
              >
                <Send size={14} />

                Submit for review
              </button>

            </div>
          </div>
        </div>
      )}

      {/* ======================================================
          AI CHATBOT
      ====================================================== */}

      <AIChatbot />
    </div>
  );
}