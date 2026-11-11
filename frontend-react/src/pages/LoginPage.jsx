import { ArrowRight, BookOpenCheck, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import Button from "../components/common/Button.jsx";
import FormField from "../components/common/FormField.jsx";
import Spinner from "../components/common/Spinner.jsx";
import { useAuth } from "../context/useAuth.js";

const ROLE_HOME = {
  Administrator: "/admin",
  Faculty: "/faculty",
  Student: "/student",
};

export default function LoginPage() {
  const { user, isLoading, login, setNotice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-canvas">
        <Spinner label="Checking your session" />
      </main>
    );
  }

  if (user) {
    return <Navigate to={ROLE_HOME[user.role] || "/unauthorized"} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const signedInUser = await login(email.trim(), password);
      const requestedPath = location.state?.from?.pathname;
      navigate(
        requestedPath && requestedPath !== "/login"
          ? requestedPath
          : ROLE_HOME[signedInUser.role] || "/unauthorized",
        { replace: true },
      );
    } catch (loginError) {
      setError(loginError.message || "Unable to sign in. Please try again.");
      setNotice({ type: "error", message: loginError.message || "Sign in failed." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative grid min-h-screen overflow-hidden bg-white lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-brand-950 p-12 text-white lg:flex xl:p-16">
        <div className="absolute -right-36 -top-32 size-[520px] rounded-full border border-white/10" />
        <div className="absolute -right-20 -top-16 size-[380px] rounded-full border border-white/10" />
        <div className="absolute -bottom-48 -left-36 size-[520px] rounded-full bg-brand-800/50 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15">
            <BookOpenCheck aria-hidden="true" size={24} />
          </span>
          <div>
            <p className="font-bold tracking-tight">Campus</p>
            <p className="text-sm text-blue-100/70">Student Record System</p>
          </div>
        </div>

        <div className="relative max-w-xl py-14">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-blue-100">
            <span className="size-1.5 rounded-full bg-emerald-300" />
            Academic management portal
          </span>
          <h1 className="mt-7 text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
            A clearer view of your academic journey.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-blue-100/75">
            Sign in to your secure workspace for student records and academic
            administration.
          </p>
          <div className="mt-10 flex items-center gap-3 text-sm text-blue-100/75">
            <ShieldCheck aria-hidden="true" size={19} />
            Protected with secure account authentication
          </div>
        </div>

        <p className="relative text-xs text-blue-100/55">
          Student Record System · Secure access
        </p>
      </section>

      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <span className="grid size-11 place-items-center rounded-xl bg-brand-700 text-white">
              <BookOpenCheck aria-hidden="true" size={22} />
            </span>
            <div>
              <p className="font-bold text-slate-900">Campus</p>
              <p className="text-xs text-slate-500">Student Record System</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-brand-700">WELCOME BACK</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Sign in to your account
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Enter the credentials provided for your account.
            </p>
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <FormField
              autoComplete="username"
              id="email"
              label="Email address"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@university.edu"
              required
              type="email"
              value={email}
            />
            <FormField
              autoComplete="current-password"
              id="password"
              label="Password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
            {error && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
                {error}
              </p>
            )}
            <Button className="w-full justify-between py-3" disabled={isSubmitting} type="submit">
              <span>{isSubmitting ? "Signing in..." : "Sign in securely"}</span>
              <ArrowRight aria-hidden="true" size={17} />
            </Button>
          </form>

          <div className="mt-8 flex items-start gap-2.5 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-500">
            <ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0 text-brand-700" size={16} />
            <p>Your session is protected. Sign out when using a shared device.</p>
          </div>
          <p className="mt-8 text-center text-xs text-slate-400">
            Access is managed by your institution.
          </p>
        </div>
      </section>
    </main>
  );
}
