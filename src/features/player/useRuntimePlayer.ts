import { useEffect, useState } from "react";
import { createPlayer } from "./createPlayer";
import type { PlayerPort } from "./PlayerPort";

export function useRuntimePlayer(providedPlayer?: PlayerPort): PlayerPort | null {
  const [runtimePlayer, setRuntimePlayer] = useState<PlayerPort | null>(null);

  useEffect(() => {
    if (providedPlayer) {
      setRuntimePlayer(null);
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
  }, [providedPlayer]);

  return providedPlayer ?? runtimePlayer;
}
