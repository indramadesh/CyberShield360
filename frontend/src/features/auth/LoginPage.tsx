import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "./useAuth";
import { ApiClientError } from "@/services/api";

export function LoginPage() {
  const { login, register, continueAsGuest } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<"login" | "register">(
    params.get("mode") === "register" ? "register" : "login",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Keep in sync if the user arrives via a different ?mode= link.
  useEffect(() => {
    setMode(params.get("mode") === "register" ? "register" : "login");
  }, [params]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password);
      navigate("/app");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function guest() {
    continueAsGuest();
    navigate("/app");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2 font-semibold">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Shield className="size-4" />
          </span>
          CyberShield 360
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>{mode === "login" ? "Sign in" : "Create your account"}</CardTitle>
            <p className="text-sm text-muted-foreground">
              Save scan history, take quizzes, and track your progress.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" value={email}
                  onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password} onChange={(e) => setPassword(e.target.value)} />
                {mode === "register" && <p className="text-xs text-muted-foreground">At least 10 characters.</p>}
              </div>
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button type="submit" className="w-full" loading={busy}>
                {mode === "login" ? "Sign in" : "Create account"}
              </Button>
            </form>

            <button className="mt-4 w-full text-center text-sm text-primary hover:underline"
              onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
              {mode === "login" ? "Need an account? Create one" : "Already have an account? Sign in"}
            </button>

            <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
              <Separator className="flex-1" /> or <Separator className="flex-1" />
            </div>

            <Button variant="outline" className="w-full" onClick={guest}>
              Continue as guest
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Guests can use every scanner. History &amp; quizzes need an account.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
