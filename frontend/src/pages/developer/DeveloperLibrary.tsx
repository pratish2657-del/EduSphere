import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, Download, Edit3, Plus, Search, Star, Trash2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../../services/api";
import "./developer-library.css";
import AIChatbot from "../../components/ai/AIChatbot";

type Institution = { id: number; name: string; university_code: string };
type Resource = {
  id: number;
  institution_id: number;
  institution_name?: string;
  title: string;
  resource_type: string;
  author?: string | null;
  isbn?: string | null;
  category?: string | null;
  subject?: string | null;
  description?: string | null;
  language?: string | null;
  publication_year?: number | null;
  tags?: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  featured: boolean;
  original_file_name?: string | null;
  file_size?: number | null;
  created_at?: string;
  updated_at?: string;
};

type FormState = {
  institution_id: string;
  title: string;
  resource_type: string;
  author: string;
  isbn: string;
  category: string;
  subject: string;
  description: string;
  language: string;
  publication_year: string;
  tags: string;
  status: string;
  featured: boolean;
};

const emptyForm: FormState = {
  institution_id: "",
  title: "",
  resource_type: "BOOK",
  author: "",
  isbn: "",
  category: "",
  subject: "",
  description: "",
  language: "English",
  publication_year: "",
  tags: "",
  status: "DRAFT",
  featured: false,
};

function toForm(resource: Resource): FormState {
  return {
    institution_id: String(resource.institution_id),
    title: resource.title || "",
    resource_type: resource.resource_type || "BOOK",
    author: resource.author || "",
    isbn: resource.isbn || "",
    category: resource.category || "",
    subject: resource.subject || "",
    description: resource.description || "",
    language: resource.language || "English",
    publication_year: resource.publication_year ? String(resource.publication_year) : "",
    tags: resource.tags || "",
    status: resource.status || "DRAFT",
    featured: Boolean(resource.featured),
  };
}

function fileSize(value?: number | null) {
  if (!value) return "No file";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DeveloperLibrary() {
  const navigate = useNavigate();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [institutionFilter, setInstitutionFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [institutionData, resourceData] = await Promise.all([
        apiRequest<{ institutions?: Institution[] }>("/developer/library/institutions"),
        apiRequest<{ resources?: Resource[] }>("/developer/library", {
          params: {
            search: search || undefined,
            resource_type: typeFilter || undefined,
            status: statusFilter || undefined,
            institution_id: institutionFilter || undefined,
          },
        }),
      ]);
      setInstitutions(institutionData.institutions || []);
      setResources(resourceData.resources || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load Developer Library.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [search, typeFilter, statusFilter, institutionFilter]);

  const counts = useMemo(() => ({
    total: resources.length,
    published: resources.filter((item) => item.status === "PUBLISHED").length,
    drafts: resources.filter((item) => item.status === "DRAFT").length,
  }), [resources]);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, institution_id: institutionFilter || (institutions[0] ? String(institutions[0].id) : "") });
    setResourceFile(null);
    setCoverFile(null);
    setMessage("");
    setError("");
    setModalOpen(true);
  }

  function openEdit(resource: Resource) {
    setEditing(resource);
    setForm(toForm(resource));
    setResourceFile(null);
    setCoverFile(null);
    setMessage("");
    setError("");
    setModalOpen(true);
  }

  async function saveResource(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => body.append(key, String(value)));
    if (resourceFile) body.append("resource_file", resourceFile);
    if (coverFile) body.append("cover_file", coverFile);

    try {
      if (editing) {
        await apiRequest(`/developer/library/${editing.id}`, { method: "PUT", body });
        setMessage("Library resource updated successfully.");
      } else {
        await apiRequest("/developer/library", { method: "POST", body });
        setMessage("Library resource created successfully.");
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save resource.");
    } finally {
      setSaving(false);
    }
  }

  async function removeResource(resource: Resource) {
    if (!window.confirm(`Delete “${resource.title}”? This cannot be undone.`)) return;
    setError("");
    try {
      await apiRequest(`/developer/library/${resource.id}`, { method: "DELETE" });
      setMessage("Library resource deleted successfully.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to delete resource.");
    }
  }

  return (
    <div className="developer-library-shell">
      <header className="developer-library-topbar">
        <button className="developer-library-back" onClick={() => navigate("/app/developer")}><ArrowLeft size={17} /> Developer Console</button>
        <div><strong>Library Management</strong><span>Developer content workspace</span></div>
      </header>

      <main className="developer-library-main">
        <section className="developer-library-hero">
          <div>
            <span className="developer-library-kicker"><BookOpen size={14} /> DEVELOPER LIBRARY</span>
            <h1>Library Management</h1>
            <p>Create, edit, publish and maintain academic resources across EduSphere institutions.</p>
          </div>
          <button className="developer-library-primary" onClick={openCreate}><Plus size={17} /> Add Resource</button>
        </section>

        <div className="developer-library-stats">
          <div><span>Total Resources</span><strong>{counts.total}</strong></div>
          <div><span>Published</span><strong>{counts.published}</strong></div>
          <div><span>Drafts</span><strong>{counts.drafts}</strong></div>
        </div>

        <section className="developer-library-toolbar">
          <label><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, author, subject or tags" /></label>
          <select value={institutionFilter} onChange={(e) => setInstitutionFilter(e.target.value)}><option value="">All institutions</option>{institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="">All types</option>{["BOOK", "MATERIAL", "EBOOK", "NOTE", "PDF", "OTHER"].map((type) => <option key={type} value={type}>{type}</option>)}</select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">All status</option><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="ARCHIVED">Archived</option></select>
        </section>

        {message && <div className="developer-library-success">{message}</div>}
        {error && <div className="developer-library-error">{error}</div>}

        {loading ? <div className="developer-library-empty">Loading Library…</div> : resources.length === 0 ? <div className="developer-library-empty"><BookOpen size={30} /><strong>No library resources found</strong><span>Create the first resource with Add Resource.</span></div> : (
          <section className="developer-library-table-wrap">
            <table className="developer-library-table">
              <thead><tr><th>Resource</th><th>Institution</th><th>Type</th><th>Status</th><th>File</th><th>Actions</th></tr></thead>
              <tbody>{resources.map((resource) => (
                <tr key={resource.id}>
                  <td><strong>{resource.title}</strong><small>{resource.author || resource.subject || "Academic resource"}{resource.featured && <Star size={12} fill="currentColor" />}</small></td>
                  <td>{resource.institution_name || `Institution #${resource.institution_id}`}</td>
                  <td><span className="developer-library-badge">{resource.resource_type}</span></td>
                  <td><span className={`developer-library-status status-${resource.status.toLowerCase()}`}>{resource.status}</span></td>
                  <td>{fileSize(resource.file_size)}</td>
                  <td><div className="developer-library-actions"><button title="Download" onClick={() => window.open(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/developer/library/${resource.id}/download`, "_blank")}><Download size={15} /></button><button title="Edit" onClick={() => openEdit(resource)}><Edit3 size={15} /></button><button title="Delete" className="danger" onClick={() => void removeResource(resource)}><Trash2 size={15} /></button></div></td>
                </tr>
              ))}</tbody>
            </table>
          </section>
        )}
      </main>

      {modalOpen && <div className="developer-library-overlay"><form className="developer-library-modal" onSubmit={saveResource}>
        <div className="developer-library-modal-head"><div><span>{editing ? "EDIT RESOURCE" : "NEW RESOURCE"}</span><h2>{editing ? "Edit Library Resource" : "Add Library Resource"}</h2></div><button type="button" onClick={() => setModalOpen(false)}><X size={19} /></button></div>
        <div className="developer-library-form-grid">
          <label className="full"><span>Institution *</span><select required value={form.institution_id} onChange={(e) => setForm({ ...form, institution_id: e.target.value })}><option value="">Select institution</option>{institutions.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.university_code})</option>)}</select></label>
          <label className="full"><span>Title *</span><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label><span>Resource Type *</span><select value={form.resource_type} onChange={(e) => setForm({ ...form, resource_type: e.target.value })}>{["BOOK", "MATERIAL", "EBOOK", "NOTE", "PDF", "OTHER"].map((type) => <option key={type}>{type}</option>)}</select></label>
          <label><span>Status</span><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option>DRAFT</option><option>PUBLISHED</option><option>ARCHIVED</option></select></label>
          <label><span>Author</span><input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} /></label>
          <label><span>ISBN</span><input value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} /></label>
          <label><span>Category</span><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></label>
          <label><span>Subject</span><input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></label>
          <label><span>Language</span><input value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} /></label>
          <label><span>Publication Year</span><input type="number" min="1900" max="2100" value={form.publication_year} onChange={(e) => setForm({ ...form, publication_year: e.target.value })} /></label>
          <label className="full"><span>Tags</span><input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="DSA, algorithms, semester 3" /></label>
          <label className="full"><span>Description</span><textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <label><span>Resource File</span><input type="file" accept=".pdf,.epub,.doc,.docx,.txt,.ppt,.pptx,.xls,.xlsx,.zip" onChange={(e) => setResourceFile(e.target.files?.[0] || null)} /></label>
          <label><span>Cover Image</span><input type="file" accept=".jpg,.jpeg,.png,.webp" onChange={(e) => setCoverFile(e.target.files?.[0] || null)} /></label>
          <label className="developer-library-check"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> Featured resource</label>
        </div>
        {error && <div className="developer-library-error">{error}</div>}
        <div className="developer-library-modal-actions"><button type="button" onClick={() => setModalOpen(false)}>Cancel</button><button type="submit" className="developer-library-primary" disabled={saving}>{saving ? "Saving…" : editing ? "Save Changes" : "Create Resource"}</button></div>
      </form></div>}
      <AIChatbot/>
    </div>
  );
}
