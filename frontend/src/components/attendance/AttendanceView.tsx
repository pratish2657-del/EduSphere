import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  RefreshCw,
  UserCheck,
  XCircle,
} from "lucide-react";

const API_BASE_URL = "http://localhost:8000";

type AttendanceRecord = {
  id: number;
  student_id: number;
  course_id: number;
  course_name: string;
  course_code: string;
  attendance_date: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | string;
};

type AttendanceResponse = {
  count: number;
  attendance: AttendanceRecord[];
};

type AttendanceViewProps = {
  studentId: number;
};

export default function AttendanceView({
  studentId,
}: AttendanceViewProps) {
  const [data, setData] = useState<AttendanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadAttendance = useCallback(
    async (isRefresh = false) => {
      if (!studentId) {
        setError("Student ID is unavailable.");
        setLoading(false);
        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const response = await fetch(
          `${API_BASE_URL}/attendance/student/${studentId}`,
          {
            method: "GET",
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
          }
        );

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          const message =
            payload?.detail ||
            payload?.message ||
            "Unable to load attendance.";

          throw new Error(String(message));
        }

        setData(payload as AttendanceResponse);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to connect to the attendance service."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [studentId]
  );

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const records = data?.attendance ?? [];

  const summary = useMemo(() => {
    const present = records.filter(
      (item) => item.status === "PRESENT"
    ).length;

    const absent = records.filter(
      (item) => item.status === "ABSENT"
    ).length;

    const late = records.filter(
      (item) => item.status === "LATE"
    ).length;

    const excused = records.filter(
      (item) => item.status === "EXCUSED"
    ).length;

    const total = records.length;

    const percentage =
      total > 0
        ? Number(((present / total) * 100).toFixed(2))
        : 0;

    return {
      total,
      present,
      absent,
      late,
      excused,
      percentage,
    };
  }, [records]);

  const courseSummary = useMemo(() => {
    const grouped = new Map<
      number,
      {
        courseId: number;
        courseName: string;
        courseCode: string;
        total: number;
        present: number;
        absent: number;
        late: number;
        excused: number;
      }
    >();

    records.forEach((record) => {
      const existing = grouped.get(record.course_id);

      if (existing) {
        existing.total += 1;

        if (record.status === "PRESENT") {
          existing.present += 1;
        } else if (record.status === "ABSENT") {
          existing.absent += 1;
        } else if (record.status === "LATE") {
          existing.late += 1;
        } else if (record.status === "EXCUSED") {
          existing.excused += 1;
        }

        return;
      }

      grouped.set(record.course_id, {
        courseId: record.course_id,
        courseName: record.course_name,
        courseCode: record.course_code,
        total: 1,
        present: record.status === "PRESENT" ? 1 : 0,
        absent: record.status === "ABSENT" ? 1 : 0,
        late: record.status === "LATE" ? 1 : 0,
        excused: record.status === "EXCUSED" ? 1 : 0,
      });
    });

    return Array.from(grouped.values()).map((course) => ({
      ...course,
      percentage:
        course.total > 0
          ? Number(
              ((course.present / course.total) * 100).toFixed(2)
            )
          : 0,
    }));
  }, [records]);

  if (loading) {
    return (
      <div style={styles.loadingPanel}>
        <div style={styles.loadingIcon}>
          <RefreshCw size={24} className="edusphere-spin" />
        </div>

        <div>
          <div style={styles.loadingTitle}>
            Loading attendance
          </div>
          <div style={styles.loadingText}>
            Synchronizing your attendance records with EduSphere.
          </div>
        </div>

        <style>{spinStyles}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorPanel}>
        <div style={styles.errorIcon}>
          <AlertCircle size={24} />
        </div>

        <div style={{ flex: 1 }}>
          <div style={styles.errorTitle}>
            Attendance unavailable
          </div>

          <div style={styles.errorText}>{error}</div>
        </div>

        <button
          type="button"
          onClick={() => loadAttendance(true)}
          style={styles.retryButton}
          disabled={refreshing}
        >
          <RefreshCw
            size={16}
            className={refreshing ? "edusphere-spin" : undefined}
          />
          Retry
        </button>

        <style>{spinStyles}</style>
      </div>
    );
  }

  return (
    <section style={styles.container}>
      <div style={styles.header}>
        <div>
          <span style={styles.eyebrow}>
            ACADEMIC ATTENDANCE
          </span>

          <h2 style={styles.title}>
            Attendance
          </h2>

          <p style={styles.description}>
            Your attendance records are synchronized directly
            with the EduSphere academic system.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadAttendance(true)}
          style={styles.refreshButton}
          disabled={refreshing}
        >
          <RefreshCw
            size={17}
            className={refreshing ? "edusphere-spin" : undefined}
          />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div style={styles.statsGrid}>
        <SummaryCard
          icon={<CalendarCheck size={21} />}
          label="Total Classes"
          value={String(summary.total)}
        />

        <SummaryCard
          icon={<CheckCircle2 size={21} />}
          label="Present"
          value={String(summary.present)}
        />

        <SummaryCard
          icon={<XCircle size={21} />}
          label="Absent"
          value={String(summary.absent)}
        />

        <SummaryCard
          icon={<Clock3 size={21} />}
          label="Late"
          value={String(summary.late)}
        />

        <SummaryCard
          icon={<UserCheck size={21} />}
          label="Attendance"
          value={`${summary.percentage}%`}
        />
      </div>

      {records.length === 0 ? (
        <div style={styles.emptyPanel}>
          <div style={styles.emptyIcon}>
            <CalendarCheck size={28} />
          </div>

          <h3 style={styles.emptyTitle}>
            No attendance records yet
          </h3>

          <p style={styles.emptyText}>
            Attendance data will appear here once your institution
            records your classes.
          </p>
        </div>
      ) : (
        <>
          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <span style={styles.cardEyebrow}>
                  COURSE PERFORMANCE
                </span>

                <h3 style={styles.panelTitle}>
                  Course-wise attendance
                </h3>
              </div>

              <div style={styles.panelCount}>
                {courseSummary.length} course
                {courseSummary.length === 1 ? "" : "s"}
              </div>
            </div>

            <div style={styles.courseList}>
              {courseSummary.map((course) => (
                <div
                  key={course.courseId}
                  style={styles.courseCard}
                >
                  <div style={styles.courseTop}>
                    <div>
                      <div style={styles.courseCode}>
                        {course.courseCode}
                      </div>

                      <div style={styles.courseName}>
                        {course.courseName}
                      </div>
                    </div>

                    <div
                      style={{
                        ...styles.coursePercentage,
                        ...(course.percentage < 75
                          ? styles.warningPercentage
                          : {}),
                      }}
                    >
                      {course.percentage}%
                    </div>
                  </div>

                  <div style={styles.progressTrack}>
                    <div
                      style={{
                        ...styles.progressBar,
                        width: `${Math.min(
                          course.percentage,
                          100
                        )}%`,
                      }}
                    />
                  </div>

                  <div style={styles.courseMeta}>
                    <span>
                      {course.present} present
                    </span>

                    <span>
                      {course.absent} absent
                    </span>

                    <span>
                      {course.late} late
                    </span>

                    <span>
                      {course.excused} excused
                    </span>

                    <span>
                      {course.total} total
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <span style={styles.cardEyebrow}>
                  ATTENDANCE LOG
                </span>

                <h3 style={styles.panelTitle}>
                  Recent attendance
                </h3>
              </div>

              <div style={styles.panelCount}>
                {records.length} record
                {records.length === 1 ? "" : "s"}
              </div>
            </div>

            <div style={styles.recordList}>
              {records.map((record) => (
                <div
                  key={record.id}
                  style={styles.recordRow}
                >
                  <div style={styles.recordDate}>
                    <CalendarCheck size={17} />
                    <span>
                      {formatDate(record.attendance_date)}
                    </span>
                  </div>

                  <div style={styles.recordCourse}>
                    <div style={styles.recordCourseCode}>
                      {record.course_code}
                    </div>

                    <div style={styles.recordCourseName}>
                      {record.course_name}
                    </div>
                  </div>

                  <StatusBadge status={record.status} />
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <style>{spinStyles}</style>
    </section>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div style={styles.summaryCard}>
      <div style={styles.summaryIcon}>
        {icon}
      </div>

      <div style={styles.summaryLabel}>
        {label}
      </div>

      <div style={styles.summaryValue}>
        {value}
      </div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const normalized = status.toUpperCase();

  const config =
    normalized === "PRESENT"
      ? {
          label: "Present",
          style: styles.presentBadge,
        }
      : normalized === "ABSENT"
        ? {
            label: "Absent",
            style: styles.absentBadge,
          }
        : normalized === "LATE"
          ? {
              label: "Late",
              style: styles.lateBadge,
            }
          : normalized === "EXCUSED"
            ? {
                label: "Excused",
                style: styles.excusedBadge,
              }
            : {
                label: status,
                style: styles.unknownBadge,
              };

  return (
    <span style={{ ...styles.statusBadge, ...config.style }}>
      {config.label}
    </span>
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

const spinStyles = `
  @keyframes edusphere-attendance-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .edusphere-spin {
    animation: edusphere-attendance-spin 0.9s linear infinite;
  }
`;

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: 22,
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 20,
  },

  eyebrow: {
    display: "block",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.16em",
    color: "#8f9bb3",
    marginBottom: 8,
  },

  title: {
    margin: 0,
    fontSize: 30,
    lineHeight: 1.15,
    fontWeight: 800,
    letterSpacing: "-0.03em",
    color: "#f5f7fb",
  },

  description: {
    margin: "8px 0 0",
    maxWidth: 680,
    color: "#8995ab",
    fontSize: 14,
    lineHeight: 1.65,
  },

  refreshButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 12,
    background: "rgba(255,255,255,0.045)",
    color: "#e8edf7",
    padding: "10px 14px",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(5, minmax(0, 1fr))",
    gap: 14,
  },

  summaryCard: {
    position: "relative",
    overflow: "hidden",
    minHeight: 118,
    padding: 17,
    borderRadius: 17,
    border:
      "1px solid rgba(255,255,255,0.085)",
    background:
      "linear-gradient(145deg, rgba(255,255,255,0.065), rgba(255,255,255,0.025))",
    boxShadow:
      "0 18px 45px rgba(0,0,0,0.16)",
  },

  summaryIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 38,
    height: 38,
    borderRadius: 11,
    background: "rgba(255,255,255,0.06)",
    color: "#c9d4e7",
    marginBottom: 13,
  },

  summaryLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#7f8ca4",
  },

  summaryValue: {
    marginTop: 5,
    fontSize: 25,
    fontWeight: 800,
    color: "#f5f7fb",
  },

  panel: {
    border:
      "1px solid rgba(255,255,255,0.085)",
    borderRadius: 19,
    background:
      "linear-gradient(145deg, rgba(255,255,255,0.055), rgba(255,255,255,0.022))",
    boxShadow:
      "0 22px 55px rgba(0,0,0,0.15)",
    overflow: "hidden",
  },

  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 15,
    padding: "19px 20px",
    borderBottom:
      "1px solid rgba(255,255,255,0.065)",
  },

  cardEyebrow: {
    display: "block",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.14em",
    color: "#7e8aa0",
    marginBottom: 6,
  },

  panelTitle: {
    margin: 0,
    color: "#edf1f8",
    fontSize: 18,
    fontWeight: 800,
  },

  panelCount: {
    color: "#7f8ba1",
    fontSize: 12,
    fontWeight: 700,
  },

  courseList: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: 14,
    padding: 16,
  },

  courseCard: {
    padding: 17,
    borderRadius: 15,
    border:
      "1px solid rgba(255,255,255,0.065)",
    background:
      "rgba(255,255,255,0.025)",
  },

  courseTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 15,
  },

  courseCode: {
    color: "#8996ad",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.1em",
  },

  courseName: {
    marginTop: 5,
    color: "#e9edf5",
    fontSize: 14,
    fontWeight: 700,
  },

  coursePercentage: {
    color: "#e7edf8",
    fontSize: 18,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },

  warningPercentage: {
    color: "#ffb86b",
  },

  progressTrack: {
    height: 7,
    marginTop: 16,
    borderRadius: 99,
    background: "rgba(255,255,255,0.07)",
    overflow: "hidden",
  },

  progressBar: {
    height: "100%",
    borderRadius: 99,
    background:
      "linear-gradient(90deg, #788cff, #a58bff)",
    transition: "width 0.35s ease",
  },

  courseMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: "7px 13px",
    marginTop: 12,
    color: "#78859c",
    fontSize: 11,
  },

  recordList: {
    display: "flex",
    flexDirection: "column",
  },

  recordRow: {
    display: "grid",
    gridTemplateColumns:
      "180px minmax(0, 1fr) auto",
    alignItems: "center",
    gap: 18,
    padding: "15px 20px",
    borderBottom:
      "1px solid rgba(255,255,255,0.055)",
  },

  recordDate: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#aab5c8",
    fontSize: 12,
    fontWeight: 600,
  },

  recordCourse: {
    minWidth: 0,
  },

  recordCourseCode: {
    color: "#7d8aa2",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.1em",
  },

  recordCourseName: {
    marginTop: 4,
    color: "#e7ebf3",
    fontSize: 13,
    fontWeight: 700,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 74,
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.04em",
  },

  presentBadge: {
    background: "rgba(83, 209, 142, 0.11)",
    border:
      "1px solid rgba(83, 209, 142, 0.22)",
    color: "#70dfa3",
  },

  absentBadge: {
    background: "rgba(255, 91, 108, 0.10)",
    border:
      "1px solid rgba(255, 91, 108, 0.20)",
    color: "#ff8995",
  },

  lateBadge: {
    background: "rgba(255, 184, 107, 0.10)",
    border:
      "1px solid rgba(255, 184, 107, 0.20)",
    color: "#ffc27e",
  },

  excusedBadge: {
    background: "rgba(120, 140, 255, 0.11)",
    border:
      "1px solid rgba(120, 140, 255, 0.22)",
    color: "#a7b5ff",
  },

  unknownBadge: {
    background: "rgba(255,255,255,0.06)",
    border:
      "1px solid rgba(255,255,255,0.10)",
    color: "#aeb8ca",
  },

  loadingPanel: {
    display: "flex",
    alignItems: "center",
    gap: 15,
    padding: 24,
    borderRadius: 18,
    border:
      "1px solid rgba(255,255,255,0.08)",
    background:
      "rgba(255,255,255,0.035)",
  },

  loadingIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 46,
    height: 46,
    borderRadius: 13,
    background: "rgba(255,255,255,0.06)",
    color: "#aab7ff",
  },

  loadingTitle: {
    color: "#edf1f8",
    fontWeight: 800,
    fontSize: 14,
  },

  loadingText: {
    marginTop: 4,
    color: "#7e8ba1",
    fontSize: 12,
  },

  errorPanel: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: 20,
    borderRadius: 18,
    border:
      "1px solid rgba(255,91,108,0.18)",
    background:
      "rgba(255,91,108,0.045)",
  },

  errorIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
    borderRadius: 12,
    color: "#ff8d98",
    background: "rgba(255,91,108,0.10)",
  },

  errorTitle: {
    color: "#f2d8dc",
    fontWeight: 800,
    fontSize: 14,
  },

  errorText: {
    marginTop: 4,
    color: "#aa858b",
    fontSize: 12,
    lineHeight: 1.5,
  },

  retryButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    border:
      "1px solid rgba(255,255,255,0.10)",
    borderRadius: 10,
    background: "rgba(255,255,255,0.05)",
    color: "#e9edf5",
    padding: "9px 12px",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
  },

  emptyPanel: {
    textAlign: "center",
    padding: "60px 24px",
    borderRadius: 19,
    border:
      "1px solid rgba(255,255,255,0.08)",
    background:
      "rgba(255,255,255,0.025)",
  },

  emptyIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 58,
    height: 58,
    margin: "0 auto 15px",
    borderRadius: 16,
    background: "rgba(255,255,255,0.055)",
    color: "#8d9ab1",
  },

  emptyTitle: {
    margin: 0,
    color: "#e9edf5",
    fontSize: 17,
    fontWeight: 800,
  },

  emptyText: {
    maxWidth: 480,
    margin: "8px auto 0",
    color: "#7d899f",
    fontSize: 13,
    lineHeight: 1.6,
  },
};