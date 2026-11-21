
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
import { FormField } from "../../components/ui/FormField";
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
      <h1 className="text-2xl font-semibold text-stock-deep-navy">
        Login
      </h1>

      <p className="mt-1 text-sm text-stock-secondary-text">
        Sign in to your StockPilot account.
      </p>

      {serverError && (
        <div
          role="alert"
          className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {serverError}
        </div>
      )}

      <form
        className="mt-6 space-y-5"
        onSubmit={handleSubmit(onSubmit)}
      >
        <FormField
          id="email"
          label="Email address"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />

        <FormField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password")}
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="h-11 w-full rounded-lg bg-stock-primary-blue px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Signing in..." : "Login"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-stock-secondary-text">
        New user?{" "}
        <Link
          to="/register"
          className="font-medium text-stock-primary-blue hover:underline"
        >
          Register
        </Link>
      </p>
    </AuthLayout>
  );
}
