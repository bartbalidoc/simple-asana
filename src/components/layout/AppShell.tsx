"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SidebarNav } from "./SidebarNav";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationBell } from "./NotificationBell";
import { SignOutButton } from "./SignOutButton";
import { BaliDocLogo } from "@/components/brand/BaliDocLogo";

// Responsive app chrome. Desktop (lg+): the classic fixed sidebar. Small
// screens: the sidebar becomes a slide-in drawer behind a hamburger, the
// header keeps search + notifications, and sign-out moves into the drawer.
export function AppShell({
  isAdmin,
  email,
  children,
}: {
  isAdmin: boolean;
  email: string;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  // Navigating closes the drawer.
  useEffect(() => setDrawerOpen(false), [pathname]);

  // Escape closes it; the page behind doesn't scroll while it's open.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const sidebarInner = (
    <>
      <div className="px-5 py-5 border-b border-gray-100">
        <BaliDocLogo size={34} showText />
      </div>
      <SidebarNav isAdmin={isAdmin} />
      {/* On phones the drawer is also where your account lives. */}
      <div className="lg:hidden border-t border-gray-100 p-4 space-y-3">
        <p className="text-xs text-gray-500 truncate" title={email}>
          {email}
        </p>
        <SignOutButton />
      </div>
      <div className="p-4 border-t border-gray-100 text-[10px] text-gray-400 tracking-wide">
        YOUR HEALTH · OUR PRIORITY
      </div>
    </>
  );

  return (
    // 100dvh (where supported) keeps the layout stable under mobile browser bars.
    <div className="flex h-screen [height:100dvh] bg-gray-50">
      {/* Static sidebar — desktop only */}
      <div className="hidden lg:flex w-64 bg-white border-r border-gray-200 flex-col">
        {sidebarInner}
      </div>

      {/* Drawer — small screens */}
      <div
        className={`fixed inset-0 z-50 lg:hidden ${drawerOpen ? "" : "pointer-events-none"}`}
        aria-hidden={!drawerOpen}
      >
        <div
          onClick={() => setDrawerOpen(false)}
          className={`absolute inset-0 bg-gray-900/40 backdrop-blur-[2px] transition-opacity duration-200 motion-reduce:transition-none ${
            drawerOpen ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          role="dialog"
          aria-label="Navigation"
          className={`absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-2xl flex flex-col transition-transform duration-200 ease-out motion-reduce:transition-none ${
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="h-1 bg-gradient-to-r from-rose-500 via-red-600 to-red-700 flex-shrink-0" />
          {sidebarInner}
        </div>
      </div>

      {/* Main column */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="bg-white border-b border-gray-200">
          <div className="h-1 bg-gradient-to-r from-rose-500 via-red-600 to-red-700" />
          <div className="px-3 sm:px-6 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden -ml-1 p-2.5 rounded-lg text-gray-600 hover:bg-gray-100 transition"
              aria-label="Open menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className="flex-1 max-w-md min-w-0">
              <GlobalSearch />
            </div>
            <div className="flex items-center gap-1.5 sm:gap-4 flex-shrink-0">
              <NotificationBell />
              <span className="hidden md:inline text-sm text-gray-600">
                {email}
                {isAdmin && (
                  <span className="ml-2 text-[10px] font-bold uppercase bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                    Admin
                  </span>
                )}
              </span>
              <span className="hidden lg:block">
                <SignOutButton />
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
