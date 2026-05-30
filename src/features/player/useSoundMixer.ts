import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SoundDefinition, SoundId } from "../sounds/soundCatalog";
import type { SoundPreset, SoundPresetId } from "../sounds/soundPresets";
import type { PlayerPort } from "./PlayerPort";
import { normalizeVolume } from "./PlayerPort";
import {
  applyPresetVolumes,
  createInitialVolumes,
  getDefaultResumeSoundIds,
  getPresetSoundIds,
  getSoundVolume,
  hasSameSoundIds,
  reconcileSoundMixerState,
  uniqueSoundIds,
  type VolumeState,
} from "./soundMixerState";

interface UseSoundMixerOptions {
  sounds: SoundDefinition[];
  player: PlayerPort;
  defaultPreset?: SoundPreset;
}

function logMixerEvent(
  eventName: string,
  details: Record<string, unknown>,
): void {
  if (!import.meta.env.DEV || import.meta.env.MODE === "test") {
    return;
  }

  console.info(`[sound-mixer] ${eventName}`, details);
}

function logMixerError(
  eventName: string,
  error: unknown,
  details: Record<string, unknown>,
): void {
  if (!import.meta.env.DEV || import.meta.env.MODE === "test") {
    return;
  }

  console.warn(`[sound-mixer] ${eventName}`, {
    ...details,
    error: error instanceof Error ? error.message : String(error),
  });
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
  const playingSoundIdsRef = useRef<Set<SoundId>>(new Set());
  const [volumes, setVolumes] = useState<VolumeState>(() =>
    createInitialVolumes(sounds, defaultPreset),
  );
  const volumesRef = useRef<VolumeState>(volumes);
  const [resumeSoundIds, setResumeSoundIds] = useState<SoundId[]>(() =>
    getDefaultResumeSoundIds(sounds, defaultPreset),
  );
  const resumeSoundIdsRef = useRef<SoundId[]>(resumeSoundIds);
  const [activePresetId, setActivePresetId] = useState<SoundPresetId | null>(
    defaultPreset?.id ?? null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const replacePlayingSoundIds = useCallback((nextSoundIds: Set<SoundId>) => {
    playingSoundIdsRef.current = nextSoundIds;
    setPlayingSoundIds(nextSoundIds);
  }, []);

  const replaceVolumes = useCallback((nextVolumes: VolumeState) => {
    volumesRef.current = nextVolumes;
    setVolumes(nextVolumes);
  }, []);

  const replaceResumeSoundIds = useCallback((nextSoundIds: SoundId[]) => {
    resumeSoundIdsRef.current = nextSoundIds;
    setResumeSoundIds(nextSoundIds);
  }, []);

  useEffect(() => {
    const reconciledState = reconcileSoundMixerState({
      defaultPreset,
      playingSoundIds: playingSoundIdsRef.current,
      resumeSoundIds: resumeSoundIdsRef.current,
      sounds,
      volumes: volumesRef.current,
    });

    if (
      reconciledState.playingSoundIds.length !==
      playingSoundIdsRef.current.size
    ) {
      replacePlayingSoundIds(new Set(reconciledState.playingSoundIds));
    }

    if (
      !hasSameSoundIds(resumeSoundIdsRef.current, reconciledState.resumeSoundIds)
    ) {
      replaceResumeSoundIds(reconciledState.resumeSoundIds);
    }

    if (reconciledState.volumes !== volumesRef.current) {
      replaceVolumes(reconciledState.volumes);
    }
  }, [
    defaultPreset,
    replacePlayingSoundIds,
    replaceResumeSoundIds,
    replaceVolumes,
    sounds,
  ]);

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
        if (playingSoundIdsRef.current.has(soundId)) {
          logMixerEvent("pause-request", {
            soundId,
            playingSoundIds: [...playingSoundIdsRef.current],
          });
          await player.pause(soundId);
          const nextPlayingSoundIds = new Set(playingSoundIdsRef.current);
          nextPlayingSoundIds.delete(soundId);
          replacePlayingSoundIds(nextPlayingSoundIds);
          replaceResumeSoundIds(
            nextPlayingSoundIds.size > 0
              ? [...nextPlayingSoundIds]
              : [soundId],
          );
          setActivePresetId(null);
          logMixerEvent("pause-success", {
            soundId,
            playingSoundIds: [...nextPlayingSoundIds],
          });
          return;
        }

        const nextVolume = getSoundVolume(volumesRef.current, soundId);
        logMixerEvent("play-request", {
          soundId,
          volume: nextVolume,
          playingSoundIds: [...playingSoundIdsRef.current],
        });
        await player.play(sound, nextVolume);
        const nextPlayingSoundIds = new Set(playingSoundIdsRef.current).add(
          soundId,
        );
        replacePlayingSoundIds(nextPlayingSoundIds);
        replaceResumeSoundIds([...nextPlayingSoundIds]);
        setActivePresetId(null);
        logMixerEvent("play-success", {
          soundId,
          volume: nextVolume,
          playingSoundIds: [...nextPlayingSoundIds],
        });
      } catch (error) {
        logMixerError("toggle-failed", error, { soundId });
        setErrorMessage(error instanceof Error ? error.message : "播放失败");
      }
    },
    [player, replacePlayingSoundIds, replaceResumeSoundIds, soundById],
  );

  const setSoundVolume = useCallback(
    async (soundId: SoundId, volume: number) => {
      const nextVolume = normalizeVolume(volume);
      replaceVolumes({ ...volumesRef.current, [soundId]: nextVolume });
      try {
        setErrorMessage(null);
        logMixerEvent("set-volume-request", {
          soundId,
          volume: nextVolume,
          isPlaying: playingSoundIdsRef.current.has(soundId),
        });
        await player.setVolume(soundId, nextVolume);
        setActivePresetId(null);
        logMixerEvent("set-volume-success", {
          soundId,
          volume: nextVolume,
          isPlaying: playingSoundIdsRef.current.has(soundId),
        });
      } catch (error) {
        logMixerError("set-volume-failed", error, {
          soundId,
          volume: nextVolume,
        });
        setErrorMessage(error instanceof Error ? error.message : "音量调整失败");
      }
    },
    [player, replaceVolumes],
  );

  const stopAll = useCallback(async () => {
    try {
      setErrorMessage(null);
      const previousPlayingSoundIds = [...playingSoundIdsRef.current];
      logMixerEvent("stop-all-request", {
        playingSoundIds: previousPlayingSoundIds,
      });
      await player.stopAll();
      if (previousPlayingSoundIds.length > 0) {
        replaceResumeSoundIds(previousPlayingSoundIds);
      }
      replacePlayingSoundIds(new Set());
      logMixerEvent("stop-all-success", {
        resumeSoundIds: previousPlayingSoundIds,
      });
    } catch (error) {
      logMixerError("stop-all-failed", error, {});
      setErrorMessage(error instanceof Error ? error.message : "停止播放失败");
    }
  }, [player, replacePlayingSoundIds, replaceResumeSoundIds]);

  const applyPreset = useCallback(
    async (preset: SoundPreset) => {
      const nextVolumes = applyPresetVolumes(volumesRef.current, preset);
      const nextSoundIds = getPresetSoundIds(preset);

      try {
        setErrorMessage(null);
        logMixerEvent("apply-preset-request", {
          presetId: preset.id,
          soundIds: nextSoundIds,
        });
        await player.stopAll();
        const playedSoundIds = await playSoundIds(nextSoundIds, nextVolumes);
        replaceVolumes(nextVolumes);
        replacePlayingSoundIds(new Set(playedSoundIds));
        replaceResumeSoundIds(playedSoundIds);
        setActivePresetId(preset.id);
        logMixerEvent("apply-preset-success", {
          presetId: preset.id,
          soundIds: playedSoundIds,
        });
      } catch (error) {
        await player.stopAll().catch(() => undefined);
        replacePlayingSoundIds(new Set());
        logMixerError("apply-preset-failed", error, { presetId: preset.id });
        setErrorMessage(error instanceof Error ? error.message : "预设播放失败");
      }
    },
    [
      player,
      playSoundIds,
      replacePlayingSoundIds,
      replaceResumeSoundIds,
      replaceVolumes,
    ],
  );

  const toggleUnifiedPlayback = useCallback(async () => {
    if (playingSoundIdsRef.current.size > 0) {
      await stopAll();
      return;
    }

    try {
      setErrorMessage(null);
      const soundIds =
        resumeSoundIdsRef.current.length > 0
          ? resumeSoundIdsRef.current
          : sounds.map((sound) => sound.id);
      logMixerEvent("toggle-unified-play-request", { soundIds });
      const playedSoundIds = await playSoundIds(soundIds, volumesRef.current);
      replacePlayingSoundIds(new Set(playedSoundIds));
      replaceResumeSoundIds(playedSoundIds);
      logMixerEvent("toggle-unified-play-success", { soundIds: playedSoundIds });
    } catch (error) {
      await player.stopAll().catch(() => undefined);
      replacePlayingSoundIds(new Set());
      logMixerError("toggle-unified-play-failed", error, {});
      setErrorMessage(error instanceof Error ? error.message : "播放失败");
    }
  }, [
    playSoundIds,
    player,
    replacePlayingSoundIds,
    replaceResumeSoundIds,
    sounds,
    stopAll,
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
