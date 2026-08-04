import { createHash } from "node:crypto";
import { z } from "zod";
import {
  getCatalogRow,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import {
  isHeroGearTypeCompatible,
  unequipGear,
  type UnequipGearResult,
} from "../domain/equipment";
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

export interface UnequipGearInput {
  userId: string;
  interactionId: string;
  expectedRevision: number | null;
  heroKey: number;
  gearType: string;
  inventorySlotIndex: number;
  nowMs: number;
}

export type UnequipGearOutcome =
  | {
      kind: "unequipped";
      heroKey: number;
      gearType: string;
      inventorySlotIndex: number;
      instanceId: string;
      itemKey: number;
    }
  | Exclude<UnequipGearResult, { kind: "unequipped" }>
  | { kind: "player-not-found" };

interface EquipmentRepository {
  transactPlayer<TResult>(
    input: PlayerTransaction<TResult>,
  ): PlayerTransactionResult<TResult>;
}

const UnequipGearOutcomeSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("unequipped"),
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
      kind: z.literal("inventory-slot-occupied"),
      inventorySlotIndex: OutcomeUnsignedIntegerSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("equipment-slot-empty"),
      heroKey: OutcomePositiveIntegerSchema,
      gearType: OutcomeNonEmptyStringSchema,
    })
    .strict(),
  z.object({ kind: z.literal("player-not-found") }).strict(),
]);

export function decodeDiscordHeroUnequipGearOutcome(
  value: unknown,
): UnequipGearOutcome {
  return UnequipGearOutcomeSchema.parse(value);
}

function requireInput(
  indexes: DiscordHeroCatalogIndexes,
  input: UnequipGearInput,
): void {
  const allowedFields = new Set([
    "userId",
    "interactionId",
    "expectedRevision",
    "heroKey",
    "gearType",
    "inventorySlotIndex",
    "nowMs",
  ]);
  const unknownField = Object.keys(input).find(
    (field) => !allowedFields.has(field),
  );
  if (unknownField !== undefined) {
    throw new Error(`unequip gear input has unknown field ${unknownField}`);
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
  if (typeof input.gearType !== "string" || input.gearType.length === 0) {
    throw new Error("DiscordHero gearType must be a non-empty string");
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
  isHeroGearTypeCompatible(indexes, input.heroKey, input.gearType);
  getCatalogRow(indexes, "inventory", input.inventorySlotIndex);
}

function requestSha256(
  heroKey: number,
  gearType: string,
  inventorySlotIndex: number,
): string {
  return createHash("sha256")
    .update(
      [
        "discordhero.unequip-gear/v1",
        `heroKey=${heroKey}`,
        `gearType=${gearType}`,
        `inventorySlotIndex=${inventorySlotIndex}`,
      ].join("\n"),
    )
    .digest("hex");
}

export function unequipDiscordHeroGear(
  repository: EquipmentRepository,
  indexes: DiscordHeroCatalogIndexes,
  input: UnequipGearInput,
): PlayerTransactionResult<UnequipGearOutcome> {
  requireInput(indexes, input);
  return repository.transactPlayer<UnequipGearOutcome>({
    scope: "discordhero.equipment",
    interactionId: input.interactionId,
    operation: "unequip-gear",
    requestSha256: requestSha256(
      input.heroKey,
      input.gearType,
      input.inventorySlotIndex,
    ),
    userId: input.userId,
    expectedRevision: input.expectedRevision,
    decodeOutcome: decodeDiscordHeroUnequipGearOutcome,
    nowMs: input.nowMs,
    mutate: (current) => {
      if (current === null) {
        return {
          kind: "reject",
          outcome: { kind: "player-not-found" },
        };
      }
      validatePlayerAgainstCatalog(current, indexes);
      const result = unequipGear(
        indexes,
        current,
        input.heroKey,
        input.gearType,
        input.inventorySlotIndex,
      );
      if (result.kind !== "unequipped") {
        return { kind: "reject", outcome: result };
      }
      validatePlayerAgainstCatalog(result.state, indexes, current);
      return {
        kind: "commit",
        state: result.state,
        outcome: {
          kind: "unequipped",
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
