import { useEffect, useMemo, useState } from "react";
import "./admin-events.css";

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

type EventsResponse = {
  count: number;
  events: EventItem[];
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

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const data = await response.json();
      message = data?.detail || message;
    } catch {
      // Keep HTTP fallback.
    }
    throw new Error(message);
  }

  return response.json();
}

function toApiDateTime(value: string) {
  return value ? new Date(value).toISOString() : value;
}

function toInputDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000)
    .toISOString()
    .slice(0, 16);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
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
    registration_deadline: toInputDateTime(event.registration_deadline),
    registration_link: event.registration_link || "",
    target_program_id:
      event.target_program_id == null ? "" : String(event.target_program_id),
    target_section_id:
      event.target_section_id == null ? "" : String(event.target_section_id),
    target_year: event.target_year == null ? "" : String(event.target_year),
  };
}

export default function AdminEvents() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [type, setType] = useState("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [attachment, setAttachment] = useState<File | null>(null);

  const loadEvents = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api<EventsResponse>("/events/");
      setEvents(data.events || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load events.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const eventTypes = useMemo(
    () =>
      Array.from(
        new Set(events.map((event) => event.event_type).filter(Boolean))
      ).sort(),
    [events]
  );

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();

    return events.filter((event) => {
      const matchesSearch =
        !query ||
        [event.title, event.description, event.venue, event.organizer, event.event_type]
          .join(" ")
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        status === "ALL" ||
        (status === "PUBLISHED" ? event.is_published : !event.is_published);

      const matchesType = type === "ALL" || event.event_type === type;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [events, search, status, type]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setAttachment(null);
    setModalOpen(true);
  };

  const openEdit = (event: EventItem) => {
    setEditingId(event.id);
    setForm(eventFormFromItem(event));
    setAttachment(null);
    setModalOpen(true);
  };

  const updateForm = (key: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const buildPayload = () => {
    if (!form.title.trim()) throw new Error("Event title is required.");
    if (!form.description.trim()) throw new Error("Description is required.");
    if (!form.start_datetime || !form.end_datetime)
      throw new Error("Start and end date/time are required.");
    if (new Date(form.start_datetime) >= new Date(form.end_datetime))
      throw new Error("Event start time must be before end time.");

    if (
      form.registration_deadline &&
      new Date(form.registration_deadline) > new Date(form.start_datetime)
    ) {
      throw new Error("Registration deadline cannot be after event start.");
    }

    return {
      title: form.title.trim(),
      description: form.description.trim(),
      event_type: form.event_type.trim(),
      start_datetime: toApiDateTime(form.start_datetime),
      end_datetime: toApiDateTime(form.end_datetime),
      venue: form.venue.trim(),
      organizer: form.organizer.trim(),
      registration_deadline: form.registration_deadline
        ? toApiDateTime(form.registration_deadline)
        : null,
      registration_link: form.registration_link.trim() || null,
      target_program_id: form.target_program_id
        ? Number(form.target_program_id)
        : null,
      target_section_id: form.target_section_id
        ? Number(form.target_section_id)
        : null,
      target_year: form.target_year ? Number(form.target_year) : null,
    };
  };

  const saveEvent = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = buildPayload();
      const event = await api<EventItem>(
        editingId ? `/events/${editingId}` : "/events/",
        {
          method: editingId ? "PUT" : "POST",
          body: JSON.stringify(payload),
        }
      );

      if (attachment && event?.id) {
        const body = new FormData();
        body.append("file", attachment);

        const response = await fetch(
          `${API_BASE_URL}/events/${event.id}/attachments`,
          {
            method: "POST",
            credentials: "include",
            body,
          }
        );

        if (!response.ok) {
          throw new Error("Event saved, but attachment upload failed.");
        }
      }

      setModalOpen(false);
      setAttachment(null);
      await loadEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save event.");
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = async (event: EventItem) => {
    if (!window.confirm(`Delete "${event.title}"?`)) return;

    try {
      await api(`/events/${event.id}`, { method: "DELETE" });
      if (selectedEvent?.id === event.id) setSelectedEvent(null);
      await loadEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete event.");
    }
  };

  const togglePublished = async (event: EventItem) => {
    try {
      await api(`/events/${event.id}/publish`, {
        method: "PUT",
        body: JSON.stringify({ is_published: !event.is_published }),
      });
      await loadEvents();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to change publish status."
      );
    }
  };

  const publishedCount = events.filter((event) => event.is_published).length;
  const upcomingCount = events.filter(
    (event) => new Date(event.start_datetime).getTime() >= Date.now()
  ).length;

  return (
    <div className="admin-events-page">
      <header className="admin-events-header">
        <div>
          <div className="admin-events-eyebrow">EDUSPHERE ADMIN</div>
          <h1>Events Management</h1>
          <p>Create, manage, publish and organize institution events.</p>
        </div>
        <button className="admin-events-primary" onClick={openCreate}>
          + Create Event
        </button>
      </header>

      {error && (
        <div className="admin-events-alert">
          <span>{error}</span>
          <button onClick={() => setError("")}>×</button>
        </div>
      )}

      <section className="admin-events-stats">
        <div className="admin-events-stat">
          <span>Total Events</span>
          <strong>{events.length}</strong>
        </div>
        <div className="admin-events-stat">
          <span>Published</span>
          <strong>{publishedCount}</strong>
        </div>
        <div className="admin-events-stat">
          <span>Upcoming</span>
          <strong>{upcomingCount}</strong>
        </div>
        <div className="admin-events-stat">
          <span>Drafts</span>
          <strong>{events.length - publishedCount}</strong>
        </div>
      </section>

      <section className="admin-events-toolbar">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search title, venue, organizer..."
        />

        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="ALL">All Status</option>
          <option value="PUBLISHED">Published</option>
          <option value="DRAFT">Draft</option>
        </select>

        <select value={type} onChange={(event) => setType(event.target.value)}>
          <option value="ALL">All Types</option>
          {eventTypes.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <button className="admin-events-refresh" onClick={loadEvents}>
          Refresh
        </button>
      </section>

      <section className="admin-events-card">
        <div className="admin-events-card-title">
          <div>
            <h2>Institution Events</h2>
            <span>{filteredEvents.length} event(s)</span>
          </div>
        </div>

        {loading ? (
          <div className="admin-events-empty">Loading events...</div>
        ) : filteredEvents.length === 0 ? (
          <div className="admin-events-empty">
            No events found. Create your first event.
          </div>
        ) : (
          <div className="admin-events-table-wrap">
            <table className="admin-events-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Schedule</th>
                  <th>Venue</th>
                  <th>Organizer</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((event) => (
                  <tr key={event.id}>
                    <td>
                      <button
                        className="admin-events-name"
                        onClick={() => setSelectedEvent(event)}
                      >
                        {event.title}
                      </button>
                      <small>{event.event_type}</small>
                    </td>
                    <td>
                      <div>{formatDate(event.start_datetime)}</div>
                      <small>Ends {formatDate(event.end_datetime)}</small>
                    </td>
                    <td>{event.venue}</td>
                    <td>{event.organizer}</td>
                    <td>
                      <span
                        className={
                          event.is_published
                            ? "admin-events-badge published"
                            : "admin-events-badge draft"
                        }
                      >
                        {event.is_published ? "PUBLISHED" : "DRAFT"}
                      </span>
                    </td>
                    <td>
                      <div className="admin-events-actions">
                        <button onClick={() => openEdit(event)}>Edit</button>
                        <button onClick={() => togglePublished(event)}>
                          {event.is_published ? "Unpublish" : "Publish"}
                        </button>
                        <button
                          className="danger"
                          onClick={() => deleteEvent(event)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedEvent && (
        <div className="admin-events-overlay" onMouseDown={() => setSelectedEvent(null)}>
          <div
            className="admin-events-detail"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="admin-events-modal-head">
              <div>
                <span className="admin-events-eyebrow">EVENT DETAILS</span>
                <h2>{selectedEvent.title}</h2>
              </div>
              <button onClick={() => setSelectedEvent(null)}>×</button>
            </div>
            <p>{selectedEvent.description}</p>
            <div className="admin-events-detail-grid">
              <div><span>Type</span><strong>{selectedEvent.event_type}</strong></div>
              <div><span>Status</span><strong>{selectedEvent.is_published ? "Published" : "Draft"}</strong></div>
              <div><span>Starts</span><strong>{formatDate(selectedEvent.start_datetime)}</strong></div>
              <div><span>Ends</span><strong>{formatDate(selectedEvent.end_datetime)}</strong></div>
              <div><span>Venue</span><strong>{selectedEvent.venue}</strong></div>
              <div><span>Organizer</span><strong>{selectedEvent.organizer}</strong></div>
              <div><span>Registration Deadline</span><strong>{formatDate(selectedEvent.registration_deadline)}</strong></div>
              <div><span>Registration Link</span><strong>{selectedEvent.registration_link || "—"}</strong></div>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="admin-events-overlay">
          <div className="admin-events-modal">
            <div className="admin-events-modal-head">
              <div>
                <span className="admin-events-eyebrow">
                  {editingId ? "UPDATE EVENT" : "NEW EVENT"}
                </span>
                <h2>{editingId ? "Edit Event" : "Create Event"}</h2>
              </div>
              <button onClick={() => setModalOpen(false)}>×</button>
            </div>

            <div className="admin-events-form">
              <label>
                Event Title
                <input
                  value={form.title}
                  onChange={(e) => updateForm("title", e.target.value)}
                  placeholder="e.g. Tech Fest 2026"
                />
              </label>

              <label>
                Event Type
                <input
                  value={form.event_type}
                  onChange={(e) => updateForm("event_type", e.target.value)}
                  placeholder="SEMINAR"
                />
              </label>

              <label className="full">
                Description
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) => updateForm("description", e.target.value)}
                  placeholder="Describe the event..."
                />
              </label>

              <label>
                Start Date & Time
                <input
                  type="datetime-local"
                  value={form.start_datetime}
                  onChange={(e) => updateForm("start_datetime", e.target.value)}
                />
              </label>

              <label>
                End Date & Time
                <input
                  type="datetime-local"
                  value={form.end_datetime}
                  onChange={(e) => updateForm("end_datetime", e.target.value)}
                />
              </label>

              <label>
                Venue
                <input
                  value={form.venue}
                  onChange={(e) => updateForm("venue", e.target.value)}
                  placeholder="Auditorium"
                />
              </label>

              <label>
                Organizer
                <input
                  value={form.organizer}
                  onChange={(e) => updateForm("organizer", e.target.value)}
                  placeholder="Department / Club"
                />
              </label>

              <label>
                Registration Deadline
                <input
                  type="datetime-local"
                  value={form.registration_deadline}
                  onChange={(e) =>
                    updateForm("registration_deadline", e.target.value)
                  }
                />
              </label>

              <label>
                Registration Link
                <input
                  type="url"
                  value={form.registration_link}
                  onChange={(e) => updateForm("registration_link", e.target.value)}
                  placeholder="https://..."
                />
              </label>

              <label>
                Target Program ID
                <input
                  type="number"
                  min="1"
                  value={form.target_program_id}
                  onChange={(e) => updateForm("target_program_id", e.target.value)}
                  placeholder="Optional"
                />
              </label>

              <label>
                Target Section ID
                <input
                  type="number"
                  min="1"
                  value={form.target_section_id}
                  onChange={(e) => updateForm("target_section_id", e.target.value)}
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
                  onChange={(e) => updateForm("target_year", e.target.value)}
                  placeholder="Optional"
                />
              </label>

              <label className="full">
                Attachment
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.pdf,.ppt,.pptx,.doc,.docx"
                  onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                />
                <small>Maximum 10 MB.</small>
              </label>
            </div>

            <div className="admin-events-modal-footer">
              <button
                className="admin-events-secondary"
                onClick={() => setModalOpen(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className="admin-events-primary"
                onClick={saveEvent}
                disabled={saving}
              >
                {saving ? "Saving..." : editingId ? "Update Event" : "Create Event"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
