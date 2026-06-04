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
    logout: vi.fn().mockResolvedValue(undefined),
    pollLoginQr: vi.fn().mockResolvedValue({
      account: {
        avatarUrl: "https://i0.hdslb.com/avatar.jpg",
        mid: "123456",
        name: "测试账号",
      },
      message: "登录成功",
      state: "success",
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
