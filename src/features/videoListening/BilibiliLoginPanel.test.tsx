import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { BilibiliAuthClient } from "./bilibiliAuth";
import { BilibiliLoginPanel } from "./BilibiliLoginPanel";

function createAuthClient(
  overrides: Partial<BilibiliAuthClient> = {},
): BilibiliAuthClient {
  return {
    canSyncWebLogin: true,
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
    expect(screen.getByText("已登录")).toBeInTheDocument();
    expect(screen.queryByText("mid 123456")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "退出登录" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "账号" })).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("SESSDATA");
    expect(document.body.textContent).not.toContain("bili_jct");
  });

  it("requires opening account actions before logging out", async () => {
    const user = userEvent.setup();
    const authClient = createAuthClient({
      getStatus: vi.fn().mockResolvedValue({
        account: {
          avatarUrl: "https://i0.hdslb.com/avatar.jpg",
          mid: "123456",
          name: "测试账号",
        },
        isLoggedIn: true,
      }),
    });
    render(<BilibiliLoginPanel authClient={authClient} />);

    expect(await screen.findByText("测试账号")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "退出登录" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "账号" }));

    expect(await screen.findByLabelText("B 站账号操作")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "退出登录" }));

    expect(authClient.logout).toHaveBeenCalled();
    expect(await screen.findByText("未登录 B 站")).toBeInTheDocument();
  });

  it("opens account actions from the logged-in avatar without logging out immediately", async () => {
    const user = userEvent.setup();
    const authClient = createAuthClient({
      getStatus: vi.fn().mockResolvedValue({
        account: {
          avatarUrl: "https://i0.hdslb.com/avatar.jpg",
          mid: "123456",
          name: "测试账号",
        },
        isLoggedIn: true,
      }),
    });
    render(<BilibiliLoginPanel authClient={authClient} variant="avatar" />);

    await user.click(await screen.findByRole("button", { name: "B 站账号" }));

    expect(authClient.logout).not.toHaveBeenCalled();
    expect(await screen.findByLabelText("B 站账号操作")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "退出登录" })).toBeInTheDocument();
  });

  it("closes the compact account popover when clicking outside", async () => {
    const user = userEvent.setup();
    const authClient = createAuthClient({
      getStatus: vi.fn().mockResolvedValue({
        account: {
          avatarUrl: "https://i0.hdslb.com/avatar.jpg",
          mid: "123456",
          name: "测试账号",
        },
        isLoggedIn: true,
      }),
    });
    render(
      <>
        <button type="button">面板外区域</button>
        <BilibiliLoginPanel authClient={authClient} variant="avatar" />
      </>,
    );

    await user.click(await screen.findByRole("button", { name: "B 站账号" }));
    expect(await screen.findByLabelText("B 站账号操作")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "面板外区域" }));

    expect(screen.queryByLabelText("B 站账号操作")).not.toBeInTheDocument();
  });

  it("keeps the account popover open when clicking inside it", async () => {
    const user = userEvent.setup();
    const authClient = createAuthClient({
      getStatus: vi.fn().mockResolvedValue({
        account: {
          avatarUrl: "https://i0.hdslb.com/avatar.jpg",
          mid: "123456",
          name: "测试账号",
        },
        isLoggedIn: true,
      }),
    });
    render(<BilibiliLoginPanel authClient={authClient} variant="avatar" />);

    await user.click(await screen.findByRole("button", { name: "B 站账号" }));
    await user.click(await screen.findByText("确认退出 B 站账号"));

    expect(screen.getByLabelText("B 站账号操作")).toBeInTheDocument();
    expect(authClient.logout).not.toHaveBeenCalled();
  });

  it("uses the avatar as the compact login trigger", async () => {
    const user = userEvent.setup();
    const authClient = createAuthClient();
    render(<BilibiliLoginPanel authClient={authClient} variant="avatar" />);

    await user.click(await screen.findByRole("button", { name: "登录 B 站" }));

    expect(await screen.findByLabelText("B 站登录方式")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "登录" })).not.toBeInTheDocument();
  });

  it("keeps avatar login qr inside the compact login popover", async () => {
    const user = userEvent.setup();
    const authClient = createAuthClient();
    render(<BilibiliLoginPanel authClient={authClient} variant="avatar" />);

    await user.click(await screen.findByRole("button", { name: "登录 B 站" }));
    await user.click(await screen.findByRole("button", { name: "扫码登录" }));

    const loginPopover = await screen.findByLabelText("B 站登录操作");
    expect(authClient.createLoginQr).toHaveBeenCalled();
    expect(
      await screen.findByAltText("B 站登录二维码"),
    ).toBeInTheDocument();
    expect(loginPopover).toContainElement(screen.getByAltText("B 站登录二维码"));
  });

  it("requests and renders a login qr", async () => {
    const user = userEvent.setup();
    const authClient = createAuthClient();
    render(<BilibiliLoginPanel authClient={authClient} />);

    await user.click(await screen.findByRole("button", { name: "登录" }));
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

    await user.click(await screen.findByRole("button", { name: "登录" }));
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

  it("hides external web login sync when the runtime cannot reuse browser cookies", async () => {
    const user = userEvent.setup();
    const authClient = createAuthClient({
      canSyncWebLogin: false,
    });
    render(<BilibiliLoginPanel authClient={authClient} />);

    await user.click(await screen.findByRole("button", { name: "登录" }));

    expect(
      screen.queryByRole("button", { name: "网页登录" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "同步登录" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "扫码登录" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cookie 导入" }),
    ).toBeInTheDocument();
  });

  it("imports cookie text without rendering credentials", async () => {
    const user = userEvent.setup();
    const authClient = createAuthClient();
    render(<BilibiliLoginPanel authClient={authClient} />);

    await user.click(await screen.findByRole("button", { name: "登录" }));
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
