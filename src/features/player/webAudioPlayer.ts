import type { SoundDefinition, SoundId } from "../sounds/soundCatalog";
import type { PlayerPort, PlayerSnapshot } from "./PlayerPort";
import { normalizeVolume } from "./PlayerPort";

export interface AudioLike {
  src: string;
  loop: boolean;
  volume: number;
  paused: boolean;
  play(): Promise<void>;
  pause(): void;
  load(): void;
}

type AudioElementFactory = () => AudioLike;

export function createWebAudioPlayer(
  createAudio: AudioElementFactory = () => new Audio(),
): PlayerPort {
  const players = new Map<SoundId, AudioLike>();
  const volumes = new Map<SoundId, number>();

  function getAudio(sound: SoundDefinition): AudioLike {
    const existing = players.get(sound.id);
    if (existing) {
      return existing;
    }

    const audio = createAudio();
    audio.src = sound.sources[0].src;
    audio.loop = true;
    players.set(sound.id, audio);
    return audio;
  }

  function stopAll(): Promise<void> {
    for (const audio of players.values()) {
      audio.pause();
      audio.src = "";
      audio.load();
    }
    players.clear();
    volumes.clear();
    return Promise.resolve();
  }

  return {
    async play(sound, volume) {
      const audio = getAudio(sound);
      const nextVolume = normalizeVolume(volume);
      volumes.set(sound.id, nextVolume);
      audio.volume = nextVolume;
      await audio.play();
    },

    pause(soundId) {
      const audio = players.get(soundId);
      if (audio) {
        audio.pause();
        audio.src = "";
        audio.load();
        players.delete(soundId);
        volumes.delete(soundId);
      }
      return Promise.resolve();
    },

    setVolume(soundId, volume) {
      const nextVolume = normalizeVolume(volume);
      volumes.set(soundId, nextVolume);
      const audio = players.get(soundId);
      if (audio) {
        audio.volume = nextVolume;
      }
      return Promise.resolve();
    },

    stopAll,

    getState(): Promise<PlayerSnapshot> {
      return Promise.resolve({
        sounds: Array.from(players.entries()).map(([soundId, audio]) => ({
          soundId,
          isPlaying: !audio.paused,
          volume: volumes.get(soundId) ?? audio.volume,
        })),
      });
    },

    destroy() {
      void stopAll();
    },
  };
}
