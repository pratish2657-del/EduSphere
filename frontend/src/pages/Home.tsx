import {
  ArrowRight,
  BookOpen,
  Brain,
  CalendarDays,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

import {
  motion,
} from "framer-motion";

import {
  Link,
} from "react-router-dom";

import EduSphere3D from "../components/three/EduSphere3D";

import FloatingTab from "../components/ui/FloatingTab";
import AIChatbot from "../components/ai/AIChatbot";

export default function Home() {
  return (
    <main className="home">

      <nav className="landing-nav">
        <Link
          to="/"
          className="brand"
        >
          <div className="brand-mark">
            <GraduationCap
              size={24}
            />
          </div>

          <span>
            EduSphere
          </span>
        </Link>

        <div className="landing-nav-links">
          <a href="#features">
            Features
          </a>

          <a href="#platform">
            Platform
          </a>

          <a href="#about">
            About
          </a>
        </div>

        <button
          className="nav-login"
          onClick={() => {
            window.location.href =
              "http://localhost:8000/auth/google";
          }}
        >
          Enter EduSphere

          <ArrowRight size={17} />
        </button>
      </nav>

      <section className="hero">

        <div className="hero-grid" />

        <div className="hero-glow hero-glow-one" />

        <div className="hero-glow hero-glow-two" />

        <div className="hero-copy">

          <motion.div
            className="eyebrow"
            initial={{
              opacity: 0,
              y: 20,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
          >
            <Sparkles size={15} />

            INTELLIGENT ACADEMIC
            ECOSYSTEM
          </motion.div>

          <motion.h1
            initial={{
              opacity: 0,
              y: 30,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.7,
            }}
          >
            Your entire

            <span>
              {" "}academic world.
            </span>

            <br />

            One intelligent sphere.
          </motion.h1>

          <motion.p
            initial={{
              opacity: 0,
              y: 20,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              delay: 0.15,
            }}
          >
            EduSphere connects students,
            professors, administrators
            and academic resources
            inside one intelligent
            academic universe.
          </motion.p>

          <div className="hero-actions">

            <button
              className="primary-button"
              onClick={() => {
                window.location.href =
                  "http://localhost:8000/auth/google";
              }}
            >
              Enter EduSphere

              <ArrowRight
                size={18}
              />
            </button>

            <a
              href="#features"
              className="secondary-button"
            >
              Explore platform
            </a>

          </div>

          <div className="hero-stats">

            <div>
              <strong>
                04
              </strong>

              <span>
                Academic roles
              </span>
            </div>

            <div>
              <strong>
                01
              </strong>

              <span>
                Unified ecosystem
              </span>
            </div>

            <div>
              <strong>
                AI
              </strong>

              <span>
                Academic intelligence
              </span>
            </div>

          </div>

        </div>

        <div className="hero-visual">

          <div className="sphere-stage">

            <EduSphere3D />

            <FloatingTab
              title="Courses"
              description="Academic learning"
              icon={
                <BookOpen size={18} />
              }
              className="tab-courses"
            />

            <FloatingTab
              title="AI Assistant"
              description="Smart academic help"
              icon={
                <Brain size={18} />
              }
              className="tab-ai"
              delay={0.5}
            />

            <FloatingTab
              title="Timetable"
              description="Stay organized"
              icon={
                <CalendarDays
                  size={18}
                />
              }
              className="tab-timetable"
              delay={1}
            />

          </div>

        </div>

      </section>

      <section
        id="features"
        className="features"
      >

        <div className="section-heading">

          <span>
            THE ECOSYSTEM
          </span>

          <h2>
            Everything education
            needs.
          </h2>

          <p>
            One connected foundation
            for the modern academic
            journey.
          </p>

        </div>

        <div className="feature-grid">
              {[
                  {
                      icon: BookOpen,
                      title: "Academic Management",
                      description:
                        "Courses, programs, sections and academic information.",
                  },
                  {
                      icon: CalendarDays,
                      title: "Smart Timetable",
                      description:
                        "Actual academic schedules connected to your institution.",
                  },
                  {
                      icon: Brain,
                      title: "AI Assistance",
                      description:
                        "Academic intelligence directly inside EduSphere.",
                  },
                  {
                      icon: ShieldCheck,
                      title: "Secure Access",
                      description:
                        "Role-based access controlled by your backend.",
                  },
                  {
                      icon: Users,
                      title: "Connected Community",
                      description:
                        "Students, professors and administrators together.",
                  },
                  {
                      icon: GraduationCap,
                      title: "Student Experience",
                      description:
                        "One interface for the complete academic journey.",
                  },
                ].map(
                  ({
                      icon: Icon,
                            title,
                            description,
                  }) => (
                      <motion.article
                        className="feature-card"
                        key={title}
                        whileHover={{
                            y: -8,
                        }}
                        transition={{
                            duration: 0.2,
                        }}
                      >
                        <div className="feature-icon">
                          <Icon size={21} />
                        </div>

                        <h3>
                          {title}
                        </h3>

                        <p>
                          {description}
                        </p>
                      </motion.article>
                    ),
              )}
       </div>

      </section>

      <section
        id="platform"
        className="platform-section"
      >

        <div className="section-heading">

          <span>
            ONE PLATFORM
          </span>

          <h2>
            Built for every
            academic role.
          </h2>

        </div>

        <div className="role-grid">

          {[
            "Student",
            "Professor",
            "Admin",
            "Super Admin",
          ].map(
            (role, index) => (
              <div
                className="role-card"
                key={role}
              >
                <span>
                  0{index + 1}
                </span>

                <h3>
                  {role}
                </h3>

                <p>
                  Role-specific tools,
                  permissions and
                  academic workflows.
                </p>

                <ArrowRight
                  size={19}
                />
              </div>
            ),
          )}

        </div>

      </section>

      <section
        id="about"
        className="landing-cta"
      >

        <div>

          <span>
            THE FUTURE OF CAMPUS
            TECHNOLOGY
          </span>

          <h2>
            Welcome to your
            <br />
            academic universe.
          </h2>

        </div>

        <button
          className="primary-button"
          onClick={() => {
            window.location.href =
              "http://localhost:8000/auth/google";
          }}
        >
          Get Started

          <ArrowRight
            size={18}
          />
        </button>

      </section>

      <footer>
        <div className="brand">
          <div className="brand-mark">
            <GraduationCap
              size={20}
            />
          </div>

          <span>
            EduSphere
          </span>
        </div>

        <span>
          Intelligent education.
          Connected.
        </span>

        <span>
          © 2026 EduSphere
        </span>
      </footer>
        <AIChatbot />
    </main>
  );
}