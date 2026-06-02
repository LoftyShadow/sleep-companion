import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CUSTOM_SOUND_MAX_BATCH_BYTES,
  CUSTOM_SOUND_MAX_FILE_BYTES,
  createCustomSoundDefinition,
  getCustomSoundName,
  inferCustomAudioType,
  isSupportedCustomAudioFile,
  validateCustomSoundFilesForImport,
  type StoredCustomSound,
} from "./customSoundStore";

function createFileWithSize(name: string, size: number): File {
  const file = new File(["audio"], name, { type: "audio/mpeg" });
  Object.defineProperty(file, "size", {
    configurable: true,
    value: size,
  });

  return file;
}

describe("customSoundStore", () => {
  afterEach(() => {
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: undefined,
    });
  });

  it("accepts common audio files and rejects non-audio files", () => {
    expect(
      isSupportedCustomAudioFile(
        new File(["audio"], "rain.mp3", { type: "audio/mpeg" }),
      ),
    ).toBe(true);
    expect(
      isSupportedCustomAudioFile(
        new File(["audio"], "rain.bin", { type: "audio/unknown" }),
      ),
    ).toBe(false);
    expect(isSupportedCustomAudioFile(new File(["audio"], "wind.ogg"))).toBe(
      true,
    );
    expect(
      isSupportedCustomAudioFile(
        new File(["text"], "note.txt", { type: "text/plain" }),
      ),
    ).toBe(false);
  });

  it("creates stable display names and mime types from files", () => {
    expect(getCustomSoundName("  rain night.mp3")).toBe("rain night");
    expect(getCustomSoundName(".mp3")).toBe("自定义音频");
    expect(inferCustomAudioType(new File(["audio"], "focus.m4a"))).toBe(
      "audio/mp4",
    );
    expect(
      inferCustomAudioType(
        new File(["audio"], "focus.mp3", { type: "audio/unknown" }),
      ),
    ).toBe("audio/mpeg");
  });

  it("converts a stored record into a custom sound definition", () => {
    const record: StoredCustomSound = {
      id: "custom:test",
      name: "夜间电台",
      type: "audio/mpeg",
      blob: new Blob(["audio"], { type: "audio/mpeg" }),
      createdAt: 1,
    };

    expect(createCustomSoundDefinition(record, "blob:test")).toEqual({
      id: "custom:test",
      name: "夜间电台",
      sourceKind: "custom",
      imageSrc: "/images/sounds/typewriter.webp",
      sources: [{ src: "blob:test", type: "audio/mpeg" }],
    });
  });

  it("rejects a custom sound file above the single file size limit", async () => {
    await expect(
      validateCustomSoundFilesForImport([
        createFileWithSize("huge.mp3", CUSTOM_SOUND_MAX_FILE_BYTES + 1),
      ]),
    ).rejects.toThrow("单个音频不能超过 100 MB：huge.mp3");
  });

  it("rejects a custom sound batch above the batch size limit", async () => {
    await expect(
      validateCustomSoundFilesForImport([
        createFileWithSize("rain.mp3", CUSTOM_SOUND_MAX_BATCH_BYTES / 4 + 1),
        createFileWithSize("wind.mp3", CUSTOM_SOUND_MAX_BATCH_BYTES / 4 + 1),
        createFileWithSize("fire.mp3", CUSTOM_SOUND_MAX_BATCH_BYTES / 4 + 1),
        createFileWithSize("river.mp3", CUSTOM_SOUND_MAX_BATCH_BYTES / 4 + 1),
      ]),
    ).rejects.toThrow("批量添加音频不能超过 300 MB");
  });

  it("rejects imports when estimated local storage is too low", async () => {
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: {
        estimate: vi.fn(() =>
          Promise.resolve({
            quota: 20 * 1024 * 1024,
            usage: 10 * 1024 * 1024,
          }),
        ),
      },
    });

    await expect(
      validateCustomSoundFilesForImport([
        createFileWithSize("rain.mp3", 1 * 1024 * 1024),
      ]),
    ).rejects.toThrow("本地存储空间不足，请移除一些自定义音频后再添加");
  });
});
