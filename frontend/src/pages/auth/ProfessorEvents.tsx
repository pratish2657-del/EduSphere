import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Clock3,
  Download,
  ExternalLink,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

type EventItem = {
  id: number;
  title: string;
  description: string;
  event_type: string;
  start_datetime: string;
  end_datetime: string;
  venue: string;
  organizer: string;
  registration_deadline?: string | null;
  registration_link?: string | null;
  target_program_id?: number | null;
  target_section_id?: number | null;
  target_year?: number | null;
  is_published: boolean;
  created_by?: number;
  created_at?: string;
  updated_at?: string;
};

type Attachment = {
  id: number;
  event_id: number;
  file_name: string;
  file_path?: string;
  file_type?: string | null;
  file_size?: number | null;
  uploaded_by?: number;
  uploaded_at?: string;
};

type EventsResponse = {
  count: number;
  events: EventItem[];
};

type EventDetailsResponse = {
  event: EventItem;
  attachments: Attachment[];
};

type FormState = {
  title: string;
  description: string;
  event_type: string;
  start_datetime: string;
  end_datetime: string;
  venue: string;
  organizer: string;
  registration_deadline: string;
  registration_link: string;
  target_program_id: string;
  target_section_id: string;
  target_year: string;
};

const EVENT_TYPES = [
  "SEMINAR",
  "WORKSHOP",
  "WEBINAR",
  "LECTURE",
  "CONFERENCE",
  "CULTURAL",
  "SPORTS",
  "COMPETITION",
  "CLUB",
  "OTHER",
];

const emptyForm: FormState = {
  title: "",
  description: "",
  event_type: "SEMINAR",
  start_datetime: "",
  end_datetime: "",
  venue: "",
  organizer: "",
  registration_deadline: "",
  registration_link: "",
  target_program_id: "",
  target_section_id: "",
  target_year: "",
};

async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const detail =
      data?.detail ||
      data?.message ||
      `Request failed (${response.status})`;

    if (Array.isArray(detail)) {
      throw new Error(
        detail
          .map((item) =>
            typeof item === "string"
              ? item
              : item?.msg || JSON.stringify(item),
          )
          .join(" • "),
      );
    }

    throw new Error(String(detail));
  }

  return data as T;
}

/*
 * IMPORTANT:
 * The backend stores event datetimes as naive IST.
 *
 * datetime-local gives the professor an IST wall-clock value.
 * Converting it with toISOString() sends the equivalent instant
 * to the API. The backend then converts it back to IST.
 *
 * Example:
 * 12:00 PM in India -> 06:30 UTC -> backend stores 12:00 IST.
 */
/*
 * Event times are entered and stored as IST wall-clock values.
 *
 * IMPORTANT:
 * Do NOT use toISOString() here. A value such as:
 *   2026-09-18T00:00
 * is 12:00 AM IST. Calling toISOString() converts it to
 * 2026-09-17T18:30:00.000Z. If the backend then treats that value
 * as an IST wall-clock value, it becomes 6:30 PM on the previous day.
 *
 * The events API expects the event datetime as the same IST wall-clock
 * value, so send it without converting the clock time.
 */
function toApiDateTime(value: string) {
  if (!value) return value;

  return `${value.replace("T", " ")}:00`;
}

function hasTimezone(value: string) {
  return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim());
}

function parseDate(value?: string | null) {
  if (!value) return null;

  const raw = String(value).trim();

  /*
   * Backend event timestamps without an offset are IST.
   * Explicitly attach +05:30 so the browser never interprets them
   * using another local timezone.
   */
  const normalized =
    !hasTimezone(raw) &&
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(raw)
      ? `${raw.replace(" ", "T")}+05:30`
      : raw;

  const date = new Date(normalized);

  return Number.isNaN(date.getTime()) ? null : date;
}

function toInputDateTime(value?: string | null) {
  if (!value) return "";

  const date = parseDate(value);

  if (!date) {
    return value.replace(" ", "T").slice(0, 16);
  }

  return date
    .toLocaleString("sv-SE", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .replace(" ", "T");
}

function formatDate(value?: string | null) {
  const date = parseDate(value);

  if (!date) return "—";

  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFileSize(bytes?: number | null) {
  if (!bytes || bytes <= 0) return "";

  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isUpcoming(event: EventItem) {
  const start = parseDate(event.start_datetime);
  return Boolean(start && start.getTime() >= Date.now());
}

function isProfessorOwned(event: EventItem, userId?: number) {
  /*
   * The backend is the final authority for ownership.
   * When created_by is available, use it for the UI so that
   * professors do not see edit/delete controls on other events.
   *
   * If userId is not available in the frontend, the API still
   * protects PUT/DELETE requests with its ownership check.
   */
  if (event.created_by == null || userId == null) {
    return true;
  }

  return event.created_by === userId;
}

function eventFormFromItem(event: EventItem): FormState {
  return {
    title: event.title || "",
    description: event.description || "",
    event_type: event.event_type || "SEMINAR",
    start_datetime: toInputDateTime(event.start_datetime),
    end_datetime: toInputDateTime(event.end_datetime),
    venue: event.venue || "",
    organizer: event.organizer || "",
    registration_deadline: toInputDateTime(
      event.registration_deadline,
    ),
    registration_link: event.registration_link || "",
    target_program_id:
      event.target_program_id == null
        ? ""
        : String(event.target_program_id),
    target_section_id:
      event.target_section_id == null
        ? ""
        : String(event.target_section_id),
    target_year:
      event.target_year == null
        ? ""
        : String(event.target_year),
  };
}

export default function ProfessorEvents() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<
    "ALL" | "PUBLISHED" | "DRAFT"
  >("ALL");
  const [type, setType] = useState("ALL");

  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedEvent, setSelectedEvent] =
    useState<EventItem | null>(null);
  const [selectedAttachments, setSelectedAttachments] =
    useState<Attachment[]>([]);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [attachment, setAttachment] = useState<File | null>(
    null,
  );

  /*
   * Keep this optional because the event API itself does not need
   * a frontend user ID. If your AuthContext exists, you can later
   * replace this with the authenticated professor ID.
   */
  const professorId: number | undefined = undefined;

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await api<EventsResponse>("/events/");
      setEvents(
        Array.isArray(data?.events) ? data.events : [],
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load events.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const eventTypes = useMemo(() => {
    const fromEvents = events
      .map((event) => event.event_type)
      .filter(Boolean);

    return Array.from(
      new Set([...EVENT_TYPES, ...fromEvents]),
    ).sort();
  }, [events]);

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();

    return events.filter((event) => {
      const matchesSearch =
        !query ||
        [
          event.title,
          event.description,
          event.event_type,
          event.venue,
          event.organizer,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        status === "ALL" ||
        (status === "PUBLISHED"
          ? event.is_published
          : !event.is_published);

      const matchesType =
        type === "ALL" || event.event_type === type;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesType
      );
    });
  }, [events, search, status, type]);

  const totalCount = events.length;

  const publishedCount = events.filter(
    (event) => event.is_published,
  ).length;

  const upcomingCount = events.filter(isUpcoming).length;

  const draftCount = events.filter(
    (event) => !event.is_published,
  ).length;

  const openCreate = () => {
    setEditingId(null);
    setSelectedEvent(null);
    setSelectedAttachments([]);
    setForm(emptyForm);
    setAttachment(null);
    setError("");
    setNotice("");
    setModalOpen(true);
  };

  const openEdit = (event: EventItem) => {
    setEditingId(event.id);
    setSelectedEvent(null);
    setSelectedAttachments([]);
    setForm(eventFormFromItem(event));
    setAttachment(null);
    setError("");
    setNotice("");
    setModalOpen(true);
  };

  const openDetails = async (event: EventItem) => {
    setSelectedEvent(event);
    setSelectedAttachments([]);
    setDetailOpen(true);
    setError("");

    try {
      const data = await api<EventDetailsResponse>(
        `/events/${event.id}`,
      );

      if (data?.event) {
        setSelectedEvent(data.event);
      }

      setSelectedAttachments(
        Array.isArray(data?.attachments)
          ? data.attachments
          : [],
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load event details.",
      );
    }
  };

  const updateForm = (
    key: keyof FormState,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
    setError("");
  };

  const buildPayload = () => {
    if (!form.title.trim()) {
      throw new Error("Event title is required.");
    }

    if (!form.description.trim()) {
      throw new Error("Description is required.");
    }

    if (!form.event_type.trim()) {
      throw new Error("Event type is required.");
    }

    if (!form.start_datetime || !form.end_datetime) {
      throw new Error(
        "Start and end date/time are required.",
      );
    }

    const start = new Date(form.start_datetime);
    const end = new Date(form.end_datetime);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime())
    ) {
      throw new Error(
        "Please enter valid event date and time.",
      );
    }

    if (start >= end) {
      throw new Error(
        "Event start time must be before event end time.",
      );
    }

    if (
      form.registration_deadline &&
      new Date(form.registration_deadline) > start
    ) {
      throw new Error(
        "Registration deadline cannot be after the event start time.",
      );
    }

    const programId = form.target_program_id
      ? Number(form.target_program_id)
      : null;

    const sectionId = form.target_section_id
      ? Number(form.target_section_id)
      : null;

    const targetYear = form.target_year
      ? Number(form.target_year)
      : null;

    if (
      programId !== null &&
      (!Number.isInteger(programId) || programId < 1)
    ) {
      throw new Error(
        "Target Program ID must be a positive integer.",
      );
    }

    if (
      sectionId !== null &&
      (!Number.isInteger(sectionId) || sectionId < 1)
    ) {
      throw new Error(
        "Target Section ID must be a positive integer.",
      );
    }

    if (
      sectionId !== null &&
      programId === null
    ) {
      throw new Error(
        "Target Program ID is required when Target Section ID is provided.",
      );
    }

    if (
      targetYear !== null &&
      (!Number.isInteger(targetYear) ||
        targetYear < 1 ||
        targetYear > 10)
    ) {
      throw new Error(
        "Target Year must be between 1 and 10.",
      );
    }

    if (
      form.registration_link.trim() &&
      !/^https?:\/\/\S+$/i.test(
        form.registration_link.trim(),
      )
    ) {
      throw new Error(
        "Registration link must be a valid HTTP/HTTPS URL.",
      );
    }

    return {
      title: form.title.trim(),
      description: form.description.trim(),
      event_type: form.event_type.trim(),
      start_datetime: toApiDateTime(
        form.start_datetime,
      ),
      end_datetime: toApiDateTime(
        form.end_datetime,
      ),
      venue: form.venue.trim(),
      organizer: form.organizer.trim(),
      registration_deadline:
        form.registration_deadline
          ? toApiDateTime(
              form.registration_deadline,
            )
          : null,
      registration_link:
        form.registration_link.trim() || null,
      target_program_id: programId,
      target_section_id: sectionId,
      target_year: targetYear,
    };
  };

  const saveEvent = async () => {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const payload = buildPayload();

      const result = await api<{
        message?: string;
        event_id?: number;
        id?: number;
        is_published?: boolean;
      }>(
        editingId !== null
          ? `/events/${editingId}`
          : "/events/",
        {
          method:
            editingId !== null ? "PUT" : "POST",
          body: JSON.stringify(payload),
        },
      );

      const eventId = Number(
        result?.event_id ??
          result?.id ??
          editingId,
      );

      /*
       * Backend POST /events/ returns event_id.
       * Attachment upload is a separate multipart endpoint.
       */
      if (
        attachment &&
        Number.isInteger(eventId) &&
        eventId > 0
      ) {
        const body = new FormData();
        body.append("file", attachment);

        const uploadResponse = await fetch(
          `${API_BASE_URL}/events/${eventId}/attachments`,
          {
            method: "POST",
            credentials: "include",
            body,
          },
        );

        const uploadData = await uploadResponse
          .json()
          .catch(() => null);

        if (!uploadResponse.ok) {
          throw new Error(
            uploadData?.detail ||
              uploadData?.message ||
              "Event was saved, but attachment upload failed.",
          );
        }
      }

      setModalOpen(false);
      setEditingId(null);
      setAttachment(null);

      setNotice(
        editingId !== null
          ? "Event updated successfully."
          : "Event created successfully. It is saved as a draft until an administrator publishes it.",
      );

      await loadEvents();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save event.",
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = async (event: EventItem) => {
    if (
      !window.confirm(
        `Delete "${event.title}"? This action cannot be undone.`,
      )
    ) {
      return;
    }

    setDeletingId(event.id);
    setError("");
    setNotice("");

    try {
      await api(`/events/${event.id}`, {
        method: "DELETE",
      });

      if (selectedEvent?.id === event.id) {
        setSelectedEvent(null);
        setSelectedAttachments([]);
        setDetailOpen(false);
      }

      setNotice("Event deleted successfully.");
      await loadEvents();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete event.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  const deleteAttachment = async (
    item: Attachment,
  ) => {
    if (
      !window.confirm(
        `Delete attachment "${item.file_name}"?`,
      )
    ) {
      return;
    }

    setError("");

    try {
      await api(
        `/events/attachments/${item.id}`,
        {
          method: "DELETE",
        },
      );

      setSelectedAttachments((current) =>
        current.filter(
          (attachmentItem) =>
            attachmentItem.id !== item.id,
        ),
      );

      setNotice("Attachment deleted successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete attachment.",
      );
    }
  };

  const attachmentUrl = (attachmentId: number) =>
    `${API_BASE_URL}/events/attachments/${attachmentId}`;

  const canManage = (event: EventItem) =>
    isProfessorOwned(event, professorId);

  return (
    <>
      <style>{`
        .prof-events-page {
          min-height: 100%;
          box-sizing: border-box;
          padding: 30px;
          color: #eaf0ff;
        }

        .prof-events-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 22px;
          margin-bottom: 24px;
        }

        .prof-events-eyebrow {
          display: block;
          margin-bottom: 8px;
          color: #78adff;
          font-size: 10px;
          font-weight: 850;
          letter-spacing: .16em;
          text-transform: uppercase;
        }

        .prof-events-header h1 {
          margin: 0;
          font-size: clamp(30px, 4vw, 48px);
          line-height: 1;
          letter-spacing: -.045em;
        }

        .prof-events-header p {
          max-width: 720px;
          margin: 12px 0 0;
          color: #7d8ba5;
          font-size: 13px;
          line-height: 1.65;
        }

        .prof-events-primary,
        .prof-events-secondary,
        .prof-events-danger,
        .prof-events-icon {
          border: 1px solid rgba(112, 153, 218, .2);
          border-radius: 11px;
          min-height: 41px;
          padding: 0 14px;
          color: #eaf1ff;
          background: #101b30;
          font: inherit;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          transition: .18s ease;
        }

        .prof-events-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          background: linear-gradient(135deg, #2563d8, #5b32ca);
          border-color: rgba(104, 157, 255, .38);
          box-shadow: 0 12px 30px rgba(50, 88, 205, .2);
        }

        .prof-events-primary:hover,
        .prof-events-secondary:hover,
        .prof-events-danger:hover {
          transform: translateY(-1px);
          filter: brightness(1.08);
        }

        .prof-events-primary:disabled,
        .prof-events-secondary:disabled,
        .prof-events-danger:disabled {
          cursor: not-allowed;
          opacity: .55;
          transform: none;
        }

        .prof-events-secondary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
        }

        .prof-events-danger {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          color: #ff9eab;
          border-color: rgba(255, 88, 117, .2);
        }

        .prof-events-icon {
          width: 41px;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .prof-events-alert,
        .prof-events-notice {
          margin-bottom: 18px;
          padding: 13px 15px;
          border-radius: 13px;
          font-size: 12px;
          line-height: 1.5;
        }

        .prof-events-alert {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          color: #ffb3bf;
          background: rgba(84, 17, 35, .34);
          border: 1px solid rgba(255, 92, 122, .22);
        }

        .prof-events-notice {
          color: #9cf0cc;
          background: rgba(13, 76, 55, .23);
          border: 1px solid rgba(76, 218, 164, .2);
        }

        .prof-events-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 18px;
        }

        .prof-events-stat {
          padding: 17px 18px;
          border: 1px solid rgba(111, 148, 205, .13);
          border-radius: 16px;
          background: rgba(9, 17, 33, .74);
        }

        .prof-events-stat span {
          display: block;
          color: #6e7d98;
          font-size: 9px;
          font-weight: 850;
          letter-spacing: .12em;
          text-transform: uppercase;
        }

        .prof-events-stat strong {
          display: block;
          margin-top: 7px;
          color: #f4f7ff;
          font-size: 27px;
        }

        .prof-events-toolbar {
          display: grid;
          grid-template-columns: minmax(180px, 1fr) 160px 160px auto;
          gap: 10px;
          margin-bottom: 18px;
        }

        .prof-events-search {
          position: relative;
        }

        .prof-events-search svg {
          position: absolute;
          top: 50%;
          left: 13px;
          transform: translateY(-50%);
          color: #64748e;
          pointer-events: none;
        }

        .prof-events-input,
        .prof-events-select,
        .prof-events-form input,
        .prof-events-form textarea {
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
          border: 1px solid rgba(110, 146, 201, .17);
          border-radius: 10px;
          outline: none;
          color: #e8effd;
          background: #0a1323;
          padding: 11px 12px;
          font: inherit;
          font-size: 12px;
        }

        .prof-events-search .prof-events-input {
          padding-left: 39px;
        }

        .prof-events-input:focus,
        .prof-events-select:focus,
        .prof-events-form input:focus,
        .prof-events-form textarea:focus {
          border-color: rgba(83, 145, 255, .6);
          box-shadow: 0 0 0 3px rgba(60, 120, 236, .1);
        }

        .prof-events-card {
          overflow: hidden;
          border: 1px solid rgba(111, 148, 205, .13);
          border-radius: 19px;
          background: rgba(6, 13, 26, .76);
        }

        .prof-events-card-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 19px 21px;
          border-bottom: 1px solid rgba(111, 148, 205, .1);
        }

        .prof-events-card-head h2 {
          margin: 0;
          font-size: 17px;
        }

        .prof-events-card-head span {
          display: block;
          margin-top: 4px;
          color: #6e7d98;
          font-size: 11px;
        }

        .prof-events-list {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 13px;
          padding: 17px;
        }

        .prof-events-item {
          min-width: 0;
          padding: 16px;
          border: 1px solid rgba(111, 148, 205, .11);
          border-radius: 16px;
          background: rgba(14, 24, 43, .74);
        }

        .prof-events-item-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }

        .prof-events-type {
          display: inline-flex;
          max-width: 100%;
          padding: 5px 8px;
          border-radius: 7px;
          color: #90bcff;
          background: rgba(50, 111, 224, .1);
          font-size: 9px;
          font-weight: 850;
          letter-spacing: .09em;
          text-transform: uppercase;
        }

        .prof-events-badge {
          display: inline-flex;
          padding: 5px 8px;
          border-radius: 7px;
          font-size: 8px;
          font-weight: 850;
          letter-spacing: .08em;
        }

        .prof-events-badge.published {
          color: #72e3b0;
          background: rgba(37, 184, 125, .1);
        }

        .prof-events-badge.draft {
          color: #ffd27c;
          background: rgba(222, 151, 40, .1);
        }

        .prof-events-item h3 {
          margin: 11px 0 7px;
          color: #f0f5ff;
          font-size: 17px;
          line-height: 1.28;
          overflow-wrap: anywhere;
        }

        .prof-events-description {
          display: -webkit-box;
          overflow: hidden;
          margin: 0 0 14px;
          color: #7f8da7;
          font-size: 11px;
          line-height: 1.6;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
        }

        .prof-events-meta {
          display: grid;
          gap: 8px;
        }

        .prof-events-meta-row {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          color: #9aa8bf;
          font-size: 10px;
          line-height: 1.45;
        }

        .prof-events-meta-row svg {
          flex: 0 0 auto;
          margin-top: 1px;
          color: #6da9ff;
        }

        .prof-events-meta-row span {
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .prof-events-item-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 15px;
          padding-top: 12px;
          border-top: 1px solid rgba(111, 148, 205, .08);
        }

        .prof-events-deadline {
          color: #64748e;
          font-size: 9px;
          line-height: 1.4;
        }

        .prof-events-actions {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 6px;
        }

        .prof-events-actions button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          border: 1px solid rgba(111, 148, 205, .14);
          border-radius: 8px;
          padding: 7px 9px;
          color: #aebbd0;
          background: #101b30;
          font: inherit;
          font-size: 9px;
          font-weight: 800;
          cursor: pointer;
        }

        .prof-events-actions button:hover {
          filter: brightness(1.12);
        }

        .prof-events-actions button.danger {
          color: #ff9ca9;
        }

        .prof-events-empty {
          padding: 58px 20px;
          color: #71809a;
          text-align: center;
          font-size: 12px;
        }

        .prof-events-empty strong {
          display: block;
          margin-bottom: 6px;
          color: #cbd6e8;
          font-size: 17px;
        }

        .prof-events-overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
          padding: 20px;
          background: rgba(1, 5, 13, .76);
          backdrop-filter: blur(9px);
        }

        .prof-events-modal,
        .prof-events-detail {
          width: min(790px, 100%);
          max-height: 88vh;
          overflow: auto;
          border: 1px solid rgba(110, 150, 218, .18);
          border-radius: 20px;
          background: #091221;
          box-shadow: 0 30px 90px rgba(0, 0, 0, .48);
        }

        .prof-events-detail {
          width: min(700px, 100%);
        }

        .prof-events-modal-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 15px;
          padding: 20px 21px;
          border-bottom: 1px solid rgba(111, 148, 205, .1);
        }

        .prof-events-modal-head h2 {
          margin: 4px 0 0;
          color: #f0f5ff;
          font-size: 21px;
          line-height: 1.25;
          overflow-wrap: anywhere;
        }

        .prof-events-form {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          padding: 20px 21px;
        }

        .prof-events-form label {
          display: grid;
          gap: 7px;
          min-width: 0;
          color: #aab7cc;
          font-size: 10px;
          font-weight: 800;
        }

        .prof-events-form label.full {
          grid-column: 1 / -1;
        }

        .prof-events-form textarea {
          min-height: 105px;
          resize: vertical;
          line-height: 1.55;
        }

        .prof-events-form input[type="file"] {
          padding: 9px;
        }

        .prof-events-form small {
          color: #687793;
          font-size: 9px;
          font-weight: 500;
          line-height: 1.45;
        }

        .prof-events-modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          padding: 15px 21px 20px;
          border-top: 1px solid rgba(111, 148, 205, .1);
        }

        .prof-events-detail-body {
          padding: 20px 21px;
        }

        .prof-events-detail-description {
          margin: 0 0 18px;
          color: #9ba8bd;
          font-size: 12px;
          line-height: 1.7;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        .prof-events-detail-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .prof-events-detail-cell {
          min-width: 0;
          padding: 12px;
          border: 1px solid rgba(111, 148, 205, .1);
          border-radius: 11px;
          background: rgba(15, 27, 47, .62);
        }

        .prof-events-detail-cell span {
          display: block;
          margin-bottom: 5px;
          color: #65748e;
          font-size: 8px;
          font-weight: 850;
          letter-spacing: .1em;
          text-transform: uppercase;
        }

        .prof-events-detail-cell strong,
        .prof-events-detail-cell a {
          display: block;
          color: #dce5f6;
          font-size: 11px;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .prof-events-detail-cell a {
          color: #83baff;
          text-decoration: none;
        }

        .prof-events-attachments {
          margin-top: 18px;
          padding-top: 17px;
          border-top: 1px solid rgba(111, 148, 205, .1);
        }

        .prof-events-attachments h3 {
          margin: 0 0 10px;
          font-size: 13px;
        }

        .prof-events-attachment {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 11px;
          margin-top: 7px;
          border: 1px solid rgba(111, 148, 205, .1);
          border-radius: 10px;
          background: rgba(15, 27, 47, .55);
        }

        .prof-events-attachment-name {
          min-width: 0;
          color: #aebbd0;
          font-size: 10px;
          overflow-wrap: anywhere;
        }

        .prof-events-attachment-name small {
          display: block;
          margin-top: 3px;
          color: #687793;
          font-size: 8px;
        }

        .prof-events-attachment-actions {
          display: flex;
          flex: 0 0 auto;
          gap: 6px;
        }

        .prof-events-attachment-actions a,
        .prof-events-attachment-actions button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          border: 1px solid rgba(111, 148, 205, .14);
          border-radius: 8px;
          padding: 6px 8px;
          color: #9db7dd;
          background: #101b30;
          font: inherit;
          font-size: 8px;
          font-weight: 800;
          text-decoration: none;
          cursor: pointer;
        }

        .prof-events-attachment-actions button {
          color: #ff9ca9;
        }

        @media (max-width: 1000px) {
          .prof-events-page {
            padding: 24px 20px;
          }

          .prof-events-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .prof-events-toolbar {
            grid-template-columns: 1fr 1fr;
          }

          .prof-events-search {
            grid-column: 1 / -1;
          }

          .prof-events-list {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 700px) {
          .prof-events-page {
            padding: 18px 14px 30px;
          }

          .prof-events-header {
            align-items: stretch;
            flex-direction: column;
          }

          .prof-events-header h1 {
            font-size: 32px;
          }

          .prof-events-header .prof-events-primary {
            width: 100%;
          }

          .prof-events-toolbar {
            grid-template-columns: 1fr;
          }

          .prof-events-search {
            grid-column: auto;
          }

          .prof-events-toolbar > * {
            width: 100%;
          }

          .prof-events-item-footer {
            align-items: flex-start;
            flex-direction: column;
          }

          .prof-events-actions {
            width: 100%;
            justify-content: flex-start;
          }

          .prof-events-form {
            grid-template-columns: 1fr;
            padding: 16px;
          }

          .prof-events-form label.full {
            grid-column: auto;
          }

          .prof-events-detail-grid {
            grid-template-columns: 1fr;
          }

          .prof-events-modal-footer {
            flex-direction: column-reverse;
            padding: 14px 16px 17px;
          }

          .prof-events-modal-footer button {
            width: 100%;
          }

          .prof-events-attachment {
            align-items: flex-start;
            flex-direction: column;
          }

          .prof-events-attachment-actions {
            width: 100%;
          }

          .prof-events-attachment-actions a,
          .prof-events-attachment-actions button {
            flex: 1;
          }
        }

        @media (max-width: 430px) {
          .prof-events-stats {
            grid-template-columns: 1fr;
          }

          .prof-events-detail-body {
            padding: 16px;
          }

          .prof-events-modal-head {
            padding: 17px 16px;
          }
        }
      `}</style>

      <main className="prof-events-page">
        <header className="prof-events-header">
          <div>
            <span className="prof-events-eyebrow">
              PROFESSOR WORKSPACE
            </span>
            <h1>Events</h1>
            <p>
              Create and manage academic events for your
              institution. Professor-created events start as
              drafts and are published by an administrator.
            </p>
          </div>

          <button
            type="button"
            className="prof-events-primary"
            onClick={openCreate}
          >
            <Plus size={16} />
            Create Event
          </button>
        </header>

        {error && (
          <div className="prof-events-alert">
            <span>{error}</span>

            <button
              type="button"
              className="prof-events-icon"
              onClick={() => setError("")}
              aria-label="Close error"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {notice && (
          <div className="prof-events-notice">
            {notice}
          </div>
        )}

        <section className="prof-events-stats">
          <div className="prof-events-stat">
            <span>Total Events</span>
            <strong>{totalCount}</strong>
          </div>

          <div className="prof-events-stat">
            <span>Published</span>
            <strong>{publishedCount}</strong>
          </div>

          <div className="prof-events-stat">
            <span>Upcoming</span>
            <strong>{upcomingCount}</strong>
          </div>

          <div className="prof-events-stat">
            <span>Drafts</span>
            <strong>{draftCount}</strong>
          </div>
        </section>

        <section className="prof-events-toolbar">
          <div className="prof-events-search">
            <Search size={15} />

            <input
              className="prof-events-input"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search title, venue, organizer..."
            />
          </div>

          <select
            className="prof-events-select"
            value={status}
            onChange={(event) =>
              setStatus(
                event.target.value as
                  | "ALL"
                  | "PUBLISHED"
                  | "DRAFT",
              )
            }
          >
            <option value="ALL">All Status</option>
            <option value="PUBLISHED">Published</option>
            <option value="DRAFT">Draft</option>
          </select>

          <select
            className="prof-events-select"
            value={type}
            onChange={(event) =>
              setType(event.target.value)
            }
          >
            <option value="ALL">All Types</option>

            {eventTypes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="prof-events-secondary"
            onClick={() => void loadEvents()}
            disabled={loading}
          >
            <RefreshCw size={14} />
            {loading ? "Loading..." : "Refresh"}
          </button>
        </section>

        <section className="prof-events-card">
          <div className="prof-events-card-head">
            <div>
              <h2>Institution Events</h2>
              <span>
                {filteredEvents.length} event
                {filteredEvents.length === 1
                  ? ""
                  : "s"}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="prof-events-empty">
              Loading events...
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="prof-events-empty">
              <strong>No events found</strong>
              {events.length === 0
                ? "Create your first academic event."
                : "Try changing your search or filters."}
            </div>
          ) : (
            <div className="prof-events-list">
              {filteredEvents.map((event) => (
                <article
                  key={event.id}
                  className="prof-events-item"
                >
                  <div className="prof-events-item-top">
                    <span className="prof-events-type">
                      {event.event_type}
                    </span>

                    <span
                      className={`prof-events-badge ${
                        event.is_published
                          ? "published"
                          : "draft"
                      }`}
                    >
                      {event.is_published
                        ? "PUBLISHED"
                        : "DRAFT"}
                    </span>
                  </div>

                  <h3>{event.title}</h3>

                  <p className="prof-events-description">
                    {event.description}
                  </p>

                  <div className="prof-events-meta">
                    <div className="prof-events-meta-row">
                      <CalendarDays size={13} />
                      <span>
                        {formatDate(
                          event.start_datetime,
                        )}
                      </span>
                    </div>

                    <div className="prof-events-meta-row">
                      <Clock3 size={13} />
                      <span>
                        Ends{" "}
                        {formatDate(
                          event.end_datetime,
                        )}
                      </span>
                    </div>

                    <div className="prof-events-meta-row">
                      <MapPin size={13} />
                      <span>
                        {event.venue ||
                          "Venue not specified"}
                      </span>
                    </div>

                    <div className="prof-events-meta-row">
                      <Users size={13} />
                      <span>
                        {event.organizer ||
                          "Organizer not specified"}
                      </span>
                    </div>
                  </div>

                  <div className="prof-events-item-footer">
                    <span className="prof-events-deadline">
                      {event.registration_deadline
                        ? `Registration closes ${formatDate(
                            event.registration_deadline,
                          )}`
                        : "No registration deadline"}
                    </span>

                    <div className="prof-events-actions">
                      <button
                        type="button"
                        onClick={() =>
                          void openDetails(event)
                        }
                      >
                        View
                      </button>

                      {canManage(event) && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              openEdit(event)
                            }
                          >
                            <Pencil size={10} />
                            Edit
                          </button>

                          <button
                            type="button"
                            className="danger"
                            disabled={
                              deletingId === event.id
                            }
                            onClick={() =>
                              void deleteEvent(event)
                            }
                          >
                            <Trash2 size={10} />
                            {deletingId === event.id
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      {detailOpen && selectedEvent && (
        <div
          className="prof-events-overlay"
          onMouseDown={() => setDetailOpen(false)}
        >
          <section
            className="prof-events-detail"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="prof-events-modal-head">
              <div>
                <span className="prof-events-eyebrow">
                  EVENT DETAILS
                </span>

                <h2>{selectedEvent.title}</h2>
              </div>

              <button
                type="button"
                className="prof-events-icon"
                onClick={() => setDetailOpen(false)}
                aria-label="Close event details"
              >
                <X size={16} />
              </button>
            </div>

            <div className="prof-events-detail-body">
              <p className="prof-events-detail-description">
                {selectedEvent.description}
              </p>

              <div className="prof-events-detail-grid">
                <div className="prof-events-detail-cell">
                  <span>Event Type</span>
                  <strong>
                    {selectedEvent.event_type}
                  </strong>
                </div>

                <div className="prof-events-detail-cell">
                  <span>Status</span>
                  <strong>
                    {selectedEvent.is_published
                      ? "Published"
                      : "Draft — waiting for admin publication"}
                  </strong>
                </div>

                <div className="prof-events-detail-cell">
                  <span>Starts</span>
                  <strong>
                    {formatDate(
                      selectedEvent.start_datetime,
                    )}
                  </strong>
                </div>

                <div className="prof-events-detail-cell">
                  <span>Ends</span>
                  <strong>
                    {formatDate(
                      selectedEvent.end_datetime,
                    )}
                  </strong>
                </div>

                <div className="prof-events-detail-cell">
                  <span>Venue</span>
                  <strong>
                    {selectedEvent.venue || "—"}
                  </strong>
                </div>

                <div className="prof-events-detail-cell">
                  <span>Organizer</span>
                  <strong>
                    {selectedEvent.organizer || "—"}
                  </strong>
                </div>

                <div className="prof-events-detail-cell">
                  <span>Registration Deadline</span>
                  <strong>
                    {formatDate(
                      selectedEvent.registration_deadline,
                    )}
                  </strong>
                </div>

                <div className="prof-events-detail-cell">
                  <span>Target Program ID</span>
                  <strong>
                    {selectedEvent.target_program_id ??
                      "All programs"}
                  </strong>
                </div>

                <div className="prof-events-detail-cell">
                  <span>Target Section ID</span>
                  <strong>
                    {selectedEvent.target_section_id ??
                      "All sections"}
                  </strong>
                </div>

                <div className="prof-events-detail-cell">
                  <span>Target Year</span>
                  <strong>
                    {selectedEvent.target_year ??
                      "All years"}
                  </strong>
                </div>

                <div className="prof-events-detail-cell">
                  <span>Registration Link</span>

                  {selectedEvent.registration_link ? (
                    <a
                      href={
                        selectedEvent.registration_link
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open registration
                      <ExternalLink
                        size={11}
                        style={{
                          marginLeft: 4,
                          verticalAlign: "middle",
                        }}
                      />
                    </a>
                  ) : (
                    <strong>Not provided</strong>
                  )}
                </div>
              </div>

              <div className="prof-events-attachments">
                <h3>Attachments</h3>

                {selectedAttachments.length === 0 ? (
                  <div
                    style={{
                      color: "#687793",
                      fontSize: 10,
                    }}
                  >
                    No attachments.
                  </div>
                ) : (
                  selectedAttachments.map(
                    (item) => (
                      <div
                        className="prof-events-attachment"
                        key={item.id}
                      >
                        <div className="prof-events-attachment-name">
                          {item.file_name}
                          <small>
                            {item.file_type || "File"}
                            {item.file_size
                              ? ` · ${formatFileSize(
                                  item.file_size,
                                )}`
                              : ""}
                          </small>
                        </div>

                        <div className="prof-events-attachment-actions">
                          <a
                            href={attachmentUrl(
                              item.id,
                            )}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Download size={10} />
                            Open
                          </a>

                          {canManage(
                            selectedEvent,
                          ) && (
                            <button
                              type="button"
                              onClick={() =>
                                void deleteAttachment(
                                  item,
                                )
                              }
                            >
                              <Trash2 size={10} />
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    ),
                  )
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {modalOpen && (
        <div
          className="prof-events-overlay"
          onMouseDown={() => {
            if (!saving) {
              setModalOpen(false);
            }
          }}
        >
          <section
            className="prof-events-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="prof-events-modal-head">
              <div>
                <span className="prof-events-eyebrow">
                  {editingId !== null
                    ? "UPDATE EVENT"
                    : "NEW ACADEMIC EVENT"}
                </span>

                <h2>
                  {editingId !== null
                    ? "Edit Event"
                    : "Create Event"}
                </h2>
              </div>

              <button
                type="button"
                className="prof-events-icon"
                onClick={() => {
                  if (!saving) {
                    setModalOpen(false);
                  }
                }}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="prof-events-form">
              <label>
                Event Title
                <input
                  value={form.title}
                  onChange={(event) =>
                    updateForm(
                      "title",
                      event.target.value,
                    )
                  }
                  placeholder="e.g. AI & Robotics Seminar"
                  maxLength={255}
                />
              </label>

              <label>
                Event Type
                <select
                  className="prof-events-select"
                  value={form.event_type}
                  onChange={(event) =>
                    updateForm(
                      "event_type",
                      event.target.value,
                    )
                  }
                >
                  {eventTypes.map((item) => (
                    <option
                      key={item}
                      value={item}
                    >
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label className="full">
                Description
                <textarea
                  rows={5}
                  value={form.description}
                  onChange={(event) =>
                    updateForm(
                      "description",
                      event.target.value,
                    )
                  }
                  placeholder="Describe the event..."
                />
              </label>

              <label>
                Start Date & Time
                <input
                  type="datetime-local"
                  value={form.start_datetime}
                  onChange={(event) =>
                    updateForm(
                      "start_datetime",
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                End Date & Time
                <input
                  type="datetime-local"
                  value={form.end_datetime}
                  onChange={(event) =>
                    updateForm(
                      "end_datetime",
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                Venue
                <input
                  value={form.venue}
                  onChange={(event) =>
                    updateForm(
                      "venue",
                      event.target.value,
                    )
                  }
                  placeholder="Seminar Hall / Room 204"
                  maxLength={255}
                />
              </label>

              <label>
                Organizer
                <input
                  value={form.organizer}
                  onChange={(event) =>
                    updateForm(
                      "organizer",
                      event.target.value,
                    )
                  }
                  placeholder="Department / Club"
                  maxLength={255}
                />
              </label>

              <label>
                Registration Deadline
                <input
                  type="datetime-local"
                  value={
                    form.registration_deadline
                  }
                  onChange={(event) =>
                    updateForm(
                      "registration_deadline",
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                Registration Link
                <input
                  type="url"
                  value={form.registration_link}
                  onChange={(event) =>
                    updateForm(
                      "registration_link",
                      event.target.value,
                    )
                  }
                  placeholder="https://..."
                />
              </label>

              <label>
                Target Program ID
                <input
                  type="number"
                  min="1"
                  value={form.target_program_id}
                  onChange={(event) =>
                    updateForm(
                      "target_program_id",
                      event.target.value,
                    )
                  }
                  placeholder="Optional — all programs if empty"
                />
              </label>

              <label>
                Target Section ID
                <input
                  type="number"
                  min="1"
                  value={form.target_section_id}
                  onChange={(event) =>
                    updateForm(
                      "target_section_id",
                      event.target.value,
                    )
                  }
                  placeholder="Optional"
                />
              </label>

              <label>
                Target Year
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={form.target_year}
                  onChange={(event) =>
                    updateForm(
                      "target_year",
                      event.target.value,
                    )
                  }
                  placeholder="Optional — 1 to 10"
                />
              </label>

              <label className="full">
                Event Attachment
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.pdf,.ppt,.pptx,.doc,.docx"
                  onChange={(event) =>
                    setAttachment(
                      event.target.files?.[0] ??
                        null,
                    )
                  }
                />

                <small>
                  Optional. JPG, PNG, WEBP, PDF,
                  PPT, PPTX, DOC or DOCX. Maximum 10 MB.
                </small>

                {attachment && (
                  <small>
                    Selected: {attachment.name}
                  </small>
                )}
              </label>
            </div>

            <div className="prof-events-modal-footer">
              <button
                type="button"
                className="prof-events-secondary"
                onClick={() =>
                  setModalOpen(false)
                }
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="button"
                className="prof-events-primary"
                onClick={() =>
                  void saveEvent()
                }
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingId !== null
                    ? "Update Event"
                    : "Create Event"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
