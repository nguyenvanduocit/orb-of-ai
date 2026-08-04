import { createHash } from "node:crypto";
import { z } from "zod";
import {
  getCatalogRow,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import { equipGear, type EquipGearResult } from "../domain/equipment";
import { validatePlayerAgainstCatalog } from "../domain/invariants";
import type {
  PlayerTransaction,
  PlayerTransactionResult,
} from "../state/repository";
import {
  OutcomeInstanceIdSchema,
  OutcomeNonEmptyStringSchema,
  OutcomePositiveIntegerSchema,
  OutcomeUnsignedIntegerSchema,
} from "./outcome-schemas";

export interface EquipGearInput {
  userId: string;
  interactionId: string;
  expectedRevision: number | null;
  heroKey: number;
  inventorySlotIndex: number;
  nowMs: number;
}

export type EquipGearOutcome =
  | {
      kind: "equipped";
      heroKey: number;
      gearType: string;
      inventorySlotIndex: number;
      instanceId: string;
      itemKey: number;
    }
  | Exclude<EquipGearResult, { kind: "equipped" }>
  | { kind: "player-not-found" };

interface EquipmentRepository {
  transactPlayer<TResult>(
    input: PlayerTransaction<TResult>,
  ): PlayerTransactionResult<TResult>;
}

const EquipGearOutcomeSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("equipped"),
      heroKey: OutcomePositiveIntegerSchema,
      gearType: OutcomeNonEmptyStringSchema,
      inventorySlotIndex: OutcomeUnsignedIntegerSchema,
      instanceId: OutcomeInstanceIdSchema,
      itemKey: OutcomePositiveIntegerSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("hero-not-owned"),
      heroKey: OutcomePositiveIntegerSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("inventory-slot-locked"),
      inventorySlotIndex: OutcomeUnsignedIntegerSchema,
      unlockedSlots: OutcomeUnsignedIntegerSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("inventory-slot-empty"),
      inventorySlotIndex: OutcomeUnsignedIntegerSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("inventory-slot-not-gear"),
      inventorySlotIndex: OutcomeUnsignedIntegerSchema,
      itemKey: OutcomePositiveIntegerSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("incompatible-gear"),
      heroKey: OutcomePositiveIntegerSchema,
      gearType: OutcomeNonEmptyStringSchema,
      itemKey: OutcomePositiveIntegerSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("equipment-slot-occupied"),
      heroKey: OutcomePositiveIntegerSchema,
      gearType: OutcomeNonEmptyStringSchema,
      instanceId: OutcomeInstanceIdSchema,
    })
    .strict(),
  z.object({ kind: z.literal("player-not-found") }).strict(),
]);

export function decodeDiscordHeroEquipGearOutcome(
  value: unknown,
): EquipGearOutcome {
  return EquipGearOutcomeSchema.parse(value);
}

function requireInput(
  indexes: DiscordHeroCatalogIndexes,
  input: EquipGearInput,
): void {
  const allowedFields = new Set([
    "userId",
    "interactionId",
    "expectedRevision",
    "heroKey",
    "inventorySlotIndex",
    "nowMs",
  ]);
  const unknownField = Object.keys(input).find(
    (field) => !allowedFields.has(field),
  );
  if (unknownField !== undefined) {
    throw new Error(`equip gear input has unknown field ${unknownField}`);
  }
  if (!/^\d{1,20}$/.test(input.userId)) {
    throw new Error("DiscordHero userId must be a Discord snowflake");
  }
  if (input.interactionId.length < 1 || input.interactionId.length > 200) {
    throw new Error("DiscordHero interactionId must contain 1-200 characters");
  }
  if (
    input.expectedRevision !== null &&
    (!Number.isSafeInteger(input.expectedRevision) ||
      input.expectedRevision < 1)
  ) {
    throw new Error(
      "DiscordHero expectedRevision must be null or a positive safe integer",
    );
  }
  if (!Number.isSafeInteger(input.heroKey) || input.heroKey < 1) {
    throw new Error("DiscordHero heroKey must be a positive safe integer");
  }
  if (
    !Number.isSafeInteger(input.inventorySlotIndex) ||
    input.inventorySlotIndex < 0
  ) {
    throw new Error(
      "DiscordHero inventorySlotIndex must be a non-negative safe integer",
    );
  }
  if (!Number.isSafeInteger(input.nowMs) || input.nowMs < 0) {
    throw new Error("DiscordHero nowMs must be a non-negative safe integer");
  }
  getCatalogRow(indexes, "heroes", input.heroKey);
  getCatalogRow(indexes, "inventory", input.inventorySlotIndex);
}

function requestSha256(heroKey: number, inventorySlotIndex: number): string {
  return createHash("sha256")
    .update(
      [
        "discordhero.equip-gear/v1",
        `heroKey=${heroKey}`,
        `inventorySlotIndex=${inventorySlotIndex}`,
      ].join("\n"),
    )
    .digest("hex");
}

export function equipDiscordHeroGear(
  repository: EquipmentRepository,
  indexes: DiscordHeroCatalogIndexes,
  input: EquipGearInput,
): PlayerTransactionResult<EquipGearOutcome> {
  requireInput(indexes, input);
  return repository.transactPlayer<EquipGearOutcome>({
    scope: "discordhero.equipment",
    interactionId: input.interactionId,
    operation: "equip-gear",
    requestSha256: requestSha256(input.heroKey, input.inventorySlotIndex),
    userId: input.userId,
    expectedRevision: input.expectedRevision,
    decodeOutcome: decodeDiscordHeroEquipGearOutcome,
    nowMs: input.nowMs,
    mutate: (current) => {
      if (current === null) {
        return {
          kind: "reject",
          outcome: { kind: "player-not-found" },
        };
      }
      validatePlayerAgainstCatalog(current, indexes);
      const result = equipGear(
        indexes,
        current,
        input.heroKey,
        input.inventorySlotIndex,
      );
      if (result.kind !== "equipped") {
        return { kind: "reject", outcome: result };
      }
      validatePlayerAgainstCatalog(result.state, indexes, current);
      return {
        kind: "commit",
        state: result.state,
        outcome: {
          kind: "equipped",
          heroKey: result.heroKey,
          gearType: result.gearType,
          inventorySlotIndex: result.inventorySlotIndex,
          instanceId: result.instanceId,
          itemKey: result.itemKey,
        },
      };
    },
  });
}
