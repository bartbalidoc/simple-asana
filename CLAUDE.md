# BaliDoc Project Hub — agent notes

- **Any UI/UX work**: read `PRODUCT.md` (who/why, register: product) and `DESIGN.md` (visual contract — colors, type, component vocabulary, bans) before designing or restyling anything. Converge existing code toward DESIGN.md.
- Design skills installed in `.claude/skills/`: `impeccable` (design/critique/polish framework — commands like `/impeccable critique|polish|audit <target>`) and `web-design-guidelines` (Vercel a11y/UX compliance checklist).
- Shared UI primitives live in `src/components/ui/` (Button, icons, Toast) — use them instead of hand-rolling.
- Release flow: bump `src/lib/releaseNotes.ts` (team-facing changelog at `/admin/release-notes`), run `node scripts/release-notes-md.mjs` (regenerates RELEASE_NOTES.md — never edit it by hand), commit, deploy with `./deploy.sh` (prod = DigitalOcean droplet; verify `curl http://206.189.200.138:3000/login` → 200).
