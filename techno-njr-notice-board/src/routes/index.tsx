import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  Search,
  X,
  Inbox,
  LogIn,
  LayoutDashboard,
  LogOut,
  SlidersHorizontal,
} from "lucide-react";
import { BrandHeader, navActionClass } from "@/components/campus/BrandHeader";
import { noticesQueryOptions } from "@/lib/notices.queries";
import { CATEGORIES, CATEGORY_IDS, type CategoryId } from "@/lib/categories";
import {
  TARGET_AUDIENCES,
  AUDIENCE_CONFIG,
  type TargetAudience,
} from "@/lib/target-audience";
import { NoticeCard } from "@/components/campus/NoticeCard";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Student Notice Feed — Techno NJR Notice Board" },
      {
        name: "description",
        content:
          "Every official Techno NJR announcement in one place — placements & training, academics, student section, administration, accounts, fees and examination. Year-wise targeted announcements.",
      },
      {
        property: "og:title",
        content: "Student Notice Feed — Techno NJR Notice Board",
      },
      {
        property: "og:description",
        content:
          "Every official Techno NJR announcement in one place. No login needed.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(noticesQueryOptions()),
  component: FeedPage,
});

type CategoryFilter = "all" | CategoryId;
type YearFilter = "all" | "all_broadcast" | "1" | "2" | "3" | "4";

interface UserProfileState {
  id: string;
  email: string;
  fullName: string;
  role: string;
  studentYear: number | null;
  designation: string;
}

function FeedPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: notices } = useSuspenseQuery(noticesQueryOptions());
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [yearFilter, setYearFilter] = useState<YearFilter>("all");
  const [currentUser, setCurrentUser] = useState<UserProfileState | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        setCurrentUser(null);
        return;
      }
      let userProfile = null;
      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("id, full_name, designation, role, student_year")
        .eq("id", user.id)
        .maybeSingle();

      if (!profErr && profile) {
        userProfile = profile;
      } else {
        const { data: fallbackProfile } = await supabase
          .from("profiles")
          .select("id, full_name, designation")
          .eq("id", user.id)
          .maybeSingle();
        if (fallbackProfile) {
          userProfile = {
            id: fallbackProfile.id,
            full_name: fallbackProfile.full_name,
            designation: fallbackProfile.designation,
            role: "faculty",
            student_year: null,
          };
        }
      }

      const userRole =
        userProfile?.role ||
        (userProfile?.student_year ? "student" : "faculty");

      setCurrentUser({
        id: user.id,
        email: user.email ?? "",
        fullName: userProfile?.full_name ?? "",
        role: userRole,
        studentYear: userProfile?.student_year ?? null,
        designation: userProfile?.designation ?? "Faculty",
      });
    });
  }, []);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    setCurrentUser(null);
    navigate({ to: "/", replace: true });
    // Invalidate notices to fetch public feed
    queryClient.invalidateQueries({ queryKey: ["notices"] });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notices.filter((n) => {
      // Category filter
      if (categoryFilter !== "all" && n.category !== categoryFilter)
        return false;

      // Year filter
      if (yearFilter === "all_broadcast" && n.targetAudience !== "all")
        return false;
      if (
        yearFilter !== "all" &&
        yearFilter !== "all_broadcast" &&
        n.targetAudience !== yearFilter
      )
        return false;

      // Text search
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.senderName.toLowerCase().includes(q)
      );
    });
  }, [notices, query, categoryFilter, yearFilter]);

  const categoryCounts = useMemo(() => {
    const c: Record<string, number> = { all: notices.length };
    for (const n of notices) c[n.category] = (c[n.category] ?? 0) + 1;
    return c;
  }, [notices]);

  const yearCounts = useMemo(() => {
    const c: Record<string, number> = {
      all: notices.length,
      all_broadcast: notices.filter((n) => n.targetAudience === "all").length,
      "1": notices.filter((n) => n.targetAudience === "1").length,
      "2": notices.filter((n) => n.targetAudience === "2").length,
      "3": notices.filter((n) => n.targetAudience === "3").length,
      "4": notices.filter((n) => n.targetAudience === "4").length,
    };
    return c;
  }, [notices]);

  const isStudent =
    currentUser?.role === "student" ||
    (currentUser?.studentYear !== null &&
      currentUser?.studentYear !== undefined);

  return (
    <div className="min-h-screen bg-background">
      <BrandHeader
        action={
          <div className="flex items-center gap-2">
            {currentUser ? (
              <>
                {!isStudent && (
                  <Link to="/dashboard" className={navActionClass}>
                    <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
                  </Link>
                )}
                <button
                  type="button"
                  onClick={signOut}
                  className={navActionClass}
                >
                  <LogOut className="h-3.5 w-3.5" /> Sign out
                </button>
              </>
            ) : (
              <Link to="/auth" className={navActionClass}>
                <LogIn className="h-3.5 w-3.5" /> Sign in
              </Link>
            )}
          </div>
        }
      />

      <section className="masthead-bg text-masthead-foreground">
        <div className="mx-auto max-w-5xl px-4 pb-16 pt-7">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-masthead-muted">
            Official announcements
          </p>
          <h1 className="mt-1 text-3xl font-semibold leading-tight sm:text-4xl">
            Notice Board
          </h1>
          <p className="mt-1.5 text-sm text-masthead-muted">
            From faculty, HODs and Deans of Techno NJR Institute of Technology.
          </p>

          {/* User profile / Year context banner */}
          {currentUser && (
            <div className="mt-3 inline-flex flex-wrap items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm">
              {isStudent ? (
                <>
                  <span>🎓</span>
                  <span>
                    Viewing as{" "}
                    {currentUser.studentYear
                      ? `${currentUser.studentYear}${
                          currentUser.studentYear === 1
                            ? "st"
                            : currentUser.studentYear === 2
                              ? "nd"
                              : currentUser.studentYear === 3
                                ? "rd"
                                : "th"
                        } Year Student`
                      : "Student"}
                  </span>
                  {currentUser.fullName && (
                    <span className="text-masthead-muted font-normal">
                      · {currentUser.fullName}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span>💼</span>
                  <span>
                    Faculty Portal · {currentUser.fullName || currentUser.email}{" "}
                    ({currentUser.designation})
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Sticky search + filter bar */}
      <div className="sticky top-0 z-20 -mt-10 bg-gradient-to-b from-transparent via-background/95 to-background/95 pt-3 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-4">
          <label className="flex h-12 items-center gap-3 rounded-xl border border-border bg-card px-4 shadow-lift focus-within:ring-2 focus-within:ring-ring">
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notices by keyword or title"
              className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
              aria-label="Search notices"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="grid h-7 w-7 place-items-center rounded-full bg-secondary text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </label>
        </div>

        {/* Target Audience / Academic Year Filter */}
        <div className="mx-auto mt-2.5 max-w-5xl px-4">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground shrink-0 mr-1">
              <SlidersHorizontal className="h-3 w-3" /> Year:
            </span>
            <YearPill
              active={yearFilter === "all"}
              onClick={() => setYearFilter("all")}
              count={yearCounts["all"] ?? 0}
            >
              All Visible
            </YearPill>
            <YearPill
              active={yearFilter === "all_broadcast"}
              onClick={() => setYearFilter("all_broadcast")}
              count={yearCounts["all_broadcast"] ?? 0}
            >
              👥 All Years
            </YearPill>
            {TARGET_AUDIENCES.filter((a) => a !== "all").map((yr) => (
              <YearPill
                key={yr}
                active={yearFilter === yr}
                onClick={() => setYearFilter(yr)}
                count={yearCounts[yr] ?? 0}
              >
                {AUDIENCE_CONFIG[yr].emoji} {AUDIENCE_CONFIG[yr].label}
              </YearPill>
            ))}
          </div>
        </div>

        {/* Classification / Category Filter */}
        <div className="no-scrollbar mx-auto mt-2 flex max-w-5xl gap-2 overflow-x-auto px-4 pb-3">
          <Pill
            active={categoryFilter === "all"}
            onClick={() => setCategoryFilter("all")}
            count={categoryCounts["all"] ?? 0}
          >
            All Categories
          </Pill>
          {CATEGORY_IDS.map((id) => (
            <Pill
              key={id}
              active={categoryFilter === id}
              onClick={() => setCategoryFilter(id)}
              count={categoryCounts[id] ?? 0}
            >
              {CATEGORIES[id].label} {CATEGORIES[id].emoji}
            </Pill>
          ))}
        </div>
      </div>

      {/* Notice grid — 2 columns on desktop, 1 on mobile */}
      <main className="mx-auto max-w-5xl px-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="mb-3 mt-1 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span>
            {filtered.length} {filtered.length === 1 ? "notice" : "notices"}
            {yearFilter !== "all" &&
              ` for ${
                yearFilter === "all_broadcast"
                  ? "All Years"
                  : AUDIENCE_CONFIG[yearFilter].label
              }`}
            {categoryFilter !== "all" &&
              ` in ${CATEGORIES[categoryFilter].label}`}
            {query.trim() && ` matching "${query.trim()}"`}
          </span>
          {(yearFilter !== "all" || categoryFilter !== "all" || query) && (
            <button
              type="button"
              onClick={() => {
                setYearFilter("all");
                setCategoryFilter("all");
                setQuery("");
              }}
              className="text-[11px] lowercase tracking-normal text-primary hover:underline"
            >
              Reset filters
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="card-surface flex flex-col items-center px-6 py-14 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-secondary text-muted-foreground">
              <Inbox className="h-6 w-6" />
            </span>
            <h2 className="mt-4 text-lg font-semibold">No notices found</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isStudent &&
              yearFilter !== "all" &&
              yearFilter !== String(currentUser?.studentYear)
                ? `You are signed in as a ${currentUser?.studentYear}${
                    currentUser?.studentYear === 1
                      ? "st"
                      : currentUser?.studentYear === 2
                        ? "nd"
                        : currentUser?.studentYear === 3
                          ? "rd"
                          : "th"
                  } Year student. Notices targeted to other years are restricted.`
                : "Try a different year filter, category, or search term."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filtered.map((n) => (
              <NoticeCard key={n.id} notice={n} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function YearPill({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-all active:scale-95",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border/70 bg-card/80 text-foreground hover:bg-secondary",
      )}
    >
      <span className="whitespace-nowrap">{children}</span>
      <span
        className={cn(
          "rounded-full px-1.5 text-[10px] font-bold",
          active
            ? "bg-primary-foreground/20 text-primary-foreground"
            : "bg-secondary text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function Pill({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition-all active:scale-95",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-card"
          : "border-border bg-card text-secondary-foreground hover:border-ring/40",
      )}
    >
      <span className="whitespace-nowrap">{children}</span>
      <span
        className={cn(
          "rounded-full px-1.5 text-[11px] font-bold",
          active
            ? "bg-primary-foreground/20"
            : "bg-secondary text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}
