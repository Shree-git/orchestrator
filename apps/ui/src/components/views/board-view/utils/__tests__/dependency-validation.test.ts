import { describe, test, expect } from 'vitest';
import {
  wouldCreateCircularDependency,
  validateDependencies,
  getAllDependencies,
  getAllDependents,
} from '../dependency-validation';
import { Feature } from '@/store/app-store';

// Test data
const createFeature = (id: string, dependencies: string[] = [], description = ''): Feature => ({
  id,
  description: description || `Feature ${id}`,
  status: 'backlog' as const,
  category: 'test',
  steps: [],
  skipTests: false,
  model: 'opus',
  thinkingLevel: 'none',
  imagePaths: [],
  branchName: '',
  priority: 2,
  planningMode: 'skip',
  requirePlanApproval: false,
  dependencies,
  createdAt: new Date().toISOString(),
});

describe('wouldCreateCircularDependency', () => {
  test('should detect self-dependency', () => {
    const features = [createFeature('A')];
    expect(wouldCreateCircularDependency('A', 'A', features)).toBe(true);
  });

  test('should detect direct circular dependency', () => {
    const features = [createFeature('A', ['B']), createFeature('B')];
    expect(wouldCreateCircularDependency('B', 'A', features)).toBe(true);
  });

  test('should detect indirect circular dependency', () => {
    const features = [createFeature('A', ['B']), createFeature('B', ['C']), createFeature('C')];
    expect(wouldCreateCircularDependency('C', 'A', features)).toBe(true);
  });

  test('should allow valid dependency', () => {
    const features = [createFeature('A'), createFeature('B')];
    expect(wouldCreateCircularDependency('B', 'A', features)).toBe(false);
  });

  test('should handle complex dependency chains without cycles', () => {
    const features = [
      createFeature('A', ['B', 'C']),
      createFeature('B', ['D']),
      createFeature('C', ['E']),
      createFeature('D'),
      createFeature('E'),
      createFeature('F'),
    ];
    expect(wouldCreateCircularDependency('F', 'A', features)).toBe(false);
    expect(wouldCreateCircularDependency('F', 'B', features)).toBe(false);
    expect(wouldCreateCircularDependency('F', 'E', features)).toBe(false);
  });

  test('should detect longer circular chains', () => {
    const features = [
      createFeature('A', ['B']),
      createFeature('B', ['C']),
      createFeature('C', ['D']),
      createFeature('D'),
    ];
    expect(wouldCreateCircularDependency('D', 'A', features)).toBe(true);
  });
});

describe('validateDependencies', () => {
  test('should reject self-dependency', () => {
    const features = [createFeature('A')];
    const result = validateDependencies('A', ['A'], features);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('A feature cannot depend on itself');
  });

  test('should reject duplicate dependencies', () => {
    const features = [createFeature('A'), createFeature('B')];
    const result = validateDependencies('A', ['B', 'B'], features);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Duplicate dependencies are not allowed');
  });

  test('should reject circular dependencies with descriptive error', () => {
    const features = [
      createFeature('A', ['B'], 'Login Feature'),
      createFeature('B', [], 'Auth Service'),
    ];
    const result = validateDependencies('B', ['A'], features);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain(
      'Adding dependency "Login Feature" would create a circular dependency'
    );
  });

  test('should accept valid dependencies', () => {
    const features = [
      createFeature('A', [], 'Login Feature'),
      createFeature('B', [], 'Auth Service'),
      createFeature('C', [], 'Database Setup'),
    ];
    const result = validateDependencies('A', ['B', 'C'], features);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should handle multiple validation errors', () => {
    const features = [
      createFeature('A', ['B'], 'Login Feature'),
      createFeature('B', [], 'Auth Service'),
    ];
    const result = validateDependencies('A', ['A', 'B', 'B'], features);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('A feature cannot depend on itself');
    expect(result.errors).toContain('Duplicate dependencies are not allowed');
  });
});

describe('getAllDependencies', () => {
  test('should return direct dependencies', () => {
    const features = [createFeature('A', ['B', 'C']), createFeature('B'), createFeature('C')];
    const deps = getAllDependencies('A', features);
    expect(deps).toEqual(expect.arrayContaining(['B', 'C']));
    expect(deps).toHaveLength(2);
  });

  test('should return indirect dependencies', () => {
    const features = [
      createFeature('A', ['B']),
      createFeature('B', ['C', 'D']),
      createFeature('C', ['E']),
      createFeature('D'),
      createFeature('E'),
    ];
    const deps = getAllDependencies('A', features);
    expect(deps).toEqual(expect.arrayContaining(['B', 'C', 'D', 'E']));
    expect(deps).toHaveLength(4);
  });

  test('should handle features with no dependencies', () => {
    const features = [createFeature('A')];
    const deps = getAllDependencies('A', features);
    expect(deps).toEqual([]);
  });

  test('should avoid infinite loops in circular dependencies', () => {
    const features = [
      createFeature('A', ['B']),
      createFeature('B', ['A']), // Circular dependency
    ];
    const deps = getAllDependencies('A', features);
    // Should terminate and return the dependency it found
    expect(deps).toContain('B');
    expect(deps.length).toBeGreaterThan(0);
  });
});

describe('getAllDependents', () => {
  test('should return direct dependents', () => {
    const features = [createFeature('A', ['C']), createFeature('B', ['C']), createFeature('C')];
    const dependents = getAllDependents('C', features);
    expect(dependents).toEqual(expect.arrayContaining(['A', 'B']));
    expect(dependents).toHaveLength(2);
  });

  test('should return indirect dependents', () => {
    const features = [
      createFeature('A', ['B']),
      createFeature('B', ['C']),
      createFeature('C', ['D']),
      createFeature('D'),
    ];
    const dependents = getAllDependents('D', features);
    expect(dependents).toEqual(expect.arrayContaining(['C', 'B', 'A']));
    expect(dependents).toHaveLength(3);
  });

  test('should handle features with no dependents', () => {
    const features = [createFeature('A', ['B']), createFeature('B')];
    const dependents = getAllDependents('A', features);
    expect(dependents).toEqual([]);
  });

  test('should avoid infinite loops in circular dependencies', () => {
    const features = [
      createFeature('A', ['B']),
      createFeature('B', ['A']), // Circular dependency
    ];
    const dependents = getAllDependents('A', features);
    expect(dependents).toContain('B');
    expect(dependents.length).toBeGreaterThan(0);
  });

  test('should handle complex dependency networks', () => {
    const features = [
      createFeature('UI', ['API']),
      createFeature('Tests', ['API']),
      createFeature('API', ['Auth', 'DB']),
      createFeature('Auth', ['DB']),
      createFeature('DB'),
      createFeature('Docs', ['API']),
    ];

    // DB has many dependents (direct and indirect)
    const dbDependents = getAllDependents('DB', features);
    expect(dbDependents).toEqual(expect.arrayContaining(['Auth', 'API', 'UI', 'Tests', 'Docs']));

    // API has fewer dependents
    const apiDependents = getAllDependents('API', features);
    expect(apiDependents).toEqual(expect.arrayContaining(['UI', 'Tests', 'Docs']));
    expect(apiDependents).not.toContain('Auth'); // Auth depends on API, not the other way
  });
});
