import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen, Edit3, Plus, Search, Star, Trash2, X, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../../services/api";
import "../library/library.css";

type Institution = { id: number; name: string; university_code: string };
type Resource = {
  id: number;
  institution_id: number;
  institution_name?: string;
  institution_code?: string;
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
  status: "PUBLISHED",
  featured: false,
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function size(value?: number | null) {
  if (!value) return "No file";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SuperAdminLibrary() {
  const navigate = useNavigate();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [institution, setInstitution] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [inst, data] = await Promise.all([
        apiRequest<{ institutions?: Institution[] }>("/institutions/"),
        apiRequest<{ resources?: Resource[] }>("/super-admin/library", {
          params: {
            institution_id: institution || undefined,
            search: search || undefined,
            resource_type: type || undefined,
            status: status || undefined,
          },
        }),
      ]);
      setInstitutions(inst.institutions || []);
      setResources(data.resources || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load Super Admin Library.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [institution, search, type, status]);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, institution_id: institution || (institutions[0] ? String(institutions[0].id) : "") });
    setResourceFile(null);
    setCoverFile(null);
    setError("");
    setMessage("");
    setModal(true);
  }

  function openEdit(resource: Resource) {
    setEditing(resource);
    setForm({
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
    });
    setResourceFile(null);
    setCoverFile(null);
    setError("");
    setMessage("");
    setModal(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");

    if (!editing && !resourceFile) {
      setError("Please select a resource file before creating the library resource.");
      setSaving(false);
      return;
    }

    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => body.append(key, String(value)));
    if (resourceFile) body.append("resource_file", resourceFile);
    if (coverFile) body.append("cover_file", coverFile);

    try {
      if (editing) {
        await apiRequest(`/super-admin/library/${editing.id}`, { method: "PUT", body });
        setMessage("Library resource updated successfully.");
      } else {
        await apiRequest("/super-admin/library", { method: "POST", body });
        setMessage("Library resource created successfully.");
      }
      setModal(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save library resource.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(resource: Resource) {
    if (!window.confirm(`Delete "${resource.title}"? This cannot be undone.`)) return;
    try {
      await apiRequest(`/super-admin/library/${resource.id}`, { method: "DELETE" });
      setMessage("Library resource deleted successfully.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete resource.");
    }
  }

  return (
    <div className="library-shell">
      <header className="library-topbar">
        <button className="library-back" onClick={() => navigate(-1)}><ArrowLeft size={17} /> Back</button>
        <div><strong>Super Admin Library</strong><span>Platform-wide content management</span></div>
      </header>

      <main className="library-main">
        <section className="library-hero">
          <div>
            <span className="library-kicker"><BookOpen size={14} /> SUPER ADMIN LIBRARY</span>
            <h1>Library Management</h1>
            <p>Add, view, edit, publish and delete academic resources across every EduSphere institution.</p>
          </div>
          <button className="library-primary" onClick={openCreate}><Plus size={17} /> Add Resource</button>
        </section>

        <section className="library-toolbar">
          <label><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, author, subject or tags" /></label>
          <select value={institution} onChange={(e) => setInstitution(e.target.value)}>
            <option value="">All institutions</option>
            {institutions.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.university_code})</option>)}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option>{["BOOK","MATERIAL","EBOOK","NOTE","PDF","OTHER"].map((item) => <option key={item}>{item}</option>)}</select>
          <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All status</option><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="ARCHIVED">Archived</option></select>
        </section>

        {message && <div className="library-success">{message}</div>}
        {error && <div className="library-error">{error}</div>}

        {loading ? <div className="library-empty">Loading Library…</div> : resources.length === 0 ? (
          <div className="library-empty"><BookOpen size={34} /><strong>No library resources found</strong><span>Create the first resource with Add Resource.</span></div>
        ) : (
          <section className="library-table-wrap">
            <table className="library-table">
              <thead><tr><th>Resource</th><th>Institution</th><th>Type</th><th>Status</th><th>File</th><th>Actions</th></tr></thead>
              <tbody>{resources.map((resource) => (
                <tr key={resource.id}>
                  <td><strong>{resource.title}</strong><small>{resource.author || resource.subject || "Academic resource"}{resource.featured && <Star size={12} fill="currentColor" />}</small></td>
                  <td>{resource.institution_name || `Institution #${resource.institution_id}`}</td>
                  <td><span className="library-badge">{resource.resource_type}</span></td>
                  <td><span className={`library-status status-${resource.status.toLowerCase()}`}>{resource.status}</span></td>
                  <td>{size(resource.file_size)}</td>
                  <td><div className="library-actions">
                    <button title="Download" onClick={() => window.open(`${API_BASE_URL}/super-admin/library/${resource.id}/download`, "_blank")}><Download size={15} /></button>
                    <button title="Edit" onClick={() => openEdit(resource)}><Edit3 size={15} /></button>
                    <button title="Delete" className="danger" onClick={() => void remove(resource)}><Trash2 size={15} /></button>
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
          </section>
        )}
      </main>

      {modal && <div className="library-overlay">
        <form className="library-modal" onSubmit={save}>
          <div className="library-modal-head">
            <div><span>{editing ? "EDIT RESOURCE" : "NEW RESOURCE"}</span><h2>{editing ? "Edit Library Resource" : "Add Library Resource"}</h2></div>
            <button type="button" onClick={() => setModal(false)}><X size={19} /></button>
          </div>

          <div className="library-form-grid">
            <label className="full"><span>Institution *</span><select required value={form.institution_id} onChange={(e) => setForm({ ...form, institution_id: e.target.value })}><option value="">Select institution</option>{institutions.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.university_code})</option>)}</select></label>
            <label className="full"><span>Title *</span><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label><span>Resource Type *</span><select value={form.resource_type} onChange={(e) => setForm({ ...form, resource_type: e.target.value })}>{["BOOK","MATERIAL","EBOOK","NOTE","PDF","OTHER"].map((item) => <option key={item}>{item}</option>)}</select></label>
            <label><span>Status</span><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option>DRAFT</option><option>PUBLISHED</option><option>ARCHIVED</option></select></label>
            <label><span>Author</span><input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} /></label>
            <label><span>ISBN</span><input value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} /></label>
            <label><span>Category</span><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></label>
            <label><span>Subject</span><input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></label>
            <label><span>Language</span><input value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} /></label>
            <label><span>Publication Year</span><input type="number" value={form.publication_year} onChange={(e) => setForm({ ...form, publication_year: e.target.value })} /></label>
            <label className="full"><span>Tags</span><input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="comma-separated tags" /></label>
            <label className="full"><span>Description</span><textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <label><span>Resource File</span><input type="file" onChange={(e) => setResourceFile(e.target.files?.[0] || null)} /></label>
            <label><span>Cover File</span><input type="file" onChange={(e) => setCoverFile(e.target.files?.[0] || null)} /></label>
            <label className="library-check"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> Featured</label>
          </div>

          <div className="library-modal-actions">
            <button type="button" onClick={() => setModal(false)}>Cancel</button>
            <button className="library-primary" type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Save Changes" : "Create Resource"}</button>
          </div>
        </form>
      </div>}
    </div>
  );
}
