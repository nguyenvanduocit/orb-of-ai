import { createHash } from "node:crypto";
import { z } from "zod";
import {
  getCatalogRow,
  type DiscordHeroCatalogIndexes,
} from "../catalog/indexes";
import { allocateAttributePoint } from "../domain/attributes";
import { validatePlayerAgainstCatalog } from "../domain/invariants";
import type {
  PlayerTransaction,
  PlayerTransactionResult,
} from "../state/repository";
import {
  OutcomePositiveIntegerSchema,
  OutcomeUnsignedIntegerSchema,
} from "./outcome-schemas";

export interface AllocateAttributePointInput {
  readonly userId: string;
  readonly interactionId: string;
  readonly expectedRevision: number | null;
  readonly heroKey: number;
  readonly attributeKey: number;
  readonly nowMs: number;
}

interface AllocationOutcomeFacts {
  readonly heroKey: number;
  readonly attributeKey: number;
  readonly groupKey: number;
  readonly maximumLevel: number;
  readonly requiredPoint: number;
  readonly spentPoints: number;
  readonly pointBudget: number;
  readonly remainingPoints: number;
  readonly groupRequiredAllocatedPoint: number;
}

export type AllocateAttributePointOutcome =
  | (AllocationOutcomeFacts & {
      readonly kind: "allocated";
      readonly level: number;
    })
  | (AllocationOutcomeFacts & {
      readonly kind: "maximum-level";
      readonly level: number;
    })
  | (AllocationOutcomeFacts & {
      readonly kind: "group-locked";
      readonly currentLevel: number;
    })
  | (AllocationOutcomeFacts & {
      readonly kind: "insufficient-points";
      readonly currentLevel: number;
      readonly nextLevel: number;
    })
  | { readonly kind: "hero-not-owned"; readonly heroKey: number }
  | { readonly kind: "player-not-found" };

interface AttributeRepository {
  transactPlayer<TResult>(
    input: PlayerTransaction<TResult>,
  ): PlayerTransactionResult<TResult>;
}

const AllocationFactsShape = {
  heroKey: OutcomePositiveIntegerSchema,
  attributeKey: OutcomePositiveIntegerSchema,
  groupKey: OutcomePositiveIntegerSchema,
  maximumLevel: OutcomePositiveIntegerSchema,
  requiredPoint: OutcomePositiveIntegerSchema,
  spentPoints: OutcomeUnsignedIntegerSchema,
  pointBudget: OutcomePositiveIntegerSchema,
  remainingPoints: OutcomeUnsignedIntegerSchema,
  groupRequiredAllocatedPoint: OutcomeUnsignedIntegerSchema,
} as const;

function hasSafeMinimumAttributeSpend(
  spentPoints: number,
  groupRequiredAllocatedPoint: number,
  level: number,
  requiredPoint: number,
): boolean {
  const targetSpend = level * requiredPoint;
  if (!Number.isSafeInteger(targetSpend)) {
    return false;
  }
  const minimumSpend = groupRequiredAllocatedPoint + targetSpend;
  return Number.isSafeInteger(minimumSpend) && spentPoints >= minimumSpend;
}

const AllocateAttributePointOutcomeSchema = z
  .discriminatedUnion("kind", [
    z
      .object({
        kind: z.literal("allocated"),
        ...AllocationFactsShape,
        level: OutcomePositiveIntegerSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("maximum-level"),
        ...AllocationFactsShape,
        level: OutcomePositiveIntegerSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("group-locked"),
        ...AllocationFactsShape,
        currentLevel: OutcomeUnsignedIntegerSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("insufficient-points"),
        ...AllocationFactsShape,
        currentLevel: OutcomeUnsignedIntegerSchema,
        nextLevel: OutcomePositiveIntegerSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("hero-not-owned"),
        heroKey: OutcomePositiveIntegerSchema,
      })
      .strict(),
    z.object({ kind: z.literal("player-not-found") }).strict(),
  ])
  .superRefine((outcome, context) => {
    if (
      outcome.kind === "player-not-found" ||
      outcome.kind === "hero-not-owned"
    ) {
      return;
    }
    if (
      !Number.isSafeInteger(outcome.spentPoints + outcome.remainingPoints) ||
      outcome.spentPoints + outcome.remainingPoints !== outcome.pointBudget
    ) {
      context.addIssue({
        code: "custom",
        message: "Attribute outcome point budget does not balance",
      });
    }
    if (outcome.kind === "allocated" && outcome.level > outcome.maximumLevel) {
      context.addIssue({
        code: "custom",
        message: "allocated Attribute level exceeds source maximum",
      });
    }
    if (
      outcome.kind === "allocated" &&
      !hasSafeMinimumAttributeSpend(
        outcome.spentPoints,
        outcome.groupRequiredAllocatedPoint,
        outcome.level,
        outcome.requiredPoint,
      )
    ) {
      context.addIssue({
        code: "custom",
        message:
          "allocated Attribute spend is below group threshold plus target level cost",
      });
    }
    if (
      outcome.kind === "maximum-level" &&
      outcome.level !== outcome.maximumLevel
    ) {
      context.addIssue({
        code: "custom",
        message: "maximum Attribute outcome is below source maximum",
      });
    }
    if (
      outcome.kind === "maximum-level" &&
      !hasSafeMinimumAttributeSpend(
        outcome.spentPoints,
        outcome.groupRequiredAllocatedPoint,
        outcome.level,
        outcome.requiredPoint,
      )
    ) {
      context.addIssue({
        code: "custom",
        message:
          "maximum Attribute spend is below group threshold plus target level cost",
      });
    }
    if (
      outcome.kind === "group-locked" &&
      outcome.spentPoints >= outcome.groupRequiredAllocatedPoint
    ) {
      context.addIssue({
        code: "custom",
        message: "locked Attribute group threshold is already met",
      });
    }
    if (
      outcome.kind === "group-locked" &&
      outcome.currentLevel >= outcome.maximumLevel
    ) {
      context.addIssue({
        code: "custom",
        message: "locked Attribute outcome is already maximum",
      });
    }
    if (outcome.kind === "group-locked" && outcome.currentLevel !== 0) {
      context.addIssue({
        code: "custom",
        message: "locked Attribute group has nonzero target progress",
      });
    }
    if (outcome.kind === "insufficient-points") {
      if (outcome.nextLevel !== outcome.currentLevel + 1) {
        context.addIssue({
          code: "custom",
          message: "Attribute next level is not canonical",
        });
      }
      if (outcome.currentLevel >= outcome.maximumLevel) {
        context.addIssue({
          code: "custom",
          message: "insufficient Attribute outcome is already maximum",
        });
      }
      if (
        !hasSafeMinimumAttributeSpend(
          outcome.spentPoints,
          outcome.groupRequiredAllocatedPoint,
          outcome.currentLevel,
          outcome.requiredPoint,
        )
      ) {
        context.addIssue({
          code: "custom",
          message:
            "insufficient Attribute spend is below group threshold plus target level cost",
        });
      }
      if (outcome.remainingPoints >= outcome.requiredPoint) {
        context.addIssue({
          code: "custom",
          message: "insufficient Attribute outcome has an available point",
        });
      }
    }
  });

export function decodeDiscordHeroAllocateAttributePointOutcome(
  value: unknown,
): AllocateAttributePointOutcome {
  return AllocateAttributePointOutcomeSchema.parse(value);
}

function requireInput(input: AllocateAttributePointInput): void {
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
  if (!Number.isSafeInteger(input.attributeKey) || input.attributeKey < 1) {
    throw new Error("DiscordHero attributeKey must be a positive safe integer");
  }
  if (!Number.isSafeInteger(input.nowMs) || input.nowMs < 0) {
    throw new Error("DiscordHero nowMs must be a non-negative safe integer");
  }
}

function requestSha256(heroKey: number, attributeKey: number): string {
  return createHash("sha256")
    .update(
      `discordhero.allocate-attribute-point/v1\nheroKey=${heroKey}\nattributeKey=${attributeKey}`,
    )
    .digest("hex");
}

export function allocateDiscordHeroAttributePoint(
  repository: AttributeRepository,
  indexes: DiscordHeroCatalogIndexes,
  input: AllocateAttributePointInput,
): PlayerTransactionResult<AllocateAttributePointOutcome> {
  requireInput(input);
  return repository.transactPlayer<AllocateAttributePointOutcome>({
    scope: "discordhero.heroes",
    interactionId: input.interactionId,
    operation: "allocate-attribute-point",
    requestSha256: requestSha256(input.heroKey, input.attributeKey),
    userId: input.userId,
    expectedRevision: input.expectedRevision,
    decodeOutcome: decodeDiscordHeroAllocateAttributePointOutcome,
    nowMs: input.nowMs,
    mutate: (current) => {
      if (current === null) {
        return { kind: "reject", outcome: { kind: "player-not-found" } };
      }
      validatePlayerAgainstCatalog(current, indexes);
      const source = getCatalogRow(indexes, "attributes", input.attributeKey);
      if (source.HeroKey !== input.heroKey) {
        throw new Error(
          `Attribute ${input.attributeKey} belongs to Hero ${source.HeroKey}, not ${input.heroKey}`,
        );
      }
      if (!current.heroes.some((hero) => hero.heroKey === input.heroKey)) {
        return {
          kind: "reject",
          outcome: { kind: "hero-not-owned", heroKey: input.heroKey },
        };
      }
      const result = allocateAttributePoint(
        indexes,
        current,
        input.heroKey,
        input.attributeKey,
      );
      if (result.kind !== "allocated") {
        return { kind: "reject", outcome: result };
      }
      validatePlayerAgainstCatalog(result.state, indexes, current);
      const { state, ...outcome } = result;
      return { kind: "commit", state, outcome };
    },
  });
}
