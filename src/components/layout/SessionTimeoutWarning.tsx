"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";

const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const WARNING_TIME = 5 * 60 * 1000; // Show warning 5 minutes before timeout
const CHECK_INTERVAL = 1000; // Check every 1 second

export function SessionTimeoutWarning() {
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef(Date.now());
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const resetTimer = () => {
      lastActivityRef.current = Date.now();
      setShowWarning(false);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);

      warningTimeoutRef.current = setTimeout(() => {
        setShowWarning(true);
        startCountdown();
      }, IDLE_TIMEOUT - WARNING_TIME);

      timeoutRef.current = setTimeout(() => {
        signOut({ redirect: true, callbackUrl: "/login" });
      }, IDLE_TIMEOUT);
    };

    const startCountdown = () => {
      countdownRef.current = setInterval(() => {
        const elapsed = Date.now() - lastActivityRef.current;
        const remaining = Math.max(0, IDLE_TIMEOUT - elapsed);
        setTimeRemaining(Math.ceil(remaining / 1000));

        if (remaining <= 0) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          signOut({ redirect: true, callbackUrl: "/login" });
        }
      }, CHECK_INTERVAL);
    };

    const events = ["mousedown", "keydown", "scroll", "touchstart", "click"];
    events.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    resetTimer();

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  if (!showWarning) return null;

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-sm">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Session Timeout Warning</h2>

        <p className="text-gray-600 mb-6">
          Your session will expire in{" "}
          <span className="font-bold text-red-600">
            {minutes}:{seconds.toString().padStart(2, "0")}
          </span>{" "}
          due to inactivity.
        </p>

        <div className="flex gap-3">
          <button
            onClick={() => {
              lastActivityRef.current = Date.now();
              setShowWarning(false);
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
              if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
              if (countdownRef.current) clearInterval(countdownRef.current);
            }}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition"
          >
            Stay Logged In
          </button>

          <button
            onClick={() => signOut({ redirect: true, callbackUrl: "/login" })}
            className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-900 font-semibold py-2 px-4 rounded-lg transition"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
