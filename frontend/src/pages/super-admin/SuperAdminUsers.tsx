import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Edit3,
  RefreshCw,
  Search,
  Shield,
  UserRound,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./super-admin-users.css";
import AIChatbot from "../../components/ai/AIChatbot";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

type User = {
  id: number;
  full_name: string;
  email: string;
  role: string | null;
  profile_completed: boolean;
  verification_status: string;
  is_active: boolean;
  is_super_admin: boolean;
  created_at?: string;
};

type ResponseData = {
  total: number;
  users: User[];
  stats?: { total: number; active: number; inactive: number };
};

type FormState = {
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
};

async function api<T>(endpoint: string, options?: RequestInit): Promise<T> {
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
        : `Request failed (${response.status})`,
    );
  }
  return data as T;
}

const roleOptions = ["STUDENT", "PROFESSOR", "ADMIN", "DEVELOPER"];

export default function SuperAdminUsers() {
  const navigate = useNavigate();
  const [data, setData] = useState<ResponseData>({ total: 0, users: [] });
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<FormState>({
    full_name: "",
    email: "",
    role: "STUDENT",
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (role) params.set("role", role);
      if (status) params.set("status", status);
      params.set("limit", "500");

      const result = await api<ResponseData>(
        `/users/manage/all?${params.toString()}`,
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load users.");
    } finally {
      setLoading(false);
    }
  }, [search, role, status]);

  useEffect(() => {
    const timer = window.setTimeout(loadUsers, 250);
    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  const users = useMemo(() => data.users || [], [data.users]);

  const openEdit = (user: User) => {
    if (user.is_super_admin) return;
    setEditing(user);
    setForm({
      full_name: user.full_name,
      email: user.email,
      role: user.role || "STUDENT",
      is_active: user.is_active,
    });
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    setError("");

    try {
      await api(`/users/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify(form),
      });
      setEditing(null);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update user.");
    } finally {
      setSaving(false);
    }
  };

  const total = data.stats?.total ?? data.total;
  const active = data.stats?.active ?? users.filter((u) => u.is_active).length;
  const inactive =
    data.stats?.inactive ?? users.filter((u) => !u.is_active).length;

  return (
    <div className="sau-page">
      <div className="sau-shell">
        <header className="sau-header">
          <div className="sau-heading">
            <button className="sau-icon" onClick={() => navigate("/app/super-admin")}>
              <ArrowLeft size={18} />
            </button>
            <div>
              <span>SUPER ADMIN • PLATFORM</span>
              <h1>Global User Management</h1>
            </div>
          </div>
          <button className="sau-refresh" onClick={loadUsers}>
            <RefreshCw size={16} /> Refresh
          </button>
        </header>

        <section className="sau-stats">
          <div><Users size={19}/><span>Total Users</span><strong>{total}</strong></div>
          <div><CheckCircle2 size={19}/><span>Active</span><strong>{active}</strong></div>
          <div><XCircle size={19}/><span>Inactive</span><strong>{inactive}</strong></div>
          <div><Shield size={19}/><span>Access Level</span><strong>GLOBAL</strong></div>
        </section>

        <section className="sau-panel">
          <div className="sau-toolbar">
            <div className="sau-search">
              <Search size={17}/>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email or user ID..."
              />
            </div>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">All Roles</option>
              {roleOptions.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          {error && <div className="sau-error"><XCircle size={16}/>{error}</div>}

          {loading ? (
            <div className="sau-empty"><RefreshCw className="sau-spin" size={27}/><strong>Loading users</strong><span>Reading the EduSphere platform accounts...</span></div>
          ) : users.length === 0 ? (
            <div className="sau-empty"><UserRound size={30}/><strong>No users found</strong><span>Try changing the search or filters.</span></div>
          ) : (
            <div className="sau-table-wrap">
              <table className="sau-table">
                <thead>
                  <tr><th>User</th><th>Role</th><th>Verification</th><th>Profile</th><th>Status</th><th>Joined</th><th/></tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="sau-user">
                          <div className="sau-avatar"><UserRound size={17}/></div>
                          <div><strong>{user.full_name || "Unnamed User"}</strong><span>{user.email} • ID {user.id}</span></div>
                        </div>
                      </td>
                      <td><span className="sau-role">{user.role || "UNASSIGNED"}</span></td>
                      <td><span className={`sau-badge ${user.verification_status === "VERIFIED" ? "good" : user.verification_status === "REJECTED" ? "bad" : ""}`}>{user.verification_status || "—"}</span></td>
                      <td>{user.profile_completed ? "Complete" : "Incomplete"}</td>
                      <td><span className={`sau-status ${user.is_active ? "active" : "inactive"}`}><span/>{user.is_active ? "Active" : "Inactive"}</span></td>
                      <td>{user.created_at
                          ? new Date(
                              /(?:Z|[+-]\d{2}:?\d{2})$/i.test(user.created_at)
                                ? user.created_at
                                : `${user.created_at.replace(" ", "T")}Z`
                            ).toLocaleDateString("en-IN", {
                              timeZone: "Asia/Kolkata",
                            })
                          : "—"}</td>
                      <td>
                        {user.is_super_admin ? <span className="sau-locked"><Shield size={14}/> Protected</span> : <button className="sau-edit" onClick={() => openEdit(user)}><Edit3 size={14}/> Edit</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {editing && (
        <div className="sau-modal-bg" onMouseDown={() => !saving && setEditing(null)}>
          <div className="sau-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="sau-modal-head">
              <div><span>USER CONTROL</span><h2>Edit User</h2></div>
              <button className="sau-icon" onClick={() => setEditing(null)} disabled={saving}><X size={18}/></button>
            </div>
            <div className="sau-form">
              <label><span>Full Name</span><input value={form.full_name} onChange={(e) => setForm({...form, full_name:e.target.value})}/></label>
              <label><span>Email</span><input type="email" value={form.email} onChange={(e) => setForm({...form, email:e.target.value})}/></label>
              <label><span>Role</span><select value={form.role} onChange={(e) => setForm({...form, role:e.target.value})}>{roleOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="sau-check"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({...form, is_active:e.target.checked})}/><span>Account Active</span></label>
            </div>
            <div className="sau-modal-actions">
              <button className="sau-refresh" onClick={() => setEditing(null)} disabled={saving}>Cancel</button>
              <button className="sau-save" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
            </div>
          </div>
        </div>
      )}
      <AIChatbot />
    </div>
  );
}
