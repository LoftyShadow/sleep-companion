import { useEffect, useId, useRef, useState } from "react";
import "./InlinePicker.css";

export interface InlinePickerOption {
  id: string;
  title: string;
  meta: string;
}

interface InlinePickerProps {
  ariaLabel: string;
  listAriaLabel: string;
  options: InlinePickerOption[];
  selectedOptionId: string | null;
  selectedTitle: string;
  selectedMeta: string;
  onSelect: (optionId: string) => void;
}

const CHEVRON_ICON = (
  <svg className="inline-picker-chevron" viewBox="0 0 24 24" aria-hidden="true">
    <path d="m7 9 5 5 5-5" />
  </svg>
);

export function InlinePicker({
  ariaLabel,
  listAriaLabel,
  options,
  selectedOptionId,
  selectedTitle,
  selectedMeta,
  onSelect,
}: InlinePickerProps) {
  const listId = useId();
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !pickerRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function handleSelect(optionId: string) {
    setIsOpen(false);
    onSelect(optionId);
  }

  return (
    <div className="inline-picker" ref={pickerRef}>
      <button
        aria-controls={listId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className="inline-picker-button"
        type="button"
        onClick={() => {
          setIsOpen((currentIsOpen) => !currentIsOpen);
        }}
      >
        <span className="inline-picker-text">
          <span className="inline-picker-title">{selectedTitle}</span>
          <span className="inline-picker-meta">{selectedMeta}</span>
        </span>
        {CHEVRON_ICON}
      </button>

      {isOpen ? (
        <div
          className="inline-picker-option-list"
          id={listId}
          role="listbox"
          aria-label={listAriaLabel}
        >
          {options.map((option, index) => {
            const isSelected = option.id === selectedOptionId;

            return (
              <button
                aria-selected={isSelected}
                className={`inline-picker-option${
                  isSelected ? " inline-picker-option-selected" : ""
                }`}
                key={option.id}
                role="option"
                type="button"
                onClick={() => {
                  handleSelect(option.id);
                }}
              >
                <span className="inline-picker-option-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="inline-picker-option-text">
                  <span className="inline-picker-option-title">
                    {option.title}
                  </span>
                  <span className="inline-picker-option-meta">
                    {option.meta}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
