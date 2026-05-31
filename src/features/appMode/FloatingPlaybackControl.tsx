import { useEffect, useMemo, useRef, useState } from "react";
import { SleepTimerControl } from "../sleepTimer/SleepTimerControl";
import type { SleepTimerStatus } from "../sleepTimer/SleepTimerControl";
import {
  PLAYBACK_MODULE_IDS,
  PLAYBACK_MODULE_LABELS,
  type PlaybackControlState,
  type PlaybackControlStatus,
  type PlaybackModuleId,
} from "../playbackControl/playbackControlTypes";
import "./FloatingPlaybackControl.css";

type FloatingPanel = "modules" | "timer" | null;

interface FloatingPlaybackControlProps {
  controls: Record<PlaybackModuleId, PlaybackControlState>;
  timer: {
    durationMinutes: number;
    remainingSeconds: number;
    status: SleepTimerStatus;
    onCancel: () => void;
    onDurationChange: (durationMinutes: number) => void;
    onStart: () => void;
  };
  onGlobalToggle: () => void;
  onModuleToggle: (moduleId: PlaybackModuleId) => void;
}

const STATUS_LABELS: Record<PlaybackControlStatus, string> = {
  idle: "待机",
  loading: "准备中",
  paused: "已暂停",
  playing: "播放中",
  unavailable: "未就绪",
};

function getModuleClassName(status: PlaybackControlStatus): string {
  return `floating-playback-module is-${status}`;
}

function getActionClassName(status: PlaybackControlStatus): string {
  return status === "playing"
    ? "floating-playback-action is-playing"
    : "floating-playback-action";
}

function getPanelClassName(openPanel: FloatingPanel): string {
  return openPanel === "timer"
    ? "floating-playback-panel is-timer"
    : "floating-playback-panel is-modules";
}

export function FloatingPlaybackControl({
  controls,
  timer,
  onGlobalToggle,
  onModuleToggle,
}: FloatingPlaybackControlProps) {
  const rootRef = useRef<HTMLElement>(null);
  const [openPanel, setOpenPanel] = useState<FloatingPanel>(null);
  const playingCount = useMemo(
    () =>
      PLAYBACK_MODULE_IDS.filter(
        (moduleId) => controls[moduleId].status === "playing",
      ).length,
    [controls],
  );
  const hasActivePlayback = playingCount > 0;
  const globalActionLabel = hasActivePlayback ? "暂停全部" : "播放全部";

  useEffect(() => {
    if (!openPanel) {
      return undefined;
    }

    function handleDocumentPointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        rootRef.current?.contains(event.target)
      ) {
        return;
      }

      setOpenPanel(null);
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown);
    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
    };
  }, [openPanel]);

  return (
    <aside
      className="floating-playback-control"
      ref={rootRef}
      aria-label="悬浮播放控制"
    >
      {openPanel ? (
        <section
          className={getPanelClassName(openPanel)}
          aria-label={openPanel === "timer" ? "定时停止设置" : "模块播放控制"}
        >
          {openPanel === "modules" ? (
            <>
              <div className="floating-playback-panel__header">
                <p className="app-kicker">模块列表</p>
                <span className="floating-playback-count">
                  {playingCount} / {PLAYBACK_MODULE_IDS.length}
                </span>
              </div>

              <div className="floating-playback-modules">
                {PLAYBACK_MODULE_IDS.map((moduleId) => {
                  const control = controls[moduleId];
                  const moduleLabel = PLAYBACK_MODULE_LABELS[moduleId];

                  return (
                    <div
                      className={getModuleClassName(control.status)}
                      key={moduleId}
                    >
                      <div className="floating-playback-module__copy">
                        <span>{moduleLabel}</span>
                        <strong>{STATUS_LABELS[control.status]}</strong>
                        <p>{control.summary}</p>
                      </div>
                      <button
                        aria-label={`${control.actionLabel}${moduleLabel}模块`}
                        aria-pressed={control.status === "playing"}
                        className={getActionClassName(control.status)}
                        disabled={!control.canToggle}
                        type="button"
                        onClick={() => {
                          onModuleToggle(moduleId);
                        }}
                      >
                        <span
                          className="floating-playback-action__glyph"
                          aria-hidden="true"
                        />
                        <span>{control.actionLabel}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <SleepTimerControl
              durationMinutes={timer.durationMinutes}
              remainingSeconds={timer.remainingSeconds}
              status={timer.status}
              variant="compact"
              onCancel={timer.onCancel}
              onDurationChange={timer.onDurationChange}
              onStart={timer.onStart}
            />
          )}
        </section>
      ) : null}

      <div className="floating-playback-dock">
        <button
          aria-label={globalActionLabel}
          aria-pressed={hasActivePlayback}
          className={
            hasActivePlayback
              ? "floating-playback-global is-playing"
              : "floating-playback-global"
          }
          type="button"
          onClick={onGlobalToggle}
        >
          <span className="floating-playback-global__glyph" aria-hidden="true" />
          <span>{globalActionLabel}</span>
          <strong>{playingCount}</strong>
        </button>

        <button
          aria-expanded={openPanel === "modules"}
          aria-label="展开模块播放控制"
          className={
            openPanel === "modules"
              ? "floating-playback-tool is-active"
              : "floating-playback-tool"
          }
          type="button"
          onClick={() => {
            setOpenPanel((currentPanel) =>
              currentPanel === "modules" ? null : "modules",
            );
          }}
        >
          <span className="floating-playback-tool__list" aria-hidden="true" />
          <span>列表</span>
        </button>

        <button
          aria-expanded={openPanel === "timer"}
          aria-label="展开定时停止设置"
          className={
            openPanel === "timer"
              ? "floating-playback-tool is-active"
              : "floating-playback-tool"
          }
          type="button"
          onClick={() => {
            setOpenPanel((currentPanel) =>
              currentPanel === "timer" ? null : "timer",
            );
          }}
        >
          <span className="floating-playback-tool__timer" aria-hidden="true" />
          <span>定时</span>
        </button>
      </div>
    </aside>
  );
}
