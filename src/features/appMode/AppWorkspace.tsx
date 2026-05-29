import { useCallback, useEffect, useMemo, useState } from "react";
import { AudiobookView } from "../audiobook/AudiobookView";
import { createTtsEngine } from "../audiobook/createTtsEngine";
import type { TtsEnginePort } from "../audiobook/TtsEnginePort";
import { SoundMixerView } from "../mixer/SoundMixerView";
import { createPlayer } from "../player/createPlayer";
import type { PlayerPort } from "../player/PlayerPort";
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

  return (
    <main className="app-shell">
      <AppModeSwitcher
        activeMode={activeAppMode}
        onModeChange={handleAppModeChange}
      />

      <section
        className="app-mode-panel"
        hidden={activeAppMode !== "mixer"}
        aria-label="声音"
      >
        {activePlayer ? (
          <SoundMixerView player={activePlayer} />
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
        {hasOpenedAudiobook ? <AudiobookView engine={audiobookEngine} /> : null}
      </section>
    </main>
  );
}
