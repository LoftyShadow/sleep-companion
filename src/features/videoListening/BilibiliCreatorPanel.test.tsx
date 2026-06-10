import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createMemoryFileSystem } from "../../test/storageTestDoubles";
import type { BilibiliCreatorVideo } from "./bilibiliCreator";
import { BilibiliCreatorPanel } from "./BilibiliCreatorPanel";

function createCreatorVideos(count: number): BilibiliCreatorVideo[] {
  return Array.from({ length: count }, (_, index) => ({
    bvid: `BV1xx411c7${index.toString(36).padStart(2, "0")}`,
    coverUrl: `https://i0.hdslb.com/video-${index + 1}.jpg`,
    durationSeconds: 62 + index,
    playCount: 1000 + index,
    publishedAt: 1710000000 + index,
    title: `公开视频 ${index + 1}`,
  }));
}

describe("BilibiliCreatorPanel", () => {
  it("paginates returned creator videos five per page", async () => {
    const user = userEvent.setup();
    const videos = createCreatorVideos(18);
    const videosLoader = vi.fn().mockImplementation(
      (
        _mid: string,
        request: { page?: number; pageSize?: number } = {},
      ) => {
        const page = request.page ?? 1;
        const pageSize = request.pageSize ?? 5;

        return Promise.resolve({
          creator: {
            avatarUrl: "https://i0.hdslb.com/avatar.jpg",
            mid: "123456",
            name: "测试UP",
          },
          hasMore: page < 4,
          page,
          pageSize,
          totalCount: videos.length,
          totalPages: 4,
          videos: videos.slice((page - 1) * pageSize, page * pageSize),
        });
      },
    );
    const onVideoSelect = vi.fn();
    render(
      <BilibiliCreatorPanel
        fileSystem={createMemoryFileSystem()}
        videosLoader={videosLoader}
        onVideoSelect={onVideoSelect}
      />,
    );

    await user.type(
      screen.getByLabelText("UP 主主页或 mid"),
      "https://space.bilibili.com/123456",
    );
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(videosLoader).toHaveBeenCalledWith("123456", {
        page: 1,
        pageSize: 5,
      });
    });

    const latestVideos = await screen.findByLabelText("最新视频");
    expect(
      screen.queryByText(/已刷新第 \d+ 页公开视频/u),
    ).not.toBeInTheDocument();
    expect(within(latestVideos).getByText("18 个视频 · 1/4")).toBeInTheDocument();
    expect(within(latestVideos).queryByText("每页 5 个")).not.toBeInTheDocument();
    expect(within(latestVideos).getByText("公开视频 1")).toBeInTheDocument();
    expect(within(latestVideos).getByText("公开视频 5")).toBeInTheDocument();
    expect(
      within(latestVideos).queryByText("公开视频 6"),
    ).not.toBeInTheDocument();

    expect(
      within(latestVideos).getByRole("button", { name: "1" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(latestVideos).getByRole("button", { name: "3" }),
    ).toBeInTheDocument();

    await user.click(within(latestVideos).getByRole("button", { name: "下一页" }));

    await waitFor(() => {
      expect(videosLoader).toHaveBeenLastCalledWith("123456", {
        page: 2,
        pageSize: 5,
      });
    });
    expect(within(latestVideos).getByText("18 个视频 · 2/4")).toBeInTheDocument();
    expect(within(latestVideos).getByText("公开视频 6")).toBeInTheDocument();
    expect(
      within(latestVideos).queryByText("公开视频 1"),
    ).not.toBeInTheDocument();

    await user.click(
      within(latestVideos).getByRole("button", { name: "刷新当前页视频" }),
    );

    await waitFor(() => {
      expect(videosLoader).toHaveBeenCalledTimes(3);
    });
    expect(videosLoader).toHaveBeenLastCalledWith("123456", {
      page: 2,
      pageSize: 5,
    });
  });
});
