import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function AccessRouter() {
  const { user, loading, refreshUser } = useAuth();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkAccess = async () => {
      try {
        await refreshUser();
      } finally {
        if (mounted) {
          setChecking(false);
        }
      }
    };

    checkAccess();

    return () => {
      mounted = false;
    };
  }, [refreshUser]);

  if (loading || checking) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-orb" />

        <div className="auth-loading-content">
          <div className="auth-loading-brand">EDUSPHERE</div>
          <div className="auth-loading-text">
            Checking your access...
          </div>
        </div>
      </div>
    );
  }

  // No authenticated session.
  if (!user) {
    return <Navigate to="/" replace />;
  }

  /*
   * SUPER ADMIN
   *
   * Super admins are trusted platform-level accounts.
   * They do not enter the normal student/professor onboarding flow.
   */
  if (user.role === "SUPER_ADMIN" && user.is_super_admin) {
    return <Navigate to="/app/super-admin" replace />;
  }

  /*
   * ADMIN
   */
  if (user.role === "ADMIN") {
    if (!user.profile_completed) {
      return <Navigate to="/auth/profile/admin" replace />;
    }

    return <Navigate to="/app/admin" replace />;
  }

  
  /*
   * PROFESSOR
   *
   * A professor must have a completed profile before
   * entering the professor platform.
   *
   * Verification is handled separately from authentication.
   */
  if (user.role === "PROFESSOR") {
    if (!user.profile_completed) {
      return <Navigate to="/auth/profile" replace />;
    }

    if (
      (user as typeof user & { verification_status?: string })
        .verification_status !== "VERIFIED"
    ) {
      return <Navigate to="/auth/professor-verification" replace />;
    }

    return <Navigate to="/app/professor" replace />;
  }

  /*
   * DEVELOPER
   *
   * A Developer profile is submitted for Super Admin verification.
   * Pending/rejected Developers stay in the Developer onboarding flow;
   * verified Developers enter the Developer dashboard.
   */
  if (user.role === "DEVELOPER") {
    const verificationStatus = (
      user as typeof user & { verification_status?: string }
    ).verification_status;

    if (!user.profile_completed || verificationStatus === "REJECTED") {
      return <Navigate to="/auth/developer" replace />;
    }

    if (verificationStatus !== "VERIFIED") {
      return <Navigate to="/auth/developer" replace />;
    }

    return <Navigate to="/app/developer" replace />;
  }

  /*
   * STUDENT
   */
  if (user.role === "STUDENT") {
    if (!user.profile_completed) {
      return <Navigate to="/auth/profile" replace />;
    }

    return <Navigate to="/app/student" replace />;
  }

  /*
   * USER / NULL
   *
   * Newly authenticated accounts without a role
   * must enter the normal role-selection flow.
   */
  return <Navigate to="/auth/profile" replace />;
}