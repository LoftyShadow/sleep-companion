import { useState } from "react";
import { InlinePicker } from "../shared/InlinePicker";
import "./SleepTimerControl.css";

export type SleepTimerStatus = "idle" | "running" | "completed";
type SleepTimerControlVariant = "default" | "compact";

interface SleepTimerControlProps {
  durationMinutes: number;
  remainingSeconds: number;
  status: SleepTimerStatus;
  variant?: SleepTimerControlVariant;
  onCancel: () => void;
  onDurationChange: (durationMinutes: number) => void;
  onStart: () => void;
}

const TIMER_PRESETS = [15, 30, 45, 60, 90, 120];
const MIN_TIMER_MINUTES = 1;
const MAX_TIMER_MINUTES = 999;
const TIMER_PRESET_OPTIONS = TIMER_PRESETS.map((presetMinutes) => ({
  id: String(presetMinutes),
  meta: "快速选择",
  title: `${presetMinutes} 分钟`,
}));

function formatRemainingTime(totalSeconds: number): string {
  const normalizedSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(normalizedSeconds / 60);
  const seconds = normalizedSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getTimerStatusText(
  status: SleepTimerStatus,
  remainingSeconds: number,
): string {
  if (status === "running") {
    return `剩余 ${formatRemainingTime(remainingSeconds)}`;
  }

  if (status === "completed") {
    return "已停止全部播放";
  }

  return "未开启";
}

export function SleepTimerControl({
  durationMinutes,
  remainingSeconds,
  status,
  variant = "default",
  onCancel,
  onDurationChange,
  onStart,
}: SleepTimerControlProps) {
  const normalizedDurationMinutes = Math.min(
    MAX_TIMER_MINUTES,
    Math.max(MIN_TIMER_MINUTES, Math.floor(durationMinutes)),
  );
  const selectedPresetOptionId = TIMER_PRESETS.includes(
    normalizedDurationMinutes,
  )
    ? String(normalizedDurationMinutes)
    : null;
  const [customDurationInput, setCustomDurationInput] = useState(
    String(normalizedDurationMinutes),
  );

  function handlePresetChange(optionId: string) {
    const presetMinutes = Number(optionId);
    if (!Number.isFinite(presetMinutes)) {
      return;
    }

    setCustomDurationInput(String(presetMinutes));
    onDurationChange(presetMinutes);
  }

function handleCustomDurationChange(value: string) {
    setCustomDurationInput(value);
    if (!value.trim()) {
      return;
    }

    const nextDuration = Number(value);
    if (!Number.isFinite(nextDuration)) {
      return;
    }

    onDurationChange(
      Math.min(
        MAX_TIMER_MINUTES,
        Math.max(MIN_TIMER_MINUTES, Math.floor(nextDuration)),
      ),
    );
  }

  function handleCustomRangeChange(value: string) {
    const nextDuration = Number(value);
    if (!Number.isFinite(nextDuration)) {
      return;
    }

    const normalizedNextDuration = Math.min(
      MAX_TIMER_MINUTES,
      Math.max(MIN_TIMER_MINUTES, Math.floor(nextDuration)),
    );
    setCustomDurationInput(String(normalizedNextDuration));
    onDurationChange(normalizedNextDuration);
  }

  function handleCustomDurationBlur() {
    if (!customDurationInput.trim()) {
      setCustomDurationInput(String(normalizedDurationMinutes));
    }
  }

  const rootClassName =
    variant === "compact"
      ? "sleep-timer-control sleep-timer-control--compact"
      : "sleep-timer-control";
  const timerStatusText = getTimerStatusText(status, remainingSeconds);

  return (
    <section className={rootClassName} aria-label="定时停止">
      <div className="sleep-timer-summary">
        <div className="sleep-timer-summary-copy">
          <p className="app-kicker">全局控制</p>
          <strong>定时停止</strong>
        </div>
        <span role="timer">{timerStatusText}</span>
      </div>

      <div className="sleep-timer-actions">
        {variant === "compact" ? (
          <>
            <div className="sleep-timer-preset-buttons" aria-label="定时时长预设">
              {TIMER_PRESETS.map((presetMinutes) => (
                <button
                  aria-pressed={normalizedDurationMinutes === presetMinutes}
                  className="sleep-timer-preset-button"
                  key={presetMinutes}
                  type="button"
                  onClick={() => {
                    handlePresetChange(String(presetMinutes));
                  }}
                >
                  {presetMinutes}
                  <span>分钟</span>
                </button>
              ))}
            </div>
            <label className="sleep-timer-range-label">
              <span>自定义 {normalizedDurationMinutes} 分钟</span>
              <input
                aria-label="自定义"
                className="sleep-timer-range-input"
                min={MIN_TIMER_MINUTES}
                max="180"
                step="1"
                type="range"
                value={Math.min(180, normalizedDurationMinutes)}
                onChange={(event) => {
                  handleCustomRangeChange(event.currentTarget.value);
                }}
              />
            </label>
          </>
        ) : (
          <>
            <div className="sleep-timer-picker" aria-label="定时时长预设">
              <span className="sleep-timer-field-label">时长</span>
              <InlinePicker
                ariaLabel={`选择定时时长，当前 ${normalizedDurationMinutes} 分钟`}
                listAriaLabel="定时时长列表"
                options={TIMER_PRESET_OPTIONS}
                selectedMeta="预设时长"
                selectedOptionId={selectedPresetOptionId}
                selectedTitle={`${normalizedDurationMinutes} 分钟`}
                onSelect={handlePresetChange}
              />
            </div>
            <label className="sleep-timer-custom-label">
              <span>自定义</span>
              <input
                aria-label="自定义"
                className="sleep-timer-custom-input"
                inputMode="numeric"
                min={MIN_TIMER_MINUTES}
                max={MAX_TIMER_MINUTES}
                type="number"
                value={customDurationInput}
                onBlur={handleCustomDurationBlur}
                onChange={(event) => {
                  handleCustomDurationChange(event.currentTarget.value);
                }}
              />
            </label>
          </>
        )}
        <button
          className="sleep-timer-button sleep-timer-start-button"
          type="button"
          onClick={onStart}
        >
          开始
        </button>
        <button
          className="sleep-timer-button sleep-timer-cancel-button"
          disabled={status !== "running"}
          type="button"
          onClick={onCancel}
        >
          取消
        </button>
      </div>
    </section>
  );
}
