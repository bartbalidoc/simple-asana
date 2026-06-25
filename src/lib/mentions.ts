export interface Mentionable {
  id: string;
  name: string;
  email?: string | null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Returns the ids of the people @mentioned in `text`, matched against the
 * given list of candidates. Mirrors the comment box's autocomplete, which
 * inserts "@Full Name " — so multi-word names are supported.
 *
 * Longest names are matched first and the matched span is consumed, so
 * "@Sidney Smith" does not also count as a mention of a separate "Sidney".
 */
export function findMentionedUserIds(
  text: string,
  candidates: Mentionable[]
): string[] {
  if (!text) return [];

  const found = new Set<string>();
  const sorted = [...candidates]
    .filter((c) => c.name)
    .sort((a, b) => b.name.length - a.name.length);

  let work = text;
  for (const c of sorted) {
    // "@Name" where the @ starts a token (line start or non-word, but not an
    // email's "@") and the name is followed by a word boundary.
    const re = new RegExp(
      `(^|[^\\w@])(@${escapeRegExp(c.name)})(?=$|[^\\w])`,
      "gi"
    );
    const before = work;
    work = work.replace(re, (full, pre) => pre + " ".repeat(full.length - pre.length));
    if (work !== before) found.add(c.id);
  }

  return Array.from(found);
}
