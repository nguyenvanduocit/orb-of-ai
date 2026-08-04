import { describe, expect, test } from "bun:test";
import {
  applyStatModifiers,
  effectiveDps,
  rollCriticalDamage,
  type StatModifier,
} from "./stats";

describe("DiscordHero stat layers", () => {
  test("combines all eight sources through flat, additive, then compounding multiplicative layers", () => {
    const modifiers: StatModifier[] = [
      { source: "Base", layer: "FLAT", value: 1 },
      { source: "Item", layer: "FLAT", value: 9 },
      { source: "Attribute", layer: "FLAT", value: 5 },
      { source: "Passive", layer: "ADDITIVE", value: 0.2 },
      { source: "AccountStatus", layer: "ADDITIVE", value: 0.3 },
      { source: "StatusEffect", layer: "MULTIPLICATIVE", value: 0.1 },
      { source: "BuffSkill", layer: "MULTIPLICATIVE", value: 0.2 },
      { source: "Environment", layer: "MULTIPLICATIVE", value: -0.25 },
    ];

    // (100 + 1 + 9 + 5) × (1 + .2 + .3) × 1.1 × 1.2 × .75
    expect(applyStatModifiers(100, modifiers)).toBeCloseTo(170.775, 10);
  });

  test("does not collapse multiplicative modifiers into one additive sum", () => {
    expect(
      applyStatModifiers(100, [
        { source: "Item", layer: "MULTIPLICATIVE", value: 0.5 },
        { source: "BuffSkill", layer: "MULTIPLICATIVE", value: 0.5 },
      ]),
    ).toBe(225);
  });

  test("rejects non-finite modifier inputs at the domain boundary", () => {
    expect(() =>
      applyStatModifiers(100, [
        { source: "Item", layer: "FLAT", value: Number.NaN },
      ]),
    ).toThrow("modifier Item/FLAT must be finite");
  });

  test("rejects non-finite results from overflowing stat layers", () => {
    expect(() =>
      applyStatModifiers(Number.MAX_VALUE, [
        { source: "Item", layer: "FLAT", value: Number.MAX_VALUE },
      ]),
    ).toThrow("base plus flat stat produced a non-finite result");
  });
});

describe("DiscordHero critical hits and DPS", () => {
  test("uses the recovered expected-DPS formula and delivery increase", () => {
    expect(
      effectiveDps({
        attackSpeed: 2,
        attackDamage: 100,
        criticalChance: 0.25,
        criticalDamage: 2,
        deliveryIncrease: 0.2,
      }),
    ).toBe(300);
  });

  test("uses injected rolls and the strict roll < critical chance boundary", () => {
    expect(
      rollCriticalDamage(100, 0.25, 1.4, () => 0.249999),
    ).toEqual({ damage: 140, critical: true, roll: 0.249999 });
    expect(
      rollCriticalDamage(100, 0.25, 1.4, () => 0.25),
    ).toEqual({ damage: 100, critical: false, roll: 0.25 });
  });

  test("preserves the engine's uncapped critical chance instead of imposing a legacy cap", () => {
    expect(
      rollCriticalDamage(100, 1.2, 2, () => 0.999999),
    ).toEqual({ damage: 200, critical: true, roll: 0.999999 });
  });

  test("rejects negative critical chance in both expected and rolled damage", () => {
    expect(() =>
      effectiveDps({
        attackSpeed: 1,
        attackDamage: 100,
        criticalChance: -0.01,
        criticalDamage: 2,
      }),
    ).toThrow("critical chance must be non-negative");
    expect(() => rollCriticalDamage(100, -0.01, 2, () => 0)).toThrow(
      "critical chance must be non-negative",
    );
  });

  test("rejects non-finite DPS and critical damage results", () => {
    expect(() =>
      effectiveDps({
        attackSpeed: Number.MAX_VALUE,
        attackDamage: 2,
        criticalChance: 0,
        criticalDamage: 2,
      }),
    ).toThrow("DPS produced a non-finite result");
    expect(() =>
      rollCriticalDamage(Number.MAX_VALUE, 1, 2, () => 0),
    ).toThrow("critical damage produced a non-finite result");
  });

  test("rejects an injected RNG value outside [0, 1)", () => {
    expect(() => rollCriticalDamage(100, 0.25, 2, () => 1)).toThrow(
      "critical RNG must return a value in [0, 1)",
    );
  });
});
