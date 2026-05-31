import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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

  it("uses the floating control to play and pause ambient sounds", async () => {
    const user = userEvent.setup();
    const { play, player, stopAll } = createPlayerPortTestDouble();
    render(<AppWorkspace player={player} />);

    await user.click(screen.getByRole("button", { name: "展开模块播放控制" }));
    await user.click(screen.getByRole("button", { name: "播放声音模块" }));

    await waitFor(() => {
      expect(play).toHaveBeenCalledTimes(3);
    });

    await user.click(
      await screen.findByRole("button", { name: "暂停声音模块" }),
    );

    expect(stopAll).toHaveBeenCalledTimes(1);
  });

  it("uses the floating control to start and pause audiobook playback", async () => {
    const user = userEvent.setup();
    const { engine, handlePause, speak } = createTtsEngineTestDouble();
    render(
      <AppWorkspace
        player={createPlayerPortTestDouble().player}
        ttsEngine={engine}
      />,
    );

    await user.click(screen.getByRole("button", { name: "展开模块播放控制" }));
    await user.click(screen.getByRole("button", { name: "播放听书模块" }));

    await waitFor(() => {
      expect(speak).toHaveBeenCalledWith(
        expect.objectContaining({
          text: "雨声落在窗外，房间里只剩下很轻的呼吸声。",
        }),
      );
    });

    await user.click(
      await screen.findByRole("button", { name: "暂停听书模块" }),
    );

    expect(handlePause).toHaveBeenCalledTimes(1);
  });

  it("uses the floating control to open and toggle video listening", async () => {
    const user = userEvent.setup();
    render(<AppWorkspace player={createPlayerPortTestDouble().player} />);

    await user.click(screen.getByRole("button", { name: "展开模块播放控制" }));
    await user.click(screen.getByRole("button", { name: "打开听视频模块" }));

    expect(screen.getByRole("heading", { name: "听视频" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("视频或直播链接"), "BV1xx411c7mD");
    await user.click(screen.getByRole("button", { name: "载入" }));

    expect(
      screen.getByTitle("B 站视频播放器 BV BV1xx411c7mD"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "展开模块播放控制" }));
    await user.click(
      await screen.findByRole("button", { name: "暂停听视频模块" }),
    );

    expect(
      screen.queryByTitle("B 站视频播放器 BV BV1xx411c7mD"),
    ).not.toBeInTheDocument();

    await user.click(
      await screen.findByRole("button", { name: "播放听视频模块" }),
    );

    expect(
      screen.getByTitle("B 站视频播放器 BV BV1xx411c7mD"),
    ).toBeInTheDocument();
  });

  it("uses the floating global button to pause active modules", async () => {
    const user = userEvent.setup();
    const { player, stopAll } = createPlayerPortTestDouble();
    const { engine, handlePause } = createTtsEngineTestDouble();
    render(<AppWorkspace player={player} ttsEngine={engine} />);

    await user.click(screen.getByRole("button", { name: "大雨" }));
    await user.click(screen.getByRole("button", { name: "听书" }));
    await user.click(screen.getByRole("button", { name: "播放" }));
    await user.click(screen.getByRole("button", { name: "暂停全部" }));

    expect(stopAll).toHaveBeenCalledTimes(1);
    expect(handlePause).toHaveBeenCalledTimes(1);
  });

  it("uses the floating global button to start idle modules except unloaded video", async () => {
    const user = userEvent.setup();
    const { play, player } = createPlayerPortTestDouble();
    const { engine, speak } = createTtsEngineTestDouble();
    render(<AppWorkspace player={player} ttsEngine={engine} />);

    await user.click(screen.getByRole("button", { name: "播放全部" }));

    await waitFor(() => {
      expect(play).toHaveBeenCalledTimes(3);
      expect(speak).toHaveBeenCalledWith(
        expect.objectContaining({
          text: "雨声落在窗外，房间里只剩下很轻的呼吸声。",
        }),
      );
    });
    expect(
      screen.queryByTitle("B 站视频播放器 BV BV1xx411c7mD"),
    ).not.toBeInTheDocument();
  });

  it("collapses the floating panel when clicking outside it", async () => {
    const user = userEvent.setup();
    render(<AppWorkspace player={createPlayerPortTestDouble().player} />);

    await user.click(screen.getByRole("button", { name: "展开模块播放控制" }));

    expect(
      screen.getByRole("region", { name: "模块播放控制" }),
    ).toBeInTheDocument();

    await user.click(screen.getByText("Sleep Companion"));

    expect(
      screen.queryByRole("region", { name: "模块播放控制" }),
    ).not.toBeInTheDocument();
  });

  it("collapses the floating timer panel when clicking outside it", async () => {
    const user = userEvent.setup();
    render(<AppWorkspace player={createPlayerPortTestDouble().player} />);

    await user.click(screen.getByRole("button", { name: "展开定时停止设置" }));

    expect(
      screen.getByRole("region", { name: "定时停止设置" }),
    ).toBeInTheDocument();

    await user.click(screen.getByText("Sleep Companion"));

    expect(
      screen.queryByRole("region", { name: "定时停止设置" }),
    ).not.toBeInTheDocument();
  });

  it("retracts and restores the floating playback dock", async () => {
    const user = userEvent.setup();
    const { play, player } = createPlayerPortTestDouble();
    render(<AppWorkspace player={player} />);

    await user.click(screen.getByRole("button", { name: "收回悬浮播放控制" }));

    expect(screen.queryByText("播放全部")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "播放全部" }));

    await waitFor(() => {
      expect(play).toHaveBeenCalledTimes(3);
    });
    expect(
      screen.queryByRole("button", { name: "展开模块播放控制" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "展开定时停止设置" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "展开悬浮播放控制" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "展开悬浮播放控制" }));

    expect(screen.getByRole("button", { name: "暂停全部" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "展开模块播放控制" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "展开定时停止设置" }),
    ).toBeInTheDocument();
  });

  it("switches between floating timer and module panels", async () => {
    const user = userEvent.setup();
    render(<AppWorkspace player={createPlayerPortTestDouble().player} />);

    await user.click(screen.getByRole("button", { name: "展开定时停止设置" }));

    expect(
      screen.getByRole("region", { name: "定时停止设置" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "展开模块播放控制" }));

    expect(
      screen.getByRole("region", { name: "模块播放控制" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "定时停止设置" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "展开定时停止设置" }));

    expect(
      screen.getByRole("region", { name: "定时停止设置" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "模块播放控制" }),
    ).not.toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: "展开定时停止设置" }));
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

    await user.click(screen.getByRole("button", { name: "展开定时停止设置" }));

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

  it("resets the workspace scroll position when switching modes", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <AppWorkspace player={createPlayerPortTestDouble().player} />,
    );
    const shell = container.querySelector(".app-shell") as HTMLElement;
    shell.scrollTop = 420;
    document.documentElement.scrollTop = 420;
    document.body.scrollTop = 420;

    await user.click(screen.getByRole("button", { name: "听书" }));

    expect(shell.scrollTop).toBe(0);
    expect(document.documentElement.scrollTop).toBe(0);
    expect(document.body.scrollTop).toBe(0);
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
