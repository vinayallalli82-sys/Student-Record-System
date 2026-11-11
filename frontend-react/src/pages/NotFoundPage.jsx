import { Link } from "react-router-dom";
import Button from "../components/common/Button.jsx";

export default function NotFoundPage({ unauthorized = false }) {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <p className="text-sm font-bold uppercase tracking-widest text-brand-700">
        {unauthorized ? "Access restricted" : "Page not found"}
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
        {unauthorized ? "This workspace is not available to your role." : "We could not find that page."}
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">
        {unauthorized
          ? "Your account cannot open that role-specific route."
          : "The page may have moved or is not part of this application foundation."}
      </p>
      <Button as={Link} className="mt-7" to="/">
        Return to your workspace
      </Button>
    </div>
  );
}
