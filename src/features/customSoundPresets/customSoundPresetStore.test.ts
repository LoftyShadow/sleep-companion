import { describe, expect, it } from "vitest";
import { createMemoryFileSystem } from "../../test/storageTestDoubles";
import {
  listCustomSoundPresets,
  MAX_CUSTOM_SOUND_PRESETS,
  saveCustomSoundPreset,
} from "./customSoundPresetStore";

describe("customSoundPresetStore", () => {
  it("returns an empty list when storage does not exist", async () => {
    const fileSystem = createMemoryFileSystem();

    await expect(listCustomSoundPresets(fileSystem)).resolves.toEqual([]);
  });

  it("stores custom presets newest first and keeps the configured limit", async () => {
    const fileSystem = createMemoryFileSystem();

    for (let index = 0; index < MAX_CUSTOM_SOUND_PRESETS + 1; index += 1) {
      await saveCustomSoundPreset(
        {
          items: [
            {
              soundId: `custom:${index}`,
              volume: 0.5,
            },
          ],
        },
        fileSystem,
        1000 + index,
      );
    }

    const presets = await listCustomSoundPresets(fileSystem);

    expect(presets).toHaveLength(MAX_CUSTOM_SOUND_PRESETS);
    expect(presets[0].name).toBe(`我的混音 ${MAX_CUSTOM_SOUND_PRESETS + 1}`);
    expect(presets[presets.length - 1]?.name).toBe("我的混音 2");
  });

  it("normalizes duplicate sounds and volume values", async () => {
    const fileSystem = createMemoryFileSystem();

    await saveCustomSoundPreset(
      {
        items: [
          { soundId: "heavy_rain", volume: 2 },
          { soundId: "heavy_rain", volume: 0.3 },
          { soundId: "thunder", volume: -1 },
        ],
      },
      fileSystem,
      1000,
    );

    const presets = await listCustomSoundPresets(fileSystem);

    expect(presets[0].items).toEqual([
      { soundId: "heavy_rain", volume: 1 },
      { soundId: "thunder", volume: 0 },
    ]);
  });

  it("falls back to an empty list for malformed storage content", async () => {
    const fileSystem = createMemoryFileSystem();

    await fileSystem.writeText("sound-presets/custom-presets.json", "{");

    await expect(listCustomSoundPresets(fileSystem)).resolves.toEqual([]);
  });

  it("rejects empty custom presets", async () => {
    const fileSystem = createMemoryFileSystem();

    await expect(
      saveCustomSoundPreset({ items: [] }, fileSystem, 1000),
    ).rejects.toThrow("全局混音至少需要一个声音");
  });
});
