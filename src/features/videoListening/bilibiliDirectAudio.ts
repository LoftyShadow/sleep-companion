import type { BilibiliVideoReference } from "./bilibiliVideo";
import {
  createSafeTauriInvoke,
  hasTauriInvoke,
  type InvokeFn,
} from "./tauriInvoke";

export interface BilibiliDirectAudioSource {
  aid: string;
  audioUrl: string;
  backupUrls: string[];
  bandwidth?: number;
  bvid: string;
  chapters: BilibiliDirectAudioChapter[];
  cid: string;
  codecs?: string;
  coverUrl?: string;
  durationSeconds?: number;
  expiresAt?: number;
  mimeType?: string;
  title: string;
  videoBackupUrls: string[];
  videoBandwidth?: number;
  videoCodecs?: string;
  videoHeight?: number;
  videoMimeType?: string;
  videoTracks: BilibiliDirectVideoTrack[];
  videoUrl?: string;
  videoWidth?: number;
}

export interface BilibiliDirectAudioChapter {
  content: string;
  fromSeconds: number;
  imageUrl?: string;
  toSeconds?: number;
}

export interface BilibiliDirectVideoTrack {
  backupUrls: string[];
  bandwidth?: number;
  codecs?: string;
  height?: number;
  id: string;
  label: string;
  mimeType?: string;
  url: string;
  width?: number;
}

export type BilibiliDirectAudioReference = Extract<
  BilibiliVideoReference,
  { kind: "aid" | "bvid" }
>;

export type BilibiliDirectAudioLoader = (
  reference: BilibiliDirectAudioReference,
) => Promise<BilibiliDirectAudioSource>;

const DEFAULT_WEB_DIRECT_AUDIO_API_BASE_URL = "";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function isDirectAudioSource(
  value: unknown,
): value is BilibiliDirectAudioSource {
  const source = asRecord(value);

  return (
    Boolean(source) &&
    typeof source?.aid === "string" &&
    source.aid.trim().length > 0 &&
    typeof source.audioUrl === "string" &&
    source.audioUrl.trim().length > 0 &&
    Array.isArray(source.backupUrls) &&
    source.backupUrls.every((url) => typeof url === "string") &&
    typeof source.bvid === "string" &&
    source.bvid.trim().length > 0 &&
    (source.chapters === undefined ||
      (Array.isArray(source.chapters) &&
        source.chapters.every(isDirectAudioChapter))) &&
    typeof source.cid === "string" &&
    source.cid.trim().length > 0 &&
    typeof source.title === "string" &&
    source.title.trim().length > 0 &&
    (source.bandwidth === undefined || typeof source.bandwidth === "number") &&
    (source.codecs === undefined || typeof source.codecs === "string") &&
    (source.coverUrl === undefined || typeof source.coverUrl === "string") &&
    (source.durationSeconds === undefined ||
      typeof source.durationSeconds === "number") &&
    (source.expiresAt === undefined || typeof source.expiresAt === "number") &&
    (source.mimeType === undefined || typeof source.mimeType === "string") &&
    (source.videoBackupUrls === undefined ||
      (Array.isArray(source.videoBackupUrls) &&
        source.videoBackupUrls.every((url) => typeof url === "string"))) &&
    (source.videoBandwidth === undefined ||
      typeof source.videoBandwidth === "number") &&
    (source.videoCodecs === undefined ||
      typeof source.videoCodecs === "string") &&
    (source.videoHeight === undefined ||
      typeof source.videoHeight === "number") &&
    (source.videoMimeType === undefined ||
      typeof source.videoMimeType === "string") &&
    (source.videoTracks === undefined ||
      (Array.isArray(source.videoTracks) &&
        source.videoTracks.every(isDirectVideoTrack))) &&
    (source.videoUrl === undefined || typeof source.videoUrl === "string") &&
    (source.videoWidth === undefined || typeof source.videoWidth === "number")
  );
}

function isDirectAudioChapter(
  value: unknown,
): value is BilibiliDirectAudioChapter {
  const chapter = asRecord(value);

  return (
    Boolean(chapter) &&
    typeof chapter?.content === "string" &&
    chapter.content.trim().length > 0 &&
    typeof chapter.fromSeconds === "number" &&
    Number.isFinite(chapter.fromSeconds) &&
    (chapter.imageUrl === undefined || typeof chapter.imageUrl === "string") &&
    (chapter.toSeconds === undefined ||
      (typeof chapter.toSeconds === "number" &&
        Number.isFinite(chapter.toSeconds)))
  );
}

function isDirectVideoTrack(value: unknown): value is BilibiliDirectVideoTrack {
  const track = asRecord(value);

  return (
    Boolean(track) &&
    Array.isArray(track?.backupUrls) &&
    track.backupUrls.every((url) => typeof url === "string") &&
    (track.bandwidth === undefined || typeof track.bandwidth === "number") &&
    (track.codecs === undefined || typeof track.codecs === "string") &&
    (track.height === undefined || typeof track.height === "number") &&
    typeof track.id === "string" &&
    track.id.trim().length > 0 &&
    typeof track.label === "string" &&
    track.label.trim().length > 0 &&
    (track.mimeType === undefined || typeof track.mimeType === "string") &&
    typeof track.url === "string" &&
    track.url.trim().length > 0 &&
    (track.width === undefined || typeof track.width === "number")
  );
}

function normalizeDirectAudioChapter(
  value: BilibiliDirectAudioChapter,
): BilibiliDirectAudioChapter {
  return {
    content: value.content.trim(),
    fromSeconds: Math.max(0, Math.floor(value.fromSeconds)),
    imageUrl: value.imageUrl?.trim(),
    toSeconds:
      value.toSeconds === undefined
        ? undefined
        : Math.max(0, Math.floor(value.toSeconds)),
  };
}

function normalizeDirectVideoTrack(
  value: BilibiliDirectVideoTrack,
): BilibiliDirectVideoTrack {
  return {
    backupUrls: value.backupUrls
      .map((url) => url.trim())
      .filter((url) => url.length > 0),
    bandwidth: value.bandwidth,
    codecs: value.codecs,
    height: value.height,
    id: value.id.trim(),
    label: value.label.trim(),
    mimeType: value.mimeType,
    url: value.url.trim(),
    width: value.width,
  };
}

function fallbackDirectVideoTrack(
  value: BilibiliDirectAudioSource,
): BilibiliDirectVideoTrack[] {
  const videoUrl = value.videoUrl?.trim();
  if (!videoUrl) {
    return [];
  }

  return [
    {
      backupUrls: (value.videoBackupUrls ?? [])
        .map((url) => url.trim())
        .filter((url) => url.length > 0),
      bandwidth: value.videoBandwidth,
      codecs: value.videoCodecs,
      height: value.videoHeight,
      id: "default",
      label: value.videoHeight ? `${value.videoHeight}p` : "默认画质",
      mimeType: value.videoMimeType,
      url: videoUrl,
      width: value.videoWidth,
    },
  ];
}

function normalizeDirectAudioSource(
  value: unknown,
): BilibiliDirectAudioSource {
  if (!isDirectAudioSource(value)) {
    throw new Error("B 站直连音频响应格式不正确");
  }

  return {
    aid: value.aid.trim(),
    audioUrl: value.audioUrl.trim(),
    backupUrls: value.backupUrls
      .map((url) => url.trim())
      .filter((url) => url.length > 0),
    bandwidth: value.bandwidth,
    bvid: value.bvid.trim(),
    chapters: (value.chapters ?? [])
      .map(normalizeDirectAudioChapter)
      .filter((chapter) => chapter.content.length > 0)
      .sort((left, right) => left.fromSeconds - right.fromSeconds),
    cid: value.cid.trim(),
    codecs: value.codecs,
    coverUrl: value.coverUrl,
    durationSeconds:
      value.durationSeconds === undefined
        ? undefined
        : Math.max(0, Math.floor(value.durationSeconds)),
    expiresAt: value.expiresAt,
    mimeType: value.mimeType,
    title: value.title.trim(),
    videoBackupUrls: (value.videoBackupUrls ?? [])
      .map((url) => url.trim())
      .filter((url) => url.length > 0),
    videoBandwidth: value.videoBandwidth,
    videoCodecs: value.videoCodecs,
    videoHeight: value.videoHeight,
    videoMimeType: value.videoMimeType,
    videoTracks:
      value.videoTracks === undefined
        ? fallbackDirectVideoTrack(value)
        : value.videoTracks.map(normalizeDirectVideoTrack),
    videoUrl: value.videoUrl?.trim(),
    videoWidth: value.videoWidth,
  };
}

function normalizeWebDirectAudioApiBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/u, "");
}

function readWebDirectAudioApiBaseUrl(): string {
  const env = import.meta.env as { VITE_BILIBILI_API_BASE_URL?: string };

  return env.VITE_BILIBILI_API_BASE_URL ?? DEFAULT_WEB_DIRECT_AUDIO_API_BASE_URL;
}

function directAudioApiUrl(
  baseUrl: string,
  reference: BilibiliVideoReference,
): string {
  const normalizedBaseUrl = normalizeWebDirectAudioApiBaseUrl(baseUrl);
  const searchParams = new URLSearchParams({
    kind: reference.kind,
    value: reference.value,
  });

  return `${normalizedBaseUrl}/api/bilibili/direct-audio?${searchParams.toString()}`;
}

async function parseWebDirectAudioResponse(response: Response): Promise<unknown> {
  const responseText = await response.text();
  const responseValue: unknown = responseText
    ? (JSON.parse(responseText) as unknown)
    : null;
  if (response.ok) {
    return responseValue;
  }

  const responseRecord = asRecord(responseValue);
  const message =
    typeof responseRecord?.message === "string"
      ? responseRecord.message
      : `Web API 解析 B 站直连音频失败：HTTP ${response.status}`;

  throw new Error(message);
}

export function createBilibiliDirectAudioLoader(
  invoke: InvokeFn = createSafeTauriInvoke("当前环境不能解析 B 站直连音频"),
): BilibiliDirectAudioLoader {
  return async (reference) => {
    const response = await invoke("resolve_bilibili_direct_audio", {
      reference,
    });

    return normalizeDirectAudioSource(response);
  };
}

export function createBilibiliDirectAudioWebLoader(
  baseUrl: string = readWebDirectAudioApiBaseUrl(),
): BilibiliDirectAudioLoader {
  return async (reference) => {
    const response = await fetch(directAudioApiUrl(baseUrl, reference), {
      headers: {
        "Content-Type": "application/json",
      },
    });

    return normalizeDirectAudioSource(await parseWebDirectAudioResponse(response));
  };
}

export function createRuntimeBilibiliDirectAudioLoader(): BilibiliDirectAudioLoader {
  if (hasTauriInvoke()) {
    return createBilibiliDirectAudioLoader();
  }

  return createBilibiliDirectAudioWebLoader();
}

export const loadBilibiliDirectAudio =
  createRuntimeBilibiliDirectAudioLoader();
