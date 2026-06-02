import type { CSSProperties } from "react";
import type {
  AudiobookBookId,
  AudiobookCover,
  AudiobookLibraryItem,
} from "./audiobookTypes";
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
  return (
    <aside className="audiobook-library glass-panel" aria-label="听书书架">
      <div className="section-heading sound-section-heading">
        <div>
          <p className="app-kicker">书架</p>
          <h2>听书书架</h2>
        </div>
        <span className="section-meta">{items.length} 本</span>
      </div>

      <label className="custom-audio-button audiobook-library-import-button">
        <span>{isImporting ? "导入中" : "添加书籍"}</span>
        <input
          accept={AUDIOBOOK_FILE_ACCEPT}
          aria-label="添加听书书籍"
          className="custom-audio-input"
          disabled={isImporting}
          multiple
          type="file"
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            event.currentTarget.value = "";
            onBookFiles(files);
          }}
        />
      </label>

      <p className="custom-audio-status" role="status">
        {isLoading ? "正在读取书架" : (importMessage ?? "选择一本书继续收听")}
      </p>

      <div className="audiobook-library-list" aria-label="书籍列表">
        {items.length === 0 ? (
          <p className="audiobook-library-empty">
            导入一本书后，会在这里保存进度和封面。
          </p>
        ) : (
          items.map((item) => {
            const isActive = item.id === activeBookId;

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
                  aria-current={isActive ? "true" : undefined}
                  className="audiobook-library-open-button"
                  type="button"
                  onClick={() => {
                    onOpenBook(item.id);
                  }}
                >
                  <BookCover item={item} objectUrl={coverObjectUrls[item.id]} />
                  <span className="audiobook-library-item-copy">
                    <strong>{item.title}</strong>
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
                  type="button"
                  onClick={() => {
                    onDeleteBook(item.id);
                  }}
                >
                  删除
                </button>
              </article>
            );
          })
        )}
      </div>
    </aside>
  );
}
