import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import { AppModeSwitcher } from "./features/appMode/AppModeSwitcher";
import type { AppMode } from "./features/appMode/appModeTypes";
import { AudiobookView } from "./features/audiobook/AudiobookView";
import { createTtsEngine } from "./features/audiobook/createTtsEngine";
import type { TtsEnginePort } from "./features/audiobook/TtsEnginePort";
import { SoundMixerView } from "./features/mixer/SoundMixerView";
import { createPlayer } from "./features/player/createPlayer";
import type { PlayerPort } from "./features/player/PlayerPort";

interface AppProps {
  player?: PlayerPort;
  ttsEngine?: TtsEnginePort;
}

function App({ player, ttsEngine }: AppProps) {
  const [activeAppMode, setActiveAppMode] = useState<AppMode>("mixer");
  const [runtimePlayer, setRuntimePlayer] = useState<PlayerPort | null>(null);
  const audiobookEngine = useMemo(
    () => ttsEngine ?? createTtsEngine(),
    [ttsEngine],
  );
  const handleAppModeChange = useCallback((mode: AppMode) => {
    setActiveAppMode(mode);
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

  const activePlayer = player ?? runtimePlayer;

  useEffect(() => {
    if (activeAppMode === "audiobook") {
      void activePlayer?.stopAll();
    }
  }, [activeAppMode, activePlayer]);

  if (activeAppMode === "audiobook") {
    return (
      <AudiobookView
        activeMode={activeAppMode}
        engine={audiobookEngine}
        onModeChange={handleAppModeChange}
      />
    );
  }

  if (!activePlayer) {
    return (
      <main className="app-shell app-loading">
        <AppModeSwitcher
          activeMode={activeAppMode}
          onModeChange={handleAppModeChange}
        />
        <p className="app-kicker">睡眠声音</p>
        <h1>白噪音</h1>
        <p role="status">正在准备播放器</p>
      </main>
    );
  }

  return (
    <SoundMixerView
      activeAppMode={activeAppMode}
      player={activePlayer}
      onModeChange={handleAppModeChange}
    />
  );
}

export default App;
