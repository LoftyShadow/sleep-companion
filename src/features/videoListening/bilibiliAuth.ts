import {
  createSafeTauriInvoke,
  hasTauriInvoke,
  type InvokeFn,
} from "./tauriInvoke";

export interface BilibiliAuthAccount {
  avatarUrl?: string;
  mid: string;
  name: string;
}

export interface BilibiliAuthStatus {
  account?: BilibiliAuthAccount;
  expiresAt?: number;
  isLoggedIn: boolean;
  updatedAt?: number;
}

export interface BilibiliLoginQr {
  expiresInSeconds: number;
  qrSvg: string;
  qrcodeKey: string;
  url: string;
}

export type BilibiliLoginPollState =
  | "error"
  | "expired"
  | "pending"
  | "scanned"
  | "success";

export interface BilibiliLoginPollResult {
  account?: BilibiliAuthAccount;
  message?: string;
  state: BilibiliLoginPollState;
}

export interface BilibiliCookieLoginResult {
  account?: BilibiliAuthAccount;
  message: string;
}

export interface BilibiliAuthClient {
  createLoginQr: () => Promise<BilibiliLoginQr>;
  getStatus: () => Promise<BilibiliAuthStatus>;
  importCookies: (cookieText: string) => Promise<BilibiliCookieLoginResult>;
  logout: () => Promise<void>;
  openWebLogin: () => Promise<void>;
  pollLoginQr: (qrcodeKey: string) => Promise<BilibiliLoginPollResult>;
  syncWebLogin: () => Promise<BilibiliCookieLoginResult>;
}

const DEFAULT_WEB_AUTH_API_BASE_URL = "";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function isBilibiliAuthAccount(value: unknown): value is BilibiliAuthAccount {
  const account = asRecord(value);

  return (
    Boolean(account) &&
    typeof account?.mid === "string" &&
    account.mid.trim().length > 0 &&
    typeof account.name === "string" &&
    account.name.trim().length > 0 &&
    (account.avatarUrl === undefined || typeof account.avatarUrl === "string")
  );
}

export function normalizeBilibiliAuthStatus(
  response: unknown,
): BilibiliAuthStatus {
  const status = asRecord(response);
  if (!status || typeof status.isLoggedIn !== "boolean") {
    throw new Error("B 站登录状态响应格式不正确");
  }

  const account =
    status.account === undefined || status.account === null
      ? undefined
      : status.account;
  if (account !== undefined && !isBilibiliAuthAccount(account)) {
    throw new Error("B 站登录账号响应格式不正确");
  }

  return {
    account: account ? normalizeBilibiliAuthAccount(account) : undefined,
    expiresAt:
      typeof status.expiresAt === "number" ? status.expiresAt : undefined,
    isLoggedIn: status.isLoggedIn,
    updatedAt:
      typeof status.updatedAt === "number" ? status.updatedAt : undefined,
  };
}

export function normalizeBilibiliLoginQr(response: unknown): BilibiliLoginQr {
  const qr = asRecord(response);
  if (
    !qr ||
    typeof qr.expiresInSeconds !== "number" ||
    typeof qr.qrSvg !== "string" ||
    typeof qr.qrcodeKey !== "string" ||
    typeof qr.url !== "string" ||
    qr.qrSvg.trim().length === 0 ||
    qr.qrcodeKey.trim().length === 0 ||
    qr.url.trim().length === 0
  ) {
    throw new Error("B 站登录二维码响应格式不正确");
  }

  return {
    expiresInSeconds: qr.expiresInSeconds,
    qrSvg: qr.qrSvg.trim(),
    qrcodeKey: qr.qrcodeKey.trim(),
    url: qr.url.trim(),
  };
}

export function normalizeBilibiliLoginPollResult(
  response: unknown,
): BilibiliLoginPollResult {
  const result = asRecord(response);
  if (!result || typeof result.state !== "string") {
    throw new Error("B 站登录轮询响应格式不正确");
  }

  if (!isBilibiliLoginPollState(result.state)) {
    throw new Error("B 站登录轮询状态不正确");
  }

  const account =
    result.account === undefined || result.account === null
      ? undefined
      : result.account;
  if (account !== undefined && !isBilibiliAuthAccount(account)) {
    throw new Error("B 站登录账号响应格式不正确");
  }

  return {
    account: account ? normalizeBilibiliAuthAccount(account) : undefined,
    message: typeof result.message === "string" ? result.message : undefined,
    state: result.state,
  };
}

export function normalizeBilibiliCookieLoginResult(
  response: unknown,
): BilibiliCookieLoginResult {
  const result = asRecord(response);
  if (!result || typeof result.message !== "string") {
    throw new Error("B 站 Cookie 登录响应格式不正确");
  }

  const account =
    result.account === undefined || result.account === null
      ? undefined
      : result.account;
  if (account !== undefined && !isBilibiliAuthAccount(account)) {
    throw new Error("B 站登录账号响应格式不正确");
  }

  return {
    account: account ? normalizeBilibiliAuthAccount(account) : undefined,
    message: result.message.trim() || "B 站登录成功",
  };
}

function isBilibiliLoginPollState(
  value: string,
): value is BilibiliLoginPollState {
  return ["error", "expired", "pending", "scanned", "success"].includes(value);
}

function normalizeBilibiliAuthAccount(
  account: BilibiliAuthAccount,
): BilibiliAuthAccount {
  return {
    avatarUrl: account.avatarUrl,
    mid: account.mid.trim(),
    name: account.name.trim(),
  };
}

function normalizeWebAuthApiBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/u, "");
}

function readWebAuthApiBaseUrl(): string {
  const env = import.meta.env as { VITE_BILIBILI_API_BASE_URL?: string };

  return env.VITE_BILIBILI_API_BASE_URL ?? DEFAULT_WEB_AUTH_API_BASE_URL;
}

function bilibiliAuthApiUrl(baseUrl: string, path: string): string {
  return `${normalizeWebAuthApiBaseUrl(baseUrl)}/api/bilibili/auth/${path}`;
}

async function parseWebAuthResponse(response: Response): Promise<unknown> {
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
      : `Web API 请求 B 站登录失败：HTTP ${response.status}`;

  throw new Error(message);
}

export function createBilibiliAuthClient(
  invoke: InvokeFn = createSafeTauriInvoke("当前环境不能登录 B 站"),
): BilibiliAuthClient {
  return {
    async createLoginQr() {
      return normalizeBilibiliLoginQr(
        await invoke("create_bilibili_login_qr"),
      );
    },
    async getStatus() {
      return normalizeBilibiliAuthStatus(
        await invoke("get_bilibili_auth_status"),
      );
    },
    async importCookies(cookieText) {
      return normalizeBilibiliCookieLoginResult(
        await invoke("import_bilibili_login_cookies", { cookieText }),
      );
    },
    async logout() {
      await invoke("logout_bilibili");
    },
    async openWebLogin() {
      await invoke("open_bilibili_web_login");
    },
    async pollLoginQr(qrcodeKey) {
      return normalizeBilibiliLoginPollResult(
        await invoke("poll_bilibili_login_qr", { qrcodeKey }),
      );
    },
    async syncWebLogin() {
      return normalizeBilibiliCookieLoginResult(
        await invoke("sync_bilibili_web_login_cookies"),
      );
    },
  };
}

export function createBilibiliWebAuthClient(
  baseUrl: string = readWebAuthApiBaseUrl(),
): BilibiliAuthClient {
  return {
    async createLoginQr() {
      const response = await fetch(bilibiliAuthApiUrl(baseUrl, "login-qr"), {
        method: "POST",
      });

      return normalizeBilibiliLoginQr(await parseWebAuthResponse(response));
    },
    async getStatus() {
      const response = await fetch(bilibiliAuthApiUrl(baseUrl, "status"));

      return normalizeBilibiliAuthStatus(await parseWebAuthResponse(response));
    },
    async importCookies(cookieText) {
      const response = await fetch(
        bilibiliAuthApiUrl(baseUrl, "cookie-import"),
        {
          body: JSON.stringify({ cookieText }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );

      return normalizeBilibiliCookieLoginResult(
        await parseWebAuthResponse(response),
      );
    },
    async logout() {
      const response = await fetch(bilibiliAuthApiUrl(baseUrl, "logout"), {
        method: "POST",
      });
      await parseWebAuthResponse(response);
    },
    openWebLogin() {
      window.open("https://passport.bilibili.com/login", "_blank", "noopener");
      return Promise.resolve();
    },
    async pollLoginQr(qrcodeKey) {
      const response = await fetch(bilibiliAuthApiUrl(baseUrl, "login-poll"), {
        body: JSON.stringify({ qrcodeKey }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      return normalizeBilibiliLoginPollResult(
        await parseWebAuthResponse(response),
      );
    },
    syncWebLogin() {
      return Promise.reject(
        new Error("当前 Web 环境不能自动同步 B 站网页登录"),
      );
    },
  };
}

export function createRuntimeBilibiliAuthClient(): BilibiliAuthClient {
  if (hasTauriInvoke()) {
    return createBilibiliAuthClient();
  }

  return createBilibiliWebAuthClient();
}

export const bilibiliAuthClient = createRuntimeBilibiliAuthClient();
