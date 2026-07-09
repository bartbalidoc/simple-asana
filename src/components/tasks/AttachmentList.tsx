"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { CloseIcon, FileIcon, PaperclipIcon } from "@/components/ui/icons";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface AttachmentListProps {
  taskId: string;
}

interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  driveViewUrl: string;
  sizeBytes: number;
  uploadedAt: string;
}

export function AttachmentList({ taskId }: AttachmentListProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAttachments = async () => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/attachments`);
      if (response.ok) {
        const data = await response.json();
        setAttachments(data);
      }
    } catch (err) {
      console.error("Failed to fetch attachments:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttachments();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchAttachments is
    // recreated every render; depending on it caused an infinite refetch loop.
  }, [taskId]);

  // Mirror the server's limits so oversized/odd files fail INSTANTLY with a
  // clear message instead of uploading for a minute and dying with none.
  const MAX_BYTES = 15 * 1024 * 1024;
  const ALLOWED_EXTENSIONS = new Set([
    "pdf", "png", "jpg", "jpeg", "gif", "webp", "heic", "svg",
    "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods",
    "csv", "txt", "md", "rtf", "zip", "mp4", "mov", "mp3", "m4a", "wav",
  ]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    if (file.size > MAX_BYTES) {
      setError(
        `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB — the maximum is 15 MB.`
      );
      e.target.value = "";
      return;
    }
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      setError(
        `.${ext || "unknown"} files aren't allowed. Use documents, spreadsheets, images, audio/video or zip.`
      );
      e.target.value = "";
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/tasks/${taskId}/attachments`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        // Surface the server's actual reason (e.g. Drive not configured, no access).
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || `Upload failed (HTTP ${response.status})`);
      }

      await fetchAttachments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  // Deleting a file is destructive — confirm first (there was no confirm before).
  const [confirmDelete, setConfirmDelete] = useState<Attachment | null>(null);

  const handleDelete = async (attachmentId: string) => {
    setConfirmDelete(null);
    try {
      const response = await fetch(
        `/api/tasks/${taskId}/attachments?attachmentId=${attachmentId}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        await fetchAttachments();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete attachment");
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  if (loading) {
    return (
      <div className="space-y-2" aria-hidden="true">
        <div className="h-8 w-28 bg-gray-100 rounded-md animate-pulse motion-reduce:animate-none" />
        <div className="h-9 w-full bg-gray-50 rounded animate-pulse motion-reduce:animate-none" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <label
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 rounded-md cursor-pointer text-xs font-medium transition focus-within:ring-2 focus-within:ring-red-400"
        >
          <PaperclipIcon size={13} className="text-gray-500" />
          Attach file
          <input
            type="file"
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
        {uploading && <span className="text-xs text-gray-500 ml-2">Uploading…</span>}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {attachments.length === 0 ? (
        <p className="text-sm text-gray-500">No attachments yet.</p>
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
            >
              <a
                href={`/api/tasks/${taskId}/attachments/${attachment.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0 text-blue-600 hover:underline truncate flex items-center gap-2"
              >
                <FileIcon size={14} className="flex-shrink-0 text-gray-400" />
                <span className="truncate">{attachment.fileName}</span>
                <span className="text-gray-500 text-xs whitespace-nowrap">
                  ({formatBytes(attachment.sizeBytes)})
                </span>
              </a>
              <button
                onClick={() => setConfirmDelete(attachment)}
                className="ml-2 h-7 w-7 flex items-center justify-center rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                title="Delete"
                aria-label={`Delete ${attachment.fileName}`}
              >
                <CloseIcon size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-500">
        Files are stored securely — click a file to view or download it.
      </p>

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete this file?"
        message={
          confirmDelete
            ? `"${confirmDelete.fileName}" is removed from the task for everyone.`
            : ""
        }
        confirmLabel="Delete file"
        onConfirm={() => confirmDelete && handleDelete(confirmDelete.id)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
