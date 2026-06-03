import { invoke as tauriInvoke } from "@tauri-apps/api/core";

export type InvokeFn = (
  cmd: string,
  args?: Record<string, unknown>,
) => Promise<unknown>;

export function hasTauriInvoke(): boolean {
  const tauriInternals = (
    globalThis as {
      __TAURI_INTERNALS__?: {
        invoke?: unknown;
      };
    }
  ).__TAURI_INTERNALS__;

  return typeof tauriInternals?.invoke === "function";
}

export function createSafeTauriInvoke(unavailableMessage: string): InvokeFn {
  return async (cmd, args) => {
    if (!hasTauriInvoke()) {
      throw new Error(unavailableMessage);
    }

    return tauriInvoke(cmd, args);
  };
}
