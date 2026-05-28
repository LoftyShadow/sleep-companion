import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "./App";
import type { PlayerPort } from "./features/player/PlayerPort";

function createPlayer() {
  const play = vi.fn<PlayerPort["play"]>(() => Promise.resolve());
  const pause = vi.fn<PlayerPort["pause"]>(() => Promise.resolve());
  const setVolume = vi.fn<PlayerPort["setVolume"]>(() => Promise.resolve());
  const stopAll = vi.fn<PlayerPort["stopAll"]>(() => Promise.resolve());
  const getState = vi.fn<PlayerPort["getState"]>(() =>
    Promise.resolve({ sounds: [] }),
  );
  const destroy = vi.fn<PlayerPort["destroy"]>();
  const player: PlayerPort = {
    play,
    pause,
    setVolume,
    stopAll,
    getState,
    destroy,
  };

  return { destroy, getState, pause, play, player, setVolume, stopAll };
}

describe("App", () => {
  it("renders the built-in sound grid", () => {
    render(<App player={createPlayer().player} />);

    expect(
      screen.getByRole("heading", { name: "白噪音" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "一键混音" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "入睡" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "应用预设雨夜放松" }),
    ).toBeInTheDocument();
    expect(screen.getByText("添加自定义音频")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "大雨" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "图书馆" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "伞下雨声" })).toBeInTheDocument();
  });

  it("uses the unified button to play and stop the default preset", async () => {
    const user = userEvent.setup();
    const { play, player, stopAll } = createPlayer();
    render(<App player={player} />);

    await user.click(screen.getByRole("button", { name: "播放预设" }));
    await user.click(await screen.findByRole("button", { name: "停止播放" }));

    expect(play).toHaveBeenCalledTimes(3);
    expect(stopAll).toHaveBeenCalledTimes(1);
  });

  it("applies grouped presets through the player port", async () => {
    const user = userEvent.setup();
    const { play, player, stopAll } = createPlayer();
    render(<App player={player} />);

    await user.click(screen.getByRole("button", { name: "应用预设图书馆专注" }));

    expect(stopAll).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(3);
    expect(play.mock.calls.map(([sound]) => sound.id)).toEqual([
      "library",
      "keyboard",
      "clock",
    ]);
  });

  it("switches to the ASMR console and shows real ASMR sounds", async () => {
    const user = userEvent.setup();
    render(<App player={createPlayer().player} />);

    await user.click(screen.getByRole("button", { name: "ASMR" }));

    expect(
      screen.getByRole("heading", { name: "ASMR 控制台" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "ASMR 预设" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "应用预设近耳清理" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "轻柔掏耳" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "气泡声" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "车顶雨点" }),
    ).toBeInTheDocument();
  });

  it("uses the unified button to play the default ASMR preset in ASMR mode", async () => {
    const user = userEvent.setup();
    const { play, player, stopAll } = createPlayer();
    render(<App player={player} />);

    await user.click(screen.getByRole("button", { name: "ASMR" }));
    await user.click(screen.getByRole("button", { name: "播放 ASMR" }));
    await user.click(await screen.findByRole("button", { name: "停止播放" }));

    expect(play.mock.calls.map(([sound]) => sound.id)).toEqual([
      "asmr_ear_cleaning_soft",
      "asmr_ear_cleaning_deep",
      "asmr_paper_rub",
    ]);
    expect(stopAll).toHaveBeenCalledTimes(2);
  });
});
