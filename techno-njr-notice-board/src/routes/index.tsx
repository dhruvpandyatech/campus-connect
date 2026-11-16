import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Search, X, Inbox, LogIn, LayoutDashboard } from "lucide-react";
import { BrandHeader, navActionClass } from "@/components/campus/BrandHeader";
import { noticesQueryOptions } from "@/lib/notices.queries";
import { CATEGORIES, CATEGORY_IDS, type CategoryId } from "@/lib/categories";
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
          "Every official Techno NJR announcement in one place — placements & training, academics, student section and administration. No login needed.",
      },
      { property: "og:title", content: "Student Notice Feed — Techno NJR Notice Board" },
      {
        property: "og:description",
        content: "Every official Techno NJR announcement in one place. No login needed.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(noticesQueryOptions()),
  component: FeedPage,
});

type Filter = "all" | CategoryId;

function FeedPage() {
  const { data: notices } = useSuspenseQuery(noticesQueryOptions());
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notices.filter((n) => {
      if (filter !== "all" && n.category !== filter) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.senderName.toLowerCase().includes(q)
      );
    });
  }, [notices, query, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: notices.length };
    for (const n of notices) c[n.category] = (c[n.category] ?? 0) + 1;
    return c;
  }, [notices]);

  return (
    <div className="min-h-screen bg-background">
      <BrandHeader
        action={
          <Link to="/dashboard" className={navActionClass}>
            {signedIn ? <LayoutDashboard className="h-3.5 w-3.5" /> : <LogIn className="h-3.5 w-3.5" />}
            {signedIn ? "Dashboard" : "Faculty login"}
          </Link>
        }
      />
      <section className="masthead-bg text-masthead-foreground">
        <div className="mx-auto max-w-2xl px-4 pb-16 pt-7">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-masthead-muted">
            Official announcements
          </p>
          <h1 className="mt-1 text-3xl font-semibold leading-tight sm:text-4xl">Notice Board</h1>
          <p className="mt-1.5 text-sm text-masthead-muted">
            From faculty, HODs and Deans of Techno NJR Institute of Technology.
          </p>
        </div>
      </section>

      <div className="sticky top-0 z-20 -mt-10 bg-gradient-to-b from-transparent via-background/95 to-background/95 pt-3 backdrop-blur-sm">
        <div className="mx-auto max-w-2xl px-4">
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

        <div className="no-scrollbar mx-auto mt-3 flex max-w-2xl gap-2 overflow-x-auto px-4 pb-3">
          <Pill active={filter === "all"} onClick={() => setFilter("all")} count={counts["all"] ?? 0}>
            All
          </Pill>
          {CATEGORY_IDS.map((id) => (
            <Pill key={id} active={filter === id} onClick={() => setFilter(id)} count={counts[id] ?? 0}>
              {CATEGORIES[id].label} {CATEGORIES[id].emoji}
            </Pill>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <p className="mb-3 mt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "notice" : "notices"}
          {filter !== "all" && ` in ${CATEGORIES[filter].label}`}
          {query.trim() && ` matching “${query.trim()}”`}
        </p>

        {filtered.length === 0 ? (
          <div className="card-surface flex flex-col items-center px-6 py-14 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-secondary text-muted-foreground">
              <Inbox className="h-6 w-6" />
            </span>
            <h2 className="mt-4 text-lg font-semibold">No notices found</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Try a different keyword or category.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((n) => (
              <NoticeCard key={n.id} notice={n} />
            ))}
          </div>
        )}
      </main>
    </div>
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
          active ? "bg-primary-foreground/20" : "bg-secondary text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}
