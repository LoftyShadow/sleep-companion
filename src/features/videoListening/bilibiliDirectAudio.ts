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

function isNil(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

function isOptionalString(value: unknown): boolean {
  return isNil(value) || typeof value === "string";
}

function isOptionalNumber(value: unknown): boolean {
  return isNil(value) || typeof value === "number";
}

function optionalString(value: string | null | undefined): string | undefined {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function optionalNumber(value: number | null | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
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
    (isNil(source.chapters) ||
      (Array.isArray(source.chapters) &&
        source.chapters.every(isDirectAudioChapter))) &&
    typeof source.cid === "string" &&
    source.cid.trim().length > 0 &&
    typeof source.title === "string" &&
    source.title.trim().length > 0 &&
    isOptionalNumber(source.bandwidth) &&
    isOptionalString(source.codecs) &&
    isOptionalString(source.coverUrl) &&
    isOptionalNumber(source.durationSeconds) &&
    isOptionalNumber(source.expiresAt) &&
    isOptionalString(source.mimeType) &&
    (isNil(source.videoBackupUrls) ||
      (Array.isArray(source.videoBackupUrls) &&
        source.videoBackupUrls.every((url) => typeof url === "string"))) &&
    isOptionalNumber(source.videoBandwidth) &&
    isOptionalString(source.videoCodecs) &&
    isOptionalNumber(source.videoHeight) &&
    isOptionalString(source.videoMimeType) &&
    (isNil(source.videoTracks) ||
      (Array.isArray(source.videoTracks) &&
        source.videoTracks.every(isDirectVideoTrack))) &&
    isOptionalString(source.videoUrl) &&
    isOptionalNumber(source.videoWidth)
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
    isOptionalString(chapter.imageUrl) &&
    (isNil(chapter.toSeconds) ||
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
    isOptionalNumber(track.bandwidth) &&
    isOptionalString(track.codecs) &&
    isOptionalNumber(track.height) &&
    typeof track.id === "string" &&
    track.id.trim().length > 0 &&
    typeof track.label === "string" &&
    track.label.trim().length > 0 &&
    isOptionalString(track.mimeType) &&
    typeof track.url === "string" &&
    track.url.trim().length > 0 &&
    isOptionalNumber(track.width)
  );
}

function normalizeDirectAudioChapter(
  value: BilibiliDirectAudioChapter,
): BilibiliDirectAudioChapter {
  return {
    content: value.content.trim(),
    fromSeconds: Math.max(0, Math.floor(value.fromSeconds)),
    imageUrl: optionalString(value.imageUrl),
    toSeconds:
      isNil(value.toSeconds)
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
    bandwidth: optionalNumber(value.bandwidth),
    codecs: optionalString(value.codecs),
    height: optionalNumber(value.height),
    id: value.id.trim(),
    label: value.label.trim(),
    mimeType: optionalString(value.mimeType),
    url: value.url.trim(),
    width: optionalNumber(value.width),
  };
}

function fallbackDirectVideoTrack(
  value: BilibiliDirectAudioSource,
): BilibiliDirectVideoTrack[] {
  const videoUrl = optionalString(value.videoUrl);
  if (!videoUrl) {
    return [];
  }

  const videoHeight = optionalNumber(value.videoHeight);

  return [
    {
      backupUrls: (value.videoBackupUrls ?? [])
        .map((url) => url.trim())
        .filter((url) => url.length > 0),
      bandwidth: optionalNumber(value.videoBandwidth),
      codecs: optionalString(value.videoCodecs),
      height: videoHeight,
      id: "default",
      label: videoHeight ? `${videoHeight}p` : "默认画质",
      mimeType: optionalString(value.videoMimeType),
      url: videoUrl,
      width: optionalNumber(value.videoWidth),
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
    bandwidth: optionalNumber(value.bandwidth),
    bvid: value.bvid.trim(),
    chapters: (value.chapters ?? [])
      .map(normalizeDirectAudioChapter)
      .filter((chapter) => chapter.content.length > 0)
      .sort((left, right) => left.fromSeconds - right.fromSeconds),
    cid: value.cid.trim(),
    codecs: optionalString(value.codecs),
    coverUrl: optionalString(value.coverUrl),
    durationSeconds:
      isNil(value.durationSeconds)
        ? undefined
        : Math.max(0, Math.floor(value.durationSeconds)),
    expiresAt: optionalNumber(value.expiresAt),
    mimeType: optionalString(value.mimeType),
    title: value.title.trim(),
    videoBackupUrls: (value.videoBackupUrls ?? [])
      .map((url) => url.trim())
      .filter((url) => url.length > 0),
    videoBandwidth: optionalNumber(value.videoBandwidth),
    videoCodecs: optionalString(value.videoCodecs),
    videoHeight: optionalNumber(value.videoHeight),
    videoMimeType: optionalString(value.videoMimeType),
    videoTracks:
      isNil(value.videoTracks)
        ? fallbackDirectVideoTrack(value)
        : value.videoTracks.map(normalizeDirectVideoTrack),
    videoUrl: optionalString(value.videoUrl),
    videoWidth: optionalNumber(value.videoWidth),
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
