import type { FileSystemPort } from "../storage/FileSystemPort";
import { indexedDbFileSystem } from "../storage/indexedDbFileSystem";
import type { BilibiliCreator, BilibiliCreatorProfile } from "./bilibiliCreator";

const BILIBILI_CREATORS_PATH = "video-listening/bilibili-creators.json";

function isStoredBilibiliCreator(value: unknown): value is BilibiliCreator {
  if (!value || typeof value !== "object") {
    return false;
  }

  const creator = value as Partial<BilibiliCreator>;

  return (
    typeof creator.mid === "string" &&
    /^\d+$/u.test(creator.mid) &&
    typeof creator.name === "string" &&
    creator.name.trim().length > 0 &&
    typeof creator.addedAt === "number" &&
    Number.isFinite(creator.addedAt) &&
    typeof creator.updatedAt === "number" &&
    Number.isFinite(creator.updatedAt) &&
    (creator.avatarUrl === undefined || typeof creator.avatarUrl === "string") &&
    (creator.lastFetchedAt === undefined ||
      (typeof creator.lastFetchedAt === "number" &&
        Number.isFinite(creator.lastFetchedAt)))
  );
}

function sortCreators(creators: readonly BilibiliCreator[]): BilibiliCreator[] {
  return [...creators].sort((left, right) => right.updatedAt - left.updatedAt);
}

async function loadRawCreators(fs: FileSystemPort): Promise<BilibiliCreator[]> {
  if (!(await fs.exists(BILIBILI_CREATORS_PATH))) {
    return [];
  }

  try {
    const value: unknown = JSON.parse(await fs.readText(BILIBILI_CREATORS_PATH));
    if (!Array.isArray(value)) {
      return [];
    }

    return sortCreators(value.filter(isStoredBilibiliCreator));
  } catch {
    return [];
  }
}

async function saveRawCreators(
  creators: readonly BilibiliCreator[],
  fs: FileSystemPort,
): Promise<void> {
  await fs.writeText(BILIBILI_CREATORS_PATH, JSON.stringify(sortCreators(creators)));
}

export async function listBilibiliCreators(
  fs: FileSystemPort = indexedDbFileSystem,
): Promise<BilibiliCreator[]> {
  return loadRawCreators(fs);
}

export async function upsertBilibiliCreator(
  profile: BilibiliCreatorProfile,
  fs: FileSystemPort = indexedDbFileSystem,
  now = Date.now(),
): Promise<BilibiliCreator> {
  const creators = await loadRawCreators(fs);
  const existingCreator = creators.find((creator) => creator.mid === profile.mid);
  const nextCreator: BilibiliCreator = {
    addedAt: existingCreator?.addedAt ?? now,
    avatarUrl: profile.avatarUrl,
    lastFetchedAt: existingCreator?.lastFetchedAt,
    mid: profile.mid,
    name: profile.name.trim() || existingCreator?.name || `UP ${profile.mid}`,
    updatedAt: now,
  };
  const nextCreators = existingCreator
    ? creators.map((creator) =>
        creator.mid === nextCreator.mid ? nextCreator : creator,
      )
    : [nextCreator, ...creators];

  await saveRawCreators(nextCreators, fs);

  return nextCreator;
}

export async function markBilibiliCreatorFetched(
  mid: string,
  profile: BilibiliCreatorProfile,
  fs: FileSystemPort = indexedDbFileSystem,
  now = Date.now(),
): Promise<BilibiliCreator> {
  const creators = await loadRawCreators(fs);
  const existingCreator = creators.find((creator) => creator.mid === mid);
  const nextCreator: BilibiliCreator = {
    addedAt: existingCreator?.addedAt ?? now,
    avatarUrl: profile.avatarUrl ?? existingCreator?.avatarUrl,
    lastFetchedAt: now,
    mid,
    name: profile.name.trim() || existingCreator?.name || `UP ${mid}`,
    updatedAt: now,
  };
  const nextCreators = existingCreator
    ? creators.map((creator) =>
        creator.mid === nextCreator.mid ? nextCreator : creator,
      )
    : [nextCreator, ...creators];

  await saveRawCreators(nextCreators, fs);

  return nextCreator;
}

export async function deleteBilibiliCreator(
  mid: string,
  fs: FileSystemPort = indexedDbFileSystem,
): Promise<BilibiliCreator[]> {
  const creators = await loadRawCreators(fs);
  const nextCreators = creators.filter((creator) => creator.mid !== mid);

  await saveRawCreators(nextCreators, fs);

  return nextCreators;
}
