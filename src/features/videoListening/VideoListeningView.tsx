import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { FileSystemPort } from "../storage/FileSystemPort";
import type { BilibiliAuthClient } from "./bilibiliAuth";
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
import {
  createFavoriteVideoInputFromCreatorVideo,
  createFavoriteVideoInputFromDirectSource,
  type BilibiliFavoriteVideo,
  type BilibiliFavoriteVideoInput,
} from "./bilibiliFavoriteVideo";
import type {
  BilibiliCreatorVideo,
  BilibiliCreatorVideosLoader,
} from "./bilibiliCreator";
import { BilibiliCreatorPanel } from "./BilibiliCreatorPanel";
import { BilibiliFavoriteVideoPanel } from "./BilibiliFavoriteVideoPanel";
import { BilibiliVideoPlaybackPanel } from "./BilibiliVideoPlaybackPanel";
import type { BilibiliMetadata } from "./bilibiliMetadata";
import { useBilibiliDirectAudioPlayer } from "./useBilibiliDirectAudioPlayer";
import { useBilibiliFavoriteVideos } from "./useBilibiliFavoriteVideos";
import type {
  PlaybackControlState,
  PlaybackControlStatus,
} from "../playbackControl/playbackControlTypes";
import { PlaybackGlyph } from "../shared/PlaybackGlyph";
import "./VideoListeningView.css";

const DEFAULT_VIDEO_INPUT = "";
const DEFAULT_LISTENING_VOLUME = 70;

type BilibiliDirectAudioReference = Extract<
  BilibiliVideoReference,
  { kind: "aid" | "bvid" }
>;

interface VideoListeningViewProps {
  bilibiliAuthClient?: BilibiliAuthClient;
  creatorVideosLoader?: BilibiliCreatorVideosLoader;
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

export function VideoListeningView({
  bilibiliAuthClient,
  creatorVideosLoader,
  directAudioLoader = loadBilibiliDirectAudio,
  fileSystem,
  globalStopRequestId,
  playbackControlRequestId = 0,
  onPlaybackControlStateChange,
}: VideoListeningViewProps) {
  const inputId = useId();
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
    videoMetadata,
    onPlaybackControlStateChange,
    playbackControlStatus,
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

  async function loadVideoReference(
    reference: BilibiliDirectAudioReference,
    metadataHint?: BilibiliMetadata,
    favoriteHint?: BilibiliFavoriteVideoInput,
  ) {
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
  }

  function resetVideoSource(errorText: string) {
    stopDirectAudio();
    setActiveReference(null);
    setVideoMetadata(null);
    setCurrentFavoriteVideo(null);
    setErrorMessage(errorText);
  }

  async function handleLoadVideo() {
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
  }

  function handleCreatorVideoSelect(video: BilibiliCreatorVideo) {
    const reference: BilibiliDirectAudioReference = {
      kind: "bvid",
      value: video.bvid,
    };

    setVideoInput(video.bvid);
    void loadVideoReference(reference, {
      imageUrl: video.coverUrl,
      title: video.title,
    }, createFavoriteVideoInputFromCreatorVideo(video));
  }

  function handleFavoriteVideoSelect(video: BilibiliFavoriteVideo) {
    const reference: BilibiliDirectAudioReference = {
      kind: "bvid",
      value: video.bvid,
    };

    setVideoInput(video.bvid);
    void loadVideoReference(reference, {
      imageUrl: video.coverUrl,
      title: video.title,
    }, video);
  }

  function handleSaveCurrentVideo() {
    if (!currentFavoriteVideo) {
      setErrorMessage("请先载入 B 站视频后再收藏");
      return;
    }

    void saveFavorite(currentFavoriteVideo);
  }

  function handleListeningVolumeChange(nextVolume: number) {
    setDirectAudioVolume(nextVolume);
  }

  async function handlePasteVideoLink() {
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
  }

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
  const loadedReferenceLabel = activeReference
    ? getBilibiliReferenceLabel(activeReference)
    : null;
  const sourceSummaryText = isDirectAudioLoading
    ? "正在解析直连媒体"
    : audioSource && loadedReferenceLabel
      ? `已载入 ${loadedReferenceLabel}`
      : "等待载入直连媒体";

  return (
    <div className="video-listening-view">
      {combinedErrorMessage ? (
        <p className="error-message" role="alert">
          {combinedErrorMessage}
        </p>
      ) : null}

      <div className="video-listening-layout">
        <section className="video-listening-stage" aria-label="听视频控制">
          <section
            className="video-link-panel glass-panel"
            aria-label="B 站视频或直播链接"
          >
            <div className="video-link-form">
              <h1 className="video-listening-title">听视频</h1>

              <label className="field-label" htmlFor={inputId}>
                视频或直播链接
              </label>
              <div className="video-link-row">
                <input
                  className="video-link-input"
                  id={inputId}
                  placeholder="https://www.bilibili.com/video/BV... 或 https://live.bilibili.com/..."
                  type="text"
                  value={videoInput}
                  onChange={(event) => {
                    setVideoInput(event.currentTarget.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void handleLoadVideo();
                    }
                  }}
                />
                <button
                  className="secondary-control-button video-paste-button"
                  type="button"
                  onClick={() => {
                    void handlePasteVideoLink();
                  }}
                >
                  粘贴
                </button>
                <button
                  className="custom-audio-button video-load-button"
                  type="button"
                  onClick={() => {
                    void handleLoadVideo();
                  }}
                >
                  载入
                </button>
              </div>
              <div className="video-link-meta">
                <p className="video-link-hint">
                  支持 BV 和 av 视频链接；直连模式暂不支持番剧和直播。
                </p>
                <p className="custom-audio-status" role="status">
                  {sourceSummaryText}
                </p>
              </div>
            </div>
          </section>

          <section
            className="video-now glass-panel"
            aria-labelledby="video-player-heading"
          >
            <div className="section-heading sound-section-heading">
              <div>
                <h2 id="video-player-heading">收听面板</h2>
              </div>
              <span className="section-meta">
                {videoPanelStatusText}
              </span>
            </div>

            <div className="video-listening-card">
              <div className="video-cover-shell">
                {videoMetadata?.imageUrl ? (
                  <img
                    alt={`${videoMetadata.title} 封面`}
                    className="video-cover-image"
                    referrerPolicy="no-referrer"
                    src={videoMetadata.imageUrl}
                  />
                ) : (
                  <span className="video-cover-placeholder" aria-hidden="true">
                    B
                  </span>
                )}
              </div>
              <div className="video-listening-copy">
                <p className="app-kicker">
                  {audioSource ? "B 站直连音频" : "等待来源"}
                </p>
                <h3>{videoMetadata?.title ?? loadedReferenceLabel ?? "尚未载入"}</h3>
                <p>{videoStatusText}</p>
              </div>
            </div>

            <section className="video-listening-controls" aria-label="收听控制">
              <audio
                aria-label="直连音频播放器"
                className="video-direct-audio"
                preload="none"
                ref={audioRef}
              />
              <button
                className="transport-button video-playback-button"
                type="button"
                aria-pressed={audioSource ? isDirectAudioPlaying : undefined}
                disabled={!canUseOuterPlaybackButton}
                onClick={handleTogglePlayback}
              >
                <PlaybackGlyph
                  isPlaying={isDirectAudioPlaying}
                />
                <span>{videoTransportLabel}</span>
              </button>
              <label className="video-volume-control">
                <span className="field-label">
                  <span>收听音量</span>
                  <strong>{listeningVolume}%</strong>
                </span>
                <input
                  aria-label="收听音量"
                  className="video-volume-range"
                  disabled={!canUseOuterVolumeControl}
                  min="0"
                  max="100"
                  title={
                    canUseOuterVolumeControl
                      ? "调整直连音频音量"
                      : "载入直连音频后可调整音量"
                  }
                  type="range"
                  value={listeningVolume}
                  onChange={(event) => {
                    handleListeningVolumeChange(
                      Number(event.currentTarget.value),
                    );
                  }}
                />
              </label>
              <p className="video-control-hint">
                直连模式使用应用内音频播放器，可直接播放、暂停和调音量；视频画面可按需展开。
              </p>
            </section>
          </section>
        </section>

        <BilibiliVideoPlaybackPanel
          audioRef={audioRef}
          audioSource={audioSource}
          currentTimeSeconds={directAudioCurrentTimeSeconds}
          durationSeconds={directAudioDurationSeconds}
          isAudioPlaying={isDirectAudioPlaying}
          isLoading={isDirectAudioLoading}
          onSeek={seekDirectAudio}
        />

        <BilibiliFavoriteVideoPanel
          currentVideo={currentFavoriteVideo}
          errorMessage={favoriteErrorMessage}
          favoriteVideos={favoriteVideos}
          isCurrentVideoFavorite={isCurrentVideoFavorite}
          isLoading={isLoadingFavorites}
          onDeleteVideo={(bvid) => {
            void deleteFavorite(bvid);
          }}
          onSaveCurrentVideo={handleSaveCurrentVideo}
          onVideoSelect={handleFavoriteVideoSelect}
        />

        <BilibiliCreatorPanel
          authClient={bilibiliAuthClient}
          fileSystem={fileSystem}
          videosLoader={creatorVideosLoader}
          onVideoSelect={handleCreatorVideoSelect}
        />
      </div>
    </div>
  );
}
