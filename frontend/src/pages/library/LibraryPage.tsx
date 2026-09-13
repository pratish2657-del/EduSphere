import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, Download, Search, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api, apiRequest } from "../../services/api";
import "./library.css";

type Resource = {
  id: number;
  institution_id: number;
  institution_name?: string;
  institution_code?: string;
  title: string;
  resource_type: "BOOK" | "MATERIAL" | "EBOOK" | "NOTE" | "PDF" | "OTHER";
  author?: string | null;
  category?: string | null;
  subject?: string | null;
  description?: string | null;
  language?: string | null;
  publication_year?: number | null;
  tags?: string | null;
  status: "PUBLISHED";
  featured: boolean;
  original_file_name?: string | null;
  file_size?: number | null;
  creator_name?: string | null;
};

type Summary = {
  total?: number;
  books?: number;
  materials?: number;
  ebooks?: number;
  notes?: number;
  pdfs?: number;
  other_resources?: number;
  featured?: number;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function formatSize(value?: number | null) {
  if (!value) return "No file";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default function LibraryPage() {
  const navigate = useNavigate();
  const [resources, setResources] = useState<Resource[]>([]);
  const [summary, setSummary] = useState<Summary>({});
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [featured, setFeatured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [institutionName, setInstitutionName] = useState("Your Institution");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [data, summaryData, me] = await Promise.all([
        apiRequest<{ resources?: Resource[]; institution_id?: number }>("/library", {
          params: {
            search: search || undefined,
            resource_type: type || undefined,
            featured: featured ? true : undefined,
          },
        }),
        apiRequest<Summary>("/library/summary"),
        api.auth.me(),
      ]);
      setResources(data.resources || []);
      setSummary(summaryData || {});
      // Institution name is returned on resources. If there are no resources,
      // keep the neutral "Your Institution" label rather than guessing.
      const firstInstitution = (data.resources || [])[0]?.institution_name;
      if (firstInstitution) setInstitutionName(firstInstitution);
      else if (me.role === "STUDENT" || me.role === "PROFESSOR" || me.role === "ADMIN") {
        setInstitutionName("Your Institution");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load your institution library.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [search, type, featured]);

  const statItems = useMemo(() => [
    ["Total", summary.total ?? 0],
    ["Books", summary.books ?? 0],
    ["Materials", summary.materials ?? 0],
    ["E-Books", summary.ebooks ?? 0],
    ["Notes", summary.notes ?? 0],
    ["PDFs", summary.pdfs ?? 0],
  ], [summary]);

  async function download(resource: Resource) {
    try {
      const response = await fetch(`${API_BASE_URL}/library/${resource.id}/download`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Download is unavailable");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = resource.original_file_name || resource.title;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to download the resource.");
    }
  }

  return (
    <div className="library-shell">
      <header className="library-topbar">
        <button className="library-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={17} /> Back
        </button>
        <div>
          <strong>Library</strong>
          <span>{institutionName} · View only</span>
        </div>
      </header>

      <main className="library-main">
        <section className="library-hero">
          <div>
            <span className="library-kicker"><BookOpen size={14} /> ACADEMIC LIBRARY</span>
            <h1>Library</h1>
            <p>Browse published books, study materials, e-books, notes and PDFs available to your institution.</p>
          </div>
          <div className="library-access-pill">👁 View only · Own institution</div>
        </section>

        <section className="library-stats">
          {statItems.map(([label, value]) => (
            <div key={String(label)}><span>{label}</span><strong>{value}</strong></div>
          ))}
        </section>

        <section className="library-toolbar">
          <label>
            <Search size={16} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, author, subject or tags" />
          </label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            {["BOOK", "MATERIAL", "EBOOK", "NOTE", "PDF", "OTHER"].map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <label className="library-check">
            <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
            Featured only
          </label>
        </section>

        {error && <div className="library-error">{error}</div>}

        {loading ? (
          <div className="library-empty">Loading Library…</div>
        ) : resources.length === 0 ? (
          <div className="library-empty">
            <BookOpen size={34} />
            <strong>No published resources found</strong>
            <span>Your institution does not currently have a matching published resource.</span>
          </div>
        ) : (
          <section className="library-grid">
            {resources.map((resource) => (
              <article className="library-card" key={resource.id}>
                <div className="library-card-icon"><BookOpen size={22} /></div>
                {resource.featured && <span className="library-featured"><Star size={12} fill="currentColor" /> Featured</span>}
                <span className="library-type">{resource.resource_type}</span>
                <h2>{resource.title}</h2>
                <p>{resource.description || resource.subject || resource.author || "Academic resource"}</p>
                <div className="library-meta">
                  {resource.author && <span>Author: {resource.author}</span>}
                  {resource.language && <span>Language: {resource.language}</span>}
                  {resource.publication_year && <span>Year: {resource.publication_year}</span>}
                </div>
                <div className="library-card-footer">
                  <span>{formatSize(resource.file_size)}</span>
                  <button onClick={() => void download(resource)} disabled={!resource.original_file_name}>
                    <Download size={15} /> {resource.original_file_name ? "Download" : "No file"}
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
