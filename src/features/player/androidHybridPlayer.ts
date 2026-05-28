import { isCustomSound, isCustomSoundId } from "../sounds/soundCatalog";
import type { PlayerPort, PlayerSnapshot } from "./PlayerPort";
import { createAndroidNativePlayer } from "./androidNativePlayer";
import { createWebAudioPlayer } from "./webAudioPlayer";

export function createAndroidHybridPlayer(
  nativePlayer: PlayerPort = createAndroidNativePlayer(),
  webPlayer: PlayerPort = createWebAudioPlayer(),
): PlayerPort {
  return {
    async play(sound, volume) {
      if (isCustomSound(sound)) {
        await webPlayer.play(sound, volume);
        return;
      }

      await nativePlayer.play(sound, volume);
    },

    async pause(soundId) {
      if (isCustomSoundId(soundId)) {
        await webPlayer.pause(soundId);
        return;
      }

      await nativePlayer.pause(soundId);
    },

    async setVolume(soundId, volume) {
      if (isCustomSoundId(soundId)) {
        await webPlayer.setVolume(soundId, volume);
        return;
      }

      await nativePlayer.setVolume(soundId, volume);
    },

    async stopAll() {
      await Promise.all([nativePlayer.stopAll(), webPlayer.stopAll()]);
    },

    async getState(): Promise<PlayerSnapshot> {
      const [nativeSnapshot, webSnapshot] = await Promise.all([
        nativePlayer.getState(),
        webPlayer.getState(),
      ]);

      return {
        sounds: [...nativeSnapshot.sounds, ...webSnapshot.sounds],
      };
    },

    destroy() {
      nativePlayer.destroy();
      webPlayer.destroy();
    },
  };
}
