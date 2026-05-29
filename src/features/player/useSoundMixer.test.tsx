import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { BUILT_IN_SOUNDS } from "../sounds/soundCatalog";
import {
  BUILT_IN_PRESETS,
  DEFAULT_SOUND_PRESET,
} from "../sounds/soundPresets";
import type { SoundDefinition } from "../sounds/soundCatalog";
import type { PlayerPort } from "./PlayerPort";
import { useSoundMixer } from "./useSoundMixer";

function createPlayer() {
  const play = vi.fn<PlayerPort["play"]>(() => Promise.resolve());
  const pause = vi.fn<PlayerPort["pause"]>(() => Promise.resolve());
  const setVolume = vi.fn<PlayerPort["setVolume"]>(() => Promise.resolve());
  const stopAll = vi.fn<PlayerPort["stopAll"]>(() => Promise.resolve());
  const getState = vi.fn<PlayerPort["getState"]>(() =>
    Promise.resolve({ sounds: [] }),
  );
  const destroy = vi.fn<PlayerPort["destroy"]>();
  const player: PlayerPort = {
    play,
    pause,
    setVolume,
    stopAll,
    getState,
    destroy,
  };

  return { destroy, getState, pause, play, player, setVolume, stopAll };
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, reject, resolve };
}

describe("useSoundMixer", () => {
  it("plays and pauses a sound through the player", async () => {
    const { pause, play, player } = createPlayer();
    const { result } = renderHook(() =>
      useSoundMixer({ sounds: BUILT_IN_SOUNDS, player }),
    );

    await act(async () => {
      await result.current.toggleSound("heavy_rain");
    });

    expect(play).toHaveBeenCalledWith(BUILT_IN_SOUNDS[0], 0.5);
    expect(result.current.playingSoundIds.has("heavy_rain")).toBe(true);

    await act(async () => {
      await result.current.toggleSound("heavy_rain");
    });

    expect(pause).toHaveBeenCalledWith("heavy_rain");
    expect(result.current.playingSoundIds.has("heavy_rain")).toBe(false);
  });

  it("sets volume and stops all sounds", async () => {
    const { player, setVolume, stopAll } = createPlayer();
    const { result } = renderHook(() =>
      useSoundMixer({ sounds: BUILT_IN_SOUNDS, player }),
    );

    await act(async () => {
      await result.current.setSoundVolume("campfire", 0.8);
      await result.current.stopAll();
    });

    await waitFor(() => {
      expect(setVolume).toHaveBeenCalledWith("campfire", 0.8);
      expect(stopAll).toHaveBeenCalledTimes(1);
      expect(result.current.playingSoundIds.size).toBe(0);
    });
  });

  it("uses a just-updated volume when playing before the next render", async () => {
    const { play, player, setVolume } = createPlayer();
    const { result } = renderHook(() =>
      useSoundMixer({ sounds: BUILT_IN_SOUNDS, player }),
    );
    const setCampfireVolume = result.current.setSoundVolume;
    const toggleCampfire = result.current.toggleSound;

    await act(async () => {
      await setCampfireVolume("campfire", 0.82);
      await toggleCampfire("campfire");
    });

    expect(setVolume).toHaveBeenCalledWith("campfire", 0.82);
    expect(play).toHaveBeenCalledWith(BUILT_IN_SOUNDS[1], 0.82);
    expect(result.current.volumes.campfire).toBe(0.82);
  });

  it("keeps every sound that starts while play promises resolve out of order", async () => {
    const playRequests: Array<ReturnType<typeof createDeferred<void>>> = [];
    const playerMocks = createPlayer();
    playerMocks.play.mockImplementation(() => {
      const deferred = createDeferred<void>();
      playRequests.push(deferred);
      return deferred.promise;
    });
    const { result } = renderHook(() =>
      useSoundMixer({ sounds: BUILT_IN_SOUNDS, player: playerMocks.player }),
    );

    await act(async () => {
      const rainPlay = result.current.toggleSound("heavy_rain");
      const campfirePlay = result.current.toggleSound("campfire");

      playRequests[1].resolve();
      await campfirePlay;
      playRequests[0].resolve();
      await rainPlay;
    });

    expect([...result.current.playingSoundIds]).toEqual([
      "campfire",
      "heavy_rain",
    ]);
  });

  it("applies a preset by stopping the old mix and playing preset sounds", async () => {
    const { play, player, stopAll } = createPlayer();
    const preset = BUILT_IN_PRESETS[2];
    const { result } = renderHook(() =>
      useSoundMixer({ sounds: BUILT_IN_SOUNDS, player }),
    );

    await act(async () => {
      await result.current.applyPreset(preset);
    });

    expect(stopAll).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(preset.items.length);
    expect(
      play.mock.calls.map(([sound, volume]) => [sound.id, volume]),
    ).toEqual(
      preset.items.map((item) => [
        item.soundId,
        item.volume,
      ]),
    );
    expect(result.current.activePresetId).toBe(preset.id);
    expect([...result.current.playingSoundIds]).toEqual(
      preset.items.map((item) => item.soundId),
    );
  });

  it("uses the unified playback toggle to start and stop the current mix", async () => {
    const { play, player, stopAll } = createPlayer();
    const { result } = renderHook(() =>
      useSoundMixer({
        sounds: BUILT_IN_SOUNDS,
        player,
        defaultPreset: DEFAULT_SOUND_PRESET,
      }),
    );

    await act(async () => {
      await result.current.toggleUnifiedPlayback();
    });

    expect(play).toHaveBeenCalledTimes(DEFAULT_SOUND_PRESET.items.length);
    expect(result.current.isAnySoundPlaying).toBe(true);

    await act(async () => {
      await result.current.toggleUnifiedPlayback();
    });

    expect(stopAll).toHaveBeenCalledTimes(1);
    expect(result.current.isAnySoundPlaying).toBe(false);
  });

  it("plays a custom sound added after the hook has mounted", async () => {
    const { play, player } = createPlayer();
    const customSound: SoundDefinition = {
      id: "custom:rain",
      name: "自定义雨声",
      sourceKind: "custom",
      imageSrc: "/images/sounds/typewriter.webp",
      sources: [{ src: "blob:rain", type: "audio/mpeg" }],
    };
    const { result, rerender } = renderHook(
      ({ sounds }) => useSoundMixer({ sounds, player }),
      { initialProps: { sounds: BUILT_IN_SOUNDS } },
    );

    rerender({ sounds: [...BUILT_IN_SOUNDS, customSound] });

    await act(async () => {
      await result.current.toggleSound("custom:rain");
    });

    expect(play).toHaveBeenCalledWith(customSound, 0.5);
    expect(result.current.playingSoundIds.has("custom:rain")).toBe(true);
  });
});
