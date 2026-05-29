import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AudiobookPlaybackStatus,
  AudiobookSegment,
} from "./audiobookTypes";
import {
  buildAudiobookChapters,
  findChapterIndexForSegment,
} from "./chapterGrouping";
import { segmentBookText } from "./textSegmentation";
import type {
  TtsEnginePort,
  TtsPlaybackHandle,
  TtsVoice,
} from "./TtsEnginePort";
import { normalizeSpeechRate } from "./TtsEnginePort";

interface UseAudiobookPlayerOptions {
  engine: TtsEnginePort;
  segments?: AudiobookSegment[];
  text?: string;
}

const DEFAULT_SPEECH_LANGUAGE = "zh-CN";

function getTtsErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return fallbackMessage;
}

function countMatches(text: string, pattern: RegExp): number {
  return Array.from(text.matchAll(pattern)).length;
}

function detectSpeechLanguage(text: string): string {
  const hanCount = countMatches(text, /[\u3400-\u9fff]/gu);
  const kanaCount = countMatches(text, /[\u3040-\u30ff]/gu);
  const hangulCount = countMatches(text, /[\uac00-\ud7af]/gu);
  const latinCount = countMatches(text, /[A-Za-z]/gu);

  if (kanaCount > 0 && kanaCount >= hanCount) {
    return "ja-JP";
  }

  if (hangulCount > 0 && hangulCount >= hanCount) {
    return "ko-KR";
  }

  if (latinCount > 0 && hanCount === 0 && kanaCount === 0 && hangulCount === 0) {
    return "en-US";
  }

  return DEFAULT_SPEECH_LANGUAGE;
}

function getLanguageFamily(language: string): string {
  const normalizedLanguage = language.toLowerCase();

  if (
    normalizedLanguage.startsWith("zh") ||
    normalizedLanguage.startsWith("cmn") ||
    normalizedLanguage.startsWith("yue") ||
    normalizedLanguage.startsWith("hak")
  ) {
    return "zh";
  }

  return normalizedLanguage.split("-")[0] ?? normalizedLanguage;
}

function findPreferredVoiceId(
  voices: TtsVoice[],
  speechLanguage: string,
): string | null {
  const speechFamily = getLanguageFamily(speechLanguage);
  const matchingVoices = voices.filter(
    (voice) => getLanguageFamily(voice.language) === speechFamily,
  );
  const defaultMatchingVoice = matchingVoices.find((voice) => voice.isDefault);

  return defaultMatchingVoice?.id ?? matchingVoices[0]?.id ?? null;
}

export function useAudiobookPlayer({
  engine,
  segments: inputSegments,
  text,
}: UseAudiobookPlayerOptions) {
  const segments = useMemo(
    () => inputSegments ?? segmentBookText(text ?? ""),
    [inputSegments, text],
  );
  const chapters = useMemo(() => buildAudiobookChapters(segments), [segments]);
  const [status, setStatus] = useState<AudiobookPlaybackStatus>("idle");
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [voices, setVoices] = useState<TtsVoice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [rate, setRateState] = useState(1);
  const [isLoadingVoices, setIsLoadingVoices] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const playbackHandleRef = useRef<TtsPlaybackHandle | null>(null);
  const requestIdRef = useRef(0);
  const playSegmentRef = useRef<
    ((segmentIndex: number) => Promise<void>) | null
  >(null);

  useEffect(() => {
    let isMounted = true;

    async function loadVoices() {
      setIsLoadingVoices(true);
      try {
        const nextVoices = await engine.listVoices();
        if (!isMounted) {
          return;
        }

        setVoices(nextVoices);
        setErrorMessage(null);
      } catch (error) {
        if (isMounted) {
          setErrorMessage(getTtsErrorMessage(error, "读取系统音色失败"));
        }
      } finally {
        if (isMounted) {
          setIsLoadingVoices(false);
        }
      }
    }

    void loadVoices();

    return () => {
      isMounted = false;
    };
  }, [engine]);

  useEffect(() => {
    setSelectedVoiceId((currentVoiceId) => {
      if (
        currentVoiceId &&
        voices.some((voice) => voice.id === currentVoiceId)
      ) {
        return currentVoiceId;
      }

      return null;
    });
  }, [voices]);

  const stopPlayback = useCallback(() => {
    const activePlaybackHandle = playbackHandleRef.current;
    requestIdRef.current += 1;
    activePlaybackHandle?.cancel();
    playbackHandleRef.current = null;
    if (activePlaybackHandle) {
      engine.cancel();
    }
    setStatus("idle");
  }, [engine]);

  useEffect(() => {
    stopPlayback();
    setCurrentSegmentIndex(0);
    setErrorMessage(null);
  }, [segments, stopPlayback]);

  useEffect(
    () => () => {
      requestIdRef.current += 1;
      playbackHandleRef.current?.cancel();
      engine.destroy();
    },
    [engine],
  );

  const playSegment = useCallback(
    async (segmentIndex: number) => {
      const segment = segments[segmentIndex];
      if (!segment) {
        setErrorMessage("没有可朗读的文本");
        setStatus("error");
        return;
      }

      if (!engine.isSupported()) {
        setErrorMessage("当前环境不支持系统 TTS");
        setStatus("error");
        return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      playbackHandleRef.current?.cancel();
      playbackHandleRef.current = null;
      setCurrentSegmentIndex(segmentIndex);
      setErrorMessage(null);
      setStatus("loading");

      try {
        const speechLanguage = detectSpeechLanguage(segment.text);
        const playbackHandle = await engine.speak({
          text: segment.text,
          voiceId:
            selectedVoiceId ?? findPreferredVoiceId(voices, speechLanguage),
          language: speechLanguage,
          rate,
          onEnd: () => {
            if (requestIdRef.current !== requestId) {
              return;
            }

            if (segmentIndex + 1 < segments.length) {
              void playSegmentRef.current?.(segmentIndex + 1);
              return;
            }

            playbackHandleRef.current = null;
            setStatus("ended");
          },
          onError: (message) => {
            if (requestIdRef.current !== requestId) {
              return;
            }
            setErrorMessage(message);
            setStatus("error");
          },
        });

        if (requestIdRef.current !== requestId) {
          playbackHandle.cancel();
          return;
        }

        playbackHandleRef.current = playbackHandle;
        setStatus("playing");
      } catch (error) {
        if (requestIdRef.current !== requestId) {
          return;
        }
        setErrorMessage(getTtsErrorMessage(error, "朗读失败"));
        setStatus("error");
      }
    },
    [engine, rate, segments, selectedVoiceId, voices],
  );

  playSegmentRef.current = playSegment;

  const play = useCallback(async () => {
    await playSegment(currentSegmentIndex);
  }, [currentSegmentIndex, playSegment]);

  const pause = useCallback(() => {
    if (
      status !== "playing" ||
      !playbackHandleRef.current ||
      !engine.supportsPause
    ) {
      return;
    }

    playbackHandleRef.current.pause();
    setStatus("paused");
  }, [engine.supportsPause, status]);

  const resume = useCallback(() => {
    if (
      status !== "paused" ||
      !playbackHandleRef.current ||
      !engine.supportsPause
    ) {
      return;
    }

    playbackHandleRef.current.resume();
    setStatus("playing");
  }, [engine.supportsPause, status]);

  const playPrevious = useCallback(async () => {
    await playSegment(Math.max(0, currentSegmentIndex - 1));
  }, [currentSegmentIndex, playSegment]);

  const playNext = useCallback(async () => {
    await playSegment(Math.min(segments.length - 1, currentSegmentIndex + 1));
  }, [currentSegmentIndex, playSegment, segments.length]);

  const currentChapterIndex = useMemo(
    () => findChapterIndexForSegment(chapters, currentSegmentIndex),
    [chapters, currentSegmentIndex],
  );
  const currentChapter =
    currentChapterIndex >= 0 ? (chapters[currentChapterIndex] ?? null) : null;

  const playChapterAt = useCallback(
    async (chapterIndex: number) => {
      const chapter = chapters[chapterIndex];
      if (!chapter) {
        setErrorMessage("没有可朗读的章节");
        setStatus("error");
        return;
      }

      await playSegment(chapter.startSegmentIndex);
    },
    [chapters, playSegment],
  );

  const playPreviousChapter = useCallback(async () => {
    if (currentChapterIndex < 0) {
      return;
    }

    await playChapterAt(Math.max(0, currentChapterIndex - 1));
  }, [currentChapterIndex, playChapterAt]);

  const playNextChapter = useCallback(async () => {
    if (currentChapterIndex < 0) {
      return;
    }

    await playChapterAt(Math.min(chapters.length - 1, currentChapterIndex + 1));
  }, [chapters.length, currentChapterIndex, playChapterAt]);

  const selectVoice = useCallback(
    (voiceId: string | null) => {
      stopPlayback();
      setSelectedVoiceId(voiceId);
    },
    [stopPlayback],
  );

  const setRate = useCallback(
    (nextRate: number) => {
      stopPlayback();
      setRateState(normalizeSpeechRate(nextRate));
    },
    [stopPlayback],
  );

  const currentSegment = segments[currentSegmentIndex] ?? null;
  const progressPercent =
    segments.length > 0
      ? Math.round(((currentSegmentIndex + 1) / segments.length) * 100)
      : 0;

  return {
    chapters,
    currentChapter,
    currentChapterIndex,
    currentSegment,
    currentSegmentIndex,
    errorMessage,
    isEngineSupported: engine.isSupported(),
    isLoadingVoices,
    pause,
    play,
    playChapterAt,
    playSegmentAt: playSegment,
    playNext,
    playNextChapter,
    playPrevious,
    playPreviousChapter,
    progressPercent,
    rate,
    resume,
    segments,
    selectVoice,
    selectedVoiceId,
    setRate,
    status,
    stop: stopPlayback,
    voices,
  };
}
