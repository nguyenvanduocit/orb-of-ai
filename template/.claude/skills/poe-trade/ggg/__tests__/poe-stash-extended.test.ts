import { describe, test, expect, mock, beforeEach } from 'bun:test';
import {
  parseAttributesFromMods,
  calcAttributes,
  getAllMods,
  estimateKitavaPenalty,
  calcResistTotals,
  parseResistFromMods,
  ASCENDANCY_TO_CLASS,
  type PassiveTree,
  type BanditChoice,
} from '../poe-utils';
import type { Item } from '../stash';
import { StashClient } from '../stash';
import {
  buildAllocatedSubgraph,
  findArticulationPoints,
  classifyNodes,
  buildNotableSkeleton,
  analyzeGraph,
  formatGraphAnalysis,
} from '../poe-graph';

// StashClient reads go through poeFetch (a page-context fetch in the logged-in
// www.pathofexile.com tab). Mock the transport so unit tests never spawn
// playwriter; capture call args (game, method, path, body) to assert shape.
const poeFetchCalls: any[][] = [];
let poeFetchImpl: (...a: any[]) => Promise<any> = async () => ({ status: 200, ratelimit: {}, data: {} });
mock.module('../transport', () => ({
  poeFetch: (...args: any[]) => { poeFetchCalls.push(args); return poeFetchImpl(...args); },
}));

// ---------------------------------------------------------------------------
// parseAttributesFromMods
// ---------------------------------------------------------------------------

describe('parseAttributesFromMods', () => {
  test('+30 to Strength → str:30', () => {
    const result = parseAttributesFromMods(['+30 to Strength']);
    expect(result).toEqual({ str: 30, dex: 0, int: 0 });
  });

  test('+25 to Dexterity → dex:25', () => {
    const result = parseAttributesFromMods(['+25 to Dexterity']);
    expect(result).toEqual({ str: 0, dex: 25, int: 0 });
  });

  test('+22 to Intelligence → int:22', () => {
    const result = parseAttributesFromMods(['+22 to Intelligence']);
    expect(result).toEqual({ str: 0, dex: 0, int: 22 });
  });

  test('+10 to all Attributes → all three get +10', () => {
    const result = parseAttributesFromMods(['+10 to all Attributes']);
    expect(result).toEqual({ str: 10, dex: 10, int: 10 });
  });

  test('+15 to Strength and Intelligence → str:15, int:15', () => {
    const result = parseAttributesFromMods(['+15 to Strength and Intelligence']);
    expect(result).toEqual({ str: 15, dex: 0, int: 15 });
  });

  test('+20 to Dexterity and Intelligence → dex:20, int:20', () => {
    const result = parseAttributesFromMods(['+20 to Dexterity and Intelligence']);
    expect(result).toEqual({ str: 0, dex: 20, int: 20 });
  });

  test('+12 to Strength and Dexterity → str:12, dex:12', () => {
    const result = parseAttributesFromMods(['+12 to Strength and Dexterity']);
    expect(result).toEqual({ str: 12, dex: 12, int: 0 });
  });

  test('multiple mods stack correctly', () => {
    const result = parseAttributesFromMods([
      '+20 to Strength',
      '+10 to all Attributes',
      '+5 to Strength and Intelligence',
    ]);
    expect(result).toEqual({ str: 35, dex: 10, int: 15 });
  });

  test('non-attribute mods are ignored', () => {
    const result = parseAttributesFromMods([
      '+50 to maximum Life',
      '+20% to Fire Resistance',
      'Adds 5 to 10 Physical Damage',
    ]);
    expect(result).toEqual({ str: 0, dex: 0, int: 0 });
  });

  test('empty mods → all zeros', () => {
    const result = parseAttributesFromMods([]);
    expect(result).toEqual({ str: 0, dex: 0, int: 0 });
  });
});

// ---------------------------------------------------------------------------
// getAllMods
// ---------------------------------------------------------------------------

describe('getAllMods', () => {
  test('concatenates implicit, explicit, crafted, enchant mods', () => {
    const item: Item = {
      id: 'test', name: 'Test', typeLine: 'Test', baseType: 'Test', ilvl: 1, frameType: 0,
      implicitMods: ['implicit1'],
      explicitMods: ['explicit1', 'explicit2'],
      craftedMods: ['crafted1'],
      enchantMods: ['enchant1'],
    };
    const result = getAllMods(item);
    expect(result).toEqual(['implicit1', 'explicit1', 'explicit2', 'crafted1', 'enchant1']);
  });

  test('handles missing mod arrays gracefully', () => {
    const item: Item = {
      id: 'test', name: 'Test', typeLine: 'Test', baseType: 'Test', ilvl: 1, frameType: 0,
      explicitMods: ['explicit1'],
    };
    const result = getAllMods(item);
    expect(result).toEqual(['explicit1']);
  });

  test('returns empty array when no mods', () => {
    const item: Item = {
      id: 'test', name: 'Test', typeLine: 'Test', baseType: 'Test', ilvl: 1, frameType: 0,
    };
    const result = getAllMods(item);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// estimateKitavaPenalty
// ---------------------------------------------------------------------------

describe('estimateKitavaPenalty', () => {
  test('level < 45 → 0 penalty', () => {
    expect(estimateKitavaPenalty(1)).toBe(0);
    expect(estimateKitavaPenalty(44)).toBe(0);
  });

  test('level 45-67 → -30 (Act 5 Kitava)', () => {
    expect(estimateKitavaPenalty(45)).toBe(-30);
    expect(estimateKitavaPenalty(60)).toBe(-30);
    expect(estimateKitavaPenalty(67)).toBe(-30);
  });

  test('level 68+ → -60 (Act 10 Kitava)', () => {
    expect(estimateKitavaPenalty(68)).toBe(-60);
    expect(estimateKitavaPenalty(90)).toBe(-60);
    expect(estimateKitavaPenalty(100)).toBe(-60);
  });
});

// ---------------------------------------------------------------------------
// parseResistFromMods - dual-element resists (not in original tests)
// ---------------------------------------------------------------------------

describe('parseResistFromMods - dual element', () => {
  test('+20% to Fire and Cold Resistances', () => {
    const result = parseResistFromMods(['+20% to Fire and Cold Resistances']);
    expect(result).toEqual({ fire: 20, cold: 20, lightning: 0, chaos: 0, all: 0 });
  });

  test('+15% to Fire and Lightning Resistances', () => {
    const result = parseResistFromMods(['+15% to Fire and Lightning Resistances']);
    expect(result).toEqual({ fire: 15, cold: 0, lightning: 15, chaos: 0, all: 0 });
  });

  test('+25% to Cold and Lightning Resistances', () => {
    const result = parseResistFromMods(['+25% to Cold and Lightning Resistances']);
    expect(result).toEqual({ fire: 0, cold: 25, lightning: 25, chaos: 0, all: 0 });
  });

  test('Elemental Resistances (without "all") also matches', () => {
    // Ascendancy nodes use "+N% to Elemental Resistances" without "all"
    const result = parseResistFromMods(['+10% to Elemental Resistances']);
    expect(result).toEqual({ fire: 0, cold: 0, lightning: 0, chaos: 0, all: 10 });
  });
});

// ---------------------------------------------------------------------------
// calcResistTotals - with tree, bandit, kitava
// ---------------------------------------------------------------------------

describe('calcResistTotals - full breakdown', () => {
  const makeItem = (mods: string[]): Item => ({
    id: 'test', name: 'Test', typeLine: 'Test', baseType: 'Test', ilvl: 1, frameType: 0,
    explicitMods: mods,
  });

  const treeWithResists: PassiveTree = {
    nodes: {
      '10': { skill: 10, name: 'Resist Node', stats: ['+15% to Fire Resistance'] },
      '20': { skill: 20, name: 'Elemental Node', stats: ['+10% to all Elemental Resistances'] },
      '30': { skill: 30, name: 'No Stats Node' },
    },
  };

  test('gear + tree resistances combined', () => {
    const items = [makeItem(['+30% to Cold Resistance'])];
    const totals = calcResistTotals(items, treeWithResists, [10, 20]);
    // gear: cold=30
    // tree node 10: fire=15
    // tree node 20: all ele = fire+10, cold+10, lightning+10
    expect(totals.gear).toEqual({ fire: 0, cold: 30, lightning: 0, chaos: 0 });
    expect(totals.tree).toEqual({ fire: 25, cold: 10, lightning: 10, chaos: 0 });
    expect(totals.fire).toBe(25);   // gear 0 + tree 25
    expect(totals.cold).toBe(40);   // gear 30 + tree 10
    expect(totals.lightning).toBe(10); // tree only
  });

  test('alira bandit adds +15% to fire/cold/lightning, not chaos', () => {
    const items = [makeItem(['+10% to Fire Resistance'])];
    const totals = calcResistTotals(items, undefined, undefined, { bandit: 'alira' as BanditChoice });
    expect(totals.bandit).toBe(15);
    expect(totals.fire).toBe(25);       // 10 gear + 15 bandit
    expect(totals.cold).toBe(15);       // 0 gear + 15 bandit
    expect(totals.lightning).toBe(15);   // 0 gear + 15 bandit
    expect(totals.chaos).toBe(0);        // bandit doesn't affect chaos
  });

  test('non-alira bandit gives 0 resist bonus', () => {
    const items = [makeItem(['+10% to Fire Resistance'])];
    const totals = calcResistTotals(items, undefined, undefined, { bandit: 'oak' as BanditChoice });
    expect(totals.bandit).toBe(0);
    expect(totals.fire).toBe(10);
  });

  test('kill_all bandit gives 0 resist bonus', () => {
    const totals = calcResistTotals([], undefined, undefined, { bandit: 'kill_all' as BanditChoice });
    expect(totals.bandit).toBe(0);
  });

  test('explicit kitavaPenalty overrides level-based estimate', () => {
    const totals = calcResistTotals([], undefined, undefined, {
      kitavaPenalty: -30,
      characterLevel: 90, // level 90 would normally give -60
    });
    expect(totals.kitava).toBe(-30);
    expect(totals.fire).toBe(-30);
    expect(totals.chaos).toBe(-30); // kitava affects chaos too
  });

  test('characterLevel auto-estimates kitava penalty', () => {
    const totals = calcResistTotals([], undefined, undefined, { characterLevel: 70 });
    expect(totals.kitava).toBe(-60); // level 70 → -60
  });

  test('full breakdown: gear + tree + alira + kitava', () => {
    const items = [makeItem(['+40% to Fire Resistance', '+30% to Cold Resistance'])];
    const totals = calcResistTotals(items, treeWithResists, [10, 20], {
      bandit: 'alira' as BanditChoice,
      kitavaPenalty: -60,
    });
    // gear: fire=40, cold=30
    // tree: fire=25 (15+10), cold=10, lightning=10
    // bandit: +15 to ele
    // kitava: -60 to all
    expect(totals.fire).toBe(40 + 25 + 15 - 60);    // 20
    expect(totals.cold).toBe(30 + 10 + 15 - 60);     // -5
    expect(totals.lightning).toBe(0 + 10 + 15 - 60);  // -35
    expect(totals.chaos).toBe(0 + 0 - 60);            // -60
  });

  test('no tree/hashes → tree totals are zero', () => {
    const items = [makeItem(['+20% to Lightning Resistance'])];
    const totals = calcResistTotals(items);
    expect(totals.tree).toEqual({ fire: 0, cold: 0, lightning: 0, chaos: 0 });
    expect(totals.lightning).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// calcAttributes
// ---------------------------------------------------------------------------

describe('calcAttributes', () => {
  const tree: PassiveTree = {
    nodes: {
      '10': { skill: 10, name: '+10 Str Node', stats: ['+10 to Strength'] },
      '20': { skill: 20, name: '+5 All Attrs', stats: ['+5 to all Attributes'] },
      '30': { skill: 30, name: 'No Attrs', stats: ['+20% to Fire Resistance'] },
      '40': { skill: 40, name: '+8 Str and Int', stats: ['+8 to Strength and Intelligence'] },
    },
    classes: [
      { name: 'Witch', base_str: 14, base_dex: 14, base_int: 32 },
      { name: 'Marauder', base_str: 32, base_dex: 14, base_int: 14 },
    ],
  };

  test('base class stats for Witch', () => {
    const result = calcAttributes('Witch', tree, [], []);
    expect(result.base).toEqual({ str: 14, dex: 14, int: 32 });
    expect(result.total).toEqual({ str: 14, dex: 14, int: 32 });
  });

  test('base class stats for Marauder', () => {
    const result = calcAttributes('Marauder', tree, [], []);
    expect(result.base).toEqual({ str: 32, dex: 14, int: 14 });
  });

  test('unknown class → zero base', () => {
    const result = calcAttributes('UnknownClass', tree, [], []);
    expect(result.base).toEqual({ str: 0, dex: 0, int: 0 });
  });

  test('tree nodes add attributes', () => {
    const result = calcAttributes('Witch', tree, [10, 20], []);
    // node 10: +10 str
    // node 20: +5 all → +5 str, +5 dex, +5 int
    expect(result.tree).toEqual({ str: 15, dex: 5, int: 5 });
    expect(result.total).toEqual({ str: 29, dex: 19, int: 37 });
  });

  test('tree nodes with no attributes are excluded from treeDetails', () => {
    const result = calcAttributes('Witch', tree, [30], []);
    expect(result.tree).toEqual({ str: 0, dex: 0, int: 0 });
    expect(result.treeDetails).toHaveLength(0);
  });

  test('gear adds attributes', () => {
    const items: Item[] = [{
      id: 'belt', name: 'Test Belt', typeLine: 'Belt', baseType: 'Belt',
      ilvl: 80, frameType: 2, inventoryId: 'Belt',
      explicitMods: ['+30 to Strength', '+20 to Intelligence'],
    }];
    const result = calcAttributes('Witch', tree, [], items);
    expect(result.gear).toEqual({ str: 30, dex: 0, int: 20 });
    expect(result.gearDetails).toHaveLength(1);
    expect(result.gearDetails[0].slot).toBe('Belt');
  });

  test('full breakdown: base + tree + gear', () => {
    const items: Item[] = [{
      id: 'ring', name: 'Test Ring', typeLine: 'Ring', baseType: 'Ring',
      ilvl: 75, frameType: 2, inventoryId: 'Ring',
      implicitMods: ['+10 to all Attributes'],
    }];
    const result = calcAttributes('Witch', tree, [10, 40], items);
    // base: Witch { str:14, dex:14, int:32 }
    // tree node 10: +10 str
    // tree node 40: +8 str, +8 int
    // gear ring: +10 all
    expect(result.base).toEqual({ str: 14, dex: 14, int: 32 });
    expect(result.tree).toEqual({ str: 18, dex: 0, int: 8 });
    expect(result.gear).toEqual({ str: 10, dex: 10, int: 10 });
    expect(result.total).toEqual({ str: 42, dex: 24, int: 50 });
  });

  test('treeDetails records per-node attribution', () => {
    const result = calcAttributes('Witch', tree, [10, 20, 40], []);
    expect(result.treeDetails).toHaveLength(3);
    const strNode = result.treeDetails.find(d => d.name === '+10 Str Node');
    expect(strNode).toBeDefined();
    expect(strNode!.str).toBe(10);
    expect(strNode!.dex).toBe(0);
  });

  test('gearDetails uses inventoryId as slot name', () => {
    const items: Item[] = [{
      id: 'helm', name: 'Test Helm', typeLine: 'Eternal Burgonet', baseType: 'Eternal Burgonet',
      ilvl: 84, frameType: 2, inventoryId: 'Helm',
      explicitMods: ['+20 to Dexterity'],
    }];
    const result = calcAttributes('Witch', tree, [], items);
    expect(result.gearDetails[0].slot).toBe('Helm');
    expect(result.gearDetails[0].dex).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// ASCENDANCY_TO_CLASS mapping
// ---------------------------------------------------------------------------

describe('ASCENDANCY_TO_CLASS', () => {
  test('all ascendancies map to correct base class', () => {
    expect(ASCENDANCY_TO_CLASS['Necromancer']).toBe('Witch');
    expect(ASCENDANCY_TO_CLASS['Elementalist']).toBe('Witch');
    expect(ASCENDANCY_TO_CLASS['Occultist']).toBe('Witch');
    expect(ASCENDANCY_TO_CLASS['Juggernaut']).toBe('Marauder');
    expect(ASCENDANCY_TO_CLASS['Berserker']).toBe('Marauder');
    expect(ASCENDANCY_TO_CLASS['Chieftain']).toBe('Marauder');
    expect(ASCENDANCY_TO_CLASS['Deadeye']).toBe('Ranger');
    expect(ASCENDANCY_TO_CLASS['Assassin']).toBe('Shadow');
    expect(ASCENDANCY_TO_CLASS['Inquisitor']).toBe('Templar');
    expect(ASCENDANCY_TO_CLASS['Slayer']).toBe('Duelist');
    expect(ASCENDANCY_TO_CLASS['Ascendant']).toBe('Scion');
  });

  test('base classes map to themselves', () => {
    expect(ASCENDANCY_TO_CLASS['Witch']).toBe('Witch');
    expect(ASCENDANCY_TO_CLASS['Marauder']).toBe('Marauder');
    expect(ASCENDANCY_TO_CLASS['Ranger']).toBe('Ranger');
    expect(ASCENDANCY_TO_CLASS['Shadow']).toBe('Shadow');
    expect(ASCENDANCY_TO_CLASS['Templar']).toBe('Templar');
    expect(ASCENDANCY_TO_CLASS['Duelist']).toBe('Duelist');
    expect(ASCENDANCY_TO_CLASS['Scion']).toBe('Scion');
  });
});

// ---------------------------------------------------------------------------
// StashClient - additional tests
// ---------------------------------------------------------------------------

describe('StashClient - accountName handling', () => {
  test('omits accountName from path when not set', async () => {
    const client = new StashClient({});
    poeFetchCalls.length = 0;
    poeFetchImpl = async () => ({ status: 200, ratelimit: {}, data: { numTabs: 0, tabs: [], items: [] } });

    await client.getStashTabs('Standard', 0);
    const path = poeFetchCalls[0][2] as string;
    expect(path).not.toContain('accountName');
    expect(path).toContain('realm=pc');
  });

  test('includes accountName in path when set', async () => {
    const client = new StashClient({ accountName: 'TestUser' });
    poeFetchCalls.length = 0;
    poeFetchImpl = async () => ({ status: 200, ratelimit: {}, data: { numTabs: 0, tabs: [], items: [] } });

    await client.getStashTabs('Standard', 0);
    expect(poeFetchCalls[0][2] as string).toContain('accountName=TestUser');
  });
});

describe('StashClient - getStashTabs', () => {
  test('sends correct league and tabIndex in path', async () => {
    const client = new StashClient({ accountName: 'Test' });
    poeFetchCalls.length = 0;
    poeFetchImpl = async () => ({ status: 200, ratelimit: {}, data: { numTabs: 1, tabs: [], items: [] } });

    await client.getStashTabs('Mirage', 3);
    const path = poeFetchCalls[0][2] as string;
    expect(path).toContain('league=Mirage');
    expect(path).toContain('tabIndex=3');
    expect(path).toContain('tabs=1');
  });
});

// ---------------------------------------------------------------------------
// Graph module - buildAllocatedSubgraph
// ---------------------------------------------------------------------------

describe('buildAllocatedSubgraph', () => {
  // Simple linear tree: 1 -- 2 -- 3
  const tree: PassiveTree = {
    nodes: {
      '1': { skill: 1, name: 'A', out: ['2'] },
      '2': { skill: 2, name: 'B', out: ['3'], in: ['1'] },
      '3': { skill: 3, name: 'C', in: ['2'] },
      '4': { skill: 4, name: 'D', in: ['2'] }, // not allocated
    },
  };

  test('builds adjacency for allocated nodes only', () => {
    const adj = buildAllocatedSubgraph(tree, [1, 2, 3]);
    expect(adj.size).toBe(3);
    expect(adj.get('1')!.has('2')).toBe(true);
    expect(adj.get('2')!.has('1')).toBe(true);
    expect(adj.get('2')!.has('3')).toBe(true);
    expect(adj.get('3')!.has('2')).toBe(true);
  });

  test('excludes non-allocated neighbors', () => {
    const adj = buildAllocatedSubgraph(tree, [1, 2]); // 3 not allocated
    expect(adj.size).toBe(2);
    expect(adj.get('2')!.has('3')).toBe(false);
  });

  test('handles single node', () => {
    const adj = buildAllocatedSubgraph(tree, [1]);
    expect(adj.size).toBe(1);
    expect(adj.get('1')!.size).toBe(0);
  });

  test('handles unknown hashes gracefully', () => {
    const adj = buildAllocatedSubgraph(tree, [999]);
    expect(adj.size).toBe(1);
    expect(adj.get('999')!.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Graph module - findArticulationPoints
// ---------------------------------------------------------------------------

describe('findArticulationPoints', () => {
  test('linear chain: middle node is articulation point', () => {
    // A -- B -- C
    const adj = new Map<string, Set<string>>([
      ['A', new Set(['B'])],
      ['B', new Set(['A', 'C'])],
      ['C', new Set(['B'])],
    ]);
    const points = findArticulationPoints(adj, 'A');
    expect(points.has('B')).toBe(true);
    expect(points.has('A')).toBe(false);
    expect(points.has('C')).toBe(false);
  });

  test('triangle: no articulation points', () => {
    // A -- B -- C -- A
    const adj = new Map<string, Set<string>>([
      ['A', new Set(['B', 'C'])],
      ['B', new Set(['A', 'C'])],
      ['C', new Set(['A', 'B'])],
    ]);
    const points = findArticulationPoints(adj, 'A');
    expect(points.size).toBe(0);
  });

  test('star topology: center is articulation point', () => {
    // B, C, D all connected to A only
    const adj = new Map<string, Set<string>>([
      ['A', new Set(['B', 'C', 'D'])],
      ['B', new Set(['A'])],
      ['C', new Set(['A'])],
      ['D', new Set(['A'])],
    ]);
    const points = findArticulationPoints(adj, 'A');
    expect(points.has('A')).toBe(true);
    expect(points.size).toBe(1);
  });

  test('two nodes: no articulation points (root with 1 child)', () => {
    const adj = new Map<string, Set<string>>([
      ['A', new Set(['B'])],
      ['B', new Set(['A'])],
    ]);
    const points = findArticulationPoints(adj, 'A');
    expect(points.size).toBe(0);
  });

  test('bridge in longer chain', () => {
    // A -- B -- C -- D -- E
    const adj = new Map<string, Set<string>>([
      ['A', new Set(['B'])],
      ['B', new Set(['A', 'C'])],
      ['C', new Set(['B', 'D'])],
      ['D', new Set(['C', 'E'])],
      ['E', new Set(['D'])],
    ]);
    const points = findArticulationPoints(adj, 'A');
    expect(points.has('B')).toBe(true);
    expect(points.has('C')).toBe(true);
    expect(points.has('D')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Graph module - classifyNodes
// ---------------------------------------------------------------------------

describe('classifyNodes', () => {
  const tree: PassiveTree = {
    nodes: {
      '1': { skill: 1, name: 'Start', classStartIndex: 3 },
      '2': { skill: 2, name: 'Bridge Notable', isNotable: true },
      '3': { skill: 3, name: 'Leaf Notable', isNotable: true },
      '4': { skill: 4, name: 'Small Node' },
    },
  };

  test('classifies leaf, bridge, and interior correctly', () => {
    // 1 -- 2 -- 3  and  2 -- 4
    const subgraph = new Map<string, Set<string>>([
      ['1', new Set(['2'])],
      ['2', new Set(['1', '3', '4'])],
      ['3', new Set(['2'])],
      ['4', new Set(['2'])],
    ]);

    const classified = classifyNodes(tree, subgraph, '1');
    expect(classified.get('1')!.classification).toBe('leaf');  // degree 1
    expect(classified.get('2')!.classification).toBe('bridge'); // articulation point
    expect(classified.get('3')!.classification).toBe('leaf');
    expect(classified.get('4')!.classification).toBe('leaf');
  });

  test('sets isNotable and isKeystone flags', () => {
    const subgraph = new Map<string, Set<string>>([
      ['1', new Set(['2'])],
      ['2', new Set(['1'])],
    ]);
    const classified = classifyNodes(tree, subgraph, '1');
    expect(classified.get('2')!.isNotable).toBe(true);
    expect(classified.get('1')!.isNotable).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Graph module - buildNotableSkeleton
// ---------------------------------------------------------------------------

describe('buildNotableSkeleton', () => {
  test('finds edges between adjacent notables', () => {
    const tree: PassiveTree = {
      nodes: {
        '1': { skill: 1, name: 'Start', classStartIndex: 3 },
        '2': { skill: 2, name: 'Small1', out: ['3'], in: ['1'] },
        '3': { skill: 3, name: 'Notable A', isNotable: true, out: [], in: ['2'] },
      },
    };

    const subgraph = new Map<string, Set<string>>([
      ['1', new Set(['2'])],
      ['2', new Set(['1', '3'])],
      ['3', new Set(['2'])],
    ]);

    const edges = buildNotableSkeleton(tree, [1, 2, 3], subgraph);
    // Should find edge between Start (classStartIndex) and Notable A
    expect(edges.length).toBeGreaterThanOrEqual(1);
    const edge = edges.find(e =>
      (e.fromName === 'Start' && e.toName === 'Notable A') ||
      (e.fromName === 'Notable A' && e.toName === 'Start')
    );
    expect(edge).toBeDefined();
    expect(edge!.pathLength).toBe(1); // 1 small node between them
  });

  test('returns empty for no important nodes', () => {
    const tree: PassiveTree = {
      nodes: {
        '1': { skill: 1, name: 'Small1' },
        '2': { skill: 2, name: 'Small2' },
      },
    };
    const subgraph = new Map<string, Set<string>>([
      ['1', new Set(['2'])],
      ['2', new Set(['1'])],
    ]);
    const edges = buildNotableSkeleton(tree, [1, 2], subgraph);
    expect(edges).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Graph module - analyzeGraph
// ---------------------------------------------------------------------------

describe('analyzeGraph', () => {
  // Build a small tree with class start, notables, and a keystone
  const tree: PassiveTree = {
    nodes: {
      '1': { skill: 1, name: 'Witch', classStartIndex: 3, out: ['2', '5'] },
      '2': { skill: 2, name: 'Small A', out: ['3'], in: ['1'] },
      '3': { skill: 3, name: 'Minion Notable', isNotable: true, out: ['4'], in: ['2'] },
      '4': { skill: 4, name: 'Leaf Keystone', isKeystone: true, in: ['3'] },
      '5': { skill: 5, name: 'Small B', out: ['6'], in: ['1'] },
      '6': { skill: 6, name: 'ES Notable', isNotable: true, in: ['5'] },
      '100': { skill: 100, name: 'Mistress of Sacrifice', ascendancyName: 'Necromancer' },
    },
    classes: [
      { name: 'Witch', base_str: 14, base_dex: 14, base_int: 32 },
    ],
  };

  test('returns correct class info for ascendancy', () => {
    const analysis = analyzeGraph(tree, [1, 2, 3, 4, 5, 6], 'Necromancer');
    expect(analysis.className).toBe('Witch');
    expect(analysis.ascendancyName).toBe('Necromancer');
  });

  test('counts total nodes', () => {
    const analysis = analyzeGraph(tree, [1, 2, 3, 4, 5, 6], 'Necromancer');
    expect(analysis.totalNodes).toBe(6);
  });

  test('identifies leaf notables/keystones', () => {
    const analysis = analyzeGraph(tree, [1, 2, 3, 4, 5, 6], 'Necromancer');
    const leafNames = analysis.leafNotables.map(n => n.name);
    expect(leafNames).toContain('Leaf Keystone');
    expect(leafNames).toContain('ES Notable');
  });

  test('throws on empty hashes', () => {
    expect(() => analyzeGraph(tree, [], 'Necromancer')).toThrow('No allocated nodes found');
  });
});

// ---------------------------------------------------------------------------
// Graph module - formatGraphAnalysis
// ---------------------------------------------------------------------------

describe('formatGraphAnalysis', () => {
  test('formats output with all sections', () => {
    const analysis = analyzeGraph(
      {
        nodes: {
          '1': { skill: 1, name: 'Start', classStartIndex: 3, out: ['2'] },
          '2': { skill: 2, name: 'Notable', isNotable: true, in: ['1'] },
        },
        classes: [{ name: 'Witch', base_str: 14, base_dex: 14, base_int: 32 }],
      },
      [1, 2],
      'Witch',
    );

    const output = formatGraphAnalysis(analysis);
    expect(output).toContain('PASSIVE TREE GRAPH');
    expect(output).toContain('Class: Witch');
    expect(output).toContain('LEAF NOTABLES');
    expect(output).toContain('BRIDGE NOTABLES');
    expect(output).toContain('NOTABLE CONNECTIVITY');
    expect(output).toContain('PATHING REGIONS');
  });

  test('shows "(none)" for empty leaf notables', () => {
    const output = formatGraphAnalysis({
      className: 'Witch',
      ascendancyName: '',
      totalNodes: 1,
      ascendancyNodes: 0,
      leafNotables: [],
      bridgeNotables: [],
      interiorNotables: [],
      notableSkeleton: [],
      pathingRegions: [],
    });
    expect(output).toContain('(none');
  });
});
