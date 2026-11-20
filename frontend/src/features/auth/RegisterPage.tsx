
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  updateProfile,
} from "firebase/auth";
import { auth } from "../../config/firebase";
import { FormField } from "../../components/ui/FormField";
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

function getFirebaseErrorMessage(error: any): string {
  switch (error?.code) {
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

export function RegisterPage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
  });

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

      // Redirect to login after a short confirmation.
      navigate("/login", {
        replace: true,
        state: {
          message:
            "Registration successful. Verify your email before logging in.",
        },
      });
    } catch (error: any) {
      console.error("Registration error:", error);

      // If an account was created but verification failed,
      // sign out to avoid opening an unverified application session.
      if (auth.currentUser && !auth.currentUser.emailVerified) {
        await signOut(auth).catch(() => undefined);
      }

      setServerError(getFirebaseErrorMessage(error));
    }
  };

  return (
    <AuthLayout>
      <h1 className="text-2xl font-semibold text-stock-deep-navy">
        Create your account
      </h1>

      <p className="mt-1 text-sm text-stock-secondary-text">
        Register for your StockPilot account.
      </p>

      {serverError && (
        <div
          role="alert"
          className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {serverError}
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="mt-5 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700"
        >
          {successMessage}
        </div>
      )}

      <form
        className="mt-6 space-y-5"
        onSubmit={handleSubmit(onSubmit)}
      >
        <FormField
          id="name"
          label="User name"
          autoComplete="name"
          error={errors.name?.message}
          {...register("name")}
        />

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
          autoComplete="new-password"
          error={errors.password?.message}
          {...register("password")}
        />

        <FormField
          id="confirmPassword"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="h-11 w-full rounded-lg bg-stock-primary-blue px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Creating account..." : "Register"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-stock-secondary-text">
        Already have an account?{" "}
        <Link
          to="/login"
          className="font-medium text-stock-primary-blue hover:underline"
        >
          Login
        </Link>
      </p>
    </AuthLayout>
  );
}
