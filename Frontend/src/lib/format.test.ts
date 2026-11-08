import { describe, it, expect } from "vitest";
import { formatMoney, formatDate, formatHeaderDate } from "./format";

describe("formatMoney", () => {
  it("formats whole FCFA numbers with thin space thousands separators", () => {
    expect(formatMoney(113000)).toBe("113\u202F000");
    expect(formatMoney(113000, true)).toBe("113\u202F000 FCFA");
    expect(formatMoney(1000000)).toBe("1\u202F000\u202F000");
    expect(formatMoney(1000000, true)).toBe("1\u202F000\u202F000 FCFA");
    expect(formatMoney(450)).toBe("450");
    expect(formatMoney(450, true)).toBe("450 FCFA");
  });

  it("handles null, undefined, and NaN gracefully", () => {
    expect(formatMoney(null)).toBe("0");
    expect(formatMoney(null, true)).toBe("0 FCFA");
    expect(formatMoney(undefined)).toBe("0");
    expect(formatMoney(undefined, true)).toBe("0 FCFA");
    expect(formatMoney(NaN)).toBe("0");
    expect(formatMoney(NaN, true)).toBe("0 FCFA");
  });

  it("rounds decimals to whole numbers (no floats)", () => {
    expect(formatMoney(113000.4)).toBe("113\u202F000");
    expect(formatMoney(113000.6)).toBe("113\u202F001");
  });

  it("formats zero and negative numbers properly", () => {
    expect(formatMoney(0)).toBe("0");
    expect(formatMoney(0, true)).toBe("0 FCFA");
    expect(formatMoney(-50000)).toBe("-50\u202F000");
    expect(formatMoney(-50000, true)).toBe("-50\u202F000 FCFA");
  });
});

describe("formatDate", () => {
  it("formats valid ISO YYYY-MM-DD dates to 'D MMM YYYY'", () => {
    expect(formatDate("2026-08-31")).toBe("31 Aug 2026");
    expect(formatDate("2026-01-01")).toBe("1 Jan 2026");
    expect(formatDate("2026-02-28")).toBe("28 Feb 2026");
    expect(formatDate("2026-11-04")).toBe("4 Nov 2026");
    expect(formatDate("2026-12-25")).toBe("25 Dec 2026");
  });

  it("handles ISO dates with time components", () => {
    expect(formatDate("2026-08-31T14:30:00Z")).toBe("31 Aug 2026");
    expect(formatDate("2026-04-15T09:00:00.000Z")).toBe("15 Apr 2026");
  });

  it("returns an em-dash for null, undefined, or empty values", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("")).toBe("—");
  });

  it("returns the input string if not a valid 3-part date or out of bounds", () => {
    expect(formatDate("invalid-date")).toBe("invalid-date");
    expect(formatDate("2026-13-01")).toBe("2026-13-01"); // month 13 out of bounds
  });
});

describe("formatHeaderDate", () => {
  it("formats a Date object to 'Weekday Day Month Year'", () => {
    // Note: Month index in JS Date constructor is 0-indexed: 10 = November
    const testDate = new Date(2026, 10, 4);
    expect(formatHeaderDate(testDate)).toBe("Wednesday 4 November 2026");
  });
});

