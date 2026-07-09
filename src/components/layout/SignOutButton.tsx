"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ redirect: true, callbackUrl: "/login" })}
      className="text-sm text-gray-500 hover:text-gray-800 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 transition"
    >
      Sign out
    </button>
  );
}
