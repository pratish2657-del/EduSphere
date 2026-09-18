import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  GraduationCap,
  Hash,
  Layers3,
  MapPin,
  Phone,
  UserRound,
  WalletCards,
  Smartphone,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

interface StudentForm {
  phone: string;
  institution_id: string;
  enrollment_number: string;
  program_id: string;
  academic_year: string;
  current_year: string;
  semester: string;
  section_id: string;
  student_id: string;
  admission_year: string;
}

interface SellerPayout {
  enabled: boolean;
  preferred_upi_app: string;
  upi_id: string;
  account_holder_name: string;
  payout_status?: string;
}

interface InstitutionOption {
  id: number;
  name: string;
  university_code: string | null;
}

interface ProgramOption {
  id: number;
  institution_id: number;
  name: string;
  code: string;
  degree: string | null;
  duration_years: number;
}

interface SectionOption {
  id: number;
  program_id: number;
  name: string;
  code: string;
  batch_start_year: number | null;
  batch_end_year: number | null;
}

interface StudentProfileOptions {
  institutions: InstitutionOption[];
  programs: ProgramOption[];
  sections: SectionOption[];
}

const initialForm: StudentForm = {
  phone: "",
  institution_id: "",
  enrollment_number: "",
  program_id: "",
  academic_year: "",
  current_year: "",
  semester: "",
  section_id: "",
  student_id: "",
  admission_year: "",
};


const studentProfileStyles = `
  .profile-setup-page {
    min-height: 100vh;
    position: relative;
    overflow-x: hidden;
    color: #f7f8ff;
    background: #050711;
  }
  .profile-setup-background { position: fixed; inset: 0; pointer-events: none; overflow: hidden; background: radial-gradient(circle at 15% 20%, rgba(95,80,255,.18), transparent 34%), radial-gradient(circle at 85% 25%, rgba(0,220,255,.12), transparent 32%), #050711; }
  .profile-glow { position: absolute; width: 420px; height: 420px; border-radius: 50%; filter: blur(90px); opacity: .55; }
  .profile-glow-one { left: -180px; top: 80px; background: rgba(112,76,255,.32); }
  .profile-glow-two { right: -180px; bottom: 60px; background: rgba(0,208,255,.22); }
  .profile-grid { position: absolute; inset: 0; opacity: .16; background-image: linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px); background-size: 44px 44px; mask-image: linear-gradient(to bottom, transparent, black 12%, black 88%, transparent); }
  .profile-setup-container { position: relative; z-index: 1; width: min(1100px, calc(100% - 32px)); margin: 0 auto; padding: 34px 0 60px; }
  .student-profile-container { max-width: 1120px; }
  .profile-brand { display:flex; align-items:center; gap:14px; margin-bottom:24px; }
  .profile-brand-logo { width:52px; height:52px; flex:0 0 52px; object-fit:contain; border-radius:50%; filter:drop-shadow(0 0 10px rgba(60,180,255,.28)) drop-shadow(0 0 20px rgba(105,82,255,.18)); }
  .profile-brand-name { font-size:14px; font-weight:800; letter-spacing:.16em; }
  .profile-brand-subtitle { margin-top:3px; color:#9da5bd; font-size:12px; }
  .profile-setup-card { border:1px solid rgba(255,255,255,.13); border-radius:28px; background:rgba(11,14,27,.76); backdrop-filter:blur(24px); box-shadow:0 30px 90px rgba(0,0,0,.42); padding:34px; }
  .profile-setup-header { margin-bottom:28px; }
  .profile-step-label { display:inline-flex; padding:7px 11px; border-radius:999px; border:1px solid rgba(130,120,255,.35); background:rgba(112,91,255,.10); color:#b9b1ff; font-size:11px; font-weight:800; letter-spacing:.12em; }
  .profile-setup-header h1 { margin:15px 0 8px; font-size:clamp(30px, 5vw, 48px); line-height:1.05; letter-spacing:-.035em; }
  .profile-setup-header p { margin:0; color:#9da5bd; line-height:1.65; }
  .profile-form-error { display:flex; flex-direction:column; gap:4px; margin-bottom:20px; padding:14px 16px; border:1px solid rgba(255,90,120,.3); border-radius:14px; background:rgba(255,60,100,.08); }
  .profile-form-error span { color:#c5cada; font-size:13px; }
  .profile-form-section { padding:25px 0; border-top:1px solid rgba(255,255,255,.08); }
  .profile-form-section:first-of-type { border-top:0; padding-top:0; }
  .profile-form-section-heading { display:flex; gap:12px; align-items:flex-start; margin-bottom:18px; color:#a99cff; }
  .profile-form-section-heading h2 { margin:0; color:#f7f8ff; font-size:17px; }
  .profile-form-section-heading p { margin:5px 0 0; color:#818aa3; font-size:12px; line-height:1.5; }
  .profile-form-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; }
  .profile-form-field { display:flex; flex-direction:column; gap:8px; min-width:0; }
  .profile-form-field > span { display:flex; align-items:center; gap:7px; color:#cbd1e2; font-size:12px; font-weight:700; }
  .profile-form-field input, .profile-form-field select { width:100%; box-sizing:border-box; min-height:46px; border:1px solid rgba(255,255,255,.11); border-radius:13px; outline:none; background:rgba(255,255,255,.045); color:#f5f7ff; padding:0 13px; font:inherit; transition:border-color .18s, box-shadow .18s, background .18s; }
  .profile-form-field select option { background:#111528; color:#fff; }
  .profile-form-field input::placeholder { color:#66708a; }
  .profile-form-field input:focus, .profile-form-field select:focus { border-color:rgba(135,119,255,.72); background:rgba(255,255,255,.065); box-shadow:0 0 0 3px rgba(112,91,255,.13); }
  .profile-form-field input:disabled, .profile-form-field select:disabled { opacity:.48; cursor:not-allowed; }
  .profile-form-footer { display:flex; align-items:center; justify-content:space-between; gap:24px; padding-top:26px; border-top:1px solid rgba(255,255,255,.08); }
  .profile-form-security { display:flex; flex-direction:column; gap:5px; max-width:580px; }
  .profile-form-security strong { font-size:12px; }
  .profile-form-security span { color:#7f889f; font-size:11px; line-height:1.55; }
  .profile-continue-button { display:inline-flex; align-items:center; justify-content:center; gap:9px; min-height:48px; padding:0 20px; border:0; border-radius:13px; color:white; background:linear-gradient(135deg,#7564ff,#4b8dff); font-weight:800; cursor:pointer; box-shadow:0 12px 35px rgba(92,91,255,.28); white-space:nowrap; transition:transform .18s, filter .18s; }
  .profile-continue-button:hover:not(:disabled) { transform:translateY(-1px); filter:brightness(1.08); }
  .profile-continue-button:disabled { opacity:.48; cursor:not-allowed; box-shadow:none; }
  @media (max-width: 1024px) and (min-width: 721px) {
    .student-profile-container { width: min(100% - 32px, 900px); }
    .profile-setup-card { padding: 28px; }
    .profile-form-grid { gap: 14px; }
    .profile-setup-header h1 { font-size: 42px; }
  }

  @media (max-width: 720px) {
    .profile-setup-container { width:min(100% - 20px, 1120px); padding-top:20px; }
    .profile-setup-card { padding:22px 18px; border-radius:21px; }
    .profile-form-grid { grid-template-columns:1fr; }
    .profile-form-footer { flex-direction:column; align-items:stretch; }
    .profile-continue-button { width:100%; }
    .profile-setup-container { width: calc(100% - 24px); padding: 16px 0 34px; }
    .profile-brand { gap: 10px; margin-bottom: 16px; }
    .profile-brand-logo { width: 44px; height: 44px; flex-basis: 44px; }
    .profile-brand-name { font-size: 13px; }
    .profile-brand-subtitle { font-size: 10px; }
    .profile-setup-card { padding: 20px 15px; border-radius: 18px; }
    .profile-setup-header { margin-bottom: 22px; }
    .profile-setup-header h1 { font-size: clamp(28px, 8vw, 36px); }
    .profile-setup-header p { font-size: 12px; line-height: 1.55; }
    .profile-form-section { padding: 20px 0; }
    .profile-form-section-heading { gap: 9px; margin-bottom: 14px; }
    .profile-form-section-heading h2 { font-size: 15px; }
    .profile-form-section-heading p { font-size: 11px; }
    .profile-form-grid { gap: 12px; }
    .profile-form-field { gap: 6px; }
    .profile-form-field > span { font-size: 11px; }
    .profile-form-field input, .profile-form-field select { min-height: 44px; font-size: 13px; padding: 0 11px; }
    .profile-form-footer { gap: 14px; padding-top: 20px; }
    .profile-form-security span { font-size: 10px; }
    .profile-continue-button { min-height: 46px; font-size: 13px; }
  }

  @media (max-width: 380px) {
    .profile-setup-container { width: calc(100% - 16px); }
    .profile-setup-card { padding: 18px 13px; }
    .profile-step-label { font-size: 9px; }
  }
`;

export default function StudentProfile() {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<StudentForm>(initialForm);

  const [options, setOptions] =
    useState<StudentProfileOptions | null>(null);

  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sellerPayout, setSellerPayout] = useState<SellerPayout>({ enabled: false, preferred_upi_app: "", upi_id: "", account_holder_name: "" });
  const [sellerSaving, setSellerSaving] = useState(false);
  const [sellerMessage, setSellerMessage] = useState("");

  /*
   * Load institution, program and section reference data
   * from the authenticated FastAPI endpoint.
   */
  useEffect(() => {
    let mounted = true;

    const loadOptions = async () => {
      try {
        setLoadingOptions(true);
        setError(null);

        const response = await fetch(
          `${API_BASE_URL}/profile/student/options`,
          {
            method: "GET",
            credentials: "include",
          },
        );

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          const message =
            data?.detail ||
            data?.message ||
            "Unable to load academic options.";

          throw new Error(String(message));
        }

        if (mounted) {
          setOptions({
            institutions: Array.isArray(data?.institutions)
              ? data.institutions
              : [],
            programs: Array.isArray(data?.programs)
              ? data.programs
              : [],
            sections: Array.isArray(data?.sections)
              ? data.sections
              : [],
          });
        }
      } catch (optionsError) {
        console.error(
          "Student profile options loading failed:",
          optionsError,
        );

        if (mounted) {
          setError(
            optionsError instanceof Error
              ? optionsError.message
              : "Unable to load academic options.",
          );
        }
      } finally {
        if (mounted) {
          setLoadingOptions(false);
        }
      }
    };

    loadOptions();

    fetch(`${API_BASE_URL}/marketplace/seller/payout`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setSellerPayout({ enabled: Boolean(data.enabled), preferred_upi_app: data.preferred_upi_app || "", upi_id: data.upi_id || "", account_holder_name: data.account_holder_name || "", payout_status: data.payout_status }); })
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, []);

  const updateField = (
    field: keyof StudentForm,
    value: string,
  ) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    if (error) {
      setError(null);
    }
  };

  /*
   * Programs belonging to the selected institution.
   */
  const filteredPrograms = useMemo(() => {
    if (!options || !form.institution_id) {
      return [];
    }

    const institutionId = Number(form.institution_id);

    return options.programs.filter(
      (program) =>
        program.institution_id === institutionId,
    );
  }, [options, form.institution_id]);

  /*
   * Sections belonging to the selected program.
   */
  const filteredSections = useMemo(() => {
    if (!options || !form.program_id) {
      return [];
    }

    const programId = Number(form.program_id);

    return options.sections.filter(
      (section) =>
        section.program_id === programId,
    );
  }, [options, form.program_id]);

  /*
   * Institution changed:
   * clear program and section because they may no longer belong
   * to the newly selected institution.
   */
  const handleInstitutionChange = (
    value: string,
  ) => {
    setForm((previous) => ({
      ...previous,
      institution_id: value,
      program_id: "",
      section_id: "",
    }));

    setError(null);
  };

  /*
   * Program changed:
   * clear section because it must belong to the selected program.
   */
  const handleProgramChange = (
    value: string,
  ) => {
    setForm((previous) => ({
      ...previous,
      program_id: value,
      section_id: "",
    }));

    setError(null);
  };

  const saveSellerPayout = async () => {
    setSellerSaving(true); setSellerMessage(""); setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/marketplace/seller/payout`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sellerPayout) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(String(data?.detail || "Unable to save payout details."));
      setSellerPayout({ enabled: Boolean(data.enabled), preferred_upi_app: data.preferred_upi_app || "", upi_id: data.upi_id || "", account_holder_name: data.account_holder_name || "", payout_status: data.payout_status });
      setSellerMessage(data.enabled ? "Payout details saved. Verification is pending." : "Seller account disabled.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save payout details."); }
    finally { setSellerSaving(false); }
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setError(null);

    const requiredFields: Array<keyof StudentForm> = [
      "phone",
      "institution_id",
      "enrollment_number",
      "program_id",
      "academic_year",
      "current_year",
      "semester",
      "section_id",
      "student_id",
      "admission_year",
    ];

    const missingField = requiredFields.find(
      (field) => !form[field].trim(),
    );

    if (missingField) {
      setError("Please complete all required fields.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/profile/student`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phone: form.phone.trim(),
            institution_id: Number(form.institution_id),
            enrollment_number:
              form.enrollment_number.trim(),
            program_id: Number(form.program_id),
            academic_year:
              form.academic_year.trim(),
            current_year:
              Number(form.current_year),
            semester:
              Number(form.semester),
            section_id:
              Number(form.section_id),
            student_id:
              form.student_id.trim(),
            admission_year:
              Number(form.admission_year),
          }),
        },
      );

      const data =
        await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          data?.detail ||
          data?.message ||
          "Unable to create your student profile.";

        throw new Error(
          Array.isArray(message)
            ? message
                .map(
                  (item) =>
                    item?.msg ||
                    "Validation error",
                )
                .join(", ")
            : String(message),
        );
      }

      await refreshUser();

      navigate("/access", {
        replace: true,
      });
    } catch (submissionError) {
      console.error(
        "Student profile submission failed:",
        submissionError,
      );

      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to create your student profile.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <style>{studentProfileStyles}</style>
      <div className="profile-setup-page">
      <div className="profile-setup-background">
        <div className="profile-glow profile-glow-one" />
        <div className="profile-glow profile-glow-two" />
        <div className="profile-grid" />
      </div>

      <main className="profile-setup-container student-profile-container">
        <div className="profile-brand">
          <img
            src="/edusphere-logo.jpeg"
            alt="EduSphere"
            className="profile-brand-logo"
          />

          <div>
            <div className="profile-brand-name">
              EDUSPHERE
            </div>

            <div className="profile-brand-subtitle">
              Academic Intelligence Platform
            </div>
          </div>
        </div>

        <section className="profile-setup-card student-profile-card">
          <div className="profile-setup-header">
            <span className="profile-step-label">
              STUDENT PROFILE
            </span>

            <h1>Build your academic profile</h1>

            <p>
              Welcome to EduSphere. Enter your
              academic information to continue.
            </p>
          </div>

          {error && (
            <div className="profile-form-error">
              <strong>Unable to continue</strong>
              <span>{error}</span>
            </div>
          )}

          {loadingOptions && (
            <div className="profile-form-error">
              <strong>Loading academic data</strong>
              <span>
                Fetching institutions, programs and
                sections from EduSphere...
              </span>
            </div>
          )}

          <form
            className="student-profile-form"
            onSubmit={handleSubmit}
          >
            {/* PERSONAL */}
            <div className="profile-form-section">
              <div className="profile-form-section-heading">
                <UserRound size={19} />

                <div>
                  <h2>Personal information</h2>
                  <p>
                    Basic contact information for your
                    account.
                  </p>
                </div>
              </div>

              <div className="profile-form-grid">
                <label className="profile-form-field">
                  <span>
                    <Phone size={16} />
                    Phone number
                  </span>

                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(event) =>
                      updateField(
                        "phone",
                        event.target.value,
                      )
                    }
                    placeholder="+91 9876543210"
                    minLength={10}
                    maxLength={20}
                    autoComplete="tel"
                    required
                  />
                </label>

                <label className="profile-form-field">
                  <span>
                    <Hash size={16} />
                    Student ID
                  </span>

                  <input
                    type="text"
                    value={form.student_id}
                    onChange={(event) =>
                      updateField(
                        "student_id",
                        event.target.value,
                      )
                    }
                    placeholder="Your institutional student ID"
                    required
                  />
                </label>
              </div>
            </div>

            {/* INSTITUTION */}
            <div className="profile-form-section">
              <div className="profile-form-section-heading">
                <MapPin size={19} />

                <div>
                  <h2>Institution</h2>
                  <p>
                    Select the academic institution
                    associated with your profile.
                  </p>
                </div>
              </div>

              <div className="profile-form-grid">
                <label className="profile-form-field">
                  <span>
                    <MapPin size={16} />
                    Institution
                  </span>

                  <select
                    value={form.institution_id}
                    onChange={(event) =>
                      handleInstitutionChange(
                        event.target.value,
                      )
                    }
                    disabled={
                      loadingOptions ||
                      !options
                    }
                    required
                  >
                    <option value="">
                      {loadingOptions
                        ? "Loading institutions..."
                        : "Select institution"}
                    </option>

                    {options?.institutions.map(
                      (institution) => (
                        <option
                          key={institution.id}
                          value={institution.id}
                        >
                          {institution.name}
                          {institution.university_code
                            ? ` (${institution.university_code})`
                            : ""}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label className="profile-form-field">
                  <span>
                    <BookOpen size={16} />
                    Enrollment number
                  </span>

                  <input
                    type="text"
                    value={form.enrollment_number}
                    onChange={(event) =>
                      updateField(
                        "enrollment_number",
                        event.target.value,
                      )
                    }
                    placeholder="University enrollment number"
                    required
                  />
                </label>
              </div>
            </div>

            {/* PROGRAM */}
            <div className="profile-form-section">
              <div className="profile-form-section-heading">
                <GraduationCap size={19} />

                <div>
                  <h2>Academic program</h2>
                  <p>
                    Identify your degree program and
                    academic progression.
                  </p>
                </div>
              </div>

              <div className="profile-form-grid">
                <label className="profile-form-field">
                  <span>
                    <BookOpen size={16} />
                    Program
                  </span>

                  <select
                    value={form.program_id}
                    onChange={(event) =>
                      handleProgramChange(
                        event.target.value,
                      )
                    }
                    disabled={
                      loadingOptions ||
                      !form.institution_id ||
                      filteredPrograms.length === 0
                    }
                    required
                  >
                    <option value="">
                      {!form.institution_id
                        ? "Select institution first"
                        : loadingOptions
                          ? "Loading programs..."
                          : filteredPrograms.length === 0
                            ? "No programs available"
                            : "Select program"}
                    </option>

                    {filteredPrograms.map(
                      (program) => (
                        <option
                          key={program.id}
                          value={program.id}
                        >
                          {program.name}
                          {program.code
                            ? ` — ${program.code}`
                            : ""}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label className="profile-form-field">
                  <span>
                    <Layers3 size={16} />
                    Section
                  </span>

                  <select
                    value={form.section_id}
                    onChange={(event) =>
                      updateField(
                        "section_id",
                        event.target.value,
                      )
                    }
                    disabled={
                      loadingOptions ||
                      !form.program_id ||
                      filteredSections.length === 0
                    }
                    required
                  >
                    <option value="">
                      {!form.program_id
                        ? "Select program first"
                        : loadingOptions
                          ? "Loading sections..."
                          : filteredSections.length === 0
                            ? "No sections available"
                            : "Select section"}
                    </option>

                    {filteredSections.map(
                      (section) => (
                        <option
                          key={section.id}
                          value={section.id}
                        >
                          {section.name}
                          {section.code
                            ? ` — ${section.code}`
                            : ""}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>
            </div>

            {/* ACADEMIC YEAR */}
            <div className="profile-form-section">
              <div className="profile-form-section-heading">
                <CalendarDays size={19} />

                <div>
                  <h2>Academic status</h2>
                  <p>
                    Enter your current academic year
                    and semester.
                  </p>
                </div>
              </div>

              <div className="profile-form-grid">
                <label className="profile-form-field">
                  <span>
                    <CalendarDays size={16} />
                    Academic year
                  </span>

                  <input
                    type="text"
                    value={form.academic_year}
                    onChange={(event) =>
                      updateField(
                        "academic_year",
                        event.target.value,
                      )
                    }
                    placeholder="2026-27"
                    required
                  />
                </label>

                <label className="profile-form-field">
                  <span>
                    <GraduationCap size={16} />
                    Current year
                  </span>

                  <select
                    value={form.current_year}
                    onChange={(event) =>
                      updateField(
                        "current_year",
                        event.target.value,
                      )
                    }
                    required
                  >
                    <option value="">
                      Select year
                    </option>
                    <option value="1">
                      Year 1
                    </option>
                    <option value="2">
                      Year 2
                    </option>
                    <option value="3">
                      Year 3
                    </option>
                    <option value="4">
                      Year 4
                    </option>
                  </select>
                </label>

                <label className="profile-form-field">
                  <span>
                    <Layers3 size={16} />
                    Semester
                  </span>

                  <select
                    value={form.semester}
                    onChange={(event) =>
                      updateField(
                        "semester",
                        event.target.value,
                      )
                    }
                    required
                  >
                    <option value="">
                      Select semester
                    </option>

                    {Array.from(
                      { length: 12 },
                      (_, index) => index + 1,
                    ).map((semester) => (
                      <option
                        key={semester}
                        value={semester}
                      >
                        Semester {semester}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="profile-form-field">
                  <span>
                    <CalendarDays size={16} />
                    Admission year
                  </span>

                  <input
                    type="number"
                    min="1900"
                    max="2100"
                    value={form.admission_year}
                    onChange={(event) =>
                      updateField(
                        "admission_year",
                        event.target.value,
                      )
                    }
                    placeholder="2026"
                    required
                  />
                </label>
              </div>
            </div>

            <div className="profile-form-section">
              <div className="profile-form-section-heading">
                <WalletCards size={19} />
                <div><h2>Marketplace seller &amp; payout</h2><p>Optional. Configure how you want to receive earnings from EduSphere Marketplace sales.</p></div>
              </div>
              <div className="profile-form-grid">
                <label className="profile-form-field"><span><WalletCards size={16} /> Seller account</span><select value={sellerPayout.enabled ? "YES" : "NO"} onChange={(e) => setSellerPayout(v => ({ ...v, enabled: e.target.value === "YES" }))}><option value="NO">I only want to buy</option><option value="YES">I want to sell on EduSphere</option></select></label>
                {sellerPayout.enabled && <label className="profile-form-field"><span><Smartphone size={16} /> Preferred UPI app</span><select value={sellerPayout.preferred_upi_app} onChange={(e) => setSellerPayout(v => ({ ...v, preferred_upi_app: e.target.value }))}><option value="">Select app</option><option value="GOOGLE_PAY">Google Pay</option><option value="PHONEPE">PhonePe</option><option value="PAYTM">Paytm</option><option value="BHIM">BHIM</option><option value="OTHER">Other UPI app</option></select></label>}
                {sellerPayout.enabled && <label className="profile-form-field"><span>UPI ID</span><input value={sellerPayout.upi_id} onChange={(e) => setSellerPayout(v => ({ ...v, upi_id: e.target.value }))} placeholder="yourname@upi" /></label>}
                {sellerPayout.enabled && <label className="profile-form-field"><span>Account holder name</span><input value={sellerPayout.account_holder_name} onChange={(e) => setSellerPayout(v => ({ ...v, account_holder_name: e.target.value }))} placeholder="Name on payment account" /></label>}
              </div>
              {sellerMessage && <div style={{ marginTop: 14, color: "#86efac", fontSize: 12 }}>{sellerMessage}</div>}
              {sellerPayout.payout_status && <div style={{ marginTop: 8, color: "#8f9ab3", fontSize: 11 }}>Payout status: {sellerPayout.payout_status.replaceAll("_", " ")}</div>}
              <button type="button" onClick={saveSellerPayout} disabled={sellerSaving} style={{ marginTop: 14, minHeight: 42, padding: "0 16px", border: 0, borderRadius: 11, color: "white", background: "linear-gradient(135deg,#7564ff,#4b8dff)", fontWeight: 800, cursor: sellerSaving ? "not-allowed" : "pointer", opacity: sellerSaving ? .6 : 1 }}>{sellerSaving ? "Saving..." : "Save payout details"}</button>
              {sellerPayout.enabled && <button type="button" onClick={() => { window.location.href = "/app/marketplace/seller/route-onboarding"; }} style={{ marginTop: 10, minHeight: 38, padding: "0 14px", border: "1px solid rgba(117,100,255,.35)", borderRadius: 10, color: "#c4b5fd", background: "rgba(117,100,255,.08)", fontWeight: 800, cursor: "pointer" }}>Complete Cashfree Easy Split onboarding</button>}
            </div>

            <div className="profile-form-footer">
              <div className="profile-form-security">
                <strong>
                  EduSphere academic access
                </strong>

                <span>
                  Your submitted information is
                  validated by the EduSphere backend
                  before your student account is
                  activated.
                </span>
              </div>

              <button
                type="submit"
                className="profile-continue-button"
                disabled={
                  submitting ||
                  loadingOptions ||
                  !options
                }
              >
                {submitting
                  ? "Creating profile..."
                  : "Create student profile"}

                {!submitting && (
                  <ArrowRight size={18} />
                )}
              </button>
            </div>
          </form>
        </section>
      </main>
      </div>
    </>
  );
}