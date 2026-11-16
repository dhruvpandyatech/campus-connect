import { describe, expect, it } from "vitest";
import { suggestCategory } from "./categories";

describe("suggestCategory", () => {
  it("suggests Placements & Training for drives, seminars and workshops", () => {
    expect(suggestCategory("Infosys campus drive on Monday")).toBe(
      "placements",
    );
    expect(suggestCategory("Seminar on cloud careers in the auditorium")).toBe(
      "placements",
    );
    expect(suggestCategory("Two-day Python workshop")).toBe("placements");
  });

  it("suggests Academics for timetables and class-related updates", () => {
    expect(suggestCategory("New timetable for semester 5")).toBe("academic");
    expect(suggestCategory("Class schedule revised for this week")).toBe(
      "academic",
    );
    expect(suggestCategory("Revaluation result published for semester 3")).toBe(
      "academic",
    );
  });

  it("suggests Examination for exam schedules and hall tickets", () => {
    expect(suggestCategory("Mid-sem exams begin next week")).toBe(
      "examination",
    );
    expect(suggestCategory("Hall tickets are out for university exam")).toBe(
      "examination",
    );
    expect(suggestCategory("Practical exam viva schedule released")).toBe(
      "examination",
    );
  });

  it("suggests Student Section for sports, cultural fests and club events", () => {
    expect(suggestCategory("Inter-college sports meet")).toBe("student");
    expect(suggestCategory("Cultural fest auditions")).toBe("student");
    expect(suggestCategory("Coding club meetup")).toBe("student");
  });

  it("suggests Administration for official notices and holidays", () => {
    expect(suggestCategory("Tomorrow is a holiday")).toBe("administration");
    expect(suggestCategory("Official circular from the office")).toBe(
      "administration",
    );
    expect(suggestCategory("Scholarship deadline announced")).toBe(
      "administration",
    );
  });

  it("suggests Fees for fee-related notices", () => {
    expect(suggestCategory("Last date to pay tuition fees is 30th")).toBe(
      "fees",
    );
    expect(suggestCategory("Challan due date extended")).toBe("fees");
    expect(suggestCategory("Late fee will be charged after deadline")).toBe(
      "fees",
    );
  });

  it("suggests Accounts for accounting and financial notices", () => {
    expect(suggestCategory("Reimbursement claim submission due")).toBe(
      "accounts",
    );
    expect(suggestCategory("Annual audit report published")).toBe("accounts");
  });

  it("does not treat 'feedback' as a fee notice", () => {
    expect(suggestCategory("Share your feedback form")).toBeNull();
  });

  it("returns null when nothing matches", () => {
    expect(suggestCategory("")).toBeNull();
    expect(suggestCategory("Please collect your ID cards")).toBeNull();
  });

  it("picks the category with the most keyword hits", () => {
    expect(
      suggestCategory(
        "Timetable revised, class schedule updated, semester assignment",
      ),
    ).toBe("academic");
  });

  it("breaks ties by the keyword mentioned first", () => {
    expect(suggestCategory("Holiday notice: circular from office")).toBe(
      "administration",
    );
  });
});
