
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth } from "../../config/firebase";
import {
  apiRequest,
  clearStoredSession,
  getStoredToken,
  StockPilotApiError,
} from "../../services/api";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role:
    | "SUPER_ADMIN"
    | "BUSINESS_OWNER"
    | "INVENTORY_MANAGER"
    | "SALES_EMPLOYEE"
    | "ACCOUNTANT";
}

export type SessionStatus =
  | "pending"
  | "authenticated"
  | "unauthenticated"
  | "network"
  | "error";

interface AuthContextValue {
  user: SessionUser | null;
  sessionStatus: SessionStatus;
  validateSession: () => Promise<void>;
  setUser: (user: SessionUser | null) => void;
  logout: () => void;
}

interface AuthResponse {
  success: boolean;
  user: {
    id?: string;
    userId?: string;
    name: string;
    email: string;
    role: SessionUser["role"];
  };
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): SessionUser | null {
  const value = window.localStorage.getItem("stockpilot_user");

  if (!value) return null;

  try {
    return JSON.parse(value) as SessionUser;
  } catch {
    window.localStorage.removeItem("stockpilot_user");
    return null;
  }
}

function saveSessionUser(user: SessionUser) {
  window.localStorage.setItem("stockpilot_user", JSON.stringify(user));
}

function normalizeUser(response: AuthResponse): SessionUser {
  return {
    id: response.user.userId || response.user.id || "",
    name: response.user.name || "",
    email: response.user.email || "",
    role: response.user.role,
  };
}

function isNetworkError(error: unknown): boolean {
  return (
    error instanceof StockPilotApiError &&
    (error.status === 0 || error.status >= 500)
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<SessionUser | null>(readStoredUser);
  const [sessionStatus, setSessionStatus] =
    useState<SessionStatus>("pending");

  const mounted = useRef(false);
  const validationInProgress = useRef(false);

  const setUser = useCallback((nextUser: SessionUser | null) => {
    setUserState(nextUser);

    if (nextUser) {
      saveSessionUser(nextUser);
      setSessionStatus("authenticated");
    } else {
      window.localStorage.removeItem("stockpilot_user");
      setSessionStatus("unauthenticated");
    }
  }, []);

  const logout = useCallback(() => {
    void signOut(auth).catch((error) => {
      console.error("Firebase logout error:", error);
    });

    clearStoredSession();
    setUserState(null);
    setSessionStatus("unauthenticated");
  }, []);

  const syncFirebaseUser = useCallback(
    async (firebaseUser: FirebaseUser): Promise<void> => {
      try {
        await firebaseUser.getIdToken();

        const response = await apiRequest<AuthResponse>(
          "/auth/firebase/sync",
          { method: "POST" }
        );

        if (!response.success || !response.user) {
          throw new Error("Invalid authentication response");
        }

        const authenticatedUser = normalizeUser(response);

        if (!authenticatedUser.id || !authenticatedUser.role) {
          throw new Error("Incomplete user profile received from server");
        }

        if (mounted.current) {
          setUser(authenticatedUser);
        }
      } catch (error) {
        console.error("Firebase session sync error:", error);

        if (!mounted.current) return;

        if (isNetworkError(error)) {
          setSessionStatus("network");
          return;
        }

        if (error instanceof StockPilotApiError && error.status === 403) {
          setUserState(null);
          window.localStorage.removeItem("stockpilot_user");
          setSessionStatus("error");
          return;
        }

        if (error instanceof StockPilotApiError && error.status === 409) {
          // Existing legacy account requires password-based migration.
          setUserState(null);
          window.localStorage.removeItem("stockpilot_user");
          setSessionStatus("error");
          return;
        }

        if (error instanceof StockPilotApiError && error.status === 404) {
          // Firebase account exists but StockPilot registration is pending.
          setUserState(null);
          window.localStorage.removeItem("stockpilot_user");
          setSessionStatus("unauthenticated");
          return;
        }

        setUserState(null);
        setSessionStatus("error");
      }
    },
    [setUser]
  );

  const validateSession = useCallback(async (): Promise<void> => {
    if (validationInProgress.current) return;

    validationInProgress.current = true;
    setSessionStatus("pending");

    try {
      const firebaseUser = auth.currentUser;

      if (firebaseUser) {
        await syncFirebaseUser(firebaseUser);
        return;
      }

      // Backward compatibility for existing JWT sessions.
      const token = getStoredToken();

      if (!token) {
        clearStoredSession();

        if (mounted.current) {
          setUserState(null);
          setSessionStatus("unauthenticated");
        }

        return;
      }

      const response = await apiRequest<AuthResponse>("/auth/me", {
        method: "GET",
      });

      if (!response.success || !response.user) {
        throw new Error("Invalid session response");
      }

      const authenticatedUser = normalizeUser(response);

      if (!authenticatedUser.id || !authenticatedUser.role) {
        throw new Error("Incomplete user profile received from server");
      }

      if (mounted.current) {
        setUser(authenticatedUser);
      }
    } catch (error) {
      console.error("Session validation error:", error);

      if (!mounted.current) return;

      if (isNetworkError(error)) {
        setSessionStatus("network");
        return;
      }

      if (error instanceof StockPilotApiError && error.status === 401) {
        clearStoredSession();
        setUserState(null);
        setSessionStatus("unauthenticated");
        return;
      }

      setSessionStatus("error");
    } finally {
      validationInProgress.current = false;
    }
  }, [setUser, syncFirebaseUser]);

  useEffect(() => {
    mounted.current = true;

    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        if (!mounted.current) return;

        if (firebaseUser) {
          setSessionStatus("pending");
          await syncFirebaseUser(firebaseUser);
          return;
        }

        // If Firebase is signed out, check for an existing legacy JWT.
        const legacyToken = getStoredToken();

        if (legacyToken) {
          await validateSession();
        } else {
          setUserState(null);
          window.localStorage.removeItem("stockpilot_user");
          setSessionStatus("unauthenticated");
        }
      },
      (error) => {
        console.error("Firebase auth listener error:", error);

        if (mounted.current) {
          setSessionStatus("error");
        }
      }
    );

    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, [syncFirebaseUser, validateSession]);

  const value = useMemo(
    () => ({
      user,
      sessionStatus,
      validateSession,
      setUser,
      logout,
    }),
    [user, sessionStatus, validateSession, setUser, logout]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
