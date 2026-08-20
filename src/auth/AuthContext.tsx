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
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const permissions = useMemo(() => {
    return getPermissionsForRole(role);
  }, [role]);

  const loadUserProfile = useCallback(async (userId: string, email?: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role, created_at, updated_at")
        .eq("id", userId)
        .single();

      if (error || !data) {
        console.warn("Could not load user profile:", error?.message);
        setUser(null);
        setRole(null);
        return;
      }

      const normalized = normalizeRole(data.role) || "reporter";

      setUser({
        id: data.id,
        email: email,
        full_name: data.full_name,
        role: normalized,
        created_at: data.created_at,
        updated_at: data.updated_at,
      });

      setRole(normalized);
    } catch (err) {
      console.error("Error loading user profile:", err);
      setUser(null);
      setRole(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (authUser) {
        await loadUserProfile(authUser.id, authUser.email);
      } else {
        setUser(null);
        setRole(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [loadUserProfile]);

  useEffect(() => {
    let isMounted = true;

    async function initializeAuth() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user && isMounted) {
          await loadUserProfile(session.user.id, session.user.email);
        }
      } catch (err) {
        console.error("Failed to initialize auth:", err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await loadUserProfile(session.user.id, session.user.email);
      } else {
        setUser(null);
        setRole(null);
      }
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadUserProfile]);

  const can = useCallback(
    (permission: Permission): boolean => {
      return hasPermission(role, permission);
    },
    [role]
  );

  const hasRole = useCallback(
    (requiredRole: SystemRole | SystemRole[]): boolean => {
      if (!role) return false;
      if (Array.isArray(requiredRole)) {
        return requiredRole.includes(role);
      }
      return role === requiredRole;
    },
    [role]
  );

  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
      setUser(null);
      setRole(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const contextValue = useMemo<AuthContextValue>(
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
    }),
    [user, role, permissions, isLoading, can, hasRole, signOut, refreshProfile]
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}
