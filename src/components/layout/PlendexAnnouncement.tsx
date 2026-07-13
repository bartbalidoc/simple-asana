"use client";

import { useEffect, useState } from "react";
import { PlendexLogo } from "@/components/brand/PlendexLogo";
import { CloseIcon } from "@/components/ui/icons";

const STORAGE_KEY = "plendex-rename-seen";

// One-time announcement of the app's new name (shown until dismissed, per
// browser). Deliberately quiet: one line, no modal, never blocks work.
export function PlendexAnnouncement() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      /* private mode etc. — just skip the banner */
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  if (!visible) return null;

  return (
    <div className="flex items-center gap-3 bg-red-50 border-b border-red-100 px-4 sm:px-6 py-2.5">
      <PlendexLogo size={22} showText={false} />
      <p className="flex-1 min-w-0 text-sm text-red-900">
        <span className="font-semibold">Our project hub has a name: Plendex.</span>{" "}
        <span className="text-red-700">
          Same app, same work, same login — new badge. Still proudly by BaliDoc.
        </span>
      </p>
      <button
        onClick={dismiss}
        className="flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-red-400 hover:text-red-700 hover:bg-red-100 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        title="Dismiss"
        aria-label="Dismiss announcement"
      >
        <CloseIcon size={14} />
      </button>
    </div>
  );
}
