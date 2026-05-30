import type { SoundDefinition, SoundId } from "../sounds/soundCatalog";
import type { SoundPreset } from "../sounds/soundPresets";
import { normalizeVolume } from "./PlayerPort";

export type VolumeState = Partial<Record<SoundId, number>>;

const DEFAULT_SOUND_VOLUME = 0.5;

export interface ReconciledSoundMixerState {
  playingSoundIds: SoundId[];
  resumeSoundIds: SoundId[];
  volumes: VolumeState;
}

export function createInitialVolumes(
  sounds: SoundDefinition[],
  defaultPreset?: SoundPreset,
): VolumeState {
  const volumes = Object.fromEntries(
    sounds.map((sound) => [sound.id, DEFAULT_SOUND_VOLUME]),
  ) as VolumeState;

  return applyPresetVolumes(volumes, defaultPreset);
}

export function uniqueSoundIds(soundIds: SoundId[]): SoundId[] {
  return [...new Set(soundIds)];
}

export function getPresetSoundIds(preset: SoundPreset): SoundId[] {
  return uniqueSoundIds(preset.items.map((item) => item.soundId));
}

export function getSoundVolume(volumes: VolumeState, soundId: SoundId): number {
  return volumes[soundId] ?? DEFAULT_SOUND_VOLUME;
}

export function applyPresetVolumes(
  currentVolumes: VolumeState,
  preset?: SoundPreset,
): VolumeState {
  if (!preset) {
    return currentVolumes;
  }

  const nextVolumes = { ...currentVolumes };

  for (const item of preset.items) {
    nextVolumes[item.soundId] = normalizeVolume(item.volume);
  }

  return nextVolumes;
}

export function hasSameSoundIds(left: SoundId[], right: SoundId[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export function getDefaultResumeSoundIds(
  sounds: SoundDefinition[],
  defaultPreset?: SoundPreset,
): SoundId[] {
  return defaultPreset
    ? getPresetSoundIds(defaultPreset)
    : sounds.map((sound) => sound.id);
}

export function reconcileSoundMixerState({
  defaultPreset,
  playingSoundIds,
  resumeSoundIds,
  sounds,
  volumes,
}: {
  defaultPreset?: SoundPreset;
  playingSoundIds: Iterable<SoundId>;
  resumeSoundIds: SoundId[];
  sounds: SoundDefinition[];
  volumes: VolumeState;
}): ReconciledSoundMixerState {
  const availableSoundIds = new Set(sounds.map((sound) => sound.id));
  const nextPlayingSoundIds = [...playingSoundIds].filter((soundId) =>
    availableSoundIds.has(soundId),
  );
  const availableResumeSoundIds = resumeSoundIds.filter((soundId) =>
    availableSoundIds.has(soundId),
  );
  const nextResumeSoundIds =
    availableResumeSoundIds.length > 0
      ? availableResumeSoundIds
      : getDefaultResumeSoundIds(sounds, defaultPreset);
  let nextVolumes = volumes;

  for (const sound of sounds) {
    if (nextVolumes[sound.id] === undefined) {
      nextVolumes =
        nextVolumes === volumes
          ? { ...volumes, [sound.id]: DEFAULT_SOUND_VOLUME }
          : { ...nextVolumes, [sound.id]: DEFAULT_SOUND_VOLUME };
    }
  }

  return {
    playingSoundIds: nextPlayingSoundIds,
    resumeSoundIds: nextResumeSoundIds,
    volumes: nextVolumes,
  };
}
