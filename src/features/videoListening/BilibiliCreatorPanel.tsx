import { useId, useState } from "react";
import type { FileSystemPort } from "../storage/FileSystemPort";
import type {
  BilibiliCreator,
  BilibiliCreatorVideo,
  BilibiliCreatorVideosLoader,
} from "./bilibiliCreator";
import { useBilibiliCreators } from "./useBilibiliCreators";

interface BilibiliCreatorPanelProps {
  fileSystem?: FileSystemPort;
  videosLoader?: BilibiliCreatorVideosLoader;
  onVideoSelect: (video: BilibiliCreatorVideo) => void;
}

function formatPublishedAt(timestampSeconds: number): string {
  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(timestampSeconds * 1000));
}

function formatDuration(durationSeconds?: number): string {
  if (durationSeconds === undefined) {
    return "";
  }

  const hours = Math.floor(durationSeconds / 3600);
  const minutes = Math.floor((durationSeconds % 3600) / 60);
  const seconds = durationSeconds % 60;
  const paddedSeconds = seconds.toString().padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${paddedSeconds}`;
  }

  return `${minutes}:${paddedSeconds}`;
}

function formatPlayCount(playCount?: number): string {
  if (playCount === undefined) {
    return "";
  }

  if (playCount >= 10_000) {
    return `${(playCount / 10_000).toFixed(playCount >= 100_000 ? 0 : 1)} 万播放`;
  }

  return `${playCount} 播放`;
}

function renderCreatorAvatar(
  creator: Pick<BilibiliCreator, "avatarUrl" | "name">,
  className: string,
) {
  return (
    <span className={className} aria-hidden="true">
      {creator.avatarUrl ? (
        <img alt="" referrerPolicy="no-referrer" src={creator.avatarUrl} />
      ) : (
        creator.name.slice(0, 1)
      )}
    </span>
  );
}

function RefreshIcon() {
  return (
    <svg
      aria-hidden="true"
      className="bilibili-refresh-icon"
      fill="none"
      viewBox="0 0 20 20"
    >
      <path
        d="M15.4 6.1A6.4 6.4 0 1 0 16 12"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M15.6 2.9v3.4h-3.4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function createVideoPageItems(
  currentPage: number,
  totalPages: number,
): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const middlePages = [currentPage - 1, currentPage, currentPage + 1].filter(
    (page) => page > 1 && page < totalPages,
  );
  const pageItems: Array<number | "ellipsis"> = [1];
  if (middlePages[0] && middlePages[0] > 2) {
    pageItems.push("ellipsis");
  }
  pageItems.push(...middlePages);
  const lastMiddlePage = middlePages[middlePages.length - 1];
  if (lastMiddlePage && lastMiddlePage < totalPages - 1) {
    pageItems.push("ellipsis");
  }
  pageItems.push(totalPages);

  return pageItems;
}

export function BilibiliCreatorPanel({
  fileSystem,
  videosLoader,
  onVideoSelect,
}: BilibiliCreatorPanelProps) {
  const inputId = useId();
  const [creatorInput, setCreatorInput] = useState("");
  const {
    activeCreator,
    addCreator,
    creators,
    deleteCreator,
    errorMessage,
    isAddingCreator,
    isLoadingCreators,
    isRefreshingVideos,
    isRefreshingVideosSlow,
    refreshCreatorVideos,
    selectCreator,
    selectedMid,
    statusMessage,
    videoHasMore,
    videoPage,
    videoTotalCount,
    videoTotalPages,
    videos,
  } = useBilibiliCreators({ fileSystem, videosLoader });
  const isBusy = isAddingCreator || isLoadingCreators || isRefreshingVideos;
  const hasMultipleVideoPages = videoTotalPages > 1 || videoHasMore;
  const hasKnownVideoTotalPages = videoTotalCount !== undefined;
  const videoPageItems = hasKnownVideoTotalPages
    ? createVideoPageItems(videoPage, videoTotalPages)
    : [];
  const videoPageLabel =
    videoTotalCount !== undefined
      ? `${videoTotalCount} 个视频 · ${videoPage}/${videoTotalPages}`
      : `第 ${videoPage} 页 · 已加载 ${videos.length} 个`;

  async function handleAddCreator() {
    await addCreator(creatorInput);
    setCreatorInput("");
  }

  function loadVideoPage(nextPage: number) {
    if (!selectedMid) {
      return;
    }

    void refreshCreatorVideos(selectedMid, nextPage);
  }

  return (
    <section
      className="bilibili-creator-panel glass-panel"
      aria-labelledby="bilibili-creator-heading"
    >
      <div className="video-source-header bilibili-creator-header">
        <div className="bilibili-creator-heading-copy">
          <h2 id="bilibili-creator-heading">UP 主列表</h2>
          {statusMessage ? (
            <p
              className={
                isRefreshingVideosSlow
                  ? "bilibili-creator-status is-slow"
                  : "bilibili-creator-status"
              }
              role="status"
            >
              {statusMessage}
            </p>
          ) : null}
        </div>
        <div className="bilibili-creator-add">
          <label className="field-label" htmlFor={inputId}>
            UP 主主页或 mid
          </label>
          <div className="bilibili-creator-add-row">
            <input
              className="video-link-input"
              id={inputId}
              placeholder="https://space.bilibili.com/123456"
              type="text"
              value={creatorInput}
              onChange={(event) => {
                setCreatorInput(event.currentTarget.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleAddCreator();
                }
              }}
            />
            <button
              className="custom-audio-button bilibili-add-button"
              type="button"
              disabled={isBusy}
              onClick={() => {
                void handleAddCreator();
              }}
            >
              保存
            </button>
          </div>
        </div>
      </div>

      {errorMessage ? (
        <p className="error-message bilibili-creator-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="bilibili-creator-tools">
        <section className="bilibili-creator-roster" aria-label="已保存 UP 主">
          <div className="bilibili-creator-column-header">
            <span>关注的 UP 主</span>
            <strong>{creators.length}</strong>
          </div>
          <div className="bilibili-creator-list">
            {creators.length > 0 ? (
              creators.map((creator) => (
                <article
                  className={
                    creator.mid === selectedMid
                      ? "bilibili-creator-item is-active"
                      : "bilibili-creator-item"
                  }
                  key={creator.mid}
                >
                  <button
                    className="bilibili-creator-remove"
                    type="button"
                    aria-label={`删除 ${creator.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      void deleteCreator(creator.mid);
                    }}
                  >
                    x
                  </button>
                  <button
                    className="bilibili-creator-select"
                    type="button"
                    aria-pressed={creator.mid === selectedMid}
                    onClick={() => {
                      selectCreator(creator.mid);
                    }}
                  >
                    {renderCreatorAvatar(creator, "bilibili-creator-avatar")}
                    <span className="bilibili-creator-name">{creator.name}</span>
                  </button>
                </article>
              ))
            ) : (
              <p className="bilibili-empty-state">
                {isLoadingCreators ? "正在读取本地列表" : "保存 UP 主后刷新最新视频"}
              </p>
            )}
          </div>
        </section>
      </div>

      <div className="bilibili-creator-content">
        <section className="bilibili-video-list" aria-label="最新视频">
          {activeCreator ? (
            <div className="bilibili-video-list-toolbar">
              <div className="bilibili-video-list-page-actions">
                <span>
                  {videos.length > 0 ? videoPageLabel : "等待刷新"}
                </span>
                <button
                  className="secondary-control-button bilibili-video-refresh-button"
                  type="button"
                  aria-label="刷新当前页视频"
                  disabled={isRefreshingVideos || !selectedMid}
                  onClick={() => {
                    loadVideoPage(videoPage);
                  }}
                >
                  <RefreshIcon />
                  <span>{isRefreshingVideos ? "刷新中" : "刷新"}</span>
                </button>
                {hasMultipleVideoPages ? (
                  <div className="bilibili-video-page-buttons" aria-label="公开视频分页">
                    <button
                      className="secondary-control-button bilibili-video-page-button"
                      type="button"
                      disabled={videoPage <= 1 || isRefreshingVideos}
                      onClick={() => {
                        loadVideoPage(videoPage - 1);
                      }}
                    >
                      上一页
                    </button>
                    {videoPageItems.map((pageItem, index) =>
                      pageItem === "ellipsis" ? (
                        <span
                          className="bilibili-video-page-ellipsis"
                          aria-hidden="true"
                          key={`ellipsis-${index}`}
                        >
                          ...
                        </span>
                      ) : (
                        <button
                          className={
                            pageItem === videoPage
                              ? "secondary-control-button bilibili-video-page-button is-current"
                              : "secondary-control-button bilibili-video-page-button"
                          }
                          type="button"
                          aria-current={pageItem === videoPage ? "page" : undefined}
                          disabled={pageItem === videoPage || isRefreshingVideos}
                          key={pageItem}
                          onClick={() => {
                            loadVideoPage(pageItem);
                          }}
                        >
                          {pageItem}
                        </button>
                      ),
                    )}
                    <button
                      className="secondary-control-button bilibili-video-page-button"
                      type="button"
                      disabled={
                        isRefreshingVideos ||
                        (!videoHasMore && videoPage >= videoTotalPages)
                      }
                      onClick={() => {
                        loadVideoPage(videoPage + 1);
                      }}
                    >
                      下一页
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {videos.length > 0 ? (
            <div className="bilibili-video-items">
              {videos.map((video) => (
                <button
                  className="bilibili-video-item"
                  key={video.bvid}
                  type="button"
                  onClick={() => {
                    onVideoSelect(video);
                  }}
                >
                  <span className="bilibili-video-cover">
                    {video.coverUrl ? (
                      <img
                        alt=""
                        referrerPolicy="no-referrer"
                        src={video.coverUrl}
                      />
                    ) : (
                      <span aria-hidden="true">BV</span>
                    )}
                  </span>
                  <span className="bilibili-video-copy">
                    <strong>{video.title}</strong>
                    <span className="bilibili-video-meta">
                      {[
                        formatPublishedAt(video.publishedAt),
                        formatDuration(video.durationSeconds),
                        formatPlayCount(video.playCount),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    <span className="bilibili-video-play-mark" aria-hidden="true">
                      <svg fill="none" viewBox="0 0 18 18">
                        <path
                          d="M6.4 4.6v8.8l6.8-4.4-6.8-4.4Z"
                          fill="currentColor"
                        />
                      </svg>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="bilibili-empty-state">
              {activeCreator
                ? "正在获取最新公开视频"
                : "先保存或选择一个 UP 主"}
            </p>
          )}
        </section>
      </div>
    </section>
  );
}
