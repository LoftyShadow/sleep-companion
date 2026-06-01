import { describe, expect, it, vi } from "vitest";
import {
  loginWithPassword,
  resolveBackendBaseUrl,
  type PasswordLoginResult,
} from "./authApi";

const LOGIN_RESULT: PasswordLoginResult = {
  accessToken: "access-token",
  accessTokenExpiresInSeconds: 900,
  refreshToken: "refresh-token",
  user: {
    displayName: "梦伴用户",
    email: "user@example.com",
    id: "739182738912312320",
  },
};

function createJsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
    },
    status,
  });
}

describe("authApi", () => {
  it("uses the local backend URL by default and removes trailing slashes", () => {
    expect(resolveBackendBaseUrl()).toBe("http://127.0.0.1:3817");
    expect(resolveBackendBaseUrl(" https://api.example.com/// ")).toBe(
      "https://api.example.com",
    );
  });

  it("posts password credentials and returns the login result", async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(
        createJsonResponse(
          {
            code: "ok",
            data: LOGIN_RESULT,
            message: "ok",
            requestId: "req_login",
          },
          200,
        ),
      ),
    );

    await expect(
      loginWithPassword(
        {
          email: "user@example.com",
          password: "secret123",
        },
        {
          baseUrl: "http://backend.test/",
          fetcher,
        },
      ),
    ).resolves.toEqual(LOGIN_RESULT);

    expect(fetcher).toHaveBeenCalledWith("http://backend.test/api/auth/login", {
      body: JSON.stringify({
        email: "user@example.com",
        password: "secret123",
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });
  });

  it("keeps the backend error code and request ID", async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(
        createJsonResponse(
          {
            code: "auth.invalid_credentials",
            data: null,
            details: {},
            message: "邮箱或密码错误",
            requestId: "req_invalid",
          },
          401,
        ),
      ),
    );

    await expect(
      loginWithPassword(
        {
          email: "user@example.com",
          password: "wrong-password",
        },
        { fetcher },
      ),
    ).rejects.toMatchObject({
      code: "auth.invalid_credentials",
      message: "邮箱或密码错误",
      requestId: "req_invalid",
      status: 401,
    });
  });

  it("converts transport failures into a stable login error", async () => {
    const fetcher = vi.fn(() => Promise.reject(new Error("offline")));

    await expect(
      loginWithPassword(
        {
          email: "user@example.com",
          password: "secret123",
        },
        { fetcher },
      ),
    ).rejects.toMatchObject({
      code: "auth.network_error",
      message: "暂时无法连接登录服务",
    });
  });
});
