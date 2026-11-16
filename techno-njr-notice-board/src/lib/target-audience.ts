export const TARGET_AUDIENCES = ["all", "1", "2", "3", "4"] as const;
export type TargetAudience = (typeof TARGET_AUDIENCES)[number];

export interface AudienceMeta {
  id: TargetAudience;
  label: string;
  shortLabel: string;
  emoji: string;
  badgeClass: string;
  description: string;
}

export const AUDIENCE_CONFIG: Record<TargetAudience, AudienceMeta> = {
  all: {
    id: "all",
    label: "All Years",
    shortLabel: "All",
    emoji: "👥",
    badgeClass:
      "bg-secondary text-secondary-foreground border border-border/80",
    description: "Visible to students of all 4 years",
  },
  "1": {
    id: "1",
    label: "1st Year",
    shortLabel: "1st Yr",
    emoji: "🎓",
    badgeClass:
      "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40",
    description: "Visible only to 1st year students",
  },
  "2": {
    id: "2",
    label: "2nd Year",
    shortLabel: "2nd Yr",
    emoji: "🎓",
    badgeClass:
      "bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/40",
    description: "Visible only to 2nd year students",
  },
  "3": {
    id: "3",
    label: "3rd Year",
    shortLabel: "3rd Yr",
    emoji: "🎓",
    badgeClass:
      "bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40",
    description: "Visible only to 3rd year students",
  },
  "4": {
    id: "4",
    label: "4th Year",
    shortLabel: "4th Yr",
    emoji: "🎓",
    badgeClass:
      "bg-purple-50 text-purple-800 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/40",
    description: "Visible only to 4th year students",
  },
};

export const FALLBACK_AUDIENCE: TargetAudience = "all";

export function isTargetAudience(value: unknown): value is TargetAudience {
  return (
    typeof value === "string" &&
    (TARGET_AUDIENCES as readonly string[]).includes(value)
  );
}

export function normalizeAudience(value: unknown): TargetAudience {
  if (isTargetAudience(value)) return value;
  if (value === "1st_year" || value === "1st Year") return "1";
  if (value === "2nd_year" || value === "2nd Year") return "2";
  if (value === "3rd_year" || value === "3rd Year") return "3";
  if (value === "4th_year" || value === "4th Year") return "4";
  return FALLBACK_AUDIENCE;
}

export interface ViewerContext {
  role?: "faculty" | "admin" | "student" | string;
  studentYear?: number | string | null;
}

/**
 * Checks whether a notice with a given targetAudience is visible to a viewer.
 *
 * Rules:
 * 1. "all" notices are visible to EVERYONE.
 * 2. Faculty / admin can see ALL notices regardless of target.
 * 3. A student can ONLY see notices if targetAudience matches their academic year or is "all".
 * 4. Anonymous/unauthenticated viewers can only see "all" notices.
 */
export function isNoticeVisibleToViewer(
  targetAudience: TargetAudience,
  viewer?: ViewerContext | null,
): boolean {
  // All-years broadcast notices are visible to everyone
  if (targetAudience === "all") return true;

  if (!viewer) return false;

  const role = viewer.role?.toLowerCase();
  // Faculty and admins see everything
  if (role === "faculty" || role === "admin") return true;

  // If user is a student with an academic year:
  if (viewer.studentYear !== null && viewer.studentYear !== undefined) {
    return String(viewer.studentYear) === String(targetAudience);
  }

  // If role is unspecified but user has no student year and is not a student (e.g. staff profile), allow:
  if (!role && viewer.studentYear === null) return true;

  return false;
}
