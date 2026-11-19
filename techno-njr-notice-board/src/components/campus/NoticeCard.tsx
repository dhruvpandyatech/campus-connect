import { useState, type ReactNode } from "react";
import {
  format,
  formatDistanceToNowStrict,
  isToday,
  isYesterday,
} from "date-fns";
import { Paperclip, ArrowUpRight, Megaphone, Pin } from "lucide-react";
import { CategoryTag } from "./CategoryTag";
import type { CategoryId } from "@/lib/categories";
import { AUDIENCE_CONFIG, type TargetAudience } from "@/lib/target-audience";
import { cn } from "@/lib/utils";

export interface NoticeCardData {
  title: string;
  content: string;
  category: CategoryId;
  targetAudience?: TargetAudience;
  attachmentHref: string | null;
  attachmentLabel: string | null;
  senderName: string;
  senderRole: string;
  createdAt: string;
  /** High-alert / pinned notices get the red top banner. */
  pinned?: boolean;
}

export function AudienceTag({
  audience = "all",
  className,
}: {
  audience?: TargetAudience | undefined;
  className?: string;
}) {
  const meta = AUDIENCE_CONFIG[audience] ?? AUDIENCE_CONFIG.all;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide transition-colors",
        meta.badgeClass,
        className,
      )}
      title={meta.description}
    >
      <span aria-hidden>{meta.emoji}</span>
      <span>{meta.label}</span>
    </span>
  );
}

function initials(name: string) {
  return (
    name
      .replace(/^(dr|prof|mr|ms|mrs)\.?\s+/i, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

function friendlyDate(iso: string) {
  const d = new Date(iso);
  if (isToday(d))
    return `Today · ${formatDistanceToNowStrict(d, { addSuffix: true })}`;
  if (isYesterday(d)) return `Yesterday · ${format(d, "h:mm a")}`;
  return format(d, "d MMM yyyy");
}

export function NoticeCard({
  notice,
  actions,
}: {
  notice: NoticeCardData;
  actions?: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const long = notice.content.length > 180;

  return (
    <article
      className={cn(
        "card-surface fade-up overflow-hidden",
        notice.pinned && "border-alert/40 ring-1 ring-alert/20",
      )}
    >
      {notice.pinned && (
        <div className="flex items-center gap-2 bg-alert px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-alert-foreground sm:px-5">
          <Megaphone className="h-3.5 w-3.5" aria-hidden />
          Important notice
          <Pin className="ml-auto h-3.5 w-3.5 rotate-45" aria-label="Pinned" />
        </div>
      )}
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <CategoryTag category={notice.category} />
            <AudienceTag audience={notice.targetAudience} />
          </div>
          <time
            dateTime={notice.createdAt}
            className="ml-auto shrink-0 pt-0.5 text-xs font-medium text-muted-foreground"
            suppressHydrationWarning
          >
            {friendlyDate(notice.createdAt)}
          </time>
        </div>

        <h2 className="mt-3 text-base font-semibold leading-snug text-foreground sm:text-lg">
          {notice.title}
        </h2>

        <p
          className={`mt-2 whitespace-pre-line text-[15px] leading-relaxed text-muted-foreground ${
            !expanded && long ? "line-clamp-3" : ""
          }`}
        >
          {notice.content}
        </p>
        {long && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 text-sm font-semibold text-primary"
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        )}

        {notice.attachmentHref && (
          <a
            href={notice.attachmentHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm transition-colors hover:bg-accent"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-card text-primary">
              <Paperclip className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 truncate font-medium text-secondary-foreground">
              {notice.attachmentLabel ?? "Open attachment"}
            </span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </a>
        )}

        <footer className="mt-4 flex items-center gap-3 border-t border-border pt-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {initials(notice.senderName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {notice.senderName || "College Office"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {notice.senderRole}
            </p>
          </div>
          {actions}
        </footer>
      </div>
    </article>
  );
}
