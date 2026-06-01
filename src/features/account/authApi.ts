const DEFAULT_BACKEND_BASE_URL = "http://127.0.0.1:3817";
const LOGIN_PATH = "/api/auth/login";

export interface PasswordLoginCredentials {
  email: string;
  password: string;
}

export interface AuthenticatedUser {
  displayName: string | null;
  email: string;
  id: string;
}

export interface PasswordLoginResult {
  accessToken: string;
  accessTokenExpiresInSeconds: number;
  refreshToken: string;
  user: AuthenticatedUser;
}

export type PasswordLogin = (
  credentials: PasswordLoginCredentials,
) => Promise<PasswordLoginResult>;

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface ApiEnvelope {
  code: string;
  data: unknown;
  message: string;
  requestId: string | null;
}

interface AuthApiErrorOptions {
  code: string;
  message: string;
  requestId?: string | null;
  status?: number | null;
}

export class AuthApiError extends Error {
  readonly code: string;
  readonly requestId: string | null;
  readonly status: number | null;

  constructor({
    code,
    message,
    requestId = null,
    status = null,
  }: AuthApiErrorOptions) {
    super(message);
    this.name = "AuthApiError";
    this.code = code;
    this.requestId = requestId;
    this.status = status;
  }
}

export function resolveBackendBaseUrl(configuredBaseUrl?: string): string {
  const selectedBaseUrl =
    configuredBaseUrl?.trim() ||
    import.meta.env.VITE_BACKEND_BASE_URL?.trim() ||
    DEFAULT_BACKEND_BASE_URL;

  return selectedBaseUrl.replace(/\/+$/u, "");
}

export async function loginWithPassword(
  credentials: PasswordLoginCredentials,
  options: { baseUrl?: string; fetcher?: Fetcher } = {},
): Promise<PasswordLoginResult> {
  const fetcher = options.fetcher ?? fetch;
  const loginUrl = `${resolveBackendBaseUrl(options.baseUrl)}${LOGIN_PATH}`;
  let response: Response;

  try {
    response = await fetcher(loginUrl, {
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });
  } catch {
    throw new AuthApiError({
      code: "auth.network_error",
      message: "暂时无法连接登录服务",
    });
  }

  const envelope = await readEnvelope(response);

  if (!response.ok || envelope.code !== "ok") {
    throw new AuthApiError({
      code: envelope.code || `http.${response.status}`,
      message: envelope.message || "登录失败",
      requestId: envelope.requestId,
      status: response.status,
    });
  }

  return parsePasswordLoginResult(envelope.data);
}

async function readEnvelope(response: Response): Promise<ApiEnvelope> {
  let body: unknown;

  try {
    body = await response.json();
  } catch {
    throw new AuthApiError({
      code: `http.${response.status}`,
      message: response.ok ? "登录服务响应格式异常" : "登录服务暂不可用",
      status: response.status,
    });
  }

  return parseApiEnvelope(body, response.status);
}

function parseApiEnvelope(body: unknown, status: number): ApiEnvelope {
  if (!isRecord(body)) {
    throw new AuthApiError({
      code: `http.${status}`,
      message: "登录服务响应格式异常",
      status,
    });
  }

  return {
    code: readString(body, "code") ?? "",
    data: body.data,
    message: readString(body, "message") ?? "",
    requestId: readString(body, "requestId"),
  };
}

function parsePasswordLoginResult(data: unknown): PasswordLoginResult {
  if (!isRecord(data) || !isRecord(data.user)) {
    throw new AuthApiError({
      code: "auth.unexpected_response",
      message: "登录服务响应格式异常",
    });
  }

  const accessToken = readString(data, "accessToken");
  const accessTokenExpiresInSeconds = data.accessTokenExpiresInSeconds;
  const refreshToken = readString(data, "refreshToken");
  const userId = readString(data.user, "id");
  const userEmail = readString(data.user, "email");
  const displayName =
    typeof data.user.displayName === "string" ? data.user.displayName : null;

  if (
    !accessToken ||
    typeof accessTokenExpiresInSeconds !== "number" ||
    !refreshToken ||
    !userId ||
    !userEmail
  ) {
    throw new AuthApiError({
      code: "auth.unexpected_response",
      message: "登录服务响应格式异常",
    });
  }

  return {
    accessToken,
    accessTokenExpiresInSeconds,
    refreshToken,
    user: {
      displayName,
      email: userEmail,
      id: userId,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}
