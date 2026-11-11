export default function Spinner({ label = "Loading" }) {
  return (
    <div className="flex items-center gap-3 text-sm font-medium text-slate-600" role="status">
      <span className="size-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand-700" />
      <span>{label}</span>
    </div>
  );
}
