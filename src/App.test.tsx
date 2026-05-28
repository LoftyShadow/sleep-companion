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
      screen.getByRole("heading", { name: "Sleep Companion" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "一键混音" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "入睡" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "应用预设雨夜放松" }),
    ).toBeInTheDocument();
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
});
