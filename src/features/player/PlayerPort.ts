import type { SoundDefinition, SoundId } from "../sounds/soundCatalog";

export interface PlayingSoundState {
  soundId: SoundId;
  isPlaying: boolean;
  volume: number;
}

export interface PlayerSnapshot {
  sounds: PlayingSoundState[];
}

export interface PlayerPort {
  play(sound: SoundDefinition, volume: number): Promise<void>;
  pause(soundId: SoundId): Promise<void>;
  setVolume(soundId: SoundId, volume: number): Promise<void>;
  stopAll(): Promise<void>;
  getState(): Promise<PlayerSnapshot>;
  destroy(): void;
}

export function normalizeVolume(volume: number): number {
  return Math.min(1, Math.max(0, volume));
}
