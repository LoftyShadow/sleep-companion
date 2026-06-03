import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

const host = process.env.TAURI_DEV_HOST;
const BILIBILI_BROWSER_USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const DEFAULT_DM_IMG_LIST = "[]";
const DEFAULT_DM_IMG_STR = "V2ViR0wgMS4wIChPcGVuR0wgRVMgMi4wIENocm9taXVtKQ";
const DEFAULT_DM_COVER_IMG_STR =
  "QU5HTEUgKEdvb2dsZSwgQ2hyb21pdW0pR29vZ2xlIEluYy4=";
const DEFAULT_DM_IMG_INTER = "{\"ds\":[],\"wh\":[1920,1080,100],\"of\":[0,0,0]}";
const DEFAULT_CREATOR_VIDEO_LIMIT = 12;
const MAX_CREATOR_VIDEO_LIMIT = 12;
const MAX_CREATOR_DYNAMIC_PAGE_COUNT = 5;
const WBI_MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
  61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
  36, 20, 34, 44, 52,
] as const;

interface BilibiliCreatorVideoPayload {
  aid?: string;
  bvid: string;
  coverUrl?: string;
  durationSeconds?: number;
  playCount?: number;
  publishedAt: number;
  title: string;
}

interface BilibiliCreatorVideosPayload {
  creator: {
    avatarUrl?: string;
    mid: string;
    name: string;
  };
  videos: BilibiliCreatorVideoPayload[];
}

interface BilibiliCreatorDynamicVideosPage extends BilibiliCreatorVideosPayload {
  hasMore: boolean;
  nextOffset?: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmedValue = value.trim();

    return trimmedValue ? trimmedValue : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toString();
  }

  return null;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsedValue = Number(value.trim());

    return Number.isFinite(parsedValue) ? parsedValue : undefined;
  }

  return undefined;
}

function parseBilibiliCountText(text: string): number | undefined {
  const trimmedText = text.trim();
  if (!trimmedText) {
    return undefined;
  }

  if (trimmedText.endsWith("万")) {
    const count = Number(trimmedText.slice(0, -1).trim());

    return Number.isFinite(count) ? Math.round(count * 10_000) : undefined;
  }

  const count = Number(trimmedText);

  return Number.isFinite(count) ? count : undefined;
}

function readBilibiliCount(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return typeof value === "string" ? parseBilibiliCountText(value) : undefined;
}

function normalizeImageUrl(value: unknown): string | undefined {
  const imageUrl = readString(value);
  if (!imageUrl) {
    return undefined;
  }

  if (imageUrl.startsWith("//")) {
    return `https:${imageUrl}`;
  }

  try {
    const parsedImageUrl = new URL(imageUrl);
    if (parsedImageUrl.protocol === "http:") {
      parsedImageUrl.protocol = "https:";

      return parsedImageUrl.toString();
    }
  } catch {
    return imageUrl;
  }

  return imageUrl;
}

function parseDurationSeconds(value: unknown): number | undefined {
  const numericValue = readNumber(value);
  if (numericValue !== undefined) {
    return Math.max(0, Math.floor(numericValue));
  }

  const durationText = readString(value);
  if (!durationText) {
    return undefined;
  }

  const parts = durationText.split(":").map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part))) {
    return undefined;
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  return undefined;
}

function ensureBilibiliSuccess(value: unknown): Record<string, unknown> {
  const record = asRecord(value);
  const code = readNumber(record?.code);
  if (code === 0 && record) {
    return record;
  }

  const message =
    readString(record?.message) ??
    readString(record?.msg) ??
    "B 站 UP 主视频接口返回失败";

  throw new Error(message);
}

function parseWbiKeys(value: unknown): { imgKey: string; subKey: string } {
  const record = asRecord(value);
  const data = asRecord(record?.data);
  const wbiImage = asRecord(data?.wbi_img);
  const imgUrl = readString(wbiImage?.img_url);
  const subUrl = readString(wbiImage?.sub_url);
  const imgKey = imgUrl?.split("/").pop()?.split(".")[0];
  const subKey = subUrl?.split("/").pop()?.split(".")[0];
  if (!imgKey || !subKey) {
    throw new Error("B 站 WBI 参数无效");
  }

  return { imgKey, subKey };
}

function createWbiMixinKey(imgKey: string, subKey: string): string {
  const rawKey = Array.from(`${imgKey}${subKey}`);

  return WBI_MIXIN_KEY_ENC_TAB.map((index) => rawKey[index])
    .filter((character): character is string => Boolean(character))
    .slice(0, 32)
    .join("");
}

function sanitizeWbiValue(value: string): string {
  return Array.from(value)
    .filter((character) => !["!", "'", "(", ")", "*"].includes(character))
    .join("");
}

function buildSignedWbiQuery(
  params: Record<string, string>,
  imgKey: string,
  subKey: string,
): string {
  const signedParams = {
    ...params,
    wts: Math.floor(Date.now() / 1000).toString(),
  };
  const sortedEntries = Object.entries(signedParams)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => [key, sanitizeWbiValue(value)] as const);
  const query = new URLSearchParams(sortedEntries).toString();
  const wRid = createHash("md5")
    .update(`${query}${createWbiMixinKey(imgKey, subKey)}`)
    .digest("hex");

  return new URLSearchParams([...sortedEntries, ["w_rid", wRid]]).toString();
}

function splitSetCookieHeader(headerValue: string): string[] {
  return headerValue.split(/,\s*(?=[^;,]+=)/u);
}

function readSetCookieHeaders(headers: Headers): string[] {
  const headersWithSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };
  const setCookieHeaders = headersWithSetCookie.getSetCookie?.();
  if (setCookieHeaders?.length) {
    return setCookieHeaders;
  }

  const combinedHeader = headers.get("set-cookie");

  return combinedHeader ? splitSetCookieHeader(combinedHeader) : [];
}

function storeResponseCookies(
  cookieStore: Map<string, string>,
  response: Response,
) {
  readSetCookieHeaders(response.headers).forEach((setCookieHeader) => {
    const cookiePair = setCookieHeader.split(";")[0];
    const separatorIndex = cookiePair.indexOf("=");
    if (separatorIndex <= 0) {
      return;
    }

    cookieStore.set(
      cookiePair.slice(0, separatorIndex),
      cookiePair.slice(separatorIndex + 1),
    );
  });
}

function cookieHeader(cookieStore: Map<string, string>): string {
  return Array.from(cookieStore.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

async function fetchBilibiliJson(
  url: string,
  cookieStore: Map<string, string>,
  referer: string,
): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      Cookie: cookieHeader(cookieStore),
      Referer: referer,
      "User-Agent": BILIBILI_BROWSER_USER_AGENT,
    },
  });
  storeResponseCookies(cookieStore, response);
  if (!response.ok) {
    throw new Error(`请求 B 站失败：HTTP ${response.status}`);
  }

  return response.json();
}

function modulesValue(
  item: Record<string, unknown>,
  key: string,
): Record<string, unknown> | null {
  const modules = Array.isArray(item.modules) ? item.modules : [];

  for (const moduleValue of modules) {
    const moduleRecord = asRecord(moduleValue);
    const value = asRecord(moduleRecord?.[key]);
    if (value) {
      return value;
    }
  }

  return null;
}

function parseCreatorVideos(
  mid: string,
  responseValue: unknown,
): BilibiliCreatorVideosPayload {
  const response = ensureBilibiliSuccess(responseValue);
  const data = asRecord(response.data);
  const list = asRecord(data?.list);
  const videoValues = Array.isArray(list?.vlist) ? list.vlist : null;
  if (!videoValues) {
    throw new Error("B 站 UP 主视频响应缺少投稿列表");
  }

  const videos = videoValues.map((videoValue) => {
    const video = asRecord(videoValue);
    const bvid = readString(video?.bvid);
    const title = readString(video?.title);
    const publishedAt = readNumber(video?.created);
    if (!bvid || !title || publishedAt === undefined) {
      throw new Error("B 站 UP 主视频响应格式不正确");
    }
    const stat = asRecord(video?.stat);

    return {
      aid: readString(video?.aid) ?? undefined,
      bvid,
      coverUrl: normalizeImageUrl(video?.pic),
      durationSeconds: parseDurationSeconds(video?.duration ?? video?.length),
      playCount: readNumber(stat?.view ?? video?.play),
      publishedAt,
      title,
    };
  });
  const firstVideo = asRecord(videoValues[0]);
  const card = asRecord(data?.card);

  return {
    creator: {
      avatarUrl: normalizeImageUrl(card?.face),
      mid,
      name: readString(firstVideo?.author) ?? readString(card?.name) ?? `UP ${mid}`,
    },
    videos,
  };
}

function parseDynamicCreatorProfile(
  mid: string,
  item: Record<string, unknown>,
): BilibiliCreatorVideosPayload["creator"] | null {
  const author = modulesValue(item, "module_author");
  const user = asRecord(author?.user);
  const userMid = readString(user?.mid);
  const name = readString(user?.name);
  if (!userMid || userMid !== mid || !name) {
    return null;
  }

  return {
    avatarUrl: normalizeImageUrl(user?.face),
    mid: userMid,
    name,
  };
}

function parseDynamicArchiveVideo(
  item: Record<string, unknown>,
): BilibiliCreatorVideoPayload | null {
  const moduleDynamic = modulesValue(item, "module_dynamic");
  const archive = asRecord(moduleDynamic?.dyn_archive);
  const bvid = readString(archive?.bvid);
  const title = readString(archive?.title);
  const author = modulesValue(item, "module_author");
  const publishedAt = readNumber(author?.pub_ts);
  if (!bvid || !title || publishedAt === undefined) {
    return null;
  }
  const stat = asRecord(archive?.stat);

  return {
    aid: readString(archive?.aid) ?? undefined,
    bvid,
    coverUrl: normalizeImageUrl(archive?.cover),
    durationSeconds: parseDurationSeconds(archive?.duration_text),
    playCount: readBilibiliCount(stat?.play),
    publishedAt,
    title,
  };
}

function fallbackCreatorProfile(
  mid: string,
): BilibiliCreatorVideosPayload["creator"] {
  return {
    mid,
    name: `UP ${mid}`,
  };
}

function parseCreatorDynamicVideosPage(
  mid: string,
  limit: number,
  responseValue: unknown,
): BilibiliCreatorDynamicVideosPage {
  const response = ensureBilibiliSuccess(responseValue);
  const data = asRecord(response.data);
  const items = Array.isArray(data?.items) ? data.items : null;
  if (!items) {
    throw new Error("B 站 UP 主动态响应缺少内容");
  }
  const nextOffset = readString(data?.offset) ?? undefined;
  const hasMore = data?.has_more === true;

  let creator: BilibiliCreatorVideosPayload["creator"] | null = null;
  const seenBvids = new Set<string>();
  const videos: BilibiliCreatorVideoPayload[] = [];

  for (const itemValue of items) {
    const item = asRecord(itemValue);
    if (!item) {
      continue;
    }

    creator ??= parseDynamicCreatorProfile(mid, item);
    if (videos.length >= limit) {
      break;
    }

    const video = parseDynamicArchiveVideo(item);
    if (video && !seenBvids.has(video.bvid)) {
      seenBvids.add(video.bvid);
      videos.push(video);
    }
  }

  return {
    creator: creator ?? fallbackCreatorProfile(mid),
    hasMore,
    nextOffset,
    videos,
  };
}

function validateCreatorRequest(url: URL): { limit: number; mid: string } {
  const mid = url.searchParams.get("mid")?.trim() ?? "";
  if (!/^\d+$/u.test(mid)) {
    throw new Error("B 站 UP 主 mid 必须是数字");
  }

  const requestedLimit = Number(
    url.searchParams.get("limit") ?? DEFAULT_CREATOR_VIDEO_LIMIT,
  );
  if (
    !Number.isInteger(requestedLimit) ||
    requestedLimit <= 0 ||
    requestedLimit > MAX_CREATOR_VIDEO_LIMIT
  ) {
    throw new Error(
      `B 站 UP 主视频刷新数量必须在 1 到 ${MAX_CREATOR_VIDEO_LIMIT} 之间`,
    );
  }

  return { limit: requestedLimit, mid };
}

function creatorFingerprintParams(url: URL): Record<string, string> {
  return {
    dm_cover_img_str:
      url.searchParams.get("dmCoverImgStr") ?? DEFAULT_DM_COVER_IMG_STR,
    dm_img_inter: url.searchParams.get("dmImgInter") ?? DEFAULT_DM_IMG_INTER,
    dm_img_list: url.searchParams.get("dmImgList") ?? DEFAULT_DM_IMG_LIST,
    dm_img_str: url.searchParams.get("dmImgStr") ?? DEFAULT_DM_IMG_STR,
  };
}

function dynamicVideosQuery(
  mid: string,
  offset: string | undefined,
  imgKey: string,
  subKey: string,
): string {
  const params: Record<string, string> = {
    features: "itemOpusStyle",
    host_mid: mid,
    timezone_offset: "-480",
    web_location: "333.999",
  };

  if (offset) {
    params.offset = offset;
  }

  return buildSignedWbiQuery(params, imgKey, subKey);
}

async function fetchBilibiliCreatorVideosForDevApi(
  url: URL,
): Promise<BilibiliCreatorVideosPayload> {
  const { limit, mid } = validateCreatorRequest(url);
  try {
    return await fetchBilibiliCreatorDynamicVideos(mid, limit);
  } catch (dynamicError) {
    return fetchBilibiliCreatorSpaceVideos(url, mid, limit).catch(
      (spaceError: unknown) => {
        throw new Error(
          `刷新 B 站 UP 主视频失败：动态接口：${errorMessage(dynamicError)}；投稿接口：${errorMessage(spaceError)}`,
        );
      },
    );
  }
}

async function prepareBilibiliCreatorSession(
  mid: string,
  cookieStore: Map<string, string>,
): Promise<void> {
  const spaceUrl = `https://space.bilibili.com/${mid}/upload/video`;
  const spaceResponse = await fetch(spaceUrl, {
    headers: {
      Referer: "https://www.bilibili.com/",
      "User-Agent": BILIBILI_BROWSER_USER_AGENT,
    },
  });
  storeResponseCookies(cookieStore, spaceResponse);
  if (!spaceResponse.ok) {
    throw new Error(`建立 B 站匿名访问会话失败：HTTP ${spaceResponse.status}`);
  }
}

async function fetchBilibiliCreatorDynamicVideosPage(
  mid: string,
  limit: number,
  cookieStore: Map<string, string>,
  imgKey: string,
  subKey: string,
  offset?: string,
): Promise<BilibiliCreatorDynamicVideosPage> {
  const query = dynamicVideosQuery(mid, offset, imgKey, subKey);
  const response = await fetch(
    `https://api.bilibili.com/x/polymer/web-dynamic/desktop/v1/feed/space?${query}`,
    {
      headers: {
        Cookie: cookieHeader(cookieStore),
        Referer: `https://space.bilibili.com/${mid}/dynamic`,
        "User-Agent": BILIBILI_BROWSER_USER_AGENT,
      },
    },
  );
  storeResponseCookies(cookieStore, response);
  if (!response.ok) {
    throw new Error(`请求 B 站 UP 主动态失败：HTTP ${response.status}`);
  }

  return parseCreatorDynamicVideosPage(mid, limit, await response.json());
}

async function fetchBilibiliCreatorDynamicVideos(
  mid: string,
  limit: number,
): Promise<BilibiliCreatorVideosPayload> {
  const cookieStore = new Map<string, string>();
  await prepareBilibiliCreatorSession(mid, cookieStore);
  const wbiResponse = await fetchBilibiliJson(
    "https://api.bilibili.com/x/web-interface/nav",
    cookieStore,
    "https://www.bilibili.com/",
  );
  const { imgKey, subKey } = parseWbiKeys(wbiResponse);
  let creator: BilibiliCreatorVideosPayload["creator"] | null = null;
  const videos: BilibiliCreatorVideoPayload[] = [];
  const seenBvids = new Set<string>();
  let offset: string | undefined;

  for (
    let pageIndex = 0;
    pageIndex < MAX_CREATOR_DYNAMIC_PAGE_COUNT;
    pageIndex += 1
  ) {
    const remainingLimit = limit - videos.length;
    if (remainingLimit <= 0) {
      break;
    }

    const page = await fetchBilibiliCreatorDynamicVideosPage(
      mid,
      remainingLimit,
      cookieStore,
      imgKey,
      subKey,
      offset,
    );
    creator ??= page.creator;

    for (const video of page.videos) {
      if (videos.length >= limit) {
        break;
      }

      if (!seenBvids.has(video.bvid)) {
        seenBvids.add(video.bvid);
        videos.push(video);
      }
    }

    const nextOffset = page.nextOffset?.trim() || undefined;
    if (!page.hasMore || nextOffset === offset) {
      break;
    }

    offset = nextOffset;
    if (!offset) {
      break;
    }
  }

  if (videos.length === 0) {
    throw new Error("B 站 UP 主动态暂未返回公开视频");
  }

  return {
    creator: creator ?? fallbackCreatorProfile(mid),
    videos,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "刷新失败";
}

async function fetchBilibiliCreatorSpaceVideos(
  url: URL,
  mid: string,
  limit: number,
): Promise<BilibiliCreatorVideosPayload> {
  const cookieStore = new Map<string, string>();
  const spaceUrl = `https://space.bilibili.com/${mid}/upload/video`;
  await prepareBilibiliCreatorSession(mid, cookieStore);

  const wbiResponse = await fetchBilibiliJson(
    "https://api.bilibili.com/x/web-interface/nav",
    cookieStore,
    "https://www.bilibili.com/",
  );
  const { imgKey, subKey } = parseWbiKeys(wbiResponse);
  const query = buildSignedWbiQuery(
    {
      ...creatorFingerprintParams(url),
      index: "0",
      keyword: "",
      mid,
      order: "pubdate",
      order_avoided: "true",
      platform: "web",
      pn: "1",
      ps: limit.toString(),
      special_type: "",
      tid: "0",
      web_location: "333.1387",
    },
    imgKey,
    subKey,
  );
  const creatorVideosResponse = await fetchBilibiliJson(
    `https://api.bilibili.com/x/space/wbi/arc/search?${query}`,
    cookieStore,
    spaceUrl,
  );

  return parseCreatorVideos(mid, creatorVideosResponse);
}

function writeJsonResponse(
  response: ServerResponse,
  statusCode: number,
  body: unknown,
) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

function handleBilibiliCreatorWebApiRequest(
  request: IncomingMessage,
  response: ServerResponse,
  next: () => void,
) {
  if (
    request.method !== "GET" ||
    !request.url?.startsWith("/api/bilibili/creator-videos")
  ) {
    next();
    return;
  }

  const requestUrl = new URL(request.url, "http://localhost");
  void fetchBilibiliCreatorVideosForDevApi(requestUrl)
    .then((payload) => {
      writeJsonResponse(response, 200, payload);
    })
    .catch((error: unknown) => {
      writeJsonResponse(response, 502, {
        message: error instanceof Error ? error.message : "刷新 UP 主视频失败",
      });
    });
}

function bilibiliCreatorDevApiPlugin(): Plugin {
  return {
    name: "sleep-companion-bilibili-creator-dev-api",
    configureServer(server) {
      server.middlewares.use(handleBilibiliCreatorWebApiRequest);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handleBilibiliCreatorWebApiRequest);
    },
  };
}

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [bilibiliCreatorDevApiPlugin(), react(), tailwindcss()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
