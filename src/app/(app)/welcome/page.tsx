"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

// Welcome Hub (Sidney's onboarding request): a visual landing page for new
// team members with cards linking to the training handbooks. Card links are
// admin-editable (stored in AppSetting, "welcome.*" keys) so the handbooks
// can live anywhere — Google Docs, Drive, Notion, PDFs.

const CARDS = [
  {
    key: "welcome.techstack",
    icon: "🌐",
    title: "The Tech Stack Map",
    blurb: "How our systems fit together — the tools you'll touch every day and what each one is for.",
  },
  {
    key: "welcome.compliance",
    icon: "🛡️",
    title: "Compliance & Privacy Guardrails",
    blurb: "Patient privacy, ID encryption and data rules. Mandatory reading for everyone, no exceptions.",
  },
  {
    key: "welcome.doctor",
    icon: "🩺",
    title: "The Doctor's Clinical Guide",
    blurb: "Handbook A — portal walkthroughs, EMR, and the refill pathway rules for clinical staff.",
  },
  {
    key: "welcome.bso",
    icon: "🚀",
    title: "The BSO Execution Guide",
    blurb: "Handbook B — booking management, ID verification, and the troubleshooting matrices.",
  },
];

export default function WelcomeHubPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const firstName = session?.user?.name?.split(" ")[0] || "there";

  const [links, setLinks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings?prefix=welcome.")
      .then((r) => (r.ok ? r.json() : {}))
      .then(setLinks)
      .catch(() => setLinks({}))
      .finally(() => setLoading(false));
  }, []);

  const editLink = async (key: string, title: string) => {
    const current = links[key] || "";
    const url = window.prompt(`Link for “${title}” (Google Doc, Drive, PDF…):`, current);
    if (url === null) return;
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value: url.trim() }),
    }).catch(() => {});
    setLinks((prev) => ({ ...prev, [key]: url.trim() }));
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header banner */}
      <div className="rounded-2xl bg-gradient-to-br from-rose-500 via-red-600 to-red-700 text-white p-8 sm:p-10 mb-6 relative overflow-hidden">
        <div className="absolute -right-6 -top-6 text-[120px] opacity-15 select-none" aria-hidden>
          🌴
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold leading-tight">
          Welcome to the BaliDoc team, {firstName}! 🌴
        </h1>
        <p className="mt-2 text-white/85 max-w-xl text-sm sm:text-base">
          Let&apos;s get you set up for success. Click a module below to explore your
          training playground — start with Compliance, it&apos;s the one everybody does first.
        </p>
      </div>

      {/* Module cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CARDS.map((card) => {
          const url = links[card.key];
          const inner = (
            <>
              <div className="text-3xl mb-3">{card.icon}</div>
              <h2 className="text-base font-bold text-gray-900 mb-1">{card.title}</h2>
              <p className="text-sm text-gray-500">{card.blurb}</p>
              <div className="mt-3 text-xs font-semibold">
                {url ? (
                  <span className="text-red-600 group-hover:underline">Open module →</span>
                ) : (
                  <span className="text-gray-300">
                    {loading ? "…" : "Link not set up yet"}
                  </span>
                )}
              </div>
            </>
          );
          return (
            <div key={card.key} className="relative group">
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block h-full bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-md hover:border-red-200 transition"
                >
                  {inner}
                </a>
              ) : (
                <div className="h-full bg-white rounded-2xl border border-dashed border-gray-200 p-6 opacity-80">
                  {inner}
                </div>
              )}
              {isAdmin && (
                <button
                  onClick={() => editLink(card.key, card.title)}
                  className="absolute top-3 right-3 text-xs text-gray-300 hover:text-red-600 bg-white/80 rounded px-1.5 py-0.5 transition"
                  title="Set the link for this module (admin)"
                >
                  ✏️ edit
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-gray-400 text-center">
        Lost? You can always come back here via “Welcome Hub” in the sidebar. Questions →
        ask anyone, we like questions.
      </p>
    </div>
  );
}
