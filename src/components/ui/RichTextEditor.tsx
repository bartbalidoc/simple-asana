"use client";

import { useRef, useState } from "react";
import { Markdown } from "./Markdown";
import {
  BoldIcon,
  HeadingIcon,
  HighlighterIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
} from "./icons";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  disabled?: boolean;
  id?: string;
  /** Accessible name for the textarea (a placeholder is not a label). */
  ariaLabel?: string;
}

// A toolbar-driven markdown editor with live preview. The toolbar inserts the
// markdown for the user (they never type syntax), and the preview uses the same
// XSS-safe <Markdown> renderer the rest of the app uses — so authored content
// can never inject markup. Reused wherever the app needs a rich text block.
export function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = 200,
  disabled = false,
  id,
  ariaLabel,
}: RichTextEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [tab, setTab] = useState<"write" | "preview">("write");

  // Splice `next` over value[from..to], then restore focus + a caret range
  // (selStart..selEnd measured within `next`, relative to `from`).
  const spliceRange = (
    from: number,
    to: number,
    next: string,
    selStart: number,
    selEnd: number
  ) => {
    const el = ref.current;
    if (!el) return;
    const updated = value.slice(0, from) + next + value.slice(to);
    onChange(updated);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = from + selStart;
      el.selectionEnd = from + selEnd;
    });
  };

  // Replace the current selection (inline markers).
  const replaceSelection = (next: string, selStart: number, selEnd: number) => {
    const el = ref.current;
    if (!el) return;
    spliceRange(el.selectionStart, el.selectionEnd, next, selStart, selEnd);
  };

  const selected = () => {
    const el = ref.current;
    if (!el) return "";
    return value.slice(el.selectionStart, el.selectionEnd);
  };

  // Wrap the selection with markers (bold/italic/highlight/code).
  const wrap = (marker: string, endMarker = marker, placeholder = "text") => {
    const sel = selected() || placeholder;
    const next = `${marker}${sel}${endMarker}`;
    // Select the inner text so the user can keep typing over the placeholder.
    replaceSelection(next, marker.length, marker.length + sel.length);
  };

  // Prefix each affected LINE (headings, list items). Markdown block markers
  // must sit at the start of a line, so we expand the selection out to whole
  // lines first — clicking with the caret anywhere on a line still works.
  const linePrefix = (prefix: string, placeholder = "text") => {
    const el = ref.current;
    if (!el) return;
    const s = el.selectionStart;
    const e = el.selectionEnd;
    const lineStart = s === 0 ? 0 : value.lastIndexOf("\n", s - 1) + 1;
    let lineEnd = value.indexOf("\n", e);
    if (lineEnd === -1) lineEnd = value.length;
    const block = value.slice(lineStart, lineEnd) || placeholder;
    const next = block
      .split("\n")
      .map((l) => `${prefix}${l}`)
      .join("\n");
    // Select the whole prefixed block so the user sees what changed.
    spliceRange(lineStart, lineEnd, next, 0, next.length);
  };

  const insertLink = () => {
    const sel = selected() || "link text";
    // Insert [text](https://) and drop the caret inside the URL, ready to paste.
    const next = `[${sel}](https://)`;
    const urlPos = sel.length + 3; // after "[sel]("
    replaceSelection(next, urlPos + "https://".length, urlPos + "https://".length);
  };

  const btn =
    "inline-flex items-center justify-center h-8 w-8 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:text-gray-300 disabled:hover:bg-transparent transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400";

  return (
    <div className="rounded-lg border border-gray-300 bg-white transition focus-within:border-red-400 focus-within:ring-2 focus-within:ring-red-100">
      {/* Toolbar */}
      <div className="flex items-center gap-1 flex-wrap border-b border-gray-100 px-1.5 py-1">
        <button type="button" className={btn} disabled={disabled || tab === "preview"} onClick={() => wrap("**")} title="Bold" aria-label="Bold">
          <BoldIcon size={15} />
        </button>
        <button type="button" className={btn} disabled={disabled || tab === "preview"} onClick={() => wrap("*")} title="Italic" aria-label="Italic">
          <ItalicIcon size={15} />
        </button>
        <button type="button" className={btn} disabled={disabled || tab === "preview"} onClick={() => wrap("==")} title="Highlight" aria-label="Highlight">
          <HighlighterIcon size={15} />
        </button>
        <span className="mx-0.5 h-5 w-px bg-gray-200" />
        <button type="button" className={btn} disabled={disabled || tab === "preview"} onClick={() => linePrefix("# ", "Heading")} title="Big heading" aria-label="Big heading">
          <HeadingIcon size={15} />
        </button>
        <button type="button" className={btn} disabled={disabled || tab === "preview"} onClick={() => linePrefix("## ", "Subheading")} title="Small heading" aria-label="Small heading">
          <HeadingIcon size={12} />
        </button>
        <span className="mx-0.5 h-5 w-px bg-gray-200" />
        <button type="button" className={btn} disabled={disabled || tab === "preview"} onClick={() => linePrefix("- ", "List item")} title="Bulleted list" aria-label="Bulleted list">
          <ListIcon size={15} />
        </button>
        <button type="button" className={btn} disabled={disabled || tab === "preview"} onClick={() => linePrefix("1. ", "List item")} title="Numbered list" aria-label="Numbered list">
          <ListOrderedIcon size={15} />
        </button>
        <button type="button" className={btn} disabled={disabled || tab === "preview"} onClick={insertLink} title="Insert link" aria-label="Insert link">
          <LinkIcon size={15} />
        </button>

        {/* Write / Preview toggle */}
        <div className="ml-auto flex rounded-md border border-gray-200 overflow-hidden text-[11px]">
          <button
            type="button"
            onClick={() => setTab("write")}
            aria-pressed={tab === "write"}
            className={`px-2 py-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 ${tab === "write" ? "bg-gray-800 text-white font-semibold" : "bg-white text-gray-500 hover:bg-gray-50"}`}
          >
            Write
          </button>
          <button
            type="button"
            onClick={() => setTab("preview")}
            aria-pressed={tab === "preview"}
            className={`px-2 py-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 ${tab === "preview" ? "bg-gray-800 text-white font-semibold" : "bg-white text-gray-500 hover:bg-gray-50"}`}
          >
            Preview
          </button>
        </div>
      </div>

      {tab === "write" ? (
        <textarea
          id={id}
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          disabled={disabled}
          className="block w-full bg-transparent p-3 text-sm resize-y focus:outline-none"
          style={{ minHeight }}
        />
      ) : (
        <div className="p-3 overflow-x-auto" style={{ minHeight }}>
          {value.trim() ? (
            <Markdown text={value} />
          ) : (
            <p className="text-sm text-gray-500">Nothing to preview yet.</p>
          )}
        </div>
      )}

      <div className="border-t border-gray-100 px-3 py-1.5 text-[11px] text-gray-500">
        Tip: select text, then click a button. <b>B</b> bold · <i>I</i> italic ·{" "}
        <span className="bg-yellow-100 text-yellow-900 rounded px-0.5">highlight</span> · headings ·
        lists · links.
      </div>
    </div>
  );
}
