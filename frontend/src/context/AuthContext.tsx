import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { api } from "../services/api";

export type UserRole =
  | "STUDENT"
  | "PROFESSOR"
  | "ADMIN"
  | "DEVELOPER"
  | "SUPER_ADMIN"
  | "USER"
  | null;

export type AuthUser = {
  user_id: number;
  email: string;
  full_name: string | null;
  role: UserRole;
  profile_completed: boolean;
  verification_status: string | null;
  is_super_admin: boolean;
  is_active: boolean;
  next_step: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  authenticated: boolean;
  refreshUser: () => Promise<AuthUser | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

function normalizeUser(currentUser: unknown): AuthUser {
  const data = currentUser as Record<string, unknown>;

  return {
    user_id: Number(data.user_id),
    email: String(data.email ?? ""),
    full_name:
      data.full_name === null ||
      data.full_name === undefined
        ? null
        : String(data.full_name),

    role: (data.role ?? null) as UserRole,

    profile_completed: Boolean(
      data.profile_completed,
    ),

    verification_status:
      data.verification_status === null ||
      data.verification_status === undefined
        ? null
        : String(data.verification_status),

    is_super_admin: Boolean(
      data.is_super_admin,
    ),

    is_active: Boolean(data.is_active),

    next_step: String(
      data.next_step ?? "MANDATORY_PROFILE",
    ),
  };
}

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] =
    useState<AuthUser | null>(null);

  const [loading, setLoading] =
    useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await api.auth.me();

      const normalizedUser =
        normalizeUser(currentUser);

      setUser(normalizedUser);

      return normalizedUser;
    } catch (error) {
      console.error(
        "Unable to refresh authenticated user:",
        error,
      );

      setUser(null);

      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      try {
        const currentUser =
          await api.auth.me();

        const normalizedUser =
          normalizeUser(currentUser);

        if (mounted) {
          setUser(normalizedUser);
        }
      } catch {
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadUser();

    return () => {
      mounted = false;
    };
  }, []);

  const logout = async () => {
    try {
      await api.auth.logout();
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authenticated: Boolean(user),
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider",
    );
  }

  return context;
}