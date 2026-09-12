"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "../../src/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setError("");

    const supabase = createClient();

    // ----------------------------------------
    // Sign in
    // ----------------------------------------

    const { data, error: loginError } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    if (loginError) {
      setError(loginError.message);
      setLoading(false);
      return;
    }

    if (!data.user) {
      setError("Unable to sign in. Please try again.");
      setLoading(false);
      return;
    }

    const {
    data: { session },
    } = await supabase.auth.getSession();

   console.log("LOGIN USER:", data.user.email);
   console.log("LOGIN SESSION:", session);
   console.log("LOGIN ACCESS TOKEN:", session?.access_token);

    // ----------------------------------------
    // Get user role
    // ----------------------------------------

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

    if (profileError || !profile) {
      console.error(profileError);

      setError(
        "Your account profile could not be loaded."
      );

      await supabase.auth.signOut();

      setLoading(false);
      return;
    }

    // ----------------------------------------
    // Redirect based on role
    // ----------------------------------------

    if (profile.role === "ADMIN") {
      router.push("/admin");
      router.refresh();
      return;
    }

    if (profile.role === "TEAM_MEMBER") {
      router.push("/team");
      router.refresh();
      return;
    }

    setError("Your account has an invalid role.");

    await supabase.auth.signOut();

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-[#f7f4ee] text-[#17212b]">
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* LEFT SIDE */}

        <section className="relative hidden overflow-hidden bg-[#17212b] lg:flex">
          <div className="absolute inset-0">
            <div className="absolute -left-32 top-20 h-[450px] w-[450px] rounded-full bg-[#176875]/70 blur-3xl" />

            <div className="absolute -bottom-32 right-0 h-[500px] w-[500px] rounded-full bg-[#e5763f]/50 blur-3xl" />
          </div>

          <div className="relative flex w-full flex-col justify-between p-12 xl:p-16">
            <div className="flex items-center gap-3">
              <Image src="/studio-trizen-logo.png" alt="Studio Trizen" width={96} height={76} className="h-12 w-16 object-contain" />

              <div>
                <p className="font-semibold text-white">
                  Studio Trizen
                </p>

                <p className="text-xs text-neutral-600">
                  Photography workspace
                </p>
              </div>
            </div>

            <div className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#efb44c]">
                Private photo delivery
              </p>

              <h1 className="mt-6 max-w-2xl font-serif text-5xl font-semibold leading-[0.95] tracking-[-0.05em] text-white xl:text-7xl">
                Every frame.
                <br />
                One workspace.
              </h1>

              <p className="mt-6 max-w-lg text-sm leading-7 text-white/55">
                Capture, collaborate, curate and deliver beautiful
                photography collections from one secure workspace.
              </p>

              <div className="mt-10 flex gap-3">
                <Feature text="Team collaboration" />
                <Feature text="Private galleries" />
              </div>
            </div>

            <p className="text-xs text-neutral-700">
                  Photography workspace
            </p>
          </div>
        </section>

        {/* RIGHT SIDE */}

        <section className="flex min-h-screen items-center justify-center px-6 py-12">
          <div className="w-full max-w-[440px]">
            {/* MOBILE BRAND */}

            <div className="mb-12 flex items-center gap-3 lg:hidden">
              <Image src="/studio-trizen-logo.png" alt="Studio Trizen" width={96} height={76} className="h-11 w-14 object-contain" />

              <div>
                <p className="font-semibold">
                  Studio Trizen
                </p>

                <p className="text-xs text-neutral-400">
                  Photography workspace
                </p>
              </div>
            </div>

            {/* HEADING */}

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#176875]">
                Welcome back
              </p>

              <h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">
                Sign in.
              </h2>

              <p className="mt-3 text-sm leading-6 text-neutral-500">
                Access your Studio Trizen workspace.
              </p>
            </div>

            {/* FORM */}

            <form
              onSubmit={handleLogin}
              className="mt-10"
            >
              {/* EMAIL */}

              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium"
                >
                  Email
                </label>

                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  placeholder="you@example.com"
                  required
                  disabled={loading}
                  className="w-full rounded-2xl border border-[#17212b]/15 bg-white px-4 py-3.5 text-sm outline-none transition placeholder:text-neutral-400 focus:border-[#e5763f] focus:ring-4 focus:ring-[#e5763f]/10 disabled:opacity-50"
                />
              </div>

              {/* PASSWORD */}

              <div className="mt-5">
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium"
                >
                  Password
                </label>

                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  placeholder="Enter your password"
                  required
                  disabled={loading}
                  className="w-full rounded-2xl border border-[#17212b]/15 bg-white px-4 py-3.5 text-sm outline-none transition placeholder:text-neutral-400 focus:border-[#e5763f] focus:ring-4 focus:ring-[#e5763f]/10 disabled:opacity-50"
                />
              </div>

              {/* ERROR */}

              {error && (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5">
                  <p className="text-sm leading-5 text-red-700">
                    {error}
                  </p>
                </div>
              )}

              {/* BUTTON */}

              <button
                type="submit"
                disabled={loading}
                className="mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-[#17212b] px-6 py-3.5 text-sm font-medium text-white transition hover:bg-[#176875] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowIcon />
                  </>
                )}
              </button>
            </form>

            <p className="mt-10 text-center text-xs text-neutral-400">
              Secure photography workspace
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

/* =========================================================
   FEATURE
========================================================= */

function Feature({ text }: { text: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-neutral-500">
      {text}
    </span>
  );
}

/* =========================================================
   ICONS
========================================================= */

function ArrowIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

