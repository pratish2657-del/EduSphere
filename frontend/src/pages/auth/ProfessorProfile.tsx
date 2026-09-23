import React, {
  useEffect,
  useMemo,
  useState,
} from "react";
import type { FormEvent } from "react";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Clock3,
  GraduationCap,
  IdCard,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

type VerificationStatus =
  | "PENDING"
  | "VERIFIED"
  | "REJECTED"
  | string;

interface ProfessorProfile {
  id?: number;
  user_id?: number;
  email?: string;
  full_name?: string;

  phone: string;
  institution_code: string;
  employee_id: string;
  department: string;
  designation: string;
  specialization: string;
  subjects: string;
  academic_experience: string;
  office_information: string;
  verification_details: string;

  profile_completed?: boolean;
  verification_status?: VerificationStatus;
}

interface ProfessorDashboardProfessor
  extends ProfessorProfile {
  university_code?: string;
}

interface ProfessorDashboardResponse {
  message?: string;

  professor: ProfessorDashboardProfessor;

  courses?: {
    count: number;
    items: unknown[];
  };

  timetable?: {
    count: number;
    items: unknown[];
  };
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8000";

const emptyProfile: ProfessorProfile = {
  phone: "",
  institution_code: "",
  employee_id: "",
  department: "",
  designation: "",
  specialization: "",
  subjects: "",
  academic_experience: "",
  office_information: "",
  verification_details: "",
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(
    `${API_BASE_URL}${endpoint}`,
    {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    },
  );

  let data: unknown = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const detail =
      typeof data === "object" &&
      data !== null &&
      "detail" in data &&
      typeof (data as { detail?: unknown }).detail ===
        "string"
        ? (data as { detail: string }).detail
        : `Request failed with status ${response.status}`;

    throw new Error(detail);
  }

  return data as T;
}

/* ============================================================
   VERIFICATION BADGE
============================================================ */

function VerificationBadge({
  status,
}: {
  status?: VerificationStatus;
}) {
  const normalized = String(
    status || "",
  ).toUpperCase();

  if (normalized === "VERIFIED") {
    return (
      <span style={styles.badgeVerified}>
        <CheckCircle2 size={15} />
        Verified
      </span>
    );
  }

  if (normalized === "REJECTED") {
    return (
      <span style={styles.badgeRejected}>
        <XCircle size={15} />
        Rejected
      </span>
    );
  }

  return (
    <span style={styles.badgePending}>
      <Clock3 size={15} />
      Pending Verification
    </span>
  );
}

/* ============================================================
   INPUT FIELD
============================================================ */

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  icon: Icon,
  required = true,
  disabled = false,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  icon: React.ComponentType<{ size?: number }>;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label style={styles.field}>
      <span className="professor-profile-field-label" style={styles.label}>
        <Icon size={15} />

        {label}

        {required && (
          <span style={styles.required}>*</span>
        )}
      </span>

      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className="professor-profile-input"
        style={{
          ...styles.input,
          ...(disabled
            ? styles.inputDisabled
            : {}),
        }}
      />
    </label>
  );
}

/* ============================================================
   TEXTAREA FIELD
============================================================ */

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  icon: Icon,
  required = true,
  disabled = false,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon: React.ComponentType<{ size?: number }>;
  required?: boolean;
  disabled?: boolean;
  rows?: number;
}) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>
        <Icon size={15} />

        {label}

        {required && (
          <span style={styles.required}>*</span>
        )}
      </span>

      <textarea
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        rows={rows}
        className="professor-profile-textarea"
        style={{
          ...styles.textarea,
          ...(disabled
            ? styles.inputDisabled
            : {}),
        }}
      />
    </label>
  );
}

/* ============================================================
   PROFESSOR PROFILE
============================================================ */

export default function ProfessorProfile() {
  const navigate = useNavigate();

  const { user, refreshUser } = useAuth();

  const [profile, setProfile] =
    useState<ProfessorProfile>(
      emptyProfile,
    );

  const [initialProfile, setInitialProfile] =
    useState<ProfessorProfile>(
      emptyProfile,
    );

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  /* ==========================================================
     LOAD PROFESSOR PROFILE
  ========================================================== */

  const loadProfile = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const data =
        await apiRequest<ProfessorDashboardResponse>(
          "/professor/dashboard/",
        );

      const loadedProfile: ProfessorProfile = {
        ...emptyProfile,
        ...(data.professor || {}),
        institution_code:
          data.professor?.institution_code ||
          data.professor?.university_code ||
          "",
      };

      setProfile(loadedProfile);
      setInitialProfile(loadedProfile);
    } catch (requestError) {
      setError(
        getErrorMessage(requestError),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  /* ==========================================================
     CHECK CHANGES
  ========================================================== */

  const hasChanges = useMemo(() => {
    return (
      JSON.stringify(profile) !==
      JSON.stringify(initialProfile)
    );
  }, [profile, initialProfile]);

  /* ==========================================================
     UPDATE FIELD
  ========================================================== */

  const updateField = (
    field: keyof ProfessorProfile,
    value: string,
  ) => {
    setProfile((current) => ({
      ...current,
      [field]: value,
    }));

    setError("");
    setSuccess("");
  };

  /* ==========================================================
     CREATE PROFESSOR PROFILE
  ========================================================== */

  const createProfile = async () => {
    return apiRequest<{
      message: string;
      professor_id: number;
      verification_status: string;
      profile_completed: boolean;
    }>("/profile/professor", {
      method: "POST",

      body: JSON.stringify({
        phone: profile.phone.trim(),

        institution_code:
          profile.institution_code.trim(),

        employee_id:
          profile.employee_id.trim(),

        department:
          profile.department.trim(),

        designation:
          profile.designation.trim(),

        specialization:
          profile.specialization.trim(),

        subjects:
          profile.subjects.trim(),

        academic_experience:
          profile.academic_experience.trim(),

        office_information:
          profile.office_information.trim(),

        verification_details:
          profile.verification_details.trim(),
      }),
    });
  };

  /* ==========================================================
     UPDATE PROFESSOR PROFILE
  ========================================================== */

  const updateProfile = async () => {
    return apiRequest<{
      message: string;
      professor_id: number;
      verification_status: string;
      profile_completed: boolean;
    }>("/profile/professor", {
      method: "PUT",

      body: JSON.stringify({
        phone: profile.phone.trim(),

        institution_code:
          profile.institution_code.trim(),

        employee_id:
          profile.employee_id.trim(),

        department:
          profile.department.trim(),

        designation:
          profile.designation.trim(),

        specialization:
          profile.specialization.trim(),

        subjects:
          profile.subjects.trim(),

        academic_experience:
          profile.academic_experience.trim(),

        office_information:
          profile.office_information.trim(),

        verification_details:
          profile.verification_details.trim(),
      }),
    });
  };

  /* ==========================================================
     SUBMIT
  ========================================================== */

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!profile.phone.trim()) {
      setError(
        "Please enter your phone number.",
      );
      return;
    }

    const institutionCode =
      profile.institution_code.trim();

    if (!institutionCode) {
      setError(
        "Please enter your institution code.",
      );
      return;
    }

    if (
      !/^[A-Za-z0-9][A-Za-z0-9/_-]{3,99}$/.test(
        institutionCode,
      )
    ) {
      setError(
        "Enter a valid institution code, e.g. IN/WB/Kolkata/UEM29082026.",
      );
      return;
    }

    if (!profile.employee_id.trim()) {
      setError(
        "Please enter your employee ID.",
      );
      return;
    }

    if (!profile.department.trim()) {
      setError(
        "Please enter your department.",
      );
      return;
    }

    if (!profile.designation.trim()) {
      setError(
        "Please enter your designation.",
      );
      return;
    }

    if (!profile.specialization.trim()) {
      setError(
        "Please enter your specialization.",
      );
      return;
    }

    if (!profile.subjects.trim()) {
      setError(
        "Please enter the subjects you teach.",
      );
      return;
    }

    if (
      !profile.academic_experience.trim()
    ) {
      setError(
        "Please enter your academic experience.",
      );
      return;
    }

    if (
      !profile.office_information.trim()
    ) {
      setError(
        "Please enter your office information.",
      );
      return;
    }

    if (
      !profile.verification_details.trim()
    ) {
      setError(
        "Please enter your verification details.",
      );
      return;
    }

    setSaving(true);

    try {
      const response = profile.id
        ? await updateProfile()
        : await createProfile();

      setSuccess(
        response.message ||
          "Professor profile submitted successfully.",
      );

      const updatedProfile = {
        ...profile,
        id: response.professor_id,
        profile_completed:
          response.profile_completed,
        verification_status:
          response.verification_status,
      };

      setProfile(updatedProfile);
      setInitialProfile(updatedProfile);

      try {
        await refreshUser();
      } catch {
        // Profile was already saved successfully.
      }

      // A successful create promotes the account to PROFESSOR.
      // Open the professor workspace immediately.
      if (!profile.id) {
        navigate("/app/professor");
      }
    } catch (requestError) {
      setError(
        getErrorMessage(requestError),
      );
    } finally {
      setSaving(false);
    }
  };

  /* ==========================================================
     RESET
  ========================================================== */

  const handleReset = () => {
    setProfile(initialProfile);
    setError("");
    setSuccess("");
  };

  /* ==========================================================
     ACCOUNT INFORMATION
  ========================================================== */

  const fullName =
    profile.full_name ||
    user?.full_name ||
    "Professor";

  const email =
    profile.email ||
    user?.email ||
    "—";

  /* ==========================================================
     LOADING SCREEN
  ========================================================== */

  if (loading) {
    return (
      <div className="professor-profile-responsive" style={styles.page}>
        <div style={styles.centerState}>
          <div style={styles.loaderCircle}>
            <Loader2
              size={26}
              style={styles.spinner}
            />
          </div>

          <h2 style={styles.stateTitle}>
            Loading Professor Profile
          </h2>

          <p style={styles.stateText}>
            Connecting to your EduSphere
            academic workspace...
          </p>
        </div>
      </div>
    );
  }

  /* ==========================================================
     MAIN UI
  ========================================================== */

  return (
      <div className="professor-profile-responsive" style={styles.page}>
        <style>{professorProfileResponsiveStyles}</style>
      <div
        style={styles.backgroundGlowOne}
      />

      <div
        style={styles.backgroundGlowTwo}
      />

      <main className="professor-profile-main" style={styles.container}>

        {/* ======================================================
            HEADER
        ====================================================== */}

        <header className="professor-profile-header" style={styles.header}>

          <button
            type="button"
            onClick={() => navigate(-1)}
            style={styles.backButton}
          >
            <ArrowLeft size={18} />
            Back
          </button>

          <div className="professor-profile-header-text" style={styles.headerText}>
            <div className="professor-profile-title-row" style={styles.titleRow}>

              {/* EDUSPHERE LOGO */}

              <div
                className="professor-profile-logo-container"
                style={styles.logoContainer}
              >
                <img
                  src="/edusphere-logo.jpeg"
                  alt="EduSphere"
                  style={styles.logo}
                />
              </div>

              <div>
                <h1 className="professor-profile-title" style={styles.title}>
                  Professor Profile
                </h1>

                <p className="professor-profile-subtitle" style={styles.subtitle}>
                  Manage your academic and
                  professional information
                </p>
              </div>

            </div>
          </div>

          <VerificationBadge
            status={
              profile.verification_status
            }
          />

        </header>

        {/* ======================================================
            ERROR
        ====================================================== */}

        {error && (
          <div style={styles.errorBanner}>
            <XCircle size={19} />

            <div>
              <strong>
                Unable to save profile
              </strong>

              <p style={styles.errorText}>
                {error}
              </p>
            </div>
          </div>
        )}

        {/* ======================================================
            SUCCESS
        ====================================================== */}

        {success && (
          <div
            style={styles.successBanner}
          >
            <CheckCircle2 size={19} />

            <div>
              <strong>
                Profile updated
              </strong>

              <p
                style={
                  styles.successText
                }
              >
                {success}
              </p>
            </div>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
        >

          {/* ==================================================
              ACCOUNT INFORMATION
          ================================================== */}

          <section className="professor-profile-card" style={styles.card}>

            <div
              className="professor-profile-section-header"
              style={styles.sectionHeader}
            >
              <div
                className="professor-profile-section-icon"
                style={styles.sectionIcon}
              >
                <UserRound size={19} />
              </div>

              <div>
                <h2
                  className="professor-profile-section-title"
                  style={
                    styles.sectionTitle
                  }
                >
                  Account Information
                </h2>

                <p
                  className="professor-profile-section-description"
                  style={
                    styles.sectionDescription
                  }
                >
                  Information associated
                  with your EduSphere account.
                </p>
              </div>
            </div>

            <div
              style={
                styles.profileIdentity
              }
            >
              <div className="professor-profile-avatar" style={styles.avatar}>
                {fullName
                  .split(" ")
                  .map(
                    (part) => part[0],
                  )
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>

              <div
                style={styles.identityText}
              >
                <h3 className="professor-profile-identity-name" style={styles.identityName}>
                  {fullName}
                </h3>

                <div
                  className="professor-profile-identity-email"
                  style={
                    styles.identityEmail
                  }
                >
                  <Mail size={14} />
                  {email}
                </div>
              </div>
            </div>

            <div className="professor-profile-grid" style={styles.grid}>

              <div
                style={styles.readonlyBox}
              >
                <span
                  style={
                    styles.readonlyLabel
                  }
                >
                  Full Name
                </span>

                <strong>
                  {fullName}
                </strong>
              </div>

              <div
                style={styles.readonlyBox}
              >
                <span
                  style={
                    styles.readonlyLabel
                  }
                >
                  Email
                </span>

                <strong>
                  {email}
                </strong>
              </div>

            </div>

          </section>

          {/* ==================================================
              PROFESSIONAL INFORMATION
          ================================================== */}

          <section style={styles.card}>

            <div
              style={styles.sectionHeader}
            >
              <div
                style={styles.sectionIcon}
              >
                <BriefcaseBusiness
                  size={19}
                />
              </div>

              <div>
                <h2
                  style={
                    styles.sectionTitle
                  }
                >
                  Professional Information
                </h2>

                <p
                  style={
                    styles.sectionDescription
                  }
                >
                  Your official faculty and
                  employment information.
                </p>
              </div>
            </div>

            <div className="professor-profile-grid" style={styles.grid}>

              <Field
                label="Phone Number"
                value={profile.phone}
                onChange={(value) =>
                  updateField(
                    "phone",
                    value,
                  )
                }
                placeholder="+91 XXXXX XXXXX"
                type="tel"
                icon={Phone}
              />

              <Field
                label="Employee ID"
                value={
                  profile.employee_id
                }
                onChange={(value) =>
                  updateField(
                    "employee_id",
                    value,
                  )
                }
                placeholder="Enter employee ID"
                icon={IdCard}
              />

              <Field
                label="Institution Code"
                value={
                  profile.institution_code
                }
                onChange={(value) =>
                  updateField(
                    "institution_code",
                    value,
                  )
                }
                placeholder="IN/WB/Kolkata/UEM29082026"
                icon={Building2}
              />

              <Field
                label="Department"
                value={
                  profile.department
                }
                onChange={(value) =>
                  updateField(
                    "department",
                    value,
                  )
                }
                placeholder="e.g. Computer Science & Engineering"
                icon={Building2}
              />

              <Field
                label="Designation"
                value={
                  profile.designation
                }
                onChange={(value) =>
                  updateField(
                    "designation",
                    value,
                  )
                }
                placeholder="e.g. Assistant Professor"
                icon={GraduationCap}
              />

              <Field
                label="Specialization"
                value={
                  profile.specialization
                }
                onChange={(value) =>
                  updateField(
                    "specialization",
                    value,
                  )
                }
                placeholder="e.g. Artificial Intelligence"
                icon={
                  BriefcaseBusiness
                }
              />

            </div>

          </section>

          {/* ==================================================
              ACADEMIC INFORMATION
          ================================================== */}

          <section style={styles.card}>

            <div
              style={styles.sectionHeader}
            >
              <div
                style={styles.sectionIcon}
              >
                <GraduationCap
                  size={19}
                />
              </div>

              <div>
                <h2
                  style={
                    styles.sectionTitle
                  }
                >
                  Academic Information
                </h2>

                <p
                  style={
                    styles.sectionDescription
                  }
                >
                  Add information about your
                  teaching and academic
                  background.
                </p>
              </div>
            </div>

            <div
              style={
                styles.singleColumn
              }
            >

              <TextAreaField
                label="Subjects"
                value={
                  profile.subjects
                }
                onChange={(value) =>
                  updateField(
                    "subjects",
                    value,
                  )
                }
                placeholder="Enter subjects you teach"
                icon={GraduationCap}
                rows={3}
              />

              <TextAreaField
                label="Academic Experience"
                value={
                  profile.academic_experience
                }
                onChange={(value) =>
                  updateField(
                    "academic_experience",
                    value,
                  )
                }
                placeholder="Describe your academic and teaching experience"
                icon={
                  BriefcaseBusiness
                }
                rows={5}
              />

            </div>

          </section>

          {/* ==================================================
              OFFICE INFORMATION
          ================================================== */}

          <section style={styles.card}>

            <div
              style={styles.sectionHeader}
            >
              <div
                style={styles.sectionIcon}
              >
                <MapPin size={19} />
              </div>

              <div>
                <h2
                  style={
                    styles.sectionTitle
                  }
                >
                  Office Information
                </h2>

                <p
                  style={
                    styles.sectionDescription
                  }
                >
                  Information students or
                  staff can use to locate or
                  contact you on campus.
                </p>
              </div>
            </div>

            <TextAreaField
              label="Office Information"
              value={
                profile.office_information
              }
              onChange={(value) =>
                updateField(
                  "office_information",
                  value,
                )
              }
              placeholder="Building, room number, office hours, etc."
              icon={MapPin}
              rows={4}
            />

          </section>

          {/* ==================================================
              VERIFICATION INFORMATION
          ================================================== */}

          <section style={styles.card}>

            <div
              style={styles.sectionHeader}
            >
              <div
                style={styles.sectionIcon}
              >
                <ShieldCheck
                  size={19}
                />
              </div>

              <div>
                <h2
                  style={
                    styles.sectionTitle
                  }
                >
                  Verification Information
                </h2>

                <p
                  style={
                    styles.sectionDescription
                  }
                >
                  Information used for
                  professor verification.
                </p>
              </div>
            </div>

            <TextAreaField
              label="Verification Details"
              value={
                profile.verification_details
              }
              onChange={(value) =>
                updateField(
                  "verification_details",
                  value,
                )
              }
              placeholder="Provide relevant verification information"
              icon={ShieldCheck}
              rows={5}
            />

            <div
              style={
                styles.verificationInfo
              }
            >
              <VerificationBadge
                status={
                  profile.verification_status
                }
              />

              <p
                className="professor-profile-verification-text"
                style={
                  styles.verificationText
                }
              >
                Professor profiles are
                submitted for verification.
                Updating an existing profile
                starts a new review cycle when
                the previous verification was
                completed or rejected.
              </p>
            </div>

          </section>

          {/* ==================================================
              ACTIONS
          ================================================== */}

          <div className="professor-profile-actions" style={styles.actions}>

            <button
              type="button"
              onClick={handleReset}
              disabled={
                saving || !hasChanges
              }
              style={{
                ...styles.secondaryButton,

                ...(saving || !hasChanges
                  ? styles.disabledButton
                  : {}),
              }}
            >
              Reset Changes
            </button>

            <button
              type="submit"
              disabled={
                saving || !hasChanges
              }
              style={{
                ...styles.primaryButton,

                ...(saving || !hasChanges
                  ? styles.disabledPrimaryButton
                  : {}),
              }}
            >
              {saving ? (
                <>
                  <Loader2
                    size={17}
                    style={styles.spinner}
                  />

                  Saving...
                </>
              ) : (
                <>
                  <Save size={17} />

                  Save Profile
                </>
              )}
            </button>

          </div>

        </form>
      </main>
    </div>
  );
}

/* ==============================================================
   STYLES
============================================================== */


const professorProfileResponsiveStyles = `
  .professor-profile-responsive {
    overflow-x: hidden;
  }
  .professor-profile-responsive .professor-profile-main {
    min-width: 0;
  }
  .professor-profile-responsive .professor-profile-form {
    min-width: 0;
  }
  @media (max-width: 1024px) {
    .professor-profile-responsive { padding: 22px 16px 44px !important; }
    .professor-profile-responsive .professor-profile-main { max-width: 900px !important; }
    .professor-profile-responsive .professor-profile-header { gap: 14px !important; }
    .professor-profile-responsive .professor-profile-header-text { min-width: 0 !important; }
    .professor-profile-responsive .professor-profile-title-row { flex-wrap: wrap !important; }
    .professor-profile-responsive .professor-profile-card { padding: 20px !important; }
    .professor-profile-responsive .professor-profile-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 14px !important; }
    .professor-profile-responsive .professor-profile-form > section:last-of-type > div:nth-child(2) { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  }
  @media (max-width: 680px) {
    .professor-profile-responsive { padding: 16px 10px 34px !important; }
    .professor-profile-responsive .professor-profile-main { width: 100% !important; }
    .professor-profile-responsive .professor-profile-header { flex-direction: column !important; align-items: stretch !important; gap: 12px !important; margin-bottom: 18px !important; }
    .professor-profile-responsive .professor-profile-header-text { flex: none !important; width: 100% !important; }
    .professor-profile-responsive .professor-profile-title-row { gap: 10px !important; }
    .professor-profile-responsive .professor-profile-logo-container { width: 44px !important; height: 44px !important; }
    .professor-profile-responsive .professor-profile-title { font-size: 21px !important; }
    .professor-profile-responsive .professor-profile-subtitle { font-size: 12px !important; line-height: 1.45 !important; }
    .professor-profile-responsive .professor-profile-card { padding: 16px !important; border-radius: 15px !important; margin-bottom: 12px !important; }
    .professor-profile-responsive .professor-profile-section-header { gap: 9px !important; margin-bottom: 16px !important; }
    .professor-profile-responsive .professor-profile-section-icon { width: 34px !important; height: 34px !important; }
    .professor-profile-responsive .professor-profile-section-title { font-size: 15px !important; }
    .professor-profile-responsive .professor-profile-section-description { font-size: 11px !important; line-height: 1.45 !important; }
    .professor-profile-responsive .professor-profile-grid { grid-template-columns: 1fr !important; gap: 12px !important; }
    .professor-profile-responsive .professor-profile-form > section:last-of-type > div:nth-child(2) { grid-template-columns: 1fr !important; gap: 12px !important; }
    .professor-profile-responsive .professor-profile-identity { padding: 12px !important; gap: 10px !important; }
    .professor-profile-responsive .professor-profile-avatar { width: 46px !important; height: 46px !important; font-size: 15px !important; }
    .professor-profile-responsive .professor-profile-identity-name { font-size: 15px !important; }
    .professor-profile-responsive .professor-profile-identity-email { font-size: 11px !important; overflow-wrap: anywhere !important; }
    .professor-profile-responsive .professor-profile-field-label { font-size: 11px !important; }
    .professor-profile-responsive .professor-profile-input,
    .professor-profile-responsive .professor-profile-textarea { font-size: 13px !important; }
    .professor-profile-responsive .professor-profile-actions { flex-direction: column-reverse !important; align-items: stretch !important; }
    .professor-profile-responsive .professor-profile-actions button { width: 100% !important; }
    .professor-profile-responsive .professor-profile-verification-text { font-size: 11px !important; }
  }
  @media (max-width: 380px) {
    .professor-profile-responsive { padding-left: 7px !important; padding-right: 7px !important; }
    .professor-profile-responsive .professor-profile-card { padding: 14px !important; }
    .professor-profile-responsive .professor-profile-title { font-size: 19px !important; }
  }
`;
const styles: Record<
  string,
  React.CSSProperties
> = {
  page: {
    minHeight: "100vh",

    background:
      "linear-gradient(135deg, #07111f 0%, #0b1728 48%, #101827 100%)",

    color: "#f8fafc",

    padding:
      "28px 20px 60px",

    position: "relative",

    overflow: "hidden",

    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  },

  backgroundGlowOne: {
    position: "fixed",

    width: 420,
    height: 420,

    borderRadius: "50%",

    background:
      "rgba(59, 130, 246, 0.10)",

    filter: "blur(90px)",

    top: -180,
    right: -120,

    pointerEvents: "none",
  },

  backgroundGlowTwo: {
    position: "fixed",

    width: 360,
    height: 360,

    borderRadius: "50%",

    background:
      "rgba(139, 92, 246, 0.08)",

    filter: "blur(90px)",

    bottom: -150,
    left: -120,

    pointerEvents: "none",
  },

  container: {
    width: "100%",

    maxWidth: 1120,

    margin: "0 auto",

    position: "relative",

    zIndex: 1,
  },

  header: {
    display: "flex",

    alignItems: "center",

    gap: 18,

    marginBottom: 26,

    flexWrap: "wrap",
  },

  backButton: {
    display: "inline-flex",

    alignItems: "center",

    gap: 7,

    border:
      "1px solid rgba(148, 163, 184, 0.18)",

    background:
      "rgba(15, 23, 42, 0.72)",

    color: "#cbd5e1",

    borderRadius: 10,

    padding: "9px 13px",

    cursor: "pointer",

    fontSize: 14,
  },

  headerText: {
    flex: 1,

    minWidth: 260,
  },

  titleRow: {
    display: "flex",

    alignItems: "center",

    gap: 12,
  },

  /* ============================================================
     EDUSPHERE LOGO
  ============================================================ */

  logoContainer: {
    width: 52,
    height: 52,

    borderRadius: 13,

    overflow: "hidden",

    flexShrink: 0,

    background: "#ffffff",

    border:
      "1px solid rgba(148, 163, 184, 0.18)",

    display: "flex",

    alignItems: "center",

    justifyContent: "center",

    boxShadow:
      "0 8px 25px rgba(0, 0, 0, 0.20)",
  },

  logo: {
    width: "100%",
    height: "100%",

    objectFit: "cover",

    display: "block",
  },

  title: {
    margin: 0,

    fontSize: 25,

    lineHeight: 1.2,

    fontWeight: 750,

    letterSpacing: "-0.02em",
  },

  subtitle: {
    margin: "5px 0 0",

    color: "#94a3b8",

    fontSize: 14,
  },

  /* ============================================================
     VERIFICATION BADGES
  ============================================================ */

  badgeVerified: {
    display: "inline-flex",

    alignItems: "center",

    gap: 7,

    padding: "8px 12px",

    borderRadius: 999,

    fontSize: 13,

    fontWeight: 650,

    background:
      "rgba(34, 197, 94, 0.12)",

    color: "#86efac",

    border:
      "1px solid rgba(34, 197, 94, 0.2)",
  },

  badgePending: {
    display: "inline-flex",

    alignItems: "center",

    gap: 7,

    padding: "8px 12px",

    borderRadius: 999,

    fontSize: 13,

    fontWeight: 650,

    background:
      "rgba(245, 158, 11, 0.12)",

    color: "#fcd34d",

    border:
      "1px solid rgba(245, 158, 11, 0.2)",
  },

  badgeRejected: {
    display: "inline-flex",

    alignItems: "center",

    gap: 7,

    padding: "8px 12px",

    borderRadius: 999,

    fontSize: 13,

    fontWeight: 650,

    background:
      "rgba(239, 68, 68, 0.12)",

    color: "#fca5a5",

    border:
      "1px solid rgba(239, 68, 68, 0.2)",
  },

  /* ============================================================
     CARD
  ============================================================ */

  card: {
    background:
      "rgba(15, 23, 42, 0.78)",

    border:
      "1px solid rgba(148, 163, 184, 0.13)",

    borderRadius: 18,

    padding: 24,

    marginBottom: 18,

    boxShadow:
      "0 16px 50px rgba(0, 0, 0, 0.16)",

    backdropFilter: "blur(12px)",
  },

  sectionHeader: {
    display: "flex",

    alignItems: "flex-start",

    gap: 12,

    marginBottom: 22,
  },

  sectionIcon: {
    width: 38,
    height: 38,

    flexShrink: 0,

    borderRadius: 10,

    display: "flex",

    alignItems: "center",

    justifyContent: "center",

    background:
      "rgba(59, 130, 246, 0.11)",

    color: "#93c5fd",

    border:
      "1px solid rgba(96, 165, 250, 0.16)",
  },

  sectionTitle: {
    margin: 0,

    fontSize: 17,

    fontWeight: 700,
  },

  sectionDescription: {
    margin: "4px 0 0",

    color: "#94a3b8",

    fontSize: 13,

    lineHeight: 1.5,
  },

  /* ============================================================
     IDENTITY
  ============================================================ */

  profileIdentity: {
    display: "flex",

    alignItems: "center",

    gap: 14,

    padding: 16,

    borderRadius: 13,

    background:
      "rgba(30, 41, 59, 0.55)",

    border:
      "1px solid rgba(148, 163, 184, 0.10)",

    marginBottom: 18,
  },

  avatar: {
    width: 54,
    height: 54,

    borderRadius: "50%",

    display: "flex",

    alignItems: "center",

    justifyContent: "center",

    background:
      "linear-gradient(135deg, #2563eb, #7c3aed)",

    color: "#fff",

    fontSize: 17,

    fontWeight: 750,

    flexShrink: 0,
  },

  identityText: {
    minWidth: 0,
  },

  identityName: {
    margin: 0,

    fontSize: 17,

    fontWeight: 700,
  },

  identityEmail: {
    display: "flex",

    alignItems: "center",

    gap: 6,

    color: "#94a3b8",

    fontSize: 13,

    marginTop: 4,
  },

  /* ============================================================
     GRID
  ============================================================ */

  grid: {
    display: "grid",

    gridTemplateColumns:
      "repeat(auto-fit, minmax(260px, 1fr))",

    gap: 17,
  },

  singleColumn: {
    display: "flex",

    flexDirection: "column",

    gap: 17,
  },

  /* ============================================================
     FORM
  ============================================================ */

  field: {
    display: "flex",

    flexDirection: "column",

    gap: 8,
  },

  label: {
    display: "flex",

    alignItems: "center",

    gap: 7,

    color: "#cbd5e1",

    fontSize: 13,

    fontWeight: 600,
  },

  required: {
    color: "#f87171",
  },

  input: {
    width: "100%",

    boxSizing: "border-box",

    background:
      "rgba(2, 6, 23, 0.52)",

    color: "#f8fafc",

    border:
      "1px solid rgba(148, 163, 184, 0.17)",

    borderRadius: 10,

    padding: "11px 12px",

    outline: "none",

    fontSize: 14,
  },

  textarea: {
    width: "100%",

    boxSizing: "border-box",

    background:
      "rgba(2, 6, 23, 0.52)",

    color: "#f8fafc",

    border:
      "1px solid rgba(148, 163, 184, 0.17)",

    borderRadius: 10,

    padding: 12,

    outline: "none",

    fontSize: 14,

    lineHeight: 1.55,

    resize: "vertical",

    fontFamily: "inherit",
  },

  inputDisabled: {
    opacity: 0.65,

    cursor: "not-allowed",
  },

  /* ============================================================
     READONLY
  ============================================================ */

  readonlyBox: {
    display: "flex",

    flexDirection: "column",

    gap: 6,

    background:
      "rgba(30, 41, 59, 0.45)",

    border:
      "1px solid rgba(148, 163, 184, 0.10)",

    borderRadius: 10,

    padding: "12px 13px",

    minWidth: 0,
  },

  readonlyLabel: {
    color: "#64748b",

    fontSize: 11,

    textTransform: "uppercase",

    letterSpacing: "0.06em",

    fontWeight: 700,
  },

  /* ============================================================
     VERIFICATION INFO
  ============================================================ */

  verificationInfo: {
    marginTop: 17,

    padding: 14,

    borderRadius: 11,

    background:
      "rgba(30, 41, 59, 0.42)",

    border:
      "1px solid rgba(148, 163, 184, 0.10)",
  },

  verificationText: {
    margin: "10px 0 0",

    color: "#94a3b8",

    fontSize: 13,

    lineHeight: 1.55,
  },

  /* ============================================================
     ACTIONS
  ============================================================ */

  actions: {
    display: "flex",

    justifyContent: "flex-end",

    gap: 10,

    paddingTop: 2,

    flexWrap: "wrap",
  },

  primaryButton: {
    display: "inline-flex",

    alignItems: "center",

    justifyContent: "center",

    gap: 8,

    border: 0,

    borderRadius: 10,

    padding: "11px 17px",

    background:
      "linear-gradient(135deg, #2563eb, #4f46e5)",

    color: "#fff",

    fontSize: 14,

    fontWeight: 700,

    cursor: "pointer",

    boxShadow:
      "0 8px 25px rgba(37, 99, 235, 0.22)",
  },

  secondaryButton: {
    display: "inline-flex",

    alignItems: "center",

    justifyContent: "center",

    gap: 8,

    border:
      "1px solid rgba(148, 163, 184, 0.18)",

    borderRadius: 10,

    padding: "11px 17px",

    background:
      "rgba(15, 23, 42, 0.75)",

    color: "#cbd5e1",

    fontSize: 14,

    fontWeight: 650,

    cursor: "pointer",
  },

  disabledButton: {
    opacity: 0.45,

    cursor: "not-allowed",
  },

  disabledPrimaryButton: {
    opacity: 0.5,

    cursor: "not-allowed",

    boxShadow: "none",
  },

  /* ============================================================
     ERROR / SUCCESS
  ============================================================ */

  errorBanner: {
    display: "flex",

    alignItems: "flex-start",

    gap: 10,

    background:
      "rgba(127, 29, 29, 0.24)",

    border:
      "1px solid rgba(248, 113, 113, 0.22)",

    color: "#fecaca",

    borderRadius: 12,

    padding: "12px 14px",

    marginBottom: 18,
  },

  errorText: {
    margin: "4px 0 0",

    color: "#fca5a5",

    fontSize: 13,
  },

  successBanner: {
    display: "flex",

    alignItems: "flex-start",

    gap: 10,

    background:
      "rgba(20, 83, 45, 0.24)",

    border:
      "1px solid rgba(74, 222, 128, 0.20)",

    color: "#bbf7d0",

    borderRadius: 12,

    padding: "12px 14px",

    marginBottom: 18,
  },

  successText: {
    margin: "4px 0 0",

    color: "#86efac",

    fontSize: 13,
  },

  /* ============================================================
     LOADING
  ============================================================ */

  centerState: {
    minHeight:
      "calc(100vh - 60px)",

    display: "flex",

    flexDirection: "column",

    alignItems: "center",

    justifyContent: "center",

    textAlign: "center",
  },

  loaderCircle: {
    width: 56,
    height: 56,

    borderRadius: "50%",

    display: "flex",

    alignItems: "center",

    justifyContent: "center",

    background:
      "rgba(59, 130, 246, 0.12)",

    color: "#93c5fd",

    marginBottom: 16,
  },

  spinner: {
    animation:
      "spin 1s linear infinite",
  },

  stateTitle: {
    margin: 0,

    fontSize: 19,
  },

  stateText: {
    margin: "7px 0 0",

    color: "#94a3b8",

    fontSize: 14,
  },
};