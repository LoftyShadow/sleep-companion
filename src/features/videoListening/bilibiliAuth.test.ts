import { describe, expect, it, vi } from "vitest";
import {
  createBilibiliAuthClient,
  createBilibiliWebAuthClient,
  normalizeBilibiliAuthStatus,
  normalizeBilibiliLoginPollResult,
  normalizeBilibiliLoginQr,
} from "./bilibiliAuth";

describe("bilibiliAuth", () => {
  it("normalizes logged-in status without exposing credentials", () => {
    const status = normalizeBilibiliAuthStatus({
      account: {
        avatarUrl: "https://i0.hdslb.com/avatar.jpg",
        mid: " 123456 ",
        name: " 测试账号 ",
      },
      expiresAt: 1780000000,
      isLoggedIn: true,
      updatedAt: 1770000000,
    });

    expect(status).toEqual({
      account: {
        avatarUrl: "https://i0.hdslb.com/avatar.jpg",
        mid: "123456",
        name: "测试账号",
      },
      expiresAt: 1780000000,
      isLoggedIn: true,
      updatedAt: 1770000000,
    });
    expect(JSON.stringify(status)).not.toContain("SESSDATA");
  });

  it("normalizes login qr and poll states", () => {
    expect(
      normalizeBilibiliLoginQr({
        expiresInSeconds: 180,
        qrSvg: " <svg /> ",
        qrcodeKey: " key ",
        url: " https://passport.bilibili.com/qrcode ",
      }),
    ).toEqual({
      expiresInSeconds: 180,
      qrSvg: "<svg />",
      qrcodeKey: "key",
      url: "https://passport.bilibili.com/qrcode",
    });

    expect(
      normalizeBilibiliLoginPollResult({
        message: "已扫码",
        state: "scanned",
      }),
    ).toEqual({
      account: undefined,
      message: "已扫码",
      state: "scanned",
    });
  });

  it("rejects invalid auth response shapes", () => {
    expect(() => normalizeBilibiliAuthStatus({ isLoggedIn: "yes" })).toThrow(
      "B 站登录状态响应格式不正确",
    );
    expect(() =>
      normalizeBilibiliLoginPollResult({ state: "unknown" }),
    ).toThrow("B 站登录轮询状态不正确");
  });

  it("calls Tauri commands without sending credentials from the frontend", async () => {
    const invoke = vi.fn().mockImplementation((command: string) => {
      if (command === "get_bilibili_auth_status") {
        return Promise.resolve({ account: null, isLoggedIn: false });
      }
      if (command === "create_bilibili_login_qr") {
        return Promise.resolve({
          expiresInSeconds: 180,
          qrSvg: "<svg />",
          qrcodeKey: "qr-key",
          url: "https://passport.bilibili.com/qrcode",
        });
      }
      if (command === "poll_bilibili_login_qr") {
        return Promise.resolve({ state: "pending" });
      }
      return Promise.resolve(null);
    });
    const client = createBilibiliAuthClient(invoke);

    await expect(client.getStatus()).resolves.toEqual({
      account: undefined,
      expiresAt: undefined,
      isLoggedIn: false,
      updatedAt: undefined,
    });
    await expect(client.createLoginQr()).resolves.toEqual({
      expiresInSeconds: 180,
      qrSvg: "<svg />",
      qrcodeKey: "qr-key",
      url: "https://passport.bilibili.com/qrcode",
    });
    await expect(client.pollLoginQr("qr-key")).resolves.toEqual({
      account: undefined,
      message: undefined,
      state: "pending",
    });
    await client.logout();

    expect(invoke).toHaveBeenCalledWith("poll_bilibili_login_qr", {
      qrcodeKey: "qr-key",
    });
    expect(JSON.stringify(invoke.mock.calls)).not.toContain("SESSDATA");
  });

  it("uses the Web auth API outside Tauri", async () => {
    type WebAuthFetchResponse = Pick<Response, "ok" | "status" | "text">;
    type WebAuthFetch = (
      input: string,
      init?: RequestInit,
    ) => Promise<WebAuthFetchResponse>;

    const fetchMock = vi.fn<WebAuthFetch>((input) => {
      const url = new URL(input, "http://localhost");
      if (url.pathname === "/api/bilibili/auth/status") {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue(
            JSON.stringify({
              account: null,
              isLoggedIn: false,
            }),
          ),
        });
      }
      if (url.pathname === "/api/bilibili/auth/login-qr") {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue(
            JSON.stringify({
              expiresInSeconds: 180,
              qrSvg: "<svg />",
              qrcodeKey: "qr-key",
              url: "https://passport.bilibili.com/qrcode",
            }),
          ),
        });
      }
      if (url.pathname === "/api/bilibili/auth/login-poll") {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue(
            JSON.stringify({
              account: {
                mid: "123456",
                name: "测试账号",
              },
              message: "登录成功",
              state: "success",
            }),
          ),
        });
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue("{}"),
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = createBilibiliWebAuthClient("");

    await expect(client.getStatus()).resolves.toEqual({
      account: undefined,
      expiresAt: undefined,
      isLoggedIn: false,
      updatedAt: undefined,
    });
    await expect(client.createLoginQr()).resolves.toEqual({
      expiresInSeconds: 180,
      qrSvg: "<svg />",
      qrcodeKey: "qr-key",
      url: "https://passport.bilibili.com/qrcode",
    });
    await expect(client.pollLoginQr("qr-key")).resolves.toEqual({
      account: {
        avatarUrl: undefined,
        mid: "123456",
        name: "测试账号",
      },
      message: "登录成功",
      state: "success",
    });
    await client.logout();

    const requestedUrls = fetchMock.mock.calls.map(([input]) => input);

    expect(requestedUrls).toEqual([
      "/api/bilibili/auth/status",
      "/api/bilibili/auth/login-qr",
      "/api/bilibili/auth/login-poll",
      "/api/bilibili/auth/logout",
    ]);
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({
      body: JSON.stringify({ qrcodeKey: "qr-key" }),
      method: "POST",
    });
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain("SESSDATA");
  });
});
