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
      state: "pending",
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

  it("opens and syncs the official web login", async () => {
    const user = userEvent.setup();
    const authClient = createAuthClient();
    render(<BilibiliLoginPanel authClient={authClient} />);

    await user.click(await screen.findByRole("button", { name: "网页登录" }));
    expect(authClient.openWebLogin).toHaveBeenCalled();
    expect(
      await screen.findByText("请在打开的 B 站官方页面完成登录"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "同步登录" }));

    expect(authClient.syncWebLogin).toHaveBeenCalled();
    expect(await screen.findByText("测试账号")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("sess-secret");
  });

  it("imports cookie text without rendering credentials", async () => {
    const user = userEvent.setup();
    const authClient = createAuthClient();
    render(<BilibiliLoginPanel authClient={authClient} />);

    await user.click(await screen.findByRole("button", { name: "Cookie 导入" }));
    await user.type(
      screen.getByLabelText("浏览器 Cookie"),
      "SESSDATA=sess-secret; bili_jct=csrf-secret",
    );
    await user.click(screen.getByRole("button", { name: "导入登录" }));

    expect(authClient.importCookies).toHaveBeenCalledWith(
      "SESSDATA=sess-secret; bili_jct=csrf-secret",
    );
    expect(await screen.findByText("测试账号")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("sess-secret");
    expect(document.body.textContent).not.toContain("csrf-secret");
  });
});
