import { describe, test, expect } from "bun:test";
import { normalizeANumber, normalizeDateOfBirth } from "./normalizers";

describe("normalizeANumber", () => {
  // Already standard
  test("passes through XXX-XXX-XXX format", () => {
    const r = normalizeANumber("243-069-226");
    expect(r.value).toBe("243-069-226");
    expect(r.changed).toBe(false);
    expect(r.rejected).toBe(false);
  });

  // 9 digits no separator
  test("normalizes 9 bare digits", () => {
    const r = normalizeANumber("220964984");
    expect(r.value).toBe("220-964-984");
    expect(r.changed).toBe(true);
    expect(r.rejected).toBe(false);
  });

  // With leading A
  test("normalizes A + 9 digits", () => {
    const r = normalizeANumber("A232689847");
    expect(r.value).toBe("232-689-847");
    expect(r.changed).toBe(true);
  });

  // Spaces
  test("normalizes space-separated", () => {
    const r = normalizeANumber("089 004 009");
    expect(r.value).toBe("089-004-009");
    expect(r.changed).toBe(true);
  });

  // A with dashes
  test("normalizes A-XXX-XXX-XXX", () => {
    const r = normalizeANumber("A-201-071-642");
    expect(r.value).toBe("201-071-642");
    expect(r.changed).toBe(true);
  });

  // Brackets
  test("normalizes [AXXX-XXX-XXX]", () => {
    const r = normalizeANumber("[A075-294-302]");
    expect(r.value).toBe("075-294-302");
    expect(r.changed).toBe(true);
  });

  // A with spaces
  test("normalizes A XXX XXX XXX", () => {
    const r = normalizeANumber("A 087 623 648");
    expect(r.value).toBe("087-623-648");
    expect(r.changed).toBe(true);
  });

  // Spaced digits with dashes mixed
  test("normalizes 2 0 1 - 9 5 8 - 5 5 8", () => {
    const r = normalizeANumber("2 0 1 - 9 5 8 - 5 5 8");
    expect(r.value).toBe("201-958-558");
    expect(r.changed).toBe(true);
  });

  // Garbage values
  test("rejects /", () => {
    expect(normalizeANumber("/").rejected).toBe(true);
  });

  test("rejects N/A", () => {
    expect(normalizeANumber("N/A").rejected).toBe(true);
  });

  test("rejects None", () => {
    expect(normalizeANumber("None").rejected).toBe(true);
  });

  test("rejects unknown", () => {
    expect(normalizeANumber("unknown").rejected).toBe(true);
  });

  test("rejects -", () => {
    expect(normalizeANumber("-").rejected).toBe(true);
  });

  // Phone numbers
  test("rejects phone numbers", () => {
    expect(normalizeANumber("8167880242").rejected).toBe(true);
  });

  // SSN
  test("rejects SSN pattern", () => {
    const r = normalizeANumber("Social 054-82-7725");
    expect(r.rejected).toBe(true);
  });

  // Credit card
  test("rejects credit card numbers", () => {
    expect(normalizeANumber("5275210014567723").rejected).toBe(true);
  });

  // Names
  test("rejects names", () => {
    expect(normalizeANumber("Hugo Valdez").rejected).toBe(true);
  });

  // Multiple A numbers
  test("rejects multiple A numbers", () => {
    expect(normalizeANumber("249-091-776 - 249-091-775").rejected).toBe(true);
  });

  // "not applicable"
  test("rejects 'not applicable'", () => {
    expect(normalizeANumber("not applicable").rejected).toBe(true);
  });

  // A-Number: prefix
  test("normalizes 'A-Number: 216-405-475'", () => {
    const r = normalizeANumber("A-Number: 216-405-475");
    expect(r.value).toBe("216-405-475");
    expect(r.rejected).toBe(false);
  });
});

describe("normalizeDateOfBirth", () => {
  // Already standard
  test("passes through MM/DD/YYYY", () => {
    const r = normalizeDateOfBirth("05/09/1986");
    expect(r.value).toBe("05/09/1986");
    expect(r.changed).toBe(false);
    expect(r.rejected).toBe(false);
  });

  // M/D/YYYY → padded
  test("normalizes M/D/YYYY", () => {
    const r = normalizeDateOfBirth("9/18/1981");
    expect(r.value).toBe("09/18/1981");
    expect(r.changed).toBe(true);
  });

  // YYYY-MM-DD
  test("normalizes YYYY-MM-DD", () => {
    const r = normalizeDateOfBirth("1977-11-19");
    expect(r.value).toBe("11/19/1977");
    expect(r.changed).toBe(true);
  });

  // Mon DD YYYY
  test("normalizes Mon DD YYYY", () => {
    const r = normalizeDateOfBirth("Nov 11 1975");
    expect(r.value).toBe("11/11/1975");
    expect(r.changed).toBe(true);
  });

  // 8 digits
  test("normalizes 8 digits MMDDYYYY", () => {
    const r = normalizeDateOfBirth("07061984");
    expect(r.value).toBe("07/06/1984");
    expect(r.changed).toBe(true);
  });

  // UTC timestamp
  test("strips UTC timestamp", () => {
    const r = normalizeDateOfBirth("Jan 05 1972, 22:00 UTC");
    expect(r.value).toBe("01/05/1972");
    expect(r.rejected).toBe(false);
  });

  // MM-DD-YYYY
  test("normalizes MM-DD-YYYY", () => {
    const r = normalizeDateOfBirth("12-27-1989");
    expect(r.value).toBe("12/27/1989");
    expect(r.changed).toBe(true);
  });

  // M-D-YYYY
  test("normalizes M-D-YYYY", () => {
    const r = normalizeDateOfBirth("9-30-1982");
    expect(r.value).toBe("09/30/1982");
    expect(r.changed).toBe(true);
  });

  // DD/MM/YYYY where day > 12
  test("handles DD/MM/YYYY when day > 12", () => {
    const r = normalizeDateOfBirth("30-01-1975");
    // 30 can't be a month, so swap to 01/30/1975
    expect(r.value).toBe("01/30/1975");
    expect(r.rejected).toBe(false);
  });

  // Spanish: "Diciembre 5 de 1975"
  test("normalizes Spanish date format", () => {
    const r = normalizeDateOfBirth("Diciembre 5 de 1975");
    expect(r.value).toBe("12/05/1975");
    expect(r.rejected).toBe(false);
  });

  // "05 agosto 1995"
  test("normalizes DD month YYYY Spanish", () => {
    const r = normalizeDateOfBirth("05 agosto 1995");
    expect(r.value).toBe("08/05/1995");
    expect(r.rejected).toBe(false);
  });

  // "16oct 1995"
  test("normalizes DDmon YYYY", () => {
    const r = normalizeDateOfBirth("16oct 1995");
    expect(r.value).toBe("10/16/1995");
    expect(r.rejected).toBe(false);
  });

  // "June 4 1976"
  test("normalizes full month name", () => {
    const r = normalizeDateOfBirth("June 4 1976");
    expect(r.value).toBe("06/04/1976");
    expect(r.rejected).toBe(false);
  });

  // MM DD YYYY with spaces
  test("normalizes space-separated", () => {
    const r = normalizeDateOfBirth("06 04 1986");
    expect(r.value).toBe("06/04/1986");
    expect(r.changed).toBe(true);
  });

  // M/D/YY
  test("normalizes M/D/YY (19xx)", () => {
    const r = normalizeDateOfBirth("7/30/68");
    expect(r.value).toBe("07/30/1968");
    expect(r.rejected).toBe(false);
  });

  test("normalizes M/D/YY (20xx)", () => {
    const r = normalizeDateOfBirth("05/26/02");
    expect(r.value).toBe("05/26/2002");
    expect(r.rejected).toBe(false);
  });

  // Implausible year
  test("rejects implausible year 0994", () => {
    const r = normalizeDateOfBirth("0994-04-11");
    expect(r.rejected).toBe(true);
    expect(r.reason).toContain("Implausible");
  });

  // Garbage
  test("rejects -", () => {
    expect(normalizeDateOfBirth("-").rejected).toBe(true);
  });

  // Non-date text
  test("rejects addresses pasted as DOB", () => {
    const r = normalizeDateOfBirth("536 E 37TH ST TOPEKA, KS 66605");
    expect(r.rejected).toBe(true);
  });

  // Phone number in DOB field
  test("rejects phone number", () => {
    const r = normalizeDateOfBirth("913-293-5718");
    expect(r.rejected).toBe(true);
  });

  // Multiple DOBs (family)
  test("rejects multiple dates for family", () => {
    const r = normalizeDateOfBirth("07/19/1986 - 05/24/1980 (husband)  - _12/14/2003 (daughter-in-law)");
    expect(r.rejected).toBe(true);
  });
});
