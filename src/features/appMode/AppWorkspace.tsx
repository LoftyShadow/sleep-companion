import { useCallback, useMemo, useState } from "react";
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

export function AppWorkspace({ player, ttsEngine }: AppWorkspaceProps) {
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

  return (
    <main className="app-shell">
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
  );
}
