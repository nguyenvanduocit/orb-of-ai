import { describe, expect, test } from "bun:test";
import { ContainerBuilder, MessageFlags } from "discord.js";
import { privateBoardPayload } from "./ui";

describe("privateBoardPayload", () => {
  test("creates an ephemeral Components V2 response with mentions disabled", () => {
    const container = new ContainerBuilder();
    const payload = privateBoardPayload(container);

    expect(payload.flags & MessageFlags.Ephemeral).toBe(MessageFlags.Ephemeral);
    expect(payload.flags & MessageFlags.IsComponentsV2).toBe(MessageFlags.IsComponentsV2);
    expect(payload.components).toEqual([container]);
    expect(payload.allowedMentions).toEqual({ parse: [] });
  });
});
