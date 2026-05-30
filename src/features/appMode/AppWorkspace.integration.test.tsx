import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  createPlayerPortTestDouble,
  createTtsEngineTestDouble,
} from "../../test/audioTestDoubles";
import { createMinimalEpubFile } from "../../test/epubTestDoubles";
import { AppWorkspace } from "./AppWorkspace";

describe("AppWorkspace integration", () => {
  it("renders the built-in sound grid", () => {
    render(<AppWorkspace player={createPlayerPortTestDouble().player} />);

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
    const { play, player, stopAll } = createPlayerPortTestDouble();
    render(<AppWorkspace player={player} />);

    await user.click(screen.getByRole("button", { name: "播放预设" }));
    await user.click(await screen.findByRole("button", { name: "停止播放" }));

    expect(play).toHaveBeenCalledTimes(3);
    expect(stopAll).toHaveBeenCalledTimes(1);
  });

  it("applies grouped presets through the player port", async () => {
    const user = userEvent.setup();
    const { play, player, stopAll } = createPlayerPortTestDouble();
    render(<AppWorkspace player={player} />);

    await user.click(screen.getByRole("button", { name: "应用预设图书馆专注" }));

    expect(stopAll).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(3);
    expect(play.mock.calls.map(([sound]) => sound.id)).toEqual([
      "library",
      "keyboard",
      "clock",
    ]);
  });

  it("keeps a white-noise sound volume when starting an ASMR sound", async () => {
    const user = userEvent.setup();
    const { play, player, setVolume } = createPlayerPortTestDouble();
    render(<AppWorkspace player={player} />);

    fireEvent.change(screen.getByLabelText("大雨音量"), {
      target: { value: "73" },
    });
    await user.click(screen.getByRole("button", { name: "大雨" }));
    await user.click(screen.getByRole("button", { name: "ASMR" }));
    await user.click(screen.getByRole("button", { name: "轻柔掏耳" }));
    await user.click(screen.getByRole("button", { name: "白噪音" }));

    expect(setVolume).toHaveBeenCalledTimes(1);
    expect(setVolume).toHaveBeenCalledWith("heavy_rain", 0.73);
    expect(play.mock.calls.map(([sound, volume]) => [sound.id, volume])).toEqual([
      ["heavy_rain", 0.73],
      ["asmr_ear_cleaning_soft", 0.5],
    ]);
    expect(screen.getByLabelText("大雨音量")).toHaveValue("73");
  });

  it("switches to the ASMR console and shows real ASMR sounds", async () => {
    const user = userEvent.setup();
    render(<AppWorkspace player={createPlayerPortTestDouble().player} />);

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
    const { play, player, stopAll } = createPlayerPortTestDouble();
    render(<AppWorkspace player={player} />);

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

  it("switches to the audiobook view and speaks text through the TTS port", async () => {
    const user = userEvent.setup();
    const { engine, speak } = createTtsEngineTestDouble();
    render(
      <AppWorkspace
        player={createPlayerPortTestDouble().player}
        ttsEngine={engine}
      />,
    );

    await user.click(screen.getByRole("button", { name: "听书" }));

    expect(screen.getByRole("heading", { name: "听书" })).toBeInTheDocument();
    expect(await screen.findByText("系统女声 · zh-CN")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("书稿文本"));
    await user.type(screen.getByLabelText("书稿文本"), "第一段。\n\n第二段。");
    await user.click(screen.getByRole("button", { name: "播放" }));

    expect(speak).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "第一段。",
        voiceId: "voice:default",
      }),
    );
  });

  it("imports an EPUB book as pre-segmented audiobook content", async () => {
    const user = userEvent.setup();
    const { engine, speak } = createTtsEngineTestDouble();
    render(
      <AppWorkspace
        player={createPlayerPortTestDouble().player}
        ttsEngine={engine}
      />,
    );

    await user.click(screen.getByRole("button", { name: "听书" }));
    await user.upload(
      screen.getByLabelText("导入听书书稿"),
      await createMinimalEpubFile(),
    );

    expect(await screen.findByText("已导入 测试 EPUB · 5 段")).toBeInTheDocument();
    expect(screen.queryByLabelText("书稿文本")).not.toBeInTheDocument();
    expect(screen.getByText("EPUB · 2 章 · 5 个朗读片段")).toBeInTheDocument();
    expect(screen.getByText("正在播放章节")).toBeInTheDocument();
    expect(screen.getByText("3 段 · 第 1 / 2 章")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "选择章节，当前 第一章" }),
    );
    expect(screen.getByRole("listbox", { name: "章节列表" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /第一章.*3 段/u }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /第二章.*2 段/u }),
    ).toBeInTheDocument();
    expect(screen.queryByText("第三段。第四段。")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "下一章" }));

    await waitFor(() => {
      expect(speak).toHaveBeenCalledWith(
        expect.objectContaining({
          text: "第二章",
          voiceId: "voice:default",
        }),
      );
    });
    expect(
      screen.getByRole("button", { name: "选择章节，当前 第二章" }),
    ).toBeInTheDocument();
    expect(screen.getByText("第三段。第四段。")).toBeInTheDocument();
    expect(screen.queryByText("第一段。")).not.toBeInTheDocument();
  });

  it("imports an EPUB book dropped onto the audiobook import panel", async () => {
    const user = userEvent.setup();
    render(
      <AppWorkspace
        player={createPlayerPortTestDouble().player}
        ttsEngine={createTtsEngineTestDouble().engine}
      />,
    );

    await user.click(screen.getByRole("button", { name: "听书" }));
    fireEvent.drop(screen.getByRole("region", { name: "导入书稿" }), {
      dataTransfer: {
        files: [await createMinimalEpubFile()],
      },
    });

    expect(await screen.findByText("已导入 测试 EPUB · 5 段")).toBeInTheDocument();
    expect(screen.queryByLabelText("书稿文本")).not.toBeInTheDocument();
    expect(screen.getByText("EPUB · 2 章 · 5 个朗读片段")).toBeInTheDocument();
  });
});
