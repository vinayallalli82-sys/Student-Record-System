const variants = {
  primary:
    "bg-brand-700 text-white shadow-sm hover:bg-brand-800 focus-visible:ring-brand-500",
  secondary:
    "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-brand-500",
  ghost:
    "text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-brand-500",
};

export default function Button({
  as: Component = "button",
  children,
  className = "",
  variant = "primary",
  ...props
}) {
  return (
    <Component
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}
