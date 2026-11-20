import type { ReactNode } from "react";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stock-light-grey px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="text-2xl font-bold text-stock-deep-navy">StockPilot</div>
        </div>
        <section className="rounded-xl border border-stock-border bg-white p-6 shadow-sm sm:p-8">
          {children}
        </section>
      </div>
    </main>
  );
}
