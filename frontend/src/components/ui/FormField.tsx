import type { InputHTMLAttributes, ReactNode } from "react";

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  children?: ReactNode;
}

export function FormField({
  label,
  error,
  children,
  id,
  ...inputProps
}: FormFieldProps) {
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1.5 block text-sm font-medium text-stock-primary-text">
        {label}
      </span>
      {children ?? (
        <input
          id={id}
          className={[
            "h-11 w-full rounded-lg border bg-white px-3 text-sm text-stock-primary-text outline-none transition",
            "focus:border-stock-primary-blue focus:ring-2 focus:ring-stock-primary-blue/15",
            error ? "border-red-500" : "border-stock-border",
          ].join(" ")}
          {...inputProps}
        />
      )}
      {error && (
        <span className="mt-1.5 block text-sm text-red-600">{error}</span>
      )}
    </label>
  );
}
