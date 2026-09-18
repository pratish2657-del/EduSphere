import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  ShieldCheck,
  Code,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

type Role = "STUDENT" | "PROFESSOR" | "DEVELOPER" | "ADMIN" | "SUPER_ADMIN" | "NULL";

const roleOptions = [
  {
    role: "STUDENT" as const,
    title: "Student",
    eyebrow: "LEARN & GROW",
    description:
      "Access courses, timetable, attendance, results, events and your complete academic workspace.",
    icon: UserRound,
    features: ["Academic dashboard", "Courses & timetable", "Attendance & results"],
  },
  {
    role: "PROFESSOR" as const,
    title: "Professor",
    eyebrow: "TEACH & MANAGE",
    description:
      "Create your academic profile and access your professor workspace after EduSphere verification.",
    icon: BriefcaseBusiness,
    features: ["Professor dashboard", "Courses & timetable", "Academic management"],
  },
  {
    role: "DEVELOPER" as const,
    title: "Developer",
    eyebrow: "BUILD & INNOVATE",
    description:
      "Access to APIs, SDKs and developer tools for building on EduSphere. And Library Management for Academic Resources.",
    icon: Code,
    features: ["Developer dashboard", "System development", "Technical management", "Library Management"],
  },
  {
    role: "ADMIN" as const,
    title: "Admin",
    eyebrow: "INSTITUTION OPERATIONS",
    description:
      "Manage your institution's users, professor verification, courses, timetable, events and academic operations.",
    icon: ShieldCheck,
    features: ["Admin dashboard", "User & faculty management", "Academic operations"],
  },
  {
    role: "SUPER_ADMIN" as const,
    title: "Super Admin",
    eyebrow: "PLATFORM CONTROL",
    description:
      "Manage EduSphere at platform level, including institutions, administrators, access controls and system-wide operations.",
    icon: ShieldCheck,
    features: ["Platform dashboard", "Institution management", "Admin & access control"],
  },
];

export default function ProfileSetup() {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  const handleContinue = () => {
    if (!selectedRole) return;

    if (selectedRole === "STUDENT") {
      navigate("/auth/profile/student");
      return;
    }

    if (selectedRole === "PROFESSOR") {
      navigate("/auth/profile/professor");
      return;
    }

    if (selectedRole === "DEVELOPER") {
      navigate("/auth/profile/developer");
      return;
    }

    if (selectedRole === "ADMIN") {
      navigate("/auth/profile/admin");
      return;
    }

    navigate("/auth/profile/super-admin");
  };

  useEffect(() => {
    const styleId = "edusphere-profile-setup-styles";

    if (document.getElementById(styleId)) {
      return;
    }

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .edusphere-profile-page {
        min-height: 100vh;
        min-height: 100dvh;
        background:
          radial-gradient(circle at 15% 10%, rgba(99, 102, 241, 0.14), transparent 28%),
          radial-gradient(circle at 85% 20%, rgba(168, 85, 247, 0.12), transparent 26%),
          #050507;
        color: #f7f7fb;
        overflow-x: hidden;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .edusphere-profile-shell {
        width: min(1180px, calc(100% - 40px));
        margin: 0 auto;
        padding: 28px 0 42px;
      }

      .edusphere-profile-topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        margin-bottom: 44px;
      }

      .edusphere-brand {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .edusphere-brand-logo {
        width: 46px;
        height: 46px;
        object-fit: contain;
        border-radius: 12px;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.12);
        box-shadow: 0 10px 35px rgba(0,0,0,0.28);
      }

      .edusphere-brand-copy {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .edusphere-brand-name {
        font-size: 15px;
        font-weight: 800;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }

      .edusphere-brand-tagline {
        color: #9494a3;
        font-size: 11px;
        letter-spacing: 0.06em;
      }

      .edusphere-back-button {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.045);
        color: #d7d7df;
        border-radius: 11px;
        padding: 10px 14px;
        font-size: 13px;
        font-weight: 650;
        cursor: pointer;
        transition: 180ms ease;
      }

      .edusphere-back-button:hover {
        background: rgba(255,255,255,0.08);
        border-color: rgba(255,255,255,0.2);
        transform: translateY(-1px);
      }

      .edusphere-profile-header {
        max-width: 850px;
        margin: 0 auto 38px;
        text-align: center;
      }

      .edusphere-kicker {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        color: #a5a5b5;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.18em;
        margin-bottom: 14px;
      }

      .edusphere-kicker-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #8b5cf6;
        box-shadow: 0 0 16px rgba(139,92,246,0.9);
      }

      .edusphere-profile-title {
        margin: 0;
        font-size: clamp(34px, 5vw, 58px);
        line-height: 1.02;
        letter-spacing: -0.045em;
        font-weight: 850;
      }

      .edusphere-profile-title-gradient {
        background: linear-gradient(90deg, #ffffff 10%, #c4b5fd 48%, #818cf8 92%);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
      }

      .edusphere-profile-subtitle {
        max-width: 670px;
        margin: 17px auto 0;
        color: #9b9ba8;
        font-size: 15px;
        line-height: 1.7;
      }

      .edusphere-role-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 20px;
        max-width: 1000px;
        margin: 0 auto;
      }

      .edusphere-role-card {
        position: relative;
        text-align: left;
        border: 1px solid rgba(255,255,255,0.11);
        border-radius: 22px;
        background:
          linear-gradient(145deg, rgba(255,255,255,0.075), rgba(255,255,255,0.025));
        box-shadow: 0 18px 60px rgba(0,0,0,0.25);
        padding: 27px;
        min-height: 285px;
        color: #fff;
        cursor: pointer;
        overflow: hidden;
        transition: transform 200ms ease, border-color 200ms ease, box-shadow 200ms ease, background 200ms ease;
      }

      .edusphere-role-card::before {
        content: "";
        position: absolute;
        width: 170px;
        height: 170px;
        right: -70px;
        top: -80px;
        border-radius: 50%;
        background: rgba(129,140,248,0.12);
        filter: blur(5px);
        pointer-events: none;
      }

      .edusphere-role-card:hover {
        transform: translateY(-4px);
        border-color: rgba(255,255,255,0.23);
        box-shadow: 0 24px 70px rgba(0,0,0,0.34);
      }

      .edusphere-role-card.selected {
        border-color: rgba(129,140,248,0.85);
        background:
          linear-gradient(145deg, rgba(99,102,241,0.16), rgba(255,255,255,0.035));
        box-shadow:
          0 0 0 1px rgba(129,140,248,0.22),
          0 24px 80px rgba(79,70,229,0.17);
      }

      .edusphere-role-check {
        position: absolute;
        top: 19px;
        right: 19px;
        width: 27px;
        height: 27px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: #6366f1;
        color: white;
        box-shadow: 0 8px 25px rgba(99,102,241,0.4);
      }

      .edusphere-role-icon {
        width: 54px;
        height: 54px;
        display: grid;
        place-items: center;
        border-radius: 16px;
        margin-bottom: 24px;
        color: #d9d6ff;
        background: rgba(129,140,248,0.10);
        border: 1px solid rgba(129,140,248,0.20);
      }

      .edusphere-role-eyebrow {
        color: #8f90a0;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.16em;
      }

      .edusphere-role-title {
        margin: 7px 0 9px;
        font-size: 28px;
        letter-spacing: -0.025em;
      }

      .edusphere-role-description {
        margin: 0;
        color: #a3a3b0;
        font-size: 13px;
        line-height: 1.65;
      }

      .edusphere-role-features {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 22px;
      }

      .edusphere-role-feature {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 9px;
        border-radius: 8px;
        background: rgba(255,255,255,0.045);
        border: 1px solid rgba(255,255,255,0.075);
        color: #b8b8c5;
        font-size: 10px;
        font-weight: 650;
      }

      .edusphere-profile-footer {
        max-width: 1000px;
        margin: 24px auto 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
      }

      .edusphere-security-note {
        display: flex;
        align-items: center;
        gap: 9px;
        color: #777784;
        font-size: 11px;
      }

      .edusphere-security-note svg {
        color: #8b8cf4;
      }

      .edusphere-continue {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 9px;
        min-width: 158px;
        border: 0;
        border-radius: 12px;
        padding: 13px 18px;
        background: linear-gradient(135deg, #6366f1, #7c3aed);
        color: white;
        font-size: 13px;
        font-weight: 800;
        cursor: pointer;
        box-shadow: 0 14px 34px rgba(99,102,241,0.24);
        transition: 180ms ease;
      }

      .edusphere-continue:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 18px 40px rgba(99,102,241,0.34);
      }

      .edusphere-continue:disabled {
        cursor: not-allowed;
        opacity: 0.38;
        box-shadow: none;
        background: #34343d;
      }

      @media (max-width: 1024px) {
        .edusphere-profile-shell {
          width: min(100% - 32px, 920px);
        }
        .edusphere-role-grid {
          gap: 16px;
        }
        .edusphere-role-card {
          padding: 23px;
          min-height: 265px;
        }
        .edusphere-role-title {
          font-size: 25px;
        }
      }

      @media (max-width: 760px) {
        .edusphere-profile-shell {
          width: min(100% - 24px, 600px);
          padding-top: 18px;
        }

        .edusphere-profile-topbar {
          margin-bottom: 32px;
        }

        .edusphere-brand-tagline {
          display: none;
        }

        .edusphere-profile-header {
          margin-bottom: 28px;
        }

        .edusphere-profile-title {
          font-size: 38px;
        }

        .edusphere-profile-subtitle {
          font-size: 13px;
        }

        .edusphere-role-grid {
          grid-template-columns: 1fr;
          gap: 14px;
        }

        .edusphere-role-card {
          min-height: auto;
          padding: 22px;
        }

        .edusphere-profile-footer {
          flex-direction: column;
          align-items: stretch;
        }

        .edusphere-security-note {
          justify-content: center;
        }

        .edusphere-continue {
          width: 100%;
        }

        .edusphere-profile-topbar {
          align-items: flex-start;
          gap: 12px;
        }

        .edusphere-brand-logo {
          width: 40px;
          height: 40px;
        }

        .edusphere-brand-name {
          font-size: 13px;
        }

        .edusphere-back-button {
          padding: 9px 11px;
          font-size: 12px;
        }

        .edusphere-profile-title {
          font-size: clamp(30px, 9vw, 38px);
        }

        .edusphere-profile-subtitle {
          line-height: 1.55;
        }

        .edusphere-role-card {
          padding: 20px;
          min-height: 0;
          border-radius: 18px;
        }

        .edusphere-role-icon {
          width: 46px;
          height: 46px;
          margin-bottom: 18px;
        }

        .edusphere-role-title {
          font-size: 23px;
        }

        .edusphere-role-description {
          font-size: 12px;
        }

        .edusphere-profile-footer {
          flex-direction: column;
          align-items: stretch;
          gap: 14px;
        }

        .edusphere-continue {
          width: 100%;
        }
      }
    `;

    document.head.appendChild(style);

    return () => {
      document.getElementById(styleId)?.remove();
    };
  }, []);

  return (
    <div className="edusphere-profile-page">
      <div className="edusphere-profile-shell">
        <div className="edusphere-profile-topbar">
          <div className="edusphere-brand">
            <img
              src="/edusphere-logo.jpeg"
              alt="EduSphere"
              className="edusphere-brand-logo"
            />

            <div className="edusphere-brand-copy">
              <span className="edusphere-brand-name">EduSphere</span>
              <span className="edusphere-brand-tagline">
                Intelligent Academic Ecosystem
              </span>
            </div>
          </div>

          <button
            type="button"
            className="edusphere-back-button"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={15} />
            Back
          </button>
        </div>

        <header className="edusphere-profile-header">
          <div className="edusphere-kicker">
            <span className="edusphere-kicker-dot" />
            ACCOUNT SETUP
            <Sparkles size={13} />
          </div>

          <h1 className="edusphere-profile-title">
            Choose your{" "}
            <span className="edusphere-profile-title-gradient">
              EduSphere role
            </span>
          </h1>

          <p className="edusphere-profile-subtitle">
            Welcome to EduSphere. Select how you will use the platform.
            You can continue to your role-specific profile setup from here.
          </p>
        </header>

        <section
          className="edusphere-role-grid"
          aria-label="Choose your EduSphere role"
        >
          {roleOptions.map((option) => {
            const Icon = option.icon;
            const selected = selectedRole === option.role;

            return (
              <button
                key={option.role}
                type="button"
                className={`edusphere-role-card${selected ? " selected" : ""}`}
                onClick={() => setSelectedRole(option.role)}
                aria-pressed={selected}
              >
                {selected && (
                  <span className="edusphere-role-check">
                    <Check size={15} strokeWidth={3} />
                  </span>
                )}

                <div className="edusphere-role-icon">
                  <Icon size={27} strokeWidth={1.8} />
                </div>

                <div className="edusphere-role-eyebrow">
                  {option.eyebrow}
                </div>

                <h2 className="edusphere-role-title">{option.title}</h2>

                <p className="edusphere-role-description">
                  {option.description}
                </p>

                <div className="edusphere-role-features">
                  {option.features.map((feature) => (
                    <span
                      key={feature}
                      className="edusphere-role-feature"
                    >
                      <Check size={11} />
                      {feature}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </section>

        <div className="edusphere-profile-footer">
          <div className="edusphere-security-note">
            <ShieldCheck size={15} />
            Your academic profile is protected by EduSphere access controls.
          </div>

          <button
            type="button"
            className="edusphere-continue"
            disabled={!selectedRole}
            onClick={handleContinue}
          >
            Continue
            <ArrowRight size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}
