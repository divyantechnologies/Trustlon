export function Field({
  id,
  label,
  error,
  hint,
  aside,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-navy">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 flex items-start gap-1 text-xs text-red-600">
          <svg aria-hidden viewBox="0 0 16 16" className="mt-px h-3.5 w-3.5 shrink-0 fill-current">
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm-.75 3.5h1.5v5h-1.5v-5Zm0 6h1.5V12h-1.5v-1.5Z" />
          </svg>
          {error}
        </p>
      ) : hint ? (
        <div id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </div>
      ) : null}
    </div>
  );
}
