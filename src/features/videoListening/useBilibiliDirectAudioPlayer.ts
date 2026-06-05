import { useCallback, useEffect, useRef, useState } from "react";
import type {
  BilibiliDirectAudioLoader,
  BilibiliDirectAudioReference,
  BilibiliDirectAudioSource,
} from "./bilibiliDirectAudio";

const DEFAULT_DIRECT_AUDIO_VOLUME = 70;

interface UseBilibiliDirectAudioPlayerOptions {
  defaultVolume?: number;
  loader: BilibiliDirectAudioLoader;
}

function clampVolume(volume: number): number {
  if (!Number.isFinite(volume)) {
    return DEFAULT_DIRECT_AUDIO_VOLUME;
  }

  return Math.min(100, Math.max(0, Math.round(volume)));
}

function loadErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "解析 B 站直连音频失败";
}

function playbackErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "直连音频已载入，请点击播放";
  }

  return error instanceof Error && error.message.trim()
    ? error.message
    : "直连音频播放失败，请稍后重试";
}

function finiteMediaSeconds(value: number): number | null {
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function normalizePlaybackSeconds(seconds: number): number {
  return Math.max(0, seconds);
}

export function useBilibiliDirectAudioPlayer({
  defaultVolume = DEFAULT_DIRECT_AUDIO_VOLUME,
  loader,
}: UseBilibiliDirectAudioPlayerOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestIdRef = useRef(0);
  const volumeRef = useRef(clampVolume(defaultVolume));
  const [audioSource, setAudioSource] =
    useState<BilibiliDirectAudioSource | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeSeconds, setCurrentTimeSeconds] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [volume, setVolumeState] = useState(() => clampVolume(defaultVolume));

  const applyVolume = useCallback((nextVolume: number) => {
    const normalizedVolume = clampVolume(nextVolume);
    volumeRef.current = normalizedVolume;
    setVolumeState(normalizedVolume);

    if (audioRef.current) {
      audioRef.current.volume = normalizedVolume / 100;
    }
  }, []);

  const clearAudioElement = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (audio.currentSrc || audio.getAttribute("src")) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
  }, []);

  const stop = useCallback(() => {
    requestIdRef.current += 1;
    clearAudioElement();
    setAudioSource(null);
    setCurrentTimeSeconds(0);
    setDurationSeconds(0);
    setErrorMessage(null);
    setIsLoading(false);
    setIsPlaying(false);
  }, [clearAudioElement]);

  const load = useCallback(
    async (
      reference: BilibiliDirectAudioReference,
    ): Promise<BilibiliDirectAudioSource | null> => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      clearAudioElement();
      setAudioSource(null);
      setCurrentTimeSeconds(0);
      setDurationSeconds(0);
      setErrorMessage(null);
      setIsLoading(true);
      setIsPlaying(false);

      try {
        const nextAudioSource = await loader(reference);
        if (requestIdRef.current !== requestId) {
          return null;
        }

        setAudioSource(nextAudioSource);
        setCurrentTimeSeconds(0);
        setDurationSeconds(nextAudioSource.durationSeconds ?? 0);
        const audio = audioRef.current;
        if (!audio) {
          setIsPlaying(false);

          return nextAudioSource;
        }

        audio.src = nextAudioSource.audioUrl;
        audio.volume = volumeRef.current / 100;
        audio.load();

        try {
          await audio.play();
          if (requestIdRef.current === requestId) {
            setIsPlaying(true);
          }
        } catch (error) {
          if (requestIdRef.current === requestId) {
            setIsPlaying(false);
            setErrorMessage(playbackErrorMessage(error));
          }
        }

        return nextAudioSource;
      } catch (error) {
        if (requestIdRef.current !== requestId) {
          return null;
        }

        setAudioSource(null);
        setCurrentTimeSeconds(0);
        setDurationSeconds(0);
        setErrorMessage(loadErrorMessage(error));
        setIsPlaying(false);

        return null;
      } finally {
        if (requestIdRef.current === requestId) {
          setIsLoading(false);
        }
      }
    },
    [clearAudioElement, loader],
  );

  const seekTo = useCallback(
    (seconds: number) => {
      if (!audioSource) {
        setErrorMessage("请先载入 B 站视频链接");
        return;
      }

      const audio = audioRef.current;
      if (!audio) {
        setErrorMessage("直连音频播放器尚未准备好");
        return;
      }

      const normalizedSeconds = normalizePlaybackSeconds(seconds);
      const targetSeconds =
        durationSeconds > 0
          ? Math.min(normalizedSeconds, durationSeconds)
          : normalizedSeconds;

      try {
        audio.currentTime = targetSeconds;
        setCurrentTimeSeconds(targetSeconds);
        setErrorMessage(null);
      } catch {
        setErrorMessage("当前直连音频暂不能跳转进度");
      }
    },
    [audioSource, durationSeconds],
  );

  const toggle = useCallback(async () => {
    if (!audioSource) {
      setErrorMessage("请先载入 B 站视频链接");
      return;
    }

    const audio = audioRef.current;
    if (!audio) {
      setErrorMessage("直连音频播放器尚未准备好");
      return;
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      setErrorMessage(null);
      return;
    }

    try {
      await audio.play();
      setIsPlaying(true);
      setErrorMessage(null);
    } catch (error) {
      setIsPlaying(false);
      setErrorMessage(playbackErrorMessage(error));
    }
  }, [audioSource, isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return undefined;
    }

    const handlePlay = () => {
      setIsPlaying(true);
      setErrorMessage(null);
    };
    const handlePause = () => {
      setIsPlaying(false);
    };
    const handleEnded = () => {
      setIsPlaying(false);
    };
    const updateCurrentTime = () => {
      setCurrentTimeSeconds(finiteMediaSeconds(audio.currentTime) ?? 0);
    };
    const updateDuration = () => {
      const mediaDuration = finiteMediaSeconds(audio.duration);
      setDurationSeconds((currentDuration) =>
        mediaDuration ?? audioSource?.durationSeconds ?? currentDuration,
      );
    };
    const handleError = () => {
      if (audio.currentSrc) {
        setErrorMessage("直连音频播放失败，请重新载入");
      }
      setIsPlaying(false);
    };

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("durationchange", updateDuration);
    audio.addEventListener("error", handleError);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("timeupdate", updateCurrentTime);

    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("durationchange", updateDuration);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("timeupdate", updateCurrentTime);
    };
  }, [audioSource]);

  useEffect(() => {
    volumeRef.current = volume;
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  return {
    audioRef,
    audioSource,
    currentTimeSeconds,
    durationSeconds,
    errorMessage,
    isLoading,
    isPlaying,
    load,
    seekTo,
    setVolume: applyVolume,
    stop,
    toggle,
    volume,
  };
}
