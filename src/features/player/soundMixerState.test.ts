import { describe, expect, it } from "vitest";
import type { SoundDefinition } from "../sounds/soundCatalog";
import { BUILT_IN_SOUNDS } from "../sounds/soundCatalog";
import { DEFAULT_SOUND_PRESET } from "../sounds/soundPresets";
import {
  applyPresetVolumes,
  createInitialVolumes,
  getDefaultResumeSoundIds,
  getSoundVolume,
  reconcileSoundMixerState,
} from "./soundMixerState";

const customSound: SoundDefinition = {
  id: "custom:rain",
  imageSrc: "/images/sounds/typewriter.webp",
  name: "自定义雨声",
  sourceKind: "custom",
  sources: [{ src: "blob:rain", type: "audio/mpeg" }],
};

describe("soundMixerState", () => {
  it("creates initial volumes from available sounds and default preset", () => {
    const volumes = createInitialVolumes(BUILT_IN_SOUNDS, DEFAULT_SOUND_PRESET);

    expect(volumes.heavy_rain).toBe(0.62);
    expect(volumes.thunder).toBe(0.18);
    expect(volumes.campfire).toBe(0.5);
  });

  it("uses fallback volume when a sound has no stored volume", () => {
    expect(getSoundVolume({}, "campfire")).toBe(0.5);
  });

  it("applies preset volumes without mutating the current state", () => {
    const currentVolumes = createInitialVolumes(BUILT_IN_SOUNDS);
    const nextVolumes = applyPresetVolumes(
      currentVolumes,
      DEFAULT_SOUND_PRESET,
    );

    expect(nextVolumes).not.toBe(currentVolumes);
    expect(nextVolumes.heavy_rain).toBe(0.62);
    expect(currentVolumes.heavy_rain).toBe(0.5);
  });

  it("derives the default resume list from preset order first", () => {
    expect(getDefaultResumeSoundIds(BUILT_IN_SOUNDS, DEFAULT_SOUND_PRESET)).toEqual(
      DEFAULT_SOUND_PRESET.items.map((item) => item.soundId),
    );
  });

  it("reconciles removed and newly added sounds as the library changes", () => {
    const sounds = [...BUILT_IN_SOUNDS, customSound];

    const reconciledState = reconcileSoundMixerState({
      defaultPreset: DEFAULT_SOUND_PRESET,
      playingSoundIds: new Set(["heavy_rain", "custom:missing"]),
      resumeSoundIds: ["custom:missing"],
      sounds,
      volumes: createInitialVolumes(BUILT_IN_SOUNDS),
    });

    expect(reconciledState.playingSoundIds).toEqual(["heavy_rain"]);
    expect(reconciledState.resumeSoundIds).toEqual(
      DEFAULT_SOUND_PRESET.items.map((item) => item.soundId),
    );
    expect(reconciledState.volumes["custom:rain"]).toBe(0.5);
  });
});
