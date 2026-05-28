import { describe, expect, it } from "vitest";
import {
  createCustomSoundDefinition,
  getCustomSoundName,
  inferCustomAudioType,
  isSupportedCustomAudioFile,
  type StoredCustomSound,
} from "./customSoundStore";

describe("customSoundStore", () => {
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
});
