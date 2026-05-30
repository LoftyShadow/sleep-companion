import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  createPlayerPortTestDouble,
  createTtsEngineTestDouble,
} from "../../test/audioTestDoubles";
import { AppWorkspace } from "./AppWorkspace";

describe("AppWorkspace", () => {
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
});
