/**
 * Prompt Clustering Module
 *
 * Provides K-means clustering for grouping similar prompts based on embeddings.
 * Includes automatic K selection, cluster labeling, and quality metrics.
 */

import { distance, similarity } from 'ml-distance';
import { kmeans as kmeansFunc } from 'ml-kmeans';

import type {
  Cluster,
  ClusterAnalysis,
  ClusterResult,
  LabeledCluster,
} from '../types/index.js';
import { logger } from '../utils/logger-base.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for clustering configuration.
 */
export type ClusterOptions = {
  readonly k?: number;
  readonly maxK?: number;
  readonly distanceMetric?: 'euclidean' | 'cosine';
  readonly maxIterations?: number;
  readonly initialization?: 'random' | 'kmeans++';
};

/**
 * Internal K-means result from ml-kmeans library.
 */
type KMeansResult = {
  readonly clusters: number[];
  readonly centroids: number[][];
  readonly iterations: number;
  readonly converged: boolean;
};

// =============================================================================
// Defaults
// =============================================================================

const DEFAULT_OPTIONS: Required<ClusterOptions> = {
  k: 0, // 0 means auto-detect
  maxK: 8,
  distanceMetric: 'cosine',
  maxIterations: 100,
  initialization: 'kmeans++',
} as const;

// =============================================================================
// Main Clustering Functions
// =============================================================================

/**
 * Cluster prompts based on their embeddings using K-means.
 *
 * @param embeddings - Array of embedding vectors (all must have same dimensionality)
 * @param options - Optional clustering configuration
 * @returns Clustering result with clusters, centroids, and quality metrics
 *
 * @example
 * ```typescript
 * const embeddings = [[0.1, 0.2, ...], [0.15, 0.18, ...], ...];
 * const result = clusterPrompts(embeddings, { maxK: 5 });
 * console.log(`Found ${result.k} clusters`);
 * console.log(`Silhouette score: ${result.silhouetteScore}`);
 * ```
 */
export function clusterPrompts(
  embeddings: readonly (readonly number[])[],
  options?: ClusterOptions,
): ClusterResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (embeddings.length < 2) {
    // Not enough data for clustering
    return {
      clusters: [],
      centroids: [],
      k: 0,
      silhouetteScore: 0,
      inertia: 0,
    };
  }

  // Determine optimal K if not specified
  const k = opts.k && opts.k > 0 ? opts.k : findOptimalK(embeddings, opts.maxK);

  if (k === 0 || k > embeddings.length) {
    return {
      clusters: [],
      centroids: [],
      k: 0,
      silhouetteScore: 0,
      inertia: 0,
    };
  }

  // Run K-means
  const data = embeddings.map((e) => [...e]); // ml-kmeans requires mutable arrays
  const result = kmeansFunc(data, k, {
    initialization: opts.initialization,
    maxIterations: opts.maxIterations,
    distanceFunction:
      opts.distanceMetric === 'cosine' ? cosineDistance : euclideanDistance,
  }) as KMeansResult;

  // Convert cluster assignments to Cluster objects
  const clusters = buildClusters(result.clusters);

  // Calculate quality metrics
  const silhouetteScore = computeSilhouetteScore(
    embeddings,
    clusters,
    opts.distanceMetric,
  );
  const inertia = computeInertia(
    embeddings,
    result.centroids,
    result.clusters,
    opts.distanceMetric,
  );

  return {
    clusters,
    centroids: result.centroids,
    k,
    silhouetteScore,
    inertia,
  };
}

/**
 * Find optimal number of clusters using the elbow method.
 *
 * @param embeddings - Array of embedding vectors
 * @param maxK - Maximum number of clusters to try
 * @returns Optimal K value
 */
export function findOptimalK(
  embeddings: readonly (readonly number[])[],
  maxK: number,
): number {
  if (embeddings.length < 2) {
    return 0;
  }

  // Ensure maxK is reasonable
  const actualMaxK = Math.min(maxK, Math.floor(embeddings.length / 2));

  if (actualMaxK < 2) {
    return Math.min(2, embeddings.length);
  }

  const inertias: number[] = [];
  const data = embeddings.map((e) => [...e]);

  // Calculate inertia for each K from 2 to maxK
  for (let k = 2; k <= actualMaxK; k++) {
    try {
      const result = kmeansFunc(data, k, {
        initialization: 'kmeans++',
        maxIterations: 50, // Fewer iterations for speed
        distanceFunction: cosineDistance,
      }) as KMeansResult;

      const inertia = computeInertia(
        embeddings,
        result.centroids,
        result.clusters,
        'cosine',
      );
      inertias.push(inertia);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.debug(`K-means failed for k=${String(k)}: ${message}`);
      break;
    }
  }

  if (inertias.length < 2) {
    return 2;
  }

  // Find elbow using second derivative
  const deltas = inertias.slice(1).map((v, i) => {
    const prevInertia = inertias[i];
    return prevInertia !== undefined ? prevInertia - v : 0;
  });
  if (deltas.length < 2) {
    return 2;
  }

  const secondDeltas = deltas.slice(1).map((v, i) => {
    const prevDelta = deltas[i];
    return prevDelta !== undefined ? prevDelta - v : 0;
  });
  if (secondDeltas.length === 0) {
    return 2;
  }

  const elbowIndex = secondDeltas.indexOf(Math.max(...secondDeltas));
  return elbowIndex + 3; // +3 because: +2 for offsets, +1 because we start at k=2
}

/**
 * Label clusters with meaningful names based on prompts.
 *
 * @param clusters - Clusters to label
 * @param prompts - Original prompts corresponding to embeddings
 * @returns Labeled clusters with keywords and representative examples
 */
export function labelClusters(
  clusters: readonly Cluster[],
  prompts: readonly string[],
): LabeledCluster[] {
  return clusters.map((cluster) => {
    const clusterPrompts = cluster.indices
      .map((i) => prompts[i])
      .filter((p): p is string => p !== undefined);

    if (clusterPrompts.length === 0) {
      return {
        ...cluster,
        label: `Cluster ${String(cluster.id)}`,
        keywords: [],
        representativePrompt: '',
      };
    }

    // Extract keywords
    const keywords = extractKeywords(clusterPrompts);

    // Infer label from keywords
    const label = inferClusterLabel(keywords);

    // Find most representative prompt (shortest one, as it's likely most concise)
    const representativePrompt =
      clusterPrompts.length > 0
        ? clusterPrompts.reduce((shortest, current) =>
            current.length < shortest.length ? current : shortest,
          )
        : '';

    return {
      ...cluster,
      label,
      keywords,
      representativePrompt,
    };
  });
}

/**
 * Create complete cluster analysis with labeled clusters and summary.
 *
 * @param result - Raw clustering result
 * @param prompts - Original prompts
 * @returns Complete cluster analysis
 */
export function createClusterAnalysis(
  result: ClusterResult,
  prompts: readonly string[],
): ClusterAnalysis {
  const labeledClusters = labelClusters(result.clusters, prompts);

  const clusterSizes = labeledClusters.map((c) => c.size);
  const avgClusterSize =
    clusterSizes.length > 0
      ? clusterSizes.reduce((a, b) => a + b, 0) / clusterSizes.length
      : 0;
  const largestCluster =
    clusterSizes.length > 0 ? Math.max(...clusterSizes) : 0;
  const smallestCluster =
    clusterSizes.length > 0 ? Math.min(...clusterSizes) : 0;

  return {
    clusters: labeledClusters,
    metrics: {
      silhouetteScore: result.silhouetteScore,
      inertia: result.inertia,
      optimalK: result.k,
    },
    summary: {
      totalPrompts: prompts.length,
      avgClusterSize: Math.round(avgClusterSize * 10) / 10,
      largestCluster,
      smallestCluster,
    },
  };
}

// =============================================================================
// Internal Helper Functions
// =============================================================================

/**
 * Convert cluster assignments array to Cluster objects.
 */
function buildClusters(assignments: readonly number[]): Cluster[] {
  const clusterMap = new Map<number, number[]>();

  assignments.forEach((clusterId, index) => {
    if (!clusterMap.has(clusterId)) {
      clusterMap.set(clusterId, []);
    }
    const cluster = clusterMap.get(clusterId);
    if (cluster) {
      cluster.push(index);
    }
  });

  return Array.from(clusterMap.entries()).map(([id, indices]) => ({
    id,
    indices,
    size: indices.length,
  }));
}

/**
 * Compute silhouette score for clustering quality assessment.
 * Score ranges from -1 to 1, where higher is better.
 */
function computeSilhouetteScore(
  embeddings: readonly (readonly number[])[],
  clusters: readonly Cluster[],
  distanceMetric: 'euclidean' | 'cosine',
): number {
  if (clusters.length < 2 || embeddings.length < 2) {
    return 0;
  }

  const distFunc =
    distanceMetric === 'cosine' ? cosineDistance : euclideanDistance;

  let totalScore = 0;
  let count = 0;

  for (const cluster of clusters) {
    for (const i of cluster.indices) {
      const point = embeddings[i];
      if (!point) continue;

      // a: average distance to points in same cluster
      const sameCluster = cluster.indices.filter((j) => j !== i);
      const a =
        sameCluster.length > 0
          ? sameCluster.reduce((sum, j) => {
              const otherPoint = embeddings[j];
              return otherPoint ? sum + distFunc(point, otherPoint) : sum;
            }, 0) / sameCluster.length
          : 0;

      // b: minimum average distance to points in other clusters
      let minAvgDist = Infinity;
      for (const otherCluster of clusters) {
        if (otherCluster.id === cluster.id) continue;

        const avgDist =
          otherCluster.indices.reduce((sum, j) => {
            const otherPoint = embeddings[j];
            return otherPoint ? sum + distFunc(point, otherPoint) : sum;
          }, 0) / otherCluster.size;

        minAvgDist = Math.min(minAvgDist, avgDist);
      }

      const b = minAvgDist;
      const s = (b - a) / Math.max(a, b);

      totalScore += s;
      count++;
    }
  }

  return count > 0 ? totalScore / count : 0;
}

/**
 * Compute inertia (sum of squared distances to nearest centroid).
 * Lower inertia indicates tighter clusters.
 */
function computeInertia(
  embeddings: readonly (readonly number[])[],
  centroids: readonly (readonly number[])[],
  assignments: readonly number[],
  distanceMetric: 'euclidean' | 'cosine',
): number {
  const distFunc =
    distanceMetric === 'cosine' ? cosineDistance : euclideanDistance;

  let inertia = 0;
  for (let i = 0; i < embeddings.length; i++) {
    const clusterId = assignments[i];
    const embedding = embeddings[i];
    if (clusterId === undefined || embedding === undefined) continue;

    const centroid = centroids[clusterId];
    if (!centroid) continue;

    const dist = distFunc(embedding, centroid);
    inertia += dist * dist;
  }

  return inertia;
}

/**
 * Extract top keywords from cluster prompts.
 */
function extractKeywords(prompts: readonly string[]): string[] {
  const wordFreq = new Map<string, number>();

  for (const prompt of prompts) {
    const words = prompt.toLowerCase().match(/\b[a-z]{3,}\b/gi) ?? [];
    for (const word of words) {
      wordFreq.set(word, (wordFreq.get(word) ?? 0) + 1);
    }
  }

  // Filter common words
  const commonWords = new Set([
    'the',
    'and',
    'for',
    'with',
    'from',
    'this',
    'that',
    'have',
    'has',
    'are',
    'was',
  ]);

  const keywords = Array.from(wordFreq.entries())
    .filter(([word]) => !commonWords.has(word))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);

  return keywords;
}

/**
 * Infer cluster label from keywords.
 */
function inferClusterLabel(keywords: readonly string[]): string {
  if (keywords.length === 0) {
    return 'Mixed Prompts';
  }

  // Pattern matching for common themes
  const keywordSet = new Set(keywords.map((k) => k.toLowerCase()));

  if (
    keywordSet.has('fix') ||
    keywordSet.has('debug') ||
    keywordSet.has('error') ||
    keywordSet.has('bug')
  ) {
    return 'Debug & Fix Issues';
  }

  if (
    keywordSet.has('add') ||
    keywordSet.has('create') ||
    keywordSet.has('implement') ||
    keywordSet.has('build')
  ) {
    return 'Feature Implementation';
  }

  if (
    keywordSet.has('refactor') ||
    keywordSet.has('improve') ||
    keywordSet.has('optimize') ||
    keywordSet.has('clean')
  ) {
    return 'Refactoring';
  }

  if (
    keywordSet.has('test') ||
    keywordSet.has('testing') ||
    keywordSet.has('spec')
  ) {
    return 'Testing';
  }

  if (
    keywordSet.has('update') ||
    keywordSet.has('modify') ||
    keywordSet.has('change')
  ) {
    return 'Updates & Modifications';
  }

  // Default: capitalize first keyword
  const firstKeyword = keywords[0];
  if (!firstKeyword) return 'Mixed Prompts';
  const firstChar = firstKeyword[0];
  if (!firstChar) return 'Mixed Prompts';
  return firstChar.toUpperCase() + firstKeyword.slice(1) + ' Tasks';
}

/**
 * Cosine distance wrapper for ml-kmeans.
 * Converts cosine similarity to distance: 1 - similarity
 */
function cosineDistance(a: readonly number[], b: readonly number[]): number {
  const sim = similarity.cosine(a as number[], b as number[]);
  return 1 - sim; // Convert similarity to distance
}

/**
 * Euclidean distance wrapper for ml-kmeans.
 */
function euclideanDistance(a: readonly number[], b: readonly number[]): number {
  return distance.euclidean(a as number[], b as number[]);
}
