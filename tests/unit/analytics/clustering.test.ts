/**
 * Unit tests for clustering module
 */

import { describe, expect, it } from 'vitest';

import {
  clusterPrompts,
  createClusterAnalysis,
  findOptimalK,
  labelClusters,
} from '../../../src/analytics/clustering.js';

describe('clustering', () => {
  // Helper function to generate deterministic embeddings for testing
  function generateEmbedding(seed: number, dimensions = 10): number[] {
    const embedding: number[] = [];
    for (let i = 0; i < dimensions; i++) {
      // Simple deterministic generation
      embedding.push(Math.sin(seed + i) * 0.5 + 0.5);
    }
    return embedding;
  }

  // Helper to create distinct cluster embeddings
  function createClusterEmbeddings(
    clusterCenters: number[][],
    pointsPerCluster: number,
  ): number[][] {
    const embeddings: number[][] = [];

    for (const center of clusterCenters) {
      for (let i = 0; i < pointsPerCluster; i++) {
        // Add small random variation around center
        const point = center.map((val) => val + (Math.random() - 0.5) * 0.1);
        embeddings.push(point);
      }
    }

    return embeddings;
  }

  describe('clusterPrompts', () => {
    it('should cluster embeddings into groups', () => {
      // Create 3 distinct clusters
      const cluster1Center = Array(10).fill(0.2);
      const cluster2Center = Array(10).fill(0.5);
      const cluster3Center = Array(10).fill(0.8);

      const embeddings = createClusterEmbeddings(
        [cluster1Center, cluster2Center, cluster3Center],
        3,
      );

      const result = clusterPrompts(embeddings, { k: 3 });

      expect(result.k).toBe(3);
      expect(result.clusters).toHaveLength(3); // 3 cluster groups
      expect(result.centroids).toHaveLength(3);
      expect(result.silhouetteScore).toBeGreaterThan(0);
    });

    it('should auto-detect optimal K if not specified', () => {
      const cluster1Center = Array(10).fill(0.2);
      const cluster2Center = Array(10).fill(0.8);

      const embeddings = createClusterEmbeddings(
        [cluster1Center, cluster2Center],
        5,
      );

      const result = clusterPrompts(embeddings);

      expect(result.k).toBeGreaterThanOrEqual(2);
      expect(result.k).toBeLessThanOrEqual(8); // maxK default
    });

    it('should handle minimum cluster size', () => {
      const embeddings = [
        generateEmbedding(1),
        generateEmbedding(2),
        generateEmbedding(3),
      ];

      const result = clusterPrompts(embeddings, { k: 2 });

      expect(result.k).toBe(2);
      expect(result.clusters).toHaveLength(2); // 2 cluster groups
    });

    it('should use cosine distance by default', () => {
      const embeddings = [
        [1, 0, 0, 0, 0],
        [0.9, 0.1, 0, 0, 0],
        [0, 0, 1, 0, 0],
        [0, 0, 0.9, 0.1, 0],
      ];

      const result = clusterPrompts(embeddings, { k: 2 });

      // First two should cluster together, last two together (cosine similarity)
      expect(result.k).toBe(2);
    });

    it('should support euclidean distance', () => {
      const embeddings = [
        [1, 1],
        [1.1, 1.1],
        [5, 5],
        [5.1, 5.1],
      ];

      const result = clusterPrompts(embeddings, {
        k: 2,
        distanceMetric: 'euclidean',
      });

      expect(result.k).toBe(2);
    });

    it('should respect maxIterations parameter', () => {
      const embeddings = Array.from({ length: 10 }, (_, i) =>
        generateEmbedding(i),
      );

      const result = clusterPrompts(embeddings, {
        k: 3,
        maxIterations: 10,
      });

      expect(result.k).toBe(3);
    });

    it('should calculate silhouette score', () => {
      const cluster1Center = Array(10).fill(0.1);
      const cluster2Center = Array(10).fill(0.9);

      const embeddings = createClusterEmbeddings(
        [cluster1Center, cluster2Center],
        5,
      );

      const result = clusterPrompts(embeddings, { k: 2 });

      // Well-separated clusters should have high silhouette score
      expect(result.silhouetteScore).toBeGreaterThan(0);
      expect(result.silhouetteScore).toBeLessThanOrEqual(1);
    });
  });

  describe('findOptimalK', () => {
    it('should find optimal number of clusters', () => {
      // Create data with clear 3-cluster structure
      const cluster1Center = Array(10).fill(0.2);
      const cluster2Center = Array(10).fill(0.5);
      const cluster3Center = Array(10).fill(0.8);

      const embeddings = createClusterEmbeddings(
        [cluster1Center, cluster2Center, cluster3Center],
        5,
      );

      const optimalK = findOptimalK(embeddings, 5);

      expect(optimalK).toBeGreaterThanOrEqual(2);
      expect(optimalK).toBeLessThanOrEqual(5);
    });

    it('should handle small datasets', () => {
      const embeddings = [
        generateEmbedding(1),
        generateEmbedding(2),
        generateEmbedding(3),
        generateEmbedding(4),
      ];

      const optimalK = findOptimalK(embeddings, 3);

      expect(optimalK).toBeGreaterThanOrEqual(2);
      expect(optimalK).toBeLessThanOrEqual(3);
    });

    it('should return minimum K for very small datasets', () => {
      const embeddings = [
        generateEmbedding(1),
        generateEmbedding(2),
        generateEmbedding(3),
      ];

      const optimalK = findOptimalK(embeddings, 5);

      expect(optimalK).toBe(2); // Minimum
    });
  });

  describe('labelClusters', () => {
    it('should extract keywords from prompts', () => {
      const clusters = [
        { id: 0, indices: [0, 1], size: 2 },
        { id: 1, indices: [2, 3], size: 2 },
      ];

      const prompts = [
        'Fix the authentication bug in login.ts',
        'Debug authentication error in signup',
        'Refactor the payment processing code',
        'Optimize payment gateway integration',
      ];

      const labeled = labelClusters(clusters, prompts);

      expect(labeled).toHaveLength(2);
      expect(labeled[0]!.keywords).toContain('authentication');
      expect(labeled[1]!.keywords).toContain('payment');
    });

    it('should generate descriptive labels', () => {
      const clusters = [{ id: 0, indices: [0, 1, 2], size: 3 }];

      const prompts = [
        'Fix login error',
        'Debug authentication issue',
        'Resolve signin problem',
      ];

      const labeled = labelClusters(clusters, prompts);

      expect(labeled[0]!.label).toBeTruthy();
      expect(labeled[0]!.label.length).toBeGreaterThan(0);
    });

    it('should select representative prompt', () => {
      const clusters = [{ id: 0, indices: [0, 1, 2], size: 3 }];

      const prompts = [
        'Short',
        'This is a medium length prompt with more context',
        'Fix bug',
      ];

      const labeled = labelClusters(clusters, prompts);

      // Should pick the shortest one as most representative
      expect(labeled[0]!.representativePrompt).toBe('Short');
    });

    it('should handle single-prompt clusters', () => {
      const clusters = [{ id: 0, indices: [0], size: 1 }];

      const prompts = ['Fix the authentication bug'];

      const labeled = labelClusters(clusters, prompts);

      expect(labeled).toHaveLength(1);
      expect(labeled[0]!.representativePrompt).toBe(prompts[0]);
      expect(labeled[0]!.size).toBe(1);
    });

    it('should calculate cluster sizes', () => {
      const clusters = [
        { id: 0, indices: [0, 1, 2], size: 3 },
        { id: 1, indices: [3, 4], size: 2 },
      ];

      const prompts = ['a', 'b', 'c', 'd', 'e'];

      const labeled = labelClusters(clusters, prompts);

      expect(labeled[0]!.size).toBe(3);
      expect(labeled[1]!.size).toBe(2);
    });
  });

  describe('createClusterAnalysis', () => {
    it('should create complete cluster analysis', () => {
      const cluster1Center = Array(10).fill(0.2);
      const cluster2Center = Array(10).fill(0.8);

      const embeddings = createClusterEmbeddings(
        [cluster1Center, cluster2Center],
        3,
      );

      const prompts = [
        'Fix authentication bug',
        'Debug login error',
        'Resolve signin issue',
        'Refactor payment code',
        'Optimize checkout flow',
        'Improve billing system',
      ];

      const clusterResult = clusterPrompts(embeddings, { k: 2 });
      const analysis = createClusterAnalysis(clusterResult, prompts);

      expect(analysis.clusters).toHaveLength(2);
      expect(analysis.metrics.optimalK).toBe(2);
      expect(analysis.metrics.silhouetteScore).toBeDefined();
      expect(analysis.summary.totalPrompts).toBe(6);
      expect(analysis.summary.avgClusterSize).toBe(3);
    });

    it('should include all required metadata', () => {
      const embeddings = createClusterEmbeddings([Array(5).fill(0.5)], 5);
      const prompts = Array(5).fill('Test prompt');

      const clusterResult = clusterPrompts(embeddings, { k: 1 });
      const analysis = createClusterAnalysis(clusterResult, prompts);

      expect(analysis.clusters[0]).toHaveProperty('id');
      expect(analysis.clusters[0]).toHaveProperty('label');
      expect(analysis.clusters[0]).toHaveProperty('keywords');
      expect(analysis.clusters[0]).toHaveProperty('representativePrompt');
      expect(analysis.clusters[0]).toHaveProperty('size');
    });

    it('should calculate summary statistics', () => {
      const embeddings = createClusterEmbeddings(
        [Array(5).fill(0.2), Array(5).fill(0.8)],
        4,
      );
      const prompts = Array(8).fill('Test');

      const clusterResult = clusterPrompts(embeddings, { k: 2 });
      const analysis = createClusterAnalysis(clusterResult, prompts);

      expect(analysis.clusters).toHaveLength(2);
      expect(analysis.summary.totalPrompts).toBe(8);
      expect(analysis.summary.avgClusterSize).toBeGreaterThan(0);
      expect(analysis.summary.largestCluster).toBeGreaterThan(0);
      expect(analysis.summary.smallestCluster).toBeGreaterThan(0);
    });
  });
});
