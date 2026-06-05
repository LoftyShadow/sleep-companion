import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BilibiliAuthClient } from "./bilibiliAuth";
import { useBilibiliAuth } from "./useBilibiliAuth";

function createAuthClient(
  overrides: Partial<BilibiliAuthClient> = {},
): BilibiliAuthClient {
  return {
    createLoginQr: vi.fn().mockResolvedValue({
      expiresInSeconds: 180,
      qrSvg: "<svg />",
      qrcodeKey: "qr-key",
      url: "https://passport.bilibili.com/qrcode",
    }),
    getStatus: vi.fn().mockResolvedValue({
      account: undefined,
      isLoggedIn: false,
    }),
    importCookies: vi.fn().mockResolvedValue({
      account: {
        mid: "123456",
        name: "测试账号",
      },
      message: "Cookie 导入成功",
    }),
    logout: vi.fn().mockResolvedValue(undefined),
    openWebLogin: vi.fn().mockResolvedValue(undefined),
    pollLoginQr: vi.fn().mockResolvedValue({
      account: {
        avatarUrl: "https://i0.hdslb.com/avatar.jpg",
        mid: "123456",
        name: "测试账号",
      },
      message: "登录成功",
      state: "success",
    }),
    syncWebLogin: vi.fn().mockResolvedValue({
      account: {
        mid: "123456",
        name: "测试账号",
      },
      message: "网页登录已同步",
    }),
    ...overrides,
  };
}

describe("useBilibiliAuth", () => {
  it("loads existing login status", async () => {
    const authClient = createAuthClient({
      getStatus: vi.fn().mockResolvedValue({
        account: {
          mid: "123456",
          name: "测试账号",
        },
        isLoggedIn: true,
      }),
    });

    const { result } = renderHook(() => useBilibiliAuth(authClient));

    await waitFor(() => {
      expect(result.current.isLoadingStatus).toBe(false);
    });
    expect(result.current.account).toEqual({
      mid: "123456",
      name: "测试账号",
    });
    expect(result.current.statusMessage).toBe("B 站已登录");
  });

  it("creates qr and completes login after polling", async () => {
    const authClient = createAuthClient();
    const { result } = renderHook(() => useBilibiliAuth(authClient));

    await waitFor(() => {
      expect(result.current.isLoadingStatus).toBe(false);
    });

    vi.useFakeTimers();
    await act(async () => {
      await result.current.createLoginQr();
    });
    expect(result.current.loginState).toBe("pending");
    expect(result.current.qr?.qrcodeKey).toBe("qr-key");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });

    expect(authClient.pollLoginQr).toHaveBeenCalledWith("qr-key");
    expect(result.current.loginState).toBe("success");
    expect(result.current.account?.name).toBe("测试账号");
    expect(result.current.qr).toBeNull();
    vi.useRealTimers();
  });

  it("opens web login and syncs account cookies", async () => {
    const authClient = createAuthClient();
    const { result } = renderHook(() => useBilibiliAuth(authClient));

    await waitFor(() => {
      expect(result.current.isLoadingStatus).toBe(false);
    });

    await act(async () => {
      await result.current.openWebLogin();
    });
    expect(authClient.openWebLogin).toHaveBeenCalled();
    expect(result.current.statusMessage).toBe("请在打开的 B 站官方页面完成登录");

    await act(async () => {
      await result.current.syncWebLogin();
    });

    expect(authClient.syncWebLogin).toHaveBeenCalled();
    expect(result.current.loginState).toBe("success");
    expect(result.current.account?.name).toBe("测试账号");
    expect(result.current.statusMessage).toBe("网页登录已同步");
  });

  it("imports cookie text and stores only account summary in state", async () => {
    const authClient = createAuthClient();
    const { result } = renderHook(() => useBilibiliAuth(authClient));

    await waitFor(() => {
      expect(result.current.isLoadingStatus).toBe(false);
    });

    await act(async () => {
      await result.current.importCookies("SESSDATA=sess-secret");
    });

    expect(authClient.importCookies).toHaveBeenCalledWith("SESSDATA=sess-secret");
    expect(result.current.loginState).toBe("success");
    expect(result.current.account).toEqual({
      mid: "123456",
      name: "测试账号",
    });
    expect(JSON.stringify(result.current)).not.toContain("sess-secret");
  });

  it("logs out and clears account state", async () => {
    const authClient = createAuthClient({
      getStatus: vi.fn().mockResolvedValue({
        account: {
          mid: "123456",
          name: "测试账号",
        },
        isLoggedIn: true,
      }),
    });
    const { result } = renderHook(() => useBilibiliAuth(authClient));

    await waitFor(() => {
      expect(result.current.isLoggedIn).toBe(true);
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(authClient.logout).toHaveBeenCalled();
    expect(result.current.account).toBeNull();
    expect(result.current.statusMessage).toBe("未登录 B 站");
  });
});
