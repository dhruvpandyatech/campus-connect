import { describe, expect, it } from "vitest";
import {
  isNoticeVisibleToViewer,
  isTargetAudience,
  normalizeAudience,
  TARGET_AUDIENCES,
  AUDIENCE_CONFIG,
  type TargetAudience,
} from "./target-audience";

describe("Target Audience Configuration and Helpers", () => {
  it("defines the 5 valid target audiences", () => {
    expect(TARGET_AUDIENCES).toEqual(["all", "1", "2", "3", "4"]);
  });

  it("identifies valid target audiences", () => {
    expect(isTargetAudience("all")).toBe(true);
    expect(isTargetAudience("1")).toBe(true);
    expect(isTargetAudience("2")).toBe(true);
    expect(isTargetAudience("3")).toBe(true);
    expect(isTargetAudience("4")).toBe(true);
    expect(isTargetAudience("5")).toBe(false);
    expect(isTargetAudience("all_years")).toBe(false);
    expect(isTargetAudience(null)).toBe(false);
  });

  it("normalizes legacy or alternate audience strings", () => {
    expect(normalizeAudience("1st_year")).toBe("1");
    expect(normalizeAudience("2nd_year")).toBe("2");
    expect(normalizeAudience("3rd_year")).toBe("3");
    expect(normalizeAudience("4th_year")).toBe("4");
    expect(normalizeAudience("unknown")).toBe("all");
  });

  it("has labels for every audience", () => {
    for (const aud of TARGET_AUDIENCES) {
      expect(AUDIENCE_CONFIG[aud].label).toBeDefined();
      expect(AUDIENCE_CONFIG[aud].emoji).toBeDefined();
      expect(AUDIENCE_CONFIG[aud].badgeClass).toBeDefined();
    }
  });
});

describe("Notice Visibility Rules", () => {
  const notices: { id: string; targetAudience: TargetAudience }[] = [
    { id: "notice-all", targetAudience: "all" },
    { id: "notice-1", targetAudience: "1" },
    { id: "notice-2", targetAudience: "2" },
    { id: "notice-3", targetAudience: "3" },
    { id: "notice-4", targetAudience: "4" },
  ];

  it("allows 1st year students to see only 'all' and '1' notices", () => {
    const student1 = { role: "student", studentYear: 1 };
    const visible = notices.filter((n) =>
      isNoticeVisibleToViewer(n.targetAudience, student1),
    );
    expect(visible.map((n) => n.id)).toEqual(["notice-all", "notice-1"]);
  });

  it("allows 2nd year students to see only 'all' and '2' notices", () => {
    const student2 = { role: "student", studentYear: 2 };
    const visible = notices.filter((n) =>
      isNoticeVisibleToViewer(n.targetAudience, student2),
    );
    expect(visible.map((n) => n.id)).toEqual(["notice-all", "notice-2"]);
  });

  it("allows 3rd year students to see only 'all' and '3' notices", () => {
    const student3 = { role: "student", studentYear: 3 };
    const visible = notices.filter((n) =>
      isNoticeVisibleToViewer(n.targetAudience, student3),
    );
    expect(visible.map((n) => n.id)).toEqual(["notice-all", "notice-3"]);
  });

  it("allows 4th year students to see only 'all' and '4' notices", () => {
    const student4 = { role: "student", studentYear: 4 };
    const visible = notices.filter((n) =>
      isNoticeVisibleToViewer(n.targetAudience, student4),
    );
    expect(visible.map((n) => n.id)).toEqual(["notice-all", "notice-4"]);
  });

  it("allows faculty and administrators to see ALL notices", () => {
    const faculty = { role: "faculty", studentYear: null };
    const admin = { role: "admin", studentYear: null };

    const visibleFaculty = notices.filter((n) =>
      isNoticeVisibleToViewer(n.targetAudience, faculty),
    );
    expect(visibleFaculty.length).toBe(5);

    const visibleAdmin = notices.filter((n) =>
      isNoticeVisibleToViewer(n.targetAudience, admin),
    );
    expect(visibleAdmin.length).toBe(5);
  });

  it("allows anonymous viewers to see only broadcast 'all' notices", () => {
    const visibleAnon = notices.filter((n) =>
      isNoticeVisibleToViewer(n.targetAudience, null),
    );
    expect(visibleAnon.map((n) => n.id)).toEqual(["notice-all"]);
  });
});
