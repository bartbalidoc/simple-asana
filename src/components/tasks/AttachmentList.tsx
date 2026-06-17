"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";

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
  }, [taskId, fetchAttachments]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/tasks/${taskId}/attachments`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to upload file");

      await fetchAttachments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (attachmentId: string) => {
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
    return <div className="text-sm text-gray-500">Loading attachments...</div>;
  }

  return (
    <div className="space-y-3">
      <div>
        <label
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded cursor-pointer text-sm font-medium transition"
        >
          <span>📎 Upload File</span>
          <input
            type="file"
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
        {uploading && <span className="text-xs text-gray-500 ml-2">Uploading...</span>}
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
                href={attachment.driveViewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-blue-600 hover:underline truncate flex items-center gap-2"
              >
                <span>📄</span>
                <span className="truncate">{attachment.fileName}</span>
                <span className="text-gray-500 text-xs">({formatBytes(attachment.sizeBytes)})</span>
              </a>
              <button
                onClick={() => handleDelete(attachment.id)}
                className="ml-2 text-gray-400 hover:text-red-600 transition"
                title="Delete"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-500">
        Files stored in Google Drive (
        <a
          href="https://drive.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          view all
        </a>
        )
      </p>
    </div>
  );
}
