import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Edit3,
  Plus,
  RefreshCw,
  Search,
  Shield,
  X,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./super-admin-institutions.css";
import AIChatbot from "../../components/ai/AIChatbot";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

type Institution = {
  id: number;
  name?: string;
  institution_name?: string;
  university_code?: string;
  code?: string;
  city?: string;
  state?: string;
  country?: string;
  email?: string;
  phone?: string;
  address?: string;
  is_active?: boolean;
  created_at?: string;
};

type FormState = {
  name: string;
  university_code: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
};

const emptyForm: FormState = {
  name: "",
  university_code: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  country: "India",
};

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
      ...(options?.headers || {}),
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const detail =
      data && typeof data === "object" && "detail" in data
        ? (data as { detail?: unknown }).detail
        : undefined;
    throw new Error(
      typeof detail === "string"
        ? detail
        : `Request failed with status ${response.status}`,
    );
  }

  return data as T;
}

function normalizeList(data: unknown): Institution[] {
  if (Array.isArray(data)) return data as Institution[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["institutions", "items", "data", "results"]) {
      if (Array.isArray(obj[key])) return obj[key] as Institution[];
    }
  }
  return [];
}

export default function SuperAdminInstitutions() {
  const navigate = useNavigate();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Institution | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const loadInstitutions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await request<unknown>("/institutions/");
      setInstitutions(normalizeList(data));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load institutions.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInstitutions();
  }, [loadInstitutions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return institutions;
    return institutions.filter((item) =>
      [
        item.name,
        item.institution_name,
        item.university_code,
        item.code,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [institutions, search]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (item: Institution) => {
    setEditing(item);

    setForm({
      name: item.name || item.institution_name || "",
      university_code: item.university_code || item.code || "",
      email: item.email || "",
      phone: item.phone || "",
      address: item.address || "",
      city: item.city || "",
      state: item.state || "",
      country: item.country || "India",
    });

    setShowModal(true);
  };

  const saveInstitution = async () => {
    if (!form.name.trim() || !form.university_code.trim()) {
      setError("Institution name and university code are required.");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      name: form.name.trim(),
      university_code: form.university_code.trim(),
    };

    try {
      if (editing) {
        await request(`/institutions/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await request("/institutions/", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      setShowModal(false);
      await loadInstitutions();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save institution.",
      );
    } finally {
      setSaving(false);
    }
  };


  const activeCount = institutions.length;
  const inactiveCount = 0;

  return (
    <div className="sai-page">
      <div className="sai-shell">
        <header className="sai-header">
          <div className="sai-title-wrap">
            <button className="sai-icon-btn" onClick={() => navigate("/app/super-admin")}>
              <ArrowLeft size={18} />
            </button>
            <div>
              <span>SUPER ADMIN • PLATFORM</span>
              <h1>Institution Management</h1>
            </div>
          </div>
          <div className="sai-header-actions">
            <button className="sai-secondary" onClick={loadInstitutions}>
              <RefreshCw size={16} /> Refresh
            </button>
            <button className="sai-primary" onClick={openCreate}>
              <Plus size={17} /> Add Institution
            </button>
          </div>
        </header>

        <section className="sai-overview">
          <div className="sai-stat">
            <Building2 size={20} />
            <div><span>Total Institutions</span><strong>{institutions.length}</strong></div>
          </div>
          <div className="sai-stat">
            <CheckCircle2 size={20} />
            <div><span>Active</span><strong>{activeCount}</strong></div>
          </div>
          <div className="sai-stat">
            <XCircle size={20} />
            <div><span>Inactive</span><strong>{inactiveCount}</strong></div>
          </div>
          <div className="sai-stat">
            <Shield size={20} />
            <div><span>Platform Control</span><strong>SUPER ADMIN</strong></div>
          </div>
        </section>

        <section className="sai-panel">
          <div className="sai-toolbar">
            <div className="sai-search">
              <Search size={17} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search institution, code, city..."
              />
            </div>
            <span className="sai-count">{filtered.length} shown</span>
          </div>

          {error && (
            <div className="sai-error">
              <XCircle size={17} /> {error}
            </div>
          )}

          {loading ? (
            <div className="sai-empty">
              <RefreshCw className="sai-spin" size={26} />
              <strong>Loading institutions</strong>
              <span>Connecting to the EduSphere platform...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="sai-empty">
              <Building2 size={30} />
              <strong>{search ? "No institutions found" : "No institutions yet"}</strong>
              <span>{search ? "Try a different search." : "Create the first institution from this control center."}</span>
            </div>
          ) : (
            <div className="sai-table-wrap">
              <table className="sai-table">
                <thead>
                  <tr>
                    <th>Institution</th>
                    <th>University Code</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const name = item.name || item.institution_name || "Unnamed Institution";
                    const code = item.university_code || item.code || "—";
                    const location = [item.city, item.state, item.country].filter(Boolean).join(", ") || "—";
                    return (
                      <tr key={item.id}>
                        <td>
                          <div className="sai-institution">
                            <div className="sai-building"><Building2 size={18} /></div>
                            <div>
                              <strong>{name}</strong>

                            </div>
                          </div>
                        </td>
                        <td><code>{code}</code></td>
                        <td>{location}</td>
                        <td>
                          <span className="sai-status active"><span /> Active</span>
                        </td>
                        <td>{item.created_at
                            ? new Date(
                                /(?:Z|[+-]\\d{2}:?\\d{2})$/i.test(item.created_at)
                                  ? item.created_at
                                  : `${item.created_at.replace(" ", "T")}Z`
                              ).toLocaleDateString("en-IN", {
                                timeZone: "Asia/Kolkata",
                              })
                            : "—"}</td>
                        <td>
                          <button className="sai-edit" onClick={() => openEdit(item)}>
                            <Edit3 size={15} /> Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {showModal && (
        <div className="sai-modal-backdrop" onMouseDown={() => !saving && setShowModal(false)}>
          <div className="sai-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="sai-modal-head">
              <div>
                <span>{editing ? "UPDATE INSTITUTION" : "NEW INSTITUTION"}</span>
                <h2>{editing ? "Edit Institution" : "Add Institution"}</h2>
              </div>
              <button className="sai-icon-btn" onClick={() => setShowModal(false)} disabled={saving}>
                <X size={18} />
              </button>
            </div>

            <div className="sai-form">
              {(
                [
                  ["name", "Institution Name", "e.g. University of Example"],
                  ["university_code", "University Code", "e.g. UEMK"],
                  ["email", "Official Email", "admin@example.edu"],
                  ["phone", "Phone", "+91..."],
                  ["address", "Address", "Campus address"],
                  ["city", "City", "Kolkata"],
                  ["state", "State", "West Bengal"],
                  ["country", "Country", "India"],
                ] as const
              ).map(([key, label, placeholder]) => (
                <label key={key} className={key === "address" ? "full" : ""}>
                  <span>{label}</span>
                  <input
                    value={form[key]}
                    onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                  />
                </label>
              ))}
            </div>

            <div className="sai-modal-actions">
              <button className="sai-secondary" onClick={() => setShowModal(false)} disabled={saving}>Cancel</button>
              <button className="sai-primary" onClick={saveInstitution} disabled={saving}>
                {saving ? <RefreshCw className="sai-spin" size={16} /> : <CheckCircle2 size={16} />}
                {saving ? "Saving..." : editing ? "Save Changes" : "Create Institution"}
              </button>
            </div>
          </div>
        </div>
      )}
      <AIChatbot />
    </div>
  );
}
