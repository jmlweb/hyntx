/**
 * Analytics Module
 *
 * Re-exports all analytics functionality for convenient importing.
 */

export {
  type ClusterOptions,
  clusterPrompts,
  createClusterAnalysis,
  findOptimalK,
  labelClusters,
} from './clustering.js';
export {
  createEmbeddingClient,
  type EmbeddingConfig,
  OllamaEmbeddingClient,
} from './embeddings.js';
export {
  computeLexicalComplexity,
  computePromptSpecificity,
} from './metrics.js';
export {
  computeDescriptiveStats,
  computePercentiles,
  detectOutliers,
} from './statistics.js';
export {
  analyzeTrend,
  computeMovingAverage,
  detectImprovement,
  forecastScore,
} from './trends.js';
