export default function FormField({
  label,
  id,
  error,
  className = "",
  ...inputProps
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="block text-sm font-medium text-slate-700" htmlFor={id}>
        {label}
      </label>
      <input
        className={`form-control ${error ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100" : ""}`}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...inputProps}
      />
      {error && (
        <p className="text-sm text-rose-600" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
