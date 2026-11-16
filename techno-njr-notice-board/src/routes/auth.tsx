import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { BrandHeader, navActionClass } from "@/components/campus/BrandHeader";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Faculty Login — Techno NJR Notice Board" },
      { name: "description", content: "Secure sign-in for faculty, HODs and Deans to publish college notices." },
      { property: "og:title", content: "Faculty Login — Techno NJR Notice Board" },
      { property: "og:description", content: "Secure sign-in for faculty, HODs and Deans to publish college notices." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
          toast.error(error.message === "Invalid login credentials" ? "Incorrect email or password." : error.message);
          return;
        }
        navigate({ to: "/dashboard", replace: true });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("If that email has a faculty account, a reset link is on its way.");
        setMode("signin");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <BrandHeader
        action={
          <Link to="/" className={navActionClass}>
            <ArrowLeft className="h-3.5 w-3.5" /> Notices
          </Link>
        }
      />
      <div className="masthead-bg text-masthead-foreground">
        <div className="mx-auto max-w-md px-5 pb-20 pt-8">
          <h1 className="text-2xl font-semibold">Faculty Portal</h1>
          <p className="text-sm text-masthead-muted">For Faculty, HODs &amp; Deans — staff accounts only</p>
        </div>
      </div>

      <main className="mx-auto -mt-12 w-full max-w-md flex-1 px-5 pb-10">
        <form onSubmit={onSubmit} className="card-surface space-y-4 p-5 shadow-lift">
          <div>
            <h2 className="text-lg font-semibold">{mode === "signin" ? "Sign in" : "Reset your password"}</h2>
            <p className="text-sm text-muted-foreground">
              {mode === "signin"
                ? "Use the email and password issued by the institute administrator. New accounts can't be created here."
                : "We'll email you a link to set a new password."}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">College email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@technonjr.org"
              className="h-11"
            />
          </div>

          {mode === "signin" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="text-xs font-semibold text-primary"
                >
                  Forgot password?
                </button>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11"
              />
            </div>
          )}

          <Button type="submit" size="lg" className="h-11 w-full" disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            {mode === "signin" ? "Sign in" : "Send reset link"}
          </Button>

          {mode === "forgot" && (
            <button
              type="button"
              onClick={() => setMode("signin")}
              className="w-full text-center text-sm font-semibold text-muted-foreground"
            >
              Back to sign in
            </button>
          )}
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Students don't need an account — the notice board is open to everyone.
        </p>
      </main>
    </div>
  );
}
