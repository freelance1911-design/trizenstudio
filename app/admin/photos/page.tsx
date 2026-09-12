"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../src/lib/supabase/client";

type Photo = {
  id: string;
  event_id: string;
  filename: string;
  storage_path: string;
  created_at: string;
  preview_url: string;
  event_name: string;
};

export default function PhotosIndexPage() {
  const router = useRouter();
  const supabase = createClient();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPhotos() {
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

      const [{ data: photoData, error }, { data: events }] = await Promise.all([
        supabase.from("photos").select("id, event_id, filename, storage_path, created_at").order("created_at", { ascending: false }),
        supabase.from("events").select("id, name"),
      ]);

      if (error) {
        console.error("Failed to load photos:", error);
        setLoading(false);
        return;
      }

      const eventNames = Object.fromEntries((events ?? []).map((event) => [event.id, event.name]));
      const paths = (photoData ?? []).map((photo) => photo.storage_path);
      const { data: signedData } = paths.length
        ? await supabase.storage.from("photos").createSignedUrls(paths, 60 * 60)
        : { data: [] };
      const signedUrls = Object.fromEntries((signedData ?? []).map((item) => [item.path, item.signedUrl ?? ""]));

      setPhotos((photoData ?? []).map((photo) => ({
        ...photo,
        preview_url: signedUrls[photo.storage_path] ?? "",
        event_name: eventNames[photo.event_id] ?? "Untitled event",
      })));
      setLoading(false);
    }

    void loadPhotos();
  }, [router, supabase]);

  return (
    <main className="min-h-screen bg-[#f7f4ee] text-[#17212b]">
      <header className="border-b border-[#17212b]/10">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-6 py-5 lg:px-10">
          <button onClick={() => router.push("/admin")} className="flex items-center gap-3">
            <Image src="/studio-trizen-logo.png" alt="Studio Trizen" width={96} height={76} className="h-10 w-12 object-contain" />
            <span className="sr-only">Studio Trizen</span>
          </button>
          <button onClick={() => router.push("/admin/events/new")} className="rounded-full bg-[#e5763f] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#17212b]">Create event +</button>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-6 py-12 lg:px-10 lg:py-16">
        <div className="flex flex-col justify-between gap-8 border-b border-[#17212b]/10 pb-10 md:flex-row md:items-end">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#176875]">Visual archive</p>
            <h1 className="mt-4 font-serif text-7xl leading-[0.85] tracking-[-0.05em]">All photographs.</h1>
            <p className="mt-6 max-w-lg text-sm leading-7 text-[#69747a]">A living contact sheet of every frame uploaded by your team. Open an event to curate its final selection.</p>
          </div>
          <div className="flex gap-8 text-right"><div><p className="text-4xl font-serif text-[#e5763f]">{photos.length}</p><p className="text-[10px] uppercase tracking-[0.18em] text-[#69747a]">Frames</p></div><div><p className="text-4xl font-serif text-[#176875]">{new Set(photos.map((photo) => photo.event_id)).size}</p><p className="text-[10px] uppercase tracking-[0.18em] text-[#69747a]">Events</p></div></div>
        </div>

        {loading ? <div className="grid grid-cols-2 gap-3 py-10 md:grid-cols-4 lg:grid-cols-5">{Array.from({ length: 10 }).map((_, index) => <div key={index} className="aspect-[4/5] animate-pulse bg-[#176875]/10" />)}</div> : photos.length === 0 ? <div className="py-28 text-center"><p className="font-serif text-5xl">No frames yet.</p><p className="mt-4 text-sm text-[#69747a]">Upload photographs from an event to see them collected here.</p></div> : <div className="grid grid-cols-2 gap-3 py-10 md:grid-cols-4 lg:grid-cols-5">{photos.map((photo, index) => <button key={photo.id} onClick={() => router.push(`/admin/events/${photo.event_id}/photos`)} className="group relative aspect-[4/5] overflow-hidden bg-[#176875] text-left">{photo.preview_url ? <img src={photo.preview_url} alt={photo.filename} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <span className="absolute inset-0 flex items-center justify-center font-serif text-6xl text-white/20">{String(index + 1).padStart(2, "0")}</span>}<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#17212b]/90 to-transparent p-4 pt-12 text-white"><p className="truncate text-xs font-medium">{photo.event_name}</p><p className="mt-1 truncate text-[10px] uppercase tracking-[0.12em] text-white/60">{photo.filename}</p></div></button>)}</div>}
      </section>
    </main>
  );
}
