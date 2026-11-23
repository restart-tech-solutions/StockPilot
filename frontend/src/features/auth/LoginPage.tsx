
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import {
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { auth } from "../../config/firebase";
import {
  apiRequest,
  StockPilotApiError,
} from "../../services/api";
import { AuthLayout } from "./AuthLayout";
import { useAuth, type SessionUser } from "./authContext";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginValues = z.infer<typeof loginSchema>;

interface AuthResponse {
  success: boolean;
  message?: string;
  user: {
    id?: string;
    userId?: string;
    name: string;
    email: string;
    role: SessionUser["role"];
  };
}

function normalizeUser(response: AuthResponse): SessionUser {
  return {
    id: response.user.userId || response.user.id || "",
    name: response.user.name || "",
    email: response.user.email || "",
    role: response.user.role,
  };
}

export function LoginPage() {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [serverError, setServerError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
  });

  const completeLogin = (response: AuthResponse) => {
    if (!response.success || !response.user) {
      throw new Error(response.message || "Authentication failed.");
    }

    const authenticatedUser = normalizeUser(response);

    if (!authenticatedUser.id || !authenticatedUser.role) {
      throw new Error("Invalid user profile received from server.");
    }

    setUser(authenticatedUser);
    navigate("/workspaces", { replace: true });
  };

  const onSubmit = async (values: LoginValues) => {
    setServerError("");

    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        values.email.trim().toLowerCase(),
        values.password
      );

      if (!credential.user.emailVerified) {
        await signOut(auth);

        throw new Error(
          "Your email is not verified yet. Please check your inbox or spam folder and verify your email before logging in."
        );
      }

      try {
        // Existing Firebase-linked StockPilot account.
        const response = await apiRequest<AuthResponse>(
          "/auth/firebase/sync",
          { method: "POST" }
        );

        completeLogin(response);
        return;
      } catch (syncError) {
        if (!(syncError instanceof StockPilotApiError)) {
          throw syncError;
        }

        if (syncError.status === 409) {
          // Existing MongoDB account: link its Firebase UID.
          const migrationResponse = await apiRequest<AuthResponse>(
            "/auth/firebase/migrate",
            { method: "POST" }
          );

          completeLogin(migrationResponse);
          return;
        }

        if (syncError.status === 404) {
          // Brand-new Firebase account.
          const registrationResponse = await apiRequest<AuthResponse>(
            "/auth/firebase/register",
            {
              method: "POST",
              body: JSON.stringify({}),
            }
          );

          completeLogin(registrationResponse);
          return;
        }

        throw syncError;
      }
    } catch (error) {
      console.error("Login error:", error);

      setServerError(
        error instanceof StockPilotApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unable to log in. Please try again."
      );
    }
  };

  return (
    <AuthLayout>
      <div className="mb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
          WELCOME BACK
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-[#10213D] sm:text-4xl">
          Sign in to StockPilot
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-500">
          Welcome back! Enter your account details to continue managing
          your business.
        </p>
      </div>

      {serverError && (
        <div
          role="alert"
          className="mb-5 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700"
        >
          <svg
            viewBox="0 0 24 24"
            className="mt-0.5 h-5 w-5 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5m0 3h.01" />
          </svg>
          <span>{serverError}</span>
        </div>
      )}

      <form
        className="space-y-5"
        onSubmit={handleSubmit(onSubmit)}
      >
        <div>
          <label
            htmlFor="email"
            className="mb-2 block text-sm font-semibold text-slate-700"
          >
            Email address
          </label>

          <div className="relative">
            <svg
              viewBox="0 0 24 24"
              className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>

            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              aria-invalid={Boolean(errors.email)}
              {...register("email")}
              className={`h-12 w-full rounded-xl border bg-white pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 ${
                errors.email
                  ? "border-red-400"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            />
          </div>

          {errors.email && (
            <p className="mt-1.5 text-xs text-red-600">
              {errors.email.message}
            </p>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-slate-700"
            >
              Password
            </label>
          </div>

          <div className="relative">
            <svg
              viewBox="0 0 24 24"
              className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <rect x="4" y="10" width="16" height="11" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>

            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              aria-invalid={Boolean(errors.password)}
              {...register("password")}
              className={`h-12 w-full rounded-xl border bg-white pl-11 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 ${
                errors.password
                  ? "border-red-400"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            />

            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
            >
              {showPassword ? (
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                  <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 9 5 9 7s-1.5 3.5-3.5 4.8M6.2 6.2C3.7 7.7 3 10 3 12s4 7 9 7c1 0 2-.2 2.9-.5" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>

          {errors.password && (
            <p className="mt-1.5 text-xs text-red-600">
              {errors.password.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#174A91] px-4 text-sm font-semibold text-white shadow-lg shadow-blue-900/15 transition hover:bg-[#123B77] focus:outline-none focus:ring-4 focus:ring-blue-600/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Signing in...
            </>
          ) : (
            <>
              Sign in to your account
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M5 12h14m-6-6 6 6-6 6" />
              </svg>
            </>
          )}
        </button>
      </form>

      <div className="my-7 flex items-center gap-4">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs text-slate-400">NEW TO STOCKPILOT?</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <Link
        to="/register"
        className="flex h-12 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800"
      >
        Create a new account
      </Link>

      <p className="mt-7 text-center text-xs leading-5 text-slate-400">
        Secure access to your business workspace.
        <br />
        Your business data stays organized in one place.
      </p>
    </AuthLayout>
  );
}
