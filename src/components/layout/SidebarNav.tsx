"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ProjectSidebarList } from "./ProjectSidebarList";
import { PlusIcon, BoardIcon, UsersIcon, SparklesIcon, ArrowUpIcon } from "@/components/ui/icons";

function NavLink({
  href,
  label,
  icon,
  exact = false,
}: {
  href: string;
  label: string;
  icon?: React.ReactNode;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 py-2 px-3 rounded-lg text-sm font-medium transition ${
        active
          ? "bg-red-50 text-red-700"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}

const HomeIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const FolderIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const ClockIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15 14" />
  </svg>
);

const MegaphoneIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11l14-6v14L3 13z" />
    <path d="M7 12v5a2 2 0 0 0 4 0v-3" />
  </svg>
);

export function SidebarNav({ isAdmin }: { isAdmin: boolean }) {
  return (
    <nav className="p-3 space-y-0.5 overflow-y-auto flex-1">
      <NavLink href="/dashboard" label="Dashboard" icon={HomeIcon} exact />
      <NavLink href="/projects" label="Projects" icon={FolderIcon} exact />
      <ProjectSidebarList />
      {isAdmin && (
        <Link
          href="/projects"
          className="flex items-center gap-1.5 py-1.5 pl-7 pr-3 text-xs text-gray-400 rounded-lg hover:bg-gray-100 hover:text-red-700 transition"
        >
          <PlusIcon size={13} /> New project
        </Link>
      )}

      {/* AI: meeting transcript → tasks (feedback #6) — available to everyone */}
      <NavLink href="/transcript" label="Meeting → Tasks" icon={<SparklesIcon size={16} />} />

      {isAdmin && (
        <>
          <div className="px-3 pt-4 pb-1 text-[10px] font-semibold tracking-widest text-gray-400 uppercase">
            Admin
          </div>
          <NavLink href="/admin/activity" label="Activity" icon={<ArrowUpIcon size={16} />} />
          <NavLink href="/admin/staging" label="Staging (Asana import)" icon={<BoardIcon size={16} />} />
          <NavLink href="/admin/users" label="Users" icon={<UsersIcon size={16} />} />
          <NavLink href="/admin/audit-log" label="Audit Log" icon={ClockIcon} />
          <NavLink href="/admin/feedback" label="Feedback" icon={<SparklesIcon size={16} />} />
          <NavLink href="/admin/release-notes" label="Release Notes" icon={MegaphoneIcon} />
        </>
      )}
    </nav>
  );
}
