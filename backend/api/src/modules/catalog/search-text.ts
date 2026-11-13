/** Keep Unicode words, including Devanagari combining marks; never interpret query operators. */
export function queryWords(query: string): string[] {
  return (query.toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) ?? []).slice(0, 8);
}

/** Optimal-string-alignment distance: insertion, deletion, replacement and adjacent transposition. */
export function editDistance(left: string, right: string): number {
  const a = Array.from(left);
  const b = Array.from(right);
  const rows = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) rows[i][0] = i;
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
      }
    }
  }
  return rows[a.length][b.length];
}

export function correctWords(words: string[], vocabulary: string[]): string {
  const known = new Set(vocabulary);
  return words
    .map((word) => {
      if (known.has(word) || word.length < 3 || word.length > 40) return word;
      let best = word;
      let distance = (word.length >= 7 ? 2 : 1) + 1;
      // Vocabulary is ordered by catalog frequency, then alphabetically, for stable ties.
      for (const candidate of vocabulary) {
        if (Math.abs(candidate.length - word.length) >= distance) continue;
        const next = editDistance(word, candidate);
        if (next < distance) {
          best = candidate;
          distance = next;
        }
      }
      return best;
    })
    .join(' ');
}
