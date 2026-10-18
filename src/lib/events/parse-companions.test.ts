import { describe, it, expect } from "vitest";
import { parseCompanions, formatCompanions, type RelationLabels } from "./parse-companions";

const labels: RelationLabels = {
  spouse: "배우자",
  child: "자녀",
  friend: "친구",
  parents: "부모님",
  siblings: "형제자매",
  colleague: "동료",
  other: "기타",
};

describe("parseCompanions", () => {
  it("returns empty state for null/undefined/empty input", () => {
    expect(parseCompanions(null, labels)).toEqual({ selected: [], other: "" });
    expect(parseCompanions(undefined, labels)).toEqual({ selected: [], other: "" });
    expect(parseCompanions("", labels)).toEqual({ selected: [], other: "" });
  });

  it("matches a single known relationship label", () => {
    expect(parseCompanions("배우자", labels)).toEqual({ selected: ["spouse"], other: "" });
  });

  it("matches multiple comma-separated labels", () => {
    expect(parseCompanions("배우자, 자녀", labels)).toEqual({ selected: ["spouse", "child"], other: "" });
  });

  it("parses a custom '기타: text' entry into other + selects the other chip", () => {
    expect(parseCompanions("배우자, 기타: 민수삼촌", labels)).toEqual({
      selected: ["spouse", "other"],
      other: "민수삼촌",
    });
  });

  it("selects the other chip with empty text when '기타' appears alone", () => {
    expect(parseCompanions("기타", labels)).toEqual({ selected: ["other"], other: "" });
  });

  it("folds old-style free text (pre-dating this feature) into other, unmatched", () => {
    expect(parseCompanions("민수 삼촌이랑 같이", labels)).toEqual({
      selected: ["other"],
      other: "민수 삼촌이랑 같이",
    });
  });

  it("combines a known label with leftover unmatched free text", () => {
    expect(parseCompanions("친구, 짝꿍 민지", labels)).toEqual({
      selected: ["friend", "other"],
      other: "짝꿍 민지",
    });
  });

  it("deduplicates a label repeated in the stored text", () => {
    expect(parseCompanions("친구, 친구", labels)).toEqual({ selected: ["friend"], other: "" });
  });

  it("ignores stray whitespace and empty comma segments", () => {
    expect(parseCompanions(" 배우자 ,, 자녀 ", labels)).toEqual({ selected: ["spouse", "child"], other: "" });
  });
});

describe("formatCompanions", () => {
  it("returns an empty string for no selection and no custom text", () => {
    expect(formatCompanions([], "", labels)).toBe("");
  });

  it("joins selected relationship labels with ', '", () => {
    expect(formatCompanions(["spouse", "child"], "", labels)).toBe("배우자, 자녀");
  });

  it("appends a formatted custom entry when other is selected with text", () => {
    expect(formatCompanions(["spouse", "other"], "민수삼촌", labels)).toBe("배우자, 기타: 민수삼촌");
  });

  it("appends a bare '기타' entry when other is selected without text", () => {
    expect(formatCompanions(["spouse", "other"], "", labels)).toBe("배우자, 기타");
  });

  it("includes a formatted custom entry even if the other chip wasn't explicitly selected", () => {
    expect(formatCompanions(["spouse"], "민수삼촌", labels)).toBe("배우자, 기타: 민수삼촌");
  });

  it("trims surrounding whitespace from the custom text", () => {
    expect(formatCompanions(["other"], "  민수삼촌  ", labels)).toBe("기타: 민수삼촌");
  });
});

describe("parseCompanions/formatCompanions round trip", () => {
  it("round-trips a multi-select with a custom entry", () => {
    const stored = "배우자, 자녀, 기타: 민수삼촌";
    const parsed = parseCompanions(stored, labels);
    expect(formatCompanions(parsed.selected, parsed.other, labels)).toBe(stored);
  });

  it("round-trips a plain relationship-only selection", () => {
    const stored = "친구, 동료";
    const parsed = parseCompanions(stored, labels);
    expect(formatCompanions(parsed.selected, parsed.other, labels)).toBe(stored);
  });
});
