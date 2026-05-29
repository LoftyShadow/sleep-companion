import { describe, expect, it, vi } from "vitest";
import type { SoundDefinition, SoundId } from "../sounds/soundCatalog";
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

function createSound(
  id: SoundId = "heavy_rain",
  name = "大雨",
  src = "/audio/heavy_rain.ogg",
): SoundDefinition {
  return {
    id,
    name,
    sourceKind: "built-in",
    androidResourceName: id,
    imageSrc: `/images/sounds/${id}.webp`,
    sources: [{ src, type: "audio/ogg" }],
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

  it("routes each playing sound through an isolated output volume", async () => {
    const heavyRainAudio = createAudioMock();
    const asmrAudio = createAudioMock();
    const heavyRainOutput = {
      disconnect: vi.fn(),
      resume: vi.fn(() => Promise.resolve()),
      setVolume: vi.fn(),
    };
    const asmrOutput = {
      disconnect: vi.fn(),
      resume: vi.fn(() => Promise.resolve()),
      setVolume: vi.fn(),
    };
    const createAudio = vi.fn(() => {
      if (createAudio.mock.calls.length === 1) {
        return heavyRainAudio;
      }
      return asmrAudio;
    });
    const createAudioOutput = vi
      .fn()
      .mockReturnValueOnce(heavyRainOutput)
      .mockReturnValueOnce(asmrOutput);
    const player = createWebAudioPlayer(createAudio, createAudioOutput);

    await player.play(createSound("heavy_rain"), 0.73);
    await player.play(
      createSound(
        "asmr_ear_cleaning_soft",
        "轻柔掏耳",
        "/audio/asmr/asmr_ear_cleaning_soft.ogg",
      ),
      0.5,
    );

    expect(createAudioOutput).toHaveBeenCalledTimes(2);
    expect(heavyRainOutput.setVolume).toHaveBeenCalledTimes(1);
    expect(heavyRainOutput.setVolume).toHaveBeenCalledWith(0.73);
    expect(asmrOutput.setVolume).toHaveBeenCalledTimes(1);
    expect(asmrOutput.setVolume).toHaveBeenCalledWith(0.5);
    expect(heavyRainAudio.volume).toBe(1);
    expect(asmrAudio.volume).toBe(1);
    expect(await player.getState()).toEqual({
      sounds: [
        { soundId: "heavy_rain", isPlaying: true, volume: 0.73 },
        { soundId: "asmr_ear_cleaning_soft", isPlaying: true, volume: 0.5 },
      ],
    });
  });

  it("updates only the selected output volume", async () => {
    const heavyRainOutput = {
      disconnect: vi.fn(),
      resume: vi.fn(() => Promise.resolve()),
      setVolume: vi.fn(),
    };
    const asmrOutput = {
      disconnect: vi.fn(),
      resume: vi.fn(() => Promise.resolve()),
      setVolume: vi.fn(),
    };
    const createAudioOutput = vi
      .fn()
      .mockReturnValueOnce(heavyRainOutput)
      .mockReturnValueOnce(asmrOutput);
    const player = createWebAudioPlayer(createAudioMock, createAudioOutput);

    await player.play(createSound("heavy_rain"), 0.73);
    await player.play(
      createSound(
        "asmr_ear_cleaning_soft",
        "轻柔掏耳",
        "/audio/asmr/asmr_ear_cleaning_soft.ogg",
      ),
      0.5,
    );
    await player.setVolume("asmr_ear_cleaning_soft", 0.31);

    expect(heavyRainOutput.setVolume).toHaveBeenCalledTimes(1);
    expect(heavyRainOutput.setVolume).toHaveBeenCalledWith(0.73);
    expect(asmrOutput.setVolume).toHaveBeenCalledTimes(2);
    expect(asmrOutput.setVolume).toHaveBeenLastCalledWith(0.31);
    expect(await player.getState()).toEqual({
      sounds: [
        { soundId: "heavy_rain", isPlaying: true, volume: 0.73 },
        { soundId: "asmr_ear_cleaning_soft", isPlaying: true, volume: 0.31 },
      ],
    });
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
