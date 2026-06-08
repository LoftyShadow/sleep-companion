import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, RefObject } from "react";
import type { BilibiliDirectAudioSource } from "./bilibiliDirectAudio";
import {
  applyVideoPreviewFallbackAction,
  getVideoPreviewFallbackAction,
  getVideoTracks,
  getVideoTrackSourceUrls,
  hasRenderedVideoFrame,
  isInterruptedPlaybackError,
  VIDEO_PREVIEW_FRAME_TIMEOUT_MS,
} from "./bilibiliVideoPlaybackUtils";

interface UseBilibiliVideoPreviewOptions {
  audioRef: RefObject<HTMLAudioElement | null>;
  audioSource: BilibiliDirectAudioSource | null;
  isAudioPlaying: boolean;
}

export function useBilibiliVideoPreview({
  audioRef,
  audioSource,
  isAudioPlaying,
}: UseBilibiliVideoPreviewOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const latestPlaybackRef = useRef({
    isExpanded: false,
    sourceKey: "",
    videoUrl: "",
  });
  const sourceKey = audioSource
    ? `${audioSource.bvid}:${audioSource.cid}:${audioSource.audioUrl}`
    : "";
  const videoTracks = useMemo(() => getVideoTracks(audioSource), [audioSource]);
  const [expandedSourceKey, setExpandedSourceKey] = useState<string | null>(
    null,
  );
  const [selectedVideoTrack, setSelectedVideoTrack] = useState({
    sourceKey: "",
    trackId: "",
  });
  const [selectedVideoSource, setSelectedVideoSource] = useState({
    index: 0,
    sourceKey: "",
    trackId: "",
  });
  const [videoError, setVideoError] = useState<{
    message: string;
    sourceKey: string;
  } | null>(null);
  const selectedVideoTrackId =
    selectedVideoTrack.sourceKey === sourceKey &&
    videoTracks.some((track) => track.id === selectedVideoTrack.trackId)
      ? selectedVideoTrack.trackId
      : (videoTracks[0]?.id ?? "");
  const currentVideoTrackIndex = videoTracks.findIndex(
    (track) => track.id === selectedVideoTrackId,
  );
  const currentVideoTrack =
    currentVideoTrackIndex >= 0 ? videoTracks[currentVideoTrackIndex] : null;
  const nextVideoTrackId =
    currentVideoTrackIndex >= 0
      ? (videoTracks[currentVideoTrackIndex + 1]?.id ?? "")
      : "";
  const videoSourceUrls = useMemo(
    () => getVideoTrackSourceUrls(currentVideoTrack),
    [currentVideoTrack],
  );
  const selectedVideoSourceIndex =
    selectedVideoSource.sourceKey === sourceKey &&
    selectedVideoSource.trackId === selectedVideoTrackId &&
    videoSourceUrls.length > 0
      ? Math.min(selectedVideoSource.index, videoSourceUrls.length - 1)
      : 0;
  const selectedVideoUrl = videoSourceUrls[selectedVideoSourceIndex];
  const canExpandVideo = videoTracks.length > 0;
  const isVideoUnavailable = videoError?.sourceKey === sourceKey;
  const isExpanded = Boolean(
    canExpandVideo &&
      sourceKey &&
      expandedSourceKey === sourceKey &&
      !isVideoUnavailable,
  );
  const videoErrorMessage =
    isVideoUnavailable ? videoError.message : null;

  const applyFallback = useCallback(
    (
      context: Parameters<typeof getVideoPreviewFallbackAction>[0],
    ) => {
      applyVideoPreviewFallbackAction(
        getVideoPreviewFallbackAction(context),
        {
          setExpandedSourceKey,
          setSelectedVideoSource,
          setSelectedVideoTrack,
          setVideoError,
        },
      );
    },
    [],
  );

  useEffect(() => {
    latestPlaybackRef.current = {
      isExpanded,
      sourceKey,
      videoUrl: selectedVideoUrl ?? "",
    };
  }, [isExpanded, selectedVideoUrl, sourceKey]);

  useEffect(() => {
    if (!isExpanded || !selectedVideoUrl) {
      return;
    }

    const video = videoRef.current;
    if (!video) {
      return;
    }

    const audio = audioRef.current;
    video.muted = true;
    video.volume = 0;

    if (audio && Number.isFinite(audio.currentTime)) {
      try {
        video.currentTime = audio.currentTime;
      } catch {
        // 浏览器可能在 metadata 尚未载入时拒绝设置 currentTime。
      }
    }

    if (!isAudioPlaying) {
      video.pause();
      return;
    }

    const previewTimeoutId = window.setTimeout(() => {
      const latestPlayback = latestPlaybackRef.current;
      const latestVideo = videoRef.current;
      if (
        !latestPlayback.isExpanded ||
        latestPlayback.sourceKey !== sourceKey ||
        latestPlayback.videoUrl !== selectedVideoUrl ||
        !latestVideo ||
        hasRenderedVideoFrame(latestVideo)
      ) {
        return;
      }

      applyFallback({
        nextVideoTrackId,
        selectedVideoSourceIndex,
        selectedVideoTrackId,
        sourceCount: videoSourceUrls.length,
        sourceKey,
      });
    }, VIDEO_PREVIEW_FRAME_TIMEOUT_MS);

    void video.play().catch((error: unknown) => {
      if (isInterruptedPlaybackError(error)) {
        return;
      }

      const latestPlayback = latestPlaybackRef.current;
      if (
        !latestPlayback.isExpanded ||
        latestPlayback.sourceKey !== sourceKey ||
        latestPlayback.videoUrl !== selectedVideoUrl
      ) {
        return;
      }

      applyFallback({
        nextVideoTrackId,
        selectedVideoSourceIndex,
        selectedVideoTrackId,
        sourceCount: videoSourceUrls.length,
        sourceKey,
      });
    });

    return () => {
      window.clearTimeout(previewTimeoutId);
    };
  }, [
    applyFallback,
    audioRef,
    isAudioPlaying,
    isExpanded,
    nextVideoTrackId,
    selectedVideoSourceIndex,
    selectedVideoTrackId,
    selectedVideoUrl,
    sourceKey,
    videoSourceUrls.length,
  ]);

  const handleToggleVideo = useCallback(() => {
    if (!canExpandVideo || !sourceKey) {
      return;
    }

    if (isVideoUnavailable) {
      setSelectedVideoSource({
        index: 0,
        sourceKey,
        trackId: selectedVideoTrackId,
      });
      setVideoError(null);
      setExpandedSourceKey(sourceKey);
      return;
    }

    setVideoError(null);
    setExpandedSourceKey((currentValue) =>
      currentValue === sourceKey ? null : sourceKey,
    );
  }, [canExpandVideo, isVideoUnavailable, selectedVideoTrackId, sourceKey]);

  const handleQualityChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      if (!sourceKey) {
        return;
      }

      setVideoError(null);
      setSelectedVideoTrack({
        sourceKey,
        trackId: event.currentTarget.value,
      });
      setSelectedVideoSource({
        index: 0,
        sourceKey,
        trackId: event.currentTarget.value,
      });
    },
    [sourceKey],
  );

  const seekVideoPreviewTo = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    try {
      video.currentTime = seconds;
    } catch {
      // 浏览器可能在 metadata 尚未载入时拒绝设置 currentTime。
    }
  }, []);

  const handleVideoError = useCallback(() => {
    applyFallback({
      nextVideoTrackId,
      selectedVideoSourceIndex,
      selectedVideoTrackId,
      sourceCount: videoSourceUrls.length,
      sourceKey,
    });
  }, [
    applyFallback,
    nextVideoTrackId,
    selectedVideoSourceIndex,
    selectedVideoTrackId,
    sourceKey,
    videoSourceUrls.length,
  ]);

  return {
    canExpandVideo,
    currentVideoTrack,
    handleQualityChange,
    handleToggleVideo,
    handleVideoError,
    isExpanded,
    isVideoUnavailable,
    seekVideoPreviewTo,
    selectedVideoTrackId,
    selectedVideoUrl,
    videoErrorMessage,
    videoRef,
    videoTracks,
  };
}
