/**
 * Exact cosine similarity calculation for 512-dimensional L2-normalized embeddings.
 * Because vectors are L2-normalized, cosine similarity equals the dot product.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error(`Dimension mismatch: ${vecA.length} vs ${vecB.length}`);
  }
  let dot = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
  }
  return dot;
}

/**
 * Normalizes a vector in-place or returns a normalized copy.
 */
export function l2Normalize(vec: number[]): number[] {
  let sumSq = 0;
  for (let i = 0; i < vec.length; i++) {
    sumSq += vec[i] * vec[i];
  }
  const norm = Math.sqrt(sumSq);
  if (norm < 1e-8) return vec.slice();
  return vec.map((v) => v / norm);
}

/**
 * Fallback keyword tokenizer and soft vector similarity when query is not in precomputed CLIP cache.
 */
export function keywordJaccard(query: string, tags: string[], description: string): number {
  const qTokens = new Set(
    query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );

  const docTokens = new Set([
    ...tags.map((t) => t.toLowerCase()),
    ...description
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2),
  ]);

  if (qTokens.size === 0 || docTokens.size === 0) return 0.1;

  let intersection = 0;
  qTokens.forEach((t) => {
    if (docTokens.has(t)) intersection++;
  });

  return intersection / (qTokens.size + docTokens.size - intersection);
}
