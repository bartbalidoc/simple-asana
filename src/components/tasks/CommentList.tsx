"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";

interface CommentListProps {
  taskId: string;
  comments?: Comment[];
}

interface Comment {
  id: string;
  bodyEnc?: string;
  body?: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
    email: string;
  };
}

export function CommentList({ taskId, comments: externalComments }: CommentListProps) {
  const [comments, setComments] = useState<Comment[]>(externalComments || []);
  const [loading, setLoading] = useState(!externalComments);

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

  if (loading) {
    return <div className="text-sm text-gray-500">Loading comments...</div>;
  }

  if (comments.length === 0) {
    return <p className="text-sm text-gray-500">No comments yet.</p>;
  }

  return (
    <div className="space-y-4 mb-4">
      {comments.map((comment) => (
        <div key={comment.id} className="bg-gray-50 rounded p-3">
          <div className="flex justify-between items-start mb-1">
            <p className="font-medium text-sm text-gray-900">
              {comment.author?.name || "Unknown"}
            </p>
            <span className="text-xs text-gray-500">
              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
            </span>
          </div>
          <p className="text-sm text-gray-700">{comment.body}</p>
        </div>
      ))}
    </div>
  );
}
