import { afterEach, describe, expect, it, vi } from "vitest";
import { createSafeTauriInvoke } from "./tauriInvoke";

describe("tauriInvoke", () => {
  afterEach(() => {
    delete (
      globalThis as {
        __TAURI_INTERNALS__?: unknown;
      }
    ).__TAURI_INTERNALS__;
  });

  it("returns a clear error outside Tauri instead of leaking the raw invoke TypeError", async () => {
    const invoke = createSafeTauriInvoke("当前环境不可用");

    await expect(invoke("fetch_bilibili_creator_videos")).rejects.toThrow(
      "当前环境不可用",
    );
  });

  it("delegates to Tauri internals when invoke is available", async () => {
    const invoke = createSafeTauriInvoke("当前环境不可用");
    const tauriInvoke = vi.fn().mockResolvedValue({ ok: true });
    (
      globalThis as {
        __TAURI_INTERNALS__?: {
          invoke?: unknown;
        };
      }
    ).__TAURI_INTERNALS__ = {
      invoke: tauriInvoke,
    };

    await expect(invoke("test-command", { id: 1 })).resolves.toEqual({
      ok: true,
    });
    expect(tauriInvoke).toHaveBeenCalledWith("test-command", { id: 1 }, undefined);
  });
});
