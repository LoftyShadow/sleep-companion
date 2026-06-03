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
import { PlaybackGlyph } from "../shared/PlaybackGlyph";
import "./FloatingPlaybackControl.css";
import "./FloatingPlaybackControl.mobile.css";

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
  loaded: "已载入",
  loading: "准备中",
  paused: "已暂停",
  playing: "播放中",
  unavailable: "未就绪",
};

const MODULES_ICON = (
  <svg
    className="floating-playback-tool__icon"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path d="M6 7h12" />
    <path d="M6 12h12" />
    <path d="M6 17h12" />
  </svg>
);

const TIMER_ICON = (
  <svg
    className="floating-playback-tool__icon"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="7" />
    <path d="M12 8v4l3 2" />
  </svg>
);

const COLLAPSE_ICON = (
  <svg
    className="floating-playback-tool__icon"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path d="m7 9 5 5 5-5" />
  </svg>
);

const RESTORE_ICON = (
  <svg
    className="floating-playback-restore__icon"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle cx="12" cy="5.5" r="1.7" />
    <circle cx="12" cy="12" r="1.7" />
    <circle cx="12" cy="18.5" r="1.7" />
  </svg>
);

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

function shouldStartCollapsedOnMobile(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }

  return window.matchMedia("(max-width: 680px)").matches;
}

export function FloatingPlaybackControl({
  controls,
  timer,
  onGlobalToggle,
  onModuleToggle,
}: FloatingPlaybackControlProps) {
  const rootRef = useRef<HTMLElement>(null);
  const [isDockCollapsed, setIsDockCollapsed] = useState(
    shouldStartCollapsedOnMobile,
  );
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

  function handleCollapseDock() {
    setOpenPanel(null);
    setIsDockCollapsed(true);
  }

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
      className={
        isDockCollapsed
          ? "floating-playback-control is-collapsed"
          : "floating-playback-control"
      }
      ref={rootRef}
      aria-label="悬浮播放控制"
    >
      {isDockCollapsed ? (
        <div className="floating-playback-mini-dock">
          <button
            aria-label={globalActionLabel}
            aria-pressed={hasActivePlayback}
            className={
              hasActivePlayback
                ? "floating-playback-global floating-playback-mini-action is-playing"
                : "floating-playback-global floating-playback-mini-action"
            }
            type="button"
            onClick={onGlobalToggle}
          >
            <PlaybackGlyph
              isPlaying={hasActivePlayback}
              className="floating-playback-global__glyph"
            />
          </button>

          <button
            aria-label="展开悬浮播放控制"
            className="floating-playback-restore"
            type="button"
            onClick={() => {
              setIsDockCollapsed(false);
            }}
          >
            {RESTORE_ICON}
          </button>
        </div>
      ) : null}

      {!isDockCollapsed && openPanel ? (
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
                        <PlaybackGlyph
                          isPlaying={control.status === "playing"}
                          className="floating-playback-action__glyph"
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

      {!isDockCollapsed ? (
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
            <PlaybackGlyph
              isPlaying={hasActivePlayback}
              className="floating-playback-global__glyph"
            />
            <span>{globalActionLabel}</span>
            <strong>{playingCount}</strong>
          </button>

          <div
            className="floating-playback-tool-group"
            role="group"
            aria-label="播放工具"
          >
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
              {MODULES_ICON}
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
              {TIMER_ICON}
            </button>

            <button
              aria-label="收回悬浮播放控制"
              className="floating-playback-tool"
              type="button"
              onClick={handleCollapseDock}
            >
              {COLLAPSE_ICON}
            </button>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
