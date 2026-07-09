"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { formatDistanceToNow } from "date-fns";
import { renderRichText } from "@/lib/richText";
import { FileIcon, SmilePlusIcon } from "@/components/ui/icons";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface Member {
  id: string;
  name: string;
  email?: string;
}

interface CommentListProps {
  taskId: string;
  comments?: Comment[];
  members?: Member[];
  onChanged?: () => void;
}

interface Reaction {
  id: string;
  userId: string;
  emoji: string;
}
interface CommentAttachment {
  id: string;
  fileName: string;
  mimeType: string;
}
interface Comment {
  id: string;
  bodyEnc?: string;
  body?: string;
  createdAt: string;
  updatedAt?: string;
  authorId?: string;
  author: {
    id: string;
    name: string;
    email: string;
  };
  reactions?: Reaction[];
  attachments?: CommentAttachment[];
}

const REACTION_EMOJI = ["👍", "❤️", "😂", "🎉", "👀", "✅"];

export function CommentList({
  taskId,
  comments: externalComments,
  members = [],
  onChanged,
}: CommentListProps) {
  const { data: session } = useSession();
  const currentUserId = (session?.user as any)?.id as string | undefined;
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  const [comments, setComments] = useState<Comment[]>(externalComments || []);
  const [loading, setLoading] = useState(!externalComments);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mentionNames = members.map((m) => m.name);

  useEffect(() => {
    if (externalComments) {
      setComments(externalComments);
      setLoading(false);
      return;
    }

    const fetchComments = async () => {
      try {
        const response = await fetch(`/api/tasks/${taskId}/comments`);
        if (response.ok) {
          const data = await response.json();
          setComments(data);
        }
      } catch (err) {
        console.error("Failed to fetch comments:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchComments();
  }, [taskId, externalComments]);

  const canModerate = (comment: Comment) => {
    const authorId = comment.authorId || comment.author?.id;
    return isAdmin || (!!currentUserId && authorId === currentUserId);
  };

  const wasEdited = (comment: Comment) =>
    comment.updatedAt &&
    new Date(comment.updatedAt).getTime() - new Date(comment.createdAt).getTime() > 1000;

  const startEdit = (comment: Comment) => {
    setError(null);
    setEditingId(comment.id);
    setEditBody(comment.body || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditBody("");
  };

  const saveEdit = async (commentId: string) => {
    if (!editBody.trim()) {
      setError("Comment cannot be empty");
      return;
    }

    setBusyId(commentId);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${taskId}/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: editBody }),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || "Failed to update comment");
      }
      const updated = await response.json();
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, ...updated } : c))
      );
      cancelEdit();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update comment");
    } finally {
      setBusyId(null);
    }
  };

  // Toggle an emoji reaction (Gabriel's request) — optimistic update.
  const toggleReaction = async (comment: Comment, emoji: string) => {
    if (!currentUserId) return;
    const mine = (comment.reactions || []).find(
      (r) => r.userId === currentUserId && r.emoji === emoji
    );
    setComments((prev) =>
      prev.map((c) =>
        c.id !== comment.id
          ? c
          : {
              ...c,
              reactions: mine
                ? (c.reactions || []).filter((r) => r.id !== mine.id)
                : [
                    ...(c.reactions || []),
                    { id: `tmp-${Date.now()}`, userId: currentUserId, emoji },
                  ],
            }
      )
    );
    await fetch(`/api/tasks/${taskId}/comments/${comment.id}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    }).catch(() => {});
  };

  const [pickerFor, setPickerFor] = useState<string | null>(null);

  // Styled confirm for comment deletion (replaces window.confirm).
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const deleteComment = async (commentId: string) => {
    setConfirmDeleteId(null);
    setBusyId(commentId);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${taskId}/comments/${commentId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || "Failed to delete comment");
      }
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete comment");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    // Skeleton rows: content arrives in place instead of a text flash.
    return (
      <div className="space-y-3 mb-4" aria-hidden="true">
        {[0, 1].map((i) => (
          <div key={i} className="bg-gray-50 rounded p-3 animate-pulse motion-reduce:animate-none">
            <div className="h-3 w-28 bg-gray-200 rounded mb-2.5" />
            <div className="h-3 w-full bg-gray-200 rounded mb-1.5" />
            <div className="h-3 w-2/3 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <p className="text-sm text-gray-500 mb-4">
        No comments yet — write the first one below. Use @ to notify a teammate.
      </p>
    );
  }

  return (
    <div className="space-y-4 mb-4">
      {error && <p className="text-xs text-red-600">{error}</p>}
      {comments.map((comment) => (
        <div key={comment.id} className="bg-gray-50 rounded p-3 overflow-hidden">
          <div className="flex justify-between items-start gap-2 mb-1">
            <p className="font-medium text-sm text-gray-900 min-w-0 break-words">
              {comment.author?.name || "Unknown"}
            </p>
            <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
              {wasEdited(comment) && " (edited)"}
            </span>
          </div>

          {editingId === comment.id ? (
            <div className="space-y-2">
              <textarea
                value={editBody}
                // Auto-grow to fit the comment being edited (feedback #2).
                ref={(el) => {
                  if (!el) return;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 260)}px`;
                  el.style.overflowY = el.scrollHeight > 260 ? "auto" : "hidden";
                }}
                onChange={(e) => {
                  setEditBody(e.target.value);
                  const el = e.target;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 260)}px`;
                  el.style.overflowY = el.scrollHeight > 260 ? "auto" : "hidden";
                }}
                className="w-full border border-gray-300 rounded p-2 text-sm resize-none focus:outline-none focus:border-red-500"
                style={{ minHeight: "4.5rem" }}
                disabled={busyId === comment.id}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => saveEdit(comment.id)}
                  disabled={busyId === comment.id || !editBody.trim()}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-xs font-semibold py-1 px-3 rounded transition"
                >
                  {busyId === comment.id ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={cancelEdit}
                  disabled={busyId === comment.id}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-semibold py-1 px-3 rounded transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                {renderRichText(comment.body || "", mentionNames)}
              </p>

              {/* Comment attachments — images preview inline, others as chips */}
              {(comment.attachments || []).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {(comment.attachments || []).map((a) =>
                    a.mimeType?.startsWith("image/") ? (
                      <a
                        key={a.id}
                        href={`/api/tasks/${taskId}/attachments/${a.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={a.fileName}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/tasks/${taskId}/attachments/${a.id}`}
                          alt={a.fileName}
                          className="max-h-40 max-w-[240px] rounded-lg border border-gray-200 object-cover hover:opacity-90 transition"
                        />
                      </a>
                    ) : (
                      <a
                        key={a.id}
                        href={`/api/tasks/${taskId}/attachments/${a.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs text-blue-600 hover:underline"
                      >
                        <FileIcon size={12} className="text-gray-400" /> {a.fileName}
                      </a>
                    )
                  )}
                </div>
              )}

              {/* Reactions */}
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                {Object.entries(
                  (comment.reactions || []).reduce<Record<string, number>>((acc, r) => {
                    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                    return acc;
                  }, {})
                ).map(([emoji, count]) => {
                  const mine = (comment.reactions || []).some(
                    (r) => r.userId === currentUserId && r.emoji === emoji
                  );
                  return (
                    <button
                      key={emoji}
                      onClick={() => toggleReaction(comment, emoji)}
                      className={`inline-flex items-center gap-1 text-xs rounded-full px-1.5 py-0.5 border transition ${
                        mine
                          ? "bg-red-50 border-red-200 text-red-700"
                          : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                      title={mine ? "Remove your reaction" : "React"}
                    >
                      {emoji} {count}
                    </button>
                  );
                })}
                <div className="relative">
                  <button
                    onClick={() => setPickerFor(pickerFor === comment.id ? null : comment.id)}
                    className="flex items-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full border border-transparent hover:border-gray-200 px-1.5 py-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                    title="Add reaction"
                    aria-label="Add reaction"
                  >
                    <SmilePlusIcon size={14} />
                  </button>
                  {pickerFor === comment.id && (
                    <div className="absolute bottom-full left-0 mb-1 flex gap-0.5 bg-white border border-gray-200 rounded-full shadow-lg px-1.5 py-1 z-10">
                      {REACTION_EMOJI.map((e) => (
                        <button
                          key={e}
                          onClick={() => {
                            toggleReaction(comment, e);
                            setPickerFor(null);
                          }}
                          className="text-base hover:scale-125 motion-reduce:hover:scale-100 transition-transform px-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded"
                          aria-label={`React with ${e}`}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {canModerate(comment) && (
                <div className="flex gap-3 mt-1.5">
                  <button
                    onClick={() => startEdit(comment)}
                    className="text-xs text-gray-500 hover:text-gray-900 transition"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(comment.id)}
                    disabled={busyId === comment.id}
                    className="text-xs text-gray-500 hover:text-red-600 transition"
                  >
                    Delete
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ))}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Delete this comment?"
        message="The comment is removed for everyone and can't be brought back."
        confirmLabel="Delete comment"
        onConfirm={() => confirmDeleteId && deleteComment(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
