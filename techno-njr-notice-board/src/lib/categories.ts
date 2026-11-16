export const CATEGORY_IDS = ["placements", "academic", "student", "administration"] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  emoji: string;
  /** Tailwind classes built from the --cat-* design tokens. */
  tagClass: string;
  dotClass: string;
}

export const CATEGORIES: Record<CategoryId, CategoryMeta> = {
  placements: {
    id: "placements",
    label: "Placements & Training",
    emoji: "💼",
    tagClass: "bg-cat-placements-soft text-cat-placements",
    dotClass: "bg-cat-placements",
  },
  academic: {
    id: "academic",
    label: "Academics",
    emoji: "📘",
    tagClass: "bg-cat-academic-soft text-cat-academic",
    dotClass: "bg-cat-academic",
  },
  student: {
    id: "student",
    label: "Student Section",
    emoji: "🏆",
    tagClass: "bg-cat-student-soft text-cat-student",
    dotClass: "bg-cat-student",
  },
  administration: {
    id: "administration",
    label: "Administration",
    emoji: "🏛️",
    tagClass: "bg-cat-administration-soft text-cat-administration",
    dotClass: "bg-cat-administration",
  },
};

/** Used when a stored category is unknown (should not happen thanks to the DB CHECK). */
export const FALLBACK_CATEGORY: CategoryId = "administration";

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === "string" && (CATEGORY_IDS as readonly string[]).includes(value);
}

/** Keyword rules for the smart category suggestion on the faculty form. */
export const CATEGORY_KEYWORDS: Record<CategoryId, string[]> = {
  placements: [
    "placement",
    "drive",
    "seminar",
    "workshop",
    "interview",
    "recruitment",
    "internship",
    "training",
    "job",
    "ctc",
  ],
  academic: [
    "exam",
    "timetable",
    "schedule",
    "result",
    "marks",
    "syllabus",
    "lecture",
    "class",
    "semester",
    "hall ticket",
    "revaluation",
    "assignment",
    "postponed",
  ],
  student: [
    "sport",
    "fest",
    "festival",
    "cultural",
    "club",
    "event",
    "competition",
    "tournament",
    "hackathon",
    "celebration",
  ],
  administration: [
    "holiday",
    "fee",
    "deadline",
    "circular",
    "official",
    "office",
    "scholarship",
    "vacation",
    "meeting",
  ],
};

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Whole-word match that also accepts common endings ("exams", "classes", "scheduled", "fees")
// without catching unrelated words ("fee" ≠ "feedback"). Multi-word keywords allow flexible
// whitespace or hyphens ("hall   ticket", "hall-ticket").
const KEYWORD_PATTERNS: { category: CategoryId; regex: RegExp }[] = (
  Object.keys(CATEGORY_KEYWORDS) as CategoryId[]
).flatMap((category) =>
  CATEGORY_KEYWORDS[category].map((kw) => ({
    category,
    regex: new RegExp(
      `\\b${kw.split(" ").map(escapeRegExp).join("[\\s-]+")}(?:s|es|d|ed|ing)?\\b`,
      "gi",
    ),
  })),
);

/**
 * Reads notice text and returns the best-matching category, or null when no keyword matches.
 * The category with the most keyword hits wins; ties go to the category mentioned first.
 */
export function suggestCategory(text: string): CategoryId | null {
  if (!text.trim()) return null;
  const scores = new Map<CategoryId, { count: number; first: number }>();

  for (const { category, regex } of KEYWORD_PATTERNS) {
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      const prev = scores.get(category) ?? { count: 0, first: Number.POSITIVE_INFINITY };
      scores.set(category, { count: prev.count + 1, first: Math.min(prev.first, m.index) });
    }
  }

  let best: CategoryId | null = null;
  let bestScore = { count: 0, first: Number.POSITIVE_INFINITY };
  for (const [category, score] of scores) {
    if (
      score.count > bestScore.count ||
      (score.count === bestScore.count && score.first < bestScore.first)
    ) {
      best = category;
      bestScore = score;
    }
  }
  return best;
}
