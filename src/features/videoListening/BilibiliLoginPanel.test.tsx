import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { BilibiliAuthClient } from "./bilibiliAuth";
import { BilibiliLoginPanel } from "./BilibiliLoginPanel";

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
      state: "pending",
    }),
    ...overrides,
  };
}

describe("BilibiliLoginPanel", () => {
  it("shows logged-in account summary without credentials", async () => {
    render(
      <BilibiliLoginPanel
        authClient={createAuthClient({
          getStatus: vi.fn().mockResolvedValue({
            account: {
              avatarUrl: "https://i0.hdslb.com/avatar.jpg",
              mid: "123456",
              name: "测试账号",
            },
            isLoggedIn: true,
          }),
        })}
      />,
    );

    expect(await screen.findByText("测试账号")).toBeInTheDocument();
    expect(screen.getByText("mid 123456")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "退出登录" })).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("SESSDATA");
    expect(document.body.textContent).not.toContain("bili_jct");
  });

  it("requests and renders a login qr", async () => {
    const user = userEvent.setup();
    const authClient = createAuthClient();
    render(<BilibiliLoginPanel authClient={authClient} />);

    await user.click(await screen.findByRole("button", { name: "扫码登录" }));

    expect(authClient.createLoginQr).toHaveBeenCalled();
    expect(await screen.findByAltText("B 站登录二维码")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText("等待扫码确认").length).toBeGreaterThan(0);
    });
  });
});
