/**
 * Algorithm 2 – Bayesian average.
 * score = (C * m + sum of ratings) / (C + n)
 *   n = number of visible reviews of the item
 *   m = mean rating across all items of the same type
 *   C = confidence weight (how many "virtual" average reviews every item starts with)
 */
export const DEFAULT_CONFIDENCE = 5;
export const DEFAULT_PRIOR_MEAN = 3.5;

export function bayesianScore(ratings: number[], priorMean = DEFAULT_PRIOR_MEAN, confidence = DEFAULT_CONFIDENCE): number {
  const n = ratings.length;
  if (n === 0) return 0;
  const sum = ratings.reduce((a, b) => a + b, 0);
  const score = (confidence * priorMean + sum) / (confidence + n);
  return Math.round(score * 100) / 100;
}
