import { createAndroidNativeTtsEngine } from "./androidNativeTtsEngine";
import { createLinuxNativeTtsEngine } from "./nativeTtsEngine";
import { createSystemTtsEngine } from "./systemTtsEngine";
import type { TtsEnginePort } from "./TtsEnginePort";

interface TtsRuntimeProbe {
  hasTauriInternals: boolean;
  userAgent: string;
}

interface CreateTtsEngineOptions {
  runtimeProbe?: TtsRuntimeProbe;
  createAndroidEngine?: () => TtsEnginePort;
  createLinuxEngine?: () => TtsEnginePort;
  createSystemEngine?: () => TtsEnginePort;
}

function getRuntimeProbe(): TtsRuntimeProbe {
  if (typeof window === "undefined") {
    return {
      hasTauriInternals: false,
      userAgent: "",
    };
  }

  return {
    hasTauriInternals: "__TAURI_INTERNALS__" in window,
    userAgent: window.navigator.userAgent,
  };
}

function isLinuxDesktopTauriRuntime(runtimeProbe: TtsRuntimeProbe): boolean {
  return (
    runtimeProbe.hasTauriInternals &&
    /\bLinux\b/i.test(runtimeProbe.userAgent) &&
    !/\bAndroid\b/i.test(runtimeProbe.userAgent)
  );
}

function isAndroidTauriRuntime(runtimeProbe: TtsRuntimeProbe): boolean {
  return (
    runtimeProbe.hasTauriInternals &&
    /\bAndroid\b/i.test(runtimeProbe.userAgent)
  );
}

export function createTtsEngine(
  options: CreateTtsEngineOptions = {},
): TtsEnginePort {
  const runtimeProbe = options.runtimeProbe ?? getRuntimeProbe();
  const createAndroidEngine =
    options.createAndroidEngine ?? (() => createAndroidNativeTtsEngine());
  const createLinuxEngine =
    options.createLinuxEngine ?? (() => createLinuxNativeTtsEngine());
  const createSystemEngine =
    options.createSystemEngine ?? (() => createSystemTtsEngine());

  if (isAndroidTauriRuntime(runtimeProbe)) {
    return createAndroidEngine();
  }

  if (isLinuxDesktopTauriRuntime(runtimeProbe)) {
    return createLinuxEngine();
  }

  return createSystemEngine();
}
