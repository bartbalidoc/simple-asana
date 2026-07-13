import { RELEASES, type ReleaseItemType } from "@/lib/releaseNotes";

// Admin-only (guarded by src/app/(app)/admin/layout.tsx). Read-only changelog of
// what's shipped, sourced from src/lib/releaseNotes.ts.

const BADGE: Record<ReleaseItemType, { label: string; className: string }> = {
  new: { label: "New", className: "bg-green-100 text-green-700" },
  improved: { label: "Improved", className: "bg-blue-100 text-blue-700" },
  fixed: { label: "Fixed", className: "bg-amber-100 text-amber-700" },
};

function formatDate(iso: string): string {
  // Deterministic, locale-independent (avoids server/client hydration drift).
  const [y, m, d] = iso.split("-").map(Number);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[(m || 1) - 1]} ${d}, ${y}`;
}

export default function ReleaseNotesPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Release Notes</h1>
        <p className="text-sm text-gray-500 mt-1">
          What&apos;s new in Plendex. Newest updates first.
        </p>
      </div>

      <div className="space-y-8">
        {RELEASES.map((release) => (
          <section key={release.version} className="border border-gray-200 rounded-xl overflow-hidden">
            <header className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex items-baseline justify-between">
              <div>
                <span className="text-sm font-semibold text-gray-900">{release.title}</span>
                <span className="ml-2 text-xs text-gray-400">v{release.version}</span>
              </div>
              <span className="text-xs text-gray-500">{formatDate(release.date)}</span>
            </header>
            <ul className="divide-y divide-gray-100">
              {release.items.map((item, i) => {
                const badge = BADGE[item.type];
                return (
                  <li key={i} className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                      <span className="text-sm font-medium text-gray-900">{item.title}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{item.detail}</p>
                    {item.requestedBy && (
                      <p className="text-xs text-gray-400 mt-1">Requested by {item.requestedBy}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
