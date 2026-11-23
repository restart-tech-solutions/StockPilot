
import type { ReactNode } from "react";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-white">
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* Left: Authentication */}
        <section className="flex min-h-screen flex-col px-6 py-7 sm:px-12 lg:px-16 xl:px-24">
          <LinkBrand />

          <div className="flex flex-1 items-center justify-center py-12">
            <div className="w-full max-w-md">
              {children}
            </div>
          </div>

          <footer className="flex flex-col gap-2 border-t border-slate-100 pt-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <span>© {new Date().getFullYear()} StockPilot. All rights reserved.</span>
            <span>Built for smarter business management.</span>
          </footer>
        </section>

        {/* Right: Brand experience */}
        <aside className="relative hidden overflow-hidden bg-[#0B1830] lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute -bottom-40 -left-32 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium tracking-wide text-blue-200">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              SMARTER BUSINESS OPERATIONS
            </div>
          </div>

          <div className="relative z-10 my-12">
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.25em] text-blue-300">
              Control your business
            </p>

            <h2 className="max-w-xl text-4xl font-bold leading-tight tracking-tight text-white xl:text-5xl">
              Everything your business needs,
              <span className="text-blue-400"> in one place.</span>
            </h2>

            <p className="mt-6 max-w-lg text-base leading-8 text-slate-300">
              Manage inventory, track sales, organize purchases and understand
              your business performance with StockPilot.
            </p>

            {/* Dashboard preview */}
            <div className="mt-12 rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <p className="text-sm font-semibold text-white">
                    Business overview
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Your operations at a glance
                  </p>
                </div>
                <span className="rounded-lg bg-blue-500/15 px-3 py-1.5 text-xs font-medium text-blue-300">
                  Overview
                </span>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                {[
                  { label: "Inventory", value: "Manage" },
                  { label: "Sales", value: "Track" },
                  { label: "Reports", value: "Analyze" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-white/10 bg-white/[0.04] p-3"
                  >
                    <p className="text-[11px] text-slate-400">
                      {item.label}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex h-20 items-end gap-2">
                {[35, 55, 42, 72, 50, 85, 65, 95, 70, 100, 78, 90].map(
                  (height, index) => (
                    <div
                      key={index}
                      className="flex-1 rounded-t-md bg-gradient-to-t from-blue-700 to-cyan-400 opacity-80"
                      style={{ height: `${height}%` }}
                    />
                  )
                )}
              </div>
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-between text-xs text-slate-400">
            <span>Technology That Moves You Forward.</span>
            <span>StockPilot</span>
          </div>
        </aside>
      </div>
    </main>
  );
}

function LinkBrand() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#153B75] text-white shadow-lg shadow-blue-900/15">
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z" />
          <path d="m4.5 7.8 7.5 4.3 7.5-4.3M12 12.1V21" />
          <path d="m8 5.3 8 4.5" />
        </svg>
      </div>

      <div>
        <p className="text-xl font-bold tracking-tight text-[#10213D]">
          StockPilot
        </p>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Business management
        </p>
      </div>
    </div>
  );
}
