"use client";
import AppShell from "@/components/AppShell";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { void fetch("/api/auth/me").then(r => r.json()).then(d => { if (d.user?.email) setEmail(d.user.email); }).catch(() => setError("Could not load account details.")); }, []);
  async function exportData() {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/account");
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || "Export failed."); }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = "courant-data-export.json"; link.click();
      URL.revokeObjectURL(url); setNotice("Your data export was prepared.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not export data."); }
    finally { setBusy(false); }
  }
  async function deleteAccount() {
    if (!window.confirm("Permanently delete your Courant account and associated learning records? This cannot be undone.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmEmail }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Account deletion failed.");
      window.location.href = "/";
    } catch (e) { setError(e instanceof Error ? e.message : "Could not delete account."); }
    finally { setBusy(false); }
  }
  return <AppShell><div className="mx-auto max-w-3xl"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">Your account</p><h1 className="mt-4 text-4xl font-medium tracking-[-.055em]">Privacy and settings</h1><p className="mt-4 max-w-xl text-sm leading-6 text-[var(--muted)]">Your learning record belongs to you. Export a copy or permanently remove your account and associated Courant records.</p>
    {error && <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}{notice && <p role="status" className="mt-6 rounded-xl bg-[var(--accent-soft)] p-4 text-sm text-[var(--accent)]">{notice}</p>}
    <section className="mt-8 rounded-[22px] border border-[var(--line)] bg-[var(--surface)] p-6"><h2 className="text-xl font-medium">Account details</h2><p className="mt-2 text-sm text-[var(--muted)]">{email || "Sign in to view your account email."}</p><Link href="/dashboard" className="mt-4 inline-flex rounded-full border border-[var(--line)] px-4 py-2.5 text-sm">Back to your journal ↗</Link></section>
    <section className="mt-4 rounded-[22px] border border-[var(--line)] bg-[var(--surface)] p-6"><h2 className="text-xl font-medium">Export your data</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Download a JSON copy of your profile, saved practice, portfolio, submissions, and available class records.</p><button disabled={busy || !email} onClick={exportData} className="mt-5 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Working…" : "Download my data"}</button></section>
    <section className="mt-4 rounded-[22px] border border-red-200 bg-white p-6"><h2 className="text-xl font-medium text-red-800">Delete account</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">This permanently removes your account, saved progress, portfolio items, and submissions. Classes you teach and their assignments will also be removed. This action cannot be undone.</p><label className="mt-5 block text-xs font-semibold">Type your account email to confirm<input type="email" autoComplete="email" value={confirmEmail} onChange={e => setConfirmEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-3 text-sm" placeholder={email || "you@example.com"} /></label><button disabled={busy || !email || confirmEmail.trim().toLowerCase() !== email.toLowerCase()} onClick={deleteAccount} className="mt-4 rounded-full bg-red-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">{busy ? "Working…" : "Permanently delete account"}</button></section>
  </div></AppShell>;
}
