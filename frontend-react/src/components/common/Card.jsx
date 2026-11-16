export default function Card({ children, className = "", ...props }) {
  return (
    <section
      className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card sm:p-6 ${className}`}
      {...props}
    >
      {children}
    </section>
  );
}
