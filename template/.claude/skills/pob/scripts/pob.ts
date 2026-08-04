#!/usr/bin/env bun

/**
 * Path of Building CLI Tool
 *
 * Commands:
 * - decode <url>     - Decode a pobb.in build URL
 * - summary <url>    - Get build summary
 * - skills <url>     - List all skills
 * - items <url>      - List all items
 * - tree <url>       - Show passive tree info
 * - config <url>     - Show build config
 * - xml <url>        - Output raw XML
 */

import { pobClient } from './pob-client';

// ============================================================================
// CLI Interface
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const url = args[1];

  if (!command) {
    printHelp();
    process.exit(0);
  }

  if (!url && command !== 'help') {
    console.error('Error: Missing build URL');
    printHelp();
    process.exit(1);
  }

  try {
    switch (command) {
      case 'decode':
        await decodeBuild(url);
        break;

      case 'summary':
        await showSummary(url);
        break;

      case 'skills':
        await showSkills(url);
        break;

      case 'items':
        await showItems(url);
        break;

      case 'tree':
        await showTree(url);
        break;

      case 'config':
        await showConfig(url);
        break;

      case 'xml':
        await showXml(url);
        break;

      case 'help':
        printHelp();
        break;

      default:
        console.error(`Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// ============================================================================
// Command Implementations
// ============================================================================

async function decodeBuild(url: string) {
  console.log('Fetching and decoding build...\n');

  const build = await pobClient.fetchBuild(url);

  console.log('=== BUILD DECODED ===\n');
  console.log('Character:', build.parsed.level, build.parsed.className, build.parsed.ascendClassName);

  if (build.parsed.skills && build.parsed.skills.length > 0) {
    console.log('\nSkills:', build.parsed.skills.length);
  }

  if (build.parsed.items && Object.keys(build.parsed.items).length > 0) {
    console.log('Items:', Object.keys(build.parsed.items).length);
  }

  if (build.parsed.tree?.specs) {
    console.log('Tree Specs:', Object.keys(build.parsed.tree.specs).length);
  }

  if (build.parsed.config && Object.keys(build.parsed.config).length > 0) {
    console.log('Config Options:', Object.keys(build.parsed.config).length);
  }

  console.log('\nXML Length:', build.xml.length, 'characters');
  console.log('\n✓ Build decoded successfully!');
  console.log('\nUse "pob summary <url>" for a readable summary');
}

async function showSummary(url: string) {
  const build = await pobClient.fetchBuild(url);
  console.log(pobClient.getBuildSummary(build));
}

async function showSkills(url: string) {
  const build = await pobClient.fetchBuild(url);

  console.log('=== SKILLS ===\n');

  if (!build.parsed.skills || build.parsed.skills.length === 0) {
    console.log('No skills found');
    return;
  }

  build.parsed.skills.forEach((skill, index) => {
    if (!skill.enabled) return;

    console.log(`\nSkill #${index + 1}:`);

    if (skill.slot) {
      console.log('  Slot:', skill.slot);
    }

    if (skill.mainActiveSkill) {
      console.log('  Main Active:', skill.mainActiveSkill);
    }

    if (skill.gems && skill.gems.length > 0) {
      console.log('  Gems:');
      skill.gems.forEach(gem => {
        if (!gem.enabled) return;

        const parts = ['    -', gem.nameSpec];
        if (gem.level) parts.push(`(Level ${gem.level}`);
        if (gem.quality) parts.push(`Quality ${gem.quality}%)`);
        else if (gem.level) parts.push(')');

        console.log(parts.join(' '));
      });
    }
  });
}

async function showItems(url: string) {
  const build = await pobClient.fetchBuild(url);

  console.log('=== ITEMS ===\n');

  if (!build.parsed.items || Object.keys(build.parsed.items).length === 0) {
    console.log('No items found');
    return;
  }

  Object.entries(build.parsed.items).forEach(([slot, item]) => {
    console.log(`\n[${slot}]`);

    if (item.name) {
      console.log('  Name:', item.name);
    }

    if (item.typeLine) {
      console.log('  Type:', item.typeLine);
    }

    if (item.rawText && item.rawText.length < 500) {
      console.log('\n' + item.rawText.split('\n').map(l => '  ' + l).join('\n'));
    }
  });
}

async function showTree(url: string) {
  const build = await pobClient.fetchBuild(url);

  console.log('=== PASSIVE TREE ===\n');

  if (!build.parsed.tree || !build.parsed.tree.specs) {
    console.log('No tree data found');
    return;
  }

  console.log('Active Spec:', build.parsed.tree.activeSpec || 'N/A');
  console.log('\nSpecs:');

  Object.entries(build.parsed.tree.specs).forEach(([key, spec]) => {
    console.log(`\n[${spec.title || key}]`);

    if (spec.treeVersion) {
      console.log('  Tree Version:', spec.treeVersion);
    }

    if (spec.classId !== undefined) {
      console.log('  Class ID:', spec.classId);
    }

    if (spec.ascendClassId !== undefined) {
      console.log('  Ascendancy ID:', spec.ascendClassId);
    }

    if (spec.nodes) {
      console.log('  Allocated Nodes:', spec.nodes.length);
    }

    if (spec.url) {
      console.log('  URL:', spec.url);
    }
  });
}

async function showConfig(url: string) {
  const build = await pobClient.fetchBuild(url);

  console.log('=== BUILD CONFIG ===\n');

  if (!build.parsed.config || Object.keys(build.parsed.config).length === 0) {
    console.log('No config found');
    return;
  }

  Object.entries(build.parsed.config)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([key, value]) => {
      console.log(`${key}: ${value}`);
    });
}

async function showXml(url: string) {
  const build = await pobClient.fetchBuild(url);
  console.log(build.xml);
}

function printHelp() {
  console.log(`
Path of Building CLI Tool

Usage:
  bun tools/pob.ts <command> <url>

Commands:
  decode <url>      Decode build and show basic info
  summary <url>     Show human-readable build summary
  skills <url>      List all skills and gems
  items <url>       List all equipped items
  tree <url>        Show passive tree information
  config <url>      Show build configuration
  xml <url>         Output raw XML data
  help              Show this help message

Examples:
  bun tools/pob.ts decode https://pobb.in/8-9u-rZYxc0a
  bun tools/pob.ts summary https://pobb.in/8-9u-rZYxc0a
  bun tools/pob.ts skills https://pobb.in/8-9u-rZYxc0a

Build URL Formats:
  - https://pobb.in/[build-id]
  - pobb.in/[build-id]
`);
}

// ============================================================================
// Run
// ============================================================================

main();
