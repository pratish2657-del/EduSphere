import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  IdCard,
  Loader2,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  UserRound,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

type AdminProfileData = {
  id?: number | null;
  email?: string;
  full_name?: string | null;
  phone: string;
  institution_code: string;
  institution_name?: string | null;
  admin_id: string;
  department: string;
  designation: string;
  office_information: string;
  responsibilities: string;
  role?: string | null;
  verification_status?: string | null;
  verification_remarks?: string | null;
};

const emptyProfile: AdminProfileData = {
  phone: "",
  institution_code: "",
  admin_id: "",
  department: "",
  designation: "",
  office_information: "",
  responsibilities: "",
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(API + path, {
    credentials: "include",
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body instanceof FormData
        ? {}
        : options.body
          ? { "Content-Type": "application/json" }
          : {}),
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    if (typeof data?.detail === "string") {
      message = data.detail;
    } else if (typeof data?.message === "string") {
      message = data.message;
    } else if (Array.isArray(data?.detail)) {
      message = data.detail
        .map((item: unknown) => {
          if (typeof item === "string") return item;

          if (
            typeof item === "object" &&
            item !== null &&
            "msg" in item &&
            typeof (item as { msg?: unknown }).msg === "string"
          ) {
            const error = item as { msg: string; loc?: unknown };
            const location = Array.isArray(error.loc)
              ? error.loc[error.loc.length - 1]
              : undefined;

            return location
              ? `${String(location)}: ${error.msg}`
              : error.msg;
          }

          return JSON.stringify(item);
        })
        .join(" • ");
    }

    throw new Error(message);
  }
  return data as T;
}


function StatusBanner({ status }: { status: string }) {
  if (status === "VERIFIED") {
    return (
      <div className="admin-profile-status admin-profile-status-success">
        <span className="admin-profile-status-icon"><CheckCircle2 size={19} /></span>
        <div>
          <strong>Admin access approved</strong>
          <p>Your account is now an Institution Administrator.</p>
        </div>
      </div>
    );
  }

  if (status === "REJECTED") {
    return (
      <div className="admin-profile-status admin-profile-status-danger">
        <span className="admin-profile-status-icon"><XCircle size={19} /></span>
        <div>
          <strong>Application needs changes</strong>
          <p>Update the details below and resubmit for Super Admin review.</p>
        </div>
      </div>
    );
  }

  if (status === "PENDING") {
    return (
      <div className="admin-profile-status admin-profile-status-warning">
        <span className="admin-profile-status-icon"><Clock3 size={19} /></span>
        <div>
          <strong>Application under review</strong>
          <p>Your Admin access will be granted only after Super Admin approval.</p>
        </div>
      </div>
    );
  }

  return null;
}

function Field({
  label,
  value,
  onChange,
  disabled,
  area,
  full,
  icon,
  placeholder,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  area?: boolean;
  full?: boolean;
  icon?: ReactNode;
  placeholder?: string;
}) {
  return (
    <label className={`admin-profile-field ${full ? "admin-profile-field-full" : ""}`}>
      <span className="admin-profile-field-label">{label}</span>
      <div className={`admin-profile-input-wrap ${disabled ? "is-disabled" : ""}`}>
        {icon && <span className="admin-profile-field-icon">{icon}</span>}
        {area ? (
          <textarea
            value={value}
            disabled={disabled}
            placeholder={placeholder}
            onChange={(event) => onChange?.(event.target.value)}
          />
        ) : (
          <input
            value={value}
            disabled={disabled}
            placeholder={placeholder}
            onChange={(event) => onChange?.(event.target.value)}
          />
        )}
      </div>
    </label>
  );
}

export default function AdminProfile() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState<AdminProfileData>(emptyProfile);
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const verificationStatus = (
    user as (typeof user & { verification_status?: string }) | null
  )?.verification_status;
  const status = String(
    profile.verification_status || verificationStatus || "NOT_SUBMITTED",
  ).toUpperCase();
  const locked = status === "PENDING";
  const name = user?.full_name || "Administrator";
  const email = user?.email || "";

  const initials = useMemo(
    () =>
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase(),
    [name],
  );

  const completion = useMemo(() => {
    const required = [
      profile.phone,
      profile.institution_code,
      profile.admin_id,
      profile.department,
      profile.designation,
    ];
    return Math.round((required.filter((value) => value.trim()).length / required.length) * 100);
  }, [profile]);

  useEffect(() => {
    let mounted = true;

    request<AdminProfileData>("/profile/admin")
      .then((data) => {
        if (!mounted) return;
        const next = { ...emptyProfile, ...data };
        setProfile(next);
        setExists(Boolean(data.id));
      })
      .catch((requestError: unknown) => {
        if (mounted) {
          setError(requestError instanceof Error ? requestError.message : "Unable to load Admin Profile.");
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const updateField = (key: keyof AdminProfileData, value: string) => {
    setProfile((current) => ({ ...current, [key]: value }));
    setError("");
    setSuccess("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (locked) {
      setError("Your application is already pending Super Admin review.");
      return;
    }

    const required = [
      profile.institution_code,
      profile.admin_id,
      profile.department,
      profile.designation,
    ];

    if (required.some((value) => !value.trim())) {
      setError("Please complete all required fields before submitting.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const data = await request<AdminProfileData>("/profile/admin", {
        method: exists ? "PUT" : "POST",
        body: JSON.stringify({
          ...profile,
          phone: profile.phone.trim(),
          institution_code: profile.institution_code.trim(),
          admin_id: profile.admin_id.trim(),
          department: profile.department.trim(),
          designation: profile.designation.trim(),
          office_information: profile.office_information.trim(),
          responsibilities: profile.responsibilities.trim(),
        }),
      });

      setProfile({ ...emptyProfile, ...data });
      setExists(true);
      await refreshUser();
      setSuccess(
        data.verification_status === "VERIFIED"
          ? "Profile updated successfully."
          : "Application submitted successfully. Waiting for Super Admin approval.",
      );
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit application.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-profile-loading">
        <div className="admin-profile-loading-orb"><ShieldCheck size={28} /></div>
        <strong>Preparing your Admin Application</strong>
        <span>Loading your account details...</span>
      </div>
    );
  }

  return (
    <div className="admin-profile-page">
      <div className="admin-profile-background admin-profile-background-one" />
      <div className="admin-profile-background admin-profile-background-two" />

      <div className="admin-profile-shell">
        <header className="admin-profile-header">
          <button className="admin-profile-back" onClick={() => navigate("/")} type="button">
            <ArrowLeft size={17} />
            <span>Back</span>
          </button>

          <div className="admin-profile-brand">
            <div className="admin-profile-brand-copy">
              <span>EDUSPHERE</span>
              <strong>Admin Access Application</strong>
            </div>
            <img src="/edusphere-logo.jpeg" alt="EduSphere" />
          </div>
        </header>

        <div className="admin-profile-layout">
          <aside className="admin-profile-sidebar">
            <div className="admin-profile-sidebar-glow" />

            <div className="admin-profile-avatar">
              <span>{initials || <UserRound size={35} />}</span>
              <div className="admin-profile-avatar-badge"><ShieldCheck size={14} /></div>
            </div>

            <h2>{name}</h2>
            <p className="admin-profile-email">{email}</p>

            <div className={`admin-profile-role-pill status-${status.toLowerCase()}`}>
              <span />
              {status === "VERIFIED" ? "INSTITUTION ADMIN" : "ADMIN APPLICANT"}
            </div>

            <div className="admin-profile-progress-card">
              <div className="admin-profile-progress-heading">
                <span>Profile completion</span>
                <strong>{completion}%</strong>
              </div>
              <div className="admin-profile-progress-track">
                <span style={{ width: `${completion}%` }} />
              </div>
              <small>
                {completion === 100
                  ? "All required details are complete."
                  : "Complete the required details to continue."}
              </small>
            </div>

            <div className="admin-profile-account-details">
              <div>
                <span className="admin-profile-detail-icon"><Building2 size={15} /></span>
                <section><small>Institution</small><strong>{profile.institution_name || "Not selected"}</strong></section>
              </div>
              <div>
                <span className="admin-profile-detail-icon"><IdCard size={15} /></span>
                <section><small>Admin ID</small><strong>{profile.admin_id || "Not added"}</strong></section>
              </div>
              <div>
                <span className="admin-profile-detail-icon"><MapPin size={15} /></span>
                <section><small>Institution Code</small><strong>{profile.institution_code || "Not added"}</strong></section>
              </div>
            </div>

            <div className="admin-profile-sidebar-footer">
              <ShieldCheck size={15} />
              <span>Verified by EduSphere Super Admin</span>
            </div>
          </aside>

          <main className="admin-profile-main">
            <div className="admin-profile-title-row">
              <div>
                <div className="admin-profile-eyebrow"><Sparkles size={14} /> ADMIN ONBOARDING</div>
                <h1>Admin Profile</h1>
                <p>
                  Submit your institutional administrator details for verification.
                  Admin access is activated only after Super Admin approval.
                </p>
              </div>
              <div className="admin-profile-step"><span>01</span><small>APPLICATION</small></div>
            </div>

            <StatusBanner status={status} />

            {profile.verification_remarks && (
              <div className="admin-profile-remarks">
                <div className="admin-profile-remarks-icon"><ShieldCheck size={18} /></div>
                <div>
                  <strong>Super Admin remarks</strong>
                  <p>{profile.verification_remarks}</p>
                </div>
              </div>
            )}

            {error && <div className="admin-profile-alert admin-profile-alert-error">{error}</div>}
            {success && <div className="admin-profile-alert admin-profile-alert-success">{success}</div>}

            <form onSubmit={submit}>
              <section className="admin-profile-section">
                <div className="admin-profile-section-heading">
                  <div className="admin-profile-section-number">01</div>
                  <div><h3>Personal Information</h3><p>Identity and direct contact details.</p></div>
                </div>

                <div className="admin-profile-fields">
                  <Field label="Full Name" value={name} disabled icon={<UserRound size={16} />} />
                  <Field label="Email Address" value={email} disabled icon={<Mail size={16} />} />
                  <Field label="Phone Number *" value={profile.phone} disabled={locked} onChange={(value) => updateField("phone", value)} icon={<Phone size={16} />} placeholder="Enter phone number" />
                  <Field label="Admin ID *" value={profile.admin_id} disabled={locked} onChange={(value) => updateField("admin_id", value)} icon={<IdCard size={16} />} placeholder="Enter institutional Admin ID" />
                </div>
              </section>

              <section className="admin-profile-section">
                <div className="admin-profile-section-heading">
                  <div className="admin-profile-section-number">02</div>
                  <div><h3>Institution &amp; Role</h3><p>Details establishing your requested institutional authority.</p></div>
                </div>

                <div className="admin-profile-fields">
                  <Field label="Institution Code *" value={profile.institution_code} disabled={locked} onChange={(value) => updateField("institution_code", value)} icon={<Building2 size={16} />} placeholder="e.g. UEMK" />
                  <Field label="Department *" value={profile.department} disabled={locked} onChange={(value) => updateField("department", value)} icon={<Building2 size={16} />} placeholder="e.g. Computer Science" />
                  <Field label="Designation *" value={profile.designation} disabled={locked} onChange={(value) => updateField("designation", value)} icon={<ShieldCheck size={16} />} placeholder="e.g. Department Administrator" />
                  <Field full label="Office Information" value={profile.office_information} disabled={locked} area onChange={(value) => updateField("office_information", value)} placeholder="Office room, building, working hours, etc." />
                  <Field full label="Responsibilities" value={profile.responsibilities} disabled={locked} area onChange={(value) => updateField("responsibilities", value)} placeholder="Describe your institutional responsibilities..." />
                </div>
              </section>
              <section className="admin-profile-section">
                <div className="admin-profile-section-heading">
                  <div className="admin-profile-section-number">03</div>
                  <div>
                    <h3>Marketplace Seller</h3>
                    <p>Seller UPI details are managed from Marketplace Seller Mode. EduSphere stores direct UPI details only.</p>
                  </div>
                </div>
              </section>

              <div className="admin-profile-submit-row">
                <div className="admin-profile-submit-note">
                  <ShieldCheck size={17} />
                  <span>Your information is submitted securely for institutional verification.</span>
                </div>
                <button className="admin-profile-submit" disabled={saving || locked} type="submit">
                  {saving ? <Loader2 className="admin-profile-spin" size={17} /> : <ShieldCheck size={17} />}
                  <span>{status === "REJECTED" ? "Resubmit Application" : status === "VERIFIED" ? "Save Profile" : "Submit for Verification"}</span>
                  {!saving && <ChevronRight size={17} />}
                </button>
              </div>
            </form>
          </main>
        </div>
      </div>
    </div>
  );
}
