import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { CinematicScene } from "@/components/art/CinematicScene";
import { LogoMark } from "@/components/brand/Logo";
import { useAuth } from "./useAuth";
import { safeNext } from "./gate";
import { ApiClientError } from "@/services/api";

type Mode = "login" | "register";
const MIN_PASSWORD = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const field = "bg-background/70 border-border";

export function LoginPage() {
  const { login, register, continueAsGuest } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const initial: Mode = params.get("mode") === "register" || location.pathname === "/register" ? "register" : "login";
  const next = safeNext(params.get("next"));
  const [mode, setMode] = useState<Mode>(initial);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Keep in sync if the user arrives via a different ?mode= link.
  useEffect(() => { setMode(initial); }, [initial]);

  const emailErr = touched && !EMAIL_RE.test(email) ? "Enter a valid email address." : "";
  const pwErr = touched && mode === "register" && password.length < MIN_PASSWORD
    ? `Use at least ${MIN_PASSWORD} characters.` : touched && !password ? "Enter your password." : "";
  const confirmErr = touched && mode === "register" && confirm !== password ? "Passwords don't match." : "";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    setError("");
    const invalid = !EMAIL_RE.test(email) || !password ||
      (mode === "register" && (password.length < MIN_PASSWORD || confirm !== password));
    if (invalid) return;
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password);
      navigate(next);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function switchMode(m: string) {
    setMode(m as Mode);
    setError("");
    setTouched(false);
    setConfirm("");
  }

  function guest() {
    continueAsGuest();
    navigate(next);
  }

  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-hidden bg-background text-foreground">
      <CinematicScene variant="panel" className="-z-10" />
      <div className="absolute inset-0 -z-10 bg-background/35" />

      <div className="px-4 py-5 sm:px-8">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to home
        </Link>
      </div>

      <main className="mx-auto flex w-full max-w-[26rem] flex-1 flex-col items-center justify-center px-4 pb-12">
        <Link to="/" aria-label="CyberShield360 home" className="mb-6 inline-flex items-center gap-2.5 font-display text-2xl font-semibold tracking-tight">
          <LogoMark className="size-8" /> CyberShield360
        </Link>

        <div className="w-full rounded-3xl border border-border bg-card/70 p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-xl sm:p-8">
          <div className="text-center">
            <h1 className="font-display text-[1.65rem] font-semibold leading-tight">
              Welcome to<br />CyberShield360
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === "login" ? "Sign in to continue to a safer internet" : "Create your account to a safer internet"}
            </p>
          </div>

          <Tabs value={mode} onValueChange={switchMode} className="mt-6">
            <TabsList className="grid w-full grid-cols-2 border-border bg-background/70">
              <TabsTrigger value="login">Sign In</TabsTrigger>
              <TabsTrigger value="register">Sign Up</TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={submit} noValidate className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-muted-foreground">Email address</Label>
              <Input id="email" type="email" autoComplete="email" value={email} className={field}
                aria-invalid={!!emailErr} aria-describedby={emailErr ? "email-err" : undefined}
                onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              {emailErr && <p id="email-err" className="text-xs text-danger">{emailErr}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-muted-foreground">Password</Label>
              <div className="relative">
                <PasswordInput id="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  aria-invalid={!!pwErr} aria-describedby="pw-hint"
                  className={mode === "login" ? `${field} pr-36` : field}
                  value={password} onChange={(e) => setPassword(e.target.value)} />
                {mode === "login" && (
                  <Link to="/forgot-password" className="absolute right-11 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-primary">
                    Forgot password?
                  </Link>
                )}
              </div>
              {pwErr ? <p id="pw-hint" className="text-xs text-danger">{pwErr}</p>
                : mode === "register" && <p id="pw-hint" className="text-xs text-muted-foreground">At least {MIN_PASSWORD} characters.</p>}
            </div>
            {mode === "register" && (
              <div className="space-y-1.5">
                <Label htmlFor="confirm" className="text-muted-foreground">Confirm password</Label>
                <PasswordInput id="confirm" autoComplete="new-password" value={confirm} className={field}
                  aria-invalid={!!confirmErr} onChange={(e) => setConfirm(e.target.value)} />
                {confirmErr && <p className="text-xs text-danger">{confirmErr}</p>}
              </div>
            )}
            {error && <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
            <Button type="submit" className="w-full" size="lg" loading={busy}>
              {mode === "login" ? "Sign In" : "Create Account"}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-subtle">
            <span className="h-px flex-1 bg-border" /> or continue with <span className="h-px flex-1 bg-border" />
          </div>
          <SocialButtons />

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>Don't have an account?{" "}
                <button type="button" onClick={() => switchMode("register")} className="font-medium text-primary hover:underline">Sign up</button></>
            ) : (
              <>Already have an account?{" "}
                <button type="button" onClick={() => switchMode("login")} className="font-medium text-primary hover:underline">Sign in</button></>
            )}
          </p>
        </div>

        <button onClick={guest} className="mt-5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Continue as guest
        </button>
        <p className="mt-1 text-center text-xs text-muted-foreground">Guests can use every scanner. History &amp; quizzes need an account.</p>
      </main>
    </div>
  );
}

const PROVIDERS = [
  { name: "Google", icon: (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3Z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14Z" />
      <path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.7 9.4 6 12 6Z" />
    </svg>
  ) },
  { name: "Apple", icon: (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
      <path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8s2 .8 3.4.8c1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.7-1-2.7-4.1ZM13.9 5c.7-.9 1.2-2 1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.1.1 2.3-.6 3.1-1.5Z" />
    </svg>
  ) },
  { name: "Microsoft", icon: (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#F25022" d="M3 3h8.5v8.5H3z" /><path fill="#7FBA00" d="M12.5 3H21v8.5h-8.5z" />
      <path fill="#00A4EF" d="M3 12.5h8.5V21H3z" /><path fill="#FFB900" d="M12.5 12.5H21V21h-8.5z" />
    </svg>
  ) },
];

/** Social sign-in isn't integrated yet: shown disabled and clearly labelled. */
function SocialButtons() {
  return (
    <div>
      <div className="flex justify-center gap-3">
        {PROVIDERS.map((p) => (
          <Tooltip key={p.name}>
            <TooltipTrigger asChild>
              {/* Wrapper keeps the tooltip reachable: disabled buttons get no pointer/focus events. */}
              <span tabIndex={0} aria-label={`${p.name} sign-in, coming soon`}
                className="flex h-11 w-14 cursor-not-allowed items-center justify-center rounded-xl border border-border bg-background/60 opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <button type="button" disabled tabIndex={-1} aria-hidden className="pointer-events-none">{p.icon}</button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{p.name} sign-in — coming soon</TooltipContent>
          </Tooltip>
        ))}
      </div>
      <p className="mt-2 text-center text-[0.7rem] text-subtle">Social sign-in coming soon</p>
    </div>
  );
}
