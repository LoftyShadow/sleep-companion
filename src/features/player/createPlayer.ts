import type { PlayerPort } from "./PlayerPort";
import { createAndroidHybridPlayer } from "./androidHybridPlayer";
import { createWebAudioPlayer } from "./webAudioPlayer";

type RuntimePlatform = "web" | "linux" | "windows" | "android" | "unknown";

interface CreatePlayerOptions<TPlayer = PlayerPort> {
  detectPlatform?: () => Promise<RuntimePlatform>;
  createWebPlayer?: () => TPlayer;
  createAndroidPlayer?: () => TPlayer;
}

async function detectPlatform(): Promise<RuntimePlatform> {
  if (!("__TAURI_INTERNALS__" in window)) {
    return "web";
  }

  const { platform } = await import("@tauri-apps/plugin-os");
  const value = platform();
  if (value === "android") {
    return "android";
  }
  if (value === "linux") {
    return "linux";
  }
  if (value === "windows") {
    return "windows";
  }
  return "unknown";
}

export async function createPlayer<TPlayer = PlayerPort>(
  options: CreatePlayerOptions<TPlayer> = {},
): Promise<TPlayer> {
  const platformDetector = options.detectPlatform ?? detectPlatform;
  const createWebPlayer =
    options.createWebPlayer ?? (() => createWebAudioPlayer() as TPlayer);
  const createAndroidPlayer =
    options.createAndroidPlayer ?? (() => createAndroidHybridPlayer() as TPlayer);

  try {
    const runtimePlatform = await platformDetector();
    if (runtimePlatform === "android") {
      return createAndroidPlayer();
    }
  } catch {
    return createWebPlayer();
  }

  return createWebPlayer();
}
