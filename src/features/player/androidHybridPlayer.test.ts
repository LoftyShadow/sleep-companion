import { describe, expect, it, vi } from "vitest";
import type { PlayerPort } from "./PlayerPort";
import { createAndroidHybridPlayer } from "./androidHybridPlayer";
import type { SoundDefinition } from "../sounds/soundCatalog";

function createPlayerMock() {
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

const builtInSound: SoundDefinition = {
  id: "campfire",
  name: "篝火",
  sourceKind: "built-in",
  androidResourceName: "campfire",
  imageSrc: "/images/sounds/campfire.webp",
  sources: [{ src: "/audio/campfire.ogg", type: "audio/ogg" }],
};

const customSound: SoundDefinition = {
  id: "custom:rain",
  name: "自定义雨声",
  sourceKind: "custom",
  imageSrc: "/images/sounds/typewriter.webp",
  sources: [{ src: "blob:rain", type: "audio/mpeg" }],
};

describe("createAndroidHybridPlayer", () => {
  it("routes built-in sounds to native player and custom sounds to web player", async () => {
    const nativePlayer = createPlayerMock();
    const webPlayer = createPlayerMock();
    const player = createAndroidHybridPlayer(
      nativePlayer.player,
      webPlayer.player,
    );

    await player.play(builtInSound, 0.4);
    await player.play(customSound, 0.7);
    await player.setVolume("campfire", 0.2);
    await player.setVolume("custom:rain", 0.3);
    await player.pause("custom:rain");
    await player.stopAll();

    expect(nativePlayer.play).toHaveBeenCalledWith(builtInSound, 0.4);
    expect(webPlayer.play).toHaveBeenCalledWith(customSound, 0.7);
    expect(nativePlayer.setVolume).toHaveBeenCalledWith("campfire", 0.2);
    expect(webPlayer.setVolume).toHaveBeenCalledWith("custom:rain", 0.3);
    expect(webPlayer.pause).toHaveBeenCalledWith("custom:rain");
    expect(nativePlayer.stopAll).toHaveBeenCalledTimes(1);
    expect(webPlayer.stopAll).toHaveBeenCalledTimes(1);
  });

  it("routes custom volume changes to the web player before playback starts", async () => {
    const nativePlayer = createPlayerMock();
    const webPlayer = createPlayerMock();
    const player = createAndroidHybridPlayer(
      nativePlayer.player,
      webPlayer.player,
    );

    await player.setVolume("custom:rain", 0.25);

    expect(webPlayer.setVolume).toHaveBeenCalledWith("custom:rain", 0.25);
    expect(nativePlayer.setVolume).not.toHaveBeenCalled();
  });
});
