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

const TIMER_PRESETS = [5, 10, 15, 30, 45, 60, 90];
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

  function handleCustomDurationBlur() {
    if (!customDurationInput.trim()) {
      setCustomDurationInput(String(normalizedDurationMinutes));
    }
  }

  const rootClassName =
    variant === "compact"
      ? "sleep-timer-control sleep-timer-control--compact"
      : "sleep-timer-control";

  return (
    <section className={rootClassName} aria-label="定时停止">
      <div className="sleep-timer-summary">
        <p className="app-kicker">全局控制</p>
        <strong>定时停止</strong>
        <span role="timer">{getTimerStatusText(status, remainingSeconds)}</span>
      </div>

      <div className="sleep-timer-actions">
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
