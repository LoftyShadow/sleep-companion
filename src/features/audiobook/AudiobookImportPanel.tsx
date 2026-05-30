import { useId, useState } from "react";
import type { DragEvent } from "react";
import { AUDIOBOOK_FILE_ACCEPT } from "./bookImport";

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
  const [isDragActive, setIsDragActive] = useState(false);

  function hasDraggedFiles(event: DragEvent<HTMLElement>) {
    return Array.from(event.dataTransfer.types).includes("Files");
  }

  function handleDragEnter(event: DragEvent<HTMLElement>) {
    if (isImporting || !hasDraggedFiles(event)) {
      return;
    }

    event.preventDefault();
    setIsDragActive(true);
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    if (isImporting || !hasDraggedFiles(event)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragActive(true);
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    if (
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return;
    }

    setIsDragActive(false);
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    if (isImporting) {
      return;
    }

    event.preventDefault();
    setIsDragActive(false);
    onBookFiles(Array.from(event.dataTransfer.files));
  }

  return (
    <section
      className={
        isDragActive
          ? "audiobook-import-panel audiobook-import-panel-drop-active"
          : "audiobook-import-panel"
      }
      aria-label="导入书稿"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
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
        <span>{isImporting ? "导入中" : "导入书稿"}</span>
        <input
          accept={AUDIOBOOK_FILE_ACCEPT}
          aria-label="导入听书书稿"
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
        {isDragActive
          ? "松开导入书稿"
          : (importMessage ?? `${segmentCount} 个朗读片段`)}
      </p>
    </section>
  );
}
