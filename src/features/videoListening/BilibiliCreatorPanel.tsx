import { useId, useState } from "react";
import type { FileSystemPort } from "../storage/FileSystemPort";
import type {
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
    refreshCreatorVideos,
    selectCreator,
    selectedMid,
    statusMessage,
    videos,
  } = useBilibiliCreators({ fileSystem, videosLoader });
  const isBusy = isAddingCreator || isLoadingCreators || isRefreshingVideos;

  async function handleAddCreator() {
    await addCreator(creatorInput);
    setCreatorInput("");
  }

  return (
    <section
      className="bilibili-creator-panel glass-panel"
      aria-labelledby="bilibili-creator-heading"
    >
      <div className="video-source-header bilibili-creator-header">
        <div>
          <h2 id="bilibili-creator-heading">UP 主列表</h2>
          <p className="bilibili-creator-status" role="status">
            {statusMessage}
          </p>
        </div>
        <button
          className="secondary-control-button bilibili-refresh-button"
          type="button"
          disabled={!selectedMid || isRefreshingVideos}
          onClick={() => {
            void refreshCreatorVideos();
          }}
        >
          {isRefreshingVideos ? "刷新中" : "刷新视频"}
        </button>
      </div>

      {errorMessage ? (
        <p className="error-message bilibili-creator-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

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

      <div className="bilibili-creator-content">
        <div className="bilibili-creator-list" aria-label="已保存 UP 主">
          {creators.length > 0 ? (
            creators.map((creator) => (
              <div
                className={
                  creator.mid === selectedMid
                    ? "bilibili-creator-item is-active"
                    : "bilibili-creator-item"
                }
                key={creator.mid}
              >
                <button
                  className="bilibili-creator-select"
                  type="button"
                  aria-pressed={creator.mid === selectedMid}
                  onClick={() => {
                    selectCreator(creator.mid);
                  }}
                >
                  <span className="bilibili-creator-avatar" aria-hidden="true">
                    {creator.avatarUrl ? (
                      <img
                        alt=""
                        referrerPolicy="no-referrer"
                        src={creator.avatarUrl}
                      />
                    ) : (
                      creator.name.slice(0, 1)
                    )}
                  </span>
                  <span className="bilibili-creator-name">{creator.name}</span>
                  <span className="bilibili-creator-mid">mid {creator.mid}</span>
                </button>
                <button
                  className="secondary-control-button bilibili-delete-button"
                  type="button"
                  aria-label={`删除 ${creator.name}`}
                  onClick={() => {
                    void deleteCreator(creator.mid);
                  }}
                >
                  删除
                </button>
              </div>
            ))
          ) : (
            <p className="bilibili-empty-state">
              {isLoadingCreators ? "正在读取本地列表" : "保存 UP 主后刷新最新视频"}
            </p>
          )}
        </div>

        <div className="bilibili-video-list" aria-label="最新视频">
          {activeCreator ? (
            <div className="bilibili-video-list-header">
              <strong>{activeCreator.name}</strong>
              <span>{videos.length > 0 ? `${videos.length} 个公开视频` : "等待刷新"}</span>
            </div>
          ) : null}

          {videos.length > 0 ? (
            videos.map((video) => (
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
                  <span>
                    {[
                      formatPublishedAt(video.publishedAt),
                      formatDuration(video.durationSeconds),
                      formatPlayCount(video.playCount),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </button>
            ))
          ) : (
            <p className="bilibili-empty-state">
              {activeCreator
                ? "点击刷新视频获取最新公开视频"
                : "先保存或选择一个 UP 主"}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
