"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Falsches Passwort");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-80">
        <h1
          className="text-xl font-mono text-center tracking-widest"
          style={{ color: "var(--ink-0)" }}
        >
          PERSONAL OS
        </h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Passwort"
          autoFocus
          className="bg-transparent border px-4 py-2 font-mono text-sm outline-none focus:border-[var(--accent)] transition-colors"
          style={{ borderColor: "var(--ink-3)", color: "var(--ink-0)" }}
        />
        {error && (
          <p className="text-sm font-mono" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading || !password}
          className="py-2 font-mono text-sm font-bold transition-opacity disabled:opacity-40"
          style={{ background: "var(--accent)", color: "var(--ink-4)" }}
        >
          {loading ? "..." : "LOGIN"}
        </button>
      </form>
    </main>
  );
}
