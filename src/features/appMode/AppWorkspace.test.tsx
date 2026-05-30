import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createPlayerPortTestDouble,
  createTtsEngineTestDouble,
} from "../../test/audioTestDoubles";
import { AppWorkspace } from "./AppWorkspace";

describe("AppWorkspace", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps ambient sounds and audiobook playback independent across mode switches", async () => {
    const user = userEvent.setup();
    const { play, player, stopAll } = createPlayerPortTestDouble();
    const { cancel, engine, speak } = createTtsEngineTestDouble();
    render(<AppWorkspace player={player} ttsEngine={engine} />);

    await user.click(screen.getByRole("button", { name: "大雨" }));
    await user.click(screen.getByRole("button", { name: "听书" }));

    expect(stopAll).not.toHaveBeenCalled();
    expect(await screen.findByText("系统女声 · zh-CN")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "播放" }));

    expect(play).toHaveBeenCalledWith(
      expect.objectContaining({ id: "heavy_rain" }),
      0.62,
    );
    expect(speak).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "雨声落在窗外，房间里只剩下很轻的呼吸声。",
        voiceId: "voice:default",
      }),
    );
    expect(stopAll).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "声音" }));

    expect(cancel).not.toHaveBeenCalled();
    expect(
      within(screen.getByRole("button", { name: "大雨" })).getByText("播放中"),
    ).toBeInTheDocument();
  });

  it("keeps ambient sounds playing when opening video listening", async () => {
    const user = userEvent.setup();
    const { play, player, stopAll } = createPlayerPortTestDouble();
    render(<AppWorkspace player={player} />);

    await user.click(screen.getByRole("button", { name: "大雨" }));
    await user.click(screen.getByRole("button", { name: "听视频" }));

    expect(screen.getByRole("heading", { name: "听视频" })).toBeInTheDocument();
    expect(play).toHaveBeenCalledWith(
      expect.objectContaining({ id: "heavy_rain" }),
      0.62,
    );
    expect(stopAll).not.toHaveBeenCalled();
  });

  it("stops sounds, audiobook, and video when the sleep timer ends", async () => {
    const user = userEvent.setup();
    const { play, player, stopAll } = createPlayerPortTestDouble();
    const { cancel, engine, speak } = createTtsEngineTestDouble();
    render(<AppWorkspace player={player} ttsEngine={engine} />);

    await user.click(screen.getByRole("button", { name: "大雨" }));
    await user.click(screen.getByRole("button", { name: "听书" }));
    await user.click(screen.getByRole("button", { name: "播放" }));
    await user.click(screen.getByRole("button", { name: "听视频" }));
    await user.type(screen.getByLabelText("视频或直播链接"), "BV1xx411c7mD");
    await user.click(screen.getByRole("button", { name: "载入" }));

    expect(play).toHaveBeenCalledWith(
      expect.objectContaining({ id: "heavy_rain" }),
      0.62,
    );
    expect(speak).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "雨声落在窗外，房间里只剩下很轻的呼吸声。",
      }),
    );
    expect(
      screen.getByTitle("B 站视频播放器 BV BV1xx411c7mD"),
    ).toBeInTheDocument();

    vi.useFakeTimers();
    fireEvent.change(screen.getByLabelText("自定义"), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "开始" }));

    expect(screen.getByRole("timer")).toHaveTextContent("剩余 05:00");

    act(() => {
      vi.advanceTimersByTime(300_000);
    });

    expect(screen.getByRole("timer")).toHaveTextContent("已停止全部播放");
    expect(stopAll).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByTitle("B 站视频播放器 BV BV1xx411c7mD"),
    ).not.toBeInTheDocument();
  });

  it("supports custom timer input and preset picker", async () => {
    const user = userEvent.setup();
    render(<AppWorkspace player={createPlayerPortTestDouble().player} />);

    expect(
      screen.getByRole("button", { name: "选择定时时长，当前 30 分钟" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "选择定时时长，当前 30 分钟" }),
    );

    const timerPresetList = screen.getByRole("listbox", {
      name: "定时时长列表",
    });
    expect(timerPresetList).toBeInTheDocument();
    await user.click(within(timerPresetList).getAllByRole("option")[2]);
    expect(screen.getByLabelText("自定义")).toHaveValue(15);

    await user.clear(screen.getByLabelText("自定义"));
    await user.type(screen.getByLabelText("自定义"), "7");
    expect(
      screen.getByRole("button", { name: "选择定时时长，当前 7 分钟" }),
    ).toBeInTheDocument();
  });

  it("shows the scroll indicator only while the workspace is scrolling", () => {
    vi.useFakeTimers();
    const { container } = render(
      <AppWorkspace player={createPlayerPortTestDouble().player} />,
    );
    const shell = container.querySelector(".app-shell") as HTMLElement;
    Object.defineProperty(shell, "clientHeight", {
      configurable: true,
      value: 100,
    });
    Object.defineProperty(shell, "scrollHeight", {
      configurable: true,
      value: 300,
    });
    Object.defineProperty(shell, "scrollTop", {
      configurable: true,
      value: 80,
    });

    fireEvent.scroll(shell);

    const indicator = container.querySelector(".app-scroll-indicator");
    expect(indicator).toHaveClass("is-visible");

    act(() => {
      vi.advanceTimersByTime(900);
    });

    expect(indicator).not.toHaveClass("is-visible");
  });
});
