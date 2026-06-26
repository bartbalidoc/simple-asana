// Detect which project members are @mentioned in a comment body.
// Mentions are stored as plain "@Name" text (matching how the comment form
// inserts them and how richText.tsx highlights them), so we match each
// member's display name against the text. Longest names first so
// "@Sidney Smith" isn't shadowed by "@Sidney".

interface Member {
  id: string;
  name: string | null;
  email: string | null;
}

export function findMentionedMembers(body: string, members: Member[]): Member[] {
  if (!body) return [];
  const haystack = body.toLowerCase();
  const seen = new Set<string>();
  const out: Member[] = [];
  const sorted = [...members]
    .filter((m) => m.name)
    .sort((a, b) => (b.name?.length || 0) - (a.name?.length || 0));
  for (const m of sorted) {
    const needle = `@${(m.name as string).toLowerCase()}`;
    if (haystack.includes(needle) && !seen.has(m.id)) {
      seen.add(m.id);
      out.push(m);
    }
  }
  return out;
}
