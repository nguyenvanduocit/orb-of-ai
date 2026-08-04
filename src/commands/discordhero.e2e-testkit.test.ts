import { expect, test } from "bun:test";
import { encodeDiscordHeroCustomId } from "../discord-hero/ui/custom-id";
import {
  assertDiscordHeroComponentPayload,
  assertDiscordHeroEmittedControlId,
  assertDiscordHeroSelectValues,
  assertDiscordHeroScenarioDirectoryEmpty,
  cleanupDiscordHeroScenarioSandbox,
  createDiscordHeroComponentInteraction,
  createDiscordHeroScenarioSandbox,
  createDiscordHeroSlashInteraction,
} from "./discordhero.e2e-testkit";

test("phase5 testkit cleans temporary scenario roots", () => {
  const sandbox = createDiscordHeroScenarioSandbox();
  cleanupDiscordHeroScenarioSandbox(sandbox);
  expect(() =>
    assertDiscordHeroScenarioDirectoryEmpty(sandbox.root),
  ).not.toThrow();
});

test("phase5 cleanup assertion rejects an existing empty root", () => {
  const sandbox = createDiscordHeroScenarioSandbox();
  expect(() => assertDiscordHeroScenarioDirectoryEmpty(sandbox.root)).toThrow(
    /root leaked/i,
  );
  cleanupDiscordHeroScenarioSandbox(sandbox);
});

test("phase5 slash mock enforces acknowledgement ordering and cardinality", async () => {
  const mock = createDiscordHeroSlashInteraction("123", "protocol-slash");
  await mock.interaction.deferReply({ flags: 64 });
  await expect(mock.interaction.deferReply({ flags: 64 })).rejects.toThrow(
    /already acknowledged/i,
  );
  await expect(
    mock.interaction.reply({ content: "duplicate" }),
  ).rejects.toThrow(/already acknowledged/i);
  await mock.interaction.editReply({ content: "ok" });
  await expect(mock.interaction.followUp({ content: "ok" })).resolves.toBe(
    undefined,
  );
});

test("phase5 payload gate enforces private V2 and recursive Discord bounds", () => {
  expect(() =>
    assertDiscordHeroComponentPayload({
      flags: 32768,
      allowedMentions: { parse: [] },
      components: [
        {
          type: 3,
          custom_id: "menu",
          options: Array.from({ length: 26 }, (_, index) => ({
            value: `x-${index}`,
            label: "x",
          })),
        },
      ],
    }),
  ).toThrow(/25|component/i);
});

test("phase5 component mock enforces one acknowledgement and emitted menu values", async () => {
  const mock = createDiscordHeroComponentInteraction(
    "discordhero:123:home:view:1",
    "123",
    "component",
  );
  await expect(mock.interaction.followUp({ content: "early" })).rejects.toThrow(
    /requires acknowledgement/i,
  );
  await mock.interaction.update({ components: [] });
  await expect(mock.interaction.update({ components: [] })).rejects.toThrow(
    /already acknowledged/i,
  );
  expect(() =>
    assertDiscordHeroSelectValues(
      [{ value: "allowed" }, { value: "disabled", disabled: true }],
      ["off-menu"],
    ),
  ).toThrow(/off-menu/i);
  expect(() =>
    assertDiscordHeroSelectValues(
      [{ value: "allowed" }, { value: "disabled", disabled: true }],
      ["disabled"],
    ),
  ).toThrow(/disabled/i);
});

test("phase5 control gate rejects malformed and cross-screen fabricated IDs", () => {
  expect(() =>
    createDiscordHeroComponentInteraction("raw/fabricated-id", "123", "bad"),
  ).toThrow();
  expect(() =>
    assertDiscordHeroEmittedControlId("raw/fabricated-id"),
  ).toThrow();
  const home = encodeDiscordHeroCustomId({
    ownerId: "123",
    view: "home",
    action: "view",
    revision: 1,
  });
  expect(() =>
    assertDiscordHeroEmittedControlId(home, "world", "select"),
  ).toThrow(/another screen/i);
});
