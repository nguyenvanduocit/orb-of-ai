export const MIN_LEVEL = 1;
export const MAX_LEVEL = 100;
export const MAX_OFFLINE_SECONDS = 8 * 60 * 60;
export const OFFLINE_TAMPER_SECONDS = 30 * 24 * 60 * 60;

export interface LevelEntry {
  level: number;
  experienceForLevelUp: number;
}

export interface LevelCurve {
  entries: readonly LevelEntry[];
}

export interface LevelProgress {
  level: number;
  experience: number;
}

export type OfflineElapsedClassification =
  | Readonly<{ kind: "exact-zero" }>
  | Readonly<{ kind: "clock-regression" }>
  | Readonly<{ kind: "partial-second" }>
  | Readonly<{ kind: "tamper-window" }>
  | Readonly<{
      kind: "eligible";
      elapsedSeconds: number;
      capApplied: boolean;
    }>;

export type LevelProgressSummary =
  | Readonly<{
      status: "progressing";
      level: number;
      experience: number;
      nextLevel: number;
      experienceForLevelUp: number;
      experienceRemaining: number;
      progressPercent: number;
    }>
  | Readonly<{
      status: "max-level";
      level: typeof MAX_LEVEL;
      experience: number;
      terminalBarExperience: number;
      progressPercent: number;
    }>;

export interface OfflineRewardRow {
  stageLevel: number;
  baseGold: number;
  baseExperience: number;
  killCount: number;
  clearCount: number;
}

export type OfflineRuneStat =
  "OfflineRewardGoldPercent" | "OfflineRewardExpPercent" | string;

export interface RuneLevelRow {
  levelKey: string;
  level: number;
  statType: OfflineRuneStat;
  value: number;
}

function requireSafeNonNegativeInteger(value: number, context: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${context} must be a non-negative safe integer`);
  }
}

function requireSafePositiveInteger(value: number, context: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${context} must be a positive safe integer`);
  }
}

function requireFinite(value: number, context: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${context} must be finite`);
  }
}

function finiteResult(value: number, context: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${context} produced a non-finite result`);
  }
  return value;
}

function safeIntegerResult(value: number, context: string): number {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${context} produced an unsafe integer result`);
  }
  return value;
}

export function createLevelCurve(entries: readonly LevelEntry[]): LevelCurve {
  if (!Array.isArray(entries)) {
    throw new Error(`level curve must contain exactly ${MAX_LEVEL} rows`);
  }
  if (entries.length !== MAX_LEVEL) {
    throw new Error(`level curve must contain exactly ${MAX_LEVEL} rows`);
  }

  const normalized: LevelEntry[] = [];
  for (let index = 0; index < MAX_LEVEL; index += 1) {
    if (!Object.hasOwn(entries, index)) {
      throw new Error(`level curve row ${index} is missing`);
    }
    const entry = entries[index];
    if (typeof entry !== "object" || entry === null) {
      throw new Error(`level curve row ${index} must be an object`);
    }
    const expectedLevel = index + MIN_LEVEL;
    if (entry.level !== expectedLevel) {
      throw new Error(
        `level curve row ${index} has level ${entry.level}; expected ${expectedLevel}`,
      );
    }
    requireSafePositiveInteger(
      entry.experienceForLevelUp,
      `level ${entry.level} experience`,
    );
    normalized.push(Object.freeze({ ...entry }));
  }

  return Object.freeze({ entries: Object.freeze(normalized) });
}

function requireLevelCurve(curve: LevelCurve): LevelCurve {
  if (
    typeof curve !== "object" ||
    curve === null ||
    !Array.isArray(curve.entries)
  ) {
    throw new Error(`level curve must contain exactly ${MAX_LEVEL} rows`);
  }
  return createLevelCurve(curve.entries);
}

function requireLevelProgress(
  curve: LevelCurve,
  progress: LevelProgress,
): void {
  if (
    !Number.isSafeInteger(progress.level) ||
    progress.level < MIN_LEVEL ||
    progress.level > MAX_LEVEL
  ) {
    throw new Error(
      `player level must be between ${MIN_LEVEL} and ${MAX_LEVEL}`,
    );
  }
  requireSafeNonNegativeInteger(progress.experience, "player experience");
  if (progress.level === MAX_LEVEL) return;

  const entry = curve.entries[progress.level - MIN_LEVEL];
  if (entry === undefined || entry.level !== progress.level) {
    throw new Error(`level curve is missing level ${progress.level}`);
  }
  if (entry.experienceForLevelUp < 1) {
    throw new Error(
      `level ${progress.level} experience must be a positive safe integer`,
    );
  }
  if (progress.experience >= entry.experienceForLevelUp) {
    throw new Error(
      `level ${progress.level} experience must be below ${entry.experienceForLevelUp}`,
    );
  }
}

function roundedClampedPercent(
  experience: number,
  denominator: number,
): number {
  if (!Number.isSafeInteger(denominator) || denominator < 1) {
    throw new Error(
      "level progress denominator must be a positive safe integer",
    );
  }
  return Math.min(
    100,
    Math.max(0, Math.round((experience / denominator) * 100)),
  );
}

function advanceLevelsInValidatedCurve(
  curve: LevelCurve,
  progress: LevelProgress,
): LevelProgress {
  if (
    !Number.isSafeInteger(progress.level) ||
    progress.level < MIN_LEVEL ||
    progress.level > MAX_LEVEL
  ) {
    throw new Error(
      `player level must be between ${MIN_LEVEL} and ${MAX_LEVEL}`,
    );
  }
  requireSafeNonNegativeInteger(progress.experience, "player experience");

  let level = progress.level;
  let experience = progress.experience;
  while (level < MAX_LEVEL) {
    const entry = curve.entries[level - MIN_LEVEL]!;
    if (experience < entry.experienceForLevelUp) break;
    experience -= entry.experienceForLevelUp;
    level += 1;
  }

  return { level, experience };
}

function experienceToReachLevelInValidatedCurve(
  curve: LevelCurve,
  targetLevel: number,
): number {
  if (
    !Number.isSafeInteger(targetLevel) ||
    targetLevel < MIN_LEVEL ||
    targetLevel > MAX_LEVEL
  ) {
    throw new Error(
      `target level must be between ${MIN_LEVEL} and ${MAX_LEVEL}`,
    );
  }

  let total = 0;
  for (let level = MIN_LEVEL; level < targetLevel; level += 1) {
    total = safeIntegerResult(
      total + curve.entries[level - MIN_LEVEL]!.experienceForLevelUp,
      `experience threshold for level ${targetLevel}`,
    );
  }
  return total;
}

export function summarizeLevelProgress(
  curve: LevelCurve,
  progress: LevelProgress,
): LevelProgressSummary {
  const sourceCurve = requireLevelCurve(curve);
  requireLevelProgress(sourceCurve, progress);
  const entry = sourceCurve.entries[progress.level - MIN_LEVEL]!;

  if (progress.level === MAX_LEVEL) {
    return Object.freeze({
      status: "max-level",
      level: MAX_LEVEL,
      experience: progress.experience,
      terminalBarExperience: entry.experienceForLevelUp,
      progressPercent: roundedClampedPercent(
        progress.experience,
        entry.experienceForLevelUp,
      ),
    });
  }

  return Object.freeze({
    status: "progressing",
    level: progress.level,
    experience: progress.experience,
    nextLevel: progress.level + 1,
    experienceForLevelUp: entry.experienceForLevelUp,
    experienceRemaining: entry.experienceForLevelUp - progress.experience,
    progressPercent: roundedClampedPercent(
      progress.experience,
      entry.experienceForLevelUp,
    ),
  });
}

export function toCumulativeSourceExperience(
  curve: LevelCurve,
  progress: LevelProgress,
): number {
  const sourceCurve = requireLevelCurve(curve);
  requireLevelProgress(sourceCurve, progress);
  return safeIntegerResult(
    experienceToReachLevelInValidatedCurve(sourceCurve, progress.level) +
      progress.experience,
    "cumulative source experience",
  );
}

export function fromCumulativeSourceExperience(
  curve: LevelCurve,
  cumulativeExperience: number,
): Readonly<LevelProgress> {
  const sourceCurve = requireLevelCurve(curve);
  requireSafeNonNegativeInteger(
    cumulativeExperience,
    "cumulative source experience",
  );
  return Object.freeze(
    advanceLevelsInValidatedCurve(sourceCurve, {
      level: MIN_LEVEL,
      experience: cumulativeExperience,
    }),
  );
}

export function advanceLevels(
  curve: LevelCurve,
  progress: LevelProgress,
): LevelProgress {
  const sourceCurve = requireLevelCurve(curve);
  return advanceLevelsInValidatedCurve(sourceCurve, progress);
}

export function experienceToReachLevel(
  curve: LevelCurve,
  targetLevel: number,
): number {
  const sourceCurve = requireLevelCurve(curve);
  return experienceToReachLevelInValidatedCurve(sourceCurve, targetLevel);
}

export function classifyOfflineElapsed(
  lastSeenAtMs: number,
  nowMs: number,
): OfflineElapsedClassification {
  requireFinite(lastSeenAtMs, "last-seen timestamp");
  requireFinite(nowMs, "current timestamp");
  const elapsedMs = finiteResult(
    nowMs - lastSeenAtMs,
    "offline elapsed milliseconds",
  );
  if (elapsedMs < 0) {
    return Object.freeze({ kind: "clock-regression" });
  }
  if (elapsedMs === 0) {
    return Object.freeze({ kind: "exact-zero" });
  }
  if (elapsedMs >= OFFLINE_TAMPER_SECONDS * 1_000) {
    return Object.freeze({ kind: "tamper-window" });
  }
  if (elapsedMs % 1_000 !== 0) {
    return Object.freeze({ kind: "partial-second" });
  }

  const elapsedSeconds = elapsedMs / 1_000;
  return Object.freeze({
    kind: "eligible",
    elapsedSeconds: Math.min(elapsedSeconds, MAX_OFFLINE_SECONDS),
    capApplied: elapsedSeconds > MAX_OFFLINE_SECONDS,
  });
}

export function offlineRewardAtStage(
  rows: readonly OfflineRewardRow[],
  stageLevel: number,
): OfflineRewardRow {
  if (!Number.isSafeInteger(stageLevel) || stageLevel < 1) {
    throw new Error("offline stage level must be a positive safe integer");
  }
  const matches = rows.filter((row) => row.stageLevel === stageLevel);
  if (matches.length !== 1) {
    throw new Error(
      `offline reward table has ${matches.length} rows for stage level ${stageLevel}; expected 1`,
    );
  }
  const row = matches[0]!;
  for (const [name, value] of Object.entries(row)) {
    requireSafeNonNegativeInteger(
      value,
      `offline reward ${stageLevel}.${name}`,
    );
  }
  return { ...row };
}

export interface OfflineRuneBonuses {
  gold: number;
  experience: number;
}

export function offlineRuneBonuses(
  rows: readonly RuneLevelRow[],
  ownedLevels: Readonly<Record<string, number>>,
): OfflineRuneBonuses {
  let goldPerThousand = 0;
  let experiencePerThousand = 0;

  for (const [levelKey, ownedLevel] of Object.entries(ownedLevels)) {
    requireSafeNonNegativeInteger(ownedLevel, `rune ${levelKey} owned level`);
    if (ownedLevel === 0) continue;

    const matching = rows.filter((row) => row.levelKey === levelKey);
    if (matching.length === 0) {
      throw new Error(`rune level table has no rows for ${levelKey}`);
    }
    const maxLevel = Math.max(...matching.map((row) => row.level));
    if (ownedLevel > maxLevel) {
      throw new Error(
        `rune ${levelKey} owned level ${ownedLevel} exceeds source max ${maxLevel}`,
      );
    }

    for (let level = 1; level <= ownedLevel; level += 1) {
      const levelRows = matching.filter((row) => row.level === level);
      if (levelRows.length !== 1) {
        throw new Error(
          `rune level table has ${levelRows.length} rows for ${levelKey} level ${level}; expected 1`,
        );
      }
      const row = levelRows[0]!;
      requireSafeNonNegativeInteger(
        row.value,
        `rune ${levelKey} level ${level} value`,
      );
      if (row.statType === "OfflineRewardGoldPercent") {
        goldPerThousand = safeIntegerResult(
          goldPerThousand + row.value,
          "offline gold rune bonus",
        );
      }
      if (row.statType === "OfflineRewardExpPercent") {
        experiencePerThousand = safeIntegerResult(
          experiencePerThousand + row.value,
          "offline experience rune bonus",
        );
      }
    }
  }

  return {
    gold: goldPerThousand / 1_000,
    experience: experiencePerThousand / 1_000,
  };
}

export function applyOfflineRuneBoost(base: number, bonus: number): number {
  requireFinite(base, "offline reward base");
  requireFinite(bonus, "offline rune bonus");
  if (base < 0) throw new Error("offline reward base must be non-negative");
  return finiteResult(base * (1 + bonus), "offline reward");
}
