import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { AudiobookView } from "../audiobook/AudiobookView";
import { createTtsEngine } from "../audiobook/createTtsEngine";
import type { TtsEnginePort } from "../audiobook/TtsEnginePort";
import { SoundMixerView } from "../mixer/SoundMixerView";
import type { PlayerPort } from "../player/PlayerPort";
import { useRuntimePlayer } from "../player/useRuntimePlayer";
import { useGlobalSleepTimer } from "../sleepTimer/useGlobalSleepTimer";
import { SleepTimerControl } from "../sleepTimer/SleepTimerControl";
import { VideoListeningView } from "../videoListening/VideoListeningView";
import { AppModeSwitcher } from "./AppModeSwitcher";
import type { AppMode } from "./appModeTypes";
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

export function AppWorkspace({ player, ttsEngine }: AppWorkspaceProps) {
  const shellRef = useRef<HTMLElement>(null);
  const scrollHideTimerRef = useRef<number | null>(null);
  const [scrollIndicator, setScrollIndicator] = useState<ScrollIndicatorState>(
    hiddenScrollIndicator,
  );
  const [activeAppMode, setActiveAppMode] = useState<AppMode>("mixer");
  const [hasOpenedAudiobook, setHasOpenedAudiobook] = useState(false);
  const [hasOpenedVideo, setHasOpenedVideo] = useState(false);
  const activePlayer = useRuntimePlayer(player);
  const sleepTimer = useGlobalSleepTimer();
  const audiobookEngine = useMemo(
    () => ttsEngine ?? createTtsEngine(),
    [ttsEngine],
  );
  const handleAppModeChange = useCallback((mode: AppMode) => {
    setActiveAppMode(mode);
    if (mode === "audiobook") {
      setHasOpenedAudiobook(true);
    }
    if (mode === "video") {
      setHasOpenedVideo(true);
    }
  }, []);

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
        <AppModeSwitcher
          activeMode={activeAppMode}
          onModeChange={handleAppModeChange}
        />
        <SleepTimerControl
          durationMinutes={sleepTimer.durationMinutes}
          remainingSeconds={sleepTimer.remainingSeconds}
          status={sleepTimer.status}
          onCancel={sleepTimer.cancel}
          onDurationChange={sleepTimer.setDurationMinutes}
          onStart={sleepTimer.start}
        />

        <section
          className="app-mode-panel"
          hidden={activeAppMode !== "mixer"}
          aria-label="声音"
        >
          {activePlayer ? (
            <SoundMixerView
              globalStopRequestId={sleepTimer.globalStopRequestId}
              player={activePlayer}
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
    </>
  );
}
