import { describe, expect, test } from "bun:test";
import { MessageFlags } from "discord.js";
import { boardPayload } from "../../ui";
import { buildCatalogIndexes } from "../catalog/indexes";
import { loadDiscordHeroCatalog } from "../catalog/loader";
import { discordHeroStarterCandidates } from "../domain/party";
import { decodeDiscordHeroCustomId } from "./custom-id";
import { renderDiscordHeroStarter } from "./starter";

const indexes = buildCatalogIndexes(await loadDiscordHeroCatalog());
const candidates = discordHeroStarterCandidates(indexes);

interface RenderedContainer {
  readonly components: readonly {
    readonly type: number;
    readonly content?: string;
    readonly components?: readonly {
      readonly custom_id: string;
      readonly placeholder: string;
      readonly options: readonly {
        label: string;
        description: string;
        value: string;
      }[];
    }[];
  }[];
}

function payload(notice?: string): {
  flags: number;
  allowedMentions: { parse: readonly string[] };
  container: RenderedContainer;
} {
  const rendered = boardPayload(
    renderDiscordHeroStarter("123", candidates, notice),
  );
  return {
    flags: rendered.flags as number,
    allowedMentions: rendered.allowedMentions as { parse: readonly string[] },
    container: rendered.components[0]!.toJSON() as unknown as RenderedContainer,
  };
}

function selectMenu() {
  const rows = payload().container.components.filter(
    (component) => component.components !== undefined,
  );
  expect(rows).toHaveLength(1);
  const menus = rows[0]!.components!;
  expect(menus).toHaveLength(1);
  return menus[0]!;
}

describe("DiscordHero starter board", () => {
  test("offers exactly the three source starters", () => {
    const menu = selectMenu();

    expect(menu.options).toEqual([
      { label: "Knight", description: "Knight", value: "101" },
      { label: "Ranger", description: "Ranger", value: "201" },
      { label: "Sorcerer", description: "Sorcerer", value: "301" },
    ]);
    expect(new Set(menu.options.map((option) => option.value)).size).toBe(3);
  });

  test("binds the one control to its owner and to no revision", () => {
    const menu = selectMenu();

    expect(menu.custom_id).toBe("discordhero:123:party:select:new_:starter");
    expect(decodeDiscordHeroCustomId(menu.custom_id)).toEqual({
      ownerId: "123",
      view: "party",
      action: "select",
      revision: null,
      value: "starter",
    });
  });

  test("ships as a private V2 board with no pings and no navigation", () => {
    const rendered = payload();

    expect(rendered.flags & MessageFlags.IsComponentsV2).toBe(
      MessageFlags.IsComponentsV2,
    );
    expect(rendered.allowedMentions).toEqual({ parse: [] });

    const controls = rendered.container.components.flatMap(
      (component) => component.components ?? [],
    );
    expect(controls).toHaveLength(1);
    for (const control of controls) {
      expect(decodeDiscordHeroCustomId(control.custom_id).view).toBe("party");
    }
  });

  test("stays inside Discord's component bounds and can carry a notice", () => {
    const menu = selectMenu();
    expect(menu.custom_id.length).toBeLessThanOrEqual(100);
    expect(menu.placeholder.length).toBeLessThanOrEqual(150);
    for (const option of menu.options) {
      expect(option.label.length).toBeGreaterThan(0);
      expect(option.label.length).toBeLessThanOrEqual(100);
      expect(option.description.length).toBeLessThanOrEqual(100);
      expect(option.value.length).toBeLessThanOrEqual(100);
    }

    const noticed = payload("That starter is not available.");
    const body = noticed.container.components[0]!.content!;
    expect(body).toContain("That starter is not available.");
    expect(body.length).toBeLessThanOrEqual(4000);
  });

  test("refuses to render an empty roster", () => {
    expect(() => renderDiscordHeroStarter("123", [])).toThrow("candidate");
  });
});
