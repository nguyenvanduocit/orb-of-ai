import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

describe("RPG public response boundary", () => {
  const file = fileURLToPath(new URL("./commands/rpg.ts", import.meta.url));
  const source = readFileSync(file, "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  test("uses public boardPayload only for ladders and invasion results", () => {
    const publicArguments: string[] = [];

    function visit(node: ts.Node): void {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "boardPayload"
      ) {
        publicArguments.push(node.arguments[0]?.getText(ast) ?? "");
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);

    expect(publicArguments.sort()).toEqual(
      [
        'await ladderContainer(interaction.guild, "pve")',
        "await ladderContainer(interaction.guild, action)",
        "invadeContainer(userId, result)",
        "invadeContainer(userId, result)",
      ].sort(),
    );
  });

  test("routes every interaction response through an explicit privacy boundary", () => {
    const allowedPayloadCalls = new Set([
      "boardPayload",
      "characterSheetReply",
      "expeditionPayload",
      "privateBoardPayload",
    ]);
    const violations: string[] = [];

    function visit(node: ts.Node): void {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.expression.getText(ast) === "interaction" &&
        ["reply", "followUp", "update", "editReply"].includes(node.expression.name.text)
      ) {
        const payload = node.arguments[0];
        if (payload && ts.isObjectLiteralExpression(payload)) {
          const flags = payload.properties.find(
            (property) => property.name?.getText(ast) === "flags",
          );
          if (!flags?.getText(ast).includes("MessageFlags.Ephemeral")) {
            violations.push(`line ${ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1}: literal payload has no Ephemeral flag`);
          }
        } else if (
          payload &&
          (!ts.isCallExpression(payload) ||
            !ts.isIdentifier(payload.expression) ||
            !allowedPayloadCalls.has(payload.expression.text))
        ) {
          violations.push(`line ${ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1}: ${payload.getText(ast)}`);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);

    expect(violations).toEqual([]);
  });
});
