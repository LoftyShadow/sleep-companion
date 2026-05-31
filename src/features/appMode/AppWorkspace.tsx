import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { AudiobookView } from "../audiobook/AudiobookView";
import { createTtsEngine } from "../audiobook/createTtsEngine";
import type { TtsEnginePort } from "../audiobook/TtsEnginePort";
import { SoundMixerView } from "../mixer/SoundMixerView";
import type { PlayerPort } from "../player/PlayerPort";
import {
  DEFAULT_PLAYBACK_CONTROL_STATES,
  INITIAL_PLAYBACK_CONTROL_REQUEST_IDS,
  PLAYBACK_MODULE_IDS,
  type PlaybackControlState,
  type PlaybackModuleId,
} from "../playbackControl/playbackControlTypes";
import { useRuntimePlayer } from "../player/useRuntimePlayer";
import { useGlobalSleepTimer } from "../sleepTimer/useGlobalSleepTimer";
import { VideoListeningView } from "../videoListening/VideoListeningView";
import { AppModeSwitcher } from "./AppModeSwitcher";
import type { AppMode } from "./appModeTypes";
import { FloatingPlaybackControl } from "./FloatingPlaybackControl";
import "./AppWorkspace.css";

interface AppWorkspaceProps {
  player?: PlayerPort;
  ttsEngine?: TtsEnginePort;
}

interface ScrollIndicatorState {
  isVisible: boolean;
  thumbHeight: number;
  thumbOffset: number;
}

const hiddenScrollIndicator: ScrollIndicatorState = {
  isVisible: false,
  thumbHeight: 0,
  thumbOffset: 0,
};

function getScrollIndicatorState(shell: HTMLElement): ScrollIndicatorState {
  const scrollableHeight = shell.scrollHeight - shell.clientHeight;
  if (scrollableHeight <= 0) {
    return hiddenScrollIndicator;
  }

  const trackHeight = Math.max(shell.clientHeight - 16, 1);
  const thumbHeight = Math.max(
    48,
    Math.round((shell.clientHeight / shell.scrollHeight) * trackHeight),
  );
  const maxThumbOffset = Math.max(trackHeight - thumbHeight, 0);
  const thumbOffset = Math.round(
    (shell.scrollTop / scrollableHeight) * maxThumbOffset,
  );

  return {
    isVisible: true,
    thumbHeight,
    thumbOffset,
  };
}

function hasSamePlaybackControlState(
  currentState: PlaybackControlState,
  nextState: PlaybackControlState,
): boolean {
  return (
    currentState.actionLabel === nextState.actionLabel &&
    currentState.canToggle === nextState.canToggle &&
    currentState.status === nextState.status &&
    currentState.summary === nextState.summary
  );
}

export function AppWorkspace({ player, ttsEngine }: AppWorkspaceProps) {
  const shellRef = useRef<HTMLElement>(null);
  const scrollHideTimerRef = useRef<number | null>(null);
  const playbackCommandIdRef = useRef(0);
  const [scrollIndicator, setScrollIndicator] = useState<ScrollIndicatorState>(
    hiddenScrollIndicator,
  );
  const [activeAppMode, setActiveAppMode] = useState<AppMode>("mixer");
  const [hasOpenedAudiobook, setHasOpenedAudiobook] = useState(false);
  const [hasOpenedVideo, setHasOpenedVideo] = useState(false);
  const [playbackControlStates, setPlaybackControlStates] = useState(
    DEFAULT_PLAYBACK_CONTROL_STATES,
  );
  const [playbackControlRequestIds, setPlaybackControlRequestIds] = useState(
    INITIAL_PLAYBACK_CONTROL_REQUEST_IDS,
  );
  const activePlayer = useRuntimePlayer(player);
  const sleepTimer = useGlobalSleepTimer();
  const audiobookEngine = useMemo(
    () => ttsEngine ?? createTtsEngine(),
    [ttsEngine],
  );
  const handleAppModeChange = useCallback((mode: AppMode) => {
    const shell = shellRef.current;
    if (shell) {
      shell.scrollTop = 0;
    }
    if (scrollHideTimerRef.current !== null) {
      window.clearTimeout(scrollHideTimerRef.current);
      scrollHideTimerRef.current = null;
    }
    setScrollIndicator(hiddenScrollIndicator);
    setActiveAppMode(mode);
    if (mode === "audiobook") {
      setHasOpenedAudiobook(true);
    }
    if (mode === "video") {
      setHasOpenedVideo(true);
    }
  }, []);
  const updatePlaybackControlState = useCallback(
    (moduleId: PlaybackModuleId, nextState: PlaybackControlState) => {
      setPlaybackControlStates((currentStates) => {
        if (hasSamePlaybackControlState(currentStates[moduleId], nextState)) {
          return currentStates;
        }

        return {
          ...currentStates,
          [moduleId]: nextState,
        };
      });
    },
    [],
  );
  const handleMixerPlaybackControlStateChange = useCallback(
    (nextState: PlaybackControlState) => {
      updatePlaybackControlState("mixer", nextState);
    },
    [updatePlaybackControlState],
  );
  const handleAudiobookPlaybackControlStateChange = useCallback(
    (nextState: PlaybackControlState) => {
      updatePlaybackControlState("audiobook", nextState);
    },
    [updatePlaybackControlState],
  );
  const handleVideoPlaybackControlStateChange = useCallback(
    (nextState: PlaybackControlState) => {
      updatePlaybackControlState("video", nextState);
    },
    [updatePlaybackControlState],
  );
  const issuePlaybackControlRequests = useCallback(
    (moduleIds: PlaybackModuleId[]) => {
      if (moduleIds.length === 0) {
        return;
      }

      if (moduleIds.includes("audiobook")) {
        setHasOpenedAudiobook(true);
      }
      if (moduleIds.includes("video")) {
        setHasOpenedVideo(true);
      }

      setPlaybackControlRequestIds((currentRequestIds) => {
        const nextRequestIds = { ...currentRequestIds };
        for (const moduleId of moduleIds) {
          playbackCommandIdRef.current += 1;
          nextRequestIds[moduleId] = playbackCommandIdRef.current;
        }

        return nextRequestIds;
      });
    },
    [],
  );
  const requestModulePlaybackToggle = useCallback(
    (moduleId: PlaybackModuleId) => {
      if (
        moduleId === "video" &&
        playbackControlStates.video.status === "unavailable"
      ) {
        handleAppModeChange("video");
        return;
      }

      issuePlaybackControlRequests([moduleId]);
    },
    [
      handleAppModeChange,
      issuePlaybackControlRequests,
      playbackControlStates.video.status,
    ],
  );
  const requestGlobalPlaybackToggle = useCallback(() => {
    const hasActivePlayback = PLAYBACK_MODULE_IDS.some(
      (moduleId) => playbackControlStates[moduleId].status === "playing",
    );
    const targetModuleIds = PLAYBACK_MODULE_IDS.filter((moduleId) => {
      const control = playbackControlStates[moduleId];
      if (!control.canToggle) {
        return false;
      }
      if (moduleId === "video" && control.status === "unavailable") {
        return false;
      }
      if (hasActivePlayback) {
        return control.status === "playing";
      }

      return control.status === "idle" || control.status === "paused";
    });

    issuePlaybackControlRequests(targetModuleIds);
  }, [issuePlaybackControlRequests, playbackControlStates]);

  useEffect(() => {
    return () => {
      if (scrollHideTimerRef.current !== null) {
        window.clearTimeout(scrollHideTimerRef.current);
      }
    };
  }, []);

  const handleShellScroll = useCallback(() => {
    const shell = shellRef.current;
    if (!shell) {
      return;
    }

    setScrollIndicator(getScrollIndicatorState(shell));
    if (scrollHideTimerRef.current !== null) {
      window.clearTimeout(scrollHideTimerRef.current);
    }

    scrollHideTimerRef.current = window.setTimeout(() => {
      setScrollIndicator((current) => ({
        ...current,
        isVisible: false,
      }));
      scrollHideTimerRef.current = null;
    }, 900);
  }, []);

  const scrollIndicatorStyle = {
    "--scroll-thumb-height": `${scrollIndicator.thumbHeight}px`,
    "--scroll-thumb-offset": `${scrollIndicator.thumbOffset}px`,
  } as CSSProperties;

  return (
    <>
      <main className="app-shell" ref={shellRef} onScroll={handleShellScroll}>
        <section className="workspace-command-center" aria-label="工作台控制">
          <div className="workspace-brand">
            <span className="workspace-brand__mark" aria-hidden="true">
              S
            </span>
            <div className="workspace-brand__copy">
              <p className="app-kicker">Sleep Companion</p>
              <strong>
                {activeAppMode === "mixer"
                  ? "声音工作台"
                  : activeAppMode === "audiobook"
                    ? "听书工作台"
                    : "听视频工作台"}
              </strong>
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
