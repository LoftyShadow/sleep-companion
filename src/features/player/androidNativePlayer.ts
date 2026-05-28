import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import type { SoundDefinition, SoundId } from "../sounds/soundCatalog";
import type { PlayerPort, PlayerSnapshot } from "./PlayerPort";
import { normalizeVolume } from "./PlayerPort";

type InvokeFn = (
  cmd: string,
  args?: Record<string, unknown>,
) => Promise<unknown>;

export function createAndroidNativePlayer(
  invoke: InvokeFn = tauriInvoke,
): PlayerPort {
  async function stopAll() {
    await invoke("plugin:native-audio|stopAll");
  }

  return {
    async play(sound: SoundDefinition, volume: number) {
      if (!sound.androidResourceName) {
        throw new Error("Android 原生播放器仅支持内置音频");
      }

      await invoke("plugin:native-audio|play", {
        soundId: sound.id,
        resourceName: sound.androidResourceName,
        volume: normalizeVolume(volume),
      });
    },

    async pause(soundId: SoundId) {
      await invoke("plugin:native-audio|pause", { soundId });
    },

    async setVolume(soundId: SoundId, volume: number) {
      await invoke("plugin:native-audio|setVolume", {
        soundId,
        volume: normalizeVolume(volume),
      });
    },

    stopAll,

    async getState(): Promise<PlayerSnapshot> {
      return (await invoke("plugin:native-audio|getState")) as PlayerSnapshot;
    },

    destroy() {
      void stopAll();
    },
  };
}
