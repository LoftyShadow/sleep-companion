import { useCallback, useId, useRef, useState } from "react";
import type { FileSystemPort } from "../storage/FileSystemPort";
import type { BilibiliAuthClient } from "./bilibiliAuth";
import type { BilibiliCreatorVideosLoader } from "./bilibiliCreator";
import { BilibiliCreatorPanel } from "./BilibiliCreatorPanel";
import { BilibiliFavoriteVideoPanel } from "./BilibiliFavoriteVideoPanel";
import { BilibiliLoginPanel } from "./BilibiliLoginPanel";
import { BilibiliVideoPlaybackPanel } from "./BilibiliVideoPlaybackPanel";
import type { BilibiliDirectAudioLoader } from "./bilibiliDirectAudio";
import type { PlaybackControlState } from "../playbackControl/playbackControlTypes";
import { useVideoListeningController } from "./useVideoListeningController";
import { VideoLinkPanel } from "./VideoLinkPanel";
import { VideoNowPanel } from "./VideoNowPanel";
import "./VideoListeningView.css";

type VideoShortcutPanel = "favorites" | "creators";

const VIDEO_SHORTCUT_OPTIONS: Array<{
  panel: VideoShortcutPanel;
  label: string;
  openLabel: string;
  closeLabel: string;
}> = [
  {
    panel: "favorites",
    label: "收藏",
    openLabel: "打开收藏",
    closeLabel: "收起收藏",
  },
  {
    panel: "creators",
    label: "UP 主",
    openLabel: "打开 UP 主",
    closeLabel: "收起 UP 主",
  },
];

interface VideoListeningViewProps {
  bilibiliAuthClient?: BilibiliAuthClient;
  creatorVideosLoader?: BilibiliCreatorVideosLoader;
  directAudioLoader?: BilibiliDirectAudioLoader;
  fileSystem?: FileSystemPort;
  globalStopRequestId: number;
  playbackControlRequestId?: number;
  onPlaybackControlStateChange?: (state: PlaybackControlState) => void;
}

export function VideoListeningView({
  bilibiliAuthClient,
  creatorVideosLoader,
  directAudioLoader,
  fileSystem,
  globalStopRequestId,
  playbackControlRequestId = 0,
  onPlaybackControlStateChange,
}: VideoListeningViewProps) {
  const inputId = useId();
  const shortcutPanelId = useId();
  const inputSectionRef = useRef<HTMLDivElement | null>(null);
  const [activeShortcutPanel, setActiveShortcutPanel] =
    useState<VideoShortcutPanel | null>(null);
  const controller = useVideoListeningController({
    directAudioLoader,
    fileSystem,
    globalStopRequestId,
    playbackControlRequestId,
    onPlaybackControlStateChange,
  });
  const {
    deleteFavorite,
    handleLoadVideo: loadVideo,
    handlePasteVideoLink: pasteVideoLink,
  } = controller;
  const handleLoadVideo = useCallback(() => {
    void loadVideo();
  }, [loadVideo]);
  const handlePasteVideoLink = useCallback(() => {
    void pasteVideoLink();
  }, [pasteVideoLink]);
  const handleDeleteFavoriteVideo = useCallback(
    (bvid: string) => {
      void deleteFavorite(bvid);
    },
    [deleteFavorite],
  );
  const handleRequestLoadFavoriteVideo = useCallback(() => {
    inputSectionRef.current
      ?.querySelector<HTMLInputElement>(".video-link-input")
      ?.focus();
    if (typeof inputSectionRef.current?.scrollIntoView === "function") {
      inputSectionRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, []);
  const videoShortcutControls = (
    <section
      className="video-listening-shortcuts"
      aria-label="听视频来源选择"
    >
      <div className="video-shortcuts-bar">
        <div className="video-shortcuts-main">
          <span className="video-shortcuts-label">来源</span>
          <div className="video-shortcuts-tabs" role="group" aria-label="快捷面板">
            {VIDEO_SHORTCUT_OPTIONS.map((option) => {
              const isActive = activeShortcutPanel === option.panel;

              return (
                <button
                  className="video-shortcuts-tab"
                  key={option.panel}
                  type="button"
                  aria-controls={isActive ? shortcutPanelId : undefined}
                  aria-expanded={isActive}
                  aria-label={isActive ? option.closeLabel : option.openLabel}
                  aria-pressed={isActive}
                  onClick={() => {
                    setActiveShortcutPanel((currentPanel) =>
                      currentPanel === option.panel ? null : option.panel,
                    );
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
        <BilibiliLoginPanel
          authClient={bilibiliAuthClient}
          variant="avatar"
        />
      </div>
    </section>
  );
  const videoSourceWorkspace =
    activeShortcutPanel === "favorites" ? (
      <BilibiliFavoriteVideoPanel
        currentVideo={controller.currentFavoriteVideo}
        errorMessage={controller.favoriteErrorMessage}
        favoriteVideos={controller.favoriteVideos}
        isCurrentVideoFavorite={controller.isCurrentVideoFavorite}
        isLoading={controller.isLoadingFavorites}
        onDeleteVideo={handleDeleteFavoriteVideo}
        onRequestLoadVideo={handleRequestLoadFavoriteVideo}
        onVideoSelect={controller.handleFavoriteVideoSelect}
      />
    ) : activeShortcutPanel === "creators" ? (
      <BilibiliCreatorPanel
        fileSystem={fileSystem}
        videosLoader={creatorVideosLoader}
        onVideoSelect={controller.handleCreatorVideoSelect}
      />
    ) : null;

  return (
    <div className="video-listening-view">
      {controller.combinedErrorMessage ? (
        <p className="error-message" role="alert">
          {controller.combinedErrorMessage}
        </p>
      ) : null}

      <div className="video-listening-layout">
        <div className="video-listening-main">
          <section className="video-listening-stage" aria-label="听视频控制">
            <div className="video-listening-left-column">
              <div className="video-listening-input-slot" ref={inputSectionRef}>
                <VideoLinkPanel
                  inputId={inputId}
                  shortcutSlot={videoShortcutControls}
                  sourceSummaryText={controller.sourceSummaryText}
                  videoInput={controller.videoInput}
                  onInputChange={controller.setVideoInput}
                  onLoadVideo={handleLoadVideo}
                  onPasteVideoLink={handlePasteVideoLink}
                />
              </div>

              {videoSourceWorkspace ? (
                <div
                  className={
                    activeShortcutPanel === "creators"
                      ? "video-source-workspace is-creator-workspace"
                      : "video-source-workspace"
                  }
                  id={shortcutPanelId}
                >
                  {videoSourceWorkspace}
                </div>
              ) : null}
            </div>

            <div className="video-listening-right-column">
              <VideoNowPanel
                audioRef={controller.audioRef}
                audioSource={controller.audioSource}
                canUseOuterPlaybackButton={controller.canUseOuterPlaybackButton}
                canUseOuterVolumeControl={controller.canUseOuterVolumeControl}
                isDirectAudioPlaying={controller.isDirectAudioPlaying}
                isCurrentVideoFavorite={controller.isCurrentVideoFavorite}
                listeningVolume={controller.listeningVolume}
                loadedReferenceLabel={controller.loadedReferenceLabel}
                videoMetadata={controller.videoMetadata}
                videoPanelStatusText={controller.videoPanelStatusText}
                videoStatusText={controller.videoStatusText}
                videoTransportLabel={controller.videoTransportLabel}
                onListeningVolumeChange={controller.handleListeningVolumeChange}
                onSaveCurrentVideo={controller.handleSaveCurrentVideo}
                onTogglePlayback={controller.handleTogglePlayback}
              />

              <BilibiliVideoPlaybackPanel
                audioRef={controller.audioRef}
                audioSource={controller.audioSource}
                currentTimeSeconds={controller.directAudioCurrentTimeSeconds}
                durationSeconds={controller.directAudioDurationSeconds}
                isAudioPlaying={controller.isDirectAudioPlaying}
                isLoading={controller.isDirectAudioLoading}
                onSeek={controller.seekDirectAudio}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
