import { useId } from "react";

interface AudiobookImportPanelProps {
  bookTitle: string;
  importMessage: string | null;
  isImporting: boolean;
  segmentCount: number;
  onBookFiles: (files: File[]) => void;
  onBookTitleChange: (title: string) => void;
}

export function AudiobookImportPanel({
  bookTitle,
  importMessage,
  isImporting,
  segmentCount,
  onBookFiles,
  onBookTitleChange,
}: AudiobookImportPanelProps) {
  const titleInputId = useId();

  return (
    <section className="audiobook-import-panel" aria-label="导入书稿">
      <label className="field-label" htmlFor={titleInputId}>
        书名
      </label>
      <input
        className="audiobook-title-input"
        id={titleInputId}
        type="text"
        value={bookTitle}
        onChange={(event) => {
          onBookTitleChange(event.currentTarget.value);
        }}
      />

      <label className="custom-audio-button audiobook-file-button">
        <span>{isImporting ? "导入中" : "导入文本"}</span>
        <input
          accept=".txt,.md,.markdown,text/plain,text/markdown"
          aria-label="导入文本书稿"
          className="custom-audio-input"
          disabled={isImporting}
          type="file"
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            event.currentTarget.value = "";
            onBookFiles(files);
          }}
        />
      </label>
      <p className="custom-audio-status" role="status">
        {importMessage ?? `${segmentCount} 个朗读片段`}
      </p>
    </section>
  );
}

