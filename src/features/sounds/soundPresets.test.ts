import { describe, expect, it } from "vitest";
import { BUILT_IN_SOUNDS } from "./soundCatalog";
import {
  ASMR_PRESET_GROUPS,
  BUILT_IN_PRESETS,
  DEFAULT_ASMR_PRESET,
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
    expect(
      PRESET_GROUPS.flatMap((group) => group.presets).map(
        (preset) => preset.id,
      ),
    ).toEqual([
      "rainy_night",
      "campfire_rest",
      "library_focus",
      "forest_morning",
    ]);
    expect(
      PRESET_GROUPS.reduce(
        (count, group) => count + group.presets.length,
        0,
      ),
    ).toBe(4);
    expect(DEFAULT_SOUND_PRESET.id).toBe("rainy_night");
  });

  it("contains ASMR preset groups for the MVP console", () => {
    expect(ASMR_PRESET_GROUPS.map((group) => group.id)).toEqual(["asmr"]);
    expect(ASMR_PRESET_GROUPS[0].presets.map((preset) => preset.id)).toEqual([
      "asmr_ear_care",
      "asmr_desktop_taps",
      "asmr_liquid_close",
      "asmr_texture_walk",
    ]);
    expect(DEFAULT_ASMR_PRESET.id).toBe("asmr_ear_care");
  });

  it("uses unique group and preset ids", () => {
    const groupIds = [...PRESET_GROUPS, ...ASMR_PRESET_GROUPS].map(
      (group) => group.id,
    );
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
