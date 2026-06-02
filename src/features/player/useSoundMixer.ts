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

const VOLUME_COMMIT_DELAY_MS = 64;

interface PendingVolumeCommit {
  resolvers: Array<() => void>;
  timeoutId: ReturnType<typeof setTimeout>;
  volume: number;
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

function getSoundPlaybackErrorMessage(error: unknown): string {
  const errorLike = error as { message?: unknown; name?: unknown };
  const errorName =
    typeof errorLike.name === "string" ? errorLike.name : "";
  const errorMessage =
    typeof errorLike.message === "string" ? errorLike.message : String(error);

  if (
    errorName === "NotSupportedError" ||
    errorMessage.includes("no supported source")
  ) {
    return "当前音频无法播放，请换一个声音试试";
  }

  if (errorName === "NotAllowedError") {
    return "浏览器阻止了自动播放，请先点击播放按钮";
  }

  return "播放失败，请稍后重试";
}

function toPlaybackError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  const errorLike = error as { message?: unknown; name?: unknown };
  const message =
    typeof errorLike.message === "string" ? errorLike.message : String(error);
  const playbackError = new Error(message);
  if (typeof errorLike.name === "string") {
    playbackError.name = errorLike.name;
  }

  return playbackError;
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
  const pendingVolumeCommitsRef = useRef<Map<SoundId, PendingVolumeCommit>>(
    new Map(),
  );

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

  const cancelPendingVolumeCommits = useCallback((soundId?: SoundId) => {
    const pendingCommits = pendingVolumeCommitsRef.current;
    const soundIds =
      soundId === undefined ? [...pendingCommits.keys()] : [soundId];

    for (const nextSoundId of soundIds) {
      const pending = pendingCommits.get(nextSoundId);
      if (!pending) {
        continue;
      }

      clearTimeout(pending.timeoutId);
      pendingCommits.delete(nextSoundId);
      for (const resolve of pending.resolvers) {
        resolve();
      }
    }
  }, []);

  const commitPendingVolume = useCallback(
    async (soundId: SoundId) => {
      const pending = pendingVolumeCommitsRef.current.get(soundId);
      if (!pending) {
        return;
      }

      pendingVolumeCommitsRef.current.delete(soundId);
      const nextVolume = pending.volume;

      try {
        setErrorMessage(null);
        logMixerEvent("set-volume-request", {
          soundId,
          volume: nextVolume,
          isPlaying: playingSoundIdsRef.current.has(soundId),
        });
        await player.setVolume(soundId, nextVolume);
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
      } finally {
        for (const resolve of pending.resolvers) {
          resolve();
        }
      }
    },
    [player],
  );

  const scheduleVolumeCommit = useCallback(
    (soundId: SoundId, volume: number) =>
      new Promise<void>((resolve) => {
        const pendingCommits = pendingVolumeCommitsRef.current;
        const existing = pendingCommits.get(soundId);

        if (existing) {
          clearTimeout(existing.timeoutId);
          existing.volume = volume;
          existing.resolvers.push(resolve);
          existing.timeoutId = setTimeout(() => {
            void commitPendingVolume(soundId);
          }, VOLUME_COMMIT_DELAY_MS);
          return;
        }

        pendingCommits.set(soundId, {
          resolvers: [resolve],
          timeoutId: setTimeout(() => {
            void commitPendingVolume(soundId);
          }, VOLUME_COMMIT_DELAY_MS),
          volume,
        });
      }),
    [commitPendingVolume],
  );

  useEffect(
    () => () => {
      cancelPendingVolumeCommits();
    },
    [cancelPendingVolumeCommits, player],
  );

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
      const playRequests = uniqueSoundIds(soundIds).flatMap((soundId) => {
        const sound = soundById.get(soundId);
        if (!sound) {
          return [];
        }

        return [
          player.play(sound, getSoundVolume(nextVolumes, soundId)).then(() => soundId),
        ];
      });
      const results = await Promise.allSettled(playRequests);
      const playedSoundIds: SoundId[] = [];
      let playbackError: Error | null = null;

      for (const result of results) {
        if (result.status === "fulfilled") {
          playedSoundIds.push(result.value);
        } else {
          playbackError ??= toPlaybackError(result.reason);
        }
      }

      if (playbackError) {
        throw playbackError;
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
          cancelPendingVolumeCommits(soundId);
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
        cancelPendingVolumeCommits(soundId);
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
        setErrorMessage(getSoundPlaybackErrorMessage(error));
      }
    },
    [player, replacePlayingSoundIds, replaceResumeSoundIds, soundById],
  );

  const setSoundVolume = useCallback(
    async (soundId: SoundId, volume: number) => {
      const nextVolume = normalizeVolume(volume);
      replaceVolumes({ ...volumesRef.current, [soundId]: nextVolume });
      setActivePresetId(null);
      await scheduleVolumeCommit(soundId, nextVolume);
    },
    [replaceVolumes, scheduleVolumeCommit],
  );

  const stopAll = useCallback(async () => {
    try {
      setErrorMessage(null);
      const previousPlayingSoundIds = [...playingSoundIdsRef.current];
      cancelPendingVolumeCommits();
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
  }, [
    cancelPendingVolumeCommits,
    player,
    replacePlayingSoundIds,
    replaceResumeSoundIds,
  ]);

  const applyPreset = useCallback(
    async (preset: SoundPreset) => {
      const nextVolumes = applyPresetVolumes(volumesRef.current, preset);
      const nextSoundIds = getPresetSoundIds(preset);

      try {
        setErrorMessage(null);
        cancelPendingVolumeCommits();
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
        setErrorMessage(getSoundPlaybackErrorMessage(error));
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
      setErrorMessage(getSoundPlaybackErrorMessage(error));
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
