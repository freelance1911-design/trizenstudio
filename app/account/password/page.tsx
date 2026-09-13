"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../src/lib/supabase/client";

const supabase = createClient();

export default function PasswordPage() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [accountEmail, setAccountEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function establishInviteSession() {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const query = new URLSearchParams(window.location.search);
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const code = query.get("code");
      const tokenHash = query.get("token_hash");
      const authError =
        query.get("error_description") ||
        hash.get("error_description");
      const authErrorCode =
        query.get("error_code") ||
        hash.get("error_code");

      let session;

      if (authError) {
        const decodedError = decodeURIComponent(
          authError.replace(/\+/g, " ")
        );

        setError(
          authErrorCode === "otp_expired"
            ? "This invitation link has expired or has already been used. Ask the admin to send a new invitation."
            : decodedError
        );
        setAuthReady(true);
        return;
      }

      if (accessToken && refreshToken) {
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          setError("This setup link is invalid or has expired.");
          setAuthReady(true);
          return;
        }

        session = data.session;
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (code) {
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          setError("This setup link is invalid or has expired.");
          setAuthReady(true);
          return;
        }

        session = data.session;
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (tokenHash) {
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "invite",
        });

        if (verifyError) {
          setError("This setup link is invalid or has expired. Ask the admin to create a new invitation.");
          setAuthReady(true);
          return;
        }

        session = data.session;
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        const { data } = await supabase.auth.getSession();
        session = data.session;
      }

      if (!session?.user?.email) {
        setError("Open the secure setup link from your invitation email.");
      } else {
        setAccountEmail(session.user.email);
      }

      setAuthReady(true);
    }

    void establishInviteSession();
  }, []);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!authReady || !accountEmail) {
      setError("Your secure setup session could not be verified.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { password_set: true },
    });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setPassword("");
    setConfirmation("");
    setMessage("Your password has been updated securely.");
    await supabase.auth.signOut();
  }

  return (
    <main className="min-h-screen bg-[#f7f4ee] px-6 py-8 text-[#17212b] sm:px-10">
      <header className="mx-auto flex max-w-3xl items-center justify-between border-b border-[#17212b]/10 pb-5">
        <button onClick={() => router.back()} className="text-xs font-semibold uppercase tracking-[0.14em] text-[#176875]">← Back</button>
        <span className="text-xs font-semibold uppercase tracking-[0.18em]">Studio Trizen</span>
      </header>
      <section className="mx-auto max-w-3xl py-20">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#e5763f]">Account security</p>
        <h1 className="mt-4 font-serif text-6xl leading-[0.9] tracking-[-0.05em]">Set your password.</h1>
        <p className="mt-6 max-w-md text-sm leading-7 text-[#69747a]">Choose a private password for your Studio Trizen workspace. It is handled by Supabase Auth and is never shown in this application.</p>
        <form onSubmit={updatePassword} className="mt-10 max-w-md space-y-5">
          <div className="rounded-2xl border border-[#176875]/15 bg-[#176875]/5 px-4 py-4"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#176875]">Signed in as</p><p className="mt-2 text-sm font-medium">{accountEmail || "Verifying secure session..."}</p><p className="mt-1 text-xs text-[#69747a]">Only this authenticated account can be updated.</p></div>
          <label className="block text-xs font-semibold uppercase tracking-[0.14em]">New password<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-2xl border border-[#17212b]/15 bg-white px-4 py-4 text-sm outline-none focus:border-[#e5763f]" /></label>
          <label className="block text-xs font-semibold uppercase tracking-[0.14em]">Confirm password<input type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-2 w-full rounded-2xl border border-[#17212b]/15 bg-white px-4 py-4 text-sm outline-none focus:border-[#e5763f]" /></label>
          {error && <p className="border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          {message && <p className="border-l-2 border-[#176875] bg-[#176875]/10 px-4 py-3 text-sm text-[#176875]">{message}</p>}
          <button disabled={saving || !authReady || !accountEmail} className="rounded-full bg-[#17212b] px-7 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#176875] disabled:opacity-50">{saving ? "Saving..." : "Update password"}</button>
        </form>
      </section>
    </main>
  );
}