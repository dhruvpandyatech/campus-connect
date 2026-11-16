import { CATEGORIES, type CategoryId } from "@/lib/categories";
import { cn } from "@/lib/utils";

export function CategoryTag({
  category,
  className,
}: {
  category: CategoryId;
  className?: string;
}) {
  const meta = CATEGORIES[category];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
        meta.tagClass,
        className,
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", meta.dotClass)}
        aria-hidden
      />
      {meta.label}
    </span>
  );
}
