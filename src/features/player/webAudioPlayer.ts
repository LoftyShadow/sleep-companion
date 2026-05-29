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

interface AudioOutputNode {
  disconnect(): void;
  resume(): Promise<void>;
  setVolume(volume: number): void;
}

type AudioOutputFactory = (
  audio: AudioLike,
  volume: number,
) => AudioOutputNode | null;

interface PlayerEntry {
  audio: AudioLike;
  output: AudioOutputNode | null;
}

function logWebAudioEvent(
  eventName: string,
  details: Record<string, unknown>,
): void {
  if (!import.meta.env.DEV || import.meta.env.MODE === "test") {
    return;
  }

  console.info(`[web-audio-player] ${eventName}`, details);
}

function logWebAudioError(
  eventName: string,
  error: unknown,
  details: Record<string, unknown>,
): void {
  if (!import.meta.env.DEV || import.meta.env.MODE === "test") {
    return;
  }

  console.warn(`[web-audio-player] ${eventName}`, {
    ...details,
    error: error instanceof Error ? error.message : String(error),
  });
}

function createBrowserAudioOutputFactory(): AudioOutputFactory {
  let context: AudioContext | null = null;

  return (audio, volume) => {
    const AudioContextConstructor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioContextConstructor) {
      return null;
    }

    context ??= new AudioContextConstructor();

    try {
      const source = context.createMediaElementSource(
        audio as unknown as HTMLMediaElement,
      );
      const gain = context.createGain();
      gain.gain.value = volume;
      source.connect(gain);
      gain.connect(context.destination);

      return {
        disconnect() {
          source.disconnect();
          gain.disconnect();
        },
        async resume() {
          if (context?.state === "suspended") {
            await context.resume();
          }
        },
        setVolume(nextVolume: number) {
          gain.gain.value = nextVolume;
        },
      };
    } catch (error) {
      logWebAudioError("route-failed", error, {});
      return null;
    }
  };
}

export function createWebAudioPlayer(
  createAudio: AudioElementFactory = () => new Audio(),
  createAudioOutput: AudioOutputFactory = createBrowserAudioOutputFactory(),
): PlayerPort {
  const players = new Map<SoundId, PlayerEntry>();
  const volumes = new Map<SoundId, number>();

  function getVolumeSnapshot() {
    return Array.from(players.entries()).map(([soundId, entry]) => ({
      soundId,
      volume: volumes.get(soundId) ?? entry.audio.volume,
      elementVolume: entry.audio.volume,
      routedThroughAudioContext: Boolean(entry.output),
    }));
  }

  function setEntryVolume(entry: PlayerEntry, volume: number): void {
    if (entry.output) {
      entry.output.setVolume(volume);
      entry.audio.volume = 1;
      return;
    }

    entry.audio.volume = volume;
  }

  function getEntry(sound: SoundDefinition, volume: number): PlayerEntry {
    const existing = players.get(sound.id);
    if (existing) {
      return existing;
    }

    const audio = createAudio();
    audio.src = sound.sources[0].src;
    audio.loop = true;
    const output = createAudioOutput(audio, volume);
    const entry = { audio, output };
    players.set(sound.id, entry);
    return entry;
  }

  function stopAll(): Promise<void> {
    logWebAudioEvent("stop-all", { soundIds: [...players.keys()] });
    for (const entry of players.values()) {
      entry.output?.disconnect();
      const { audio } = entry;
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
      const nextVolume = normalizeVolume(volume);
      const entry = getEntry(sound, nextVolume);
      const { audio } = entry;
      volumes.set(sound.id, nextVolume);
      setEntryVolume(entry, nextVolume);
      logWebAudioEvent("play-request", {
        soundId: sound.id,
        src: audio.src,
        volume: nextVolume,
        routedThroughAudioContext: Boolean(entry.output),
        activeVolumes: getVolumeSnapshot(),
      });
      try {
        await entry.output?.resume();
        await audio.play();
        logWebAudioEvent("play-success", {
          soundId: sound.id,
          volume: nextVolume,
          activeVolumes: getVolumeSnapshot(),
        });
      } catch (error) {
        logWebAudioError("play-failed", error, {
          soundId: sound.id,
          volume: nextVolume,
        });
        throw error;
      }
    },

    pause(soundId) {
      const entry = players.get(soundId);
      if (entry) {
        logWebAudioEvent("pause", { soundId, volume: volumes.get(soundId) });
        entry.output?.disconnect();
        const { audio } = entry;
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
      const entry = players.get(soundId);
      if (entry) {
        setEntryVolume(entry, nextVolume);
      }
      logWebAudioEvent("set-volume", {
        soundId,
        volume: nextVolume,
        isLoaded: Boolean(entry),
        routedThroughAudioContext: Boolean(entry?.output),
        activeVolumes: getVolumeSnapshot(),
      });
      return Promise.resolve();
    },

    stopAll,

    getState(): Promise<PlayerSnapshot> {
      return Promise.resolve({
        sounds: Array.from(players.entries()).map(([soundId, entry]) => ({
          soundId,
          isPlaying: !entry.audio.paused,
          volume: volumes.get(soundId) ?? entry.audio.volume,
        })),
      });
    },

    destroy() {
      void stopAll();
    },
  };
}
