import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ASMR_SOUNDS,
  BUILT_IN_SOUNDS,
  WHITE_NOISE_SOUNDS,
} from "./soundCatalog";
import {
  XMSLEEP_EXISTING_SOUND_SOURCE_IDS,
  XMSLEEP_OTHER_EXCLUDED_SOUND_SOURCE_IDS,
  XMSLEEP_OTHER_CATEGORIES,
  XMSLEEP_OTHER_SOUNDS,
  XMSLEEP_SOUND_CATEGORIES,
  XMSLEEP_SOUNDS,
  XMSLEEP_WHITE_NOISE_SOUNDS,
} from "./xmsleepSoundCatalog";

describe("sound catalog", () => {
  it("contains the approved white-noise sounds", () => {
    expect(WHITE_NOISE_SOUNDS.map((sound) => sound.id)).toEqual([
      "heavy_rain",
      "campfire",
      "forest_birds",
      "thunder",
      "wind",
      "clock",
      "keyboard",
      "library",
      "drifting",
      "heavy_rain_seg_0",
      "morning_coffee",
      "office",
      "rowing",
      "snow_walking",
      "typewriter",
      "umbrella_rain",
      "windmill",
    ]);
  });

  it("contains the approved ASMR MVP sounds from XMSLEEP", () => {
    expect(ASMR_SOUNDS.map((sound) => sound.id)).toEqual([
      "asmr_ear_cleaning_soft",
      "asmr_ear_cleaning_deep",
      "asmr_paper_rub",
      "asmr_keyboard_taps",
      "asmr_typewriter_ticks",
      "asmr_boiling_water",
      "asmr_bubbles",
      "asmr_gravel_steps",
      "asmr_leaf_steps",
      "asmr_car_roof_rain",
    ]);
  });

  it("contains the complete XMSLEEP sound catalog", () => {
    expect(XMSLEEP_SOUND_CATEGORIES.map((category) => category.id)).toEqual([
      "nature",
      "rain",
      "urban",
      "places",
      "transport",
      "things",
      "noise",
      "animals",
    ]);
    expect(XMSLEEP_SOUNDS).toHaveLength(113);
    expect(XMSLEEP_SOUNDS.slice(0, 3)).toEqual([
      expect.objectContaining({
        id: "xmsleep_river",
        name: "河流",
        accessibleName: "河流，自然，XMSLEEP",
        sourceKind: "built-in",
        androidResourceName: "xmsleep_river",
        imageSrc: "/images/sounds/xmsleep/river.webp",
        sources: [
          { src: "/audio/xmsleep/nature/river.ogg", type: "audio/ogg" },
        ],
        xmsleepCategoryId: "nature",
        xmsleepCategoryName: "自然",
        xmsleepSourceId: "river",
      }),
      expect.objectContaining({
        id: "xmsleep_waves",
        name: "海浪",
        accessibleName: "海浪，自然，XMSLEEP",
        sourceKind: "built-in",
        androidResourceName: "xmsleep_waves",
        imageSrc: "/images/sounds/xmsleep/waves.webp",
        sources: [
          { src: "/audio/xmsleep/nature/waves.ogg", type: "audio/ogg" },
        ],
        xmsleepCategoryId: "nature",
        xmsleepCategoryName: "自然",
        xmsleepSourceId: "waves",
      }),
      expect.objectContaining({
        id: "xmsleep_campfire",
        name: "篝火",
        accessibleName: "篝火，自然，XMSLEEP",
        sourceKind: "built-in",
        androidResourceName: "xmsleep_campfire",
        imageSrc: "/images/sounds/xmsleep/campfire.webp",
        sources: [
          { src: "/audio/xmsleep/nature/campfire.ogg", type: "audio/ogg" },
        ],
        xmsleepCategoryId: "nature",
        xmsleepCategoryName: "自然",
        xmsleepSourceId: "campfire",
      }),
    ]);
  });

  it("keeps only uncategorized supplemental XMSLEEP sounds in other sounds", () => {
    const excludedSourceIds = new Set<string>(
      XMSLEEP_OTHER_EXCLUDED_SOUND_SOURCE_IDS,
    );

    expect(XMSLEEP_OTHER_SOUNDS).toHaveLength(
      XMSLEEP_SOUNDS.length - excludedSourceIds.size,
    );
    expect(
      XMSLEEP_OTHER_SOUNDS.map((sound) => sound.xmsleepSourceId),
    ).not.toEqual(expect.arrayContaining([...excludedSourceIds]));
    expect(XMSLEEP_OTHER_CATEGORIES.map((category) => category.id)).toEqual([
      "nature",
      "rain",
      "urban",
      "places",
      "transport",
      "things",
      "noise",
      "animals",
    ]);
    expect(XMSLEEP_OTHER_SOUNDS.map((sound) => sound.id)).toEqual(
      expect.arrayContaining([
        "xmsleep_river",
        "xmsleep_wind_chimes",
        "xmsleep_ambulance_siren",
      ]),
    );
    expect(XMSLEEP_OTHER_SOUNDS.map((sound) => sound.id)).not.toEqual(
      expect.arrayContaining([
        "xmsleep_heavy_rain",
        "xmsleep_keyboard",
        "xmsleep_cafe",
        "xmsleep_ear_cleaning_1",
      ]),
    );
  });

  it("adds the requested XMSLEEP cafe sound to white-noise supplements", () => {
    expect(XMSLEEP_WHITE_NOISE_SOUNDS).toEqual([
      expect.objectContaining({
        id: "xmsleep_cafe",
        name: "咖啡厅",
        xmsleepCategoryId: "places",
        xmsleepSourceId: "cafe",
      }),
    ]);
    expect(XMSLEEP_EXISTING_SOUND_SOURCE_IDS).not.toContain("cafe");
  });

  it("combines white-noise, ASMR, and XMSLEEP sounds as built-in sounds", () => {
    expect(BUILT_IN_SOUNDS).toEqual([
      ...WHITE_NOISE_SOUNDS,
      ...ASMR_SOUNDS,
      ...XMSLEEP_SOUNDS,
    ]);
  });

  it("uses public audio paths for white-noise web playback", () => {
    expect(WHITE_NOISE_SOUNDS.map((sound) => sound.sources[0])).toEqual([
      { src: "/audio/heavy_rain.ogg", type: "audio/ogg" },
      { src: "/audio/campfire.ogg", type: "audio/ogg" },
      { src: "/audio/forest_birds.ogg", type: "audio/ogg" },
      { src: "/audio/thunder.ogg", type: "audio/ogg" },
      { src: "/audio/wind.ogg", type: "audio/ogg" },
      { src: "/audio/clock.ogg", type: "audio/ogg" },
      { src: "/audio/keyboard.ogg", type: "audio/ogg" },
      { src: "/audio/library.ogg", type: "audio/ogg" },
      { src: "/audio/drifting.ogg", type: "audio/ogg" },
      { src: "/audio/heavy_rain_seg_0.ogg", type: "audio/ogg" },
      { src: "/audio/morning_coffee.ogg", type: "audio/ogg" },
      { src: "/audio/office.ogg", type: "audio/ogg" },
      { src: "/audio/rowing.ogg", type: "audio/ogg" },
      { src: "/audio/snow_walking.ogg", type: "audio/ogg" },
      { src: "/audio/typewriter.ogg", type: "audio/ogg" },
      { src: "/audio/umbrella_rain.ogg", type: "audio/ogg" },
      { src: "/audio/windmill.ogg", type: "audio/ogg" },
    ]);
  });

  it("uses public ASMR audio paths for web playback", () => {
    expect(ASMR_SOUNDS.map((sound) => sound.sources[0])).toEqual([
      {
        src: "/audio/asmr/asmr_ear_cleaning_soft.ogg",
        type: "audio/ogg",
      },
      {
        src: "/audio/asmr/asmr_ear_cleaning_deep.ogg",
        type: "audio/ogg",
      },
      { src: "/audio/asmr/asmr_paper_rub.ogg", type: "audio/ogg" },
      { src: "/audio/asmr/asmr_keyboard_taps.ogg", type: "audio/ogg" },
      {
        src: "/audio/asmr/asmr_typewriter_ticks.ogg",
        type: "audio/ogg",
      },
      { src: "/audio/asmr/asmr_boiling_water.ogg", type: "audio/ogg" },
      { src: "/audio/asmr/asmr_bubbles.ogg", type: "audio/ogg" },
      { src: "/audio/asmr/asmr_gravel_steps.ogg", type: "audio/ogg" },
      { src: "/audio/asmr/asmr_leaf_steps.ogg", type: "audio/ogg" },
      { src: "/audio/asmr/asmr_car_roof_rain.ogg", type: "audio/ogg" },
    ]);
  });

  it("marks all built-in sounds as built-in sources", () => {
    for (const sound of BUILT_IN_SOUNDS) {
      expect(sound.sourceKind).toBe("built-in");
      expect(sound.androidResourceName).toBeTruthy();
    }
  });

  it("has matching web and Android audio files", () => {
    for (const sound of BUILT_IN_SOUNDS) {
      const androidResourceName = sound.androidResourceName;
      expect(androidResourceName).toBeDefined();
      expect(
        existsSync(resolve("public", sound.sources[0].src.slice(1))),
      ).toBe(true);
      expect(
        existsSync(
          resolve(
            "src-tauri/gen/android/app/src/main/res/raw",
            `${androidResourceName}.ogg`,
          ),
        ),
      ).toBe(true);
    }
  });

  it("has matching sound artwork files", () => {
    for (const sound of BUILT_IN_SOUNDS) {
      expect(existsSync(resolve("public", sound.imageSrc.slice(1)))).toBe(true);
    }
  });
});
