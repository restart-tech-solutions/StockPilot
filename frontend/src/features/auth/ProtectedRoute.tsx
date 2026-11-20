import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./authContext";

export function ProtectedRoute() {
  const { sessionStatus, validateSession, logout } = useAuth();

  if (sessionStatus === "pending") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stock-light-grey px-4">
        <div
          role="status"
          className="rounded-xl border border-stock-border bg-white px-6 py-5 text-sm text-stock-secondary-text shadow-sm"
        >
          Validating session...
        </div>
      </main>
    );
  }

  if (sessionStatus === "network" || sessionStatus === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stock-light-grey px-4">
        <section className="w-full max-w-md rounded-xl border border-stock-border bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-stock-deep-navy">
            Unable to verify session
          </h1>
          <p className="mt-2 text-sm text-stock-secondary-text">
            {sessionStatus === "network"
              ? "The server is temporarily unavailable."
              : "The server did not confirm your session."}{" "}
            Your session was not cleared.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => void validateSession()}
              className="h-10 rounded-lg bg-stock-primary-blue px-4 text-sm font-semibold text-white"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={logout}
              className="h-10 rounded-lg border border-stock-border px-4 text-sm font-medium text-stock-primary-text"
            >
              Use login
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (sessionStatus === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
