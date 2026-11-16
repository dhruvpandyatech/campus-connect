import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Loader2,
  UserCheck,
  GraduationCap,
  School,
} from "lucide-react";
import { BrandHeader, navActionClass } from "@/components/campus/BrandHeader";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Campus Connect Portal — Techno NJR Notice Board" },
      {
        name: "description",
        content:
          "Sign in for faculty, staff, and students with year-wise notice access.",
      },
      {
        property: "og:title",
        content: "Campus Connect Portal — Techno NJR Notice Board",
      },
      {
        property: "og:description",
        content:
          "Sign in for faculty, staff, and students with year-wise notice access.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

type AuthMode = "signin" | "signup_student" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [studentYear, setStudentYear] = useState<"1" | "2" | "3" | "4">("1");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, student_year")
          .eq("id", data.session.user.id)
          .maybeSingle();

        if (
          profile?.role === "student" ||
          (profile?.student_year !== null &&
            profile?.student_year !== undefined)
        ) {
          navigate({ to: "/", replace: true });
        } else {
          navigate({ to: "/dashboard", replace: true });
        }
      }
    });
  }, [navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          toast.error(
            error.message === "Invalid login credentials"
              ? "Incorrect email or password."
              : error.message,
          );
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("role, student_year")
          .eq("id", data.user.id)
          .maybeSingle();

        if (
          profile?.role === "student" ||
          (profile?.student_year !== null &&
            profile?.student_year !== undefined)
        ) {
          toast.success("Welcome back! Loading your year's notices.");
          navigate({ to: "/", replace: true });
        } else {
          toast.success("Signed in to Faculty Dashboard.");
          navigate({ to: "/dashboard", replace: true });
        }
      } else if (mode === "signup_student") {
        const yrNumber = parseInt(studentYear, 10);
        const yrSuffix =
          yrNumber === 1
            ? "st"
            : yrNumber === 2
              ? "nd"
              : yrNumber === 3
                ? "rd"
                : "th";

        const { data: signUpData, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim() || splitEmail(email),
              role: "student",
              student_year: yrNumber,
              designation: `${yrNumber}${yrSuffix} Year Student`,
            },
          },
        });

        if (error) {
          toast.error(error.message);
          return;
        }

        if (signUpData.session) {
          toast.success(`Registered as ${yrNumber}${yrSuffix} Year Student!`);
          navigate({ to: "/", replace: true });
        } else {
          toast.success(
            "Account created! Please sign in with your credentials.",
          );
          setMode("signin");
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          {
            redirectTo: `${window.location.origin}/reset-password`,
          },
        );
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success(
          "If that email has an account, a reset link is on its way.",
        );
        setMode("signin");
      }
    } finally {
      setLoading(false);
    }
  }

  function splitEmail(em: string) {
    return em.split("@")[0] || "Student";
  }

  function prefillTestAccount(testEmail: string, yr?: "1" | "2" | "3" | "4") {
    setEmail(testEmail);
    setPassword("password123");
    if (yr) {
      setFullName(`Student Year ${yr}`);
      setStudentYear(yr);
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
          <h1 className="text-2xl font-semibold">Campus Connect</h1>
          <p className="text-sm text-masthead-muted">
            Techno NJR Institute of Technology Notice Platform
          </p>
        </div>
      </div>

      <main className="mx-auto -mt-12 w-full max-w-md flex-1 px-5 pb-10">
        <div className="card-surface p-5 shadow-lift">
          {/* Mode Selector Tabs */}
          {mode !== "forgot" && (
            <div className="mb-4 grid grid-cols-2 rounded-lg bg-secondary p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setMode("signin")}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-md py-2 transition-colors",
                  mode === "signin"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <School className="h-3.5 w-3.5" /> Sign In
              </button>
              <button
                type="button"
                onClick={() => setMode("signup_student")}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-md py-2 transition-colors",
                  mode === "signup_student"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <GraduationCap className="h-3.5 w-3.5" /> Student Sign Up
              </button>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">
                {mode === "signin"
                  ? "Sign in to your account"
                  : mode === "signup_student"
                    ? "Create Student Account"
                    : "Reset your password"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {mode === "signin"
                  ? "Faculty and students can sign in with college credentials."
                  : mode === "signup_student"
                    ? "Select your academic year to view targeted college notices."
                    : "We'll email you a link to set a new password."}
              </p>
            </div>

            {mode === "signup_student" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="fullname">Full name</Label>
                  <Input
                    id="fullname"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Aarav Sharma"
                    className="h-11"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="student-year">Academic Year</Label>
                  <Select
                    value={studentYear}
                    onValueChange={(v: "1" | "2" | "3" | "4") =>
                      setStudentYear(v)
                    }
                  >
                    <SelectTrigger id="student-year" className="h-11">
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">
                        🎓 1st Year (B.Tech / MCA)
                      </SelectItem>
                      <SelectItem value="2">
                        🎓 2nd Year (B.Tech / MCA)
                      </SelectItem>
                      <SelectItem value="3">🎓 3rd Year (B.Tech)</SelectItem>
                      <SelectItem value="4">🎓 4th Year (B.Tech)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    You will only see notices targeted for {studentYear}
                    {studentYear === "1"
                      ? "st"
                      : studentYear === "2"
                        ? "nd"
                        : studentYear === "3"
                          ? "rd"
                          : "th"}{" "}
                    Year and All Years notices.
                  </p>
                </div>
              </>
            )}

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

            {mode !== "forgot" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="text-xs font-semibold text-primary"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete={
                    mode === "signin" ? "current-password" : "new-password"
                  }
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11"
                />
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              className="h-11 w-full"
              disabled={loading}
            >
              {loading && <Loader2 className="animate-spin" />}
              {mode === "signin"
                ? "Sign in"
                : mode === "signup_student"
                  ? "Create account"
                  : "Send reset link"}
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

          {/* Testing / demo helper box */}
          <div className="mt-5 border-t border-border pt-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Testing Year-wise Targeting:
            </p>
            <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  setMode("signup_student");
                  prefillTestAccount("student1@technonjr.org", "1");
                }}
                className="rounded border border-border px-2 py-1 text-left hover:bg-secondary transition-colors"
              >
                🎓 1st Year Test
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("signup_student");
                  prefillTestAccount("student2@technonjr.org", "2");
                }}
                className="rounded border border-border px-2 py-1 text-left hover:bg-secondary transition-colors"
              >
                🎓 2nd Year Test
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("signup_student");
                  prefillTestAccount("student3@technonjr.org", "3");
                }}
                className="rounded border border-border px-2 py-1 text-left hover:bg-secondary transition-colors"
              >
                🎓 3rd Year Test
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("signup_student");
                  prefillTestAccount("student4@technonjr.org", "4");
                }}
                className="rounded border border-border px-2 py-1 text-left hover:bg-secondary transition-colors"
              >
                🎓 4th Year Test
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
