import { useCallback, useEffect, useMemo, useState } from "react";
import "./admin-users.css";
import {
  ChevronLeft,
  ChevronRight,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

type UserItem = {
  user_id: number;
  full_name?: string;
  email?: string;
  is_active?: boolean;
  profile_completed?: boolean;
  verification_status?: string;
  created_at?: string;
  role?: string;
  student_id?: string;
  enrollment_number?: string;
  program_id?: number;
  section_id?: number;
  current_year?: number;
  semester?: number;
  professor_id?: number;
  employee_id?: string;
  professor_department?: string;
  professor_designation?: string;
  admin_profile_id?: number;
  admin_id?: string;
  admin_department?: string;
  admin_designation?: string;
};

type UsersResponse = {
  users?: UserItem[];
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    total_pages?: number;
  };
  institution_id?: number;
};

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(options.body
        ? { "Content-Type": "application/json" }
        : {}),
      ...(options.headers || {}),
    },
    ...options,
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

function initials(name?: string) {
  return (
    name
      ?.split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "U"
  );
}

function formatDate(value?: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function roleLabel(role?: string) {
  if (!role) return "USER";

  return role.replace("_", " ");
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();

      if (search.trim()) {
        params.set("search", search.trim());
      }

      if (role) {
        params.set("role", role);
      }

      if (status) {
        params.set("status", status);
      }

      params.set("page", String(page));
      params.set("limit", "20");

      const data = await apiRequest<UsersResponse>(
        `/admin/users?${params.toString()}`,
      );

      setUsers(data.users || []);
      setTotal(data.pagination?.total || 0);
      setTotalPages(data.pagination?.total_pages || 0);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load users.",
      );
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [page, role, search, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadUsers();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  const summary = useMemo(() => {
    const students = users.filter(
      (user) => user.role === "STUDENT",
    ).length;

    const professors = users.filter(
      (user) => user.role === "PROFESSOR",
    ).length;

    const admins = users.filter(
      (user) => user.role === "ADMIN",
    ).length;

    return {
      students,
      professors,
      admins,
    };
  }, [users]);

  const resetFilters = () => {
    setSearch("");
    setRole("");
    setStatus("");
    setPage(1);
  };

  return (
    <div
      className="admin-users-page"
      style={{
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        overflowX: "hidden",
      }}
    >
      <div
        className="admin-users-shell"
        style={{
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          boxSizing: "border-box",
          overflowX: "hidden",
        }}
      >
        <header className="admin-users-header">
          <div>
            <div className="admin-users-eyebrow">
              <ShieldCheck size={15} />
              EDUSPHERE ADMINISTRATION
            </div>

            <h1>Users</h1>

            <p>
              Manage students, professors, and administrators
              belonging to your institution.
            </p>
          </div>

          <button
            type="button"
            className="admin-users-refresh"
            onClick={loadUsers}
            disabled={loading}
          >
            <RefreshCw
              size={16}
              className={loading ? "admin-users-spin" : ""}
            />
            Refresh
          </button>
        </header>

        {/* =====================================================
            STATS
            ===================================================== */}
        <section
          className="admin-users-stats"
          style={{
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
            display: "grid",
            gridTemplateColumns:
              "repeat(4, minmax(0, 1fr))",
            gap: "18px",
            boxSizing: "border-box",
            overflow: "hidden",
          }}
        >
          {/* Total Users */}
          <div
            className="admin-users-stat"
            style={
              width: "100%",
              maxWidth: "100%",
              minWidth: 0,
              boxSizing: "border-box",
              overflow: "hidden",
            }
          >
            <div className="admin-users-stat-content">
              <span className="admin-users-stat-icon">
                <Users size={19} />
              </span>

              <div className="admin-users-stat-copy">
                <strong>{total}</strong>
                <span>Total users</span>
              </div>
            </div>
          </div>

          {/* Students */}
          <div
            className="admin-users-stat"
            style={
              width: "100%",
              maxWidth: "100%",
              minWidth: 0,
              boxSizing: "border-box",
              overflow: "hidden",
            }
          >
            <div className="admin-users-stat-content">
              <span className="admin-users-stat-icon">
                <UserRound size={19} />
              </span>

              <div className="admin-users-stat-copy">
                <strong>{summary.students}</strong>
                <span>Students on page</span>
              </div>
            </div>
          </div>

          {/* Professors */}
          <div
            className="admin-users-stat"
            style={
              width: "100%",
              maxWidth: "100%",
              minWidth: 0,
              boxSizing: "border-box",
              overflow: "hidden",
            }
          >
            <div className="admin-users-stat-content">
              <span className="admin-users-stat-icon">
                <ShieldCheck size={19} />
              </span>

              <div className="admin-users-stat-copy">
                <strong>{summary.professors}</strong>
                <span>Professors on page</span>
              </div>
            </div>
          </div>

          {/* Admins */}
          <div
            className="admin-users-stat"
            style={
              width: "100%",
              maxWidth: "100%",
              minWidth: 0,
              boxSizing: "border-box",
              overflow: "hidden",
            }
          >
            <div className="admin-users-stat-content">
              <span className="admin-users-stat-icon">
                <ShieldCheck size={19} />
              </span>

              <div className="admin-users-stat-copy">
                <strong>{summary.admins}</strong>
                <span>Admins on page</span>
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================
            USERS PANEL
            ===================================================== */}
        <section
          className="admin-users-panel"
          style={{
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
            boxSizing: "border-box",
          }}
        >
          <div className="admin-users-toolbar">
            <div className="admin-users-search">
              <Search size={18} />

              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search name, email, ID, enrollment..."
              />

              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setPage(1);
                  }}
                  aria-label="Clear search"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            <select
              value={role}
              onChange={(event) => {
                setRole(event.target.value);
                setPage(1);
              }}
              className="admin-users-select"
            >
              <option value="">All roles</option>
              <option value="STUDENT">Students</option>
              <option value="PROFESSOR">Professors</option>
              <option value="ADMIN">Admins</option>
            </select>

            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="admin-users-select"
            >
              <option value="">All status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>

            {(search || role || status) && (
              <button
                type="button"
                className="admin-users-reset"
                onClick={resetFilters}
              >
                Reset
              </button>
            )}
          </div>

          {error && (
            <div className="admin-users-error">
              {error}
            </div>
          )}

          <div className="admin-users-table-wrap">
            {loading ? (
              <div className="admin-users-empty">
                <RefreshCw
                  size={25}
                  className="admin-users-spin"
                />

                <strong>Loading users...</strong>

                <span>
                  Fetching institution users securely.
                </span>
              </div>
            ) : users.length === 0 ? (
              <div className="admin-users-empty">
                <Users size={32} />

                <strong>No users found</strong>

                <span>
                  Try changing the search or filters.
                </span>
              </div>
            ) : (
              <table className="admin-users-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Institution ID</th>
                    <th>Academic / Department</th>
                    <th>Status</th>
                    <th>Joined</th>
                  </tr>
                </thead>

                <tbody>
                  {users.map((item) => {
                    const academic =
                      item.role === "STUDENT"
                        ? item.student_id ||
                          item.enrollment_number ||
                          "Student"
                        : item.role === "PROFESSOR"
                          ? item.employee_id ||
                            item.professor_department ||
                            "Professor"
                          : item.admin_id ||
                            item.admin_department ||
                            "Administrator";

                    const department =
                      item.role === "STUDENT"
                        ? item.semester
                          ? `Semester ${item.semester}`
                          : "Student profile"
                        : item.role === "PROFESSOR"
                          ? item.professor_designation ||
                            "Professor profile"
                          : item.admin_designation ||
                            "Admin profile";

                    return (
                      <tr key={item.user_id}>
                        <td>
                          <div className="admin-users-user">
                            <div className="admin-users-avatar">
                              {initials(item.full_name)}
                            </div>

                            <div>
                              <strong>
                                {item.full_name ||
                                  "Unnamed user"}
                              </strong>

                              <span>
                                <Mail size={13} />
                                {item.email || "No email"}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span
                            className={`admin-users-role admin-users-role-${item.role?.toLowerCase()}`}
                          >
                            {roleLabel(item.role)}
                          </span>
                        </td>

                        <td>
                          <span className="admin-users-muted">
                            #{item.user_id}
                          </span>
                        </td>

                        <td>
                          <div className="admin-users-academic">
                            <strong>{academic}</strong>
                            <span>{department}</span>
                          </div>
                        </td>

                        <td>
                          <span
                            className={
                              item.is_active
                                ? "admin-users-status active"
                                : "admin-users-status inactive"
                            }
                          >
                            <i />

                            {item.is_active
                              ? "Active"
                              : "Inactive"}
                          </span>
                        </td>

                        <td>
                          <span className="admin-users-muted">
                            {formatDate(item.created_at)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {!loading && users.length > 0 && (
            <div className="admin-users-pagination">
              <span>
                Showing page {page}
                {totalPages ? ` of ${totalPages}` : ""}
                {" · "}
                {total} users
              </span>

              <div>
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() =>
                    setPage((current) =>
                      Math.max(1, current - 1),
                    )
                  }
                >
                  <ChevronLeft size={17} />
                </button>

                <b>{page}</b>

                <button
                  type="button"
                  disabled={
                    !totalPages || page >= totalPages
                  }
                  onClick={() =>
                    setPage((current) => current + 1)
                  }
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}