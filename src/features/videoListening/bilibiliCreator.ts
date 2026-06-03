import {
  createSafeTauriInvoke,
  hasTauriInvoke,
  type InvokeFn,
} from "./tauriInvoke";

export interface BilibiliCreatorProfile {
  mid: string;
  name: string;
  avatarUrl?: string;
}

export interface BilibiliCreator extends BilibiliCreatorProfile {
  addedAt: number;
  updatedAt: number;
  lastFetchedAt?: number;
}

export interface BilibiliCreatorVideo {
  aid?: string;
  bvid: string;
  title: string;
  coverUrl?: string;
  publishedAt: number;
  durationSeconds?: number;
  playCount?: number;
}

export interface BilibiliCreatorVideos {
  creator: BilibiliCreatorProfile;
  videos: BilibiliCreatorVideo[];
}

export type BilibiliCreatorVideosLoader = (
  mid: string,
  limit?: number,
) => Promise<BilibiliCreatorVideos>;

export interface BilibiliBrowserFingerprint {
  dmCoverImgStr: string;
  dmImgInter: string;
  dmImgList: string;
  dmImgStr: string;
}

const BILIBILI_HOST_PATTERN = /(^|\.)bilibili\.com$/iu;
const SPACE_PATH_MID_PATTERN = /^\/(?:space\/)?(\d+)(?:\/|$)/iu;
const DIRECT_MID_PATTERN = /^\d+$/u;
const DEFAULT_WEB_API_BASE_URL = "";

function isSupportedBilibiliHost(hostname: string): boolean {
  const normalizedHost = hostname.toLowerCase();

  return BILIBILI_HOST_PATTERN.test(normalizedHost);
}

function isBilibiliCreatorVideo(value: unknown): value is BilibiliCreatorVideo {
  if (!value || typeof value !== "object") {
    return false;
  }

  const video = value as Partial<BilibiliCreatorVideo>;

  return (
    typeof video.bvid === "string" &&
    video.bvid.trim().startsWith("BV") &&
    typeof video.title === "string" &&
    video.title.trim().length > 0 &&
    typeof video.publishedAt === "number" &&
    Number.isFinite(video.publishedAt) &&
    (video.aid === undefined || typeof video.aid === "string") &&
    (video.coverUrl === undefined || typeof video.coverUrl === "string") &&
    (video.durationSeconds === undefined ||
      typeof video.durationSeconds === "number") &&
    (video.playCount === undefined || typeof video.playCount === "number")
  );
}

function isBilibiliCreatorProfile(
  value: unknown,
): value is BilibiliCreatorProfile {
  if (!value || typeof value !== "object") {
    return false;
  }

  const creator = value as Partial<BilibiliCreatorProfile>;

  return (
    typeof creator.mid === "string" &&
    DIRECT_MID_PATTERN.test(creator.mid.trim()) &&
    typeof creator.name === "string" &&
    creator.name.trim().length > 0 &&
    (creator.avatarUrl === undefined || typeof creator.avatarUrl === "string")
  );
}

function isBilibiliCreatorVideos(
  value: unknown,
): value is BilibiliCreatorVideos {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Partial<BilibiliCreatorVideos>;

  return (
    isBilibiliCreatorProfile(response.creator) &&
    Array.isArray(response.videos) &&
    response.videos.every(isBilibiliCreatorVideo)
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function base64EncodeUtf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binaryText = "";
  bytes.forEach((byte) => {
    binaryText += String.fromCharCode(byte);
  });

  return btoa(binaryText);
}

function readWebglFingerprint(): {
  renderer: string;
  vendor: string;
  version: string;
} {
  if (navigator.userAgent.toLowerCase().includes("jsdom")) {
    return {
      renderer: "Chromium",
      vendor: "Google Inc.",
      version: "WebGL 1.0 (OpenGL ES 2.0 Chromium)",
    };
  }

  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl");
  if (!gl) {
    return {
      renderer: "Chromium",
      vendor: "Google Inc.",
      version: "WebGL 1.0 (OpenGL ES 2.0 Chromium)",
    };
  }

  const webgl = gl as WebGLRenderingContext;
  const debugInfo = webgl.getExtension("WEBGL_debug_renderer_info");
  const version = String(webgl.getParameter(webgl.VERSION));
  const vendor = debugInfo
    ? String(webgl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL))
    : String(webgl.getParameter(webgl.VENDOR));
  const renderer = debugInfo
    ? String(webgl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL))
    : String(webgl.getParameter(webgl.RENDERER));

  return { renderer, vendor, version };
}

export function createBilibiliBrowserFingerprint(): BilibiliBrowserFingerprint {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return {
      dmCoverImgStr: base64EncodeUtf8("ANGLE (Google, Chromium)Google Inc."),
      dmImgInter: "{\"ds\":[],\"wh\":[1920,1080,1],\"of\":[0,0,0]}",
      dmImgList: "[]",
      dmImgStr: base64EncodeUtf8("WebGL 1.0 (OpenGL ES 2.0 Chromium)"),
    };
  }

  const { renderer, vendor, version } = readWebglFingerprint();
  const devicePixelRatio = Number.isFinite(window.devicePixelRatio)
    ? window.devicePixelRatio
    : 1;
  const screenWidth = Math.max(1, Math.round(window.screen?.width ?? 1920));
  const screenHeight = Math.max(1, Math.round(window.screen?.height ?? 1080));

  return {
    dmCoverImgStr: base64EncodeUtf8(`${renderer}${vendor}`),
    dmImgInter: JSON.stringify({
      ds: [],
      wh: [screenWidth, screenHeight, Math.round(devicePixelRatio * 100)],
      of: [0, 0, 0],
    }),
    dmImgList: "[]",
    dmImgStr: base64EncodeUtf8(version),
  };
}

function normalizeWebApiBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/u, "");
}

function readWebApiBaseUrl(): string {
  const env = import.meta.env as { VITE_BILIBILI_API_BASE_URL?: string };

  return env.VITE_BILIBILI_API_BASE_URL ?? DEFAULT_WEB_API_BASE_URL;
}

function creatorVideosApiUrl(
  baseUrl: string,
  mid: string,
  limit?: number,
): string {
  const normalizedBaseUrl = normalizeWebApiBaseUrl(baseUrl);
  const searchParams = new URLSearchParams({ mid });
  if (limit !== undefined) {
    searchParams.set("limit", limit.toString());
  }
  const fingerprint = createBilibiliBrowserFingerprint();
  searchParams.set("dmImgList", fingerprint.dmImgList);
  searchParams.set("dmImgStr", fingerprint.dmImgStr);
  searchParams.set("dmCoverImgStr", fingerprint.dmCoverImgStr);
  searchParams.set("dmImgInter", fingerprint.dmImgInter);

  return `${normalizedBaseUrl}/api/bilibili/creator-videos?${searchParams.toString()}`;
}

async function parseCreatorVideosResponse(
  response: Response,
): Promise<unknown> {
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
      : `Web API 刷新 B 站 UP 主视频失败：HTTP ${response.status}`;

  throw new Error(message);
}

export function parseBilibiliCreatorInput(input: string): string | null {
  const trimmedInput = input.trim();
  if (!trimmedInput) {
    return null;
  }

  if (DIRECT_MID_PATTERN.test(trimmedInput)) {
    return trimmedInput;
  }

  try {
    const url = new URL(trimmedInput);
    if (!isSupportedBilibiliHost(url.hostname)) {
      return null;
    }

    return url.pathname.match(SPACE_PATH_MID_PATTERN)?.[1] ?? null;
  } catch {
    return null;
  }
}

export function createBilibiliCreatorVideosLoader(
  invoke: InvokeFn = createSafeTauriInvoke(
    "当前环境不能刷新 B 站 UP 主视频",
  ),
): BilibiliCreatorVideosLoader {
  return async (mid, limit) => {
    const response = await invoke("fetch_bilibili_creator_videos", {
      fingerprint: createBilibiliBrowserFingerprint(),
      limit,
      mid,
    });

    return normalizeBilibiliCreatorVideos(response);
  };
}

export function createBilibiliCreatorWebVideosLoader(
  baseUrl: string = readWebApiBaseUrl(),
): BilibiliCreatorVideosLoader {
  return async (mid, limit) => {
    const response = await fetch(creatorVideosApiUrl(baseUrl, mid, limit), {
      headers: {
        "Content-Type": "application/json",
      },
    });
    const responseValue = await parseCreatorVideosResponse(response);

    return normalizeBilibiliCreatorVideos(responseValue);
  };
}

export function createRuntimeBilibiliCreatorVideosLoader(): BilibiliCreatorVideosLoader {
  if (hasTauriInvoke()) {
    return createBilibiliCreatorVideosLoader();
  }

  return createBilibiliCreatorWebVideosLoader();
}

export function normalizeBilibiliCreatorVideos(
  response: unknown,
): BilibiliCreatorVideos {
  if (!isBilibiliCreatorVideos(response)) {
    throw new Error("B 站 UP 主视频响应格式不正确");
  }

  return {
    creator: {
      avatarUrl: response.creator.avatarUrl,
      mid: response.creator.mid.trim(),
      name: response.creator.name.trim(),
    },
    videos: response.videos.map((video) => ({
      aid: video.aid,
      bvid: video.bvid.trim(),
      coverUrl: video.coverUrl,
      durationSeconds: video.durationSeconds,
      playCount: video.playCount,
      publishedAt: video.publishedAt,
      title: video.title.trim(),
    })),
  };
}

export const loadBilibiliCreatorVideos =
  createRuntimeBilibiliCreatorVideosLoader();
