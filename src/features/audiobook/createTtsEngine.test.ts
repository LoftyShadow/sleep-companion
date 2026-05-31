import { describe, expect, it, vi } from "vitest";
import { createTtsEngine } from "./createTtsEngine";
import type { TtsEnginePort } from "./TtsEnginePort";

function createEngine(engineId: string): TtsEnginePort {
  return {
    engineId,
    label: engineId,
    supportsPause: true,
    isSupported: vi.fn(() => true),
    listVoices: vi.fn(() => Promise.resolve([])),
    speak: vi.fn(() =>
      Promise.resolve({
        pause: vi.fn(),
        resume: vi.fn(),
        cancel: vi.fn(),
      }),
    ),
    cancel: vi.fn(),
    destroy: vi.fn(),
  };
}

describe("createTtsEngine", () => {
  it("uses Linux native TTS inside a Linux Tauri desktop runtime", () => {
    const androidEngine = createEngine("android-native");
    const linuxEngine = createEngine("linux-native");
    const systemEngine = createEngine("system");
    const createAndroidEngine = vi.fn(() => androidEngine);
    const createLinuxEngine = vi.fn(() => linuxEngine);
    const createSystemEngine = vi.fn(() => systemEngine);

    const engine = createTtsEngine({
      runtimeProbe: {
        hasTauriInternals: true,
        userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15",
      },
      createAndroidEngine,
      createLinuxEngine,
      createSystemEngine,
    });

    expect(engine).toBe(linuxEngine);
    expect(createAndroidEngine).not.toHaveBeenCalled();
    expect(createLinuxEngine).toHaveBeenCalledTimes(1);
    expect(createSystemEngine).not.toHaveBeenCalled();
  });

  it("uses Android native TTS inside an Android Tauri runtime", () => {
    const androidEngine = createEngine("android-native");
    const linuxEngine = createEngine("linux-native");
    const systemEngine = createEngine("system");
    const createAndroidEngine = vi.fn(() => androidEngine);
    const createLinuxEngine = vi.fn(() => linuxEngine);
    const createSystemEngine = vi.fn(() => systemEngine);

    const engine = createTtsEngine({
      runtimeProbe: {
        hasTauriInternals: true,
        userAgent: "Mozilla/5.0 (Linux; Android 15)",
      },
      createAndroidEngine,
      createLinuxEngine,
      createSystemEngine,
    });

    expect(engine).toBe(androidEngine);
    expect(createAndroidEngine).toHaveBeenCalledTimes(1);
    expect(createLinuxEngine).not.toHaveBeenCalled();
    expect(createSystemEngine).not.toHaveBeenCalled();
  });

  it("keeps browser runtimes on Web Speech", () => {
    const androidEngine = createEngine("android-native");
    const linuxEngine = createEngine("linux-native");
    const systemEngine = createEngine("system");
    const createAndroidEngine = vi.fn(() => androidEngine);
    const createLinuxEngine = vi.fn(() => linuxEngine);
    const createSystemEngine = vi.fn(() => systemEngine);

    const browserEngine = createTtsEngine({
      runtimeProbe: {
        hasTauriInternals: false,
        userAgent: "Mozilla/5.0 (X11; Linux x86_64)",
      },
      createAndroidEngine,
      createLinuxEngine,
      createSystemEngine,
    });

    expect(browserEngine).toBe(systemEngine);
    expect(createAndroidEngine).not.toHaveBeenCalled();
    expect(createLinuxEngine).not.toHaveBeenCalled();
    expect(createSystemEngine).toHaveBeenCalledTimes(1);
  });
});
