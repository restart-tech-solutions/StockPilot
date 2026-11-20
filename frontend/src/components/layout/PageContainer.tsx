import type { ReactNode } from "react";

interface PageContainerProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}

export function PageContainer({
  title,
  description,
  action,
  children,
}: PageContainerProps) {
  return (
    <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
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
    </main>
  );
}
