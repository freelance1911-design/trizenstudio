"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../src/lib/supabase/client";

type Gallery = {
  id: string;
  event_id: string;
  slug: string;
  published: boolean;
  created_at: string;
  event_name: string;
  event_date: string | null;
};

export default function GalleriesIndexPage() {
  const router = useRouter();
  const supabase = createClient();
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadGalleries() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (!profile || profile.role !== "ADMIN") {
        router.replace("/login");
        return;
      }

      const [{ data: galleryData, error }, { data: events }] = await Promise.all([
        supabase.from("galleries").select("id, event_id, slug, published, created_at").order("created_at", { ascending: false }),
        supabase.from("events").select("id, name, event_date"),
      ]);

      if (error) {
        console.error("Failed to load galleries:", error);
        setLoading(false);
        return;
      }

      const eventMap = Object.fromEntries((events ?? []).map((event) => [event.id, event]));
      setGalleries((galleryData ?? []).map((gallery) => ({
        ...gallery,
        event_name: eventMap[gallery.event_id]?.name ?? "Untitled event",
        event_date: eventMap[gallery.event_id]?.event_date ?? null,
      })));
      setLoading(false);
    }

    void loadGalleries();
  }, [router, supabase]);

  return (
    <main className="min-h-screen bg-[#f7f4ee] text-[#17212b]">
      <header className="border-b border-[#17212b]/10">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-5 lg:px-10">
          <button onClick={() => router.push("/admin")} className="flex items-center gap-3"><Image src="/studio-trizen-logo.png" alt="Studio Trizen" width={96} height={76} className="h-10 w-12 object-contain" /><span className="sr-only">Studio Trizen</span></button>
          <button onClick={() => router.push("/admin/events")} className="text-xs font-semibold uppercase tracking-[0.14em] text-[#176875] transition hover:text-[#e5763f]">Browse events →</button>
        </div>
      </header>

      <section className="mx-auto max-w-[1400px] px-6 py-12 lg:px-10 lg:py-16">
        <div className="border-b border-[#17212b]/10 pb-10"><p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#e5763f]">Client delivery</p><h1 className="mt-4 font-serif text-7xl leading-[0.85] tracking-[-0.05em]">Your galleries.</h1><p className="mt-6 max-w-xl text-sm leading-7 text-[#69747a]">Prepare, publish, and revisit every private collection from one calm control room.</p></div>
        {loading ? <div className="space-y-3 py-10">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-24 animate-pulse bg-[#176875]/10" />)}</div> : galleries.length === 0 ? <div className="py-28 text-center"><p className="font-serif text-5xl">No galleries yet.</p><p className="mt-4 text-sm text-[#69747a]">Select photographs from an event to create your first client collection.</p><button onClick={() => router.push("/admin/events")} className="mt-7 rounded-full bg-[#e5763f] px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white">Choose an event</button></div> : <div className="divide-y divide-[#17212b]/10 py-4">{galleries.map((gallery, index) => <article key={gallery.id} className="grid gap-6 py-7 md:grid-cols-[80px_1fr_auto] md:items-center"><div className="font-serif text-5xl text-[#176875]/30">{String(index + 1).padStart(2, "0")}</div><div><div className="flex flex-wrap items-center gap-3"><h2 className="font-serif text-3xl">{gallery.event_name}</h2><span className={`rounded-full px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] ${gallery.published ? "bg-[#176875]/10 text-[#176875]" : "bg-[#efb44c]/25 text-[#946b16]"}`}>{gallery.published ? "Published" : "Draft"}</span></div><p className="mt-2 text-xs uppercase tracking-[0.14em] text-[#69747a]">{gallery.event_date ? formatDate(gallery.event_date) : "Date not set"} · Private collection</p></div><div className="flex flex-wrap gap-3 md:justify-end"><button onClick={() => router.push(`/admin/events/${gallery.event_id}/gallery`)} className="rounded-full bg-[#17212b] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-[#176875]">Manage</button>{gallery.published && <a href={`/gallery/${gallery.slug}`} target="_blank" rel="noreferrer" className="rounded-full border border-[#17212b]/20 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] transition hover:border-[#e5763f] hover:text-[#e5763f]">Open gallery ↗</a>}</div></article>)}</div>}
      </section>
    </main>
  );
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
