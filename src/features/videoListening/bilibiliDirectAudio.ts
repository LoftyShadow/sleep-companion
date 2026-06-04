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
  cid: string;
  codecs?: string;
  coverUrl?: string;
  expiresAt?: number;
  mimeType?: string;
  title: string;
  videoBackupUrls: string[];
  videoBandwidth?: number;
  videoCodecs?: string;
  videoHeight?: number;
  videoMimeType?: string;
  videoUrl?: string;
  videoWidth?: number;
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
    typeof source.cid === "string" &&
    source.cid.trim().length > 0 &&
    typeof source.title === "string" &&
    source.title.trim().length > 0 &&
    (source.bandwidth === undefined || typeof source.bandwidth === "number") &&
    (source.codecs === undefined || typeof source.codecs === "string") &&
    (source.coverUrl === undefined || typeof source.coverUrl === "string") &&
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
    (source.videoUrl === undefined || typeof source.videoUrl === "string") &&
    (source.videoWidth === undefined || typeof source.videoWidth === "number")
  );
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
    cid: value.cid.trim(),
    codecs: value.codecs,
    coverUrl: value.coverUrl,
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
