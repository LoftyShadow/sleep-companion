import type { FileSystemPort } from "../storage/FileSystemPort";
import { indexedDbFileSystem } from "../storage/indexedDbFileSystem";
import type {
  BilibiliFavoriteVideo,
  BilibiliFavoriteVideoInput,
  BilibiliFavoriteVideoSource,
} from "./bilibiliFavoriteVideo";

const BILIBILI_FAVORITE_VIDEOS_PATH =
  "video-listening/bilibili-favorite-videos.json";
const BILIBILI_BVID_PATTERN = /^BV[0-9A-Za-z]+$/u;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isFavoriteVideoSource(
  value: unknown,
): value is BilibiliFavoriteVideoSource {
  return value === "manual" || value === "creator" || value === "direct";
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue : undefined;
}

function isStoredBilibiliFavoriteVideo(
  value: unknown,
): value is BilibiliFavoriteVideo {
  if (!value || typeof value !== "object") {
    return false;
  }

  const video = value as Partial<BilibiliFavoriteVideo>;

  return (
    typeof video.bvid === "string" &&
    BILIBILI_BVID_PATTERN.test(video.bvid.trim()) &&
    typeof video.title === "string" &&
    video.title.trim().length > 0 &&
    isFiniteNumber(video.addedAt) &&
    isFiniteNumber(video.updatedAt) &&
    (video.aid === undefined || typeof video.aid === "string") &&
    (video.coverUrl === undefined || typeof video.coverUrl === "string") &&
    (video.durationSeconds === undefined ||
      isFiniteNumber(video.durationSeconds)) &&
    (video.playCount === undefined || isFiniteNumber(video.playCount)) &&
    (video.publishedAt === undefined || isFiniteNumber(video.publishedAt)) &&
    (video.source === undefined || isFavoriteVideoSource(video.source))
  );
}

function sortFavoriteVideos(
  videos: readonly BilibiliFavoriteVideo[],
): BilibiliFavoriteVideo[] {
  return [...videos].sort((left, right) => right.updatedAt - left.updatedAt);
}

function normalizeFavoriteVideoInput(
  input: BilibiliFavoriteVideoInput,
  existingVideo: BilibiliFavoriteVideo | undefined,
  now: number,
): BilibiliFavoriteVideo {
  const bvid = input.bvid.trim();
  const title = input.title.trim() || existingVideo?.title || bvid;

  return {
    addedAt: existingVideo?.addedAt ?? now,
    aid: normalizeOptionalString(input.aid) ?? existingVideo?.aid,
    bvid,
    coverUrl: normalizeOptionalString(input.coverUrl) ?? existingVideo?.coverUrl,
    durationSeconds: input.durationSeconds ?? existingVideo?.durationSeconds,
    playCount: input.playCount ?? existingVideo?.playCount,
    publishedAt: input.publishedAt ?? existingVideo?.publishedAt,
    source: input.source ?? existingVideo?.source,
    title,
    updatedAt: now,
  };
}

async function loadRawFavoriteVideos(
  fs: FileSystemPort,
): Promise<BilibiliFavoriteVideo[]> {
  if (!(await fs.exists(BILIBILI_FAVORITE_VIDEOS_PATH))) {
    return [];
  }

  try {
    const value: unknown = JSON.parse(
      await fs.readText(BILIBILI_FAVORITE_VIDEOS_PATH),
    );
    if (!Array.isArray(value)) {
      return [];
    }

    return sortFavoriteVideos(value.filter(isStoredBilibiliFavoriteVideo));
  } catch {
    return [];
  }
}

async function saveRawFavoriteVideos(
  videos: readonly BilibiliFavoriteVideo[],
  fs: FileSystemPort,
): Promise<void> {
  await fs.writeText(
    BILIBILI_FAVORITE_VIDEOS_PATH,
    JSON.stringify(sortFavoriteVideos(videos)),
  );
}

export async function listBilibiliFavoriteVideos(
  fs: FileSystemPort = indexedDbFileSystem,
): Promise<BilibiliFavoriteVideo[]> {
  return loadRawFavoriteVideos(fs);
}

export async function upsertBilibiliFavoriteVideo(
  input: BilibiliFavoriteVideoInput,
  fs: FileSystemPort = indexedDbFileSystem,
  now = Date.now(),
): Promise<BilibiliFavoriteVideo> {
  const bvid = input.bvid.trim();
  if (!BILIBILI_BVID_PATTERN.test(bvid)) {
    throw new Error("收藏视频缺少有效 BV 号");
  }

  const favoriteVideos = await loadRawFavoriteVideos(fs);
  const existingVideo = favoriteVideos.find((video) => video.bvid === bvid);
  const nextVideo = normalizeFavoriteVideoInput(input, existingVideo, now);
  const nextVideos = existingVideo
    ? favoriteVideos.map((video) =>
        video.bvid === nextVideo.bvid ? nextVideo : video,
      )
    : [nextVideo, ...favoriteVideos];

  await saveRawFavoriteVideos(nextVideos, fs);

  return nextVideo;
}

export async function deleteBilibiliFavoriteVideo(
  bvid: string,
  fs: FileSystemPort = indexedDbFileSystem,
): Promise<BilibiliFavoriteVideo[]> {
  const favoriteVideos = await loadRawFavoriteVideos(fs);
  const nextVideos = favoriteVideos.filter((video) => video.bvid !== bvid.trim());

  await saveRawFavoriteVideos(nextVideos, fs);

  return nextVideos;
}
