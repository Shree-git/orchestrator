import { Feature } from '@/store/app-store';

/**
 * Checks if adding a dependency would create a circular dependency
 * @param currentFeatureId The ID of the feature to add dependencies to
 * @param newDependencyId The ID of the dependency being added
 * @param allFeatures All features in the system
 * @param existingDependencies Current dependencies of the feature (excluding the new one)
 * @returns true if adding the dependency would create a circular dependency
 */
export function wouldCreateCircularDependency(
  currentFeatureId: string,
  newDependencyId: string,
  allFeatures: Feature[],
  existingDependencies: string[] = []
): boolean {
  // Can't depend on itself
  if (currentFeatureId === newDependencyId) {
    return true;
  }

  // Create a map for quick feature lookup
  const featureMap = new Map<string, Feature>();
  allFeatures.forEach((feature) => {
    featureMap.set(feature.id, feature);
  });

  // Check if the new dependency has a path back to the current feature
  return hasPathBetweenFeatures(
    newDependencyId,
    currentFeatureId,
    featureMap,
    existingDependencies
  );
}

/**
 * Checks if there's a dependency path from startFeatureId to targetFeatureId
 */
function hasPathBetweenFeatures(
  startFeatureId: string,
  targetFeatureId: string,
  featureMap: Map<string, Feature>,
  additionalDependencies: string[] = [],
  visited: Set<string> = new Set()
): boolean {
  // Avoid infinite loops
  if (visited.has(startFeatureId)) {
    return false;
  }
  visited.add(startFeatureId);

  const feature = featureMap.get(startFeatureId);
  if (!feature) {
    return false;
  }

  // Get all dependencies for this feature
  const dependencies = [...(feature.dependencies || []), ...additionalDependencies];

  // Check if any dependency is our target
  if (dependencies.includes(targetFeatureId)) {
    return true;
  }

  // Recursively check dependencies
  for (const depId of dependencies) {
    if (hasPathBetweenFeatures(depId, targetFeatureId, featureMap, [], new Set(visited))) {
      return true;
    }
  }

  return false;
}

/**
 * Validates a set of dependencies for circular references
 * @param currentFeatureId The ID of the feature
 * @param dependencies Array of dependency IDs
 * @param allFeatures All features in the system
 * @returns Array of validation errors
 */
export function validateDependencies(
  currentFeatureId: string,
  dependencies: string[],
  allFeatures: Feature[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for self-dependency
  if (dependencies.includes(currentFeatureId)) {
    errors.push('A feature cannot depend on itself');
  }

  // Check for duplicates
  const uniqueDependencies = new Set(dependencies);
  if (uniqueDependencies.size !== dependencies.length) {
    errors.push('Duplicate dependencies are not allowed');
  }

  // Check for circular dependencies
  for (const depId of dependencies) {
    if (depId === currentFeatureId) continue; // Already handled above

    if (
      wouldCreateCircularDependency(
        currentFeatureId,
        depId,
        allFeatures,
        dependencies.filter((id) => id !== depId)
      )
    ) {
      const depFeature = allFeatures.find((f) => f.id === depId);
      const depTitle = depFeature?.title || `Feature ${depId.slice(0, 8)}...`;
      errors.push(`Adding dependency "${depTitle}" would create a circular dependency`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Gets all dependencies (direct and indirect) for a feature
 * @param featureId The ID of the feature
 * @param allFeatures All features in the system
 * @returns Array of all dependency IDs (including nested dependencies)
 */
export function getAllDependencies(featureId: string, allFeatures: Feature[]): string[] {
  const featureMap = new Map<string, Feature>();
  allFeatures.forEach((feature) => {
    featureMap.set(feature.id, feature);
  });

  const allDeps = new Set<string>();
  const visited = new Set<string>();

  function collectDependencies(currentId: string) {
    if (visited.has(currentId)) return;
    visited.add(currentId);

    const feature = featureMap.get(currentId);
    if (!feature?.dependencies) return;

    for (const depId of feature.dependencies) {
      if (!allDeps.has(depId)) {
        allDeps.add(depId);
        collectDependencies(depId);
      }
    }
  }

  collectDependencies(featureId);
  return Array.from(allDeps);
}

/**
 * Gets all features that depend on a specific feature (direct and indirect)
 * @param featureId The ID of the feature
 * @param allFeatures All features in the system
 * @returns Array of feature IDs that depend on this feature
 */
export function getAllDependents(featureId: string, allFeatures: Feature[]): string[] {
  const dependents = new Set<string>();
  const visited = new Set<string>();

  function collectDependents(targetId: string) {
    if (visited.has(targetId)) return;
    visited.add(targetId);

    // Find all features that directly depend on the target
    for (const feature of allFeatures) {
      if (feature.dependencies?.includes(targetId) && !dependents.has(feature.id)) {
        dependents.add(feature.id);
        collectDependents(feature.id); // Recursively find dependents of dependents
      }
    }
  }

  collectDependents(featureId);
  return Array.from(dependents);
}
