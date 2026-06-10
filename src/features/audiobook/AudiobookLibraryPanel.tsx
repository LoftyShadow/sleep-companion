import type { CSSProperties } from "react";
import type {
  AudiobookBookId,
  AudiobookCover,
  AudiobookLibraryItem,
} from "./audiobookTypes";
import {
  getFullAudiobookTitle,
  getShortAudiobookTitle,
} from "./audiobookTitle";
import { AUDIOBOOK_FILE_ACCEPT } from "./bookImport";

type CoverObjectUrls = Partial<Record<AudiobookBookId, string>>;

interface AudiobookLibraryPanelProps {
  activeBookId: AudiobookBookId | null;
  coverObjectUrls: CoverObjectUrls;
  importMessage: string | null;
  isImporting: boolean;
  isLoading: boolean;
  items: AudiobookLibraryItem[];
  onBookFiles: (files: File[]) => void;
  onDeleteBook: (bookId: AudiobookBookId) => void;
  onOpenBook: (bookId: AudiobookBookId) => void;
}

function getFormatLabel(format: AudiobookLibraryItem["format"]): string {
  return format === "epub" ? "EPUB" : "文本";
}

function getProgressLabel(item: AudiobookLibraryItem): string {
  if (item.segmentCount === 0) {
    return "0%";
  }

  return `${item.progress.percent}%`;
}

function GeneratedCover({ cover }: { cover: Extract<AudiobookCover, { kind: "generated" }> }) {
  return (
    <span
      className="audiobook-cover audiobook-cover-generated"
      style={{ "--audiobook-cover-accent": cover.accent } as CSSProperties}
      aria-hidden="true"
    >
      {cover.initials}
    </span>
  );
}

function BookCover({
  item,
  objectUrl,
}: {
  item: AudiobookLibraryItem;
  objectUrl?: string;
}) {
  if (item.cover.kind === "image" && objectUrl) {
    return (
      <span className="audiobook-cover">
        <img src={objectUrl} alt="" draggable={false} />
      </span>
    );
  }

  return (
    <GeneratedCover
      cover={
        item.cover.kind === "generated"
          ? item.cover
          : { accent: "#2d7d82", initials: "书", kind: "generated" }
      }
    />
  );
}

export function AudiobookLibraryPanel({
  activeBookId,
  coverObjectUrls,
  importMessage,
  isImporting,
  isLoading,
  items,
  onBookFiles,
  onDeleteBook,
  onOpenBook,
}: AudiobookLibraryPanelProps) {
  const fileInputId = "audiobook-library-file-input";
  const primaryStatus = isLoading
    ? "正在读取书架"
    : (importMessage ?? "选择一本书继续收听");

  return (
    <aside className="audiobook-library glass-panel" aria-label="听书书架">
      <div className="audiobook-library-header">
        <div className="audiobook-library-heading-copy">
          <p className="app-kicker">书架</p>
          <h1>听书书架</h1>
          <p>{primaryStatus}</p>
        </div>

        <div className="audiobook-library-actions">
          <span className="section-meta">{items.length} 本</span>
          <label
            className="custom-audio-button audiobook-library-import-button"
            htmlFor={fileInputId}
          >
            <span>{isImporting ? "导入中" : "添加书籍"}</span>
            <input
              accept={AUDIOBOOK_FILE_ACCEPT}
              aria-label="添加听书书籍"
              className="custom-audio-input"
              disabled={isImporting}
              id={fileInputId}
              multiple
              name="audiobookLibraryFiles"
              type="file"
              onChange={(event) => {
                const files = Array.from(event.currentTarget.files ?? []);
                event.currentTarget.value = "";
                onBookFiles(files);
              }}
            />
          </label>
        </div>
      </div>

      <p className="custom-audio-status audiobook-library-status" role="status">
        {primaryStatus}
      </p>

      <div
        className={
          items.length === 0
            ? "audiobook-library-list audiobook-library-list-empty"
            : "audiobook-library-list"
        }
        aria-label="书籍列表"
      >
        {items.length === 0 ? (
          <div className="audiobook-library-empty">
            <div className="audiobook-empty-shelf" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div>
              <h2>还没有书</h2>
              <p>导入 txt、Markdown 或 EPUB 后，会在这里保存封面和朗读进度。</p>
            </div>
          </div>
        ) : (
          items.map((item) => {
            const isActive = item.id === activeBookId;
            const fullTitle = getFullAudiobookTitle(item.title);
            const shortTitle = getShortAudiobookTitle(item.title);

            return (
              <article
                className={
                  isActive
                    ? "audiobook-library-item is-active"
                    : "audiobook-library-item"
                }
                key={item.id}
              >
                <button
                  aria-label={`打开 ${shortTitle}`}
                  aria-current={isActive ? "true" : undefined}
                  className="audiobook-library-open-button"
                  type="button"
                  onClick={() => {
                    onOpenBook(item.id);
                  }}
                >
                  <BookCover item={item} objectUrl={coverObjectUrls[item.id]} />
                  <span className="audiobook-library-item-copy">
                    <strong title={fullTitle}>{shortTitle}</strong>
                    <span>
                      {getFormatLabel(item.format)} · {item.chapterCount || 1} 章 ·{" "}
                      {item.segmentCount} 段
                    </span>
                    {item.author ? <span>{item.author}</span> : null}
                  </span>
                  <span className="audiobook-library-progress">
                    {getProgressLabel(item)}
                  </span>
                </button>
                <button
                  className="audiobook-library-delete-button"
                  aria-label={`删除 ${shortTitle}`}
                  title={`删除 ${fullTitle}`}
                  type="button"
                  onClick={() => {
                    onDeleteBook(item.id);
                  }}
                >
                  删除
                </button>
                <div className="audiobook-library-card-foot" aria-hidden="true">
                  <span>{getFormatLabel(item.format)}</span>
                  <span>{getProgressLabel(item)}</span>
                </div>
              </article>
            );
          })
        )}
      </div>
    </aside>
  );
}
