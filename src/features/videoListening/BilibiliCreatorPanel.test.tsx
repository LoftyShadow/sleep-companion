import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryFileSystem } from "../../test/storageTestDoubles";
import type {
  BilibiliCreatorVideo,
  BilibiliCreatorVideos,
} from "./bilibiliCreator";
import { BilibiliCreatorPanel } from "./BilibiliCreatorPanel";
import { CREATOR_VIDEO_SLOW_REQUEST_DELAY_MS } from "./useBilibiliCreators";

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

function createCreatorVideoResponse({
  page = 1,
  pageSize = 5,
  totalCount = 5,
}: {
  page?: number;
  pageSize?: number;
  totalCount?: number;
} = {}): BilibiliCreatorVideos {
  const videos = createCreatorVideos(totalCount);

  return {
    creator: {
      avatarUrl: "https://i0.hdslb.com/avatar.jpg",
      mid: "123456",
      name: "测试UP",
    },
    hasMore: page * pageSize < totalCount,
    page,
    pageSize,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    videos: videos.slice((page - 1) * pageSize, page * pageSize),
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

async function flushAsyncWork() {
  for (let index = 0; index < 3; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

describe("BilibiliCreatorPanel", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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

  it("shows slow request feedback and clears it after videos load", async () => {
    vi.useFakeTimers();
    const request = createDeferred<BilibiliCreatorVideos>();
    const videosLoader = vi.fn().mockReturnValue(request.promise);
    render(
      <BilibiliCreatorPanel
        fileSystem={createMemoryFileSystem()}
        videosLoader={videosLoader}
        onVideoSelect={vi.fn()}
      />,
    );

    await flushAsyncWork();
    fireEvent.change(screen.getByLabelText("UP 主主页或 mid"), {
      target: { value: "https://space.bilibili.com/123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await flushAsyncWork();

    expect(videosLoader).toHaveBeenCalledWith("123456", {
      page: 1,
      pageSize: 5,
    });
    expect(
      screen.getByRole("button", { name: "刷新当前页视频" }),
    ).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(CREATOR_VIDEO_SLOW_REQUEST_DELAY_MS);
    });

    expect(
      screen.getByText("仍在请求 B 站，第 1 页视频可能需要更久"),
    ).toBeInTheDocument();

    await act(async () => {
      request.resolve(createCreatorVideoResponse());
      await request.promise;
    });
    await flushAsyncWork();

    expect(screen.queryByText(/仍在请求 B 站/u)).not.toBeInTheDocument();
    expect(screen.getByText("公开视频 1")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "刷新当前页视频" }),
    ).toBeEnabled();
  });

  it("reenables refresh after a failed slow request and allows retry", async () => {
    vi.useFakeTimers();
    const failedRequest = createDeferred<BilibiliCreatorVideos>();
    const videosLoader = vi
      .fn()
      .mockResolvedValueOnce(createCreatorVideoResponse())
      .mockReturnValueOnce(failedRequest.promise)
      .mockResolvedValueOnce(createCreatorVideoResponse());
    render(
      <BilibiliCreatorPanel
        fileSystem={createMemoryFileSystem()}
        videosLoader={videosLoader}
        onVideoSelect={vi.fn()}
      />,
    );

    await flushAsyncWork();
    fireEvent.change(screen.getByLabelText("UP 主主页或 mid"), {
      target: { value: "https://space.bilibili.com/123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await flushAsyncWork();

    const latestVideos = screen.getByLabelText("最新视频");
    expect(screen.getByText("公开视频 1")).toBeInTheDocument();

    fireEvent.click(
      within(latestVideos).getByRole("button", { name: "刷新当前页视频" }),
    );
    await flushAsyncWork();

    act(() => {
      vi.advanceTimersByTime(CREATOR_VIDEO_SLOW_REQUEST_DELAY_MS);
    });

    expect(
      screen.getByText("仍在请求 B 站，第 1 页视频可能需要更久"),
    ).toBeInTheDocument();

    act(() => {
      failedRequest.reject(new Error("网络超时"));
    });
    await flushAsyncWork();

    expect(screen.getByRole("alert")).toHaveTextContent("网络超时");
    expect(
      within(latestVideos).getByRole("button", { name: "刷新当前页视频" }),
    ).toBeEnabled();

    fireEvent.click(
      within(latestVideos).getByRole("button", { name: "刷新当前页视频" }),
    );
    await flushAsyncWork();

    expect(videosLoader).toHaveBeenCalledTimes(3);
    expect(videosLoader).toHaveBeenLastCalledWith("123456", {
      page: 1,
      pageSize: 5,
    });
  });
});
