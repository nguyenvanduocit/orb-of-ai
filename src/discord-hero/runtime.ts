import type { DiscordHeroCatalog } from "./catalog/compiler";
import {
  buildCatalogIndexes,
  type DiscordHeroCatalogIndexes,
} from "./catalog/indexes";
import { loadDiscordHeroCatalog } from "./catalog/loader";
import {
  loadDiscordHeroCommunityAchievements,
  type LoadedDiscordHeroCommunityAchievements,
} from "./community-achievements/loader";
import {
  loadDiscordHeroCommunityContent,
  type LoadedDiscordHeroCommunityContent,
} from "./community-content/loader";
import {
  loadDiscordHeroCommunityMarket,
  type LoadedDiscordHeroCommunityMarket,
} from "./community-market/loader";
import {
  openDiscordHeroRepository,
  type DiscordHeroRepository,
} from "./state/repository";

export interface DiscordHeroRuntime {
  catalog: DiscordHeroCatalog;
  communityAchievements: LoadedDiscordHeroCommunityAchievements;
  communityContent: LoadedDiscordHeroCommunityContent;
  communityMarket: LoadedDiscordHeroCommunityMarket;
  indexes: DiscordHeroCatalogIndexes;
  repository: DiscordHeroRepository;
}

let runtimePromise: Promise<DiscordHeroRuntime> | null = null;

async function createRuntime(): Promise<DiscordHeroRuntime> {
  const [catalog, communityAchievements, communityContent, communityMarket] =
    await Promise.all([
      loadDiscordHeroCatalog(),
      loadDiscordHeroCommunityAchievements(),
      loadDiscordHeroCommunityContent(),
      loadDiscordHeroCommunityMarket(),
    ]);
  const indexes = buildCatalogIndexes(catalog);
  const repository = openDiscordHeroRepository({
    catalogDigest: catalog.provenance.compiledSha256,
  });
  return {
    catalog,
    communityAchievements,
    communityContent,
    communityMarket,
    indexes,
    repository,
  };
}

export function getDiscordHeroRuntime(): Promise<DiscordHeroRuntime> {
  runtimePromise ??= createRuntime().catch((error) => {
    runtimePromise = null;
    throw error;
  });
  return runtimePromise;
}

export async function closeDiscordHeroRuntime(): Promise<void> {
  const pending = runtimePromise;
  runtimePromise = null;
  if (pending === null) return;
  const runtime = await pending;
  runtime.repository.close();
}
