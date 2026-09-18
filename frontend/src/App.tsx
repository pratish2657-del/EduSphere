import {
  ArrowRight,
  BookOpen,
  Brain,
  CalendarDays,
  ChevronDown,
  GraduationCap,
  Sparkles,
  Users,
  ShieldCheck,
  Layers3,
  Code,
} from "lucide-react";

import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import AuthCallback from "./pages/auth/AuthCallback";
import AccessRouter from "./pages/auth/AccessRouter";
import ProfileSetup from "./pages/auth/ProfileSetup";
import StudentProfile from "./pages/auth/StudentProfile";
import EduSphere3D from "./components/three/EduSphere3D";
import AppPlaceholder from "./pages/auth/AppPlaceholder";
import ProfessorProfile from "./pages/auth/ProfessorProfile";
import ProfessorDashboard from "./pages/auth/ProfessorDashboard";
import ProfessorMyCourses from "./pages/auth/ProfessorMyCourses";
import ProfessorStudents from "./pages/auth/ProfessorStudents";
import ProfessorTimetable from "./pages/auth/ProfessorTimetable";
import ProfessorAttendance from "./pages/auth/ProfessorAttendance";
import ProfessorResults from "./pages/auth/ProfessorResults";
import ProfessorMarketplace from "./pages/auth/ProfessorMarketplace";
import AdminDashboard from "./pages/auth/AdminDashboard";
import AdminProfile from "./pages/auth/AdminProfile";
import AdminApplications from "./pages/super-admin/AdminApplications";
import AdminUsers from "./pages/admin/AdminUsers";
import EduSphereAI from "./pages/admin/EduSphereAI";
import ProfessorVerification from "./pages/admin/ProfessorVerification";
import AdminCourses from "./pages/admin/AdminCourses";
import AdminTimetable from "./pages/admin/AdminTimetable";
import AdminAttendance from "./pages/admin/AdminAttendance";
import AdminResults from "./pages/admin/AdminResults";
import AdminEvents from "./pages/admin/AdminEvents";
import AdminMarketplace from "./pages/admin/AdminMarketplace";
import AdminMarketplaceManagement from "./pages/admin/AdminMarketplaceManagement";
import SuperAdminDashboard from "./pages/super-admin/SuperAdminDashboard";
import SuperAdminInstitutions from "./pages/super-admin/SuperAdminInstitutions";
import SuperAdminUsers from "./pages/super-admin/SuperAdminUsers";
import SuperAdminCourses from "./pages/super-admin/SuperAdminCourses";
import EduSphereAI1 from "./pages/super-admin/EduSphereAI";
import SuperAdminActivity from "./pages/super-admin/SuperAdminActivity";
import SuperAdminMarketplaceManagement from "./pages/super-admin/SuperAdminMarketplaceManagement";
import SuperAdminMarketplace from "./pages/super-admin/SuperAdminMarketplace";
import MarketplaceRouteOnboarding from "./pages/auth/MarketplaceRouteOnboarding";
import MarketplacePayoutManagement from "./pages/admin/MarketplacePayoutManagement";
import SuperAdminMarketplacePayouts from "./pages/super-admin/SuperAdminMarketplacePayouts";
import MarketplaceRefundManagement from "./pages/admin/MarketplaceRefundManagement";
import DeveloperProfile from "./pages/auth/DeveloperProfile";
import DeveloperDashboard from "./pages/developer/DeveloperDashboard";
import DeveloperLibrary from "./pages/developer/DeveloperLibrary";
import DataLayer from "./pages/developer/DataLayer";
import DevelopmentWorkspace from "./pages/developer/DevelopmentWorkspace";
import SystemDevelopment from "./pages/developer/SystemDevelopment";
import DeveloperOverview from "./pages/developer/DeveloperOverview";
import DeveloperSystemLogs from "./pages/developer/DeveloperSystemLogs";
import TechnicalManagement from "./pages/developer/TechnicalManagement";
import DeveloperVerification from "./pages/super-admin/DeveloperVerification";
import LibraryPage from "./pages/library/LibraryPage";
import SuperAdminLibrary from "./pages/super-admin/SuperAdminLibrary";
import SuperAdminDeveloperSubmissions from "./pages/super-admin/SuperAdminDeveloperSubmissions";
import MarketplacePaymentSuccess from "./pages/auth/MarketplacePaymentSuccess";
import ProfessorEvents from "./pages/auth/ProfessorEvents";

type FloatingCardProps = {
  icon: typeof BookOpen;
  title: string;
  subtitle: string;
  className: string;
};

function FloatingCard({
  icon: Icon,
  title,
  subtitle,
  className,
}: FloatingCardProps) {
  return (
    <div className={`floating-card ${className}`}>
      <div className="floating-card-icon">
        <Icon size={21} strokeWidth={1.8} />
      </div>

      <div className="floating-card-content">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>

      <span className="floating-card-status" />
    </div>
  );
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function enterEduSphere() {
  window.location.href =
    `${import.meta.env.DEV ? "http://localhost:8000" : "https://edusphere-fovh.onrender.com"}/auth/google`;
}


function LandingPage() {
  function scrollToSection(arg0: string): void {
    scrollToId(arg0);
  }

  return (
    <div className="edusphere-page">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="hero-header">
        <button
          className="brand"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="EduSphere home"
        >
          <img
            src="/edusphere-logo.jpeg"
            alt="EduSphere"
            className="brand-logo"
          />
        </button>

        <nav className="main-nav">
          <button onClick={() => scrollToId("features")}>
            Features
          </button>

          <button onClick={() => scrollToId("platform")}>
            Platform
          </button>

          <button onClick={() => scrollToId("about")}>
            About
          </button>
        </nav>

        <button
          className="header-enter-button"
          onClick={enterEduSphere}
        >
          <span>Enter EduSphere</span>
          <ArrowRight size={19} />
        </button>
      </header>

      {/* =====================================================
          HERO
      ===================================================== */}

      <main className="hero">

        <div className="hero-grid" />

        <div className="hero-glow hero-glow-left" />
        <div className="hero-glow hero-glow-right" />

        <div className="stars" aria-hidden="true">
          {Array.from({ length: 70 }).map((_, index) => (
            <span
              key={index}
              className="star"
              style={{
                left: `${(index * 47) % 100}%`,
                top: `${(index * 71) % 100}%`,
                animationDelay: `${(index % 7) * 0.45}s`,
              }}
            />
          ))}
        </div>

        {/* =================================================
            LEFT CONTENT
        ================================================= */}

        <section className="hero-content">
          <div className="eyebrow">
            <Sparkles size={17} />
            <span>INTELLIGENT ACADEMIC ECOSYSTEM</span>
          </div>

          <h1>
            Your entire
            <br />

            <span className="gradient-text">
              academic
              <br />
              world.
            </span>

            <br />

            One intelligent
            <br />
            sphere.
          </h1>

          <p>
            EduSphere connects students, professors,
            administrators and academic resources inside
            one intelligent academic universe.
          </p>

          <div className="hero-actions">
            <button
              className="primary-button"
              onClick={enterEduSphere}
            >
              Enter EduSphere
              <ArrowRight size={20} />
            </button>

            <button
              className="secondary-button"
              onClick={() => scrollToId("platform")}
            >
              Explore platform
            </button>
          </div>
        </section>

        {/* =================================================
            3D WORLD
        ================================================= */}

        <section className="sphere-area" aria-label="EduSphere 3D">

          <div className="sphere-back-glow" />

          <div className="sphere-container">
            <EduSphere3D />
          </div>

          {/* Floating cards are deliberately positioned
              only inside the sphere side of the hero. */}

          <FloatingCard
            icon={BookOpen}
            title="Courses"
            subtitle="Academic learning"
            className="courses-card"
          />

          <FloatingCard
            icon={Brain}
            title="AI Assistant"
            subtitle="Smart academic help"
            className="ai-card"
          />

          <FloatingCard
            icon={CalendarDays}
            title="Timetable"
            subtitle="Stay organized"
            className="timetable-card"
          />

        </section>

        <button
          className="scroll-indicator"
          onClick={() => scrollToId("features")}
          aria-label="Scroll to features"
        >
          <ChevronDown size={21} />
        </button>
      </main>

      {/* =====================================================
          FEATURES
      ===================================================== */}

      <section id="features" className="content-section features-section">

        <div className="section-heading">
          <div className="section-label">
            FEATURES
          </div>

          <h2>
            Everything inside
            <span> one sphere.</span>
          </h2>

          <p>
            A unified academic environment designed to keep
            learning, organization and intelligence connected.
          </p>
        </div>

        <div className="feature-grid">

          <article className="feature-card">
            <div className="feature-icon">
              <BookOpen size={26} />
            </div>

            <h3>Academic Management</h3>

            <p>
              Courses, results, attendance and timetables
              connected through one academic platform.
            </p>
          </article>

          <article className="feature-card">
            <div className="feature-icon">
              <Brain size={26} />
            </div>

            <h3>Intelligent AI</h3>

            <p>
              An academic AI assistant designed to work
              alongside your EduSphere environment.
            </p>
          </article>

          <article className="feature-card">
            <div className="feature-icon">
              <CalendarDays size={26} />
            </div>

            <h3>Campus Organization</h3>

            <p>
              Events, schedules and academic activities
              organized inside one intelligent ecosystem.
            </p>
          </article>

        </div>
      </section>

      {/* =====================================================
          PLATFORM
      ===================================================== */}

      <section id="platform" className="content-section platform-section">

        <div className="section-heading">

          <div className="section-label">
            PLATFORM
          </div>

          <h2>
            One platform.
            <span> Every academic role.</span>
          </h2>

          <p>
            EduSphere provides role-aware experiences for
            everyone participating in the academic ecosystem.
          </p>

        </div>

        <div className="role-grid">

          <article className="role-card">
            <div className="role-icon">
              <GraduationCap size={27} />
            </div>

            <div>
              <span className="role-number">01</span>
              <h3>Students</h3>
              <p>
                Courses, attendance, results, timetable,
                events and academic assistance.
              </p>
            </div>
          </article>

          <article className="role-card">
            <div className="role-icon">
              <Users size={27} />
            </div>

            <div>
              <span className="role-number">02</span>
              <h3>Professors</h3>
              <p>
                Teaching, courses, schedules and
                academic management.
              </p>
            </div>
          </article>

          <article className="role-card">
            <div className="role-icon">
              <ShieldCheck size={27} />
            </div>

            <div>
              <span className="role-number">03</span>
              <h3>Administrators</h3>
              <p>
                Institutional resources, users, events
                and academic operations.
              </p>
            </div>
          </article>

          <article className="role-card">
            <div className="role-icon">
              <Layers3 size={27} />
            </div>

            <div>
              <span className="role-number">04</span>
              <h3>Super Admin</h3>
              <p>
                Platform-level control across the
                EduSphere ecosystem.
              </p>
            </div>
          </article>
          <article className="role-card">
            <div className="role-icon">
              <Code size={27} />
            </div>

            <div>
              <span className="role-number">05</span>
              <h3>Developers</h3>
              <p>
                Access to APIs, SDKs and developer tools for building on EduSphere.
                And Library Management for Academic Resources.
              </p>
            </div>
          </article>

        </div>
      </section>

      {/* =====================================================
          ABOUT
      ===================================================== */}

      <section id="about" className="content-section about-section">

        <div className="about-orb" />

        <div className="section-heading about-content">

          <div className="section-label">
            ABOUT EDUSPHERE
          </div>

          <h2>
            Your academic world,
            <span> intelligently connected.</span>
          </h2>

          <p>
            EduSphere brings people, academic resources and
            institutional workflows together inside a single
            intelligent academic universe.
          </p>

          <button
            className="primary-button"
            onClick={enterEduSphere}
          >
            Enter EduSphere
            <ArrowRight size={20} />
          </button>

        </div>
      </section>

      {/* =====================================================
          FOOTER
      ===================================================== */}

      <footer className="edusphere-footer">
        <div className="footer-main">
          <div className="footer-brand-block">
            <img
              src="/edusphere-logo.jpeg"
              alt="EduSphere"
              className="footer-logo"
            />

          <div>
            <strong>EduSphere</strong>
            <span>THE INTELLIGENT ACADEMIC ECOSYSTEM</span>
          </div>
        </div>

        <p className="footer-description">
          One intelligent sphere connecting students, professors,
          administrators and academic resources.
          <br/>
          For Marketplace, EduSphere charge a 5% commission on each transaction.
          <br/>
          For any queries, please contact us at 
        </p>

        <div className="footer-links">
          <button onClick={() => scrollToSection("features")}>
            Features
          </button>

          <button onClick={() => scrollToSection("platform")}>
            Platform
          </button>

          <button onClick={() => scrollToSection("about")}>
            About
          </button>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© 2026 EduSphere. All rights reserved.</span>

        <span className="footer-status">
          <i />
          SYSTEM ONLINE
        </span>
        </div>
      </footer>

    </div>
  );
}
export default function App() {
  return (
    <>
      <Routes>
      {/* Public landing page */}
      <Route
        path="/"
        element={<LandingPage />}
      />

      {/* Google OAuth callback */}
      <Route
        path="/auth/callback"
        element={<AuthCallback />}
      />
      <Route path="/access" element={<AccessRouter />} />
      <Route
        path="/auth/profile/student"
        element={<StudentProfile />}
      />
      <Route
        path="/auth/profile/professor"
        element={<ProfessorProfile />}
      />

      {/* Mandatory profile */}
      <Route
        path="/auth/profile"
        element={<ProfileSetup />}
      />

      {/* Temporary authenticated destination */}
      <Route
        path="/app"
        element={<AppPlaceholder />}
      />
      <Route path="/app/student" element={<AppPlaceholder />} />
      <Route path="/auth/developer" element={<DeveloperProfile />} />
      <Route path="/auth/profile/developer" element={<DeveloperProfile />} />
      <Route path="/app/developer" element={<DeveloperDashboard />} />
      <Route path="/app/developer/library" element={<DeveloperLibrary />} />
      <Route path="/app/developer/overview" element={<DeveloperOverview />} />
      <Route path="/app/developer/system-logs" element={<DeveloperSystemLogs />} />
      <Route path="/app/developer/system-development" element={<SystemDevelopment />} />
      <Route path="/app/developer/technical-management" element={<TechnicalManagement />} />
      <Route path="/app/developer/data-layer" element={<DataLayer />} />
      <Route path="/app/developer/development-workspace" element={<DevelopmentWorkspace />} />
      <Route
        path="/app/professor"
        element={<ProfessorDashboard />}
      />
      <Route
        path="/app/professor/courses"
        element={<ProfessorMyCourses />}
      />
      <Route
        path="/app/professor/students"
        element={<ProfessorStudents />}
      />
      <Route
        path="/app/professor/timetable"
        element={<ProfessorTimetable />}
      />
      <Route
        path="/app/professor/attendance"
        element={<ProfessorAttendance />}
      />
      <Route
        path="/app/professor/results"
        element={<ProfessorResults />}
      />
      <Route
        path="/app/professor/marketplace"
        element={<ProfessorMarketplace />}
      />
      <Route 
        path="/app/professor/events"
        element={<ProfessorEvents/>}
      />
      <Route path="/app/admin" element={<AdminDashboard />} />
      <Route path="/auth/profile/admin" element={<AdminProfile />} />
      <Route
        path="/app/admin/users"
        element={<AdminUsers />}
      />
      <Route
        path="/app/admin/edusphere-ai"
        element={<EduSphereAI />}
      />
      <Route
        path="/app/super-admin/admin-requests"
        element={<AdminApplications />}
      />
      <Route
        path="/app/super-admin/developer-verifications"
        element={<DeveloperVerification />}
      />
      <Route
        path="/app/admin/professor-verification"
        element={<ProfessorVerification />}
      />
      <Route path="/app/admin/courses" element={<AdminCourses />} />
      <Route
        path="/app/admin/timetable"
        element={<AdminTimetable />}
      />
      <Route
        path="/app/admin/attendance"
        element={<AdminAttendance />}
      />
      <Route
        path="/app/admin/results"
        element={<AdminResults />}
      />
      <Route
        path="/app/admin/events"
        element={<AdminEvents />}
      />
      <Route
        path="/app/admin/marketplace"
        element={<AdminMarketplace />}
      />
      <Route
        path="/app/admin/marketplace-management"
        element={<AdminMarketplaceManagement />}
      />
      <Route path="/app/library" element={<LibraryPage />} />
      <Route path="/app/super-admin/library" element={<SuperAdminLibrary />} />
      <Route path="/app/admin/marketplace-payouts" element={<MarketplacePayoutManagement />} />
      <Route path="/app/admin/marketplace-refunds" element={<MarketplaceRefundManagement />} />
      <Route
        path="/app/super-admin"
        element={<SuperAdminDashboard />}
      />
      <Route
        path="/app/super-admin/institutions"
        element={<SuperAdminInstitutions />}
      />
      <Route
        path="/app/super-admin/users"
        element={<SuperAdminUsers />}
      />
      <Route
        path="/app/super-admin/courses"
        element={<SuperAdminCourses />}
      />
      <Route
        path="/app/super-admin/edusphere-ai"
        element={<EduSphereAI1 />}
      />
      <Route
        path="/app/super-admin/activity"
        element={<SuperAdminActivity />}
      />
      <Route
        path="/app/super-admin/marketplace"
        element={<SuperAdminMarketplace />}
      />
      <Route
        path="/app/super-admin/marketplace-management"
        element={<SuperAdminMarketplaceManagement />}
      />
      <Route
        path="/app/super-admin/developer-submissions"
        element={<SuperAdminDeveloperSubmissions />}
      />
      <Route path="/app/super-admin/marketplace-payouts" element={<SuperAdminMarketplacePayouts />} />
      <Route path="/app/marketplace/seller/route-onboarding" element={<MarketplaceRouteOnboarding />} />
      <Route
        path="/app/marketplace/payment-success"
        element={
        <MarketplacePaymentSuccess />}
      />
      {/* Unknown URL */}
      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />
      </Routes>
    </>
    
  );
}