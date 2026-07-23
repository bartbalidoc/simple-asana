"use client";

import React from "react";

// Minimal markdown renderer for task descriptions + the Welcome Hub (feedback:
// lists, bold, italic, headings, links, highlight with a proper preview).
// Renders React elements — never raw HTML — so authored content cannot inject
// markup. Links are constrained to https?:// (no javascript: URLs). Supported:
// **bold**, *italic*, `code`, ==highlight==, [links](https://…), # headings,
// - / 1. lists, paragraphs.

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  // Tokenize bold / italic / code / highlight / links, left to right.
  const pattern =
    /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|==([^=]+)==|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyBase}-${i++}`;
    if (m[2] !== undefined) out.push(<strong key={key}>{renderInline(m[2], key)}</strong>);
    else if (m[3] !== undefined) out.push(<em key={key}>{renderInline(m[3], key)}</em>);
    else if (m[4] !== undefined)
      out.push(
        <code key={key} className="bg-gray-100 rounded px-1 py-0.5 text-[0.9em]">
          {m[4]}
        </code>
      );
    // ==highlight== — a fixed marker style (no arbitrary color, so no CSS
    // injection). Covers "emphasis / coloring" for onboarding docs safely.
    else if (m[5] !== undefined)
      out.push(
        <mark key={key} className="bg-yellow-100 text-yellow-900 rounded px-0.5">
          {renderInline(m[5], key)}
        </mark>
      );
    else if (m[6] !== undefined)
      out.push(
        <a
          key={key}
          href={m[7]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-red-600 hover:underline break-all"
        >
          {m[6]}
        </a>
      );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const lines = (text || "").split("\n");
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: React.ReactNode[] } | null = null;

  const flushList = (key: string) => {
    if (!list) return;
    const cls = "my-1 pl-5 space-y-0.5 " + (list.ordered ? "list-decimal" : "list-disc");
    blocks.push(
      list.ordered ? (
        <ol key={key} className={cls}>
          {list.items}
        </ol>
      ) : (
        <ul key={key} className={cls}>
          {list.items}
        </ul>
      )
    );
    list = null;
  };

  lines.forEach((line, idx) => {
    const key = `l${idx}`;
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const heading = line.match(/^(#{1,3})\s+(.*)$/);

    if (bullet || numbered) {
      const ordered = !!numbered;
      const content = (bullet || numbered)![1];
      if (!list || list.ordered !== ordered) {
        flushList(`${key}-flush`);
        list = { ordered, items: [] };
      }
      list.items.push(<li key={key}>{renderInline(content, key)}</li>);
      return;
    }
    flushList(`${key}-flush`);

    if (heading) {
      const level = heading[1].length;
      const sizes = ["text-base font-bold", "text-[15px] font-bold", "text-sm font-bold"];
      blocks.push(
        <p key={key} className={`${sizes[level - 1]} mt-2 mb-0.5`}>
          {renderInline(heading[2], key)}
        </p>
      );
    } else if (line.trim() === "") {
      blocks.push(<div key={key} className="h-2" />);
    } else {
      blocks.push(<p key={key}>{renderInline(line, key)}</p>);
    }
  });
  flushList("tail-flush");

  return <div className={className || "text-sm text-gray-700 leading-relaxed"}>{blocks}</div>;
}
