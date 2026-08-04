import { Database } from "bun:sqlite";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decodeDiscordHeroCustomId } from "../discord-hero/ui/custom-id";

export interface DiscordHeroScenarioSandbox {
  root: string;
  databasePath: string;
}

export interface DiscordHeroSlashInteractionMock {
  interaction: {
    id: string;
    user: { id: string };
    deferReply(payload: unknown): Promise<void>;
    editReply(payload: unknown): Promise<void>;
    reply(payload: unknown): Promise<void>;
    followUp(payload: unknown): Promise<void>;
  };
  events: Array<{ kind: string; payload?: unknown }>;
}

function protocolError(message: string): Error {
  return new Error(`Discord interaction already acknowledged: ${message}`);
}

export function createDiscordHeroSlashInteraction(
  userId: string,
  id: string,
): DiscordHeroSlashInteractionMock {
  const events: Array<{ kind: string; payload?: unknown }> = [];
  let acknowledged = false;
  let deferred = false;
  const interaction = {
    id,
    user: { id: userId },
    deferReply: async (payload: unknown) => {
      if (acknowledged) throw protocolError("deferReply");
      acknowledged = true;
      deferred = true;
      events.push({ kind: "defer", payload });
    },
    editReply: async (payload: unknown) => {
      if (!deferred) throw new Error("editReply requires deferReply");
      events.push({ kind: "edit", payload: json(payload) });
    },
    reply: async (payload: unknown) => {
      if (acknowledged) throw protocolError("reply");
      acknowledged = true;
      events.push({ kind: "reply", payload });
    },
    followUp: async (payload: unknown) => {
      if (!acknowledged) throw new Error("followUp requires acknowledgement");
      events.push({ kind: "followUp", payload });
    },
  };
  return { interaction, events };
}

export interface DiscordHeroComponentInteractionMock {
  interaction: {
    customId: string;
    id: string;
    user: { id: string };
    update(payload: unknown): Promise<void>;
    reply(payload: unknown): Promise<void>;
    followUp(payload: unknown): Promise<void>;
  };
  updates: unknown[];
  replies: unknown[];
}

export function createDiscordHeroComponentInteraction(
  customId: string,
  userId: string,
  id: string,
): DiscordHeroComponentInteractionMock {
  decodeDiscordHeroCustomId(customId);
  const updates: unknown[] = [];
  const replies: unknown[] = [];
  let acknowledged = false;
  const interaction = {
    customId,
    id,
    user: { id: userId },
    update: async (payload: unknown) => {
      if (acknowledged) throw protocolError("update");
      acknowledged = true;
      updates.push(json(payload));
    },
    reply: async (payload: unknown) => {
      if (acknowledged) throw protocolError("reply");
      acknowledged = true;
      replies.push(payload);
    },
    followUp: async (payload: unknown) => {
      if (!acknowledged) throw new Error("followUp requires acknowledgement");
      replies.push(payload);
    },
  };
  return { interaction, updates, replies };
}

export function assertDiscordHeroSelectValues(
  options: Array<{ value?: unknown; disabled?: unknown }>,
  values: string[],
): void {
  if (values.length !== 1) throw new Error("Discord select requires one value");
  const option = options.find((candidate) => candidate.value === values[0]);
  if (!option) throw new Error("Discord select value is off-menu");
  if (option.disabled === true)
    throw new Error("Discord select option is disabled");
}

export function assertDiscordHeroEmittedControlId(
  customId: string,
  expectedView?: string,
  expectedAction?: string,
): void {
  const decoded = decodeDiscordHeroCustomId(customId);
  if (
    (expectedView !== undefined && decoded.view !== expectedView) ||
    (expectedAction !== undefined && decoded.action !== expectedAction)
  ) {
    throw new Error("Discord control is bound to another screen or action");
  }
}

function json(value: unknown): unknown {
  if (value && typeof value === "object" && "toJSON" in value) {
    return (value as { toJSON: () => unknown }).toJSON();
  }
  return value;
}

export function assertDiscordHeroComponentPayload(payload: unknown): void {
  const normalized = json(payload);
  if (!normalized || typeof normalized !== "object") {
    throw new Error("DiscordHero payload must be an object");
  }
  const root = normalized as Record<string, unknown>;
  if (root.flags !== 32768)
    throw new Error("DiscordHero payload must be V2/private");
  const mentions = root.allowedMentions ?? root.allowed_mentions;
  if (
    !mentions ||
    typeof mentions !== "object" ||
    JSON.stringify((mentions as Record<string, unknown>).parse ?? []) !== "[]"
  ) {
    throw new Error("DiscordHero payload must disable pings");
  }
  if ("files" in root || "attachments" in root) {
    throw new Error(
      "DiscordHero payload must not include files or attachments",
    );
  }
  const customIds = new Set<string>();
  let componentCount = 0;
  const visit = (value: unknown): void => {
    const current = json(value);
    if (!current || typeof current !== "object") return;
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    const record = current as Record<string, unknown>;
    if (typeof record.type === "number") componentCount += 1;
    for (const field of ["custom_id", "label", "description", "value"]) {
      const fieldValue = record[field];
      if (typeof fieldValue !== "string") continue;
      if (fieldValue.length > 100) throw new Error(`${field} exceeds 100`);
      if (field === "custom_id") {
        if (customIds.has(fieldValue)) throw new Error("duplicate custom_id");
        customIds.add(fieldValue);
      }
    }
    if (Array.isArray(record.options)) {
      if (record.options.length > 25) throw new Error("options exceed 25");
      record.options.forEach(visit);
    }
    if (typeof record.content === "string") {
      if (record.content.length > 4_000)
        throw new Error("content exceeds 4000");
      if (record.type === 10 && record.content.length > 3_900) {
        throw new Error("TextDisplay chunk exceeds 3900");
      }
    }
    Object.entries(record)
      .filter(([key]) => key !== "options" && key !== "content")
      .forEach(([, child]) => visit(child));
    if (typeof record.content === "string") visit(record.content);
  };
  visit(normalized);
  if (componentCount > 40) throw new Error("components exceed 40");
}

export function createDiscordHeroScenarioSandbox(): DiscordHeroScenarioSandbox {
  const root = mkdtempSync(join(tmpdir(), "discordhero-phase5-kit-"));
  return { root, databasePath: join(root, "players.sqlite") };
}

export function snapshotDiscordHeroSqlite(databasePath: string): string {
  const db = new Database(databasePath, { readonly: true });
  try {
    return JSON.stringify({
      players: db.query("SELECT * FROM players ORDER BY user_id").all(),
      idempotency: db
        .query("SELECT * FROM idempotency ORDER BY interaction_id")
        .all(),
      integrity: db.query("PRAGMA integrity_check").all(),
      databaseBytesBase64: readFileSync(databasePath).toString("base64"),
      sidecars: ["-wal", "-shm"].map((suffix) => ({
        suffix,
        exists: existsSync(`${databasePath}${suffix}`),
      })),
    });
  } finally {
    db.close();
  }
}

export function cleanupDiscordHeroScenarioSandbox(
  sandbox: DiscordHeroScenarioSandbox,
): void {
  for (const suffix of ["-wal", "-shm"]) {
    rmSync(`${sandbox.databasePath}${suffix}`, { force: true });
  }
  rmSync(sandbox.root, { recursive: true, force: true });
  if (existsSync(sandbox.root))
    throw new Error("DiscordHero E2E temporary root leaked");
}

export function assertDiscordHeroScenarioDirectoryEmpty(root: string): void {
  if (existsSync(root))
    throw new Error("DiscordHero E2E temporary root leaked");
}
