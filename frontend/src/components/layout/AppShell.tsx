import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopNavigation } from "./TopNavigation";

export type ShellMode = "business" | "platform";

interface AppShellProps {
  mode: ShellMode;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}

export function AppShell({
  mode,
  title,
  description,
  action,
  children,
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-stock-light-grey text-stock-primary-text">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-stock-deep-navy/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        mode={mode}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <TopNavigation
        mode={mode}
        onMenuClick={() => setSidebarOpen(true)}
      />

      <main className="min-h-screen pt-16 lg:ml-64">
        <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
          <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-[28px] font-semibold leading-9 text-stock-deep-navy">
                {title}
              </h1>
              {description && (
                <p className="mt-1 max-w-3xl text-sm leading-6 text-stock-secondary-text">
                  {description}
                </p>
              )}
            </div>
            {action && <div className="shrink-0">{action}</div>}
          </header>
          <div className="min-w-0">{children}</div>
        </div>
      </main>
    </div>
  );
}
