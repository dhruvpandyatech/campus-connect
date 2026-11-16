import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import logoAsset from "@/assets/techno-njr-logo.jpeg.asset.json";

/** Official circular institute emblem, served from the CDN asset pointer. */
const LOGO_SRC: string | null = logoAsset.url;

export function InstituteLogo({ className = "h-11 w-11" }: { className?: string }) {
  if (LOGO_SRC) {
    return (
      <img
        src={LOGO_SRC}
        alt="Techno NJR Institute of Technology logo"
        className={`${className} shrink-0 rounded-full object-cover`}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label="Techno NJR Institute of Technology logo"
      className={`${className} grid shrink-0 place-items-center rounded-full bg-primary p-[3px] shadow-card`}
    >
      <span className="grid h-full w-full place-items-center rounded-full border-2 border-dashed border-primary-foreground/50 bg-primary-deep">
        <span className="font-display text-[11px] font-bold leading-none tracking-tight text-primary-foreground">
          TNJR
        </span>
      </span>
    </span>
  );
}

/** White brand bar shared by every page: logo, portal name and a right-hand action. */
export function BrandHeader({ action }: { action?: ReactNode }) {
  return (
    <header className="border-b-[3px] border-primary bg-background">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <InstituteLogo />
          <span className="min-w-0 leading-tight">
            <span className="block font-display text-base font-bold text-primary sm:text-xl">
              Techno NJR Notice Board
            </span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground/70 sm:text-[11px] sm:tracking-[0.14em]">
              Techno NJR Institute of Technology
            </span>
          </span>
        </Link>
        {action}
      </div>
    </header>
  );
}

/** Charcoal pill used for the header's navigation action. */
export const navActionClass =
  "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-nav px-3 py-1.5 text-xs font-semibold text-nav-foreground transition-colors hover:bg-primary";
