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
