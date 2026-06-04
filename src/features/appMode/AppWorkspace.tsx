import { useCallback, useMemo, useState } from "react";
import { AudiobookView } from "../audiobook/AudiobookView";
import { createTtsEngine } from "../audiobook/createTtsEngine";
import type { FileSystemPort } from "../storage/FileSystemPort";
import type { TtsEnginePort } from "../audiobook/TtsEnginePort";
import { SoundMixerView } from "../mixer/SoundMixerView";
import type { PlayerPort } from "../player/PlayerPort";
import { useRuntimePlayer } from "../player/useRuntimePlayer";
import { useGlobalSleepTimer } from "../sleepTimer/useGlobalSleepTimer";
import { VideoListeningView } from "../videoListening/VideoListeningView";
import type { BilibiliAuthClient } from "../videoListening/bilibiliAuth";
import type { BilibiliCreatorVideosLoader } from "../videoListening/bilibiliCreator";
import type { BilibiliDirectAudioLoader } from "../videoListening/bilibiliDirectAudio";
import { AppModeSwitcher } from "./AppModeSwitcher";
import { APP_MODE_WORKSPACE_LABELS, type AppMode } from "./appModeTypes";
import { FloatingPlaybackControl } from "./FloatingPlaybackControl";
import { usePlaybackControlBus } from "./usePlaybackControlBus";
import { useWorkspaceScrollIndicator } from "./useWorkspaceScrollIndicator";
import "./AppWorkspace.css";
import "./AppWorkspace.mobile.css";

interface AppWorkspaceProps {
  bilibiliAuthClient?: BilibiliAuthClient;
  bilibiliCreatorVideosLoader?: BilibiliCreatorVideosLoader;
  bilibiliDirectAudioLoader?: BilibiliDirectAudioLoader;
  fileSystem?: FileSystemPort;
  player?: PlayerPort;
  ttsEngine?: TtsEnginePort;
}

export function AppWorkspace({
  bilibiliAuthClient,
  bilibiliCreatorVideosLoader,
  bilibiliDirectAudioLoader,
  fileSystem,
  player,
  ttsEngine,
}: AppWorkspaceProps) {
  const [activeAppMode, setActiveAppMode] = useState<AppMode>("mixer");
  const {
    handleShellScroll,
    resetScrollPosition,
    scrollIndicator,
    scrollIndicatorStyle,
    shellRef,
  } = useWorkspaceScrollIndicator();
  const activePlayer = useRuntimePlayer(player);
  const sleepTimer = useGlobalSleepTimer();
  const audiobookEngine = useMemo(
    () => ttsEngine ?? createTtsEngine(),
    [ttsEngine],
  );

  const openAppMode = useCallback((mode: AppMode) => {
    resetScrollPosition();
    setActiveAppMode(mode);
  }, [resetScrollPosition]);
  const {
    handleAudiobookPlaybackControlStateChange,
    handleMixerPlaybackControlStateChange,
    handleVideoPlaybackControlStateChange,
    hasOpenedAudiobook,
    hasOpenedVideo,
    markModeOpened,
    playbackControlRequestIds,
    playbackControlStates,
    requestGlobalPlaybackToggle,
    requestModulePlaybackToggle,
  } = usePlaybackControlBus(openAppMode);
  const handleAppModeChange = useCallback(
    (mode: AppMode) => {
      markModeOpened(mode);
      openAppMode(mode);
    },
    [markModeOpened, openAppMode],
  );

  return (
    <>
      <main className="app-shell" ref={shellRef} onScroll={handleShellScroll}>
        <section className="workspace-command-center" aria-label="工作台控制">
          <div className="workspace-brand">
            <span className="workspace-brand__mark" aria-hidden="true">
              <img
                className="workspace-brand__logo"
                src="/images/brand/mengban-logo.png"
                alt=""
                draggable={false}
              />
            </span>
            <div className="workspace-brand__copy">
              <p className="app-kicker">梦伴</p>
              <strong>{APP_MODE_WORKSPACE_LABELS[activeAppMode]}</strong>
            </div>
          </div>

          <AppModeSwitcher
            activeMode={activeAppMode}
            onModeChange={handleAppModeChange}
          />
        </section>

        <section
          className="app-mode-panel"
          hidden={activeAppMode !== "mixer"}
          aria-label="声音"
        >
          {activePlayer ? (
            <SoundMixerView
              globalStopRequestId={sleepTimer.globalStopRequestId}
              playbackControlRequestId={playbackControlRequestIds.mixer}
              player={activePlayer}
              onPlaybackControlStateChange={
                handleMixerPlaybackControlStateChange
              }
            />
          ) : (
            <div className="app-player-loading">
              <p className="app-kicker">睡眠声音</p>
              <h1>白噪音</h1>
              <p role="status">正在准备播放器</p>
            </div>
          )}
        </section>

        <section
          className="app-mode-panel"
          hidden={activeAppMode !== "audiobook"}
          aria-label="听书"
        >
          {hasOpenedAudiobook ? (
            <AudiobookView
              engine={audiobookEngine}
              fileSystem={fileSystem}
              globalStopRequestId={sleepTimer.globalStopRequestId}
              playbackControlRequestId={playbackControlRequestIds.audiobook}
              onPlaybackControlStateChange={
                handleAudiobookPlaybackControlStateChange
              }
            />
          ) : null}
        </section>

        <section
          className="app-mode-panel"
          hidden={activeAppMode !== "video"}
          aria-label="听视频"
        >
          {hasOpenedVideo ? (
            <VideoListeningView
              bilibiliAuthClient={bilibiliAuthClient}
              creatorVideosLoader={bilibiliCreatorVideosLoader}
              directAudioLoader={bilibiliDirectAudioLoader}
              fileSystem={fileSystem}
              globalStopRequestId={sleepTimer.globalStopRequestId}
              playbackControlRequestId={playbackControlRequestIds.video}
              onPlaybackControlStateChange={
                handleVideoPlaybackControlStateChange
              }
            />
          ) : null}
        </section>

      </main>

      <div
        className={
          scrollIndicator.isVisible
            ? "app-scroll-indicator is-visible"
            : "app-scroll-indicator"
        }
        style={scrollIndicatorStyle}
        aria-hidden="true"
      >
        <div className="app-scroll-indicator__thumb" />
      </div>

      <FloatingPlaybackControl
        controls={playbackControlStates}
        timer={{
          durationMinutes: sleepTimer.durationMinutes,
          remainingSeconds: sleepTimer.remainingSeconds,
          status: sleepTimer.status,
          onCancel: sleepTimer.cancel,
          onDurationChange: sleepTimer.setDurationMinutes,
          onStart: sleepTimer.start,
        }}
        onGlobalToggle={requestGlobalPlaybackToggle}
        onModuleToggle={requestModulePlaybackToggle}
      />
    </>
  );
}
