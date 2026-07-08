"use client";

import { useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  type: string;
  actorName: string | null;
  message: string;
  taskId: string | null;
  projectId: string | null;
  readAt: string | null;
  createdAt: string;
}

const TYPE_ICONS: Record<string, string> = {
  COMMENT: "💬",
  MENTION: "👋",
  STATUS: "🔄",
  ASSIGNED: "📌",
  UPDATE: "✏️",
};

// Filter chips (feedback: "I want to be able to filter my notifications").
const FILTERS: { key: string; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "MENTION", label: "👋 Mentions" },
  { key: "ASSIGNED", label: "📌 Assigned" },
  { key: "COMMENT", label: "💬 Comments" },
  { key: "STATUS", label: "🔄 Status" },
];

// Header bell: unread badge + dropdown. Clicking a notification marks it read
// and deep-links straight to the task (feedback: no more manual searching).
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const panelRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setUnread(data.unread || 0);
      setItems(Array.isArray(data.notifications) ? data.notifications : []);
    } catch {
      /* ignore — polling will retry */
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000); // light poll; also refreshed on open
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close when clicking anywhere outside the panel.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      await load();
      setLoading(false);
    }
  };

  const openNotification = async (n: Notification) => {
    fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: n.id }),
    }).catch(() => {});
    if (n.projectId && n.taskId) {
      // Full navigation so the board opens the task even from the same page.
      window.location.assign(`/projects/${n.projectId}?task=${n.taskId}`);
    } else if (n.projectId) {
      window.location.assign(`/projects/${n.projectId}`);
    } else {
      setOpen(false);
    }
  };

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    }).catch(() => {});
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={toggle}
        className="relative p-2 rounded-full hover:bg-gray-100 transition"
        title="Notifications"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
      >
        <span className="text-lg leading-none">🔔</span>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-w-[90vw] bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-red-600 hover:underline">
                Mark all read
              </button>
            )}
          </div>

          {/* Filter chips */}
          <div className="flex gap-1 px-3 py-2 border-b border-gray-50 overflow-x-auto">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`text-[11px] px-2 py-1 rounded-full whitespace-nowrap transition ${
                  filter === f.key
                    ? "bg-red-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="p-4 text-sm text-gray-400">Loading…</div>
            ) : items.filter((n) => filter === "ALL" || n.type === filter).length === 0 ? (
              <div className="p-6 text-sm text-gray-400 text-center">
                {filter === "ALL"
                  ? "Nothing yet — task updates and mentions will show up here."
                  : "No notifications of this type."}
              </div>
            ) : (
              items
                .filter((n) => filter === "ALL" || n.type === filter)
                .map((n) => (
                <button
                  key={n.id}
                  onClick={() => openNotification(n)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition flex gap-2.5 ${
                    n.readAt ? "opacity-60" : "bg-red-50/40"
                  }`}
                >
                  <span className="text-base leading-tight">{TYPE_ICONS[n.type] || "🔔"}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] text-gray-800 leading-snug">{n.message}</span>
                    <span className="block text-[11px] text-gray-400 mt-0.5">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </span>
                  </span>
                  {!n.readAt && <span className="mt-1 h-2 w-2 rounded-full bg-red-500 flex-shrink-0" />}
                  </button>
                ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
