import type {
  BilibiliFavoriteVideo,
  BilibiliFavoriteVideoInput,
} from "./bilibiliFavoriteVideo";

interface BilibiliFavoriteVideoPanelProps {
  currentVideo: BilibiliFavoriteVideoInput | null;
  errorMessage: string | null;
  favoriteVideos: BilibiliFavoriteVideo[];
  isCurrentVideoFavorite: boolean;
  isLoading: boolean;
  onDeleteVideo: (bvid: string) => void;
  onSaveCurrentVideo: () => void;
  onVideoSelect: (video: BilibiliFavoriteVideo) => void;
}

function formatDate(timestampSeconds?: number): string {
  if (timestampSeconds === undefined) {
    return "";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(timestampSeconds * 1000));
}

function formatAddedAt(timestampMilliseconds: number): string {
  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(timestampMilliseconds));
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

function favoriteVideoMeta(video: BilibiliFavoriteVideo): string {
  return [
    video.aid ? `av ${video.aid}` : video.bvid,
    formatDate(video.publishedAt),
    formatDuration(video.durationSeconds),
    formatPlayCount(video.playCount),
    `收藏于 ${formatAddedAt(video.addedAt)}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

function favoriteStatusText(
  favoriteCount: number,
  isLoading: boolean,
): string {
  if (isLoading) {
    return "正在读取本地收藏";
  }

  return favoriteCount > 0
    ? `已收藏 ${favoriteCount} 个视频`
    : "还没有收藏视频";
}

export function BilibiliFavoriteVideoPanel({
  currentVideo,
  errorMessage,
  favoriteVideos,
  isCurrentVideoFavorite,
  isLoading,
  onDeleteVideo,
  onSaveCurrentVideo,
  onVideoSelect,
}: BilibiliFavoriteVideoPanelProps) {
  const canSaveCurrentVideo = Boolean(currentVideo);

  return (
    <section
      className="bilibili-favorite-panel glass-panel"
      aria-labelledby="bilibili-favorite-heading"
    >
      <div className="video-source-header bilibili-favorite-header">
        <div>
          <h2 id="bilibili-favorite-heading">视频收藏</h2>
          <p className="bilibili-favorite-status" role="status">
            {favoriteStatusText(favoriteVideos.length, isLoading)}
          </p>
        </div>
        <button
          className="custom-audio-button bilibili-favorite-save-button"
          type="button"
          disabled={!canSaveCurrentVideo}
          aria-pressed={isCurrentVideoFavorite}
          onClick={onSaveCurrentVideo}
        >
          {isCurrentVideoFavorite ? "已收藏" : "收藏视频"}
        </button>
      </div>

      {errorMessage ? (
        <p className="error-message bilibili-favorite-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {currentVideo ? (
        <div className="bilibili-current-favorite" aria-label="当前视频">
          <span className="bilibili-current-favorite-cover">
            {currentVideo.coverUrl ? (
              <img alt="" referrerPolicy="no-referrer" src={currentVideo.coverUrl} />
            ) : (
              <span aria-hidden="true">BV</span>
            )}
          </span>
          <span className="bilibili-current-favorite-copy">
            <strong>{currentVideo.title}</strong>
            <span>{currentVideo.aid ? `av ${currentVideo.aid}` : currentVideo.bvid}</span>
          </span>
        </div>
      ) : null}

      <div className="bilibili-favorite-list" aria-label="已收藏视频">
        {favoriteVideos.length > 0 ? (
          favoriteVideos.map((video) => (
            <article className="bilibili-favorite-item" key={video.bvid}>
              <button
                className="bilibili-favorite-select"
                type="button"
                aria-label={`播放收藏 ${video.title}`}
                onClick={() => {
                  onVideoSelect(video);
                }}
              >
                <span className="bilibili-favorite-cover">
                  {video.coverUrl ? (
                    <img alt="" referrerPolicy="no-referrer" src={video.coverUrl} />
                  ) : (
                    <span aria-hidden="true">BV</span>
                  )}
                </span>
                <span className="bilibili-favorite-copy">
                  <strong>{video.title}</strong>
                  <span>{favoriteVideoMeta(video)}</span>
                </span>
              </button>
              <button
                className="secondary-control-button bilibili-favorite-delete-button"
                type="button"
                aria-label={`删除收藏 ${video.title}`}
                onClick={() => {
                  onDeleteVideo(video.bvid);
                }}
              >
                删除
              </button>
            </article>
          ))
        ) : (
          <p className="bilibili-empty-state">
            {isLoading ? "正在读取本地视频收藏" : "载入视频后可以加入收藏"}
          </p>
        )}
      </div>
    </section>
  );
}
