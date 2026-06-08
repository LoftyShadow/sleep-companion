import { useCallback, useId } from "react";
import type { FileSystemPort } from "../storage/FileSystemPort";
import type { BilibiliAuthClient } from "./bilibiliAuth";
import type { BilibiliCreatorVideosLoader } from "./bilibiliCreator";
import { BilibiliCreatorPanel } from "./BilibiliCreatorPanel";
import { BilibiliFavoriteVideoPanel } from "./BilibiliFavoriteVideoPanel";
import { BilibiliVideoPlaybackPanel } from "./BilibiliVideoPlaybackPanel";
import type { BilibiliDirectAudioLoader } from "./bilibiliDirectAudio";
import type { PlaybackControlState } from "../playbackControl/playbackControlTypes";
import { useVideoListeningController } from "./useVideoListeningController";
import { VideoLinkPanel } from "./VideoLinkPanel";
import { VideoNowPanel } from "./VideoNowPanel";
import "./VideoListeningView.css";

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

  return (
    <div className="video-listening-view">
      {controller.combinedErrorMessage ? (
        <p className="error-message" role="alert">
          {controller.combinedErrorMessage}
        </p>
      ) : null}

      <div className="video-listening-layout">
        <section className="video-listening-stage" aria-label="听视频控制">
          <VideoLinkPanel
            inputId={inputId}
            sourceSummaryText={controller.sourceSummaryText}
            videoInput={controller.videoInput}
            onInputChange={controller.setVideoInput}
            onLoadVideo={handleLoadVideo}
            onPasteVideoLink={handlePasteVideoLink}
          />

          <VideoNowPanel
            audioRef={controller.audioRef}
            audioSource={controller.audioSource}
            canUseOuterPlaybackButton={controller.canUseOuterPlaybackButton}
            canUseOuterVolumeControl={controller.canUseOuterVolumeControl}
            isDirectAudioPlaying={controller.isDirectAudioPlaying}
            listeningVolume={controller.listeningVolume}
            loadedReferenceLabel={controller.loadedReferenceLabel}
            videoMetadata={controller.videoMetadata}
            videoPanelStatusText={controller.videoPanelStatusText}
            videoStatusText={controller.videoStatusText}
            videoTransportLabel={controller.videoTransportLabel}
            onListeningVolumeChange={controller.handleListeningVolumeChange}
            onTogglePlayback={controller.handleTogglePlayback}
          />
        </section>

        <BilibiliVideoPlaybackPanel
          audioRef={controller.audioRef}
          audioSource={controller.audioSource}
          currentTimeSeconds={controller.directAudioCurrentTimeSeconds}
          durationSeconds={controller.directAudioDurationSeconds}
          isAudioPlaying={controller.isDirectAudioPlaying}
          isLoading={controller.isDirectAudioLoading}
          onSeek={controller.seekDirectAudio}
        />

        <BilibiliFavoriteVideoPanel
          currentVideo={controller.currentFavoriteVideo}
          errorMessage={controller.favoriteErrorMessage}
          favoriteVideos={controller.favoriteVideos}
          isCurrentVideoFavorite={controller.isCurrentVideoFavorite}
          isLoading={controller.isLoadingFavorites}
          onDeleteVideo={handleDeleteFavoriteVideo}
          onSaveCurrentVideo={controller.handleSaveCurrentVideo}
          onVideoSelect={controller.handleFavoriteVideoSelect}
        />

        <BilibiliCreatorPanel
          authClient={bilibiliAuthClient}
          fileSystem={fileSystem}
          videosLoader={creatorVideosLoader}
          onVideoSelect={controller.handleCreatorVideoSelect}
        />
      </div>
    </div>
  );
}
