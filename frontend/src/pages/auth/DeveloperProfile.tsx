import {
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  BriefcaseBusiness,
  CheckCircle2,
  Code2,
  Globe2,
  Layers3,
  Link,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./developer-profile.css";

type DeveloperProfileData = {
  full_name: string;
  email: string;
  phone: string;
  developer_id: string;
  designation: string;
  department: string;
  experience: string;
  primary_role: string;
  skills: string;
  github: string;
  linkedin: string;
  portfolio: string;
  bio: string;
};

const emptyProfile: DeveloperProfileData = {
  full_name: "",
  email: "",
  phone: "",
  developer_id: "",
  designation: "",
  department: "",
  experience: "",
  primary_role: "",
  skills: "",
  github: "",
  linkedin: "",
  portfolio: "",
  bio: "",
};

export default function DeveloperProfile() {
  const navigate = useNavigate();

  const [profile, setProfile] =
    useState<DeveloperProfileData>(emptyProfile);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      try {
        const [meResponse, profileResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/auth/me`, {
            credentials: "include",
            headers: { Accept: "application/json" },
          }),
          fetch(`${API_BASE_URL}/developer/profile`, {
            credentials: "include",
            headers: { Accept: "application/json" },
          }),
        ]);

        const me = await meResponse.json().catch(() => null);
        const existing = await profileResponse.json().catch(() => null);

        if (!meResponse.ok) {
          throw new Error(
            typeof me?.detail === "string"
              ? me.detail
              : "Unable to load your account.",
          );
        }

        if (!mounted) return;

        setProfile((current) => ({
          ...current,
          full_name: me?.full_name || current.full_name,
          email: me?.email || current.email,
          ...(profileResponse.ok && existing
            ? {
                phone: existing.phone || "",
                developer_id: existing.developer_id || "",
                designation: existing.designation || "",
                department: existing.department || "",
                experience: existing.experience || "",
                primary_role: existing.primary_role || "",
                skills: existing.skills || "",
                github: existing.github || "",
                linkedin: existing.linkedin || "",
                portfolio: existing.portfolio || "",
                bio: existing.bio || "",
              }
            : {}),
        }));

        if (
          profileResponse.ok &&
          existing?.verification_status === "PENDING"
        ) {
          setSuccess(
            "Your Developer application is pending Super Admin verification.",
          );
        }
      } catch (loadError) {
        if (mounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load developer profile.",
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [API_BASE_URL]);

  const updateField = (
    field: keyof DeveloperProfileData,
    value: string,
  ) => {
    setProfile((current) => ({
      ...current,
      [field]: value,
    }));

    setError("");
    setSuccess("");
  };

  const initials = useMemo(() => {
    const source = profile.full_name.trim() || "Developer";

    return source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }, [profile.full_name]);

  const skills = profile.skills
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!profile.full_name.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (!profile.phone.trim()) {
      setError("Please enter your phone number.");
      return;
    }

    if (!profile.developer_id.trim()) {
      setError("Please enter your developer ID.");
      return;
    }

    if (!profile.designation.trim()) {
      setError("Please enter your designation.");
      return;
    }

    if (!profile.department.trim()) {
      setError("Please enter your department.");
      return;
    }

    if (!profile.primary_role.trim()) {
      setError("Please enter your primary developer role.");
      return;
    }

    if (!profile.skills.trim()) {
      setError(
        "Please enter at least one technical skill.",
      );
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`${API_BASE_URL}/developer/profile`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          developer_id: profile.developer_id.trim(),
          phone: profile.phone.trim(),
          designation: profile.designation.trim(),
          department: profile.department.trim(),
          experience: profile.experience.trim() || null,
          primary_role: profile.primary_role.trim(),
          skills: profile.skills.trim(),
          github: profile.github.trim() || null,
          linkedin: profile.linkedin.trim() || null,
          portfolio: profile.portfolio.trim() || null,
          bio: profile.bio.trim() || null,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          typeof data?.detail === "string"
            ? data.detail
            : "Unable to submit developer profile.",
        );
      }

      setSuccess(
        "Developer profile submitted successfully. Your application is now pending Super Admin verification.",
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to submit developer profile.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="developer-profile-page">
        <main className="developer-profile-shell">
          <div className="developer-profile-card" style={{ marginTop: 80 }}>
            <div className="developer-alert developer-alert-success">
              Loading Developer profile...
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="developer-profile-page">
      <div className="developer-profile-background">
        <div className="developer-profile-glow developer-profile-glow-one" />
        <div className="developer-profile-glow developer-profile-glow-two" />
        <div className="developer-profile-grid" />
      </div>

      <main className="developer-profile-shell">

        {/* =====================================================
            TOP BAR
        ===================================================== */}

        <header className="developer-profile-topbar">
          <div className="developer-profile-brand">
            <img
              src="/edusphere-logo.jpeg"
              alt="EduSphere"
              className="developer-profile-brand-logo"
            />

            <div className="developer-profile-brand-copy">
              <span className="developer-profile-brand-name">
                EduSphere
              </span>

              <span className="developer-profile-brand-subtitle">
                Developer Platform
              </span>
            </div>
          </div>

          <button
            type="button"
            className="developer-profile-back"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={15} />
            <span>Back</span>
          </button>
        </header>

        {/* =====================================================
            HERO
        ===================================================== */}

        <section className="developer-profile-hero">
          <div className="developer-profile-kicker">
            <span className="developer-profile-kicker-dot" />
            DEVELOPER ACCOUNT SETUP
            <Sparkles size={13} />
          </div>

          <h1 className="developer-profile-title">
            Build the{" "}
            <span className="developer-profile-title-gradient">
              EduSphere ecosystem
            </span>
          </h1>

          <p className="developer-profile-description">
            Complete your developer profile to access platform
            development tools, technical operations and EduSphere
            Library management.
          </p>
        </section>

        {/* =====================================================
            CONTENT
        ===================================================== */}

        <div className="developer-profile-content">

          <form
            className="developer-profile-card"
            onSubmit={handleSubmit}
          >

            {error && (
              <div className="developer-alert developer-alert-error">
                {error}
              </div>
            )}

            {success && (
              <div className="developer-alert developer-alert-success">
                {success}
              </div>
            )}

            {/* =================================================
                PERSONAL INFORMATION
            ================================================= */}

            <section>
              <div className="developer-section-header">
                <div className="developer-section-heading">
                  <span className="developer-section-number">
                    01
                  </span>

                  <div>
                    <h2 className="developer-section-title">
                      Personal Information
                    </h2>

                    <p className="developer-section-description">
                      Your basic EduSphere account information
                    </p>
                  </div>
                </div>
              </div>

              <div className="developer-form-grid">

                <label className="developer-field">
                  <span className="developer-field-label">
                    <UserRound size={14} />
                    Full Name *
                  </span>

                  <input
                    className="developer-field-input"
                    value={profile.full_name}
                    onChange={(event) =>
                      updateField(
                        "full_name",
                        event.target.value,
                      )
                    }
                    placeholder="Enter your full name"
                  />
                </label>

                <label className="developer-field">
                  <span className="developer-field-label">
                    <Mail size={14} />
                    Email
                  </span>

                  <input
                    className="developer-field-input"
                    value={profile.email}
                    onChange={(event) =>
                      updateField(
                        "email",
                        event.target.value,
                      )
                    }
                    placeholder="developer@edusphere.local"
                    type="email"
                  />
                </label>

                <label className="developer-field">
                  <span className="developer-field-label">
                    <Phone size={14} />
                    Phone Number *
                  </span>

                  <input
                    className="developer-field-input"
                    value={profile.phone}
                    onChange={(event) =>
                      updateField(
                        "phone",
                        event.target.value,
                      )
                    }
                    placeholder="+91 XXXXX XXXXX"
                  />
                </label>

                <label className="developer-field">
                  <span className="developer-field-label">
                    <BadgeCheck size={14} />
                    Developer ID *
                  </span>

                  <input
                    className="developer-field-input"
                    value={profile.developer_id}
                    onChange={(event) =>
                      updateField(
                        "developer_id",
                        event.target.value,
                      )
                    }
                    placeholder="DEV-XXXX"
                  />
                </label>

              </div>
            </section>

            {/* =================================================
                DEVELOPER INFORMATION
            ================================================= */}

            <section>
              <div className="developer-section-header">
                <div className="developer-section-heading">
                  <span className="developer-section-number">
                    02
                  </span>

                  <div>
                    <h2 className="developer-section-title">
                      Developer Information
                    </h2>

                    <p className="developer-section-description">
                      Define your technical responsibility inside
                      EduSphere
                    </p>
                  </div>
                </div>
              </div>

              <div className="developer-form-grid">

                <label className="developer-field">
                  <span className="developer-field-label">
                    <BriefcaseBusiness size={14} />
                    Designation *
                  </span>

                  <input
                    className="developer-field-input"
                    value={profile.designation}
                    onChange={(event) =>
                      updateField(
                        "designation",
                        event.target.value,
                      )
                    }
                    placeholder="Software Developer"
                  />
                </label>

                <label className="developer-field">
                  <span className="developer-field-label">
                    <Layers3 size={14} />
                    Department *
                  </span>

                  <input
                    className="developer-field-input"
                    value={profile.department}
                    onChange={(event) =>
                      updateField(
                        "department",
                        event.target.value,
                      )
                    }
                    placeholder="Engineering"
                  />
                </label>

                <label className="developer-field">
                  <span className="developer-field-label">
                    <Code2 size={14} />
                    Primary Developer Role *
                  </span>

                  <input
                    className="developer-field-input"
                    value={profile.primary_role}
                    onChange={(event) =>
                      updateField(
                        "primary_role",
                        event.target.value,
                      )
                    }
                    placeholder="Full Stack Developer"
                  />
                </label>

                <label className="developer-field">
                  <span className="developer-field-label">
                    <BriefcaseBusiness size={14} />
                    Experience
                  </span>

                  <input
                    className="developer-field-input"
                    value={profile.experience}
                    onChange={(event) =>
                      updateField(
                        "experience",
                        event.target.value,
                      )
                    }
                    placeholder="e.g. 2 years"
                  />
                </label>

              </div>
            </section>

            {/* =================================================
                TECHNICAL SKILLS
            ================================================= */}

            <section>
              <div className="developer-section-header">
                <div className="developer-section-heading">
                  <span className="developer-section-number">
                    03
                  </span>

                  <div>
                    <h2 className="developer-section-title">
                      Technical Skills
                    </h2>

                    <p className="developer-section-description">
                      Separate multiple technologies with commas
                    </p>
                  </div>
                </div>
              </div>

              <div className="developer-form-grid">

                <label className="developer-field full">
                  <span className="developer-field-label">
                    <Code2 size={14} />
                    Technologies *
                  </span>

                  <input
                    className="developer-field-input"
                    value={profile.skills}
                    onChange={(event) =>
                      updateField(
                        "skills",
                        event.target.value,
                      )
                    }
                    placeholder="React, TypeScript, Python, FastAPI, MySQL"
                  />
                </label>

                {skills.length > 0 && (
                  <div className="developer-field full">
                    <span className="developer-field-label">
                      <CheckCircle2 size={14} />
                      Added Skills
                    </span>

                    <div className="developer-skills-box">
                      {skills.map((skill) => (
                        <span
                          className="developer-skill"
                          key={skill}
                        >
                          <CheckCircle2 size={11} />
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </section>

            {/* =================================================
                PROFESSIONAL LINKS
            ================================================= */}

            <section>
              <div className="developer-section-header">
                <div className="developer-section-heading">
                  <span className="developer-section-number">
                    04
                  </span>

                  <div>
                    <h2 className="developer-section-title">
                      Professional Links
                    </h2>

                    <p className="developer-section-description">
                      Connect your development portfolio
                    </p>
                  </div>
                </div>
              </div>

              <div className="developer-form-grid">

                <label className="developer-field">
                  <span className="developer-field-label">
                    <Code2 size={14} />
                    GitHub
                  </span>

                  <input
                    className="developer-field-input"
                    value={profile.github}
                    onChange={(event) =>
                      updateField(
                        "github",
                        event.target.value,
                      )
                    }
                    placeholder="https://github.com/username"
                  />
                </label>

                <label className="developer-field">
                  <span className="developer-field-label">
                    <Link size={14} />
                    LinkedIn
                  </span>

                  <input
                    className="developer-field-input"
                    value={profile.linkedin}
                    onChange={(event) =>
                      updateField(
                        "linkedin",
                        event.target.value,
                      )
                    }
                    placeholder="https://linkedin.com/in/username"
                  />
                </label>

                <label className="developer-field full">
                  <span className="developer-field-label">
                    <Globe2 size={14} />
                    Portfolio
                  </span>

                  <input
                    className="developer-field-input"
                    value={profile.portfolio}
                    onChange={(event) =>
                      updateField(
                        "portfolio",
                        event.target.value,
                      )
                    }
                    placeholder="https://yourportfolio.com"
                  />
                </label>

              </div>
            </section>

            {/* =================================================
                ABOUT
            ================================================= */}

            <section>
              <div className="developer-section-header">
                <div className="developer-section-heading">
                  <span className="developer-section-number">
                    05
                  </span>

                  <div>
                    <h2 className="developer-section-title">
                      About Developer
                    </h2>

                    <p className="developer-section-description">
                      Tell the platform about your expertise
                    </p>
                  </div>
                </div>
              </div>

              <div className="developer-form-grid">

                <label className="developer-field full">
                  <span className="developer-field-label">
                    <Sparkles size={14} />
                    Developer Bio
                  </span>

                  <textarea
                    className="developer-field-textarea"
                    value={profile.bio}
                    onChange={(event) =>
                      updateField(
                        "bio",
                        event.target.value,
                      )
                    }
                    placeholder="Describe your development experience, areas of expertise and interests..."
                  />
                </label>

              </div>
            </section>

            {/* =================================================
                ACTIONS
            ================================================= */}

            <div className="developer-profile-actions">
              <button
                type="submit"
                className="developer-save-button"
                disabled={saving}
              >
                <Save size={16} />

                {saving
                  ? "Preparing Profile..."
                  : "Complete Developer Profile"}
              </button>
            </div>

            <div className="developer-security-note">
              <ShieldCheck size={14} />
              Developer access is protected by EduSphere role
              controls.
            </div>

          </form>

          {/* =====================================================
              SIDEBAR
          ===================================================== */}

          <aside className="developer-profile-sidebar">

            <div className="developer-sidebar-card">

              <div className="developer-sidebar-title">
                <Code2 size={16} />
                Developer Access
              </div>

              <div className="developer-access-list">

                <div className="developer-access-item">
                  <div className="developer-access-icon">
                    <Code2 size={15} />
                  </div>

                  <div className="developer-access-copy">
                    <strong>Platform Development</strong>
                    <span>Build and maintain EduSphere</span>
                  </div>
                </div>

                <div className="developer-access-item">
                  <div className="developer-access-icon">
                    <Layers3 size={15} />
                  </div>

                  <div className="developer-access-copy">
                    <strong>System Operations</strong>
                    <span>Technical platform management</span>
                  </div>
                </div>

                <div className="developer-access-item">
                  <div className="developer-access-icon">
                    <BookOpen size={15} />
                  </div>

                  <div className="developer-access-copy">
                    <strong>Library Management</strong>
                    <span>Manage educational resources</span>
                  </div>
                </div>

              </div>
            </div>

            {/* =================================================
                LIBRARY
            ================================================= */}

            <div className="developer-sidebar-card developer-library-card">

              <div className="developer-sidebar-title">
                <BookOpen size={16} />
                EduSphere Library
              </div>

              <p className="developer-library-intro">
                Developer access will include management of
                educational resources across the EduSphere
                platform.
              </p>

              <div className="developer-library-list">

                <div className="developer-library-item">
                  <div className="developer-library-item-copy">
                    <BookOpen size={13} />
                    Books
                  </div>

                  <span className="developer-library-status">
                    Manage
                  </span>
                </div>

                <div className="developer-library-item">
                  <div className="developer-library-item-copy">
                    <Layers3 size={13} />
                    Study Materials
                  </div>

                  <span className="developer-library-status">
                    Manage
                  </span>
                </div>

                <div className="developer-library-item">
                  <div className="developer-library-item-copy">
                    <BookOpen size={13} />
                    E-Books
                  </div>

                  <span className="developer-library-status">
                    Manage
                  </span>
                </div>

                <div className="developer-library-item">
                  <div className="developer-library-item-copy">
                    <Code2 size={13} />
                    Notes & PDFs
                  </div>

                  <span className="developer-library-status">
                    Manage
                  </span>
                </div>

              </div>
            </div>

            {/* =================================================
                PROFILE PREVIEW
            ================================================= */}

            <div className="developer-sidebar-card">

              <div className="developer-sidebar-title">
                <UserRound size={16} />
                Profile Preview
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    display: "grid",
                    placeItems: "center",
                    background:
                      "linear-gradient(135deg, #6366f1, #7c3aed)",
                    color: "#fff",
                    fontWeight: 850,
                    fontSize: 14,
                  }}
                >
                  {initials}
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                  }}
                >
                  <strong
                    style={{
                      color: "#e4e4eb",
                      fontSize: 12,
                    }}
                  >
                    {profile.full_name || "Developer"}
                  </strong>

                  <span
                    style={{
                      color: "#70707c",
                      fontSize: 10,
                    }}
                  >
                    {profile.designation ||
                      "Developer Profile"}
                  </span>
                </div>
              </div>

            </div>

          </aside>
        </div>
      </main>
    </div>
  );
}