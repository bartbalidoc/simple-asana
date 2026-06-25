import React from "react";

// Matches absolute URLs and bare www. links. Mentions are added per-call
// because they depend on the known team-member names.
const URL_SOURCES = ["https?:\\/\\/[^\\s]+", "www\\.[^\\s]+"];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Renders plain comment text as React nodes with clickable links and
 * highlighted @mentions. This intentionally avoids dangerouslySetInnerHTML:
 * every segment is a plain string or a React element, so user text can never
 * inject markup. Pass the team's display names so multi-word mentions
 * (e.g. "@Sidney Smith") highlight correctly; unknown @handles still match a
 * generic fallback.
 */
export function renderRichText(
  text: string,
  mentionNames: string[] = []
): React.ReactNode[] {
  if (!text) return [];

  // Longest names first so "@Sidney Smith" wins over "@Sidney".
  const names = Array.from(new Set(mentionNames.filter(Boolean)))
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp);

  const sources = [...URL_SOURCES];
  if (names.length) sources.push(`@(?:${names.join("|")})`);
  sources.push("@[A-Za-z0-9_][A-Za-z0-9_.-]*");

  const re = new RegExp(`(${sources.join("|")})`, "g");

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const token = match[0];
    const start = match.index;

    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }

    if (token.startsWith("@")) {
      nodes.push(
        <span
          key={key++}
          className="font-medium text-red-600 bg-red-50 rounded px-0.5"
        >
          {token}
        </span>
      );
    } else {
      // Peel trailing punctuation so "see http://x.com." doesn't swallow the period.
      let url = token;
      let trailing = "";
      const punct = url.match(/[.,;:!?)\]}'"]+$/);
      if (punct) {
        trailing = punct[0];
        url = url.slice(0, -trailing.length);
      }
      const href = url.startsWith("http") ? url : `https://${url}`;
      nodes.push(
        <a
          key={key++}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline break-all hover:text-blue-700"
        >
          {url}
        </a>
      );
      if (trailing) nodes.push(trailing);
    }

    lastIndex = start + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}
