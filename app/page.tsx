"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const hasInviteToken = Boolean(
      (hash.get("access_token") && hash.get("refresh_token")) ||
        query.get("code") ||
        query.get("token_hash")
    );

    if (hasInviteToken) {
      router.replace(
        `/account/password${window.location.search}${window.location.hash}`
      );
    }
  }, [router]);

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f4ee] text-[#17212b]">
      <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col px-6 py-6 sm:px-10 lg:px-14">
        <header className="flex items-center justify-between border-b border-[#17212b]/15 pb-5">
          <Link href="/" className="flex items-center gap-3"><Image src="/studio-trizen-logo.png" alt="Studio Trizen" width={96} height={76} className="h-12 w-16 object-contain" /><span className="text-sm font-semibold tracking-[0.18em]">STUDIO TRIZEN</span></Link>
          <Link href="/login" className="text-xs font-semibold uppercase tracking-[0.16em] transition hover:text-[#e5763f]">Enter workspace <span className="ml-2">↗</span></Link>
        </header>
        <section className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-20">
          <div><p className="mb-7 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-[#176875]"><span className="h-2 w-2 rounded-full bg-[#e5763f]" /> Private photography, thoughtfully delivered</p><h1 className="max-w-4xl font-serif text-6xl leading-[0.9] tracking-[-0.06em] sm:text-8xl lg:text-[8.5rem]">Make room<br /><span className="text-[#e5763f]">for the moment.</span></h1><p className="mt-9 max-w-xl text-base leading-7 text-[#69747a]">A calm, capable home for your photography projects. Bring the team together, find the strongest frames, and share the finished story beautifully.</p><div className="mt-10 flex flex-wrap items-center gap-5"><Link href="/login" className="rounded-full bg-[#17212b] px-7 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-[#176875]">Open workspace <span className="ml-3">→</span></Link><span className="text-xs uppercase tracking-[0.14em] text-[#69747a]">Capture · Curate · Deliver</span></div></div>
          <div className="relative flex min-h-[380px] items-center justify-center lg:min-h-[560px]"><div className="absolute h-[78%] w-[78%] rounded-[48%_52%_45%_55%] bg-[#176875]" /><div className="absolute right-[6%] top-[7%] h-20 w-20 rounded-full bg-[#efb44c]" /><div className="absolute bottom-[9%] left-[8%] h-16 w-16 rounded-full bg-[#e5763f]" /><div className="relative flex h-[270px] w-[310px] rotate-[-7deg] items-center justify-center rounded-[28px] border-[14px] border-[#17212b] bg-[#efb44c] shadow-[18px_22px_0_#17212b] sm:h-[340px] sm:w-[390px]"><div className="h-36 w-36 rounded-full border-[12px] border-[#17212b] bg-[#e5763f] shadow-[inset_0_0_0_10px_#176875] sm:h-44 sm:w-44"><div className="m-auto mt-10 h-16 w-16 rounded-full bg-[#17212b] sm:mt-12 sm:h-20 sm:w-20" /></div><span className="absolute -right-16 -top-12 font-serif text-7xl text-white">✦</span></div></div>
        </section>
        <footer className="flex flex-col justify-between gap-3 border-t border-[#17212b]/15 pt-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#69747a] sm:flex-row"><span>Studio Trizen / Photography workspace</span><span>Made for meaningful stories</span></footer>
      </div>
    </main>
  );
}
