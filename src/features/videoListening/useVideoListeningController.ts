import { useCallback, useEffect, useRef, useState } from "react";
import type { FileSystemPort } from "../storage/FileSystemPort";
import type {
  PlaybackControlState,
  PlaybackControlStatus,
} from "../playbackControl/playbackControlTypes";
import type { BilibiliMetadata } from "./bilibiliMetadata";
import {
  parseBilibiliInput,
  type BilibiliReference,
  type BilibiliVideoReference,
} from "./bilibiliVideo";
import {
  loadBilibiliDirectAudio,
  type BilibiliDirectAudioLoader,
  type BilibiliDirectAudioSource,
} from "./bilibiliDirectAudio";
import type {
  BilibiliCreatorVideo,
} from "./bilibiliCreator";
import {
  createFavoriteVideoInputFromCreatorVideo,
  createFavoriteVideoInputFromDirectSource,
  type BilibiliFavoriteVideo,
  type BilibiliFavoriteVideoInput,
} from "./bilibiliFavoriteVideo";
import { useBilibiliDirectAudioPlayer } from "./useBilibiliDirectAudioPlayer";
import { useBilibiliFavoriteVideos } from "./useBilibiliFavoriteVideos";

const DEFAULT_VIDEO_INPUT = "";
const DEFAULT_LISTENING_VOLUME = 70;

type BilibiliDirectAudioReference = Extract<
  BilibiliVideoReference,
  { kind: "aid" | "bvid" }
>;

interface UseVideoListeningControllerOptions {
  directAudioLoader?: BilibiliDirectAudioLoader;
  fileSystem?: FileSystemPort;
  globalStopRequestId: number;
  playbackControlRequestId?: number;
  onPlaybackControlStateChange?: (state: PlaybackControlState) => void;
}

function getVideoPlaybackControlStatus(
  audioSource: BilibiliDirectAudioSource | null,
  isLoading: boolean,
  isPlaying: boolean,
): PlaybackControlStatus {
  if (isLoading) {
    return "loading";
  }

  if (!audioSource) {
    return "unavailable";
  }

  return isPlaying ? "playing" : "paused";
}

function getVideoPlaybackControlActionLabel(
  audioSource: BilibiliDirectAudioSource | null,
  isLoading: boolean,
  isPlaying: boolean,
): string {
  if (isLoading) {
    return "载入中";
  }

  if (!audioSource) {
    return "打开";
  }

  return isPlaying ? "暂停" : "播放";
}

function getVideoTransportButtonLabel(
  audioSource: BilibiliDirectAudioSource | null,
  isLoading: boolean,
  isPlaying: boolean,
): string {
  if (isLoading) {
    return "载入中";
  }

  if (!audioSource) {
    return "播放";
  }

  return isPlaying ? "暂停" : "播放";
}

function getVideoStatusText({
  audioSource,
  errorMessage,
  isLoading,
  isPlaying,
}: {
  audioSource: BilibiliDirectAudioSource | null;
  errorMessage: string | null;
  isLoading: boolean;
  isPlaying: boolean;
}): string {
  if (isLoading) {
    return "正在解析 B 站直连媒体";
  }

  if (errorMessage) {
    return errorMessage;
  }

  if (!audioSource) {
    return "粘贴链接后开始收听";
  }

  return isPlaying ? "正在播放直连音频" : "直连音频已暂停";
}

function getBilibiliReferenceLabel(reference: BilibiliReference): string {
  switch (reference.kind) {
    case "bvid":
      return `BV ${reference.value}`;
    case "aid":
      return `av ${reference.value}`;
    case "ep":
      return `ep ${reference.value}`;
    case "live":
      return `直播间 ${reference.value}`;
  }
}

function canUseDirectAudio(
  reference: BilibiliReference,
): reference is BilibiliDirectAudioReference {
  return reference.kind === "bvid" || reference.kind === "aid";
}

export function useVideoListeningController({
  directAudioLoader = loadBilibiliDirectAudio,
  fileSystem,
  globalStopRequestId,
  playbackControlRequestId = 0,
  onPlaybackControlStateChange,
}: UseVideoListeningControllerOptions) {
  const [videoInput, setVideoInput] = useState(DEFAULT_VIDEO_INPUT);
  const [activeReference, setActiveReference] =
    useState<BilibiliReference | null>(null);
  const [videoMetadata, setVideoMetadata] = useState<BilibiliMetadata | null>(
    null,
  );
  const [currentFavoriteVideo, setCurrentFavoriteVideo] =
    useState<BilibiliFavoriteVideoInput | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const handledGlobalStopRequestIdRef = useRef(globalStopRequestId);
  const handledPlaybackControlRequestIdRef = useRef(0);
  const {
    audioRef,
    audioSource,
    currentTimeSeconds: directAudioCurrentTimeSeconds,
    durationSeconds: directAudioDurationSeconds,
    errorMessage: directAudioErrorMessage,
    isLoading: isDirectAudioLoading,
    isPlaying: isDirectAudioPlaying,
    load: loadDirectAudio,
    seekTo: seekDirectAudio,
    setVolume: setDirectAudioVolume,
    stop: stopDirectAudio,
    toggle: toggleDirectAudio,
    volume: listeningVolume,
  } = useBilibiliDirectAudioPlayer({
    defaultVolume: DEFAULT_LISTENING_VOLUME,
    loader: directAudioLoader,
  });
  const {
    deleteFavorite,
    errorMessage: favoriteErrorMessage,
    favoriteVideos,
    isFavorite,
    isLoadingFavorites,
    saveFavorite,
  } = useBilibiliFavoriteVideos({ fileSystem });
  const combinedErrorMessage = errorMessage ?? directAudioErrorMessage;
  const isCurrentVideoFavorite = isFavorite(currentFavoriteVideo?.bvid);
  const canUsePlaybackControlAction =
    !isDirectAudioLoading && (Boolean(audioSource) || !activeReference);
  const canUseOuterPlaybackButton = Boolean(audioSource) && !isDirectAudioLoading;
  const canUseOuterVolumeControl = Boolean(audioSource);
  const playbackControlStatus = getVideoPlaybackControlStatus(
    audioSource,
    isDirectAudioLoading,
    isDirectAudioPlaying,
  );

  const handleTogglePlayback = useCallback(() => {
    setErrorMessage(null);
    void toggleDirectAudio();
  }, [toggleDirectAudio]);

  useEffect(() => {
    if (globalStopRequestId === handledGlobalStopRequestIdRef.current) {
      return;
    }

    handledGlobalStopRequestIdRef.current = globalStopRequestId;
    stopDirectAudio();
    setActiveReference(null);
    setVideoMetadata(null);
    setCurrentFavoriteVideo(null);
    setErrorMessage(null);
  }, [globalStopRequestId, stopDirectAudio]);

  useEffect(() => {
    onPlaybackControlStateChange?.({
      actionLabel: getVideoPlaybackControlActionLabel(
        audioSource,
        isDirectAudioLoading,
        isDirectAudioPlaying,
      ),
      canToggle: canUsePlaybackControlAction,
      status: playbackControlStatus,
      summary:
        videoMetadata?.title ??
        audioSource?.title ??
        (activeReference
          ? getBilibiliReferenceLabel(activeReference)
          : "未载入来源"),
    });
  }, [
    activeReference,
    audioSource,
    canUsePlaybackControlAction,
    isDirectAudioLoading,
    isDirectAudioPlaying,
    onPlaybackControlStateChange,
    playbackControlStatus,
    videoMetadata,
  ]);

  useEffect(() => {
    if (
      playbackControlRequestId === 0 ||
      playbackControlRequestId === handledPlaybackControlRequestIdRef.current
    ) {
      return;
    }

    handledPlaybackControlRequestIdRef.current = playbackControlRequestId;
    handleTogglePlayback();
  }, [handleTogglePlayback, playbackControlRequestId]);

  const loadVideoReference = useCallback(
    async (
      reference: BilibiliDirectAudioReference,
      metadataHint?: BilibiliMetadata,
      favoriteHint?: BilibiliFavoriteVideoInput,
    ) => {
      setActiveReference(reference);
      setVideoMetadata(metadataHint ?? null);
      setCurrentFavoriteVideo(null);
      setErrorMessage(null);

      const nextAudioSource = await loadDirectAudio(reference);
      if (!nextAudioSource) {
        return;
      }

      setVideoMetadata({
        imageUrl: nextAudioSource.coverUrl ?? metadataHint?.imageUrl,
        title: nextAudioSource.title,
      });
      const directFavoriteInput =
        createFavoriteVideoInputFromDirectSource(nextAudioSource);
      setCurrentFavoriteVideo({
        ...directFavoriteInput,
        coverUrl: directFavoriteInput.coverUrl ?? favoriteHint?.coverUrl,
        durationSeconds:
          directFavoriteInput.durationSeconds ?? favoriteHint?.durationSeconds,
        playCount: favoriteHint?.playCount,
        publishedAt: favoriteHint?.publishedAt,
        source: favoriteHint?.source ?? directFavoriteInput.source,
      });
    },
    [loadDirectAudio],
  );

  const resetVideoSource = useCallback(
    (errorText: string) => {
      stopDirectAudio();
      setActiveReference(null);
      setVideoMetadata(null);
      setCurrentFavoriteVideo(null);
      setErrorMessage(errorText);
    },
    [stopDirectAudio],
  );

  const handleLoadVideo = useCallback(async () => {
    const trimmedInput = videoInput.trim();
    if (!trimmedInput) {
      resetVideoSource("请输入 B 站视频或直播链接");
      return;
    }

    const reference = parseBilibiliInput(trimmedInput);
    if (!reference) {
      resetVideoSource("暂时只支持 B 站 BV 和 av 视频链接");
      return;
    }

    if (!canUseDirectAudio(reference)) {
      resetVideoSource(
        reference.kind === "ep"
          ? "当前直连模式暂不支持番剧链接"
          : "当前直连模式暂不支持直播间",
      );
      return;
    }

    await loadVideoReference(reference);
  }, [loadVideoReference, resetVideoSource, videoInput]);

  const handleCreatorVideoSelect = useCallback(
    (video: BilibiliCreatorVideo) => {
      const reference: BilibiliDirectAudioReference = {
        kind: "bvid",
        value: video.bvid,
      };

      setVideoInput(video.bvid);
      void loadVideoReference(
        reference,
        {
          imageUrl: video.coverUrl,
          title: video.title,
        },
        createFavoriteVideoInputFromCreatorVideo(video),
      );
    },
    [loadVideoReference],
  );

  const handleFavoriteVideoSelect = useCallback(
    (video: BilibiliFavoriteVideo) => {
      const reference: BilibiliDirectAudioReference = {
        kind: "bvid",
        value: video.bvid,
      };

      setVideoInput(video.bvid);
      void loadVideoReference(
        reference,
        {
          imageUrl: video.coverUrl,
          title: video.title,
        },
        video,
      );
    },
    [loadVideoReference],
  );

  const handleSaveCurrentVideo = useCallback(() => {
    if (!currentFavoriteVideo) {
      setErrorMessage("请先载入 B 站视频后再收藏");
      return;
    }

    void saveFavorite(currentFavoriteVideo);
  }, [currentFavoriteVideo, saveFavorite]);

  const handleListeningVolumeChange = useCallback(
    (nextVolume: number) => {
      setDirectAudioVolume(nextVolume);
    },
    [setDirectAudioVolume],
  );

  const handlePasteVideoLink = useCallback(async () => {
    if (!navigator.clipboard?.readText) {
      setErrorMessage("当前环境不能读取剪贴板，请手动粘贴");
      return;
    }

    try {
      const clipboardText = await navigator.clipboard.readText();
      setVideoInput(clipboardText);
      setErrorMessage(null);
    } catch {
      setErrorMessage("读取剪贴板失败，请手动粘贴");
    }
  }, []);

  const loadedReferenceLabel = activeReference
    ? getBilibiliReferenceLabel(activeReference)
    : null;
  const videoStatusText = getVideoStatusText({
    audioSource,
    errorMessage: combinedErrorMessage,
    isLoading: isDirectAudioLoading,
    isPlaying: isDirectAudioPlaying,
  });
  const videoPanelStatusText = isDirectAudioLoading
    ? "解析中"
    : audioSource
      ? isDirectAudioPlaying
        ? "播放中"
        : "已暂停"
      : "待命";
  const videoTransportLabel = getVideoTransportButtonLabel(
    audioSource,
    isDirectAudioLoading,
    isDirectAudioPlaying,
  );
  const sourceSummaryText = isDirectAudioLoading
    ? "正在解析直连媒体"
    : audioSource && loadedReferenceLabel
      ? `已载入 ${loadedReferenceLabel}`
      : "等待载入直连媒体";

  return {
    audioRef,
    audioSource,
    canUseOuterPlaybackButton,
    canUseOuterVolumeControl,
    combinedErrorMessage,
    currentFavoriteVideo,
    deleteFavorite,
    directAudioCurrentTimeSeconds,
    directAudioDurationSeconds,
    favoriteErrorMessage,
    favoriteVideos,
    handleCreatorVideoSelect,
    handleFavoriteVideoSelect,
    handleListeningVolumeChange,
    handleLoadVideo,
    handlePasteVideoLink,
    handleSaveCurrentVideo,
    handleTogglePlayback,
    isCurrentVideoFavorite,
    isDirectAudioLoading,
    isDirectAudioPlaying,
    isLoadingFavorites,
    listeningVolume,
    loadedReferenceLabel,
    seekDirectAudio,
    setVideoInput,
    sourceSummaryText,
    videoInput,
    videoMetadata,
    videoPanelStatusText,
    videoStatusText,
    videoTransportLabel,
  };
}
