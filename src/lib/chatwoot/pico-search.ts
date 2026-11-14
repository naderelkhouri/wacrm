// ============================================================
// PicoSearch — fzf-style subsequence fuzzy search (<750B logic)
// Adapted from @chatwoot/pico-search (MIT License)
// ============================================================

export interface KeyWithWeight {
  name: string;
  weight: number;
}

export type PicoKeys = Array<KeyWithWeight | string>;

/** Check if position `i` in `str` is a word boundary (camelCase, separator). */
function isBoundary(str: string, i: number): boolean {
  if (i === 0) return true;
  const prev = str[i - 1];
  const curr = str[i];
  if (' _-./:'.includes(prev)) return true;
  if (
    prev === prev.toLowerCase() &&
    curr === curr.toUpperCase() &&
    curr !== curr.toLowerCase()
  ) {
    return true;
  }
  return false;
}

/**
 * fzf-style fuzzy score. Returns 0 (no match) to 1 (perfect match).
 * Forward scan finds a subsequence match, reverse scan tightens the window,
 * then scores reward consecutive runs, word-boundary hits, and prefix matches.
 */
export function fuzzyScore(target: string, pattern: string): number {
  if (pattern.length === 0) return 1;
  if (target.length === 0) return 0;

  const tLower = target.toLowerCase();
  const pLower = pattern.toLowerCase();

  if (tLower === pLower) return 1;

  const pLen = pLower.length;

  // Forward pass: find first valid subsequence (greedy left-to-right)
  let pi = 0;
  let endPos = -1;
  for (let ti = 0; ti < tLower.length; ti++) {
    if (tLower[ti] === pLower[pi]) {
      pi++;
      if (pi === pLen) {
        endPos = ti;
        break;
      }
    }
  }
  if (endPos === -1) return 0; // no subsequence match

  // Reverse pass: tighten the window from endPos backwards
  let startPos = endPos;
  for (pi = pLen - 1; pi >= 0; pi--) {
    while (tLower[startPos] !== pLower[pi]) startPos--;
    startPos--;
  }
  startPos++;

  // Score the window [startPos..endPos]
  let score = 0;
  let consecutive = 0;
  pi = 0;

  for (let ti = startPos; ti <= endPos; ti++) {
    if (tLower[ti] === pLower[pi]) {
      consecutive++;
      score += consecutive;

      if (ti === 0) score += 2;
      else if (isBoundary(target, ti)) score += 1.5;

      pi++;
    } else {
      consecutive = 0;
    }
  }

  // Normalize against ideal (consecutive run + first-position bonus)
  const maxScore = (pLen * (pLen + 1)) / 2 + 2;
  const raw = Math.min(1, score / maxScore);

  // Mild length penalty — prefer shorter targets as a tiebreaker
  const lengthPenalty = 1 - 0.1 * (1 - pLen / target.length);

  return raw * lengthPenalty;
}

export function weightedAverage(values: number[], weights?: number[]): number {
  let sum = 0;
  let totalWeight = 0;

  if (weights && values.length !== weights.length) {
    throw new Error('The number of values must be equal to the number of weights');
  }

  for (let i = 0; i < values.length; i++) {
    const weight = weights ? weights[i] : 1;
    sum += values[i] * weight;
    totalWeight += weight;
  }

  return totalWeight === 0 ? 0 : sum / totalWeight;
}

function getNestedValue(obj: unknown, path: string): string {
  if (!obj || typeof obj !== 'object') return '';
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return '';
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string'
    ? current.trim()
    : typeof current === 'number'
      ? String(current)
      : '';
}

/**
 * Searches for objects in an array based on a search term and a set of keys
 * (supports dot-notation paths like 'contact.name').
 */
export function picoSearch<T>(
  objectsArray: T[],
  searchTerm: string,
  keys: PicoKeys,
  config?: { threshold?: number },
): T[] {
  if (typeof searchTerm !== 'string') {
    return objectsArray;
  }

  const trimmed = searchTerm.trim().toLowerCase();
  if (!trimmed) {
    return objectsArray;
  }

  const results: Array<{ object: T; similarity: number }> = [];
  const threshold = config?.threshold ?? 0.28;
  const terms = trimmed.split(/\s+/).filter(Boolean);

  const normalizedKeys = keys.map((k) =>
    typeof k === 'string' ? { name: k, weight: 1 } : k,
  );

  objectsArray.forEach((obj) => {
    const values = normalizedKeys.map((k) => getNestedValue(obj, k.name));

    if (terms.length <= 1) {
      const scores = values.map((v) => (v ? fuzzyScore(v, terms[0]) : 0));
      const weights = normalizedKeys.map((k) => k.weight);
      // Use max weighted score or weighted average if multiple keys match
      const bestSingle = Math.max(
        ...scores.map((s, idx) => s * (weights[idx] / Math.max(...weights))),
        0,
      );
      const avg = weightedAverage(scores, weights);
      const similarity = Math.max(bestSingle, avg);

      if (similarity >= threshold) {
        results.push({ object: obj, similarity });
      }
    } else {
      const termScores = terms.map((term) => {
        let best = 0;
        for (let i = 0; i < values.length; i++) {
          if (values[i]) {
            const s = fuzzyScore(values[i], term);
            if (s > best) best = s;
          }
        }
        return best;
      });

      const similarity = Math.min(...termScores);
      if (similarity >= threshold) {
        results.push({ object: obj, similarity });
      }
    }
  });

  results.sort((a, b) => b.similarity - a.similarity);
  return results.map((r) => r.object);
}
