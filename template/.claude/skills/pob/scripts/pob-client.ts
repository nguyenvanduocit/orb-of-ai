/**
 * Path of Building (PoB) Decoder Client
 *
 * Decodes Path of Building builds from pobb.in URLs or raw build codes:
 * - Fetches build data from pobb.in
 * - Base64 decoding
 * - Zlib DEFLATE decompression
 * - XML parsing and extraction
 */

import { inflateSync } from 'zlib';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface PobBuild {
  xml: string;
  parsed: {
    level?: string;
    className?: string;
    ascendClassName?: string;
    mainSocketGroup?: number;

    // Basic stats
    life?: number;
    energyShield?: number;
    mana?: number;

    // Skill information
    skills?: PobSkill[];

    // Item slots
    items?: Record<string, PobItem>;

    // Tree information
    tree?: {
      activeSpec?: string;
      specs?: Record<string, PobTreeSpec>;
    };

    // Config
    config?: Record<string, string | number | boolean>;

    // Notes
    notes?: string;
  };
}

export interface PobSkill {
  enabled?: boolean;
  slot?: string;
  mainActiveSkill?: string;
  gems?: PobGem[];
}

export interface PobGem {
  nameSpec?: string;
  level?: number;
  quality?: number;
  enabled?: boolean;
  skillId?: string;
}

export interface PobItem {
  id?: number;
  name?: string;
  typeLine?: string;
  rarity?: string;
  quality?: number;
  itemLevel?: number;
  sockets?: string;
  mods?: string[];
  rawText?: string;
}

export interface PobTreeSpec {
  title?: string;
  treeVersion?: string;
  classId?: number;
  ascendClassId?: number;
  nodes?: string[];
  url?: string;
}

// ============================================================================
// PoB Decoder Client
// ============================================================================

export class PobClient {
  private readonly baseUrl = 'https://pobb.in';

  /**
   * Fetch and decode a build from pobb.in URL
   */
  async fetchBuild(url: string): Promise<PobBuild> {
    // Extract build ID from URL
    const buildId = this.extractBuildId(url);
    if (!buildId) {
      throw new Error('Invalid pobb.in URL');
    }

    // Fetch raw build code
    const buildCode = await this.fetchRawBuildCode(buildId);

    // Decode the build
    return this.decodeBuild(buildCode);
  }

  /**
   * Decode a raw build code string
   */
  decodeBuild(buildCode: string): PobBuild {
    try {
      // Step 1: Base64 decode
      const compressed = Buffer.from(buildCode, 'base64');

      // Step 2: Decompress with zlib (deflate)
      const xml = inflateSync(compressed).toString('utf-8');

      // Step 3: Parse the XML
      const parsed = this.parseXml(xml);

      return {
        xml,
        parsed,
      };
    } catch (error) {
      throw new Error(`Failed to decode build: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extract build ID from pobb.in URL
   */
  private extractBuildId(url: string): string | null {
    const match = url.match(/pobb\.in\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }

  /**
   * Fetch raw build code from pobb.in
   */
  private async fetchRawBuildCode(buildId: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/${buildId}/raw`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();

      // The raw endpoint returns the base64-encoded build code directly
      return text.trim();
    } catch (error) {
      throw new Error(`Failed to fetch build: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Parse XML build data into structured format
   * (Simple parsing - you can enhance this with a proper XML parser library)
   */
  private parseXml(xml: string): PobBuild['parsed'] {
    const parsed: PobBuild['parsed'] = {};

    // Extract level
    const levelMatch = xml.match(/level="(\d+)"/);
    if (levelMatch) parsed.level = levelMatch[1];

    // Extract class name
    const classMatch = xml.match(/className="([^"]+)"/);
    if (classMatch) parsed.className = classMatch[1];

    // Extract ascendancy
    const ascendMatch = xml.match(/ascendClassName="([^"]+)"/);
    if (ascendMatch) parsed.ascendClassName = ascendMatch[1];

    // Extract main socket group
    const socketMatch = xml.match(/mainSocketGroup="(\d+)"/);
    if (socketMatch) parsed.mainSocketGroup = parseInt(socketMatch[1]);

    // Extract notes
    const notesMatch = xml.match(/<Notes>([\s\S]*?)<\/Notes>/);
    if (notesMatch) {
      parsed.notes = notesMatch[1].trim();
    }

    // Extract config
    parsed.config = this.extractConfig(xml);

    // Extract skills
    parsed.skills = this.extractSkills(xml);

    // Extract items
    parsed.items = this.extractItems(xml);

    // Extract tree
    parsed.tree = this.extractTree(xml);

    return parsed;
  }

  /**
   * Extract config values from XML
   */
  private extractConfig(xml: string): Record<string, string | number | boolean> {
    const config: Record<string, string | number | boolean> = {};
    const configRegex = /<Config\s+key="([^"]+)"\s+value="([^"]*)"/g;
    let match;

    while ((match = configRegex.exec(xml)) !== null) {
      const [, key, value] = match;

      // Try to parse as number or boolean
      if (value === 'true') {
        config[key] = true;
      } else if (value === 'false') {
        config[key] = false;
      } else if (!isNaN(Number(value)) && value !== '') {
        config[key] = Number(value);
      } else {
        config[key] = value;
      }
    }

    return config;
  }

  /**
   * Extract skills from XML
   */
  private extractSkills(xml: string): PobSkill[] {
    const skills: PobSkill[] = [];
    const skillRegex = /<Skill([^>]*?)>([\s\S]*?)<\/Skill>/g;
    let match;

    while ((match = skillRegex.exec(xml)) !== null) {
      const [, attrs, content] = match;

      const skill: PobSkill = {
        enabled: !attrs.includes('enabled="false"'),
        gems: [],
      };

      // Extract slot
      const slotMatch = attrs.match(/slot="([^"]+)"/);
      if (slotMatch) skill.slot = slotMatch[1];

      // Extract main active skill
      const mainSkillMatch = attrs.match(/mainActiveSkill="([^"]+)"/);
      if (mainSkillMatch) skill.mainActiveSkill = mainSkillMatch[1];

      // Extract gems
      const gemRegex = /<Gem([^>]*?)\/>/g;
      let gemMatch;
      while ((gemMatch = gemRegex.exec(content)) !== null) {
        const gemAttrs = gemMatch[1];
        const gem: PobGem = {
          enabled: !gemAttrs.includes('enabled="false"'),
        };

        const nameMatch = gemAttrs.match(/nameSpec="([^"]+)"/);
        if (nameMatch) gem.nameSpec = nameMatch[1];

        const levelMatch = gemAttrs.match(/level="(\d+)"/);
        if (levelMatch) gem.level = parseInt(levelMatch[1]);

        const qualityMatch = gemAttrs.match(/quality="(\d+)"/);
        if (qualityMatch) gem.quality = parseInt(qualityMatch[1]);

        const skillIdMatch = gemAttrs.match(/skillId="([^"]+)"/);
        if (skillIdMatch) gem.skillId = skillIdMatch[1];

        skill.gems!.push(gem);
      }

      skills.push(skill);
    }

    return skills;
  }

  /**
   * Extract items from XML
   */
  private extractItems(xml: string): Record<string, PobItem> {
    const items: Record<string, PobItem> = {};
    const itemRegex = /<Item\s+id="(\d+)"([^>]*?)>([\s\S]*?)<\/Item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
      const [, id, attrs, content] = match;

      const item: PobItem = {
        id: parseInt(id),
        rawText: content.trim(),
      };

      // Try to parse the item text (simple parsing)
      const lines = content.trim().split('\n').map(l => l.trim());
      if (lines.length > 0) {
        item.name = lines[0];
        if (lines.length > 1) {
          item.typeLine = lines[1];
        }
      }

      items[id] = item;
    }

    // Extract equipped items
    const slotRegex = /<Slot\s+name="([^"]+)"\s+itemId="(\d+)"\/>/g;
    while ((match = slotRegex.exec(xml)) !== null) {
      const [, slotName, itemId] = match;
      if (items[itemId]) {
        items[slotName] = items[itemId];
        delete items[itemId];
      }
    }

    return items;
  }

  /**
   * Extract passive tree from XML
   */
  private extractTree(xml: string): PobBuild['parsed']['tree'] {
    const tree: NonNullable<PobBuild['parsed']['tree']> = {
      specs: {},
    };

    // Extract active spec
    const activeSpecMatch = xml.match(/<Tree\s+activeSpec="(\d+)"/);
    if (activeSpecMatch) {
      tree.activeSpec = activeSpecMatch[1];
    }

    // Extract specs
    const specRegex = /<Spec\s+([^>]*?)>([\s\S]*?)<\/Spec>/g;
    let match;

    while ((match = specRegex.exec(xml)) !== null) {
      const [, attrs, content] = match;

      const spec: PobTreeSpec = {};

      // Extract title
      const titleMatch = attrs.match(/title="([^"]+)"/);
      if (titleMatch) spec.title = titleMatch[1];

      // Extract tree version
      const versionMatch = attrs.match(/treeVersion="([^"]+)"/);
      if (versionMatch) spec.treeVersion = versionMatch[1];

      // Extract class ID
      const classIdMatch = attrs.match(/classId="(\d+)"/);
      if (classIdMatch) spec.classId = parseInt(classIdMatch[1]);

      // Extract ascend class ID
      const ascendIdMatch = attrs.match(/ascendClassId="(\d+)"/);
      if (ascendIdMatch) spec.ascendClassId = parseInt(ascendIdMatch[1]);

      // Extract nodes
      const nodesMatch = attrs.match(/nodes="([^"]+)"/);
      if (nodesMatch) {
        spec.nodes = nodesMatch[1].split(',');
      }

      // Extract URL
      const urlMatch = content.match(/<URL>(.*?)<\/URL>/);
      if (urlMatch) {
        spec.url = urlMatch[1].trim();
      }

      // Use title as key if available, otherwise use index
      const key = spec.title || Object.keys(tree.specs!).length.toString();
      tree.specs![key] = spec;
    }

    return tree;
  }

  /**
   * Get a human-readable summary of the build
   */
  getBuildSummary(build: PobBuild): string {
    const { parsed } = build;
    const lines: string[] = [];

    // Character info
    if (parsed.level || parsed.className) {
      const parts = ['Level', parsed.level, parsed.className, parsed.ascendClassName].filter(Boolean);
      lines.push(parts.join(' '));
    }

    // Main skill
    const mainSkill = parsed.skills?.find(s =>
      s.enabled && s.mainActiveSkill && parsed.mainSocketGroup !== undefined &&
      s.slot === `Weapon 1` || s.slot === `Helmet` || s.slot === `Body Armour`
    );

    if (mainSkill?.mainActiveSkill) {
      lines.push(`\nMain Skill: ${mainSkill.mainActiveSkill}`);
      if (mainSkill.gems && mainSkill.gems.length > 0) {
        lines.push('Gems: ' + mainSkill.gems.map(g => g.nameSpec).join(', '));
      }
    }

    // Notes
    if (parsed.notes) {
      lines.push('\nNotes:');
      lines.push(parsed.notes);
    }

    return lines.join('\n');
  }
}

// ============================================================================
// Exports
// ============================================================================

export const pobClient = new PobClient();
