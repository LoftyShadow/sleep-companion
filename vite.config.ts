import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import QRCode from "qrcode";

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
const MAX_CREATOR_DYNAMIC_PAGE_COUNT = 10;
const BILIBILI_WEB_SESSION_FILE_NAME = "bilibili-web-session.json";
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

interface BilibiliDirectAudioReferencePayload {
  kind: "aid" | "bvid";
  value: string;
}

interface BilibiliDirectAudioSourcePayload {
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
  videoBackupUrls?: string[];
  videoBandwidth?: number;
  videoCodecs?: string;
  videoHeight?: number;
  videoMimeType?: string;
  videoUrl?: string;
  videoWidth?: number;
}

interface BilibiliVideoIdentityPayload {
  aid: string;
  bvid: string;
  cid: string;
  coverUrl?: string;
  title: string;
}

interface BilibiliDashAudioTrackPayload {
  audioUrl: string;
  backupUrls: string[];
  bandwidth?: number;
  codecs?: string;
  mimeType?: string;
}

interface BilibiliDashVideoTrackPayload {
  backupUrls: string[];
  bandwidth?: number;
  codecs?: string;
  height?: number;
  mimeType?: string;
  videoUrl: string;
  width?: number;
}

interface BilibiliAuthAccountPayload {
  avatarUrl?: string;
  mid: string;
  name: string;
}

interface BilibiliWebAuthSession {
  avatarUrl?: string;
  biliJct?: string;
  buvid3?: string;
  dedeUserId?: string;
  dedeUserIdCkMd5?: string;
  expiresAt?: number;
  mid?: string;
  name?: string;
  sessData: string;
  sid?: string;
  updatedAt: number;
}

let bilibiliWebAuthSession: BilibiliWebAuthSession | null = null;
let bilibiliWebAuthSessionStoreLoaded = false;
let bilibiliWebAuthSessionLoadPromise: Promise<void> | null = null;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function isNodeErrorCode(error: unknown, code: string): boolean {
  return asRecord(error)?.code === code;
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

function readFirstDurationSeconds(...values: unknown[]): number | undefined {
  for (const value of values) {
    const duration = parseDurationSeconds(value);
    if (duration !== undefined) {
      return duration;
    }
  }

  return undefined;
}

function readFirstBilibiliCount(...values: unknown[]): number | undefined {
  for (const value of values) {
    const count = readBilibiliCount(value);
    if (count !== undefined) {
      return count;
    }
  }

  return undefined;
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
    .map(([key, value]): [string, string] => [key, sanitizeWbiValue(value)]);
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

function nowUnixSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function optionalString(value: unknown): string | undefined {
  return readString(value) ?? undefined;
}

function isUsableBilibiliWebAuthSession(
  session: BilibiliWebAuthSession,
  now = nowUnixSeconds(),
): boolean {
  return (
    session.sessData.trim().length > 0 &&
    (session.expiresAt === undefined || session.expiresAt > now)
  );
}

function parsePersistedBilibiliWebAuthSession(
  value: unknown,
): BilibiliWebAuthSession | null {
  const record = asRecord(value);
  const sessData = readString(record?.sessData);
  const updatedAt = readNumber(record?.updatedAt);
  if (!sessData || updatedAt === undefined) {
    return null;
  }

  const session: BilibiliWebAuthSession = {
    avatarUrl: optionalString(record?.avatarUrl),
    biliJct: optionalString(record?.biliJct),
    buvid3: optionalString(record?.buvid3),
    dedeUserId: optionalString(record?.dedeUserId),
    dedeUserIdCkMd5: optionalString(record?.dedeUserIdCkMd5),
    expiresAt: readNumber(record?.expiresAt),
    mid: optionalString(record?.mid),
    name: optionalString(record?.name),
    sessData,
    sid: optionalString(record?.sid),
    updatedAt: Math.floor(updatedAt),
  };

  return isUsableBilibiliWebAuthSession(session) ? session : null;
}

function bilibiliWebSessionPath(): string {
  const xdgCacheHome = process.env.XDG_CACHE_HOME?.trim();
  const homeDirectory = process.env.HOME?.trim() || homedir();
  const cacheDirectory = xdgCacheHome
    ? join(xdgCacheHome, "sleep-companion")
    : homeDirectory
      ? join(homeDirectory, ".cache", "sleep-companion")
      : join(tmpdir(), "sleep-companion");

  return join(cacheDirectory, BILIBILI_WEB_SESSION_FILE_NAME);
}

async function restrictBilibiliWebSessionFilePermissions(
  path: string,
): Promise<void> {
  if (process.platform !== "win32") {
    await fs.chmod(path, 0o600);
  }
}

async function clearPersistedBilibiliWebAuthSession(): Promise<void> {
  const sessionPath = bilibiliWebSessionPath();

  try {
    await fs.unlink(sessionPath);
  } catch (error) {
    if (!isNodeErrorCode(error, "ENOENT")) {
      throw error;
    }
  }
}

async function saveBilibiliWebAuthSession(
  session: BilibiliWebAuthSession,
): Promise<void> {
  if (!isUsableBilibiliWebAuthSession(session)) {
    await clearPersistedBilibiliWebAuthSession();
    return;
  }

  const sessionPath = bilibiliWebSessionPath();
  const temporaryPath = `${sessionPath}.tmp`;

  await fs.mkdir(dirname(sessionPath), { recursive: true });
  await fs.writeFile(temporaryPath, `${JSON.stringify(session, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await restrictBilibiliWebSessionFilePermissions(temporaryPath);
  await fs.rename(temporaryPath, sessionPath);
  await restrictBilibiliWebSessionFilePermissions(sessionPath);
}

async function loadPersistedBilibiliWebAuthSession(): Promise<void> {
  const sessionPath = bilibiliWebSessionPath();

  try {
    const sessionText = await fs.readFile(sessionPath, "utf8");
    const session = parsePersistedBilibiliWebAuthSession(
      JSON.parse(sessionText) as unknown,
    );

    if (session) {
      bilibiliWebAuthSession = session;
      bilibiliWebAuthSessionStoreLoaded = true;
      return;
    }

    bilibiliWebAuthSession = null;
    await clearPersistedBilibiliWebAuthSession();
  } catch (error) {
    if (isNodeErrorCode(error, "ENOENT")) {
      bilibiliWebAuthSession = null;
      bilibiliWebAuthSessionStoreLoaded = true;
      return;
    }

    if (error instanceof SyntaxError) {
      bilibiliWebAuthSession = null;
      await clearPersistedBilibiliWebAuthSession();
      bilibiliWebAuthSessionStoreLoaded = true;
      return;
    }

    throw error;
  }

  bilibiliWebAuthSessionStoreLoaded = true;
}

async function ensureBilibiliWebAuthSessionLoaded(): Promise<void> {
  if (bilibiliWebAuthSessionStoreLoaded) {
    return;
  }

  bilibiliWebAuthSessionLoadPromise ??= loadPersistedBilibiliWebAuthSession()
    .finally(() => {
      bilibiliWebAuthSessionLoadPromise = null;
    });

  await bilibiliWebAuthSessionLoadPromise;
}

function preloadBilibiliWebAuthSession(): void {
  void ensureBilibiliWebAuthSessionLoaded().catch(() => {
    // 预热失败不阻塞 Vite 启动；后续接口请求会重新暴露可见错误。
  });
}

function cookieValue(
  cookies: Map<string, string>,
  name: string,
): string | undefined {
  return optionalString(cookies.get(name));
}

function parseCookieMaxAge(attribute: string): number | undefined {
  const [rawKey, rawValue] = attribute.split("=");
  if (rawKey?.trim().toLowerCase() !== "max-age") {
    return undefined;
  }

  const maxAge = Number(rawValue?.trim());

  return Number.isFinite(maxAge) && maxAge > 0 ? maxAge : undefined;
}

function parseBilibiliLoginCookies(
  setCookieHeaders: readonly string[],
): {
  cookies: Map<string, string>;
  sessDataExpiresAt?: number;
} {
  const cookies = new Map<string, string>();
  let sessDataExpiresAt: number | undefined;

  setCookieHeaders.forEach((setCookieHeader) => {
    const [cookiePair, ...attributes] = setCookieHeader.split(";");
    const separatorIndex = cookiePair.indexOf("=");
    if (separatorIndex <= 0) {
      return;
    }

    const name = cookiePair.slice(0, separatorIndex).trim();
    const value = cookiePair.slice(separatorIndex + 1).trim();
    if (!name || !value) {
      return;
    }

    cookies.set(name, value);
    if (name === "SESSDATA") {
      const maxAge = attributes
        .map(parseCookieMaxAge)
        .find((value): value is number => value !== undefined);
      if (maxAge !== undefined) {
        sessDataExpiresAt = nowUnixSeconds() + maxAge;
      }
    }
  });

  return { cookies, sessDataExpiresAt };
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

function createCookieStoreFromSession(
  session: BilibiliWebAuthSession | null,
): Map<string, string> {
  const cookieStore = new Map<string, string>();
  if (!session) {
    return cookieStore;
  }

  cookieStore.set("SESSDATA", session.sessData);
  if (session.biliJct) {
    cookieStore.set("bili_jct", session.biliJct);
  }
  if (session.dedeUserId) {
    cookieStore.set("DedeUserID", session.dedeUserId);
  }
  if (session.dedeUserIdCkMd5) {
    cookieStore.set("DedeUserID__ckMd5", session.dedeUserIdCkMd5);
  }
  if (session.sid) {
    cookieStore.set("sid", session.sid);
  }
  if (session.buvid3) {
    cookieStore.set("buvid3", session.buvid3);
  }

  return cookieStore;
}

function getActiveBilibiliWebAuthSession(): BilibiliWebAuthSession | null {
  if (!bilibiliWebAuthSession) {
    return null;
  }

  if (!isUsableBilibiliWebAuthSession(bilibiliWebAuthSession)) {
    bilibiliWebAuthSession = null;
    void clearPersistedBilibiliWebAuthSession().catch(() => {
      // 状态读取不能因为过期文件清理失败而阻塞；显式退出时会返回可见错误。
    });

    return null;
  }

  return bilibiliWebAuthSession;
}

function accountFromWebAuthSession(
  session: BilibiliWebAuthSession | null,
): BilibiliAuthAccountPayload | undefined {
  if (!session) {
    return undefined;
  }

  const mid = optionalString(session.mid) ?? optionalString(session.dedeUserId);
  if (!mid) {
    return undefined;
  }

  return {
    avatarUrl: optionalString(session.avatarUrl),
    mid,
    name: optionalString(session.name) ?? "B 站账号",
  };
}

function webAuthStatusPayload() {
  const session = getActiveBilibiliWebAuthSession();

  return {
    account: accountFromWebAuthSession(session) ?? null,
    expiresAt: session?.expiresAt,
    isLoggedIn: Boolean(session),
    updatedAt: session?.updatedAt,
  };
}

async function fetchBilibiliJson(
  url: string,
  cookieStore: Map<string, string>,
  referer: string,
  extraHeaders: Record<string, string> = {},
): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      Cookie: cookieHeader(cookieStore),
      Referer: referer,
      "User-Agent": BILIBILI_BROWSER_USER_AGENT,
      ...extraHeaders,
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
  const moduleMap = asRecord(item.modules);
  if (moduleMap) {
    const value = asRecord(moduleMap[key]);
    if (value) {
      return value;
    }
  }

  if (Array.isArray(item.modules)) {
    for (const moduleValue of item.modules) {
      const moduleRecord = asRecord(moduleValue);
      const value = asRecord(moduleRecord?.[key]);
      if (value) {
        return value;
      }
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
  const user = asRecord(author?.user) ?? author;
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
  const major = asRecord(moduleDynamic?.major);
  const archive =
    asRecord(moduleDynamic?.dyn_archive) ?? asRecord(major?.archive);
  const bvid = readString(archive?.bvid);
  const title = readString(archive?.title);
  const author = modulesValue(item, "module_author");
  const publishedAt =
    readNumber(author?.pub_ts) ??
    readNumber(archive?.pubdate) ??
    readNumber(archive?.ctime) ??
    readNumber(archive?.created);
  if (!bvid || !title || publishedAt === undefined) {
    return null;
  }
  const stat = asRecord(archive?.stat);

  return {
    aid: readString(archive?.aid) ?? undefined,
    bvid,
    coverUrl: normalizeImageUrl(archive?.cover ?? archive?.pic),
    durationSeconds: readFirstDurationSeconds(
      archive?.duration_text,
      archive?.duration,
      archive?.length,
    ),
    playCount: readFirstBilibiliCount(
      stat?.play,
      stat?.view,
      archive?.play,
    ),
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

function validateDirectAudioRequest(
  url: URL,
): BilibiliDirectAudioReferencePayload {
  const kind = url.searchParams.get("kind")?.trim() ?? "";
  const value = url.searchParams.get("value")?.trim() ?? "";
  if (!value) {
    throw new Error("B 站视频引用为空");
  }

  if (kind === "bvid") {
    if (/^BV[0-9A-Za-z]+$/u.test(value)) {
      return { kind, value };
    }

    throw new Error("B 站 BV 号格式不正确");
  }

  if (kind === "aid") {
    if (/^\d+$/u.test(value)) {
      return { kind, value };
    }

    throw new Error("B 站 av 号格式不正确");
  }

  if (kind === "ep") {
    throw new Error("当前直连模式暂不支持番剧链接");
  }

  if (kind === "live") {
    throw new Error("当前直连模式暂不支持直播间");
  }

  throw new Error("当前直连模式只支持 BV 和 av 视频");
}

function directAudioViewUrl(reference: BilibiliDirectAudioReferencePayload) {
  const searchParams = new URLSearchParams({
    [reference.kind === "bvid" ? "bvid" : "aid"]: reference.value,
  });

  return `https://api.bilibili.com/x/web-interface/view?${searchParams.toString()}`;
}

function parseBilibiliVideoIdentity(
  responseValue: unknown,
): BilibiliVideoIdentityPayload {
  const response = ensureBilibiliSuccess(responseValue);
  const data = asRecord(response.data);
  const bvid = readString(data?.bvid);
  const aid = readString(data?.aid);
  const title = readString(data?.title);
  const cid =
    readString(data?.cid) ??
    (Array.isArray(data?.pages)
      ? readString(asRecord(data.pages[0])?.cid)
      : null);
  if (!bvid || !aid || !cid || !title) {
    throw new Error("B 站视频信息响应格式不正确");
  }

  return {
    aid,
    bvid,
    cid,
    coverUrl: normalizeImageUrl(data?.pic),
    title,
  };
}

function readDashMediaUrl(track: Record<string, unknown>): string | undefined {
  return readString(track.baseUrl) ?? readString(track.base_url);
}

function readDashBackupUrls(track: Record<string, unknown>): string[] {
  const backupUrls = Array.isArray(track.backupUrl)
    ? track.backupUrl
    : Array.isArray(track.backup_url)
      ? track.backup_url
      : [];

  return backupUrls
    .map(readString)
    .filter((url): url is string => Boolean(url));
}

function parseBestDashAudioTrack(
  responseValue: unknown,
): BilibiliDashAudioTrackPayload {
  const response = ensureBilibiliSuccess(responseValue);
  const data = asRecord(response.data);
  const dash = asRecord(data?.dash);
  const audioValues = Array.isArray(dash?.audio) ? dash.audio : null;
  if (!audioValues) {
    throw new Error("B 站直连音频响应缺少 DASH 音频轨");
  }

  const audioTracks = audioValues
    .map(asRecord)
    .filter((track): track is Record<string, unknown> => Boolean(track))
    .map((track): BilibiliDashAudioTrackPayload | null => {
      const audioUrl = readDashMediaUrl(track);
      if (!audioUrl) {
        return null;
      }

      return {
        audioUrl,
        backupUrls: readDashBackupUrls(track),
        bandwidth: readNumber(track.bandwidth),
        codecs: readString(track.codecs) ?? undefined,
        mimeType:
          readString(track.mime_type) ?? readString(track.mimeType) ?? undefined,
      };
    })
    .filter(
      (track): track is BilibiliDashAudioTrackPayload => track !== null,
    )
    .sort(
      (left, right) => (right.bandwidth ?? 0) - (left.bandwidth ?? 0),
    );

  const bestTrack = audioTracks[0];
  if (!bestTrack) {
    throw new Error("B 站直连音频不可用");
  }

  return bestTrack;
}

function videoTrackScore(track: BilibiliDashVideoTrackPayload): number {
  const codecPriority = track.codecs?.startsWith("avc1") ? 1_000_000_000 : 0;

  return codecPriority + (track.bandwidth ?? 0);
}

function parseBestDashVideoTrack(
  responseValue: unknown,
): BilibiliDashVideoTrackPayload | undefined {
  const response = ensureBilibiliSuccess(responseValue);
  const data = asRecord(response.data);
  const dash = asRecord(data?.dash);
  const videoValues = Array.isArray(dash?.video) ? dash.video : null;
  if (!videoValues) {
    return undefined;
  }

  return videoValues
    .map(asRecord)
    .filter((track): track is Record<string, unknown> => Boolean(track))
    .map((track): BilibiliDashVideoTrackPayload | null => {
      const videoUrl = readDashMediaUrl(track);
      if (!videoUrl) {
        return null;
      }

      return {
        backupUrls: readDashBackupUrls(track),
        bandwidth: readNumber(track.bandwidth),
        codecs: readString(track.codecs) ?? undefined,
        height: readNumber(track.height),
        mimeType:
          readString(track.mime_type) ?? readString(track.mimeType) ?? undefined,
        videoUrl,
        width: readNumber(track.width),
      };
    })
    .filter(
      (track): track is BilibiliDashVideoTrackPayload => track !== null,
    )
    .sort((left, right) => videoTrackScore(right) - videoTrackScore(left))[0];
}

function directAudioPlayurl(
  identity: BilibiliVideoIdentityPayload,
  imgKey: string,
  subKey: string,
): string {
  const query = buildSignedWbiQuery(
    {
      bvid: identity.bvid,
      cid: identity.cid,
      fnval: "4048",
      fnver: "0",
      fourk: "1",
      qn: "80",
    },
    imgKey,
    subKey,
  );

  return `https://api.bilibili.com/x/player/wbi/playurl?${query}`;
}

function proxiedBilibiliMediaUrl(mediaUrl: string, bvid: string): string {
  const searchParams = new URLSearchParams({
    bvid,
    url: mediaUrl,
  });

  return `/api/bilibili/media-proxy?${searchParams.toString()}`;
}

async function resolveBilibiliDirectAudioForDevApi(
  url: URL,
): Promise<BilibiliDirectAudioSourcePayload> {
  await ensureBilibiliWebAuthSessionLoaded();
  const reference = validateDirectAudioRequest(url);
  const cookieStore = createCookieStoreFromSession(
    getActiveBilibiliWebAuthSession(),
  );
  const viewResponse = await fetchBilibiliJson(
    directAudioViewUrl(reference),
    cookieStore,
    "https://www.bilibili.com/",
    {
      Origin: "https://www.bilibili.com",
    },
  );
  const identity = parseBilibiliVideoIdentity(viewResponse);
  const wbiResponse = await fetchBilibiliJson(
    "https://api.bilibili.com/x/web-interface/nav",
    cookieStore,
    "https://www.bilibili.com/",
  );
  const { imgKey, subKey } = parseWbiKeys(wbiResponse);
  const playurlResponse = await fetchBilibiliJson(
    directAudioPlayurl(identity, imgKey, subKey),
    cookieStore,
    `https://www.bilibili.com/video/${identity.bvid}`,
    {
      Origin: "https://www.bilibili.com",
    },
  );
  const audioTrack = parseBestDashAudioTrack(playurlResponse);
  const videoTrack = parseBestDashVideoTrack(playurlResponse);

  return {
    aid: identity.aid,
    audioUrl: proxiedBilibiliMediaUrl(audioTrack.audioUrl, identity.bvid),
    backupUrls: audioTrack.backupUrls.map((backupUrl) =>
      proxiedBilibiliMediaUrl(backupUrl, identity.bvid),
    ),
    bandwidth: audioTrack.bandwidth,
    bvid: identity.bvid,
    cid: identity.cid,
    codecs: audioTrack.codecs,
    coverUrl: identity.coverUrl,
    expiresAt: undefined,
    mimeType: audioTrack.mimeType,
    title: identity.title,
    videoBackupUrls:
      videoTrack?.backupUrls.map((backupUrl) =>
        proxiedBilibiliMediaUrl(backupUrl, identity.bvid),
      ) ?? [],
    videoBandwidth: videoTrack?.bandwidth,
    videoCodecs: videoTrack?.codecs,
    videoHeight: videoTrack?.height,
    videoMimeType: videoTrack?.mimeType,
    videoUrl: videoTrack
      ? proxiedBilibiliMediaUrl(videoTrack.videoUrl, identity.bvid)
      : undefined,
    videoWidth: videoTrack?.width,
  };
}

function isTrustedBilibiliMediaHost(hostname: string): boolean {
  const normalizedHost = hostname.toLowerCase();
  const trustedRootDomains = [
    "bilibili.com",
    "bilivideo.cn",
    "bilivideo.com",
    "hdslb.com",
  ];
  const trustedExactHosts = new Set([
    "upos-hz-mirrorakam.akamaized.net",
    "upos-sz-mirrorakam.akamaized.net",
  ]);

  return (
    trustedExactHosts.has(normalizedHost) ||
    trustedRootDomains.some(
      (domain) =>
        normalizedHost === domain || normalizedHost.endsWith(`.${domain}`),
    )
  );
}

function parseTrustedMediaProxyUrl(url: URL): URL {
  const rawMediaUrl = url.searchParams.get("url")?.trim() ?? "";
  if (!rawMediaUrl) {
    throw new Error("B 站媒体代理 URL 不能为空");
  }

  const mediaUrl = new URL(rawMediaUrl);
  if (!["http:", "https:"].includes(mediaUrl.protocol)) {
    throw new Error("B 站媒体代理 URL 协议不支持");
  }

  if (!isTrustedBilibiliMediaHost(mediaUrl.hostname)) {
    throw new Error("B 站媒体代理 URL 域名不受信任");
  }

  return mediaUrl;
}

function copyMediaProxyResponseHeaders(
  upstreamResponse: Response,
  response: ServerResponse,
) {
  [
    "accept-ranges",
    "cache-control",
    "content-length",
    "content-range",
    "content-type",
    "etag",
    "last-modified",
  ].forEach((headerName) => {
    const headerValue = upstreamResponse.headers.get(headerName);
    if (headerValue) {
      response.setHeader(headerName, headerValue);
    }
  });
}

async function proxyBilibiliMediaForDevApi(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
) {
  await ensureBilibiliWebAuthSessionLoaded();
  const mediaUrl = parseTrustedMediaProxyUrl(url);
  const cookieStore = createCookieStoreFromSession(
    getActiveBilibiliWebAuthSession(),
  );
  const bvid = url.searchParams.get("bvid")?.trim();
  const referer =
    bvid && /^BV[0-9A-Za-z]+$/u.test(bvid)
      ? `https://www.bilibili.com/video/${bvid}`
      : "https://www.bilibili.com/";
  const headers: Record<string, string> = {
    Cookie: cookieHeader(cookieStore),
    Origin: "https://www.bilibili.com",
    Referer: referer,
    "User-Agent": BILIBILI_BROWSER_USER_AGENT,
  };
  const range = request.headers.range;
  if (typeof range === "string" && range.trim()) {
    headers.Range = range;
  }

  const upstreamResponse = await fetch(mediaUrl, { headers });
  response.statusCode = upstreamResponse.status;
  response.statusMessage = upstreamResponse.statusText;
  copyMediaProxyResponseHeaders(upstreamResponse, response);
  if (!upstreamResponse.body) {
    response.end();
    return;
  }

  Readable.fromWeb(
    upstreamResponse.body as Parameters<typeof Readable.fromWeb>[0],
  ).pipe(response);
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
  await ensureBilibiliWebAuthSessionLoaded();
  const { limit, mid } = validateCreatorRequest(url);
  const session = getActiveBilibiliWebAuthSession();

  if (session) {
    try {
      return await fetchBilibiliCreatorVideosForDevApiMode(
        url,
        mid,
        limit,
        "登录态刷新",
        session,
      );
    } catch (authenticatedError) {
      return fetchBilibiliCreatorVideosForDevApiMode(
        url,
        mid,
        limit,
        "匿名刷新",
        null,
      ).catch((anonymousError: unknown) => {
        throw new Error(
          `${errorMessage(authenticatedError)}；匿名降级也失败：${errorMessage(anonymousError)}。可退出后重新扫码登录，或稍后重试。`,
        );
      });
    }
  }

  return fetchBilibiliCreatorVideosForDevApiMode(
    url,
    mid,
    limit,
    "匿名刷新",
    null,
  ).catch((error: unknown) => {
    throw new Error(`${errorMessage(error)}。登录 B 站后可能提高刷新成功率。`);
  });
}

async function fetchBilibiliCreatorVideosForDevApiMode(
  url: URL,
  mid: string,
  limit: number,
  modeLabel: string,
  session: BilibiliWebAuthSession | null,
): Promise<BilibiliCreatorVideosPayload> {
  try {
    return await fetchBilibiliCreatorDynamicVideos(mid, limit, session);
  } catch (dynamicError) {
    return fetchBilibiliCreatorSpaceVideos(url, mid, limit, session).catch(
      (spaceError: unknown) => {
        throw new Error(
          `${modeLabel}失败：动态接口：${errorMessage(dynamicError)}；投稿接口：${errorMessage(spaceError)}`,
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
      Cookie: cookieHeader(cookieStore),
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
        Origin: "https://t.bilibili.com",
        Referer: `https://space.bilibili.com/${mid}/dynamic`,
        "User-Agent": BILIBILI_BROWSER_USER_AGENT,
      },
    },
  );
  storeResponseCookies(cookieStore, response);
  if (!response.ok) {
    throw new Error(`请求 B 站 UP 主动态失败：HTTP ${response.status}`);
  }

  const responseValue: unknown = await response.json();

  return parseCreatorDynamicVideosPage(mid, limit, responseValue);
}

async function fetchBilibiliCreatorDynamicVideos(
  mid: string,
  limit: number,
  session: BilibiliWebAuthSession | null,
): Promise<BilibiliCreatorVideosPayload> {
  const cookieStore = createCookieStoreFromSession(session);
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
  session: BilibiliWebAuthSession | null,
): Promise<BilibiliCreatorVideosPayload> {
  const cookieStore = createCookieStoreFromSession(session);
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

function readRequestBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    request.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    request.on("error", reject);
  });
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const bodyText = await readRequestBody(request);
  if (!bodyText.trim()) {
    return null;
  }

  return JSON.parse(bodyText) as unknown;
}

async function createBilibiliLoginQrForWebApi() {
  const response = await fetch(
    "https://passport.bilibili.com/x/passport-login/web/qrcode/generate",
    {
      headers: {
        Referer: "https://www.bilibili.com/",
        "User-Agent": BILIBILI_BROWSER_USER_AGENT,
      },
    },
  );
  if (!response.ok) {
    throw new Error(`请求 B 站登录二维码失败：HTTP ${response.status}`);
  }

  const responseValue: unknown = await response.json();
  const responseRecord = asRecord(responseValue);
  const code = readNumber(responseRecord?.code);
  if (code !== 0) {
    throw new Error(
      readString(responseRecord?.message) ?? "B 站登录二维码接口返回失败",
    );
  }

  const data = asRecord(responseRecord?.data);
  const url = readString(data?.url);
  const qrcodeKey = readString(data?.qrcode_key);
  if (!url || !qrcodeKey) {
    throw new Error("B 站登录二维码响应格式不正确");
  }

  const qrSvg = await QRCode.toString(url, {
    color: {
      dark: "#14211cff",
      light: "#ffffffff",
    },
    margin: 1,
    type: "svg",
    width: 168,
  });

  return {
    expiresInSeconds: 180,
    qrSvg,
    qrcodeKey,
    url,
  };
}

function createWebSessionFromLoginCookies(
  setCookieHeaders: readonly string[],
): BilibiliWebAuthSession {
  const { cookies, sessDataExpiresAt } =
    parseBilibiliLoginCookies(setCookieHeaders);
  const sessData = cookieValue(cookies, "SESSDATA");
  if (!sessData) {
    throw new Error("B 站登录成功但没有返回 SESSDATA");
  }

  return {
    biliJct: cookieValue(cookies, "bili_jct"),
    buvid3: cookieValue(cookies, "buvid3"),
    dedeUserId: cookieValue(cookies, "DedeUserID"),
    dedeUserIdCkMd5: cookieValue(cookies, "DedeUserID__ckMd5"),
    expiresAt: sessDataExpiresAt,
    mid: cookieValue(cookies, "DedeUserID"),
    sessData,
    sid: cookieValue(cookies, "sid"),
    updatedAt: nowUnixSeconds(),
  };
}

async function fetchBilibiliNavAccountForWebApi(
  session: BilibiliWebAuthSession,
): Promise<BilibiliAuthAccountPayload | undefined> {
  const cookieStore = createCookieStoreFromSession(session);
  const response = await fetch(
    "https://api.bilibili.com/x/web-interface/nav",
    {
      headers: {
        Cookie: cookieHeader(cookieStore),
        Referer: "https://www.bilibili.com/",
        "User-Agent": BILIBILI_BROWSER_USER_AGENT,
      },
    },
  );
  if (!response.ok) {
    return undefined;
  }

  const responseValue: unknown = await response.json();
  const responseRecord = asRecord(responseValue);
  if (readNumber(responseRecord?.code) !== 0) {
    return undefined;
  }

  const data = asRecord(responseRecord?.data);
  if (data?.isLogin !== true) {
    return undefined;
  }

  const mid = readString(data.mid);
  if (!mid) {
    return undefined;
  }

  return {
    avatarUrl: normalizeImageUrl(data.face),
    mid,
    name: readString(data.uname) ?? "B 站账号",
  };
}

function webLoginPollStateFromCode(code: number): string {
  switch (code) {
    case 0:
      return "success";
    case 86038:
      return "expired";
    case 86090:
      return "scanned";
    case 86101:
      return "pending";
    default:
      return "error";
  }
}

async function pollBilibiliLoginQrForWebApi(qrcodeKey: string) {
  const response = await fetch(
    `https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${encodeURIComponent(qrcodeKey)}`,
    {
      headers: {
        Referer: "https://www.bilibili.com/",
        "User-Agent": BILIBILI_BROWSER_USER_AGENT,
      },
    },
  );
  if (!response.ok) {
    throw new Error(`轮询 B 站登录状态失败：HTTP ${response.status}`);
  }

  const setCookieHeaders = readSetCookieHeaders(response.headers);
  const responseValue: unknown = await response.json();
  const responseRecord = asRecord(responseValue);
  if (readNumber(responseRecord?.code) !== 0) {
    return {
      account: null,
      message: readString(responseRecord?.message) ?? "B 站登录失败",
      state: "error",
    };
  }

  const data = asRecord(responseRecord?.data);
  const stateCode = readNumber(data?.code);
  const state =
    stateCode === undefined ? "error" : webLoginPollStateFromCode(stateCode);
  if (state !== "success") {
    return {
      account: null,
      message: readString(data?.message),
      state,
    };
  }

  await ensureBilibiliWebAuthSessionLoaded();
  const session = createWebSessionFromLoginCookies(setCookieHeaders);
  const account = await fetchBilibiliNavAccountForWebApi(session);
  if (account) {
    session.avatarUrl = account.avatarUrl;
    session.mid = account.mid;
    session.name = account.name;
    session.updatedAt = nowUnixSeconds();
  }
  bilibiliWebAuthSession = session;
  await saveBilibiliWebAuthSession(session);

  return {
    account: accountFromWebAuthSession(session) ?? null,
    message: "登录成功",
    state,
  };
}

async function handleBilibiliAuthWebApiRequest(
  request: IncomingMessage,
  response: ServerResponse,
  next: () => void,
) {
  if (!request.url?.startsWith("/api/bilibili/auth/")) {
    next();
    return;
  }

  try {
    if (
      request.method === "GET" &&
      request.url.startsWith("/api/bilibili/auth/status")
    ) {
      await ensureBilibiliWebAuthSessionLoaded();
      writeJsonResponse(response, 200, webAuthStatusPayload());
      return;
    }

    if (
      request.method === "POST" &&
      request.url.startsWith("/api/bilibili/auth/login-qr")
    ) {
      writeJsonResponse(response, 200, await createBilibiliLoginQrForWebApi());
      return;
    }

    if (
      request.method === "POST" &&
      request.url.startsWith("/api/bilibili/auth/login-poll")
    ) {
      const body = asRecord(await readJsonBody(request));
      const qrcodeKey = readString(body?.qrcodeKey);
      if (!qrcodeKey) {
        writeJsonResponse(response, 400, {
          message: "B 站登录二维码 key 不能为空",
        });
        return;
      }
      writeJsonResponse(
        response,
        200,
        await pollBilibiliLoginQrForWebApi(qrcodeKey),
      );
      return;
    }

    if (
      request.method === "POST" &&
      request.url.startsWith("/api/bilibili/auth/logout")
    ) {
      await ensureBilibiliWebAuthSessionLoaded();
      bilibiliWebAuthSession = null;
      await clearPersistedBilibiliWebAuthSession();
      writeJsonResponse(response, 200, {});
      return;
    }

    writeJsonResponse(response, 404, {
      message: "未知的 B 站登录接口",
    });
  } catch (error) {
    writeJsonResponse(response, 502, {
      message: error instanceof Error ? error.message : "B 站登录失败",
    });
  }
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

function handleBilibiliDirectAudioWebApiRequest(
  request: IncomingMessage,
  response: ServerResponse,
  next: () => void,
) {
  if (request.method !== "GET" || !request.url?.startsWith("/api/bilibili/")) {
    next();
    return;
  }

  const requestUrl = new URL(request.url, "http://localhost");
  if (requestUrl.pathname === "/api/bilibili/direct-audio") {
    void resolveBilibiliDirectAudioForDevApi(requestUrl)
      .then((payload) => {
        writeJsonResponse(response, 200, payload);
      })
      .catch((error: unknown) => {
        writeJsonResponse(response, 502, {
          message:
            error instanceof Error ? error.message : "解析 B 站直连音频失败",
        });
      });
    return;
  }

  if (
    requestUrl.pathname === "/api/bilibili/media-proxy" ||
    requestUrl.pathname === "/api/bilibili/audio-proxy"
  ) {
    void proxyBilibiliMediaForDevApi(request, response, requestUrl).catch(
      (error: unknown) => {
        if (response.headersSent) {
          response.destroy(error instanceof Error ? error : undefined);
          return;
        }

        writeJsonResponse(response, 502, {
          message:
            error instanceof Error ? error.message : "代理 B 站媒体失败",
        });
      },
    );
    return;
  }

  next();
}

function bilibiliCreatorDevApiPlugin(): Plugin {
  return {
    name: "sleep-companion-bilibili-creator-dev-api",
    configureServer(server) {
      preloadBilibiliWebAuthSession();
      server.middlewares.use((request, response, next) => {
        void handleBilibiliAuthWebApiRequest(request, response, next);
      });
      server.middlewares.use(handleBilibiliDirectAudioWebApiRequest);
      server.middlewares.use(handleBilibiliCreatorWebApiRequest);
    },
    configurePreviewServer(server) {
      preloadBilibiliWebAuthSession();
      server.middlewares.use((request, response, next) => {
        void handleBilibiliAuthWebApiRequest(request, response, next);
      });
      server.middlewares.use(handleBilibiliDirectAudioWebApiRequest);
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
