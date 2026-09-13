import { useCallback, useEffect, useMemo, useState } from "react";
import "./admin-timetable.css";

import {
  CalendarDays,
  Clock3,
  Edit3,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import AI from "../../components/ai/AIChatbot";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

type Program = {
  id: number;
  institution_id: number;
  name: string;
  code: string;
  is_active?: boolean;
};

type Section = {
  id: number;
  program_id: number;
  name: string;
  code: string;
  is_active?: boolean;
};

type Course = {
  id: number;
  institution_id: number;
  program_id?: number | null;
  name: string;
  code: string;
  semester?: number;
};

type Professor = {
  professor_id: number;
  user_id: number;
  full_name?: string;
  email?: string;
  department?: string;
  designation?: string;
  verification_status?: string;
};

type TimetableItem = {
  timetable_id: number;
  institution_id: number;
  program_id: number;
  section_id: number;
  course_id: number;
  academic_year: string;
  current_year: number;
  day: string;
  start_time: string | number;
  end_time: string | number;
  room: string;
  program_name?: string;
  program_code?: string;
  section_name?: string;
  section_code?: string;
  course_name?: string;
  course_code?: string;
  course_semester?: number;
  professor_id?: number | null;
  professor_name?: string | null;
  professor_email?: string | null;
};

type AdminProfile = {
  institution_id?: number;
  institution_name?: string;
  institution_code?: string;
};

type ListResponse<T> = {
  count?: number;
  programs?: T[];
  sections?: T[];
  courses?: T[];
  users?: T[];
};

type TimetableResponse = {
  institution_id?: number;
  count?: number;
  timetable?: TimetableItem[];
};

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
        ...(options?.body
          ? { "Content-Type": "application/json" }
          : {}),
        ...(options?.headers || {}),
      },
      ...options,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const detail =
        data &&
        typeof data === "object" &&
        "detail" in data
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
    if (
      error instanceof DOMException &&
      error.name === "AbortError"
    ) {
      throw new Error(
        `Request timed out. Check that the backend is running at ${API_BASE_URL}.`,
      );
    }

    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

const DAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

function formatTimeForInput(value?: unknown) {
  if (typeof value === "number") {
    const totalSeconds = Math.max(0, Math.floor(value));
    const hour = Math.floor(totalSeconds / 3600) % 24;
    const minute = Math.floor((totalSeconds % 3600) / 60);

    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(
      2,
      "0",
    )}`;
  }

  if (typeof value === "string") {
    const match = value.trim().match(/^(\d{1,2}):([0-5]\d)/);

    if (match) {
      return `${String(Number(match[1])).padStart(2, "0")}:${match[2]}`;
    }
  }

  return "";
}

function formatTime(value?: unknown) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  let hour = 0;
  let minute = 0;

  if (typeof value === "number") {
    const totalSeconds = Math.max(0, Math.floor(value));

    hour = Math.floor(totalSeconds / 3600) % 24;
    minute = Math.floor((totalSeconds % 3600) / 60);
  } else if (typeof value === "string") {
    const match = value.trim().match(/^(\d{1,2}):([0-5]\d)/);

    if (!match) {
      return value;
    }

    hour = Number(match[1]);
    minute = Number(match[2]);
  } else {
    const serialized = String(value);
    const match = serialized.match(/^(\d{1,2}):([0-5]\d)/);

    if (!match) {
      return "—";
    }

    hour = Number(match[1]);
    minute = Number(match[2]);
  }

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return "—";
  }

  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${String(minute).padStart(
    2,
    "0",
  )} ${suffix}`;
}

function displayName(professor: Professor) {
  return (
    professor.full_name ||
    professor.email ||
    `Professor #${professor.professor_id}`
  );
}

export default function AdminTimetable() {
  const [profile, setProfile] = useState<AdminProfile | null>(null);

  const [programs, setPrograms] = useState<Program[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [timetable, setTimetable] = useState<TimetableItem[]>([]);

  const [programFilter, setProgramFilter] = useState("ALL");
  const [sectionFilter, setSectionFilter] = useState("ALL");
  const [dayFilter, setDayFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TimetableItem | null>(null);

  const [programId, setProgramId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [currentYear, setCurrentYear] = useState("1");
  const [day, setDay] = useState("MONDAY");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [room, setRoom] = useState("");
  const [professorId, setProfessorId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(
    null,
  );
  const [assigningId, setAssigningId] = useState<number | null>(
    null,
  );

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const filteredSections = useMemo(() => {
    if (programId) {
      return sections.filter(
        (item) => item.program_id === Number(programId),
      );
    }

    return sections;
  }, [sections, programId]);

  const loadReferenceData = useCallback(async () => {
    const adminProfileResponse = await apiRequest<
      AdminProfile | { profile?: AdminProfile | null }
    >("/profile/admin");

    const adminProfile: AdminProfile | null =
      adminProfileResponse &&
      typeof adminProfileResponse === "object" &&
      "profile" in adminProfileResponse
        ? (
            adminProfileResponse as {
              profile?: AdminProfile | null;
            }
          ).profile ?? null
        : (adminProfileResponse as AdminProfile | null);

    if (!adminProfile) {
      throw new Error(
        "Admin Profile not found. Complete your Admin Profile first.",
      );
    }

    setProfile(adminProfile);

    const institutionId = adminProfile.institution_id;

    if (!institutionId) {
      throw new Error(
        "Your Admin Profile does not have an institution assigned.",
      );
    }

    const [
      programResponse,
      courseResponse,
      professorResponse,
    ] = await Promise.all([
      apiRequest<ListResponse<Program>>(
        `/programs/?institution_id=${institutionId}`,
      ),

      apiRequest<ListResponse<Course>>(
        `/courses/?institution_id=${institutionId}`,
      ),

      apiRequest<{ professors?: Professor[] }>(
        "/timetable/admin/professors",
      ),
    ]);

    setPrograms(programResponse.programs ?? []);
    setCourses(courseResponse.courses ?? []);
    setProfessors(professorResponse.professors ?? []);

    try {
      const sectionResponse = await apiRequest<
        ListResponse<Section>
      >(`/sections/?institution_id=${institutionId}`);

      setSections(sectionResponse.sections ?? []);
    } catch {
      setSections([]);
    }
  }, []);

  const loadSectionsForProgram = useCallback(
    async (selectedProgramId: string) => {
      if (!selectedProgramId) {
        setSections([]);
        return;
      }

      try {
        const response = await apiRequest<ListResponse<Section>>(
          `/sections/?program_id=${selectedProgramId}`,
        );

        setSections(response.sections ?? []);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load sections.",
        );
      }
    },
    [],
  );

  const loadTimetable = useCallback(async () => {
    const params = new URLSearchParams();

    if (programFilter !== "ALL") {
      params.set("program_id", programFilter);
    }

    if (sectionFilter !== "ALL") {
      params.set("section_id", sectionFilter);
    }

    if (dayFilter !== "ALL") {
      params.set("day", dayFilter);
    }

    const suffix = params.toString()
      ? `?${params.toString()}`
      : "";

    const response = await apiRequest<TimetableResponse>(
      `/timetable/admin${suffix}`,
    );

    setTimetable(response.timetable ?? []);
  }, [programFilter, sectionFilter, dayFilter]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      await loadReferenceData();
      await loadTimetable();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load timetable management.",
      );
    } finally {
      setLoading(false);
    }
  }, [loadReferenceData, loadTimetable]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (programId) {
      void loadSectionsForProgram(programId);
      setSectionId("");
    }
  }, [programId, loadSectionsForProgram]);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return timetable.filter((item) => {
      if (!q) {
        return true;
      }

      return [
        item.course_name,
        item.course_code,
        item.professor_name,
        item.room,
        item.program_name,
        item.program_code,
        item.section_name,
        item.section_code,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(q),
        );
    });
  }, [timetable, search]);

  const resetForm = () => {
    setEditing(null);

    setProgramId(
      programs[0]?.id ? String(programs[0].id) : "",
    );

    setSectionId("");
    setCourseId("");
    setAcademicYear("");
    setCurrentYear("1");
    setDay("MONDAY");
    setStartTime("09:00");
    setEndTime("10:00");
    setRoom("");
    setProfessorId("");
  };

  const openCreate = () => {
    setError("");
    setNotice("");

    resetForm();

    setModalOpen(true);
  };

  const openEdit = (item: TimetableItem) => {
    setError("");
    setNotice("");

    setEditing(item);

    setProgramId(String(item.program_id));
    setSectionId(String(item.section_id));
    setCourseId(String(item.course_id));
    setAcademicYear(item.academic_year);
    setCurrentYear(String(item.current_year));
    setDay(item.day.toUpperCase());

    setStartTime(
      typeof item.start_time === "string"
        ? item.start_time.slice(0, 5)
        : formatTimeForInput(item.start_time),
    );

    setEndTime(
      typeof item.end_time === "string"
        ? item.end_time.slice(0, 5)
        : formatTimeForInput(item.end_time),
    );

    setRoom(item.room);

    setProfessorId(
      item.professor_id
        ? String(item.professor_id)
        : "",
    );

    setModalOpen(true);
  };

  const saveEntry = async () => {
    const institutionId = profile?.institution_id;

    if (!institutionId) {
      setError("Institution information is unavailable.");
      return;
    }

    if (!programId || !sectionId || !courseId) {
      setError(
        "Program, section and course are required.",
      );
      return;
    }

    if (!academicYear.trim() || !room.trim()) {
      setError(
        "Academic year and room are required.",
      );
      return;
    }

    if (
      !startTime ||
      !endTime ||
      startTime >= endTime
    ) {
      setError(
        "Start time must be before end time.",
      );
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const payload = {
        ...(editing
          ? {}
          : { institution_id: institutionId }),

        program_id: Number(programId),
        section_id: Number(sectionId),
        course_id: Number(courseId),
        academic_year: academicYear.trim(),
        current_year: Number(currentYear),
        day,
        start_time: startTime,
        end_time: endTime,
        room: room.trim(),
      };

      const response = editing
        ? await apiRequest<{ timetable_id?: number }>(
            `/timetable/${editing.timetable_id}`,
            {
              method: "PUT",
              body: JSON.stringify(payload),
            },
          )
        : await apiRequest<{ timetable_id?: number }>(
            "/timetable/",
            {
              method: "POST",
              body: JSON.stringify(payload),
            },
          );

      const timetableId =
        response.timetable_id ??
        editing?.timetable_id;

      if (timetableId) {
        await apiRequest(
          `/timetable/${timetableId}/assign-professor`,
          {
            method: "PUT",
            body: JSON.stringify({
              professor_id: professorId
                ? Number(professorId)
                : null,
            }),
          },
        );
      }

      setNotice(
        editing
          ? "Timetable updated successfully."
          : "Timetable created successfully.",
      );

      setModalOpen(false);

      await loadTimetable();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save timetable.",
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async (item: TimetableItem) => {
    if (
      !window.confirm(
        `Delete ${
          item.course_name ||
          "this timetable entry"
        }?`,
      )
    ) {
      return;
    }

    setDeletingId(item.timetable_id);
    setError("");
    setNotice("");

    try {
      await apiRequest(
        `/timetable/${item.timetable_id}`,
        {
          method: "DELETE",
        },
      );

      setNotice(
        "Timetable entry deleted successfully.",
      );

      await loadTimetable();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to delete timetable entry.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  const assignProfessor = async (
    item: TimetableItem,
    nextProfessorId: string,
  ) => {
    setAssigningId(item.timetable_id);
    setError("");
    setNotice("");

    try {
      await apiRequest(
        `/timetable/${item.timetable_id}/assign-professor`,
        {
          method: "PUT",
          body: JSON.stringify({
            professor_id: nextProfessorId
              ? Number(nextProfessorId)
              : null,
          }),
        },
      );

      setNotice(
        "Professor assignment updated.",
      );

      await loadTimetable();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update professor assignment.",
      );
    } finally {
      setAssigningId(null);
    }
  };

  const institutionLabel =
    profile?.institution_name ||
    profile?.institution_code ||
    "Institution";

  return (
    <div className="admin-timetable-page">
      <div className="admin-timetable-header">
        <div>
          <div className="admin-timetable-eyebrow">
            <CalendarDays size={16} />
            ACADEMIC MANAGEMENT
          </div>

          <h1>Timetable Management</h1>

          <p>
            Create, update, assign professors and
            manage the complete timetable for{" "}
            {institutionLabel}.
          </p>
        </div>

        <div className="admin-timetable-header-actions">
          <button
            className="admin-timetable-secondary-button"
            onClick={() => void loadAll()}
            disabled={loading}
          >
            <RefreshCw
              size={17}
              className={
                loading
                  ? "admin-timetable-spin"
                  : ""
              }
            />
            Refresh
          </button>

          <button
            className="admin-timetable-primary-button"
            onClick={openCreate}
          >
            <Plus size={18} />
            Add Timetable
          </button>
        </div>
      </div>

      <div className="admin-timetable-stats">
        <div>
          <span>Total Entries</span>
          <strong>{timetable.length}</strong>
        </div>

        <div>
          <span>Programs</span>
          <strong>{programs.length}</strong>
        </div>

        <div>
          <span>Professors</span>
          <strong>{professors.length}</strong>
        </div>

        <div>
          <span>Filtered Results</span>
          <strong>{visibleRows.length}</strong>
        </div>
      </div>

      {(error || notice) && (
        <div
          className={`admin-timetable-alert ${
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

      <section className="admin-timetable-panel">
        <div className="admin-timetable-toolbar">
          <div className="admin-timetable-search">
            <Search size={17} />

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search course, professor, room..."
            />
          </div>

          <label>
            <span>Program</span>

            <select
              value={programFilter}
              onChange={(event) => {
                const value = event.target.value;

                setProgramFilter(value);
                setSectionFilter("ALL");

                if (value !== "ALL") {
                  void loadSectionsForProgram(value);
                }
              }}
            >
              <option value="ALL">
                All Programs
              </option>

              {programs.map((program) => (
                <option
                  key={program.id}
                  value={program.id}
                >
                  {program.code} — {program.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Section</span>

            <select
              value={sectionFilter}
              onChange={(event) =>
                setSectionFilter(
                  event.target.value,
                )
              }
            >
              <option value="ALL">
                All Sections
              </option>

              {sections.map((section) => (
                <option
                  key={section.id}
                  value={section.id}
                >
                  {section.code} — {section.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Day</span>

            <select
              value={dayFilter}
              onChange={(event) =>
                setDayFilter(event.target.value)
              }
            >
              <option value="ALL">
                All Days
              </option>

              {DAYS.map((item) => (
                <option key={item} value={item}>
                  {item.charAt(0) +
                    item.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="admin-timetable-table-wrap">
          <table className="admin-timetable-table">
            <thead>
              <tr>
                <th>TIME</th>
                <th>COURSE</th>
                <th>PROGRAM / SECTION</th>
                <th>PROFESSOR</th>
                <th>ROOM</th>
                <th>DAY</th>
                <th>ACTIONS</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="admin-timetable-empty"
                  >
                    Loading timetable...
                  </td>
                </tr>
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="admin-timetable-empty"
                  >
                    <CalendarDays size={30} />

                    <strong>
                      No timetable entries found
                    </strong>

                    <span>
                      Create a timetable entry or
                      change the filters.
                    </span>
                  </td>
                </tr>
              ) : (
                visibleRows.map((item) => (
                  <tr key={item.timetable_id}>
                    <td>
                      <div className="admin-timetable-time">
                        <Clock3 size={15} />

                        <strong>
                          {formatTime(
                            item.start_time,
                          )}
                        </strong>

                        <span>
                          {formatTime(
                            item.end_time,
                          )}
                        </span>
                      </div>
                    </td>

                    <td>
                      <div className="admin-timetable-course">
                        <strong>
                          {item.course_name ||
                            "Unnamed Course"}
                        </strong>

                        <span>
                          {item.course_code || "—"}
                        </span>
                      </div>
                    </td>

                    <td>
                      <div className="admin-timetable-course">
                        <strong>
                          {item.program_code ||
                            item.program_name ||
                            "—"}
                        </strong>

                        <span>
                          {item.section_code ||
                            item.section_name ||
                            "—"}{" "}
                          · Year{" "}
                          {item.current_year}
                        </span>
                      </div>
                    </td>

                    <td>
                      <div className="admin-timetable-professor-cell">
                        <div className="admin-timetable-professor-name">
                          <UserRound size={15} />

                          <span>
                            {item.professor_name ||
                              "Not assigned"}
                          </span>
                        </div>

                        <div className="admin-timetable-assignment">
                          <select
                            value={
                              item.professor_id
                                ? String(
                                    item.professor_id,
                                  )
                                : ""
                            }
                            disabled={
                              assigningId ===
                              item.timetable_id
                            }
                            onChange={(event) =>
                              void assignProfessor(
                                item,
                                event.target.value,
                              )
                            }
                          >
                            <option value="">
                              Unassigned
                            </option>

                            {professors.map(
                              (professor) => (
                                <option
                                  key={
                                    professor.professor_id
                                  }
                                  value={
                                    professor.professor_id
                                  }
                                >
                                  {displayName(
                                    professor,
                                  )}
                                </option>
                              ),
                            )}
                          </select>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="admin-timetable-room">
                        {item.room}
                      </span>
                    </td>

                    <td>
                      <span className="admin-timetable-day">
                        {item.day.charAt(0) +
                          item.day
                            .slice(1)
                            .toLowerCase()}
                      </span>
                    </td>

                    <td>
                      <div className="admin-timetable-row-actions">
                        <button
                          title="Edit"
                          onClick={() =>
                            openEdit(item)
                          }
                        >
                          <Edit3 size={16} />
                        </button>

                        <button
                          title="Delete"
                          className="danger"
                          disabled={
                            deletingId ===
                            item.timetable_id
                          }
                          onClick={() =>
                            void deleteEntry(item)
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
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
          className="admin-timetable-modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !saving
            ) {
              setModalOpen(false);
            }
          }}
        >
          <div className="admin-timetable-modal">
            <div className="admin-timetable-modal-header">
              <div>
                <span>
                  {editing
                    ? "UPDATE ENTRY"
                    : "NEW ENTRY"}
                </span>

                <h2>
                  {editing
                    ? "Edit Timetable"
                    : "Add Timetable"}
                </h2>
              </div>

              <button
                onClick={() =>
                  setModalOpen(false)
                }
                disabled={saving}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="admin-timetable-form-grid">
              <label>
                <span>Program *</span>

                <select
                  value={programId}
                  onChange={(event) =>
                    setProgramId(
                      event.target.value,
                    )
                  }
                >
                  <option value="">
                    Select program
                  </option>

                  {programs.map((program) => (
                    <option
                      key={program.id}
                      value={program.id}
                    >
                      {program.code} —{" "}
                      {program.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Section *</span>

                <select
                  value={sectionId}
                  onChange={(event) =>
                    setSectionId(
                      event.target.value,
                    )
                  }
                  disabled={!programId}
                >
                  <option value="">
                    Select section
                  </option>

                  {filteredSections.map(
                    (section) => (
                      <option
                        key={section.id}
                        value={section.id}
                      >
                        {section.code} —{" "}
                        {section.name}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="wide">
                <span>Course *</span>

                <select
                  value={courseId}
                  onChange={(event) =>
                    setCourseId(
                      event.target.value,
                    )
                  }
                >
                  <option value="">
                    Select course
                  </option>

                  {courses
                    .filter(
                      (course) =>
                        !programId ||
                        Number(
                          course.program_id,
                        ) ===
                          Number(programId),
                    )
                    .map((course) => (
                      <option
                        key={course.id}
                        value={course.id}
                      >
                        {course.code} —{" "}
                        {course.name}
                        {course.semester
                          ? ` · Sem ${course.semester}`
                          : ""}
                      </option>
                    ))}
                </select>
              </label>

              <label>
                <span>Academic Year *</span>

                <input
                  value={academicYear}
                  onChange={(event) =>
                    setAcademicYear(
                      event.target.value,
                    )
                  }
                  placeholder="2026-27"
                />
              </label>

              <label>
                <span>Current Year *</span>

                <select
                  value={currentYear}
                  onChange={(event) =>
                    setCurrentYear(
                      event.target.value,
                    )
                  }
                >
                  {Array.from(
                    { length: 10 },
                    (_, index) => index + 1,
                  ).map((year) => (
                    <option
                      key={year}
                      value={year}
                    >
                      Year {year}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Day *</span>

                <select
                  value={day}
                  onChange={(event) =>
                    setDay(event.target.value)
                  }
                >
                  {DAYS.map((item) => (
                    <option
                      key={item}
                      value={item}
                    >
                      {item.charAt(0) +
                        item
                          .slice(1)
                          .toLowerCase()}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Professor</span>

                <select
                  value={professorId}
                  onChange={(event) =>
                    setProfessorId(
                      event.target.value,
                    )
                  }
                >
                  <option value="">
                    Unassigned
                  </option>

                  {professors.map(
                    (professor) => (
                      <option
                        key={
                          professor.professor_id
                        }
                        value={
                          professor.professor_id
                        }
                      >
                        {displayName(
                          professor,
                        )}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>Start Time *</span>

                <input
                  type="time"
                  value={startTime}
                  onChange={(event) =>
                    setStartTime(
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                <span>End Time *</span>

                <input
                  type="time"
                  value={endTime}
                  onChange={(event) =>
                    setEndTime(
                      event.target.value,
                    )
                  }
                />
              </label>

              <label className="wide">
                <span>Room *</span>

                <input
                  value={room}
                  onChange={(event) =>
                    setRoom(event.target.value)
                  }
                  placeholder="Room 301 / Lab 2"
                />
              </label>
            </div>

            <div className="admin-timetable-modal-footer">
              <button
                className="admin-timetable-secondary-button"
                onClick={() =>
                  setModalOpen(false)
                }
                disabled={saving}
              >
                Cancel
              </button>

              <button
                className="admin-timetable-primary-button"
                onClick={() =>
                  void saveEntry()
                }
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editing
                    ? "Update Timetable"
                    : "Create Timetable"}
              </button>
            </div>
          </div>
        </div>
      )}

      <AI />
    </div>
  );
}