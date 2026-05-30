import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppTitleBar } from "./AppTitleBar";

const windowControls = vi.hoisted(() => ({
  close: vi.fn<() => Promise<void>>(() => Promise.resolve()),
  isMaximized: vi.fn<() => Promise<boolean>>(() => Promise.resolve(false)),
  minimize: vi.fn<() => Promise<void>>(() => Promise.resolve()),
  startDragging: vi.fn<() => Promise<void>>(() => Promise.resolve()),
  toggleMaximize: vi.fn<() => Promise<void>>(() => Promise.resolve()),
}));

const osPlatform = vi.hoisted(() => ({
  value: "windows",
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => windowControls,
}));

vi.mock("@tauri-apps/plugin-os", () => ({
  platform: () => osPlatform.value,
}));

function setTauriRuntime(enabled: boolean) {
  if (enabled) {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });
    return;
  }

  Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
}

describe("AppTitleBar", () => {
  afterEach(() => {
    setTauriRuntime(false);
    document.documentElement.classList.remove("has-desktop-title-bar");
    osPlatform.value = "windows";
    vi.clearAllMocks();
  });

  it("does not render outside Tauri runtime", async () => {
    setTauriRuntime(false);

    render(<AppTitleBar />);

    await waitFor(() => {
      expect(screen.queryByLabelText("桌面窗口栏")).not.toBeInTheDocument();
    });
    expect(document.documentElement).not.toHaveClass("has-desktop-title-bar");
  });

  it("renders desktop controls in Tauri desktop runtime", async () => {
    setTauriRuntime(true);
    osPlatform.value = "linux";

    render(<AppTitleBar />);

    expect(await screen.findByLabelText("桌面窗口栏")).toBeInTheDocument();
    expect(screen.queryByText("Linux")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "最小化窗口" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "最大化窗口" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "关闭窗口" })).toBeInTheDocument();
    expect(document.documentElement).toHaveClass("has-desktop-title-bar");
  });

  it("does not render desktop controls on mobile Tauri runtime", async () => {
    setTauriRuntime(true);
    osPlatform.value = "android";

    render(<AppTitleBar />);

    await waitFor(() => {
      expect(screen.queryByLabelText("桌面窗口栏")).not.toBeInTheDocument();
    });
  });

  it("maps title bar buttons to window commands", async () => {
    const user = userEvent.setup();
    setTauriRuntime(true);

    render(<AppTitleBar />);

    await user.click(await screen.findByRole("button", { name: "最小化窗口" }));
    await user.click(screen.getByRole("button", { name: "最大化窗口" }));
    await user.click(screen.getByRole("button", { name: "关闭窗口" }));

    expect(windowControls.minimize).toHaveBeenCalledTimes(1);
    expect(windowControls.toggleMaximize).toHaveBeenCalledTimes(1);
    expect(windowControls.close).toHaveBeenCalledTimes(1);
  });
});
