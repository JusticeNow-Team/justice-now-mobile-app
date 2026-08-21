import { useAuthContext } from "./AuthContext";
import { AuthContextValue } from "./types";

/**
 * Hook to access the current authenticated user profile, active role, permissions,
 * and capability checker functions (`can`, `hasRole`).
 */
export function useAuth(): AuthContextValue {
  return useAuthContext();
}
