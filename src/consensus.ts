/**
 * BFT-inspired consensus engine.
 *
 * Algorithm:
 * 1. Normalize all responses (lowercase, strip whitespace)
 * 2. Compute pairwise similarity (Jaccard on word-level bigrams)
 * 3. Cluster responses by similarity >= threshold
 * 4. Pick the largest cluster as consensus
 * 5. Confidence = (cluster_size / total) × avg_pairwise_similarity
 *
 * This is adapted from the Byzantine fault tolerance approach in Aegis
 * (Median Absolute Deviation for sensor fusion), simplified for text.
 */

import type { ProviderResponse, FuseResult } from "./types.js";

/** Normalize text for comparison */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract word-level bigrams from text */
function bigrams(text: string): Set<string> {
  const words = normalize(text).split(" ").filter(Boolean);
  const bg = new Set<string>();
  for (let i = 0; i < words.length - 1; i++) {
    bg.add(`${words[i]}_${words[i + 1]}`);
  }
  // Also include unigrams for very short texts
  if (words.length < 3) {
    for (const w of words) bg.add(w);
  }
  return bg;
}

/** Jaccard similarity between two bigram sets */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  for (const x of a) {
    if (b.has(x)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Compute pairwise similarity matrix */
function similarityMatrix(
  responses: ProviderResponse[],
): number[][] {
  const bigramSets = responses.map((r) => bigrams(r.text));
  const n = responses.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      const sim = jaccardSimilarity(bigramSets[i], bigramSets[j]);
      matrix[i][j] = sim;
      matrix[j][i] = sim;
    }
  }
  return matrix;
}

/**
 * Find consensus using simple majority clustering.
 *
 * For each response, count how many other responses are similar (>= threshold).
 * The response with the most "votes" becomes the consensus representative.
 */
export function fuse(
  responses: ProviderResponse[],
  threshold: number = 0.6,
): FuseResult {
  if (responses.length === 0) {
    return {
      consensus: "",
      confidence: 0,
      method: "best-effort",
      agreed: [],
      outliers: [],
      responses,
      total: 0,
    };
  }

  if (responses.length === 1) {
    return {
      consensus: responses[0].text,
      confidence: 0.5, // single source, no consensus possible
      method: "best-effort",
      agreed: [responses[0].provider],
      outliers: [],
      responses,
      total: 1,
    };
  }

  const matrix = similarityMatrix(responses);
  const n = responses.length;

  // For each response, count agreements (similarity >= threshold)
  const votes = responses.map((_, i) => {
    let count = 0;
    let totalSim = 0;
    for (let j = 0; j < n; j++) {
      if (i !== j && matrix[i][j] >= threshold) {
        count++;
        totalSim += matrix[i][j];
      }
    }
    return { index: i, count, avgSim: count > 0 ? totalSim / count : 0 };
  });

  // Sort by vote count (descending), then by avg similarity
  votes.sort((a, b) => b.count - a.count || b.avgSim - a.avgSim);

  const best = votes[0];
  const bestIdx = best.index;

  // Find all responses that agree with the best one
  const agreed: string[] = [responses[bestIdx].provider];
  const outliers: ProviderResponse[] = [];

  for (let j = 0; j < n; j++) {
    if (j === bestIdx) continue;
    if (matrix[bestIdx][j] >= threshold) {
      agreed.push(responses[j].provider);
    } else {
      outliers.push(responses[j]);
    }
  }

  // Confidence: agreement ratio × average similarity
  const agreementRatio = agreed.length / n;
  const confidence = agreementRatio * (best.avgSim || 1);

  // Determine method
  let method: FuseResult["method"];
  if (agreed.length === n) {
    method = "unanimous";
  } else if (agreed.length > n / 2) {
    method = "majority";
  } else {
    method = "best-effort";
  }

  // Pick the longest response in the agreed cluster as the consensus
  const agreedTexts = [responses[bestIdx].text];
  for (let j = 0; j < n; j++) {
    if (j !== bestIdx && matrix[bestIdx][j] >= threshold) {
      agreedTexts.push(responses[j].text);
    }
  }
  const consensus = agreedTexts.reduce((a, b) => (b.length > a.length ? b : a));

  return {
    consensus,
    confidence: Math.round(confidence * 100) / 100,
    method,
    agreed,
    outliers,
    responses,
    total: n,
  };
}
