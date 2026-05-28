import { describe, expect, it, vi } from "vitest";
import type { SoundDefinition } from "../sounds/soundCatalog";
import { createAndroidNativePlayer } from "./androidNativePlayer";

function createSound(): SoundDefinition {
  return {
    id: "campfire",
    name: "篝火",
    androidResourceName: "campfire",
    sources: [{ src: "/audio/campfire.ogg", type: "audio/ogg" }],
  };
}

describe("createAndroidNativePlayer", () => {
  it("invokes native play, pause, volume, and stop commands", async () => {
    const invoke = vi.fn(() => Promise.resolve(undefined));
    const player = createAndroidNativePlayer(invoke);

    await player.play(createSound(), 0.7);
    await player.pause("campfire");
    await player.setVolume("campfire", 0.2);
    await player.stopAll();

    expect(invoke).toHaveBeenNthCalledWith(1, "plugin:native-audio|play", {
      soundId: "campfire",
      resourceName: "campfire",
      volume: 0.7,
    });
    expect(invoke).toHaveBeenNthCalledWith(2, "plugin:native-audio|pause", {
      soundId: "campfire",
    });
    expect(invoke).toHaveBeenNthCalledWith(3, "plugin:native-audio|setVolume", {
      soundId: "campfire",
      volume: 0.2,
    });
    expect(invoke).toHaveBeenNthCalledWith(4, "plugin:native-audio|stopAll");
  });
});
