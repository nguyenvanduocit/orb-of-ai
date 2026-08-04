import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CHECK_STAGE = "catalog-check";
const STAMP_SOURCE = "/artifact-check.verified";
const STAMP_DESTINATION = "/app/.artifact-check.verified";
const STAMP_COMMAND = `printf 'verified\\n' > ${STAMP_SOURCE}`;
const EXPECTED_CHECKS = [
  ["bun", "run", "discordhero:catalog:check"],
  ["bun", "run", "discordhero:achievements:check"],
  ["bun", "run", "discordhero:community-market:check"],
  ["bun", "run", "discordhero:community-content:check"],
] as const;
const STAMP_RUN = ["/bin/sh", "-c", STAMP_COMMAND] as const;

interface DockerInstruction {
  keyword: string;
  value: string;
}

interface DockerStage {
  name: string | null;
  instructions: DockerInstruction[];
}

function logicalDockerfileLines(source: string): string[] {
  const lines: string[] = [];
  let logicalLine = "";

  for (const physicalLine of source.split(/\r?\n/)) {
    const trimmed = physicalLine.trim();
    if (logicalLine === "" && (trimmed === "" || trimmed.startsWith("#"))) {
      continue;
    }

    const continues = trimmed.endsWith("\\");
    const segment = continues ? trimmed.slice(0, -1).trimEnd() : trimmed;
    logicalLine = logicalLine === "" ? segment : `${logicalLine} ${segment}`;

    if (!continues) {
      lines.push(logicalLine.replace(/\s+/g, " ").trim());
      logicalLine = "";
    }
  }

  if (logicalLine !== "") {
    lines.push(logicalLine.replace(/\s+/g, " ").trim());
  }

  return lines;
}

function parseDockerfile(source: string): DockerStage[] {
  const stages: DockerStage[] = [];

  for (const line of logicalDockerfileLines(source)) {
    const separator = line.indexOf(" ");
    const keyword = (
      separator === -1 ? line : line.slice(0, separator)
    ).toUpperCase();
    const value = separator === -1 ? "" : line.slice(separator + 1);

    if (keyword === "FROM") {
      const match = value.match(
        /^(?:--platform=\S+\s+)?\S+(?:\s+AS\s+([A-Za-z0-9_.-]+))?$/i,
      );
      if (match === null) {
        throw new Error(`Unsupported FROM instruction: ${line}`);
      }
      stages.push({ name: match[1]?.toLowerCase() ?? null, instructions: [] });
      continue;
    }

    const stage = stages.at(-1);
    if (stage === undefined) {
      throw new Error(`Instruction appears before the first FROM: ${line}`);
    }
    stage.instructions.push({ keyword, value });
  }

  return stages;
}

function parseExecRun(instruction: DockerInstruction): string[] | null {
  if (instruction.keyword !== "RUN" || !instruction.value.startsWith("[")) {
    return null;
  }

  try {
    const arguments_ = JSON.parse(instruction.value);
    return Array.isArray(arguments_) &&
      arguments_.every((argument) => typeof argument === "string")
      ? arguments_
      : null;
  } catch {
    return null;
  }
}

function isArtifactCheckRun(instruction: DockerInstruction): boolean {
  if (instruction.keyword !== "RUN") return false;

  const command = parseExecRun(instruction)?.join(" ") ?? instruction.value;
  return command.includes("discordhero:") && command.includes(":check");
}

function isExactExecRun(
  instruction: DockerInstruction,
  expected: readonly string[],
): boolean {
  return JSON.stringify(parseExecRun(instruction)) === JSON.stringify(expected);
}

function parseCopy(instruction: DockerInstruction): {
  from: string | null;
  source: string | null;
  destination: string | null;
} {
  const arguments_ = instruction.value.split(/\s+/);
  const from =
    arguments_
      .find((argument) => argument.toLowerCase().startsWith("--from="))
      ?.slice("--from=".length)
      .toLowerCase() ?? null;
  const paths = arguments_.filter((argument) => !argument.startsWith("--"));

  return {
    from,
    source: paths.length === 2 ? paths[0] : null,
    destination: paths.length === 2 ? paths[1] : null,
  };
}

function artifactGateErrors(source: string): string[] {
  const stages = parseDockerfile(source);
  const errors: string[] = [];
  const checkStages = stages.filter((stage) => stage.name === CHECK_STAGE);
  const finalStage = stages.at(-1);

  if (checkStages.length !== 1) {
    errors.push(`Dockerfile must define exactly one ${CHECK_STAGE} stage`);
  }
  if (finalStage === undefined || finalStage.name === CHECK_STAGE) {
    errors.push("Dockerfile must end with a separate default runtime stage");
  }

  const checkStage = checkStages[0];
  const finalCopies =
    finalStage?.instructions
      .filter((instruction) => instruction.keyword === "COPY")
      .map(parseCopy) ?? [];
  const verifiedCopies = finalCopies.filter(
    (copy) =>
      copy.from === CHECK_STAGE &&
      copy.source === STAMP_SOURCE &&
      copy.destination === STAMP_DESTINATION,
  );
  const stampCopies = finalCopies.filter(
    (copy) =>
      copy.source === STAMP_SOURCE || copy.destination === STAMP_DESTINATION,
  );

  if (verifiedCopies.length !== 1) {
    errors.push(
      `final default stage must COPY --from=${CHECK_STAGE} ${STAMP_SOURCE} ${STAMP_DESTINATION}`,
    );
  }
  if (
    stampCopies.length !== 1 ||
    stampCopies.some(
      (copy) =>
        copy.from !== CHECK_STAGE ||
        copy.source !== STAMP_SOURCE ||
        copy.destination !== STAMP_DESTINATION,
    )
  ) {
    errors.push(
      "final stamp must not come from the build context or another stage/path",
    );
  }

  if (checkStage !== undefined) {
    const checkRuns = checkStage.instructions
      .map((instruction, index) => ({ ...instruction, index }))
      .filter(isArtifactCheckRun);
    const actualChecks = checkRuns.map(parseExecRun);
    const stampRuns = checkStage.instructions
      .map((instruction, index) => ({ ...instruction, index }))
      .filter((instruction) => isExactExecRun(instruction, STAMP_RUN));

    if (JSON.stringify(actualChecks) !== JSON.stringify(EXPECTED_CHECKS)) {
      errors.push(
        `artifact checks must be exact exec-form RUNs in canonical order: ${EXPECTED_CHECKS.map((check) => JSON.stringify(check)).join(", ")}`,
      );
    }
    if (stampRuns.length !== 1) {
      errors.push(
        `${CHECK_STAGE} must create exactly one ${STAMP_SOURCE} stamp with exec-form RUN ${JSON.stringify(STAMP_RUN)}`,
      );
    } else if (
      checkRuns.length !== EXPECTED_CHECKS.length ||
      checkRuns.some((instruction) => instruction.index >= stampRuns[0]!.index)
    ) {
      errors.push(
        "verifier stamp must be created only after all four artifact checks",
      );
    }
  }

  const allStampRuns = stages.flatMap((stage) =>
    stage.instructions.filter((instruction) =>
      isExactExecRun(instruction, STAMP_RUN),
    ),
  );
  if (allStampRuns.length !== 1) {
    errors.push(
      "verifier stamp must be created exactly once across all stages",
    );
  }

  return errors;
}

function expectValidArtifactGate(source: string): void {
  expect(artifactGateErrors(source)).toEqual([]);
}

const STAMP_RUN_DOCKERFILE_LINE = `RUN ["/bin/sh", "-c", "printf 'verified\\\\n' > /artifact-check.verified"]`;
const VALID_DOCKERFILE = `
FROM oven/bun:1 AS catalog-check
RUN ["bun", "run", "discordhero:catalog:check"]
RUN ["bun", "run", "discordhero:achievements:check"]
RUN ["bun", "run", "discordhero:community-market:check"]
RUN ["bun", "run", "discordhero:community-content:check"]
${STAMP_RUN_DOCKERFILE_LINE}

FROM oven/bun:1
COPY --from=catalog-check /artifact-check.verified /app/.artifact-check.verified
CMD ["bun", "src/index.ts"]
`;
const SHELL_FORM_CHECKS_DOCKERFILE = VALID_DOCKERFILE.replace(
  'RUN ["bun", "run", "discordhero:catalog:check"]',
  "RUN bun run discordhero:catalog:check",
)
  .replace(
    'RUN ["bun", "run", "discordhero:achievements:check"]',
    "RUN bun run discordhero:achievements:check",
  )
  .replace(
    'RUN ["bun", "run", "discordhero:community-market:check"]',
    "RUN bun run discordhero:community-market:check",
  )
  .replace(
    'RUN ["bun", "run", "discordhero:community-content:check"]',
    "RUN bun run discordhero:community-content:check",
  );
const HOSTILE_SHELL_DOCKERFILE = SHELL_FORM_CHECKS_DOCKERFILE.replace(
  "FROM oven/bun:1 AS catalog-check",
  'FROM oven/bun:1 AS catalog-check\nSHELL ["/bin/true"]',
).replace(
  STAMP_RUN_DOCKERFILE_LINE,
  `SHELL ["/bin/sh", "-c"]\nRUN ${STAMP_COMMAND}`,
);
const EXEC_RUNS_WITH_SHELL_OVERRIDE_DOCKERFILE = VALID_DOCKERFILE.replace(
  "FROM oven/bun:1 AS catalog-check",
  'FROM oven/bun:1 AS catalog-check\nSHELL ["/bin/true"]',
).replace(
  STAMP_RUN_DOCKERFILE_LINE,
  `SHELL ["/bin/sh", "-c"]\n${STAMP_RUN_DOCKERFILE_LINE}`,
);

test("accepts only the canonical exec-form artifact-check dependency graph", () => {
  expectValidArtifactGate(VALID_DOCKERFILE);
});

test("accepts SHELL overrides around exact exec-form verifier runs", () => {
  expectValidArtifactGate(EXEC_RUNS_WITH_SHELL_OVERRIDE_DOCKERFILE);
});

test("rejects a SHELL override that turns shell-form checks into no-ops", () => {
  expect(artifactGateErrors(HOSTILE_SHELL_DOCKERFILE)).not.toEqual([]);
});

test.each([
  ["shell-form checks", SHELL_FORM_CHECKS_DOCKERFILE],
  [
    "mixed shell-form and exec-form checks",
    VALID_DOCKERFILE.replace(
      'RUN ["bun", "run", "discordhero:community-market:check"]',
      "RUN bun run discordhero:community-market:check",
    ),
  ],
  [
    "stamp before checks",
    VALID_DOCKERFILE.replace(
      'RUN ["bun", "run", "discordhero:catalog:check"]',
      `${STAMP_RUN_DOCKERFILE_LINE}\nRUN ["bun", "run", "discordhero:catalog:check"]`,
    ).replace(`\n${STAMP_RUN_DOCKERFILE_LINE}\n\nFROM`, "\n\nFROM"),
  ],
  [
    "checks out of canonical order",
    VALID_DOCKERFILE.replace(
      'RUN ["bun", "run", "discordhero:catalog:check"]\nRUN ["bun", "run", "discordhero:achievements:check"]',
      'RUN ["bun", "run", "discordhero:achievements:check"]\nRUN ["bun", "run", "discordhero:catalog:check"]',
    ),
  ],
  [
    "missing check",
    VALID_DOCKERFILE.replace(
      'RUN ["bun", "run", "discordhero:community-market:check"]\n',
      "",
    ),
  ],
  [
    "duplicate check after stamp",
    VALID_DOCKERFILE.replace(
      STAMP_RUN_DOCKERFILE_LINE,
      `${STAMP_RUN_DOCKERFILE_LINE}\nRUN ["bun", "run", "discordhero:catalog:check"]`,
    ),
  ],
  [
    "shell-form stamp",
    VALID_DOCKERFILE.replace(STAMP_RUN_DOCKERFILE_LINE, `RUN ${STAMP_COMMAND}`),
  ],
  [
    "stamp created in wrong stage",
    VALID_DOCKERFILE.replace(
      `${STAMP_RUN_DOCKERFILE_LINE}\n\nFROM`,
      "FROM",
    ).replace(
      "FROM oven/bun:1\n",
      `FROM oven/bun:1\n${STAMP_RUN_DOCKERFILE_LINE}\n`,
    ),
  ],
  [
    "stamp copied from wrong stage",
    VALID_DOCKERFILE.replace(
      "COPY --from=catalog-check /artifact-check.verified /app/.artifact-check.verified",
      "COPY --from=builder /artifact-check.verified /app/.artifact-check.verified",
    ),
  ],
  [
    "stamp copied from wrong path",
    VALID_DOCKERFILE.replace(
      "COPY --from=catalog-check /artifact-check.verified /app/.artifact-check.verified",
      "COPY --from=catalog-check /tmp/verified /app/.artifact-check.verified",
    ),
  ],
  [
    "stamp copied from unrelated build context",
    VALID_DOCKERFILE.replace(
      "COPY --from=catalog-check /artifact-check.verified /app/.artifact-check.verified",
      "COPY artifact-check.verified /app/.artifact-check.verified",
    ),
  ],
])("rejects %s", (_name, dockerfile) => {
  expect(artifactGateErrors(dockerfile as string)).not.toEqual([]);
});

test("the repository default runtime depends on the completed artifact checks", () => {
  const dockerfile = readFileSync(
    resolve(import.meta.dir, "..", "Dockerfile"),
    "utf8",
  );

  expectValidArtifactGate(dockerfile);
});
