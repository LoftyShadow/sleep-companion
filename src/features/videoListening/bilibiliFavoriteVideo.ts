import type { BilibiliCreatorVideo } from "./bilibiliCreator";
import type { BilibiliDirectAudioSource } from "./bilibiliDirectAudio";

export type BilibiliFavoriteVideoSource = "manual" | "creator" | "direct";

export interface BilibiliFavoriteVideo {
  aid?: string;
  addedAt: number;
  bvid: string;
  coverUrl?: string;
  durationSeconds?: number;
  playCount?: number;
  publishedAt?: number;
  source?: BilibiliFavoriteVideoSource;
  title: string;
  updatedAt: number;
}

export interface BilibiliFavoriteVideoInput {
  aid?: string;
  bvid: string;
  coverUrl?: string;
  durationSeconds?: number;
  playCount?: number;
  publishedAt?: number;
  source?: BilibiliFavoriteVideoSource;
  title: string;
}

export function createFavoriteVideoInputFromDirectSource(
  source: BilibiliDirectAudioSource,
): BilibiliFavoriteVideoInput {
  return {
    aid: source.aid,
    bvid: source.bvid,
    coverUrl: source.coverUrl,
    source: "direct",
    title: source.title,
  };
}

export function createFavoriteVideoInputFromCreatorVideo(
  video: BilibiliCreatorVideo,
): BilibiliFavoriteVideoInput {
  return {
    aid: video.aid,
    bvid: video.bvid,
    coverUrl: video.coverUrl,
    durationSeconds: video.durationSeconds,
    playCount: video.playCount,
    publishedAt: video.publishedAt,
    source: "creator",
    title: video.title,
  };
}
