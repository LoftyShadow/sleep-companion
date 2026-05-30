import { useCallback, useEffect, useMemo, useState } from "react";
import { AudiobookView } from "../audiobook/AudiobookView";
import { createTtsEngine } from "../audiobook/createTtsEngine";
import type { TtsEnginePort } from "../audiobook/TtsEnginePort";
import { SoundMixerView } from "../mixer/SoundMixerView";
import { createPlayer } from "../player/createPlayer";
import type { PlayerPort } from "../player/PlayerPort";
import { SleepTimerControl, type SleepTimerStatus } from "../sleepTimer/SleepTimerControl";
import { VideoListeningView } from "../videoListening/VideoListeningView";
import { AppModeSwitcher } from "./AppModeSwitcher";
import type { AppMode } from "./appModeTypes";
import "./AppWorkspace.css";

interface AppWorkspaceProps {
  player?: PlayerPort;
  ttsEngine?: TtsEnginePort;
}

export function AppWorkspace({ player, ttsEngine }: AppWorkspaceProps) {
  const [activeAppMode, setActiveAppMode] = useState<AppMode>("mixer");
  const [hasOpenedAudiobook, setHasOpenedAudiobook] = useState(false);
  const [hasOpenedVideo, setHasOpenedVideo] = useState(false);
  const [sleepTimerDurationMinutes, setSleepTimerDurationMinutes] = useState(30);
  const [sleepTimerRemainingSeconds, setSleepTimerRemainingSeconds] = useState(0);
  const [sleepTimerStatus, setSleepTimerStatus] =
    useState<SleepTimerStatus>("idle");
  const [globalStopRequestId, setGlobalStopRequestId] = useState(0);
  const [runtimePlayer, setRuntimePlayer] = useState<PlayerPort | null>(null);
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

  const handleSleepTimerStart = useCallback(() => {
    setSleepTimerRemainingSeconds(sleepTimerDurationMinutes * 60);
    setSleepTimerStatus("running");
  }, [sleepTimerDurationMinutes]);

  const handleSleepTimerCancel = useCallback(() => {
    setSleepTimerRemainingSeconds(0);
    setSleepTimerStatus("idle");
  }, []);

  useEffect(() => {
    if (player) {
      return undefined;
    }

    let isMounted = true;
    let createdPlayer: PlayerPort | null = null;

    void createPlayer().then((nextPlayer) => {
      if (!isMounted) {
        nextPlayer.destroy();
        return;
      }
      createdPlayer = nextPlayer;
      setRuntimePlayer(nextPlayer);
    });

    return () => {
      isMounted = false;
      createdPlayer?.destroy();
    };
  }, [player]);

  useEffect(() => {
    if (sleepTimerStatus !== "running") {
      return undefined;
    }

    const timerId = window.setInterval(() => {
      setSleepTimerRemainingSeconds((currentSeconds) => {
        if (currentSeconds <= 1) {
          window.clearInterval(timerId);
          setSleepTimerStatus("completed");
          setGlobalStopRequestId((currentId) => currentId + 1);
          return 0;
        }

        return currentSeconds - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [sleepTimerStatus]);

  const activePlayer = player ?? runtimePlayer;

  return (
    <main className="app-shell">
      <AppModeSwitcher
        activeMode={activeAppMode}
        onModeChange={handleAppModeChange}
      />
      <SleepTimerControl
        durationMinutes={sleepTimerDurationMinutes}
        remainingSeconds={sleepTimerRemainingSeconds}
        status={sleepTimerStatus}
        onCancel={handleSleepTimerCancel}
        onDurationChange={setSleepTimerDurationMinutes}
        onStart={handleSleepTimerStart}
      />

      <section
        className="app-mode-panel"
        hidden={activeAppMode !== "mixer"}
        aria-label="声音"
      >
        {activePlayer ? (
          <SoundMixerView
            globalStopRequestId={globalStopRequestId}
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
            globalStopRequestId={globalStopRequestId}
          />
        ) : null}
      </section>

      <section
        className="app-mode-panel"
        hidden={activeAppMode !== "video"}
        aria-label="听视频"
      >
        {hasOpenedVideo ? (
          <VideoListeningView globalStopRequestId={globalStopRequestId} />
        ) : null}
      </section>
    </main>
  );
}
