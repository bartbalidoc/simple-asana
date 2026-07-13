"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { PlendexLogo } from "@/components/brand/PlendexLogo";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const googleEnabled = false; // Email/password only for MVP staging

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signIn("google", { redirect: true, callbackUrl: "/dashboard" });
    } catch (err) {
      console.error("Sign in failed:", err);
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (mode === "register") {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to create account");
        }
        // Account created — fall through to sign in automatically
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        throw new Error("Invalid email or password");
      }

      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Brand panel (large screens) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-rose-500 via-red-600 to-red-800 text-white p-12 flex-col justify-between">
        <PlendexLogo size={46} showText showTagline light />
        <div>
          <h1 className="text-4xl font-bold leading-tight">
            Your team&apos;s work,
            <br /> beautifully organized.
          </h1>
          <p className="mt-4 text-white/80 max-w-md">
            Plendex is where the BaliDoc team plans projects, tasks and subtasks —
            one secure hub for everything we do.
          </p>
          <ul className="mt-8 space-y-3 text-white/90">
            <li className="flex items-center gap-2">✓ A board for every project</li>
            <li className="flex items-center gap-2">✓ Assign work in one click</li>
            <li className="flex items-center gap-2">✓ Encrypted &amp; audit-logged</li>
          </ul>
        </div>
        <p className="text-white/60 text-xs tracking-[0.18em]">
          PLENDEX BY BALIDOC · YOUR HEALTH · OUR PRIORITY
        </p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex flex-col items-center mb-6">
            <PlendexLogo size={52} showText showTagline />
          </div>
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              {mode === "login"
                ? "Sign in to your Plendex workspace."
                : "Join your team on Plendex."}
            </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Full name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-red-500"
                placeholder="Jane Doe"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-red-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-red-500"
              placeholder={mode === "register" ? "At least 8 characters" : "••••••••"}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2 shadow-sm"
          >
            {isLoading ? (
              <>
                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                Please wait…
              </>
            ) : mode === "login" ? (
              "Sign in"
            ) : (
              "Create account"
            )}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-4">
          {mode === "login" ? (
            <>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setError(null);
                }}
                className="text-red-600 hover:underline font-medium"
              >
                Register
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError(null);
                }}
                className="text-red-600 hover:underline font-medium"
              >
                Sign in
              </button>
            </>
          )}
        </p>

        {googleEnabled && (
          <>
            <div className="flex items-center my-6">
              <div className="flex-1 border-t border-gray-200" />
              <span className="px-3 text-xs text-gray-400">OR</span>
              <div className="flex-1 border-t border-gray-200" />
            </div>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
            >
              Sign in with Google
            </button>
          </>
        )}
          </div>
        </div>
      </div>
    </div>
  );
}
