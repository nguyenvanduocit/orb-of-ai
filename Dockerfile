# Validate committed DiscordHero artifacts from pinned sources without carrying
# those source files into the runtime image.
FROM oven/bun:1 AS catalog-check

WORKDIR /check
COPY package.json ./
COPY scripts/discordhero-catalog.ts ./scripts/discordhero-catalog.ts
COPY scripts/discordhero-achievements.ts ./scripts/discordhero-achievements.ts
COPY scripts/discordhero-community-market.ts ./scripts/discordhero-community-market.ts
COPY scripts/discordhero-community-content.ts ./scripts/discordhero-community-content.ts
COPY src/discord-hero/catalog ./src/discord-hero/catalog
COPY src/discord-hero/community-achievements ./src/discord-hero/community-achievements
COPY src/discord-hero/community-market ./src/discord-hero/community-market
COPY src/discord-hero/community-content ./src/discord-hero/community-content
COPY preferences/taskbarhero/manifest.json ./preferences/taskbarhero/manifest.json
COPY preferences/taskbarhero/achievements.md ./preferences/taskbarhero/achievements.md
COPY preferences/taskbarhero/market.md ./preferences/taskbarhero/market.md
COPY preferences/taskbarhero/market ./preferences/taskbarhero/market
COPY preferences/taskbarhero/builds.md ./preferences/taskbarhero/builds.md
COPY preferences/taskbarhero/builds ./preferences/taskbarhero/builds
COPY preferences/taskbarhero/tier-lists.md ./preferences/taskbarhero/tier-lists.md
COPY preferences/taskbarhero/tier-lists ./preferences/taskbarhero/tier-lists
COPY preferences/taskbarhero/guides.md ./preferences/taskbarhero/guides.md
COPY preferences/taskbarhero/guides ./preferences/taskbarhero/guides
COPY preferences/taskbarhero/news.md ./preferences/taskbarhero/news.md
COPY preferences/taskbarhero/news ./preferences/taskbarhero/news
COPY preferences/taskbarhero/raw-data ./preferences/taskbarhero/raw-data
COPY assets/discordhero/catalog.json ./assets/discordhero/catalog.json
COPY assets/discordhero/community-achievements.json ./assets/discordhero/community-achievements.json
COPY assets/discordhero/community-market.json ./assets/discordhero/community-market.json
COPY assets/discordhero/community-content.json ./assets/discordhero/community-content.json
RUN ["bun", "run", "discordhero:catalog:check"]
RUN ["bun", "run", "discordhero:achievements:check"]
RUN ["bun", "run", "discordhero:community-market:check"]
RUN ["bun", "run", "discordhero:community-content:check"]
RUN ["/bin/sh", "-c", "printf 'verified\\n' > /artifact-check.verified"]

# Orb Of AI — Bun runtime + Claude Code CLI (agent.ts exits at startup without it).
FROM oven/bun:1

WORKDIR /app
COPY --from=catalog-check /artifact-check.verified /app/.artifact-check.verified

# Claude Code native binary — self-contained, no node needed. git for the CLI's
# workspace niceties; curl/ca-certificates for the installer and runtime fetches.
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates git unzip \
  && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://claude.ai/install.sh | bash
ENV CLAUDE_PATH=/root/.local/bin/claude

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY src ./src
COPY template ./template
# assets/items/*.png are served at runtime by the /rpg web page (src/server.ts);
# assets/cards/* ride along (tiny) though they're only used by the one-time emoji upload.
COPY assets ./assets

# data/ is the Fly volume mount point (fly.toml [mounts]); never baked into the image.
CMD ["bun", "src/index.ts"]
