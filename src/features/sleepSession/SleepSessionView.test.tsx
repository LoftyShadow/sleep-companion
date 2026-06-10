import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PlaybackControlState } from "../playbackControl/playbackControlTypes";
import { createMemoryFileSystem } from "../../test/storageTestDoubles";
import type { SleepSessionViewProps } from "./SleepSessionView";
import { SleepSessionView } from "./SleepSessionView";

const UNAVAILABLE_MODULE_STATE: PlaybackControlState = {
  actionLabel: "打开",
  canToggle: false,
  status: "unavailable",
  summary: "未准备",
};

function createSleepSessionViewProps(
  overrides: Partial<SleepSessionViewProps> = {},
): SleepSessionViewProps {
  return {
    currentConfigItems: [],
    durationMinutes: 30,
    fileSystem: createMemoryFileSystem(),
    moduleStates: {
      audiobook: UNAVAILABLE_MODULE_STATE,
      video: UNAVAILABLE_MODULE_STATE,
    },
    remainingSeconds: 0,
    status: "idle",
    onCancelTimer: vi.fn(),
    onCanUseModule: vi.fn().mockReturnValue(false),
    onDurationChange: vi.fn(),
    onOpenSoundConfig: vi.fn(),
    onPrepareModule: vi.fn(),
    onStartModules: vi.fn(),
    onStartTimer: vi.fn(),
    onUseConfig: vi.fn(),
    ...overrides,
  };
}

describe("SleepSessionView", () => {
  it("keeps the primary path disabled without sounds and exposes settings", () => {
    const onOpenSoundConfig = vi.fn();
    render(
      <SleepSessionView {...createSleepSessionViewProps({ onOpenSoundConfig })} />,
    );

    expect(
      screen.getByRole("heading", { name: "今晚的会话" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "开始睡眠" })).toBeDisabled();
    expect(
      screen.getByRole("heading", { name: "声音、模块和定时" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "当前声音配置" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "会话模块" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "定时停止" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "最近配置" })).toBeInTheDocument();

    const audiobookToggle = screen.getByRole("checkbox", { name: "听书" });
    expect(audiobookToggle).toHaveAttribute(
      "id",
      "sleep-session-module-audiobook",
    );
    expect(audiobookToggle).toHaveAttribute(
      "name",
      "sleepSessionModule:audiobook",
    );
    expect(screen.getByRole("spinbutton", { name: "自定义" })).toHaveAttribute(
      "name",
      "sleepTimerCustomDuration",
    );

    fireEvent.click(screen.getByRole("button", { name: "去声音页配置" }));

    expect(onOpenSoundConfig).toHaveBeenCalledTimes(1);
  });

  it("starts the sleep session from the current sound config", async () => {
    const onStartModules = vi.fn();
    const onStartTimer = vi.fn();
    const onUseConfig = vi.fn();
    render(
      <SleepSessionView
        {...createSleepSessionViewProps({
          currentConfigItems: [
            { name: "大雨", soundId: "heavy_rain", volume: 0.62 },
          ],
          onCanUseModule: vi.fn().mockReturnValue(true),
          onStartModules,
          onStartTimer,
          onUseConfig,
        })}
      />,
    );

    const startButton = screen.getByRole("button", { name: "开始睡眠" });
    expect(startButton).toBeEnabled();

    fireEvent.click(startButton);

    await waitFor(() => {
      expect(onStartTimer).toHaveBeenCalledWith(30);
    });
    expect(onStartModules).toHaveBeenCalledWith({
      audiobook: false,
      video: false,
    });
    expect(onUseConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        durationMinutes: 30,
        items: [{ name: "大雨", soundId: "heavy_rain", volume: 0.62 }],
      }),
    );
  });
});
