import { useCallback, useRef, useState } from "react";
import {
  DEFAULT_PLAYBACK_CONTROL_STATES,
  INITIAL_PLAYBACK_CONTROL_REQUEST_IDS,
  PLAYBACK_MODULE_IDS,
  type PlaybackControlState,
  type PlaybackModuleId,
} from "../playbackControl/playbackControlTypes";
import type { AppMode } from "./appModeTypes";

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

export function usePlaybackControlBus(openAppMode: (mode: AppMode) => void) {
  const playbackCommandIdRef = useRef(0);
  const [hasOpenedAudiobook, setHasOpenedAudiobook] = useState(false);
  const [hasOpenedVideo, setHasOpenedVideo] = useState(false);
  const [playbackControlStates, setPlaybackControlStates] = useState(
    DEFAULT_PLAYBACK_CONTROL_STATES,
  );
  const [playbackControlRequestIds, setPlaybackControlRequestIds] = useState(
    INITIAL_PLAYBACK_CONTROL_REQUEST_IDS,
  );

  const markModeOpened = useCallback((mode: AppMode) => {
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
        moduleId === "audiobook" &&
        playbackControlStates.audiobook.status === "unavailable"
      ) {
        setHasOpenedAudiobook(true);
        openAppMode("audiobook");
        return;
      }

      if (moduleId === "video") {
        if (playbackControlStates.video.status === "unavailable") {
          setHasOpenedVideo(true);
          openAppMode("video");
          return;
        }

        if (playbackControlStates.video.status === "loaded") {
          setHasOpenedVideo(true);
          openAppMode("video");
          issuePlaybackControlRequests([moduleId]);
          return;
        }
      }

      issuePlaybackControlRequests([moduleId]);
    },
    [
      issuePlaybackControlRequests,
      openAppMode,
      playbackControlStates.audiobook.status,
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

  return {
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
  };
}
