import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createTtsEngineTestDouble } from "../../test/audioTestDoubles";
import { createMinimalEpubFile } from "../../test/epubTestDoubles";
import { createMemoryFileSystem } from "../../test/storageTestDoubles";
import { AudiobookView } from "./AudiobookView";

function renderAudiobookView() {
  const fileSystem = createMemoryFileSystem();
  const tts = createTtsEngineTestDouble();
  const user = userEvent.setup();

  render(
    <AudiobookView
      engine={tts.engine}
      fileSystem={fileSystem}
      globalStopRequestId={0}
    />,
  );

  return { fileSystem, tts, user };
}

async function importBook(user: ReturnType<typeof userEvent.setup>) {
  const file = await createMinimalEpubFile();

  await user.upload(screen.getByLabelText("添加听书书籍"), file);

  return file;
}

describe("AudiobookView", () => {
  it("starts from the bookshelf instead of the reader workspace", () => {
    renderAudiobookView();

    expect(
      screen.getByRole("heading", { name: "听书书架" }),
    ).toBeInTheDocument();
    expect(screen.getByText("还没有书")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "朗读内容" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "返回书架" }),
    ).not.toBeInTheDocument();
  });

  it("opens the reader workspace after importing a book and can return to the shelf", async () => {
    const { user } = renderAudiobookView();

    await importBook(user);

    expect(
      await screen.findByRole("heading", { name: "测试 EPUB" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "朗读内容" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回书架" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "返回书架" }));

    expect(
      screen.getByRole("heading", { name: "听书书架" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "进入内容" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "播放" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "朗读内容" }),
    ).not.toBeInTheDocument();
  });

  it("opens a selected shelf book into its reader content", async () => {
    const { user } = renderAudiobookView();

    await importBook(user);
    await user.click(await screen.findByRole("button", { name: "返回书架" }));

    const shelf = screen.getByLabelText("书籍列表");
    const openButtons = within(shelf)
      .getAllByRole("button", { name: /测试 EPUB/ })
      .filter((button) => !button.getAttribute("aria-label")?.startsWith("删除"));
    const openButton = openButtons[0];

    if (!openButton) {
      throw new Error("没有找到书籍打开按钮");
    }

    await user.click(openButton);

    expect(
      await screen.findByRole("heading", { name: "测试 EPUB" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "朗读内容" })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "01第一章" })).toHaveAttribute(
        "aria-current",
        "true",
      );
    });
  });
});
