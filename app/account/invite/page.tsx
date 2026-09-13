"use client";

import { useState } from "react";

export default function InviteHandoffPage() {
  const [setupLink] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("link") ?? "";
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f4ee] px-6 py-8 text-[#17212b]">
      <section className="w-full max-w-md">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#e5763f]">
          Studio Trizen
        </p>
        <h1 className="mt-4 font-serif text-5xl leading-[0.92] tracking-[-0.05em]">
          Finish setting up your account.
        </h1>
        <p className="mt-6 text-sm leading-7 text-[#69747a]">
          Tap the button below to open the secure password setup page.
        </p>
        {setupLink ? (
          <a
            href={setupLink}
            className="mt-8 inline-flex rounded-full bg-[#17212b] px-7 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#176875]"
          >
            Continue securely
          </a>
        ) : (
          <p className="mt-8 border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-700">
            This setup link is incomplete. Ask the admin to send a new invitation.
          </p>
        )}
      </section>
    </main>
  );
}
