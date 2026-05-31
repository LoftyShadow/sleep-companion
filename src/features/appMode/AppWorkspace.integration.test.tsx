import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  createPlayerPortTestDouble,
  createTtsEngineTestDouble,
} from "../../test/audioTestDoubles";
import { createMinimalEpubFile } from "../../test/epubTestDoubles";
import type { BilibiliMetadataLoader } from "../videoListening/bilibiliMetadata";
import type { BilibiliReference } from "../videoListening/bilibiliVideo";
import { AppWorkspace } from "./AppWorkspace";

describe("AppWorkspace integration", () => {
  function createBilibiliMetadataLoaderTestDouble(): BilibiliMetadataLoader {
    return vi.fn((reference: BilibiliReference) =>
      Promise.resolve({
        imageUrl:
          reference.kind === "live"
            ? "https://i0.hdslb.com/live-cover.jpg"
            : "https://i0.hdslb.com/video-cover.jpg",
        title: reference.kind === "live" ? "直播测试标题" : "视频测试标题",
      }),
    );
  }

  function renderVideoWorkspace() {
    const bilibiliMetadataLoader = createBilibiliMetadataLoaderTestDouble();
    const user = userEvent.setup();
    render(
      <AppWorkspace
        bilibiliMetadataLoader={bilibiliMetadataLoader}
        player={createPlayerPortTestDouble().player}
      />,
    );

    return { bilibiliMetadataLoader, user };
  }

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
    expect(screen.getByRole("button", { name: "02第一段。" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /第一章\s+第一段。/u }),
    ).not.toBeInTheDocument();
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

  it("loads a Bilibili link in the official video player", async () => {
    const { bilibiliMetadataLoader, user } = renderVideoWorkspace();

    await user.click(screen.getByRole("button", { name: "听视频" }));
    expect(screen.getByRole("heading", { name: "听视频" })).toBeInTheDocument();

    await user.type(
      screen.getByLabelText("视频或直播链接"),
      "https://www.bilibili.com/video/BV1xx411c7mD/",
    );
    await user.click(screen.getByRole("button", { name: "载入" }));

    expect(screen.getByText("已载入 BV BV1xx411c7mD")).toBeInTheDocument();
    expect(await screen.findByText("视频测试标题")).toBeInTheDocument();
    expect(screen.getByAltText("视频测试标题 封面")).toHaveAttribute(
      "src",
      "https://i0.hdslb.com/video-cover.jpg",
    );
    expect(screen.getByAltText("视频测试标题 封面")).toHaveAttribute(
      "referrerpolicy",
      "no-referrer",
    );
    expect(bilibiliMetadataLoader).toHaveBeenCalledWith({
      kind: "bvid",
      value: "BV1xx411c7mD",
    });
    expect(screen.getByTitle("B 站视频播放器 BV BV1xx411c7mD")).toHaveAttribute(
      "src",
      "https://player.bilibili.com/player.html?autoplay=1&bvid=BV1xx411c7mD",
    );
  });

  it("loads a Bilibili live room in the official live player", async () => {
    const { bilibiliMetadataLoader, user } = renderVideoWorkspace();

    await user.click(screen.getByRole("button", { name: "听视频" }));
    await user.type(
      screen.getByLabelText("视频或直播链接"),
      "https://live.bilibili.com/23058",
    );
    await user.click(screen.getByRole("button", { name: "载入" }));

    expect(screen.getByText("已载入 直播间 23058")).toBeInTheDocument();
    expect(await screen.findByText("直播测试标题")).toBeInTheDocument();
    expect(screen.getByAltText("直播测试标题 封面")).toHaveAttribute(
      "src",
      "https://i0.hdslb.com/live-cover.jpg",
    );
    expect(bilibiliMetadataLoader).toHaveBeenCalledWith({
      kind: "live",
      value: "23058",
    });
    expect(screen.getByTitle("B 站直播播放器 直播间 23058")).toHaveAttribute(
      "src",
      "https://www.bilibili.com/blackboard/live/live-activity-player.html?cid=23058&mute=0",
    );
  });

  it("pauses and resumes the official listening source from the outer controls", async () => {
    const { user } = renderVideoWorkspace();

    await user.click(screen.getByRole("button", { name: "听视频" }));
    await user.type(screen.getByLabelText("视频或直播链接"), "BV1xx411c7mD");
    await user.click(screen.getByRole("button", { name: "载入" }));

    expect(
      screen.getByTitle("B 站视频播放器 BV BV1xx411c7mD"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "暂停" }));

    expect(screen.getByText("播放源已暂停")).toBeInTheDocument();
    expect(
      screen.queryByTitle("B 站视频播放器 BV BV1xx411c7mD"),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "播放" }));

    expect(
      screen.getByTitle("B 站视频播放器 BV BV1xx411c7mD"),
    ).toBeInTheDocument();
  });

  it("controls Bilibili live playback volume through the official iframe API", async () => {
    const { user } = renderVideoWorkspace();

    await user.click(screen.getByRole("button", { name: "听视频" }));
    await user.type(
      screen.getByLabelText("视频或直播链接"),
      "https://live.bilibili.com/23058",
    );
    await user.click(screen.getByRole("button", { name: "载入" }));

    const frame = screen.getByTitle("B 站直播播放器 直播间 23058");
    if (!(frame instanceof HTMLIFrameElement)) {
      throw new Error("测试目标不是 iframe");
    }
    const contentWindow = frame.contentWindow;
    if (!contentWindow) {
      throw new Error("测试环境缺少 iframe window");
    }
    const postMessage = vi.spyOn(contentWindow, "postMessage");

    fireEvent.load(frame);
    fireEvent.change(screen.getByLabelText("收听音量"), {
      target: { value: "35" },
    });

    expect(screen.getByText("35%")).toBeInTheDocument();
    expect(postMessage).toHaveBeenCalledWith(
      'setPlayer-{"type":"changeVolume","value":{"volume":35}}',
      "https://www.bilibili.com",
    );

    await user.click(screen.getByRole("button", { name: "暂停" }));

    expect(postMessage).toHaveBeenCalledWith(
      'setPlayer-{"type":"play","value":false}',
      "https://www.bilibili.com",
    );
    expect(
      screen.getByTitle("B 站直播播放器 直播间 23058"),
    ).toBeInTheDocument();
  });

  it("keeps the official player collapsed by default while still mounted", async () => {
    const { user } = renderVideoWorkspace();

    await user.click(screen.getByRole("button", { name: "听视频" }));
    await user.type(screen.getByLabelText("视频或直播链接"), "BV1xx411c7mD");
    await user.click(screen.getByRole("button", { name: "载入" }));

    expect(screen.getByText("画面已收起，继续收听声音")).toBeInTheDocument();
    expect(
      screen.getByTitle("B 站视频播放器 BV BV1xx411c7mD"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "展开播放源" }));

    expect(
      screen.queryByText("画面已收起，继续收听声音"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "收起播放源" }),
    ).toBeInTheDocument();
  });

  it("pastes a Bilibili link from the clipboard", async () => {
    const user = userEvent.setup();
    const readText = vi.fn().mockResolvedValue("BV1xx411c7mD");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { readText },
    });
    render(<AppWorkspace player={createPlayerPortTestDouble().player} />);

    await user.click(screen.getByRole("button", { name: "听视频" }));
    await user.click(screen.getByRole("button", { name: "粘贴" }));

    expect(readText).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("视频或直播链接")).toHaveValue("BV1xx411c7mD");
  });
});
