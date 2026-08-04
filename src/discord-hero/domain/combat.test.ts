import { describe, expect, test } from "bun:test";
import {
  DAMAGE_TYPES,
  OracleRequiredError,
  armorReduction,
  mitigateHit,
  type MitigationInput,
  type MitigationTrace,
} from "./combat";

function sequence(...rolls: number[]): () => number {
  let index = 0;
  return () => {
    const roll = rolls[index];
    if (roll === undefined) throw new Error("test RNG exhausted");
    index += 1;
    return roll;
  };
}

function countingRng(rolls: number[]): {
  rng: () => number;
  calls: () => number;
} {
  let index = 0;
  let calls = 0;
  return {
    rng: () => {
      calls += 1;
      const roll = rolls[index];
      if (roll === undefined) throw new Error("test RNG exhausted");
      index += 1;
      return roll;
    },
    calls: () => calls,
  };
}

/** Baseline Physical mitigation with zero avoidance/mitigation (unit-bearing API). */
function physicalBase(
  overrides: Partial<MitigationInput> &
    Pick<MitigationInput, "damage" | "rng"> & { stageLevel?: number },
): MitigationInput {
  return {
    damageType: "Physical",
    stageLevel: 1,
    armor: 0,
    dodgePerThousand: 0,
    maxDodgePerThousand: 0,
    elementalDodgePerThousand: 0,
    maxElementalDodgePerThousand: 0,
    blockPerThousand: 0,
    maxBlockPerThousand: 0,
    elementalBlockPerThousand: 0,
    maxElementalBlockPerThousand: 0,
    damageReductionPerThousand: 0,
    damageAbsorptionFlat: 0,
    ...overrides,
  };
}

function elementalBase(
  damageType: "Fire" | "Cold" | "Lightning",
  overrides: Partial<MitigationInput> & Pick<MitigationInput, "damage" | "rng">,
): MitigationInput {
  return physicalBase({
    damageType,
    resistancePercent: 0,
    allElementalResistancePercent: 0,
    maxResistancePercent: 75,
    ...overrides,
  });
}

function chaosBase(
  overrides: Partial<MitigationInput> & Pick<MitigationInput, "damage" | "rng">,
): MitigationInput {
  return physicalBase({
    damageType: "Chaos",
    resistancePercent: 0,
    maxResistancePercent: 75,
    ...overrides,
  });
}

function expectDeeplyFrozen(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeeplyFrozen(child);
}

describe("DiscordHero physical armor", () => {
  test("uses stage level and hit size in the recovered quadratic curve", () => {
    expect(
      armorReduction({ armor: 100, damage: 100, stageLevel: 1 }),
    ).toBeCloseTo(10_000 / 13_640, 12);
    expect(
      armorReduction({ armor: 100, damage: 1_000, stageLevel: 1 }),
    ).toBeCloseTo(10_000 / 23_000, 12);
  });

  test("caps physical reduction at 75 percent", () => {
    expect(armorReduction({ armor: 1_000, damage: 1, stageLevel: 1 })).toBe(
      0.75,
    );
  });

  test("rejects the legacy hit-only curve and its 85 percent cap", () => {
    const recovered = armorReduction({
      armor: 100,
      damage: 100,
      stageLevel: 1,
    });
    const legacy = 100 / (100 + 10 * 100);

    expect(recovered).toBeCloseTo(0.7331378299120235, 12);
    expect(recovered).not.toBeCloseTo(legacy, 6);
    expect(armorReduction({ armor: 1_000_000, damage: 1, stageLevel: 1 })).toBe(
      0.75,
    );
  });

  test("is algebraically equivalent to the recovered formula for realistic vectors", () => {
    const vectors = [
      { armor: 1, damage: 1, stageLevel: 1 },
      { armor: 10, damage: 100, stageLevel: 5 },
      { armor: 100, damage: 10_000, stageLevel: 50 },
      { armor: 10_000, damage: 1_000, stageLevel: 116 },
    ] as const;

    for (const input of vectors) {
      const armorSquared = input.armor * input.armor;
      const expected = Math.min(
        0.75,
        armorSquared /
          (armorSquared +
            (14 * input.stageLevel + 12) * (input.armor + 0.4 * input.damage)),
      );

      expect(armorReduction(input)).toBeCloseTo(expected, 14);
    }
  });

  test("stays finite when the equivalent direct formula would overflow", () => {
    expect(
      armorReduction({
        armor: Number.MAX_VALUE,
        damage: Number.MAX_VALUE,
        stageLevel: 1,
      }),
    ).toBe(0.75);
  });

  test("rejects a stage level whose recovered threshold is not a safe integer", () => {
    expect(() =>
      armorReduction({
        armor: 100,
        damage: 100,
        stageLevel: Number.MAX_SAFE_INTEGER,
      }),
    ).toThrow("armor stage threshold exceeds the safe-integer range");
  });

  test("rejects stageLevel 0 before any armor math", () => {
    expect(() =>
      armorReduction({ armor: 100, damage: 100, stageLevel: 0 }),
    ).toThrow("stage level must be a positive safe integer");
  });
});

describe("DiscordHero mitigation pipeline (source-native units)", () => {
  test("applies block → resistance → armor → reduction → absorption → floor in order", () => {
    // block 500‰ = 50%, DR 200‰ = 20%, absorb flat 3
    const input = physicalBase({
      damage: 100,
      armor: 100,
      blockPerThousand: 500,
      maxBlockPerThousand: 1000,
      damageReductionPerThousand: 200,
      damageAbsorptionFlat: 3,
      rng: sequence(0.2),
    });

    expect(mitigateHit(input)).toEqual({
      dodged: false,
      blocked: true,
      avoidance: {
        genericDodgePerThousand: 0,
        maxGenericDodgePerThousand: 0,
        elementalDodgePerThousand: 0,
        maxElementalDodgePerThousand: 0,
        genericBlockPerThousand: 500,
        maxGenericBlockPerThousand: 1000,
        elementalBlockPerThousand: 0,
        maxElementalBlockPerThousand: 0,
      },
      afterBlock: 50,
      effectiveResistancePercent: null,
      afterResistance: 50,
      armorReduction: 0.75,
      afterArmor: 12.5,
      afterReduction: 10,
      afterAbsorption: 7,
      damageTaken: 7,
    });
  });

  test("pinned vectors: Dodge raw30=3%, DamageReduction raw200=20%, DamageAbsorption raw32=flat32", () => {
    // Dodge 30‰ = 3%: roll 0.029 dodges; 0.03 does not
    const dodged = mitigateHit(
      physicalBase({
        damage: 100,
        dodgePerThousand: 30,
        maxDodgePerThousand: 30,
        rng: sequence(0.029),
      }),
    );
    expect(dodged.dodged).toBe(true);
    expect(dodged.damageTaken).toBe(0);
    expect(dodged.avoidance.genericDodgePerThousand).toBe(30);

    const notDodged = mitigateHit(
      physicalBase({
        damage: 100,
        dodgePerThousand: 30,
        maxDodgePerThousand: 30,
        damageReductionPerThousand: 200,
        damageAbsorptionFlat: 32,
        rng: sequence(0.03),
      }),
    );
    expect(notDodged.dodged).toBe(false);
    // 100 * (1 - 0.20) - 32 = 48
    expect(notDodged.afterReduction).toBeCloseTo(80, 12);
    expect(notDodged.afterAbsorption).toBeCloseTo(48, 12);
    expect(notDodged.damageTaken).toBeCloseTo(48, 12);

    // Bare 0.30 must not be interpreted as 30% under PerThousand (would be 300‰)
    const rawThirtyIsNotThirtyPercent = mitigateHit(
      physicalBase({
        damage: 1000,
        dodgePerThousand: 30,
        maxDodgePerThousand: 1000,
        rng: sequence(0.05),
      }),
    );
    expect(rawThirtyIsNotThirtyPercent.dodged).toBe(false);
    expect(rawThirtyIsNotThirtyPercent.damageTaken).toBe(1000);
  });

  test("dodge returns zero before the minimum-hit floor", () => {
    const result = mitigateHit(
      physicalBase({
        damage: 100,
        dodgePerThousand: 300,
        maxDodgePerThousand: 300,
        blockPerThousand: 1000,
        maxBlockPerThousand: 1000,
        damageReductionPerThousand: 1000,
        damageAbsorptionFlat: 1_000,
        rng: sequence(0.29),
      }),
    );

    expect(result.damageTaken).toBe(0);
    expect(result.dodged).toBe(true);
    expect(result.blocked).toBe(false);
  });

  test("block halves elemental damage before dynamic resistance", () => {
    const result = mitigateHit(
      elementalBase("Fire", {
        damage: 100,
        stageLevel: 10,
        armor: 1_000_000,
        resistancePercent: 90,
        allElementalResistancePercent: 10,
        maxResistancePercent: 60,
        blockPerThousand: 900,
        maxBlockPerThousand: 500,
        rng: sequence(0.49),
      }),
    );

    expect(result.blocked).toBe(true);
    expect(result.effectiveResistancePercent).toBe(60);
    expect(result.afterBlock).toBe(50);
    expect(result.afterResistance).toBeCloseTo(20, 12);
    expect(result.afterArmor).toBeCloseTo(20, 12);
    expect(result.damageTaken).toBeCloseTo(20, 12);
  });

  test("negative resistance increases elemental damage and has no fixed 75 percent cap", () => {
    const negative = mitigateHit(
      elementalBase("Cold", {
        damage: 100,
        resistancePercent: -20,
        allElementalResistancePercent: 10,
        maxResistancePercent: 90,
        rng: sequence(),
      }),
    );
    const overLegacyCap = mitigateHit(
      elementalBase("Lightning", {
        damage: 100,
        resistancePercent: 85,
        allElementalResistancePercent: 0,
        maxResistancePercent: 90,
        rng: sequence(),
      }),
    );

    expect(negative.effectiveResistancePercent).toBe(-10);
    expect(negative.damageTaken).toBeCloseTo(110, 12);
    expect(overLegacyCap.effectiveResistancePercent).toBe(85);
    expect(overLegacyCap.damageTaken).toBeCloseTo(15, 12);
  });

  test("enforces the minimum one damage after reductions and absorption", () => {
    const result = mitigateHit(
      elementalBase("Fire", {
        damage: 10,
        maxResistancePercent: 100,
        damageReductionPerThousand: 900,
        damageAbsorptionFlat: 100,
        rng: sequence(),
      }),
    );

    expect(result.afterAbsorption).toBeLessThan(0);
    expect(result.damageTaken).toBe(1);
  });

  test("preserves elemental avoidance PerThousand while physical hits use the generic path", () => {
    const result = mitigateHit(
      physicalBase({
        damage: 100,
        elementalDodgePerThousand: 400,
        maxElementalDodgePerThousand: 250,
        elementalBlockPerThousand: 300,
        maxElementalBlockPerThousand: 100,
        rng: sequence(),
      }),
    );

    expect(result.avoidance).toEqual({
      genericDodgePerThousand: 0,
      maxGenericDodgePerThousand: 0,
      elementalDodgePerThousand: 250,
      maxElementalDodgePerThousand: 250,
      genericBlockPerThousand: 0,
      maxGenericBlockPerThousand: 0,
      elementalBlockPerThousand: 100,
      maxElementalBlockPerThousand: 100,
    });
    expect(result.damageTaken).toBe(100);
  });

  test("preserves valid generic RNG call counts 0, 1, and 2", () => {
    const zero = countingRng([]);
    mitigateHit(physicalBase({ damage: 50, rng: zero.rng }));
    expect(zero.calls()).toBe(0);

    const dodgeOnly = countingRng([0.99]);
    mitigateHit(
      physicalBase({
        damage: 50,
        dodgePerThousand: 100,
        maxDodgePerThousand: 100,
        rng: dodgeOnly.rng,
      }),
    );
    expect(dodgeOnly.calls()).toBe(1);

    const blockOnly = countingRng([0.99]);
    mitigateHit(
      physicalBase({
        damage: 50,
        blockPerThousand: 100,
        maxBlockPerThousand: 100,
        rng: blockOnly.rng,
      }),
    );
    expect(blockOnly.calls()).toBe(1);

    const both = countingRng([0.99, 0.99]);
    mitigateHit(
      physicalBase({
        damage: 50,
        dodgePerThousand: 100,
        maxDodgePerThousand: 100,
        blockPerThousand: 100,
        maxBlockPerThousand: 100,
        rng: both.rng,
      }),
    );
    expect(both.calls()).toBe(2);

    const dodgeHit = countingRng([0]);
    mitigateHit(
      physicalBase({
        damage: 50,
        dodgePerThousand: 100,
        maxDodgePerThousand: 100,
        blockPerThousand: 100,
        maxBlockPerThousand: 100,
        rng: dodgeHit.rng,
      }),
    );
    expect(dodgeHit.calls()).toBe(1);
  });

  test("requires an oracle before combining elemental-specific dodge or block (including raw intent with max 0)", () => {
    const cases = [
      {
        elementalDodgePerThousand: 250,
        maxElementalDodgePerThousand: 200,
        elementalBlockPerThousand: 0,
        maxElementalBlockPerThousand: 0,
      },
      {
        elementalDodgePerThousand: 0,
        maxElementalDodgePerThousand: 0,
        elementalBlockPerThousand: 250,
        maxElementalBlockPerThousand: 200,
      },
      // raw nonzero intent with max 0 still needs an oracle — do not clamp away the intent
      {
        elementalDodgePerThousand: 30,
        maxElementalDodgePerThousand: 0,
        elementalBlockPerThousand: 0,
        maxElementalBlockPerThousand: 0,
      },
      {
        elementalDodgePerThousand: 0,
        maxElementalDodgePerThousand: 0,
        elementalBlockPerThousand: 30,
        maxElementalBlockPerThousand: 0,
      },
    ];

    for (const elemental of cases) {
      let rngCalls = 0;
      const act = () =>
        mitigateHit(
          elementalBase("Fire", {
            damage: 100,
            dodgePerThousand: 500,
            maxDodgePerThousand: 500,
            blockPerThousand: 500,
            maxBlockPerThousand: 500,
            ...elemental,
            rng: () => {
              rngCalls += 1;
              return 0;
            },
          }),
        );

      expect(act).toThrow(OracleRequiredError);
      expect(act).toThrow(/elemental-specific dodge\/block|oracle/i);
      expect(rngCalls).toBe(0);
    }

    let chaosRngCalls = 0;
    const chaosAct = () =>
      mitigateHit(
        chaosBase({
          damage: 100,
          elementalDodgePerThousand: 30,
          maxElementalDodgePerThousand: 0,
          rng: () => {
            chaosRngCalls += 1;
            return 0;
          },
        }),
      );
    expect(chaosAct).toThrow(OracleRequiredError);
    expect(chaosAct).toThrow(/elemental-specific dodge\/block|oracle/i);
    expect(chaosRngCalls).toBe(0);
  });

  test("rejects non-finite intermediate mitigation results", () => {
    expect(() =>
      mitigateHit(
        elementalBase("Fire", {
          damage: Number.MAX_VALUE,
          resistancePercent: -100,
          allElementalResistancePercent: 0,
          maxResistancePercent: 75,
          rng: sequence(),
        }),
      ),
    ).toThrow("damage after resistance produced a non-finite result");
  });
});

describe("DiscordHero mitigation validation-before-RNG (reviewer PoCs)", () => {
  test("Physical preflight omits resistance getters on every dodge/armor path", () => {
    const vectors = [
      { name: "dodge-hit armor0", armor: 0, dodge: 500, roll: 0.1 },
      { name: "dodge-miss armor0", armor: 0, dodge: 500, roll: 0.9 },
      {
        name: "guaranteed-dodge armor-positive",
        armor: 100,
        dodge: 1000,
        roll: 0.1,
      },
      { name: "dodge-miss armor-positive", armor: 100, dodge: 500, roll: 0.9 },
    ] as const;

    for (const vector of vectors) {
      const baselineRng = countingRng([vector.roll, 0.9]);
      const baseline = physicalBase({
        damage: 100,
        armor: vector.armor,
        dodgePerThousand: vector.dodge,
        maxDodgePerThousand: 1000,
        rng: baselineRng.rng,
      });
      const poisonedRng = countingRng([vector.roll, 0.9]);
      let resistancePercentReads = 0;
      let allElementalResistancePercentReads = 0;
      let maxResistancePercentReads = 0;
      const poisoned = physicalBase({
        damage: 100,
        armor: vector.armor,
        dodgePerThousand: vector.dodge,
        maxDodgePerThousand: 1000,
        rng: poisonedRng.rng,
      });
      Object.defineProperties(poisoned, {
        resistancePercent: {
          configurable: true,
          get: () => {
            resistancePercentReads += 1;
            return Number.NaN;
          },
        },
        allElementalResistancePercent: {
          configurable: true,
          get: () => {
            allElementalResistancePercentReads += 1;
            return Number.NaN;
          },
        },
        maxResistancePercent: {
          configurable: true,
          get: () => {
            maxResistancePercentReads += 1;
            return Number.NaN;
          },
        },
      });

      expect(mitigateHit(poisoned), vector.name).toEqual(mitigateHit(baseline));
      expect(poisonedRng.calls(), vector.name).toBe(baselineRng.calls());
      expect(resistancePercentReads, vector.name).toBe(0);
      expect(allElementalResistancePercentReads, vector.name).toBe(0);
      expect(maxResistancePercentReads, vector.name).toBe(0);
    }
  });

  test("stageLevel=0 with guaranteed dodge throws before RNG (rngCalls=0)", () => {
    let rngCalls = 0;
    expect(() =>
      mitigateHit(
        physicalBase({
          damage: 100,
          stageLevel: 0,
          dodgePerThousand: 1000,
          maxDodgePerThousand: 1000,
          rng: () => {
            rngCalls += 1;
            return 0;
          },
        }),
      ),
    ).toThrow("stage level must be a positive safe integer");
    expect(rngCalls).toBe(0);
  });

  test("Fire missing resistance with guaranteed dodge throws before RNG", () => {
    let rngCalls = 0;
    expect(() =>
      mitigateHit(
        physicalBase({
          damage: 100,
          damageType: "Fire",
          dodgePerThousand: 1000,
          maxDodgePerThousand: 1000,
          // resistance fields omitted
          rng: () => {
            rngCalls += 1;
            return 0;
          },
        }),
      ),
    ).toThrow(/resistance/i);
    expect(rngCalls).toBe(0);
  });

  test("Fire NaN resistance with guaranteed dodge throws before RNG", () => {
    let rngCalls = 0;
    expect(() =>
      mitigateHit(
        elementalBase("Fire", {
          damage: 100,
          resistancePercent: Number.NaN,
          dodgePerThousand: 1000,
          maxDodgePerThousand: 1000,
          rng: () => {
            rngCalls += 1;
            return 0;
          },
        }),
      ),
    ).toThrow(/finite|resistance/i);
    expect(rngCalls).toBe(0);
  });

  test("runtime unknown damage type Poison throws before RNG", () => {
    let rngCalls = 0;
    expect(() =>
      mitigateHit(
        physicalBase({
          damage: 100,
          damageType: "Poison" as MitigationInput["damageType"],
          resistancePercent: 0,
          allElementalResistancePercent: 0,
          maxResistancePercent: 75,
          dodgePerThousand: 1000,
          maxDodgePerThousand: 1000,
          rng: () => {
            rngCalls += 1;
            return 0;
          },
        }),
      ),
    ).toThrow(/unknown damage type/i);
    expect(rngCalls).toBe(0);
  });

  test("any invalid applicable field throws before RNG with rngCalls=0", () => {
    const cases: Array<{ name: string; patch: Partial<MitigationInput> }> = [
      { name: "negative damage", patch: { damage: -1 } },
      { name: "NaN armor", patch: { armor: Number.NaN } },
      { name: "fractional dodge", patch: { dodgePerThousand: 1.5 } },
      { name: "negative max block", patch: { maxBlockPerThousand: -1 } },
      {
        name: "non-integer damageReduction",
        patch: { damageReductionPerThousand: 0.2 },
      },
      { name: "NaN absorption", patch: { damageAbsorptionFlat: Number.NaN } },
      {
        name: "Infinity all-res",
        patch: {
          damageType: "Fire",
          resistancePercent: 0,
          allElementalResistancePercent: Number.POSITIVE_INFINITY,
          maxResistancePercent: 75,
        },
      },
    ];

    for (const { name, patch } of cases) {
      let rngCalls = 0;
      expect(() =>
        mitigateHit(
          physicalBase({
            damage: 100,
            dodgePerThousand: 500,
            maxDodgePerThousand: 500,
            ...patch,
            rng: () => {
              rngCalls += 1;
              return 0;
            },
          }),
        ),
      ).toThrow();
      expect(rngCalls, name).toBe(0);
    }
  });

  test("stageLevel=MAX_SAFE_INTEGER with armor>0 and dodge/block candidates throws before RNG", () => {
    for (const rolls of [[0], [0.99], [0.99, 0.99]] as const) {
      let index = 0;
      let rngCalls = 0;
      expect(() =>
        mitigateHit(
          physicalBase({
            damage: 100,
            armor: 100,
            stageLevel: Number.MAX_SAFE_INTEGER,
            dodgePerThousand: 500,
            maxDodgePerThousand: 1000,
            blockPerThousand: 500,
            maxBlockPerThousand: 1000,
            rng: () => {
              rngCalls += 1;
              const roll = rolls[index];
              index += 1;
              return roll ?? 0;
            },
          }),
        ),
      ).toThrow("armor stage threshold exceeds the safe-integer range");
      expect(rngCalls).toBe(0);
    }
  });

  test("elemental resistance overflow throws before RNG even with guaranteed dodge", () => {
    let rngCalls = 0;
    expect(() =>
      mitigateHit(
        elementalBase("Fire", {
          damage: 100,
          resistancePercent: Number.MAX_VALUE,
          allElementalResistancePercent: Number.MAX_VALUE,
          maxResistancePercent: 75,
          dodgePerThousand: 1000,
          maxDodgePerThousand: 1000,
          rng: () => {
            rngCalls += 1;
            return 0;
          },
        }),
      ),
    ).toThrow(/combined elemental resistance|finite/i);
    expect(rngCalls).toBe(0);
  });

  test("per-thousand chance/reduction above 1000 fail closed before RNG (unproven >100%)", () => {
    const overCap: Array<{ name: string; patch: Partial<MitigationInput> }> = [
      {
        name: "dodge 1001",
        patch: { dodgePerThousand: 1001, maxDodgePerThousand: 1001 },
      },
      {
        name: "maxDodge 1001",
        patch: { dodgePerThousand: 0, maxDodgePerThousand: 1001 },
      },
      {
        name: "block 1001",
        patch: { blockPerThousand: 1001, maxBlockPerThousand: 1001 },
      },
      {
        name: "maxBlock 1001",
        patch: { blockPerThousand: 0, maxBlockPerThousand: 1001 },
      },
      {
        name: "elementalDodge 1001",
        patch: {
          elementalDodgePerThousand: 1001,
          maxElementalDodgePerThousand: 1001,
        },
      },
      {
        name: "elementalBlock 1001",
        patch: {
          elementalBlockPerThousand: 1001,
          maxElementalBlockPerThousand: 1001,
        },
      },
      {
        name: "damageReduction 1001",
        patch: { damageReductionPerThousand: 1001 },
      },
    ];

    for (const { name, patch } of overCap) {
      let rngCalls = 0;
      expect(() =>
        mitigateHit(
          physicalBase({
            damage: 100,
            ...patch,
            rng: () => {
              rngCalls += 1;
              return 0;
            },
          }),
        ),
      ).toThrow(/1000|100%|unproven|per-thousand/i);
      expect(rngCalls, name).toBe(0);
    }

    // Boundary 1000 is valid (exactly 100%).
    expect(
      mitigateHit(
        physicalBase({
          damage: 100,
          dodgePerThousand: 1000,
          maxDodgePerThousand: 1000,
          damageReductionPerThousand: 1000,
          rng: sequence(0.5),
        }),
      ).dodged,
    ).toBe(true);
  });

  test("per-thousand fractional/negative/nonfinite boundaries fail before RNG", () => {
    const cases: Array<{ name: string; patch: Partial<MitigationInput> }> = [
      { name: "dodge -1", patch: { dodgePerThousand: -1 } },
      { name: "dodge 1.5", patch: { dodgePerThousand: 1.5 } },
      { name: "dodge NaN", patch: { dodgePerThousand: Number.NaN } },
      {
        name: "dodge Infinity",
        patch: { dodgePerThousand: Number.POSITIVE_INFINITY },
      },
      { name: "maxBlock -0.1", patch: { maxBlockPerThousand: -0.1 as number } },
      {
        name: "DR -5",
        patch: { damageReductionPerThousand: -5 },
      },
      {
        name: "DR NaN",
        patch: { damageReductionPerThousand: Number.NaN },
      },
    ];

    for (const { name, patch } of cases) {
      let rngCalls = 0;
      expect(() =>
        mitigateHit(
          physicalBase({
            damage: 50,
            ...patch,
            rng: () => {
              rngCalls += 1;
              return 0;
            },
          }),
        ),
      ).toThrow();
      expect(rngCalls, name).toBe(0);
    }
  });

  test("documents canonical combat units vs passive percent-point adapters", () => {
    // Gear catalog already stores combat per-thousand / flat:
    //   Dodge 30 → dodgePerThousand 30 (3%)
    //   DamageReduction 200 → damageReductionPerThousand 200 (20%)
    //   DamageAbsorption 32 → damageAbsorptionFlat 32
    const gear = mitigateHit(
      physicalBase({
        damage: 1000,
        dodgePerThousand: 30,
        maxDodgePerThousand: 1000,
        damageReductionPerThousand: 200,
        damageAbsorptionFlat: 32,
        rng: sequence(0.05),
      }),
    );
    expect(gear.dodged).toBe(false);
    expect(gear.afterReduction).toBeCloseTo(800, 12);
    expect(gear.afterAbsorption).toBeCloseTo(768, 12);

    // Passive-style "30" / "20" are percent *points*, not combat per-thousand.
    // Adapters must convert: 30pp → 300‰, 20pp → 200‰. Accepting 30 as
    // dodgePerThousand would silently be 3%, not 30%.
    const passiveAdapted = mitigateHit(
      physicalBase({
        damage: 1000,
        dodgePerThousand: 300, // 30 percent points × 10
        maxDodgePerThousand: 1000,
        damageReductionPerThousand: 200, // 20 percent points × 10
        rng: sequence(0.25),
      }),
    );
    expect(passiveAdapted.dodged).toBe(true); // 0.25 < 0.30

    const ambiguousPassiveNotConverted = mitigateHit(
      physicalBase({
        damage: 1000,
        dodgePerThousand: 30, // if a caller forgot the ×10 adapter
        maxDodgePerThousand: 1000,
        rng: sequence(0.25),
      }),
    );
    expect(ambiguousPassiveNotConverted.dodged).toBe(false); // 0.25 >= 0.03
  });
});

describe("DiscordHero TaskbarHero resistance source parity", () => {
  test("Chaos rejects a nonzero all-elemental contribution before RNG", () => {
    let rngCalls = 0;
    expect(() =>
      mitigateHit(
        chaosBase({
          damage: 100,
          resistancePercent: 50,
          allElementalResistancePercent: 40,
          maxResistancePercent: 75,
          dodgePerThousand: 1000,
          maxDodgePerThousand: 1000,
          rng: () => {
            rngCalls += 1;
            return 0;
          },
        }),
      ),
    ).toThrow(/Chaos.*all-elemental|all-elemental.*Chaos/i);
    expect(rngCalls).toBe(0);
  });

  test("Chaos uses only per-type resistance and its explicit maximum", () => {
    const result = mitigateHit(
      chaosBase({
        damage: 100,
        resistancePercent: 50,
        maxResistancePercent: 75,
        rng: sequence(),
      }),
    );

    expect(result.effectiveResistancePercent).toBe(50);
    expect(result.afterResistance).toBeCloseTo(50, 12);
    expect(result.damageTaken).toBeCloseTo(50, 12);
  });

  test("Chaos rejects even an explicit zero all-elemental contribution", () => {
    let rngCalls = 0;
    expect(() =>
      mitigateHit(
        chaosBase({
          damage: 100,
          resistancePercent: 50,
          allElementalResistancePercent: 0,
          maxResistancePercent: 75,
          dodgePerThousand: 1000,
          maxDodgePerThousand: 1000,
          rng: () => {
            rngCalls += 1;
            return 0;
          },
        }),
      ),
    ).toThrow(/Chaos.*all-elemental|all-elemental.*Chaos/i);
    expect(rngCalls).toBe(0);
  });

  test("Fire still adds all-elemental resistance before the per-type maximum", () => {
    const result = mitigateHit(
      elementalBase("Fire", {
        damage: 100,
        resistancePercent: 0,
        allElementalResistancePercent: 40,
        maxResistancePercent: 75,
        rng: sequence(),
      }),
    );

    expect(result.effectiveResistancePercent).toBe(40);
    expect(result.afterResistance).toBeCloseTo(60, 12);
    expect(result.damageTaken).toBeCloseTo(60, 12);
  });

  test("effective resistance at or above 100 requires an oracle before RNG", () => {
    for (const allElementalResistancePercent of [40, 60] as const) {
      let rngCalls = 0;
      const act = () =>
        mitigateHit(
          elementalBase("Fire", {
            damage: 100,
            resistancePercent: 60,
            allElementalResistancePercent,
            maxResistancePercent: 200,
            dodgePerThousand: 1000,
            maxDodgePerThousand: 1000,
            rng: () => {
              rngCalls += 1;
              return 0;
            },
          }),
        );

      expect(act).toThrow(OracleRequiredError);
      expect(act).toThrow(/resistance.*100|100.*resistance|oracle/i);
      expect(rngCalls).toBe(0);
    }
  });

  test("effective resistance 99 remains on the proven pipeline", () => {
    const result = mitigateHit(
      elementalBase("Fire", {
        damage: 100,
        resistancePercent: 60,
        allElementalResistancePercent: 39,
        maxResistancePercent: 200,
        rng: sequence(),
      }),
    );

    expect(result.effectiveResistancePercent).toBe(99);
    expect(result.afterResistance).toBeCloseTo(1, 12);
    expect(result.damageTaken).toBeCloseTo(1, 12);
  });

  test("negative per-type resistance remains legal and amplifies before later stages", () => {
    const result = mitigateHit(
      elementalBase("Fire", {
        damage: 100,
        resistancePercent: -20,
        allElementalResistancePercent: 10,
        maxResistancePercent: 90,
        rng: sequence(),
      }),
    );

    expect(result.effectiveResistancePercent).toBe(-10);
    expect(result.afterResistance).toBeCloseTo(110, 12);
    expect(result.afterReduction).toBeCloseTo(110, 12);
    expect(result.damageTaken).toBeCloseTo(110, 12);
  });

  test("rejects a negative resistance maximum for every elemental type before RNG", () => {
    const variants = [
      { name: "dodge-hit", dodgePerThousand: 500, roll: 0.1 },
      { name: "dodge-miss", dodgePerThousand: 500, roll: 0.9 },
      { name: "guaranteed-dodge", dodgePerThousand: 1000, roll: 0.1 },
    ] as const;

    for (const maximum of [-10, -Number.MIN_VALUE] as const) {
      for (const damageType of DAMAGE_TYPES.filter(
        (type): type is "Fire" | "Cold" | "Lightning" | "Chaos" =>
          type !== "Physical",
      )) {
        for (const variant of variants) {
          const label = `${damageType} max ${maximum} ${variant.name}`;
          let rngCalls = 0;
          const input =
            damageType === "Chaos"
              ? chaosBase({
                  damage: 100,
                  resistancePercent: 50,
                  maxResistancePercent: maximum,
                  dodgePerThousand: variant.dodgePerThousand,
                  maxDodgePerThousand: 1000,
                  rng: () => {
                    rngCalls += 1;
                    return variant.roll;
                  },
                })
              : elementalBase(damageType, {
                  damage: 100,
                  resistancePercent: 50,
                  allElementalResistancePercent: 0,
                  maxResistancePercent: maximum,
                  dodgePerThousand: variant.dodgePerThousand,
                  maxDodgePerThousand: 1000,
                  rng: () => {
                    rngCalls += 1;
                    return variant.roll;
                  },
                });
          let output: MitigationTrace | "SENTINEL" = "SENTINEL";
          let thrown: unknown;
          try {
            output = mitigateHit(input);
          } catch (error) {
            thrown = error;
          }

          expect(output, label).toBe("SENTINEL");
          expect(thrown, label).toBeInstanceOf(Error);
          expect(thrown, label).not.toBeInstanceOf(TypeError);
          expect((thrown as Error).message).toMatch(
            /max resistance.*non-negative/i,
          );
          expect(rngCalls, label).toBe(0);
        }
      }
    }
  });

  test("accepts a zero resistance maximum and clamps effective resistance to zero", () => {
    const result = mitigateHit(
      elementalBase("Fire", {
        damage: 100,
        resistancePercent: 50,
        allElementalResistancePercent: 0,
        maxResistancePercent: 0,
        rng: sequence(),
      }),
    );

    expect(result.effectiveResistancePercent).toBe(0);
    expect(result.damageTaken).toBe(100);
  });

  test("accepts a positive fractional resistance maximum and preserves the exact trace", () => {
    const result = mitigateHit(
      elementalBase("Fire", {
        damage: 100,
        resistancePercent: 80,
        allElementalResistancePercent: 5,
        maxResistancePercent: 12.5,
        rng: sequence(),
      }),
    );

    expect(result).toEqual({
      dodged: false,
      blocked: false,
      avoidance: {
        genericDodgePerThousand: 0,
        maxGenericDodgePerThousand: 0,
        elementalDodgePerThousand: 0,
        maxElementalDodgePerThousand: 0,
        genericBlockPerThousand: 0,
        maxGenericBlockPerThousand: 0,
        elementalBlockPerThousand: 0,
        maxElementalBlockPerThousand: 0,
      },
      afterBlock: 100,
      effectiveResistancePercent: 12.5,
      afterResistance: 87.5,
      armorReduction: 0,
      afterArmor: 87.5,
      afterReduction: 87.5,
      afterAbsorption: 87.5,
      damageTaken: 87.5,
    });
  });

  test("the per-type resistance maximum is explicit and finite before RNG", () => {
    for (const maximum of [undefined, Number.NaN] as const) {
      let rngCalls = 0;
      expect(() =>
        mitigateHit(
          elementalBase("Fire", {
            damage: 100,
            maxResistancePercent: maximum,
            dodgePerThousand: 1000,
            maxDodgePerThousand: 1000,
            rng: () => {
              rngCalls += 1;
              return 0;
            },
          }),
        ),
      ).toThrow(/maximum|max.*resistance|finite|required/i);
      expect(rngCalls).toBe(0);
    }
  });

  test("corpus-bound Chaos resistance 55 clamps to MaxChaosResistance 12", () => {
    const result = mitigateHit(
      chaosBase({
        damage: 100,
        resistancePercent: 55,
        maxResistancePercent: 12,
        rng: sequence(),
      }),
    );

    expect(result.effectiveResistancePercent).toBe(12);
    expect(result.afterResistance).toBeCloseTo(88, 12);
    expect(result.damageTaken).toBeCloseTo(88, 12);
  });
});

describe("DiscordHero mitigation input snapshot read counts", () => {
  test("reads every participating getter once and ignores Physical resistance getters", () => {
    type MitigationField = keyof MitigationInput;
    type CompleteMitigationValues = {
      [Field in MitigationField]-?: MitigationInput[Field];
    };
    const mitigationFields = [
      "damageType",
      "damage",
      "armor",
      "stageLevel",
      "resistancePercent",
      "allElementalResistancePercent",
      "maxResistancePercent",
      "dodgePerThousand",
      "maxDodgePerThousand",
      "elementalDodgePerThousand",
      "maxElementalDodgePerThousand",
      "blockPerThousand",
      "maxBlockPerThousand",
      "elementalBlockPerThousand",
      "maxElementalBlockPerThousand",
      "damageReductionPerThousand",
      "damageAbsorptionFlat",
      "rng",
    ] as const satisfies readonly MitigationField[];
    const withReadCounters = (values: CompleteMitigationValues) => {
      const reads = Object.fromEntries(
        mitigationFields.map((field) => [field, 0]),
      ) as Record<MitigationField, number>;
      const input = {} as MitigationInput;
      for (const field of mitigationFields) {
        Object.defineProperty(input, field, {
          enumerable: true,
          get() {
            reads[field] += 1;
            if (reads[field] !== 1) {
              throw new Error(`${field} getter was read more than once`);
            }
            return values[field];
          },
        });
      }
      return { input, reads };
    };
    const commonValues = {
      damage: 100,
      armor: 0,
      stageLevel: 1,
      dodgePerThousand: 0,
      maxDodgePerThousand: 0,
      elementalDodgePerThousand: 0,
      maxElementalDodgePerThousand: 0,
      blockPerThousand: 0,
      maxBlockPerThousand: 0,
      elementalBlockPerThousand: 0,
      maxElementalBlockPerThousand: 0,
      damageReductionPerThousand: 0,
      damageAbsorptionFlat: 0,
    } as const;
    const everyFieldReadOnce = {
      damageType: 1,
      damage: 1,
      armor: 1,
      stageLevel: 1,
      resistancePercent: 1,
      allElementalResistancePercent: 1,
      maxResistancePercent: 1,
      dodgePerThousand: 1,
      maxDodgePerThousand: 1,
      elementalDodgePerThousand: 1,
      maxElementalDodgePerThousand: 1,
      blockPerThousand: 1,
      maxBlockPerThousand: 1,
      elementalBlockPerThousand: 1,
      maxElementalBlockPerThousand: 1,
      damageReductionPerThousand: 1,
      damageAbsorptionFlat: 1,
      rng: 1,
    } as const;
    let fireRngCalls = 0;
    const fire = withReadCounters({
      ...commonValues,
      damageType: "Fire",
      resistancePercent: 30,
      allElementalResistancePercent: 10,
      maxResistancePercent: 75,
      damageReductionPerThousand: 200,
      damageAbsorptionFlat: 2,
      rng: () => {
        fireRngCalls += 1;
        return 0;
      },
    });
    let chaosRngCalls = 0;
    const chaos = withReadCounters({
      ...commonValues,
      damageType: "Chaos",
      resistancePercent: 25,
      allElementalResistancePercent: undefined,
      maxResistancePercent: 50,
      rng: () => {
        chaosRngCalls += 1;
        return 0;
      },
    });
    let physicalRngCalls = 0;
    const physical = withReadCounters({
      ...commonValues,
      damageType: "Physical",
      resistancePercent: Number.NaN,
      allElementalResistancePercent: Number.NaN,
      maxResistancePercent: -1,
      rng: () => {
        physicalRngCalls += 1;
        return 0;
      },
    });

    const fireResult = mitigateHit(fire.input);
    const chaosResult = mitigateHit(chaos.input);
    const physicalResult = mitigateHit(physical.input);

    expect(fireResult.effectiveResistancePercent).toBe(40);
    expect(fireResult.afterResistance).toBe(60);
    expect(fireResult.afterReduction).toBe(48);
    expect(fireResult.afterAbsorption).toBe(46);
    expect(fireResult.damageTaken).toBe(46);
    expect(chaosResult.effectiveResistancePercent).toBe(25);
    expect(chaosResult.damageTaken).toBe(75);
    expect(physicalResult.effectiveResistancePercent).toBeNull();
    expect(physicalResult.damageTaken).toBe(100);
    expect(fire.reads).toEqual(everyFieldReadOnce);
    expect(chaos.reads).toEqual(everyFieldReadOnce);
    expect(physical.reads).toEqual({
      damageType: 1,
      damage: 1,
      armor: 1,
      stageLevel: 1,
      resistancePercent: 0,
      allElementalResistancePercent: 0,
      maxResistancePercent: 0,
      dodgePerThousand: 1,
      maxDodgePerThousand: 1,
      elementalDodgePerThousand: 1,
      maxElementalDodgePerThousand: 1,
      blockPerThousand: 1,
      maxBlockPerThousand: 1,
      elementalBlockPerThousand: 1,
      maxElementalBlockPerThousand: 1,
      damageReductionPerThousand: 1,
      damageAbsorptionFlat: 1,
      rng: 1,
    });
    expect({
      fire: fireRngCalls,
      chaos: chaosRngCalls,
      physical: physicalRngCalls,
    }).toEqual({ fire: 0, chaos: 0, physical: 0 });
  });
});

describe("DiscordHero mitigation freeze, detachment, and input purity", () => {
  test("returns a recursively frozen detached MitigationTrace", () => {
    const result = mitigateHit(
      physicalBase({
        damage: 100,
        dodgePerThousand: 30,
        maxDodgePerThousand: 30,
        rng: sequence(0.5),
      }),
    );

    expectDeeplyFrozen(result);
    expect(() => {
      (result as { damageTaken: number }).damageTaken = 0;
    }).toThrow(TypeError);
    expect(() => {
      (
        result.avoidance as { genericDodgePerThousand: number }
      ).genericDodgePerThousand = 999;
    }).toThrow(TypeError);
  });

  test("does not mutate input and is stable under post-return input mutation", () => {
    const input = physicalBase({
      damage: 100,
      dodgePerThousand: 30,
      maxDodgePerThousand: 30,
      damageReductionPerThousand: 200,
      damageAbsorptionFlat: 32,
      rng: sequence(0.5),
    });
    const before = structuredClone({
      ...input,
      rng: undefined,
    });

    const first = mitigateHit(input);
    expect({ ...input, rng: undefined }).toEqual(before);

    input.damage = 1;
    input.dodgePerThousand = 1000;
    input.damageAbsorptionFlat = 0;
    const snapshot: MitigationTrace = {
      dodged: first.dodged,
      blocked: first.blocked,
      avoidance: { ...first.avoidance },
      afterBlock: first.afterBlock,
      effectiveResistancePercent: first.effectiveResistancePercent,
      afterResistance: first.afterResistance,
      armorReduction: first.armorReduction,
      afterArmor: first.afterArmor,
      afterReduction: first.afterReduction,
      afterAbsorption: first.afterAbsorption,
      damageTaken: first.damageTaken,
    };
    expect(first.damageTaken).toBe(snapshot.damageTaken);
    expect(first.avoidance.genericDodgePerThousand).toBe(30);
    expect(first.afterAbsorption).toBeCloseTo(48, 12);
  });

  test("falsifier: mutating a returned avoidance object cannot alias catalog-like inputs", () => {
    const input = physicalBase({
      damage: 40,
      blockPerThousand: 0,
      maxBlockPerThousand: 0,
      rng: sequence(),
    });
    const a = mitigateHit(input);
    const b = mitigateHit(input);
    expect(a).not.toBe(b);
    expect(a.avoidance).not.toBe(b.avoidance);
    expect(a).toEqual(b);
  });

  test("TOCTOU: malicious RNG mutating damage/armor/stageLevel after first roll cannot forge the trace", () => {
    // Honest baseline: dodge misses (0.99), block misses (0.99) → full 100 damage.
    const honest = mitigateHit(
      physicalBase({
        damage: 100,
        armor: 0,
        dodgePerThousand: 100,
        maxDodgePerThousand: 1000,
        blockPerThousand: 100,
        maxBlockPerThousand: 1000,
        rng: sequence(0.99, 0.99),
      }),
    );
    expect(honest.damageTaken).toBe(100);
    expect(honest.afterBlock).toBe(100);

    // Malicious RNG mutates live input after the first roll. Preflight snapshot
    // must pin damage=100 — forged 1e308 must never appear in the trace.
    const forged = physicalBase({
      damage: 100,
      armor: 0,
      stageLevel: 5,
      dodgePerThousand: 100,
      maxDodgePerThousand: 1000,
      blockPerThousand: 100,
      maxBlockPerThousand: 1000,
      damageReductionPerThousand: 0,
      damageAbsorptionFlat: 0,
      rng: () => 0.99, // will be replaced
    });
    let rolls = 0;
    forged.rng = () => {
      rolls += 1;
      if (rolls === 1) {
        forged.damage = 1e308;
        forged.armor = 1e308;
        forged.stageLevel = Number.MAX_SAFE_INTEGER;
      }
      return 0.99;
    };

    const result = mitigateHit(forged);
    expect(rolls).toBe(2);
    expect(result.afterBlock).toBe(100);
    expect(result.damageTaken).toBe(100);
    expect(result.armorReduction).toBe(0);
    expect(result.afterBlock).not.toBe(1e308);
    expect(Number.isFinite(result.damageTaken)).toBe(true);
    // Live input was mutated by the RNG callback — that's the attacker's
    // object — but the trace must still reflect the preflight snapshot.
    expect(forged.damage).toBe(1e308);
    expect(forged.armor).toBe(1e308);
  });

  test("TOCTOU: malicious RNG mutating armor/stageLevel cannot change armor reduction", () => {
    const honest = mitigateHit(
      physicalBase({
        damage: 100,
        armor: 100,
        stageLevel: 1,
        dodgePerThousand: 100,
        maxDodgePerThousand: 1000,
        rng: sequence(0.99),
      }),
    );
    const expectedArmor = 10_000 / 13_640;
    expect(honest.armorReduction).toBeCloseTo(expectedArmor, 12);
    expect(honest.damageTaken).toBeCloseTo(100 * (1 - expectedArmor), 12);

    const forged = physicalBase({
      damage: 100,
      armor: 100,
      stageLevel: 1,
      dodgePerThousand: 100,
      maxDodgePerThousand: 1000,
      rng: () => 0.99,
    });
    let rolls = 0;
    forged.rng = () => {
      rolls += 1;
      forged.armor = 0; // would zero armor reduction if re-read
      forged.stageLevel = 50;
      forged.damage = 1e308;
      return 0.99;
    };

    const result = mitigateHit(forged);
    expect(rolls).toBe(1);
    expect(result.armorReduction).toBeCloseTo(expectedArmor, 12);
    expect(result.damageTaken).toBeCloseTo(100 * (1 - expectedArmor), 12);
    expect(forged.armor).toBe(0);
  });

  test("TOCTOU: malicious RNG mutating resistance/reduction/absorption after first roll uses preflight values", () => {
    const forged = elementalBase("Fire", {
      damage: 100,
      resistancePercent: 50,
      allElementalResistancePercent: 0,
      maxResistancePercent: 75,
      dodgePerThousand: 100,
      maxDodgePerThousand: 1000,
      blockPerThousand: 0,
      maxBlockPerThousand: 0,
      damageReductionPerThousand: 200,
      damageAbsorptionFlat: 10,
      rng: () => 0.99,
    });
    let rolls = 0;
    forged.rng = () => {
      rolls += 1;
      forged.resistancePercent = 0;
      forged.allElementalResistancePercent = 0;
      forged.maxResistancePercent = 0;
      forged.damageReductionPerThousand = 0;
      forged.damageAbsorptionFlat = 0;
      forged.damage = 1e308;
      return 0.99; // miss dodge
    };

    const result = mitigateHit(forged);
    expect(rolls).toBe(1);
    // 100 * (1 - 0.50) * (1 - 0.20) - 10 = 30
    expect(result.effectiveResistancePercent).toBe(50);
    expect(result.afterResistance).toBeCloseTo(50, 12);
    expect(result.afterReduction).toBeCloseTo(40, 12);
    expect(result.afterAbsorption).toBeCloseTo(30, 12);
    expect(result.damageTaken).toBeCloseTo(30, 12);
    expect(forged.damage).toBe(1e308);
    expect(forged.damageReductionPerThousand).toBe(0);
  });
});

describe("DiscordHero DAMAGE_TYPES freeze and Physical stage-threshold preflight", () => {
  test("runtime-frozen DAMAGE_TYPES: push('Poison') cannot mutate validation authority", () => {
    const before = [...DAMAGE_TYPES];
    expect(Object.isFrozen(DAMAGE_TYPES)).toBe(true);
    expect(() => {
      (DAMAGE_TYPES as unknown as string[]).push("Poison");
    }).toThrow(TypeError);
    expect([...DAMAGE_TYPES]).toEqual(before);
    expect(DAMAGE_TYPES.includes("Poison" as never)).toBe(false);

    let rngCalls = 0;
    expect(() =>
      mitigateHit(
        physicalBase({
          damage: 100,
          damageType: "Poison" as MitigationInput["damageType"],
          resistancePercent: 0,
          allElementalResistancePercent: 0,
          maxResistancePercent: 75,
          dodgePerThousand: 1000,
          maxDodgePerThousand: 1000,
          rng: () => {
            rngCalls += 1;
            return 0;
          },
        }),
      ),
    ).toThrow(/unknown damage type/i);
    expect(rngCalls).toBe(0);
  });

  test("Physical armor=0 with stageLevel=MAX_SAFE_INTEGER rejects before RNG for dodge hit and miss", () => {
    for (const roll of [0.1, 0.9] as const) {
      let rngCalls = 0;
      expect(() =>
        mitigateHit(
          physicalBase({
            damage: 100,
            armor: 0,
            stageLevel: Number.MAX_SAFE_INTEGER,
            dodgePerThousand: 500,
            maxDodgePerThousand: 1000,
            rng: () => {
              rngCalls += 1;
              return roll;
            },
          }),
        ),
      ).toThrow("armor stage threshold exceeds the safe-integer range");
      expect(rngCalls, `roll ${roll}`).toBe(0);
    }
  });
});

describe("DiscordHero armorReduction one-read snapshots", () => {
  test("poison getters: each field read exactly once; result uses first snapshots", () => {
    const reads = { armor: 0, damage: 0, stageLevel: 0 };
    const input = {
      get armor() {
        reads.armor += 1;
        return reads.armor === 1 ? 100 : Number.NaN;
      },
      get damage() {
        reads.damage += 1;
        return reads.damage === 1 ? 100 : Number.POSITIVE_INFINITY;
      },
      get stageLevel() {
        reads.stageLevel += 1;
        return reads.stageLevel === 1 ? 1 : 0;
      },
    };

    const result = armorReduction(input);
    expect(reads).toEqual({ armor: 1, damage: 1, stageLevel: 1 });
    expect(result).toBeCloseTo(10_000 / 13_640, 12);
  });

  test("poison getters with hostile first values throw Error before math", () => {
    const reads = { armor: 0 };
    expect(() =>
      armorReduction({
        get armor() {
          reads.armor += 1;
          return Number.NaN;
        },
        damage: 100,
        stageLevel: 1,
      }),
    ).toThrow(Error);
    expect(reads.armor).toBe(1);

    expect(() =>
      armorReduction({
        armor: 100,
        get damage() {
          return -1;
        },
        stageLevel: 1,
      }),
    ).toThrow(/non-negative|finite/i);

    expect(() =>
      armorReduction({
        armor: 100,
        damage: 100,
        get stageLevel() {
          return 0;
        },
      }),
    ).toThrow(/stage level/i);
  });
});

describe("DiscordHero preflight full post-block pipeline before RNG", () => {
  test("Fire effective resistance 200 rejects before RNG for dodge hit and miss", () => {
    for (const roll of [0.1, 0.9] as const) {
      let rngCalls = 0;
      const act = () =>
        mitigateHit(
          elementalBase("Fire", {
            damage: Number.MAX_VALUE,
            resistancePercent: 200,
            allElementalResistancePercent: 0,
            maxResistancePercent: 200,
            dodgePerThousand: 500,
            maxDodgePerThousand: 1000,
            damageAbsorptionFlat: Number.MAX_VALUE,
            rng: () => {
              rngCalls += 1;
              return roll;
            },
          }),
        );
      expect(act).toThrow(OracleRequiredError);
      expect(act).toThrow(/resistance.*100|100.*resistance|oracle/i);
      expect(rngCalls, `roll ${roll}`).toBe(0);
    }
  });

  test("effective resistance at or above 100 rejects for guaranteed dodge, block, and miss variants", () => {
    const cases: Array<{
      name: string;
      patch: Partial<MitigationInput>;
    }> = [
      {
        name: "guaranteed dodge",
        patch: {
          dodgePerThousand: 1000,
          maxDodgePerThousand: 1000,
          blockPerThousand: 0,
          maxBlockPerThousand: 0,
        },
      },
      {
        name: "dodge candidate",
        patch: {
          dodgePerThousand: 500,
          maxDodgePerThousand: 1000,
          blockPerThousand: 0,
          maxBlockPerThousand: 0,
        },
      },
      {
        name: "block candidate only",
        patch: {
          dodgePerThousand: 0,
          maxDodgePerThousand: 0,
          blockPerThousand: 500,
          maxBlockPerThousand: 1000,
        },
      },
      {
        name: "no rolls",
        patch: {
          dodgePerThousand: 0,
          maxDodgePerThousand: 0,
          blockPerThousand: 0,
          maxBlockPerThousand: 0,
        },
      },
    ];

    for (const { name, patch } of cases) {
      let rngCalls = 0;
      const act = () =>
        mitigateHit(
          elementalBase("Fire", {
            damage: Number.MAX_VALUE,
            resistancePercent: 200,
            allElementalResistancePercent: 0,
            maxResistancePercent: 200,
            damageAbsorptionFlat: Number.MAX_VALUE,
            ...patch,
            rng: () => {
              rngCalls += 1;
              return 0.99;
            },
          }),
        );
      expect(act).toThrow(OracleRequiredError);
      expect(rngCalls, name).toBe(0);
    }
  });

  test("rejects a finite blocked / non-finite unblocked pipeline before every RNG outcome", () => {
    // MAX * 0.5 remains finite after -100% resistance, while the unblocked
    // MAX * 2 overflows. Every possible avoidance outcome must reject before
    // the first roll because the reachable unblocked branch is invalid.
    const cases = [
      {
        name: "guaranteed dodge",
        dodgePerThousand: 1000,
        blockPerThousand: 0,
        roll: 0,
      },
      {
        name: "block hit",
        dodgePerThousand: 0,
        blockPerThousand: 500,
        roll: 0.1,
      },
      {
        name: "block miss",
        dodgePerThousand: 0,
        blockPerThousand: 500,
        roll: 0.9,
      },
    ] as const;

    for (const candidate of cases) {
      let rngCalls = 0;
      let output: MitigationTrace | "SENTINEL" = "SENTINEL";
      let thrown: unknown;
      try {
        output = mitigateHit(
          elementalBase("Fire", {
            damage: Number.MAX_VALUE,
            resistancePercent: -100,
            allElementalResistancePercent: 0,
            maxResistancePercent: 75,
            dodgePerThousand: candidate.dodgePerThousand,
            maxDodgePerThousand: 1000,
            blockPerThousand: candidate.blockPerThousand,
            maxBlockPerThousand: 1000,
            damageAbsorptionFlat: 0,
            rng: () => {
              rngCalls += 1;
              return candidate.roll;
            },
          }),
        );
      } catch (error) {
        thrown = error;
      }

      expect(output, candidate.name).toBe("SENTINEL");
      expect(thrown, candidate.name).toBeInstanceOf(Error);
      expect((thrown as Error).message, candidate.name).toMatch(
        /damage after resistance produced a non-finite result/i,
      );
      expect(rngCalls, candidate.name).toBe(0);
    }
  });

  test("valid finite pipeline still allows dodge / block / miss RNG counts", () => {
    const zero = countingRng([]);
    mitigateHit(
      elementalBase("Fire", {
        damage: 100,
        resistancePercent: 50,
        maxResistancePercent: 75,
        rng: zero.rng,
      }),
    );
    expect(zero.calls()).toBe(0);

    const dodgeHit = countingRng([0.0]);
    const dodged = mitigateHit(
      elementalBase("Fire", {
        damage: 100,
        resistancePercent: 50,
        maxResistancePercent: 75,
        dodgePerThousand: 500,
        maxDodgePerThousand: 1000,
        rng: dodgeHit.rng,
      }),
    );
    expect(dodgeHit.calls()).toBe(1);
    expect(dodged.dodged).toBe(true);
    expect(dodged.damageTaken).toBe(0);

    const bothMiss = countingRng([0.99, 0.99]);
    const missed = mitigateHit(
      elementalBase("Fire", {
        damage: 100,
        resistancePercent: 50,
        maxResistancePercent: 75,
        dodgePerThousand: 100,
        maxDodgePerThousand: 1000,
        blockPerThousand: 100,
        maxBlockPerThousand: 1000,
        rng: bothMiss.rng,
      }),
    );
    expect(bothMiss.calls()).toBe(2);
    expect(missed.dodged).toBe(false);
    expect(missed.blocked).toBe(false);
    expect(missed.damageTaken).toBeCloseTo(50, 12);
  });
});
