/**
 * Normalizers for field values.
 *
 * Each normalizer returns { value: string; changed: boolean; rejected: boolean; reason?: string }
 *
 * - value: the normalized output (or original if unchanged)
 * - changed: true if the value was modified
 * - rejected: true if the value is garbage and should not be written
 * - reason: explanation when rejected or changed
 */

export interface NormalizeResult {
  value: string;
  changed: boolean;
  rejected: boolean;
  reason?: string;
}

// ---------------------------------------------------------------------------
// A Number → XXX-XXX-XXX
// ---------------------------------------------------------------------------

// Known garbage patterns that are definitely not A numbers
const A_NUMBER_GARBAGE = [
  /^\/+$/,                    // "/" or "//"
  /^-+$/,                     // "-" or "--"
  /^\.+$/,                    // "."
  /^_+$/,                     // "__"
  /^\?+$/,                    // "?"
  /^0+$/,                     // "0000"
  /^n\/?a$/i,                 // "N/A", "NA", "n/a", "Na"
  /^no$/i,                    // "No"
  /^none$/i,                  // "None"
  /^unknown$/i,               // "Unknown", "UNKNOWN", "unknown"
  /^not applicable$/i,        // "Not applicable"
  /^noaplicable$/i,           // "noaplicable"
  /^no tengo$/i,              // "No tengo"
  /^s\/n$/i,                  // "S/N"
  /^\/answer/i,               // "/answer 5"
];

// Patterns that look like phone numbers (10 digits or formatted)
const PHONE_PATTERN = /^[\(\+]?\d[\d\s\-\(\)]{9,14}$/;

// SSN pattern
const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/;

// Credit card length numbers (15-16 digits)
const CC_PATTERN = /^\d{15,16}$/;

export function normalizeANumber(raw: string): NormalizeResult {
  const trimmed = raw.trim();

  // Check garbage patterns
  for (const pattern of A_NUMBER_GARBAGE) {
    if (pattern.test(trimmed)) {
      return { value: trimmed, changed: false, rejected: true, reason: `Garbage value: "${trimmed}"` };
    }
  }

  // Reject if it contains SSN
  if (SSN_PATTERN.test(trimmed)) {
    return { value: trimmed, changed: false, rejected: true, reason: "Contains SSN pattern" };
  }

  // Reject credit card numbers
  if (CC_PATTERN.test(trimmed)) {
    return { value: trimmed, changed: false, rejected: true, reason: "Looks like a credit card number" };
  }

  // Reject strings that are clearly not A numbers (contain letters beyond a leading A)
  // But first, try to extract a valid A number from the string

  // Strip leading "A", "A#", "A-", brackets
  let cleaned = trimmed
    .replace(/^[\[\(]/, "")   // leading [ or (
    .replace(/[\]\)]$/, "")   // trailing ] or )
    .replace(/^A[#\-\s]*/i, "") // leading A, A#, A-, A (space)
    .replace(/^A-?Number:?\s*/i, "") // "A-Number: "
    .trim();

  // Extract only digits
  const digits = cleaned.replace(/[^\d]/g, "");

  // A valid A number is exactly 9 digits
  if (digits.length === 9) {
    const formatted = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}`;
    const wasChanged = formatted !== trimmed;
    return { value: formatted, changed: wasChanged, rejected: false, reason: wasChanged ? `Normalized from "${trimmed}"` : undefined };
  }

  // If we have too few or too many digits, check if it's a phone number
  if (digits.length === 10 && PHONE_PATTERN.test(trimmed)) {
    return { value: trimmed, changed: false, rejected: true, reason: "Looks like a phone number, not an A number" };
  }

  // Contains multiple A numbers (family cases) — reject, too complex
  if (/\d{3}[-\s]?\d{3}[-\s]?\d{3}.*\d{3}[-\s]?\d{3}[-\s]?\d{3}/.test(trimmed)) {
    return { value: trimmed, changed: false, rejected: true, reason: "Contains multiple A numbers (family case)" };
  }

  // If we get here, it's not a recognizable 9-digit A number
  // Check if it looks like it has some digits but isn't valid
  if (digits.length > 0 && digits.length < 9) {
    return { value: trimmed, changed: false, rejected: true, reason: `Only ${digits.length} digits found, need 9 for A number` };
  }

  if (digits.length > 9) {
    return { value: trimmed, changed: false, rejected: true, reason: `${digits.length} digits found, too many for A number` };
  }

  // Pure text / names — reject
  return { value: trimmed, changed: false, rejected: true, reason: `Not a recognizable A number: "${trimmed.slice(0, 50)}"` };
}

// ---------------------------------------------------------------------------
// Date of Birth → MM/DD/YYYY
// ---------------------------------------------------------------------------

const MONTH_NAMES: Record<string, string> = {
  jan: "01", january: "01", enero: "01",
  feb: "02", february: "02", febrero: "02",
  mar: "03", march: "03", marzo: "03",
  apr: "04", april: "04", abril: "04",
  may: "05", mayo: "05",
  jun: "06", june: "06", junio: "06",
  jul: "07", july: "07", julio: "07",
  aug: "08", august: "08", agosto: "08",
  sep: "09", september: "09", septiembre: "09", sept: "09",
  oct: "10", october: "10", octubre: "10",
  nov: "11", november: "11", noviembre: "11",
  dec: "12", december: "12", diciembre: "12",
};

const DOB_GARBAGE = [
  /^\/+$/, /^-+$/, /^\.+$/, /^_+$/,
  /^n\/?a$/i, /^no$/i, /^none$/i, /^unknown$/i,
];

export function normalizeDateOfBirth(raw: string): NormalizeResult {
  let trimmed = raw.trim();

  // Check garbage
  for (const pattern of DOB_GARBAGE) {
    if (pattern.test(trimmed)) {
      return { value: trimmed, changed: false, rejected: true, reason: `Garbage value: "${trimmed}"` };
    }
  }

  // Contains multiple DOBs (family cases) — reject
  if (/\||\/{2,}|&|\+/.test(trimmed) && /\d{2}\/\d{2}\/\d{4}.*\d{2}\/\d{2}\/\d{4}/.test(trimmed)) {
    return { value: trimmed, changed: false, rejected: true, reason: "Contains multiple dates (family case)" };
  }

  // Strip UTC timestamp suffix: "Jan 05 1972, 22:00 UTC" → "Jan 05 1972"
  trimmed = trimmed.replace(/,\s*\d{2}:\d{2}\s*UTC$/i, "").trim();

  // Try parsing various formats

  // 1. MM/DD/YYYY (already standard)
  let m = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    return validateAndFormat(m[1], m[2], m[3], trimmed);
  }

  // 2. M/D/YYYY
  m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    return validateAndFormat(pad2(m[1]), pad2(m[2]), m[3], trimmed);
  }

  // 3. M/D/YY — assume 19xx for years > 30, 20xx for <= 30
  m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (m) {
    const yy = parseInt(m[3]);
    const yyyy = String(yy > 30 ? 1900 + yy : 2000 + yy);
    return validateAndFormat(pad2(m[1]), pad2(m[2]), yyyy, trimmed);
  }

  // 4. YYYY-MM-DD
  m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    return validateAndFormat(m[2], m[3], m[1], trimmed);
  }

  // 5. MM-DD-YYYY or M-D-YYYY
  m = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) {
    return validateAndFormat(pad2(m[1]), pad2(m[2]), m[3], trimmed);
  }

  // 6. DD-MM-YYYY (day > 12 tells us it's DD/MM)
  // Already handled above — ambiguous cases default to MM/DD

  // 7. 8 digits no separator: MMDDYYYY
  m = trimmed.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (m) {
    return validateAndFormat(m[1], m[2], m[3], trimmed);
  }

  // 8. "Mon DD YYYY" or "Month DD YYYY"
  m = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})$/);
  if (m) {
    const monthNum = MONTH_NAMES[m[1].toLowerCase()];
    if (monthNum) {
      return validateAndFormat(monthNum, pad2(m[2]), m[3], trimmed);
    }
  }

  // 9. "DD Month YYYY" or "DDMonth YYYY" (e.g. "16oct 1995")
  m = trimmed.match(/^(\d{1,2})\s*([A-Za-z]+)\s+(\d{4})$/);
  if (m) {
    const monthNum = MONTH_NAMES[m[2].toLowerCase()];
    if (monthNum) {
      return validateAndFormat(monthNum, pad2(m[1]), m[3], trimmed);
    }
  }

  // 10. "Month DD de YYYY" (Spanish: "Diciembre 5 de 1975")
  m = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2})\s+de\s+(\d{4})$/i);
  if (m) {
    const monthNum = MONTH_NAMES[m[1].toLowerCase()];
    if (monthNum) {
      return validateAndFormat(monthNum, pad2(m[2]), m[3], trimmed);
    }
  }

  // 11. "DD Month YYYY" (Spanish: "05 agosto 1995")
  m = trimmed.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (m) {
    const monthNum = MONTH_NAMES[m[2].toLowerCase()];
    if (monthNum) {
      return validateAndFormat(monthNum, pad2(m[1]), m[3], trimmed);
    }
  }

  // 12. "Month D YYYY" full english (e.g. "June 4 1976", "July 2 1994")
  // Already caught by pattern 8

  // 13. MM DD YYYY with spaces
  m = trimmed.match(/^(\d{2})\s+(\d{2})\s+(\d{4})$/);
  if (m) {
    return validateAndFormat(m[1], m[2], m[3], trimmed);
  }

  // Could not parse
  return { value: trimmed, changed: false, rejected: true, reason: `Could not parse date: "${trimmed.slice(0, 50)}"` };
}

function pad2(s: string): string {
  return s.length === 1 ? "0" + s : s;
}

function validateAndFormat(mm: string, dd: string, yyyy: string, original: string): NormalizeResult {
  const month = parseInt(mm);
  const day = parseInt(dd);
  const year = parseInt(yyyy);

  // Basic sanity checks
  if (month < 1 || month > 12) {
    // Maybe it's DD/MM? Try swapping if day is valid as month
    if (day >= 1 && day <= 12 && month >= 1 && month <= 31) {
      // Swap — this was DD/MM/YYYY
      const formatted = `${pad2(String(day))}/${pad2(String(month))}/${yyyy}`;
      return { value: formatted, changed: formatted !== original, rejected: false, reason: `Interpreted as DD/MM/YYYY, normalized from "${original}"` };
    }
    return { value: original, changed: false, rejected: true, reason: `Invalid month: ${month}` };
  }

  if (day < 1 || day > 31) {
    return { value: original, changed: false, rejected: true, reason: `Invalid day: ${day}` };
  }

  // Year sanity: should be between 1920 and 2025 for a person's DOB
  if (year < 1920 || year > 2025) {
    return { value: original, changed: false, rejected: true, reason: `Implausible birth year: ${year}` };
  }

  const formatted = `${pad2(mm)}/${pad2(dd)}/${yyyy}`;
  const wasChanged = formatted !== original;
  return {
    value: formatted,
    changed: wasChanged,
    rejected: false,
    reason: wasChanged ? `Normalized from "${original}"` : undefined,
  };
}
