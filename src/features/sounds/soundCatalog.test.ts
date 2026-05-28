import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BUILT_IN_SOUNDS } from "./soundCatalog";

describe("BUILT_IN_SOUNDS", () => {
  it("contains the approved built-in sounds", () => {
    expect(BUILT_IN_SOUNDS.map((sound) => sound.id)).toEqual([
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

  it("uses public audio paths for web playback", () => {
    expect(BUILT_IN_SOUNDS.map((sound) => sound.sources[0])).toEqual([
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
