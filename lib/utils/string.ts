/**
 * String Normalization & Fuzzy Matching Utilities for TutorLedger V2
 */

export function normalizeName(str?: string | null): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/\b(and|\&)\b/gi, "and") // Standardize & / and
    .replace(/[^\w\s]/gi, " ") // Replace punctuation with space
    .replace(/\s+/g, " ") // Collapse whitespace
    .trim();
}

/**
 * Levenshtein Distance for typo-tolerant matching
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0]![j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!;
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j - 1]! + 1, // substitution
          matrix[i]![j - 1]! + 1, // insertion
          matrix[i - 1]![j]! + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length]![a.length]!;
}

/**
 * Calculates similarity score between 0.0 and 1.0 with fuzzy token matching
 */
export function stringSimilarity(str1: string, str2: string): number {
  const norm1 = normalizeName(str1);
  const norm2 = normalizeName(str2);

  if (norm1 === norm2) return 1.0;
  if (!norm1 || !norm2) return 0.0;

  const tokens1 = norm1.split(" ").filter((t) => t !== "and" && t.length >= 3);
  const tokens2 = norm2.split(" ").filter((t) => t !== "and" && t.length >= 3);

  // Token-level fuzzy matching
  for (const t1 of tokens1) {
    for (const t2 of tokens2) {
      if (t1 === t2 || t1.includes(t2) || t2.includes(t1)) return 0.85;
      if (levenshteinDistance(t1, t2) <= 1) return 0.85;
    }
  }

  const maxLen = Math.max(norm1.length, norm2.length);
  const dist = levenshteinDistance(norm1, norm2);
  const score = 1.0 - dist / maxLen;

  return Math.max(0, score);
}
