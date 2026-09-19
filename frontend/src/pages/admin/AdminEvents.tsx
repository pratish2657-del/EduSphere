import { useEffect, useMemo, useState } from "react";
import "./admin-events.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

/* ============================================================
   TYPES
============================================================ */

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

type EventMutationResponse = {
  message: string;
  event_id: number;
  is_published?: boolean;
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

/* ============================================================
   EMPTY FORM
============================================================ */

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

/* ============================================================
   API HELPER
============================================================ */

async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();

  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Response wasn't JSON.
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    if (data?.detail) {
      if (typeof data.detail === "string") {
        message = data.detail;
      } else if (Array.isArray(data.detail)) {
        message = data.detail
          .map((item: any) => {
            if (typeof item === "string") {
              return item;
            }

            if (item?.msg) {
              const location = Array.isArray(item.loc)
                ? item.loc.join(" → ")
                : "";

              return location
                ? `${location}: ${item.msg}`
                : item.msg;
            }

            return JSON.stringify(item);
          })
          .join("\n");
      } else if (typeof data.detail === "object") {
        message =
          data.detail.message ||
          data.detail.msg ||
          JSON.stringify(data.detail);
      }
    } else if (data?.message) {
      message =
        typeof data.message === "string"
          ? data.message
          : JSON.stringify(data.message);
    } else if (text) {
      message = text;
    }

    throw new Error(message);
  }

  return data as T;
}

/* ============================================================
   DATE / TIME HELPERS

   IMPORTANT:
   DO NOT use new Date(value).toISOString() here.

   datetime-local gives:
       2026-09-17T12:00

   We want to send exactly:
       2026-09-17T12:00

   instead of converting it to UTC.
============================================================ */

function toApiDateTime(value: string) {
  return value || null;
}

function toInputDateTime(value?: string | null) {
  if (!value) {
    return "";
  }

  /*
   * Backend normally returns:
   * 2026-09-17T12:00:00
   *
   * Could also return:
   * 2026-09-17T12:00:00.000
   *
   * Or:
   * 2026-09-17T12:00:00Z
   *
   * We intentionally do NOT create a Date object.
   * This prevents timezone conversion.
   */

  let result = value;

  // Remove UTC suffix if present.
  result = result.replace(/Z$/, "");

  // Remove timezone offset if present.
  result = result.replace(/[+-]\d{2}:\d{2}$/, "");

  // Remove milliseconds.
  result = result.replace(/\.\d+$/, "");

  // datetime-local requires YYYY-MM-DDTHH:mm
  return result.slice(0, 16);
}

/* ============================================================
   DISPLAY DATE
============================================================ */

function formatDate(value?: string | null) {
  if (!value) {
    return "—";
  }

  const raw = String(value).trim();
  const hasTimezone = /(?:Z|[+-]\\d{2}:?\\d{2})$/i.test(raw);

  /*
   * Event datetime values without a timezone are EduSphere's stored
   * local event times. Treat them explicitly as IST instead of using
   * the browser's local timezone.
   *
   * Values that already contain a timezone are converted to IST.
   */
  const normalized =
    !hasTimezone &&
    /^\\d{4}-\\d{2}-\\d{2}[ T]\\d{2}:\\d{2}/.test(raw)
      ? `${raw.replace(" ", "T")}:00+05:30`
      : raw;

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/* ============================================================
   CONVERT EVENT TO FORM
============================================================ */

function eventFormFromItem(
  event: EventItem
): FormState {
  return {
    title: event.title ?? "",

    description:
      event.description ?? "",

    event_type:
      event.event_type ?? "SEMINAR",

    start_datetime:
      toInputDateTime(
        event.start_datetime
      ),

    end_datetime:
      toInputDateTime(
        event.end_datetime
      ),

    venue:
      event.venue ?? "",

    organizer:
      event.organizer ?? "",

    registration_deadline:
      toInputDateTime(
        event.registration_deadline
      ),

    registration_link:
      event.registration_link ?? "",

    target_program_id:
      event.target_program_id != null
        ? String(event.target_program_id)
        : "",

    target_section_id:
      event.target_section_id != null
        ? String(event.target_section_id)
        : "",

    target_year:
      event.target_year != null
        ? String(event.target_year)
        : "",
  };
}

/* ============================================================
   MAIN COMPONENT
============================================================ */

export default function AdminEvents() {
  const [events, setEvents] =
    useState<EventItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [status, setStatus] =
    useState("ALL");

  const [type, setType] =
    useState("ALL");

  const [modalOpen, setModalOpen] =
    useState(false);

  const [editingId, setEditingId] =
    useState<number | null>(null);

  const [form, setForm] =
    useState<FormState>({
      ...emptyForm,
    });

  const [selectedEvent, setSelectedEvent] =
    useState<EventItem | null>(null);

  const [attachment, setAttachment] =
    useState<File | null>(null);

  /* ============================================================
     LOAD EVENTS
  ============================================================ */

  const loadEvents = async () => {
    setLoading(true);
    setError("");

    try {
      const data =
        await api<EventsResponse>(
          "/events/"
        );

      setEvents(
        Array.isArray(data.events)
          ? data.events
          : []
      );
    } catch (err) {
      console.error(
        "Load events error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load events."
      );
    } finally {
      setLoading(false);
    }
  };

  /* ============================================================
     INITIAL LOAD
  ============================================================ */

  useEffect(() => {
    loadEvents();
  }, []);

  /* ============================================================
     EVENT TYPES
  ============================================================ */

  const eventTypes = useMemo(() => {
    return Array.from(
      new Set(
        events
          .map(
            (event) =>
              event.event_type
          )
          .filter(Boolean)
      )
    ).sort();
  }, [events]);

  /* ============================================================
     FILTER EVENTS
  ============================================================ */

  const filteredEvents = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return events.filter((event) => {
      const matchesSearch =
        !query ||
        [
          event.title,
          event.description,
          event.venue,
          event.organizer,
          event.event_type,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        status === "ALL" ||
        (status === "PUBLISHED"
          ? event.is_published
          : !event.is_published);

      const matchesType =
        type === "ALL" ||
        event.event_type === type;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesType
      );
    });
  }, [
    events,
    search,
    status,
    type,
  ]);

  /* ============================================================
     OPEN CREATE
  ============================================================ */

  const openCreate = () => {
    setError("");

    setSelectedEvent(null);

    setEditingId(null);

    setForm({
      ...emptyForm,
    });

    setAttachment(null);

    setModalOpen(true);
  };

  /* ============================================================
     OPEN EDIT
  ============================================================ */

  const openEdit = (
    event: EventItem
  ) => {
    console.log(
      "Opening edit event:",
      event
    );

    setError("");

    setSelectedEvent(null);

    setEditingId(event.id);

    setForm(
      eventFormFromItem(event)
    );

    setAttachment(null);

    setModalOpen(true);
  };

  /* ============================================================
     CLOSE MODAL
  ============================================================ */

  const closeModal = () => {
    if (saving) {
      return;
    }

    setModalOpen(false);

    setEditingId(null);

    setForm({
      ...emptyForm,
    });

    setAttachment(null);
  };

  /* ============================================================
     UPDATE FORM
  ============================================================ */

  const updateForm = (
    key: keyof FormState,
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  /* ============================================================
     BUILD PAYLOAD
  ============================================================ */

  const buildPayload = () => {
    /* --------------------------------------------------------
       REQUIRED FIELDS
    -------------------------------------------------------- */

    if (!form.title.trim()) {
      throw new Error(
        "Event title is required."
      );
    }

    if (!form.description.trim()) {
      throw new Error(
        "Description is required."
      );
    }

    if (!form.event_type.trim()) {
      throw new Error(
        "Event type is required."
      );
    }

    if (!form.start_datetime) {
      throw new Error(
        "Start date and time are required."
      );
    }

    if (!form.end_datetime) {
      throw new Error(
        "End date and time are required."
      );
    }

    /* --------------------------------------------------------
       DATE COMPARISON WITHOUT UTC CONVERSION
    -------------------------------------------------------- */

    const startDate = new Date(
      `${form.start_datetime}:00+05:30`
    );

    const endDate = new Date(
      `${form.end_datetime}:00+05:30`
    );

    if (
      Number.isNaN(
        startDate.getTime()
      ) ||
      Number.isNaN(
        endDate.getTime()
      )
    ) {
      throw new Error(
        "Invalid event date or time."
      );
    }

    if (startDate >= endDate) {
      throw new Error(
        "Event start time must be before end time."
      );
    }

    /* --------------------------------------------------------
       REGISTRATION DEADLINE
    -------------------------------------------------------- */

    if (
      form.registration_deadline
    ) {
      const deadlineDate =
        new Date(
          `${form.registration_deadline}:00+05:30`
        );

      if (
        deadlineDate > startDate
      ) {
        throw new Error(
          "Registration deadline cannot be after event start."
        );
      }
    }

    /* --------------------------------------------------------
       REGISTRATION LINK
    -------------------------------------------------------- */

    if (
      form.registration_link.trim()
    ) {
      if (
        !/^https?:\/\/.+/i.test(
          form.registration_link.trim()
        )
      ) {
        throw new Error(
          "Registration link must start with http:// or https://"
        );
      }
    }

    /* --------------------------------------------------------
       PAYLOAD
    -------------------------------------------------------- */

    return {
      title:
        form.title.trim(),

      description:
        form.description.trim(),

      event_type:
        form.event_type.trim(),

      /*
       * IMPORTANT:
       * Keep local date/time exactly as selected.
       */
      start_datetime:
        toApiDateTime(
          form.start_datetime
        ),

      end_datetime:
        toApiDateTime(
          form.end_datetime
        ),

      venue:
        form.venue.trim(),

      organizer:
        form.organizer.trim(),

      registration_deadline:
        form.registration_deadline
          ? toApiDateTime(
              form.registration_deadline
            )
          : null,

      registration_link:
        form.registration_link.trim() ||
        null,

      target_program_id:
        form.target_program_id
          ? Number(
              form.target_program_id
            )
          : null,

      target_section_id:
        form.target_section_id
          ? Number(
              form.target_section_id
            )
          : null,

      target_year:
        form.target_year
          ? Number(
              form.target_year
            )
          : null,
    };
  };

  /* ============================================================
     SAVE / UPDATE EVENT
  ============================================================ */

  const saveEvent = async () => {
    setSaving(true);
    setError("");

    try {
      const payload =
        buildPayload();

      console.log(
        editingId
          ? `Updating event ${editingId}`
          : "Creating event"
      );

      console.log(
        "Payload:",
        payload
      );

      /* --------------------------------------------------------
         CREATE OR UPDATE
      -------------------------------------------------------- */

      const result =
        await api<EventMutationResponse>(
          editingId
            ? `/events/${editingId}`
            : "/events/",
          {
            method: editingId
              ? "PUT"
              : "POST",

            body: JSON.stringify(
              payload
            ),
          }
        );

      console.log(
        "Event response:",
        result
      );

      /* --------------------------------------------------------
         BACKEND RETURNS event_id
      -------------------------------------------------------- */

      const eventId =
        result.event_id;

      if (!eventId) {
        throw new Error(
          "Event was saved but the server did not return an event ID."
        );
      }

      /* --------------------------------------------------------
         ATTACHMENT
      -------------------------------------------------------- */

      if (attachment) {
        const body =
          new FormData();

        body.append(
          "file",
          attachment
        );

        const response =
          await fetch(
            `${API_BASE_URL}/events/${eventId}/attachments`,
            {
              method: "POST",
              credentials: "include",
              body,
            }
          );

        const text =
          await response.text();

        if (!response.ok) {
          let message =
            "Attachment upload failed.";

          try {
            const data =
              text
                ? JSON.parse(text)
                : null;

            if (
              typeof data?.detail ===
              "string"
            ) {
              message =
                data.detail;
            } else if (
              Array.isArray(
                data?.detail
              )
            ) {
              message =
                data.detail
                  .map(
                    (item: any) =>
                      item?.msg ||
                      String(item)
                  )
                  .join("\n");
            }
          } catch {
            if (text) {
              message = text;
            }
          }

          throw new Error(
            `Event saved, but ${message}`
          );
        }
      }

      /* --------------------------------------------------------
         RESET
      -------------------------------------------------------- */

      setModalOpen(false);

      setEditingId(null);

      setForm({
        ...emptyForm,
      });

      setAttachment(null);

      /* --------------------------------------------------------
         REFRESH
      -------------------------------------------------------- */

      await loadEvents();

    } catch (err) {
      console.error(
        "Save event error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to save event."
      );
    } finally {
      setSaving(false);
    }
  };

  /* ============================================================
     DELETE EVENT
  ============================================================ */

  const deleteEvent = async (
    event: EventItem
  ) => {
    const confirmed =
      window.confirm(
        `Delete "${event.title}"?`
      );

    if (!confirmed) {
      return;
    }

    setError("");

    try {
      await api(
        `/events/${event.id}`,
        {
          method: "DELETE",
        }
      );

      if (
        selectedEvent?.id ===
        event.id
      ) {
        setSelectedEvent(null);
      }

      await loadEvents();

    } catch (err) {
      console.error(
        "Delete event error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete event."
      );
    }
  };

  /* ============================================================
     PUBLISH / UNPUBLISH
  ============================================================ */

  const togglePublished = async (
    event: EventItem
  ) => {
    setError("");

    try {
      await api(
        `/events/${event.id}/publish`,
        {
          method: "PUT",

          body: JSON.stringify({
            is_published:
              !event.is_published,
          }),
        }
      );

      await loadEvents();

    } catch (err) {
      console.error(
        "Publish status error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to change publish status."
      );
    }
  };

  /* ============================================================
     STATISTICS
  ============================================================ */

  const publishedCount =
    events.filter(
      (event) =>
        event.is_published
    ).length;

  const upcomingCount =
    events.filter((event) => {
      const value =
        event.start_datetime;

      if (!value) {
        return false;
      }

      const input = toInputDateTime(value);
      const hasTimezone =
        /(?:Z|[+-]\\d{2}:?\\d{2})$/i.test(input);

      const date = new Date(
        hasTimezone
          ? input
          : `${input}:00+05:30`
      );

      return (
        !Number.isNaN(
          date.getTime()
        ) &&
        date.getTime() >=
          Date.now()
      );
    }).length;

  const draftCount =
    events.length -
    publishedCount;

  /* ============================================================
     RENDER
  ============================================================ */

  return (
    <div className="admin-events-page">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <header className="admin-events-header">

        <div>

          <div className="admin-events-eyebrow">
            EDUSPHERE ADMIN
          </div>

          <h1>
            Events Management
          </h1>

          <p>
            Create, manage, publish and organize
            institution events.
          </p>

        </div>

        <button
          className="admin-events-primary"
          onClick={openCreate}
        >
          + Create Event
        </button>

      </header>

      {/* ======================================================
          ERROR
      ====================================================== */}

      {error && (
        <div className="admin-events-alert">

          <span
            style={{
              whiteSpace:
                "pre-line",
            }}
          >
            {error}
          </span>

          <button
            onClick={() =>
              setError("")
            }
          >
            ×
          </button>

        </div>
      )}

      {/* ======================================================
          STATS
      ====================================================== */}

      <section className="admin-events-stats">

        <div className="admin-events-stat">

          <span>
            Total Events
          </span>

          <strong>
            {events.length}
          </strong>

        </div>

        <div className="admin-events-stat">

          <span>
            Published
          </span>

          <strong>
            {publishedCount}
          </strong>

        </div>

        <div className="admin-events-stat">

          <span>
            Upcoming
          </span>

          <strong>
            {upcomingCount}
          </strong>

        </div>

        <div className="admin-events-stat">

          <span>
            Drafts
          </span>

          <strong>
            {draftCount}
          </strong>

        </div>

      </section>

      {/* ======================================================
          TOOLBAR
      ====================================================== */}

      <section className="admin-events-toolbar">

        <input
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value
            )
          }
          placeholder="Search title, venue, organizer..."
        />

        <select
          value={status}
          onChange={(event) =>
            setStatus(
              event.target.value
            )
          }
        >

          <option value="ALL">
            All Status
          </option>

          <option value="PUBLISHED">
            Published
          </option>

          <option value="DRAFT">
            Draft
          </option>

        </select>

        <select
          value={type}
          onChange={(event) =>
            setType(
              event.target.value
            )
          }
        >

          <option value="ALL">
            All Types
          </option>

          {eventTypes.map(
            (item) => (
              <option
                key={item}
                value={item}
              >
                {item}
              </option>
            )
          )}

        </select>

        <button
          className="admin-events-refresh"
          onClick={loadEvents}
          disabled={loading}
        >
          {loading
            ? "Loading..."
            : "Refresh"}
        </button>

      </section>

      {/* ======================================================
          EVENTS TABLE
      ====================================================== */}

      <section className="admin-events-card">

        <div className="admin-events-card-title">

          <div>

            <h2>
              Institution Events
            </h2>

            <span>
              {filteredEvents.length} event(s)
            </span>

          </div>

        </div>

        {loading ? (

          <div className="admin-events-empty">
            Loading events...
          </div>

        ) : filteredEvents.length === 0 ? (

          <div className="admin-events-empty">
            No events found. Create your
            first event.
          </div>

        ) : (

          <div className="admin-events-table-wrap">

            <table className="admin-events-table">

              <thead>

                <tr>

                  <th>
                    Event
                  </th>

                  <th>
                    Schedule
                  </th>

                  <th>
                    Venue
                  </th>

                  <th>
                    Organizer
                  </th>

                  <th>
                    Status
                  </th>

                  <th>
                    Actions
                  </th>

                </tr>

              </thead>

              <tbody>

                {filteredEvents.map(
                  (event) => (

                    <tr
                      key={event.id}
                    >

                      {/* EVENT */}

                      <td>

                        <button
                          className="admin-events-name"
                          onClick={() =>
                            setSelectedEvent(
                              event
                            )
                          }
                        >
                          {event.title}
                        </button>

                        <small>
                          {event.event_type}
                        </small>

                      </td>

                      {/* SCHEDULE */}

                      <td>

                        <div>
                          {formatDate(
                            event.start_datetime
                          )}
                        </div>

                        <small>
                          Ends{" "}
                          {formatDate(
                            event.end_datetime
                          )}
                        </small>

                      </td>

                      {/* VENUE */}

                      <td>
                        {event.venue ||
                          "—"}
                      </td>

                      {/* ORGANIZER */}

                      <td>
                        {event.organizer ||
                          "—"}
                      </td>

                      {/* STATUS */}

                      <td>

                        <span
                          className={
                            event.is_published
                              ? "admin-events-badge published"
                              : "admin-events-badge draft"
                          }
                        >
                          {event.is_published
                            ? "PUBLISHED"
                            : "DRAFT"}
                        </span>

                      </td>

                      {/* ACTIONS */}

                      <td>

                        <div className="admin-events-actions">

                          <button
                            onClick={() =>
                              openEdit(
                                event
                              )
                            }
                          >
                            Edit
                          </button>

                          <button
                            onClick={() =>
                              togglePublished(
                                event
                              )
                            }
                          >
                            {event.is_published
                              ? "Unpublish"
                              : "Publish"}
                          </button>

                          <button
                            className="danger"
                            onClick={() =>
                              deleteEvent(
                                event
                              )
                            }
                          >
                            Delete
                          </button>

                        </div>

                      </td>

                    </tr>

                  )
                )}

              </tbody>

            </table>

          </div>

        )}

      </section>

      {/* ======================================================
          EVENT DETAILS
      ====================================================== */}

      {selectedEvent && (

        <div
          className="admin-events-overlay"
          onMouseDown={() =>
            setSelectedEvent(null)
          }
        >

          <div
            className="admin-events-detail"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >

            <div className="admin-events-modal-head">

              <div>

                <span className="admin-events-eyebrow">
                  EVENT DETAILS
                </span>

                <h2>
                  {selectedEvent.title}
                </h2>

              </div>

              <button
                onClick={() =>
                  setSelectedEvent(null)
                }
              >
                ×
              </button>

            </div>

            <p>
              {selectedEvent.description}
            </p>

            <div className="admin-events-detail-grid">

              <div>
                <span>
                  Type
                </span>

                <strong>
                  {selectedEvent.event_type}
                </strong>
              </div>

              <div>
                <span>
                  Status
                </span>

                <strong>
                  {selectedEvent.is_published
                    ? "Published"
                    : "Draft"}
                </strong>
              </div>

              <div>
                <span>
                  Starts
                </span>

                <strong>
                  {formatDate(
                    selectedEvent.start_datetime
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Ends
                </span>

                <strong>
                  {formatDate(
                    selectedEvent.end_datetime
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Venue
                </span>

                <strong>
                  {selectedEvent.venue ||
                    "—"}
                </strong>
              </div>

              <div>
                <span>
                  Organizer
                </span>

                <strong>
                  {selectedEvent.organizer ||
                    "—"}
                </strong>
              </div>

              <div>
                <span>
                  Registration Deadline
                </span>

                <strong>
                  {formatDate(
                    selectedEvent.registration_deadline
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Registration Link
                </span>

                <strong>
                  {selectedEvent.registration_link ||
                    "—"}
                </strong>
              </div>

            </div>

          </div>

        </div>

      )}

      {/* ======================================================
          CREATE / EDIT MODAL
      ====================================================== */}

      {modalOpen && (

        <div
          className="admin-events-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeModal();
            }
          }}
        >

          <div className="admin-events-modal">

            {/* MODAL HEADER */}

            <div className="admin-events-modal-head">

              <div>

                <span className="admin-events-eyebrow">

                  {editingId
                    ? "UPDATE EVENT"
                    : "NEW EVENT"}

                </span>

                <h2>

                  {editingId
                    ? "Edit Event"
                    : "Create Event"}

                </h2>

              </div>

              <button
                onClick={closeModal}
                disabled={saving}
              >
                ×
              </button>

            </div>

            {/* ==================================================
                FORM
            ================================================== */}

            <div className="admin-events-form">

              {/* TITLE */}

              <label>

                Event Title

                <input
                  value={form.title}
                  onChange={(e) =>
                    updateForm(
                      "title",
                      e.target.value
                    )
                  }
                  placeholder="e.g. Tech Fest 2026"
                />

              </label>

              {/* TYPE */}

              <label>

                Event Type

                <input
                  value={
                    form.event_type
                  }
                  onChange={(e) =>
                    updateForm(
                      "event_type",
                      e.target.value
                    )
                  }
                  placeholder="SEMINAR"
                />

              </label>

              {/* DESCRIPTION */}

              <label className="full">

                Description

                <textarea
                  rows={4}
                  value={
                    form.description
                  }
                  onChange={(e) =>
                    updateForm(
                      "description",
                      e.target.value
                    )
                  }
                  placeholder="Describe the event..."
                />

              </label>

              {/* START */}

              <label>

                Start Date & Time

                <input
                  type="datetime-local"
                  value={
                    form.start_datetime
                  }
                  onChange={(e) =>
                    updateForm(
                      "start_datetime",
                      e.target.value
                    )
                  }
                />

              </label>

              {/* END */}

              <label>

                End Date & Time

                <input
                  type="datetime-local"
                  value={
                    form.end_datetime
                  }
                  onChange={(e) =>
                    updateForm(
                      "end_datetime",
                      e.target.value
                    )
                  }
                />

              </label>

              {/* VENUE */}

              <label>

                Venue

                <input
                  value={form.venue}
                  onChange={(e) =>
                    updateForm(
                      "venue",
                      e.target.value
                    )
                  }
                  placeholder="Auditorium"
                />

              </label>

              {/* ORGANIZER */}

              <label>

                Organizer

                <input
                  value={
                    form.organizer
                  }
                  onChange={(e) =>
                    updateForm(
                      "organizer",
                      e.target.value
                    )
                  }
                  placeholder="Department / Club"
                />

              </label>

              {/* DEADLINE */}

              <label>

                Registration Deadline

                <input
                  type="datetime-local"
                  value={
                    form.registration_deadline
                  }
                  onChange={(e) =>
                    updateForm(
                      "registration_deadline",
                      e.target.value
                    )
                  }
                />

              </label>

              {/* REGISTRATION LINK */}

              <label>

                Registration Link

                <input
                  type="url"
                  value={
                    form.registration_link
                  }
                  onChange={(e) =>
                    updateForm(
                      "registration_link",
                      e.target.value
                    )
                  }
                  placeholder="https://..."
                />

              </label>

              {/* PROGRAM */}

              <label>

                Target Program ID

                <input
                  type="number"
                  min="1"
                  value={
                    form.target_program_id
                  }
                  onChange={(e) =>
                    updateForm(
                      "target_program_id",
                      e.target.value
                    )
                  }
                  placeholder="Optional"
                />

              </label>

              {/* SECTION */}

              <label>

                Target Section ID

                <input
                  type="number"
                  min="1"
                  value={
                    form.target_section_id
                  }
                  onChange={(e) =>
                    updateForm(
                      "target_section_id",
                      e.target.value
                    )
                  }
                  placeholder="Optional"
                />

              </label>

              {/* YEAR */}

              <label>

                Target Year

                <input
                  type="number"
                  min="1"
                  max="10"
                  value={
                    form.target_year
                  }
                  onChange={(e) =>
                    updateForm(
                      "target_year",
                      e.target.value
                    )
                  }
                  placeholder="Optional"
                />

              </label>

              {/* ATTACHMENT */}

              <label className="full">

                Attachment

                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.pdf,.ppt,.pptx,.doc,.docx"
                  onChange={(e) =>
                    setAttachment(
                      e.target.files?.[0] ||
                        null
                    )
                  }
                />

                <small>
                  Maximum 10 MB.
                </small>

                {attachment && (
                  <small>
                    Selected:{" "}
                    {attachment.name}
                  </small>
                )}

              </label>

            </div>

            {/* ==================================================
                FOOTER
            ================================================== */}

            <div className="admin-events-modal-footer">

              <button
                className="admin-events-secondary"
                onClick={closeModal}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                className="admin-events-primary"
                onClick={saveEvent}
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update Event"
                    : "Create Event"}
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}