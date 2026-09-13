import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "../lib/supabase";
import { getPermissionsForRole, hasPermission } from "./permissions";
import { normalizeRole } from "./roles";
import { AuthContextValue, Permission, SystemRole, UserProfile } from "./types";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<SystemRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearLocalAuth = useCallback(() => {
    setUser(null);
    setRole(null);
  }, []);

  const loadUserProfile = useCallback(
    async (userId: string, authEmail?: string) => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, email, full_name, role, is_active, status, created_at, updated_at",
        )
        .eq("id", userId)
        .single();

      if (error || !data) {
        console.warn("Could not load user profile:", error?.message);
        clearLocalAuth();
        return;
      }

      const inactive =
        data.is_active === false ||
        data.status === "inactive" ||
        data.status === "suspended";

      if (inactive) {
        clearLocalAuth();
        await supabase.auth.signOut({ scope: "local" });
        return;
      }

      const normalizedRole = normalizeRole(data.role);
      if (!normalizedRole) {
        clearLocalAuth();
        await supabase.auth.signOut({ scope: "local" });
        return;
      }

      setUser({
        id: data.id,
        email: data.email || authEmail,
        full_name: data.full_name,
        role: normalizedRole,
        is_active: data.is_active !== false,
        status: data.status || "active",
        created_at: data.created_at,
        updated_at: data.updated_at,
      });
      setRole(normalizedRole);
    },
    [clearLocalAuth],
  );

  const refreshProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const {
        data: { user: authUser },
        error,
      } = await supabase.auth.getUser();

      if (error || !authUser) {
        clearLocalAuth();
        return;
      }

      await loadUserProfile(authUser.id, authUser.email);
    } finally {
      setIsLoading(false);
    }
  }, [clearLocalAuth, loadUserProfile]);

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) {
          return;
        }

        if (session?.user) {
          await loadUserProfile(session.user.id, session.user.email);
        } else {
          clearLocalAuth();
        }
      } catch (error) {
        console.error("Failed to initialize authentication:", error);
        clearLocalAuth();
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Supabase recommends avoiding awaited database calls directly inside this
      // callback because they can block another auth operation.
      setTimeout(() => {
        if (!mounted) {
          return;
        }

        if (session?.user) {
          void loadUserProfile(session.user.id, session.user.email).finally(() => {
            if (mounted) {
              setIsLoading(false);
            }
          });
        } else {
          clearLocalAuth();
          setIsLoading(false);
        }
      }, 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [clearLocalAuth, loadUserProfile]);

  const permissions = useMemo(() => getPermissionsForRole(role), [role]);

  const can = useCallback(
    (permission: Permission) => hasPermission(role, permission),
    [role],
  );

  const hasRole = useCallback(
    (requiredRole: SystemRole | SystemRole[]) => {
      if (!role) {
        return false;
      }
      return Array.isArray(requiredRole)
        ? requiredRole.includes(role)
        : role === requiredRole;
    },
    [role],
  );

  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      clearLocalAuth();
    } finally {
      setIsLoading(false);
    }
  }, [clearLocalAuth]);

  const loginAsRole = useCallback(
    (targetRole: SystemRole, customName?: string) => {
      const normalizedRole = normalizeRole(targetRole) || "system_admin";
      const names: Record<SystemRole, string> = {
        reporter: "Registered Reporter",
        case_officer: "Case Officer",
        evidence_checker: "Evidence Validator",
        system_admin: "System Administrator",
      };

      setUser({
        id: `mock-${normalizedRole}-${Date.now()}`,
        email: `${normalizedRole}@justicenow.org`,
        full_name: customName || names[normalizedRole],
        role: normalizedRole,
        is_active: true,
        status: "active",
        created_at: new Date().toISOString(),
      });
      setRole(normalizedRole);
      setIsLoading(false);
    },
    [],
  );

  const updateActiveUserRole = useCallback((newRole: SystemRole) => {
    const normalizedRole = normalizeRole(newRole) || "reporter";
    setRole(normalizedRole);
    setUser((current) =>
      current ? { ...current, role: normalizedRole } : null,
    );
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role,
      permissions,
      isAuthenticated: Boolean(user && role),
      isLoading,
      can,
      hasRole,
      signOut,
      refreshProfile,
      loginAsRole,
      updateActiveUserRole,
    }),
    [
      user,
      role,
      permissions,
      isLoading,
      can,
      hasRole,
      signOut,
      refreshProfile,
      loginAsRole,
      updateActiveUserRole,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}