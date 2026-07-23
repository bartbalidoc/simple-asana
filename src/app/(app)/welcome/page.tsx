"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Markdown } from "@/components/ui/Markdown";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { PencilIcon } from "@/components/ui/icons";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

const INTRO_KEY = "welcome.intro";

// Only ever treat http(s) values as clickable hrefs. A stored "javascript:" or
// "data:" URL must never become an <a href> — it would run in every teammate's
// browser (stored XSS). Anything else is treated as "not a link".
const safeHref = (u: string | undefined): string =>
  u && /^https?:\/\//i.test(u.trim()) ? u.trim() : "";

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
  const toast = useToast();
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const firstName = session?.user?.name?.split(" ")[0] || "there";

  const [links, setLinks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Rich intro block (Sidney's request): an admin-authored onboarding doc.
  const [editingIntro, setEditingIntro] = useState(false);
  const [introDraft, setIntroDraft] = useState("");
  const [savingIntro, setSavingIntro] = useState(false);
  const intro = links[INTRO_KEY] || "";

  useEffect(() => {
    fetch("/api/settings?prefix=welcome.")
      .then((r) => (r.ok ? r.json() : {}))
      .then(setLinks)
      .catch(() => setLinks({}))
      .finally(() => setLoading(false));
  }, []);

  const startEditIntro = () => {
    setIntroDraft(intro);
    setEditingIntro(true);
  };

  const saveIntro = async () => {
    setSavingIntro(true);
    // Mirror the server's cap so local state matches what's actually stored
    // (no divergence-until-reload for very long notes).
    const toStore = introDraft.slice(0, 20000);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: INTRO_KEY, value: toStore }),
      });
      if (!res.ok) throw new Error("save failed");
      setLinks((prev) => ({ ...prev, [INTRO_KEY]: toStore }));
      setEditingIntro(false);
      toast("Onboarding notes saved");
    } catch {
      // Keep the editor open so the draft isn't lost, and say so.
      toast("Couldn't save the notes — please try again.", "error");
    } finally {
      setSavingIntro(false);
    }
  };

  const editLink = async (key: string, title: string) => {
    const current = links[key] || "";
    const raw = window.prompt(`Link for “${title}” (must start with https://):`, current);
    if (raw === null) return;
    const url = raw.trim();
    // Reject anything that isn't a real web link (blocks javascript:/data: etc).
    if (url !== "" && !/^https?:\/\//i.test(url)) {
      toast("Please use a link that starts with https://", "error");
      return;
    }
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value: url }),
    }).catch(() => {});
    setLinks((prev) => ({ ...prev, [key]: url }));
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

      {/* Rich intro block — admin-authored onboarding notes (Sidney's request).
          Everyone sees the formatted text; admins get an editor. */}
      {editingIntro ? (
        <div className="mb-6">
          <RichTextEditor
            id="welcome-intro-editor"
            ariaLabel="Onboarding notes for the team"
            value={introDraft}
            onChange={setIntroDraft}
            disabled={savingIntro}
            minHeight={220}
            placeholder="Write onboarding notes for the team… Use the toolbar for headings, bold, lists and links."
          />
          <div className="flex gap-2 mt-2">
            <Button onClick={saveIntro} variant="primary" size="sm" disabled={savingIntro}>
              {savingIntro ? "Saving…" : "Save notes"}
            </Button>
            <Button
              onClick={() => setEditingIntro(false)}
              variant="subtle"
              size="sm"
              disabled={savingIntro}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : intro.trim() ? (
        <div className="relative group mb-6 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <Markdown text={intro} className="text-sm text-gray-700 leading-relaxed space-y-1" />
          {isAdmin && (
            <button
              onClick={startEditIntro}
              className="absolute top-3 right-3 inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 bg-white/90 rounded-md px-1.5 py-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              title="Edit these notes (admin)"
            >
              <PencilIcon size={13} /> Edit
            </button>
          )}
        </div>
      ) : isAdmin && !loading ? (
        <button
          onClick={startEditIntro}
          className="w-full mb-6 flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-red-600 bg-white rounded-2xl border border-dashed border-gray-300 hover:border-red-300 p-5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        >
          <PencilIcon size={15} /> Add onboarding notes for the team
        </button>
      ) : null}

      {/* Module cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CARDS.map((card) => {
          const url = safeHref(links[card.key]);
          const inner = (
            <>
              <div className="text-3xl mb-3">{card.icon}</div>
              <h2 className="text-base font-bold text-gray-900 mb-1">{card.title}</h2>
              <p className="text-sm text-gray-500">{card.blurb}</p>
              <div className="mt-3 text-xs font-semibold">
                {url ? (
                  <span className="text-red-600 group-hover:underline">Open module →</span>
                ) : (
                  <span className="text-gray-500">
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
                  className="absolute top-3 right-3 inline-flex items-center gap-1 text-xs text-gray-300 hover:text-red-600 bg-white/80 rounded-md px-1.5 py-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                  title="Set the link for this module (admin)"
                >
                  <PencilIcon size={12} /> Link
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
