import { useCallback, useEffect, useState } from "react";
import type { SleepTimerStatus } from "./SleepTimerControl";

interface GlobalSleepTimerState {
  durationMinutes: number;
  globalStopRequestId: number;
  remainingSeconds: number;
  setDurationMinutes: (durationMinutes: number) => void;
  start: () => void;
  cancel: () => void;
  status: SleepTimerStatus;
}

export function useGlobalSleepTimer(
  initialDurationMinutes = 30,
): GlobalSleepTimerState {
  const [durationMinutes, setDurationMinutes] = useState(
    initialDurationMinutes,
  );
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [status, setStatus] = useState<SleepTimerStatus>("idle");
  const [globalStopRequestId, setGlobalStopRequestId] = useState(0);

  const start = useCallback(() => {
    setRemainingSeconds(durationMinutes * 60);
    setStatus("running");
  }, [durationMinutes]);

  const cancel = useCallback(() => {
    setRemainingSeconds(0);
    setStatus("idle");
  }, []);

  useEffect(() => {
    if (status !== "running") {
      return undefined;
    }

    const timerId = window.setInterval(() => {
      setRemainingSeconds((currentSeconds) => {
        if (currentSeconds <= 1) {
          window.clearInterval(timerId);
          setStatus("completed");
          setGlobalStopRequestId((currentId) => currentId + 1);
          return 0;
        }

        return currentSeconds - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [status]);

  return {
    cancel,
    durationMinutes,
    globalStopRequestId,
    remainingSeconds,
    setDurationMinutes,
    start,
    status,
  };
}
