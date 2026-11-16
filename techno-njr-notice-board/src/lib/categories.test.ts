import { describe, expect, it } from "vitest";
import { suggestCategory } from "./categories";

describe("suggestCategory", () => {
  it("suggests Placements & Training for drives, seminars and workshops", () => {
    expect(suggestCategory("Infosys campus drive on Monday")).toBe("placements");
    expect(suggestCategory("Seminar on cloud careers in the auditorium")).toBe("placements");
    expect(suggestCategory("Two-day Python workshop")).toBe("placements");
  });

  it("suggests Academics for exam schedules, timetables and academic updates", () => {
    expect(suggestCategory("Mid-sem exams begin next week")).toBe("academic");
    expect(suggestCategory("New timetable for semester 5")).toBe("academic");
    expect(suggestCategory("Hall tickets are out")).toBe("academic");
  });

  it("suggests Student Section for sports, cultural fests and club events", () => {
    expect(suggestCategory("Inter-college sports meet")).toBe("student");
    expect(suggestCategory("Cultural fest auditions")).toBe("student");
    expect(suggestCategory("Coding club meetup")).toBe("student");
  });

  it("suggests Administration for official notices, fee deadlines and holidays", () => {
    expect(suggestCategory("Tomorrow is a holiday")).toBe("administration");
    expect(suggestCategory("Last date to pay fees is 30th")).toBe("administration");
    expect(suggestCategory("Official circular from the office")).toBe("administration");
  });

  it("does not treat 'feedback' as a fee notice", () => {
    expect(suggestCategory("Share your feedback form")).toBeNull();
  });

  it("returns null when nothing matches", () => {
    expect(suggestCategory("")).toBeNull();
    expect(suggestCategory("Please collect your ID cards")).toBeNull();
  });

  it("picks the category with the most keyword hits", () => {
    expect(suggestCategory("Exam timetable and class schedule; holiday on Friday")).toBe("academic");
  });

  it("breaks ties by the keyword mentioned first", () => {
    expect(suggestCategory("Holiday notice: exam moved")).toBe("administration");
  });
});
