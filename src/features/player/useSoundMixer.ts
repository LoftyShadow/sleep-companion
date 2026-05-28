import { useCallback, useEffect, useMemo, useState } from "react";
import type { SoundDefinition, SoundId } from "../sounds/soundCatalog";
import type { SoundPreset, SoundPresetId } from "../sounds/soundPresets";
import type { PlayerPort } from "./PlayerPort";
import { normalizeVolume } from "./PlayerPort";

interface UseSoundMixerOptions {
  sounds: SoundDefinition[];
  player: PlayerPort;
  defaultPreset?: SoundPreset;
}

type VolumeState = Record<SoundId, number>;

function createInitialVolumes(
  sounds: SoundDefinition[],
  defaultPreset?: SoundPreset,
): VolumeState {
  const volumes = Object.fromEntries(
    sounds.map((sound) => [sound.id, 0.5]),
  ) as VolumeState;

  for (const item of defaultPreset?.items ?? []) {
    volumes[item.soundId] = normalizeVolume(item.volume);
  }

  return volumes;
}

function uniqueSoundIds(soundIds: SoundId[]): SoundId[] {
  return [...new Set(soundIds)];
}

function getPresetSoundIds(preset: SoundPreset): SoundId[] {
  return uniqueSoundIds(preset.items.map((item) => item.soundId));
}

function getSoundVolume(volumes: VolumeState, soundId: SoundId): number {
  return volumes[soundId] ?? 0.5;
}

function hasSameSoundIds(left: SoundId[], right: SoundId[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function applyPresetVolumes(
  currentVolumes: VolumeState,
  preset: SoundPreset,
): VolumeState {
  const nextVolumes = { ...currentVolumes };

  for (const item of preset.items) {
    nextVolumes[item.soundId] = normalizeVolume(item.volume);
  }

  return nextVolumes;
}

export function useSoundMixer({
  sounds,
  player,
  defaultPreset,
}: UseSoundMixerOptions) {
  const soundById = useMemo(
    () =>
      new Map<SoundId, SoundDefinition>(
        sounds.map((sound) => [sound.id, sound]),
      ),
    [sounds],
  );
  const [playingSoundIds, setPlayingSoundIds] = useState<Set<SoundId>>(
    () => new Set(),
  );
  const [volumes, setVolumes] = useState<VolumeState>(() =>
    createInitialVolumes(sounds, defaultPreset),
  );
  const [resumeSoundIds, setResumeSoundIds] = useState<SoundId[]>(() =>
    defaultPreset
      ? getPresetSoundIds(defaultPreset)
      : sounds.map((sound) => sound.id),
  );
  const [activePresetId, setActivePresetId] = useState<SoundPresetId | null>(
    defaultPreset?.id ?? null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const availableSoundIds = new Set(sounds.map((sound) => sound.id));
    const fallbackResumeSoundIds = defaultPreset
      ? getPresetSoundIds(defaultPreset)
      : sounds.map((sound) => sound.id);

    setPlayingSoundIds((current) => {
      const nextSoundIds = [...current].filter((soundId) =>
        availableSoundIds.has(soundId),
      );
      return nextSoundIds.length === current.size ? current : new Set(nextSoundIds);
    });

    setResumeSoundIds((current) => {
      const nextSoundIds = current.filter((soundId) =>
        availableSoundIds.has(soundId),
      );
      const normalizedSoundIds =
        nextSoundIds.length > 0 ? nextSoundIds : fallbackResumeSoundIds;

      return hasSameSoundIds(current, normalizedSoundIds)
        ? current
        : normalizedSoundIds;
    });

    setVolumes((current) => {
      let hasChange = false;
      const nextVolumes = { ...current };

      for (const sound of sounds) {
        if (nextVolumes[sound.id] === undefined) {
          nextVolumes[sound.id] = 0.5;
          hasChange = true;
        }
      }

      return hasChange ? nextVolumes : current;
    });
  }, [defaultPreset, sounds]);

  const playSoundIds = useCallback(
    async (soundIds: SoundId[], nextVolumes: VolumeState) => {
      const playedSoundIds: SoundId[] = [];

      for (const soundId of uniqueSoundIds(soundIds)) {
        const sound = soundById.get(soundId);
        if (!sound) {
          continue;
        }

        await player.play(sound, getSoundVolume(nextVolumes, soundId));
        playedSoundIds.push(soundId);
      }

      return playedSoundIds;
    },
    [player, soundById],
  );

  const toggleSound = useCallback(
    async (soundId: SoundId) => {
      const sound = soundById.get(soundId);
      if (!sound) {
        return;
      }

      try {
        setErrorMessage(null);
        if (playingSoundIds.has(soundId)) {
          await player.pause(soundId);
          const nextPlayingSoundIds = new Set(playingSoundIds);
          nextPlayingSoundIds.delete(soundId);
          setPlayingSoundIds(nextPlayingSoundIds);
          setResumeSoundIds(
            nextPlayingSoundIds.size > 0
              ? [...nextPlayingSoundIds]
              : [soundId],
          );
          setActivePresetId(null);
          return;
        }

        await player.play(sound, getSoundVolume(volumes, soundId));
        const nextPlayingSoundIds = new Set(playingSoundIds).add(soundId);
        setPlayingSoundIds(nextPlayingSoundIds);
        setResumeSoundIds([...nextPlayingSoundIds]);
        setActivePresetId(null);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "播放失败");
      }
    },
    [player, playingSoundIds, soundById, volumes],
  );

  const setSoundVolume = useCallback(
    async (soundId: SoundId, volume: number) => {
      const nextVolume = normalizeVolume(volume);
      setVolumes((current) => ({ ...current, [soundId]: nextVolume }));
      try {
        setErrorMessage(null);
        await player.setVolume(soundId, nextVolume);
        setActivePresetId(null);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "音量调整失败");
      }
    },
    [player],
  );

  const stopAll = useCallback(async () => {
    try {
      setErrorMessage(null);
      await player.stopAll();
      if (playingSoundIds.size > 0) {
        setResumeSoundIds([...playingSoundIds]);
      }
      setPlayingSoundIds(new Set());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "停止播放失败");
    }
  }, [player, playingSoundIds]);

  const applyPreset = useCallback(
    async (preset: SoundPreset) => {
      const nextVolumes = applyPresetVolumes(volumes, preset);
      const nextSoundIds = getPresetSoundIds(preset);

      try {
        setErrorMessage(null);
        await player.stopAll();
        const playedSoundIds = await playSoundIds(nextSoundIds, nextVolumes);
        setVolumes(nextVolumes);
        setPlayingSoundIds(new Set(playedSoundIds));
        setResumeSoundIds(playedSoundIds);
        setActivePresetId(preset.id);
      } catch (error) {
        await player.stopAll().catch(() => undefined);
        setPlayingSoundIds(new Set());
        setErrorMessage(error instanceof Error ? error.message : "预设播放失败");
      }
    },
    [player, playSoundIds, volumes],
  );

  const toggleUnifiedPlayback = useCallback(async () => {
    if (playingSoundIds.size > 0) {
      await stopAll();
      return;
    }

    try {
      setErrorMessage(null);
      const soundIds =
        resumeSoundIds.length > 0
          ? resumeSoundIds
          : sounds.map((sound) => sound.id);
      const playedSoundIds = await playSoundIds(soundIds, volumes);
      setPlayingSoundIds(new Set(playedSoundIds));
      setResumeSoundIds(playedSoundIds);
    } catch (error) {
      await player.stopAll().catch(() => undefined);
      setPlayingSoundIds(new Set());
      setErrorMessage(error instanceof Error ? error.message : "播放失败");
    }
  }, [
    playSoundIds,
    player,
    playingSoundIds,
    resumeSoundIds,
    sounds,
    stopAll,
    volumes,
  ]);

  return {
    activePresetId,
    applyPreset,
    isAnySoundPlaying: playingSoundIds.size > 0,
    playingSoundIds,
    volumes,
    errorMessage,
    toggleUnifiedPlayback,
    toggleSound,
    setSoundVolume,
    stopAll,
  };
}
