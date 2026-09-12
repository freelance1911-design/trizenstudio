"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../src/lib/supabase/client";

type Event = {
  id: string;
  name: string;
  description: string | null;
  event_date: string | null;
  created_at: string;
  thumbnail_path: string | null;
  cover_url?: string;
};

export default function EventsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const user = session?.user;

    if (!user) {
      router.push("/login");
      return;
    }

    const [{ data: profile }, { data, error }] = await Promise.all([
      supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single(),
      supabase
        .from("events")
        .select("id, name, description, event_date, created_at, thumbnail_path")
        .order("created_at", { ascending: false }),
    ]);

    if (!profile || profile.role !== "ADMIN") {
      router.push("/login");
      return;
    }

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const loadedEvents = (data || []) as Event[];
    setEvents(loadedEvents);
    setLoading(false);

    // Covers are decorative; load them after the event list is visible.
    const { data: coverPhotos } = await supabase
      .from("photos")
      .select("event_id, storage_path, created_at")
      .order("created_at", { ascending: true });
    const firstPhotoByEvent = new Map<string, string>();
    (coverPhotos ?? []).forEach((photo) => {
      if (!firstPhotoByEvent.has(photo.event_id)) firstPhotoByEvent.set(photo.event_id, photo.storage_path);
    });
    const coverPaths = loadedEvents
      .map((event) => event.thumbnail_path || firstPhotoByEvent.get(event.id))
      .filter((path): path is string => Boolean(path));
    if (coverPaths.length) {
      const { data: signedCovers } = await supabase.storage.from("photos").createSignedUrls(coverPaths, 60 * 60);
      const signedByPath = Object.fromEntries((signedCovers ?? []).map((item) => [item.path, item.signedUrl ?? ""]));
      setEvents((currentEvents) => currentEvents.map((event) => ({
        ...event,
        cover_url: signedByPath[event.thumbnail_path || firstPhotoByEvent.get(event.id) || ""] ?? "",
      })));
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f4ee] text-[#17212b]">
      {/* Navigation */}
      <header className="border-b border-[#181716]/10">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-5 lg:px-10">
          <div className="flex items-center gap-10">
            <button
              onClick={() => router.push("/admin")}
              className="flex items-center gap-3 text-left"
            >
              <Image
                src="/studio-trizen-logo.png"
                alt="Studio Trizen"
                width={96}
                height={76}
                className="h-10 w-12 object-contain"
              />
              <span className="sr-only">Studio Trizen</span>
            </button>

            <nav className="hidden items-center gap-7 md:flex">
              <button
                onClick={() => router.push("/admin/events")}
                className="text-[13px] font-medium"
              >
                Events
              </button>

              <button
                onClick={() => router.push("/team")}
                className="text-[13px] font-medium text-[#176875] transition hover:text-[#e5763f]"
              >
                Photographers
              </button>

              <button
                onClick={() => router.push("/admin/galleries")}
                className="text-[13px] font-medium text-[#176875] transition hover:text-[#e5763f]"
              >
                Galleries
              </button>
            </nav>
            <nav className="flex items-center gap-4 md:hidden">
              <button onClick={() => router.push("/admin/events")} className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#176875]">Events</button>
              <button onClick={() => router.push("/team")} className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#176875]">Team</button>
              <button onClick={() => router.push("/admin/galleries")} className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#176875]">Galleries</button>
            </nav>
          </div>

          <div className="flex items-center gap-5">
            <span className="hidden text-[12px] text-[#181716]/45 sm:block">
              ADMIN WORKSPACE
            </span>

            <button
              onClick={() => router.push("/admin")}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#181716]/15 text-xs font-semibold"
            >
              A
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <section className="mx-auto max-w-[1400px] px-6 py-14 lg:px-10 lg:py-20">
        {/* Heading */}
        <div className="flex flex-col justify-between gap-8 border-b border-[#181716]/10 pb-10 md:flex-row md:items-end">
          <div>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#181716]/40">
              Workspace / Events
            </p>

            <h1 className="font-serif text-5xl font-normal tracking-[-0.04em] md:text-7xl">
              Your events.
            </h1>

            <p className="mt-5 max-w-lg text-[15px] leading-7 text-[#181716]/55">
              Create, organize and curate photography projects from one
              place.
            </p>
          </div>

          <button
            onClick={() => router.push("/admin/events/new")}
            className="w-fit rounded-full border border-[#e5763f] bg-[#e5763f] px-6 py-3.5 text-[13px] font-semibold text-white transition hover:bg-[#17212b]"
          >
            + Create event
          </button>
        </div>

        {/* Event count */}
        <div className="flex items-center justify-between border-b border-[#181716]/10 py-5">
          <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-[#181716]/45">
            {events.length === 1 ? "01 event" : `${String(events.length).padStart(2, "0")} events`}
          </p>

          <p className="text-[12px] text-[#181716]/40">
            Photography workspace
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 gap-x-8 gap-y-14 pt-10 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index}>
                <div className="aspect-[4/3] animate-pulse rounded-xl bg-[#176875]/10" />
                <div className="mt-5 h-7 w-48 animate-pulse rounded-full bg-[#17212b]/10" />
                <div className="mt-4 h-3 w-32 animate-pulse rounded-full bg-[#17212b]/10" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && events.length === 0 && (
          <div className="py-28 text-center">
            <p className="font-serif text-4xl">
              Nothing here yet.
            </p>

            <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-[#181716]/45">
              Your photography projects will appear here once you create
              your first event.
            </p>

            <button
              onClick={() => router.push("/admin/events/new")}
              className="mt-7 border border-[#181716] px-6 py-3 text-[13px] font-semibold transition hover:bg-[#181716] hover:text-white"
            >
              Create your first event
            </button>
          </div>
        )}

        {/* Events */}
        {!loading && events.length > 0 && (
          <div className="grid grid-cols-1 gap-x-8 gap-y-14 pt-10 md:grid-cols-2 xl:grid-cols-3">
            {events.map((event, index) => (
              <article
                key={event.id}
                onClick={() =>
                  router.push(`/admin/events/${event.id}`)
                }
                className="group cursor-pointer"
              >
                {/* Image placeholder */}
                <div className="relative aspect-[4/3] overflow-hidden bg-[#176875]">
                  {event.cover_url && (
                    <img src={event.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`font-serif text-7xl ${event.cover_url ? "text-white/0" : "text-white/20"}`}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>

                  <div className="absolute inset-0 bg-[#181716]/0 transition duration-500 group-hover:bg-[#181716]/10" />

                  <div className="absolute bottom-5 left-5">
                    <span className="bg-[#f5f3ee] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]">
                      Event
                    </span>
                  </div>

                  <div className="absolute right-5 top-5 flex h-10 w-10 translate-y-2 items-center justify-center bg-[#f5f3ee] opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                    ↗
                  </div>
                </div>

                {/* Event information */}
                <div className="mt-5">
                  <div className="flex items-start justify-between gap-6">
                    <div>
                      <h2 className="font-serif text-2xl tracking-[-0.025em]">
                        {event.name}
                      </h2>

                      {event.description && (
                        <p className="mt-2 line-clamp-2 max-w-sm text-[13px] leading-6 text-[#181716]/45">
                          {event.description}
                        </p>
                      )}
                    </div>

                    <span className="pt-1 text-[11px] font-medium text-[#181716]/35">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-[#181716]/10 pt-4">
                    <span className="text-[11px] uppercase tracking-[0.14em] text-[#181716]/40">
                      {event.event_date
                        ? formatDate(event.event_date)
                        : "Date not set"}
                    </span>

                    <span className="text-[12px] font-semibold opacity-40 transition group-hover:translate-x-1 group-hover:opacity-100">
                      View event →
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-[#181716]/10">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-7 lg:px-10">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#181716]/30">
            Trizen Photo Workspace
          </p>

          <p className="text-[11px] text-[#181716]/30">
            © {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </main>
  );
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}