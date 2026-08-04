import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { guildDir } from "./store";
import {
  loadCharacters,
  loadExpeditionResults,
  loadExpeditions,
  saveCharacters,
  saveExpeditionResults,
  saveExpeditions,
} from "./rpg-store";
import {
  recallExpedition,
  reconcileGuildExpeditions,
  startExpedition,
  trackExpeditionSnapshot,
  syncExpedition,
} from "./expeditions";
import { newProfile } from "./rpg";

const guildId = `test-expedition-private-${process.pid}`;
const userId = "test-user";

function seedHero(): void {
  const profile = newProfile("chien", 0, () => 0.5);
  profile.materials.luongthuc = 2;
  saveCharacters({ [userId]: profile });
}

beforeEach(() => {
  mkdirSync(guildDir(guildId), { recursive: true });
  // The RPG world is shared now, so a test can't rely on its own guild folder
  // for isolation — clear the shared stores it touches instead.
  saveExpeditions({});
  saveExpeditionResults({});
  seedHero();
});

afterEach(() => {
  rmSync(guildDir(guildId), { recursive: true, force: true });
});

describe("finished expedition snapshots", () => {
  test("keeps the latest final result until a new run starts without settling twice", () => {
    const started = startExpedition(guildId, userId, "legacy-channel", "rungma", null);
    expect("error" in started).toBe(false);

    const final = recallExpedition(guildId, userId);
    expect(final?.finished).toBe(true);
    if (!final) throw new Error("expected recall to finish the seeded expedition");
    expect(loadExpeditionResults()[userId]).toEqual(final);

    const charactersAfterSettlement = loadCharacters();
    expect(syncExpedition(guildId, userId)).toEqual(final);
    expect(syncExpedition(guildId, userId)).toEqual(final);
    expect(loadCharacters()).toEqual(charactersAfterSettlement);
    expect(recallExpedition(guildId, userId)).toBeNull();

    const restarted = startExpedition(guildId, userId, "new-channel", "rungma", null);
    expect("error" in restarted).toBe(false);
    expect(loadExpeditionResults()[userId]).toBeUndefined();
  });
});

describe("live snapshot handle", () => {
  test("records the newest interaction token, and ignores a settled run", () => {
    const started = startExpedition(guildId, userId, "channel", "rungma", null);
    expect("error" in started).toBe(false);

    trackExpeditionSnapshot(userId, "token-1");
    expect(loadExpeditions()[userId]?.live?.token).toBe("token-1");

    // Clicking Làm mới again replaces it — that is what extends the live window.
    trackExpeditionSnapshot(userId, "token-2");
    expect(loadExpeditions()[userId]?.live?.token).toBe("token-2");

    // Once the run is over there is nothing to keep fresh; tracking must not
    // resurrect an entry in the store.
    recallExpedition(guildId, userId);
    trackExpeditionSnapshot(userId, "token-3");
    expect(loadExpeditions()[userId]).toBeUndefined();
  });
});

describe("startup expedition reconciliation", () => {
  test("clears and deletes a legacy public board without posting a replacement", async () => {
    const started = startExpedition(guildId, userId, "legacy-channel", "rungma", null);
    expect("error" in started).toBe(false);
    const expeditions = loadExpeditions();
    expeditions[userId]!.messageId = "legacy-message";
    saveExpeditions(expeditions);

    let fetchChannelCalls = 0;
    let fetchMessageCalls = 0;
    let deleteCalls = 0;
    let sendCalls = 0;
    const client = {
      channels: {
        fetch: async (channelId: string) => {
          fetchChannelCalls++;
          expect(channelId).toBe("legacy-channel");
          return {
            isTextBased: () => true,
            isDMBased: () => false,
            messages: {
              fetch: async (messageId: string) => {
                fetchMessageCalls++;
                expect(messageId).toBe("legacy-message");
                return {
                  delete: async () => {
                    deleteCalls++;
                  },
                };
              },
            },
            send: async () => {
              sendCalls++;
            },
          };
        },
      },
    };

    await reconcileGuildExpeditions(client as never, { id: guildId } as never);

    expect(loadExpeditions()[userId]?.messageId).toBeUndefined();
    expect(fetchChannelCalls).toBe(1);
    expect(fetchMessageCalls).toBe(1);
    expect(deleteCalls).toBe(1);
    expect(sendCalls).toBe(0);

    await reconcileGuildExpeditions(client as never, { id: guildId } as never);
    expect(fetchChannelCalls).toBe(1);
    expect(sendCalls).toBe(0);
  });
});
