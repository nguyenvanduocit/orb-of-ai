/**
 * Passive Tree Graph Analysis
 *
 * Builds an allocated subgraph from character hashes, classifies nodes
 * as leaf/bridge/interior, and shows notable-to-notable connectivity.
 */

import type { PassiveTree } from './poe-utils';
import { ASCENDANCY_TO_CLASS } from './poe-utils';

export type NodeClassification = 'leaf' | 'bridge' | 'interior';

export interface ClassifiedNode {
  id: string;
  name: string;
  classification: NodeClassification;
  degree: number;
  isNotable: boolean;
  isKeystone: boolean;
  isJewelSocket: boolean;
  ascendancyName?: string;
}

export interface NotableEdge {
  from: string;
  fromName: string;
  to: string;
  toName: string;
  pathLength: number; // small nodes between them (edge weight)
}

export interface PathingRegion {
  className: string;
  nodeCount: number;
  notables: string[];
}

export interface GraphAnalysis {
  className: string;
  ascendancyName: string;
  totalNodes: number;
  ascendancyNodes: number;
  leafNotables: Array<ClassifiedNode & { respecSavings: number }>;
  bridgeNotables: ClassifiedNode[];
  interiorNotables: ClassifiedNode[];
  notableSkeleton: NotableEdge[];
  pathingRegions: PathingRegion[];
}

/**
 * Build adjacency list restricted to allocated nodes only.
 * Uses both out[] and in[] to build undirected edges.
 */
export function buildAllocatedSubgraph(
  tree: PassiveTree,
  hashes: number[],
): Map<string, Set<string>> {
  const allocated = new Set(hashes.map(h => h.toString()));
  const adj = new Map<string, Set<string>>();

  for (const id of allocated) {
    adj.set(id, new Set());
  }

  for (const id of allocated) {
    const node = tree.nodes[id];
    if (!node) continue;

    const neighbors = [...(node.out || []), ...(node.in || [])];
    for (const neighborId of neighbors) {
      if (allocated.has(neighborId)) {
        adj.get(id)!.add(neighborId);
        // Ensure bidirectional
        if (adj.has(neighborId)) {
          adj.get(neighborId)!.add(id);
        }
      }
    }
  }

  return adj;
}

/**
 * Find articulation points using Tarjan's algorithm.
 * These are nodes whose removal disconnects the graph.
 */
export function findArticulationPoints(
  adj: Map<string, Set<string>>,
  startNode: string,
): Set<string> {
  const articulationPoints = new Set<string>();
  const visited = new Set<string>();
  const disc = new Map<string, number>();
  const low = new Map<string, number>();
  const parent = new Map<string, string | null>();
  let timer = 0;

  function dfs(u: string): void {
    visited.add(u);
    disc.set(u, timer);
    low.set(u, timer);
    timer++;
    let children = 0;

    for (const v of adj.get(u) || []) {
      if (!visited.has(v)) {
        children++;
        parent.set(v, u);
        dfs(v);

        // Update low value
        low.set(u, Math.min(low.get(u)!, low.get(v)!));

        // u is an articulation point if:
        // 1) u is root of DFS tree and has 2+ children
        if (parent.get(u) === null && children > 1) {
          articulationPoints.add(u);
        }
        // 2) u is not root and low[v] >= disc[u]
        if (parent.get(u) !== null && low.get(v)! >= disc.get(u)!) {
          articulationPoints.add(u);
        }
      } else if (v !== parent.get(u)) {
        low.set(u, Math.min(low.get(u)!, disc.get(v)!));
      }
    }
  }

  parent.set(startNode, null);
  dfs(startNode);

  return articulationPoints;
}

/**
 * Classify each allocated node as leaf (degree 1), bridge (articulation point), or interior.
 */
export function classifyNodes(
  tree: PassiveTree,
  subgraph: Map<string, Set<string>>,
  startId: string,
): Map<string, ClassifiedNode> {
  const articulationPts = findArticulationPoints(subgraph, startId);
  const classified = new Map<string, ClassifiedNode>();

  for (const [id, neighbors] of subgraph) {
    const node = tree.nodes[id];
    if (!node) continue;

    const degree = neighbors.size;
    let classification: NodeClassification;

    if (degree <= 1) {
      classification = 'leaf';
    } else if (articulationPts.has(id)) {
      classification = 'bridge';
    } else {
      classification = 'interior';
    }

    classified.set(id, {
      id,
      name: node.name || id,
      classification,
      degree,
      isNotable: !!node.isNotable,
      isKeystone: !!node.isKeystone,
      isJewelSocket: !!node.isJewelSocket,
      ascendancyName: node.ascendancyName,
    });
  }

  return classified;
}

/**
 * Calculate how many points are saved by removing a leaf notable
 * (count chain of nodes back to nearest branch point).
 */
function calcRespecSavings(
  nodeId: string,
  subgraph: Map<string, Set<string>>,
): number {
  let count = 0;
  let current = nodeId;
  const visited = new Set<string>();

  while (true) {
    visited.add(current);
    count++;
    const neighbors = subgraph.get(current);
    if (!neighbors) break;

    // Find the single unvisited neighbor (following the chain back)
    const unvisited = [...neighbors].filter(n => !visited.has(n));
    if (unvisited.length !== 1) break; // branch point or dead end

    const next = unvisited[0];
    const nextNeighbors = subgraph.get(next);
    if (!nextNeighbors || nextNeighbors.size > 2) break; // next is a branch point
    current = next;
  }

  return count;
}

/**
 * Build compressed notable-to-notable skeleton graph.
 * Edge weights = number of small nodes between notables.
 */
export function buildNotableSkeleton(
  tree: PassiveTree,
  hashes: number[],
  subgraph: Map<string, Set<string>>,
): NotableEdge[] {
  const allocated = new Set(hashes.map(h => h.toString()));
  const edges: NotableEdge[] = [];
  const seen = new Set<string>(); // "from-to" dedup

  // Find all "important" nodes (notables, keystones, jewel sockets, class starts)
  const importantNodes = new Set<string>();
  for (const id of allocated) {
    const node = tree.nodes[id];
    if (!node) continue;
    if (node.isNotable || node.isKeystone || node.isJewelSocket || node.classStartIndex !== undefined) {
      importantNodes.add(id);
    }
  }

  // BFS from each important node to find nearest important neighbors
  for (const startId of importantNodes) {
    const startNode = tree.nodes[startId];
    if (!startNode) continue;

    const visited = new Set<string>([startId]);
    const queue: Array<{ id: string; dist: number }> = [];

    for (const neighbor of subgraph.get(startId) || []) {
      queue.push({ id: neighbor, dist: 1 });
    }

    while (queue.length > 0) {
      const { id, dist } = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);

      if (importantNodes.has(id)) {
        const key = [startId, id].sort().join('-');
        if (!seen.has(key)) {
          seen.add(key);
          edges.push({
            from: startId,
            fromName: startNode.name || startId,
            to: id,
            toName: tree.nodes[id]?.name || id,
            pathLength: dist - 1, // small nodes between them
          });
        }
        continue; // Don't traverse through important nodes
      }

      for (const neighbor of subgraph.get(id) || []) {
        if (!visited.has(neighbor)) {
          queue.push({ id: neighbor, dist: dist + 1 });
        }
      }
    }
  }

  return edges.sort((a, b) => a.fromName.localeCompare(b.fromName));
}

/**
 * Detect which class regions the tree travels through.
 * Uses spatial proximity to class start nodes.
 */
export function detectPathingRegions(
  tree: PassiveTree,
  hashes: number[],
): PathingRegion[] {
  // Find class start nodes (use node.name which is the class name in caps)
  const classStarts = new Map<string, { id: string; x: number; y: number }>();
  for (const [id, node] of Object.entries(tree.nodes)) {
    if (node.classStartIndex !== undefined && node.classStartIndex >= 0) {
      const group = tree.groups?.[node.group?.toString() || ''];
      if (!group) continue;
      // node.name is e.g. "WITCH", "MARAUDER", "Seven", "SIX"
      // Only use real class names (index 1-6), skip Scion center (0) and alt (6+)
      const classNames: Record<number, string> = {
        1: 'Marauder', 2: 'Ranger', 3: 'Witch', 4: 'Duelist', 5: 'Templar', 6: 'Shadow',
      };
      const className = classNames[node.classStartIndex];
      if (className) {
        classStarts.set(className, { id, x: group.x, y: group.y });
      }
    }
  }

  if (classStarts.size === 0) return [];

  // Assign each allocated node to nearest class region
  const regionNodes = new Map<string, { count: number; notables: string[] }>();

  for (const hash of hashes) {
    const id = hash.toString();
    const node = tree.nodes[id];
    if (!node || node.ascendancyName) continue; // Skip ascendancy nodes

    const nodeGroup = tree.groups?.[node.group?.toString() || ''];
    if (!nodeGroup) continue;

    let nearestClass = '';
    let nearestDist = Infinity;

    for (const [className, start] of classStarts) {
      const dx = nodeGroup.x - start.x;
      const dy = nodeGroup.y - start.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestClass = className;
      }
    }

    if (!regionNodes.has(nearestClass)) {
      regionNodes.set(nearestClass, { count: 0, notables: [] });
    }
    const region = regionNodes.get(nearestClass)!;
    region.count++;
    if (node.isNotable) {
      region.notables.push(node.name);
    }
  }

  return [...regionNodes.entries()]
    .map(([className, data]) => ({
      className,
      nodeCount: data.count,
      notables: data.notables.sort(),
    }))
    .sort((a, b) => b.nodeCount - a.nodeCount);
}

/**
 * Find the class start node ID from allocated hashes.
 */
function findClassStartNode(tree: PassiveTree, hashes: number[]): string | null {
  const allocated = new Set(hashes.map(h => h.toString()));
  for (const id of allocated) {
    const node = tree.nodes[id];
    if (node && node.classStartIndex !== undefined && node.classStartIndex >= 0) {
      return id;
    }
  }
  // Fallback: find the allocated node with highest degree
  return null;
}

/**
 * Main entry point: produce full graph analysis.
 */
export function analyzeGraph(
  tree: PassiveTree,
  hashes: number[],
  charClass: string,
): GraphAnalysis {
  const baseClass = ASCENDANCY_TO_CLASS[charClass] || charClass;
  const ascendancyName = ASCENDANCY_TO_CLASS[charClass] ? charClass : '';

  // Build subgraph
  const subgraph = buildAllocatedSubgraph(tree, hashes);

  // Find start node
  let startId = findClassStartNode(tree, hashes);
  if (!startId) {
    // Fallback: pick node with highest degree
    let maxDeg = 0;
    for (const [id, neighbors] of subgraph) {
      if (neighbors.size > maxDeg) {
        maxDeg = neighbors.size;
        startId = id;
      }
    }
  }
  if (!startId) {
    throw new Error('No allocated nodes found');
  }

  // Classify nodes
  const classified = classifyNodes(tree, subgraph, startId);

  // Separate ascendancy nodes
  const ascNodes = [...classified.values()].filter(n => n.ascendancyName);
  const mainNodes = [...classified.values()].filter(n => !n.ascendancyName);

  // Leaf notables with respec savings
  const leafNotables = mainNodes
    .filter(n => n.classification === 'leaf' && (n.isNotable || n.isKeystone || n.isJewelSocket))
    .map(n => ({
      ...n,
      respecSavings: calcRespecSavings(n.id, subgraph),
    }))
    .sort((a, b) => b.respecSavings - a.respecSavings);

  // Bridge notables
  const bridgeNotables = mainNodes
    .filter(n => n.classification === 'bridge' && (n.isNotable || n.isKeystone))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Interior notables
  const interiorNotables = mainNodes
    .filter(n => n.classification === 'interior' && (n.isNotable || n.isKeystone))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Notable skeleton
  const skeleton = buildNotableSkeleton(tree, hashes, subgraph);

  // Pathing regions
  const regions = detectPathingRegions(tree, hashes);

  return {
    className: baseClass,
    ascendancyName,
    totalNodes: hashes.length,
    ascendancyNodes: ascNodes.length,
    leafNotables,
    bridgeNotables,
    interiorNotables,
    notableSkeleton: skeleton,
    pathingRegions: regions,
  };
}

/**
 * Format graph analysis as human-readable output.
 */
export function formatGraphAnalysis(analysis: GraphAnalysis): string {
  const lines: string[] = [];

  lines.push(`=== PASSIVE TREE GRAPH ===\n`);
  lines.push(`Class: ${analysis.className} | Total: ${analysis.totalNodes} nodes | Ascendancy: ${analysis.ascendancyName || 'None'} (${analysis.ascendancyNodes} nodes)\n`);

  // Leaf notables
  lines.push(`== LEAF NOTABLES (respec candidates) ==`);
  if (analysis.leafNotables.length === 0) {
    lines.push(`  (none — all notables are on paths to other notables)`);
  } else {
    for (const n of analysis.leafNotables) {
      const type = n.isKeystone ? '[KEYSTONE]' : n.isJewelSocket ? '[JEWEL]' : '';
      lines.push(`  ${n.name} (leaf, save ${n.respecSavings} points) ${type}`.trimEnd());
    }
  }
  lines.push('');

  // Bridge notables
  lines.push(`== BRIDGE NOTABLES (critical path — cannot remove) ==`);
  if (analysis.bridgeNotables.length === 0) {
    lines.push(`  (none)`);
  } else {
    for (const n of analysis.bridgeNotables) {
      const type = n.isKeystone ? '[KEYSTONE]' : '';
      lines.push(`  ${n.name} (bridge, degree ${n.degree}) ${type}`.trimEnd());
    }
  }
  lines.push('');

  // Interior notables
  if (analysis.interiorNotables.length > 0) {
    lines.push(`== INTERIOR NOTABLES (redundant paths exist) ==`);
    for (const n of analysis.interiorNotables) {
      lines.push(`  ${n.name} (interior, degree ${n.degree})`);
    }
    lines.push('');
  }

  // Notable connectivity
  lines.push(`== NOTABLE CONNECTIVITY ==`);
  for (const edge of analysis.notableSkeleton) {
    lines.push(`  ${edge.fromName} --(${edge.pathLength})--> ${edge.toName}`);
  }
  lines.push('');

  // Pathing regions
  lines.push(`== PATHING REGIONS ==`);
  for (const region of analysis.pathingRegions) {
    const home = region.className === analysis.className ? ' (home)' : '';
    lines.push(`  ${region.className}${home}: ${region.nodeCount} nodes`);
    if (region.notables.length > 0) {
      lines.push(`    Notables: ${region.notables.join(', ')}`);
    }
  }

  return lines.join('\n');
}
