import { describe, expect, it, vi } from "vitest";
import type { SoundDefinition } from "../sounds/soundCatalog";
import { createWebAudioPlayer } from "./webAudioPlayer";

interface AudioMock {
  src: string;
  loop: boolean;
  volume: number;
  paused: boolean;
  play: ReturnType<typeof vi.fn<() => Promise<void>>>;
  pause: ReturnType<typeof vi.fn<() => void>>;
  load: ReturnType<typeof vi.fn<() => void>>;
}

function createSound(): SoundDefinition {
  return {
    id: "heavy_rain",
    name: "大雨",
    sourceKind: "built-in",
    androidResourceName: "heavy_rain",
    imageSrc: "/images/sounds/heavy_rain.webp",
    sources: [{ src: "/audio/heavy_rain.ogg", type: "audio/ogg" }],
  };
}

function createAudioMock(): AudioMock {
  const audio: AudioMock = {
    src: "",
    loop: false,
    volume: 1,
    paused: true,
    play: vi.fn(() => {
      audio.paused = false;
      return Promise.resolve();
    }),
    pause: vi.fn(() => {
      audio.paused = true;
    }),
    load: vi.fn(),
  };
  return audio;
}

describe("createWebAudioPlayer", () => {
  it("plays a sound with loop and normalized volume", async () => {
    const audio = createAudioMock();
    const player = createWebAudioPlayer(() => audio);

    await player.play(createSound(), 0.35);

    expect(audio.src).toBe("/audio/heavy_rain.ogg");
    expect(audio.loop).toBe(true);
    expect(audio.volume).toBe(0.35);
    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  it("pauses a playing sound and releases all sounds", async () => {
    const audio = createAudioMock();
    const player = createWebAudioPlayer(() => audio);

    await player.play(createSound(), 0.5);
    await player.pause("heavy_rain");
    await player.stopAll();

    expect(audio.pause).toHaveBeenCalledTimes(1);
    expect(audio.src).toBe("");
    expect(audio.load).toHaveBeenCalledTimes(1);
  });
});
