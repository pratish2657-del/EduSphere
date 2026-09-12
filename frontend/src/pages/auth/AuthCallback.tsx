import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function AuthCallback() {
  const { user, loading, refreshUser } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadAuthenticatedUser = async () => {
      try {
        await refreshUser();
      } catch (err) {
        console.error("Authentication callback error:", err);

        if (mounted) {
          setError("Unable to load your EduSphere account.");
        }
      }
    };

    loadAuthenticatedUser();

    return () => {
      mounted = false;
    };
  }, [refreshUser]);

  if (error) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-content">
          <div className="auth-loading-brand">EDUSPHERE</div>

          <h1>Authentication Error</h1>

          <p>{error}</p>

          <button
            className="auth-retry-button"
            onClick={() => {
              window.location.href = "/";
            }}
          >
            Return to EduSphere
          </button>
        </div>
      </div>
    );
  }

  if (loading || !user) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-orb" />

        <div className="auth-loading-content">
          <div className="auth-loading-brand">EDUSPHERE</div>

          <div className="auth-loading-text">
            Loading your EduSphere account...
          </div>
        </div>
      </div>
    );
  }

  /*
   * Do not decide the user's destination here.
   *
   * AccessRouter is the single place responsible for:
   * - role
   * - profile completion
   * - professor verification
   * - admin access
   * - developer
   * - super-admin access
   */
  return <Navigate to="/access" replace />;
}