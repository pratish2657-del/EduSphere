import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  Edit3,
  Filter,
  Plus,
  RefreshCw,
  Search,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import "./admin-attendance.css";
import AI from "../../components/ai/AIChatbot";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

type Course = {
  id: number;
  name: string;
  code: string;
  semester?: number;
  program_id?: number | null;
  institution_id?: number;
};

type AttendanceRecord = {
  id: number;
  student_id: number;
  student_name?: string;
  course_id: number;
  course_name?: string;
  course_code?: string;
  attendance_date: string;
  status: string;
};

type AttendanceResponse = {
  count?: number;
  attendance?: AttendanceRecord[];
};

const STATUS_OPTIONS = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      credentials: "include",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(options?.body ? { "Content-Type": "application/json" } : {}),
        ...(options?.headers || {}),
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
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        `Request timed out. Check that the backend is running at ${API_BASE_URL}.`,
      );
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function getStatusClass(status: string) {
  switch (status.toUpperCase()) {
    case "PRESENT":
      return "present";
    case "ABSENT":
      return "absent";
    case "LATE":
      return "late";
    case "EXCUSED":
      return "excused";
    default:
      return "";
  }
}

function prettyStatus(status: string) {
  const value = status.toLowerCase();
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AdminAttendance() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  const [courseId, setCourseId] = useState("");
  const [attendanceDate, setAttendanceDate] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newStatus, setNewStatus] = useState("PRESENT");
  const [creating, setCreating] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedCourse = useMemo(
    () => courses.find((course) => String(course.id) === courseId),
    [courses, courseId],
  );

  const loadCourses = useCallback(async () => {
    setLoadingCourses(true);
    setError("");

    try {
      const profile = await apiRequest<{
        institution_id?: number;
        profile?: { institution_id?: number } | null;
      }>("/profile/admin");

      const institutionId =
        profile.profile?.institution_id ?? profile.institution_id;

      if (!institutionId) {
        throw new Error("Admin Profile does not have an institution assigned.");
      }

      const response = await apiRequest<{ courses?: Course[] }>(
        `/courses/?institution_id=${institutionId}`,
      );

      const list = response.courses ?? [];
      setCourses(list);

      if (!courseId && list.length > 0) {
        setCourseId(String(list[0].id));
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load courses.",
      );
    } finally {
      setLoadingCourses(false);
    }
  }, [courseId]);

  const loadAttendance = useCallback(async () => {
    if (!courseId) {
      setRecords([]);
      return;
    }

    setLoadingAttendance(true);
    setError("");

    try {
      const params = new URLSearchParams();

      if (attendanceDate) {
        params.set("attendance_date", attendanceDate);
      }

      const suffix = params.toString() ? `?${params.toString()}` : "";

      const response = await apiRequest<AttendanceResponse>(
        `/attendance/course/${courseId}${suffix}`,
      );

      setRecords(response.attendance ?? []);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load attendance.",
      );
      setRecords([]);
    } finally {
      setLoadingAttendance(false);
    }
  }, [courseId, attendanceDate]);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    return records.filter((record) => {
      const matchesStatus =
        statusFilter === "ALL" ||
        record.status.toUpperCase() === statusFilter;

      if (!matchesStatus) return false;

      if (!query) return true;

      return [
        record.student_name,
        record.student_id,
        record.course_name,
        record.course_code,
      ]
        .filter((value) => value !== undefined && value !== null)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [records, search, statusFilter]);

  const stats = useMemo(() => {
    const present = records.filter(
      (item) => item.status.toUpperCase() === "PRESENT",
    ).length;
    const absent = records.filter(
      (item) => item.status.toUpperCase() === "ABSENT",
    ).length;
    const late = records.filter(
      (item) => item.status.toUpperCase() === "LATE",
    ).length;
    const excused = records.filter(
      (item) => item.status.toUpperCase() === "EXCUSED",
    ).length;

    return {
      total: records.length,
      present,
      absent,
      late,
      excused,
      percentage: records.length
        ? Math.round(((present + late) / records.length) * 1000) / 10
        : 0,
    };
  }, [records]);

  const updateStatus = async (record: AttendanceRecord, status: string) => {
    if (record.status.toUpperCase() === status) return;

    setUpdatingId(record.id);
    setError("");
    setNotice("");

    try {
      const response = await apiRequest<{
        attendance_id?: number;
        status?: string;
        message?: string;
      }>(`/attendance/${record.id}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });

      setRecords((current) =>
        current.map((item) =>
          item.id === record.id
            ? { ...item, status: response.status || status }
            : item,
        ),
      );

      setNotice(`${record.student_name || `Student #${record.student_id}`} updated.`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update attendance.",
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const openCreate = () => {
    setStudentId("");
    setNewDate(attendanceDate || new Date().toISOString().slice(0, 10));
    setNewStatus("PRESENT");
    setError("");
    setNotice("");
    setModalOpen(true);
  };

  const createAttendance = async () => {
    if (!courseId) {
      setError("Select a course first.");
      return;
    }

    if (!studentId.trim() || !newDate) {
      setError("Student ID and attendance date are required.");
      return;
    }

    setCreating(true);
    setError("");
    setNotice("");

    try {
      await apiRequest("/attendance/", {
        method: "POST",
        body: JSON.stringify({
          student_id: Number(studentId),
          course_id: Number(courseId),
          attendance_date: newDate,
          status: newStatus,
        }),
      });

      setNotice("Attendance record created successfully.");
      setModalOpen(false);
      setAttendanceDate(newDate);
      await loadAttendance();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to create attendance record.",
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="admin-attendance-page">
      <div className="admin-attendance-header">
        <div>
          <div className="admin-attendance-eyebrow">
            <CalendarCheck2 size={16} />
            ACADEMIC MANAGEMENT
          </div>
          <h1>Attendance Management</h1>
          <p>
            Monitor attendance records, update student status and manage course
            attendance for your institution.
          </p>
        </div>

        <div className="admin-attendance-header-actions">
          <button
            className="admin-attendance-secondary-button"
            onClick={() => void loadAttendance()}
            disabled={loadingAttendance}
          >
            <RefreshCw
              size={17}
              className={loadingAttendance ? "admin-attendance-spin" : ""}
            />
            Refresh
          </button>

          <button
            className="admin-attendance-primary-button"
            onClick={openCreate}
            disabled={!courseId}
          >
            <Plus size={18} />
            Record Attendance
          </button>
        </div>
      </div>

      <div className="admin-attendance-stats">
        <div>
          <span>Total Records</span>
          <strong>{stats.total}</strong>
        </div>
        <div>
          <span>Present</span>
          <strong>{stats.present}</strong>
        </div>
        <div>
          <span>Absent</span>
          <strong>{stats.absent}</strong>
        </div>
        <div>
          <span>Attendance Rate</span>
          <strong>{stats.percentage}%</strong>
        </div>
      </div>

      {(error || notice) && (
        <div
          className={`admin-attendance-alert ${
            error ? "is-error" : "is-success"
          }`}
        >
          <span>{error || notice}</span>
          <button
            onClick={() => {
              setError("");
              setNotice("");
            }}
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <section className="admin-attendance-panel">
        <div className="admin-attendance-toolbar">
          <div className="admin-attendance-toolbar-title">
            <Filter size={17} />
            <div>
              <strong>
                {selectedCourse
                  ? `${selectedCourse.code} — ${selectedCourse.name}`
                  : "Attendance Records"}
              </strong>
              <span>
                {attendanceDate
                  ? `Records for ${formatDate(attendanceDate)}`
                  : "All recorded attendance"}
              </span>
            </div>
          </div>

          <label>
            <span>Course</span>
            <select
              value={courseId}
              onChange={(event) => setCourseId(event.target.value)}
              disabled={loadingCourses}
            >
              <option value="">
                {loadingCourses ? "Loading courses..." : "Select course"}
              </option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} — {course.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Date</span>
            <input
              type="date"
              value={attendanceDate}
              onChange={(event) => setAttendanceDate(event.target.value)}
            />
          </label>

          <label>
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="ALL">All Statuses</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {prettyStatus(status)}
                </option>
              ))}
            </select>
          </label>

          <div className="admin-attendance-search">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search student..."
            />
          </div>
        </div>

        <div className="admin-attendance-table-wrap">
          <table className="admin-attendance-table">
            <thead>
              <tr>
                <th>STUDENT</th>
                <th>STUDENT ID</th>
                <th>DATE</th>
                <th>STATUS</th>
                <th>UPDATE STATUS</th>
                <th>ACTION</th>
              </tr>
            </thead>

            <tbody>
              {loadingAttendance ? (
                <tr>
                  <td colSpan={6} className="admin-attendance-empty">
                    Loading attendance...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="admin-attendance-empty">
                    <CalendarCheck2 size={30} />
                    <strong>No attendance records found</strong>
                    <span>
                      Select a course/date or record the first attendance entry.
                    </span>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <div className="admin-attendance-student">
                        <div className="admin-attendance-avatar">
                          <UserRound size={16} />
                        </div>
                        <div>
                          <strong>{record.student_name || "Unnamed Student"}</strong>
                          <span>{record.course_code || "—"}</span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="admin-attendance-student-id">
                        #{record.student_id}
                      </span>
                    </td>

                    <td>
                      <div className="admin-attendance-date">
                        <Clock3 size={14} />
                        {formatDate(record.attendance_date)}
                      </div>
                    </td>

                    <td>
                      <span
                        className={`admin-attendance-status ${getStatusClass(
                          record.status,
                        )}`}
                      >
                        {record.status.toUpperCase() === "PRESENT" && (
                          <CheckCircle2 size={14} />
                        )}
                        {record.status.toUpperCase() === "ABSENT" && (
                          <XCircle size={14} />
                        )}
                        {record.status.toUpperCase() === "LATE" && (
                          <Clock3 size={14} />
                        )}
                        {prettyStatus(record.status)}
                      </span>
                    </td>

                    <td>
                      <select
                        className="admin-attendance-status-select"
                        value={record.status.toUpperCase()}
                        disabled={updatingId === record.id}
                        onChange={(event) =>
                          void updateStatus(record, event.target.value)
                        }
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {prettyStatus(status)}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td>
                      <button
                        className="admin-attendance-edit-button"
                        title="Edit attendance status"
                        onClick={() =>
                          void updateStatus(
                            record,
                            record.status.toUpperCase() === "PRESENT"
                              ? "ABSENT"
                              : "PRESENT",
                          )
                        }
                        disabled={updatingId === record.id}
                      >
                        <Edit3 size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen && (
        <div
          className="admin-attendance-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !creating) {
              setModalOpen(false);
            }
          }}
        >
          <div className="admin-attendance-modal">
            <div className="admin-attendance-modal-header">
              <div>
                <span>NEW RECORD</span>
                <h2>Record Attendance</h2>
                <p>
                  {selectedCourse
                    ? `${selectedCourse.code} — ${selectedCourse.name}`
                    : "Select a course"}
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                disabled={creating}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="admin-attendance-form">
              <label>
                <span>Student ID *</span>
                <input
                  value={studentId}
                  onChange={(event) => setStudentId(event.target.value)}
                  inputMode="numeric"
                  placeholder="e.g. 1024"
                />
                <small>
                  The student must already be enrolled in the selected course.
                </small>
              </label>

              <label>
                <span>Attendance Date *</span>
                <input
                  type="date"
                  value={newDate}
                  onChange={(event) => setNewDate(event.target.value)}
                />
              </label>

              <label>
                <span>Status *</span>
                <select
                  value={newStatus}
                  onChange={(event) => setNewStatus(event.target.value)}
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {prettyStatus(status)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="admin-attendance-modal-footer">
              <button
                className="admin-attendance-secondary-button"
                onClick={() => setModalOpen(false)}
                disabled={creating}
              >
                Cancel
              </button>
              <button
                className="admin-attendance-primary-button"
                onClick={() => void createAttendance()}
                disabled={creating}
              >
                {creating ? "Saving..." : "Create Record"}
              </button>
            </div>
          </div>
        </div>
      )}
      <AI />
    </div>
  );
}
