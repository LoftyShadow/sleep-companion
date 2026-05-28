import { describe, expect, it } from "vitest";
import { BUILT_IN_SOUNDS } from "./soundCatalog";
import {
  BUILT_IN_PRESETS,
  DEFAULT_SOUND_PRESET,
  PRESET_GROUPS,
} from "./soundPresets";

describe("PRESET_GROUPS", () => {
  it("contains grouped built-in presets", () => {
    expect(PRESET_GROUPS.map((group) => group.id)).toEqual([
      "sleep",
      "focus",
      "nature",
    ]);
    expect(BUILT_IN_PRESETS.length).toBeGreaterThanOrEqual(10);
    expect(DEFAULT_SOUND_PRESET.id).toBe("rainy_night");
  });

  it("uses unique group and preset ids", () => {
    const groupIds = PRESET_GROUPS.map((group) => group.id);
    const presetIds = BUILT_IN_PRESETS.map((preset) => preset.id);

    expect(new Set(groupIds).size).toBe(groupIds.length);
    expect(new Set(presetIds).size).toBe(presetIds.length);
  });

  it("only references valid built-in sounds and normalized volumes", () => {
    const soundIds = new Set(BUILT_IN_SOUNDS.map((sound) => sound.id));

    for (const preset of BUILT_IN_PRESETS) {
      expect(preset.items.length).toBeGreaterThan(0);
      for (const item of preset.items) {
        expect(soundIds.has(item.soundId)).toBe(true);
        expect(item.volume).toBeGreaterThanOrEqual(0);
        expect(item.volume).toBeLessThanOrEqual(1);
      }
    }
  });
});
