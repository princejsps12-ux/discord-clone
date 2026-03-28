import { useRef, type FormEvent, type ChangeEvent } from "react";
import { Plus, Smile, Gift, ArrowUp, Paperclip } from "lucide-react";
import type { MessageCategory } from "../types";
import { ui, st, type AppLocale } from "../content/hinglish";
import s from "./MessageInput.module.css";

type Props = {
  channelName?: string;
  messageText: string;
  onTyping: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  selectedFile: File | null;
  onSelectFile: (e: ChangeEvent<HTMLInputElement>) => void;
  onClearFile: () => void;
  uploading: boolean;
  messageSendCategory: MessageCategory | "UNCATEGORIZED";
  onSetCategory: (c: MessageCategory | "UNCATEGORIZED") => void;
  typingUser: string | null;
  locale: AppLocale;
  disabled?: boolean;
};

export function MessageInput({
  channelName,
  messageText,
  onTyping,
  onSubmit,
  selectedFile,
  onSelectFile,
  onClearFile,
  uploading,
  messageSendCategory,
  onSetCategory,
  typingUser,
  locale,
  disabled = false,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const placeholder = disabled
    ? ui.selectChannelFirst
    : channelName
      ? `Message #${channelName}`
      : ui.messagePlaceholder;

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    onTyping(e.target.value);
    autoResize();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!messageText.trim() && !selectedFile) return;
      onSubmit(e as unknown as FormEvent);
      // Reset height after send
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  }

  const canSend = (messageText.trim().length > 0 || !!selectedFile) && !uploading;

  return (
    <div className={s.wrap}>
      {/* File preview */}
      {selectedFile && (
        <div className={s.filePreview}>
          <Paperclip size={12} style={{ flexShrink: 0, color: "var(--text-3)" }} />
          <span className={s.filePreviewName}>{selectedFile.name}</span>
          <button
            type="button"
            className={s.filePreviewRemove}
            onClick={onClearFile}
            title="Remove file"
          >
            ×
          </button>
        </div>
      )}

      {/* Category selector */}
      <div className={s.categoryRow}>
        <span className={s.categoryLabel}>{st(locale, "categoryLabel")}:</span>
        <select
          className={s.categorySelect}
          value={messageSendCategory}
          onChange={(e) => onSetCategory(e.target.value as MessageCategory | "UNCATEGORIZED")}
          disabled={disabled}
        >
          <option value="UNCATEGORIZED">Auto</option>
          <option value="STUDY">Study</option>
          <option value="PLACEMENT">Placement</option>
          <option value="CASUAL">Casual</option>
        </select>
      </div>

      {/* Pill bar */}
      <form onSubmit={onSubmit}>
        <div className={s.bar}>
          {/* Attach */}
          <button
            type="button"
            className={s.sideBtn}
            title="Attach file"
            disabled={disabled || uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Plus size={18} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: "none" }}
            onChange={onSelectFile}
            disabled={disabled || uploading}
          />

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            className={s.textarea}
            rows={1}
            value={messageText}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || uploading}
          />

          {/* Emoji */}
          <button
            type="button"
            className={s.sideBtn}
            title="Emoji"
            disabled={disabled}
          >
            <Smile size={18} />
          </button>

          {/* Gift */}
          <button
            type="button"
            className={s.sideBtn}
            title="Gift"
            disabled={disabled}
          >
            <Gift size={18} />
          </button>

          {/* Send */}
          <button
            type="submit"
            className={`${s.sendBtn} ${uploading ? s.uploading : ""}`}
            disabled={!canSend}
            title={ui.send}
          >
            {uploading ? (
              <span className={s.spinner} />
            ) : (
              <ArrowUp size={16} strokeWidth={2.5} />
            )}
          </button>
        </div>
      </form>

      {/* Typing indicator */}
      <div className={s.typingRow}>
        {typingUser ? (
          <>
            <span className={s.dots} aria-hidden>
              <span className={s.dot} />
              <span className={s.dot} />
              <span className={s.dot} />
            </span>
            <span className={s.typingText}>
              <strong style={{ color: "var(--text-2)", fontWeight: 600 }}>{typingUser}</strong>
              {" "}{ui.typing}
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}
