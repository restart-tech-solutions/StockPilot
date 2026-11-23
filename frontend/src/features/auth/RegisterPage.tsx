
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  updateProfile,
} from "firebase/auth";
import { auth } from "../../config/firebase";
import { AuthLayout } from "./AuthLayout";

const registerSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    email: z.string().trim().email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

type RegisterValues = z.infer<typeof registerSchema>;

function getFirebaseErrorMessage(error: unknown): string {
  const firebaseError = error as { code?: string };

  switch (firebaseError?.code) {
    case "auth/email-already-in-use":
      return "An account with this email already exists. Please log in.";

    case "auth/invalid-email":
      return "Please enter a valid email address.";

    case "auth/weak-password":
      return "Password is too weak. Please use a stronger password.";

    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";

    case "auth/network-request-failed":
      return "Network error. Please check your internet connection.";

    default:
      return error instanceof Error
        ? error.message
        : "Unable to create your account. Please try again.";
  }
}

function getPasswordStrength(password: string) {
  if (!password) {
    return { score: 0, label: "", color: "bg-slate-200" };
  }

  let score = 0;

  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) {
    return { score, label: "Weak", color: "bg-red-500" };
  }

  if (score <= 3) {
    return { score, label: "Medium", color: "bg-amber-500" };
  }

  return { score, label: "Strong", color: "bg-emerald-500" };
}

export function RegisterPage() {
  const navigate = useNavigate();

  const [serverError, setServerError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const password = useWatch({
    control,
    name: "password",
    defaultValue: "",
  });

  const passwordStrength = getPasswordStrength(password);

  const onSubmit = async (values: RegisterValues) => {
    setServerError("");
    setSuccessMessage("");

    try {
      const email = values.email.trim().toLowerCase();
      const name = values.name.trim();

      // Create Firebase account.
      const credential = await createUserWithEmailAndPassword(
        auth,
        email,
        values.password
      );

      // Save user's display name in Firebase.
      await updateProfile(credential.user, {
        displayName: name,
      });

      // Send email verification.
      await sendEmailVerification(credential.user);

      // Keep unverified users signed out of the application.
      await signOut(auth);

      setSuccessMessage(
        "Account created successfully! Please check your email and verify your address before logging in."
      );

      navigate("/login", {
        replace: true,
        state: {
          message:
            "Registration successful. Verify your email before logging in.",
        },
      });
    } catch (error: unknown) {
      console.error("Registration error:", error);

      // Sign out unverified users if registration fails midway.
      if (auth.currentUser && !auth.currentUser.emailVerified) {
        await signOut(auth).catch(() => undefined);
      }

      setServerError(getFirebaseErrorMessage(error));
    }
  };

  return (
    <AuthLayout>
      <div className="mb-7">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
          GET STARTED
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-[#10213D] sm:text-4xl">
          Create your account
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-500">
          Join StockPilot and bring your business operations together in
          one place.
        </p>
      </div>

      {serverError && (
        <div
          role="alert"
          className="mb-5 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700"
        >
          <span>{serverError}</span>
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800"
        >
          {successMessage}
        </div>
      )}

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        {/* Full name */}
        <div>
          <label
            htmlFor="name"
            className="mb-2 block text-sm font-semibold text-slate-700"
          >
            Full name
          </label>

          <div className="relative">
            <svg
              viewBox="0 0 24 24"
              className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21a8 8 0 0 1 16 0" />
            </svg>

            <input
              id="name"
              type="text"
              autoComplete="name"
              placeholder="Enter your full name"
              aria-invalid={Boolean(errors.name)}
              {...register("name")}
              className={`h-12 w-full rounded-xl border bg-white pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 ${
                errors.name
                  ? "border-red-400"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            />
          </div>

          {errors.name && (
            <p className="mt-1.5 text-xs text-red-600">
              {errors.name.message}
            </p>
          )}
        </div>

        {/* Email */}
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

        {/* Password */}
        <div>
          <label
            htmlFor="password"
            className="mb-2 block text-sm font-semibold text-slate-700"
          >
            Password
          </label>

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
              autoComplete="new-password"
              placeholder="Create a strong password"
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
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          {password && (
            <div className="mt-2">
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((segment) => (
                  <div
                    key={segment}
                    className={`h-1 flex-1 rounded-full ${
                      segment <= passwordStrength.score
                        ? passwordStrength.color
                        : "bg-slate-200"
                    }`}
                  />
                ))}
              </div>

              <p className="mt-1.5 text-xs text-slate-500">
                Password strength:{" "}
                <span className="font-semibold text-slate-700">
                  {passwordStrength.label}
                </span>
              </p>
            </div>
          )}

          {errors.password && (
            <p className="mt-1.5 text-xs text-red-600">
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Confirm password */}
        <div>
          <label
            htmlFor="confirmPassword"
            className="mb-2 block text-sm font-semibold text-slate-700"
          >
            Confirm password
          </label>

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
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Re-enter your password"
              aria-invalid={Boolean(errors.confirmPassword)}
              {...register("confirmPassword")}
              className={`h-12 w-full rounded-xl border bg-white pl-11 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 ${
                errors.confirmPassword
                  ? "border-red-400"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            />

            <button
              type="button"
              onClick={() =>
                setShowConfirmPassword((current) => !current)
              }
              aria-label={
                showConfirmPassword ? "Hide password" : "Show password"
              }
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            >
              {showConfirmPassword ? "Hide" : "Show"}
            </button>
          </div>

          {errors.confirmPassword && (
            <p className="mt-1.5 text-xs text-red-600">
              {errors.confirmPassword.message}
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
              Creating account...
            </>
          ) : (
            <>
              Create your account
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

      <div className="my-6 flex items-center gap-4">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs text-slate-400">ALREADY REGISTERED?</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <Link
        to="/login"
        className="flex h-12 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800"
      >
        Sign in to your account
      </Link>

      <p className="mt-6 text-center text-xs leading-5 text-slate-400">
        By creating an account, you agree to receive an email verification
        link before accessing your workspace.
      </p>
    </AuthLayout>
  );
}
