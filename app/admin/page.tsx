"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../src/lib/supabase/client";

type Event = {
  id: string;
  name: string;
  description: string | null;
  event_date: string | null;
  thumbnail_path: string | null;
  thumbnail_url?: string;
};

type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: string;
};

export default function AdminDashboard() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [photoCount, setPhotoCount] = useState(0);
  const [galleryCount, setGalleryCount] = useState(0);
  const [teamCount, setTeamCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    router.prefetch("/admin/events");
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
      const {
  data: { session },
  error: sessionError,
} = await supabase.auth.getSession();

const currentUser = session?.user ?? null;

if (!currentUser) {
  console.error("Dashboard session check failed:", sessionError);
  setError("Your session could not be verified. Please log in again.");
  setLoading(false);
  return;
}

      if (!currentUser) {
        console.error("Dashboard sessiom check failed:", sessionError);
        setError("Your session could not be verified. Please try again.");
        setLoading(false);
        return;
      }

      const [
        { data: profileData, error: profileError },
        recentEventsResult,
        eventsCountResult,
        photosCountResult,
        galleriesCountResult,
        teamCountResult,
      ] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, role").eq("id", currentUser.id).single(),
        supabase.from("events").select("id, name, description, event_date, thumbnail_path").order("created_at", { ascending: false }).limit(4),
        supabase.from("events").select("id", { count: "exact", head: true }),
        supabase.from("photos").select("id", { count: "exact", head: true }),
        supabase.from("galleries").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "TEAM_MEMBER"),
      ]);

      if (profileError || !profileData) {
        console.error("Failed to load dashboard profile:", profileError);
        setError("Your account profile could not be loaded. Please try again.");
        setLoading(false);
        return;
      }

      if (profileData.role !== "ADMIN") {
        setError("This account does not have administrator access.");
        setLoading(false);
        return;
      }

      setProfile(profileData);

      const recentEvents = (recentEventsResult.data ?? []) as Event[];
      const thumbnailPaths = recentEvents
        .map((event) => event.thumbnail_path)
        .filter((path): path is string => Boolean(path));
      const { data: signedThumbnails } = thumbnailPaths.length
        ? await supabase.storage.from("photos").createSignedUrls(thumbnailPaths, 60 * 60)
        : { data: [] };
      const thumbnailUrls = Object.fromEntries(
        (signedThumbnails ?? [])
          .filter((item) => item.signedUrl)
          .map((item) => [item.path, item.signedUrl])
      );
      setEvents(recentEvents.map((event) => ({
        ...event,
        thumbnail_url: event.thumbnail_path
          ? thumbnailUrls[event.thumbnail_path] || ""
          : "",
      })));
      setPhotoCount(photosCountResult.count ?? 0);
      setGalleryCount(galleriesCountResult.count ?? 0);
      setTeamCount(teamCountResult.count ?? 0);

      // Keep this value available for future dashboard use without
      // loading all events into the browser.
      void eventsCountResult;
    } catch (error) {
      console.error("Failed to load admin dashboard:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f4ee] text-[#17212b]">
        <div className="hidden min-h-screen lg:block">
          <aside className="fixed inset-y-0 left-0 w-[255px] border-r border-[#181716]/10 bg-[#f5f3ee]" />

          <div className="lg:pl-[255px]">
            <header className="border-b border-[#181716]/10 px-10 py-5">
              <div className="h-3 w-28 animate-pulse bg-[#181716]/10" />
            </header>

            <section className="mx-auto max-w-[1400px] px-10 py-16">
              <div className="h-3 w-20 animate-pulse bg-[#181716]/10" />
              <div className="mt-6 h-24 max-w-[720px] animate-pulse bg-[#181716]/10" />
              <div className="mt-8 h-5 max-w-[520px] animate-pulse bg-[#181716]/10" />

              <div className="mt-14 grid grid-cols-4 border-y border-[#181716]/10">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="border-r border-[#181716]/10 px-5 py-8"
                  >
                    <div className="h-12 w-20 animate-pulse bg-[#181716]/10" />
                    <div className="mt-4 h-2 w-24 animate-pulse bg-[#181716]/10" />
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        <div className="flex min-h-screen items-center justify-center lg:hidden">
          <div className="text-center">
            <div className="mx-auto h-5 w-5 animate-spin rounded-full border border-black/20 border-t-black" />
            <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-black/40">
              Loading workspace
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f4ee] px-6 text-center text-[#17212b]">
        <div>
          <p className="font-serif text-4xl">Workspace unavailable.</p>
          <p className="mt-3 text-sm text-[#69747a]">{error || "Please try again."}</p>
          <button
            onClick={() => void loadDashboard()}
            className="mt-6 border border-[#17212b] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em]"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f4ee] text-[#17212b]">
      {/* =====================================================
          SIDEBAR
      ====================================================== */}

      <aside className="fixed inset-y-0 left-0 hidden w-[255px] border-r border-[#181716]/10 bg-[#f5f3ee] lg:block">
        <div className="flex h-full flex-col px-5 py-7">

          {/* Brand */}
          <div className="px-4">
            <button
              onClick={() => router.push("/admin")}
              className="block text-left"
            >
              <Image src="/studio-trizen-logo.png" alt="Studio Trizen" width={96} height={76} className="h-12 w-16 object-contain" />
              <span className="sr-only">Studio Trizen</span>
            </button>

            <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.28em] text-[#181716]/45">
              Photo Workspace
            </p>
          </div>

          {/* Workspace Navigation */}
          <div className="mt-16">
            <p className="px-4 text-[9px] font-semibold uppercase tracking-[0.28em] text-[#181716]/35">
              Workspace
            </p>

            <nav className="mt-4 space-y-1">

              {/* Overview */}
              <SidebarItem
                label="Overview"
                icon="⌂"
                active
                onClick={() => router.push("/admin")}
              />

              {/* Events */}
              <SidebarItem
                label="Events"
                icon="□"
                onPrefetch={() => router.prefetch("/admin/events")}
                onClick={() => router.push("/admin/events")}
              />

              {/* Photos */}
              <SidebarItem
                label="Photos"
                icon="▧"
                onClick={() => router.push("/admin/photos")}
              />

              {/* Galleries */}
              <SidebarItem
                label="Galleries"
                icon="▱"
                onClick={() => router.push("/admin/galleries")}
              />

              {/* Team */}
              <SidebarItem
                label="Team"
                icon="♧"
                onClick={() => router.push("/team")}
              />

            </nav>
          </div>

          {/* Account */}
          <div className="mt-auto">

            <p className="px-4 text-[9px] font-semibold uppercase tracking-[0.28em] text-[#181716]/35">
              Account
            </p>

            <button
              onClick={handleSignOut}
              className="mt-4 flex w-full items-center gap-4 px-4 py-3 text-left text-[13px] text-[#181716]/55 transition hover:text-[#181716]"
            >
              <span className="text-lg">↪</span>
              Sign out
            </button>

            {/* User */}
            <div className="mt-7 border-t border-[#181716]/10 px-4 pt-6">
              <div className="flex items-center gap-3">

                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#181716] text-xs font-semibold text-white">
                  {getInitials(profile.full_name)}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold">
                    {profile.full_name}
                  </p>

                  <p className="truncate text-[10px] text-[#181716]/40">
                    {profile.email}
                  </p>
                </div>

              </div>
            </div>

          </div>
        </div>
      </aside>

      {/* =====================================================
          MAIN CONTENT
      ====================================================== */}

      <div className="lg:pl-[255px]">

        {/* Topbar */}
        <header className="border-b border-[#181716]/10">
          <div className="flex items-center justify-between px-6 py-5 lg:px-10">

            <p className="text-[11px] uppercase tracking-[0.2em] text-[#181716]/45">
              Admin workspace
            </p>

            <div className="flex items-center gap-5">

              <button
                className="text-lg text-[#181716]/60 transition hover:text-[#181716]"
                aria-label="Notifications"
              >
                ♧
              </button>

              <button
                onClick={() => router.push("/admin/events/new")}
                className="rounded-full border border-[#e5763f] bg-[#e5763f] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-[#17212b] hover:text-white"
              >
                + Create event
              </button>

            </div>
          </div>
          <nav className="flex items-center gap-5 overflow-x-auto border-t border-[#181716]/10 px-6 py-3 lg:hidden">
            <button onClick={() => router.push("/admin")} className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#176875]">Overview</button>
            <button onClick={() => router.push("/admin/events")} className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#176875]">Events</button>
            <button onClick={() => router.push("/admin/photos")} className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#176875]">Photos</button>
            <button onClick={() => router.push("/admin/galleries")} className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#176875]">Galleries</button>
            <button onClick={() => router.push("/team")} className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#176875]">Team</button>
          </nav>
        </header>

        {/* =================================================
            PAGE
        ================================================== */}

        <section className="mx-auto max-w-[1400px] px-6 py-12 lg:px-10 lg:py-16">

          {/* INTRO */}
          <div className="grid gap-10 border-b border-[#181716]/10 pb-12 xl:grid-cols-[1fr_280px]">

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[#181716]/40">
                Overview
              </p>

              <h1 className="mt-5 font-serif text-4xl leading-[0.9] tracking-[-0.045em] sm:text-6xl md:text-8xl">
                Good to see you,
                <br />
                {getEmailName(profile.email)}.
              </h1>

              <p className="mt-7 max-w-2xl text-[14px] leading-7 text-[#181716]/50">
                Manage your photography events, collaborate with your
                team, curate selections and publish client galleries.
              </p>
            </div>

            {/* Quote */}
            <div className="hidden border-l border-[#181716]/10 pl-8 pt-3 xl:block">
              <p className="font-serif text-xl italic leading-8 text-[#181716]/60">
                “Good photography builds real connections.”
              </p>

              <p className="mt-6 text-[9px] font-semibold uppercase tracking-[0.25em] text-[#181716]/35">
                Trizen
              </p>
            </div>

          </div>

          {/* =================================================
              STATISTICS
          ================================================== */}

          <div className="grid grid-cols-2 border-b border-[#181716]/10 md:grid-cols-4">

            <DashboardStat
              value={String(events.length).padStart(2, "0")}
              label="Active events"
              description="Photography projects"
            />

            <DashboardStat
              value={String(photoCount).padStart(2, "0")}
              label="Photos"
              description="Team uploads"
            />

            <DashboardStat
              value={String(galleryCount).padStart(2, "0")}
              label="Galleries"
              description="Client collections"
            />

            <DashboardStat
              value={String(teamCount).padStart(2, "0")}
              label="Team members"
              description="Photographers"
            />

          </div>

          {/* =================================================
              RECENT EVENTS
          ================================================== */}

          <section className="py-12">

            <div className="mb-7 flex items-end justify-between">

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#181716]/40">
                  Recent events
                </p>
              </div>

              <button
                onClick={() => router.push("/admin/events")}
                className="text-[11px] font-semibold uppercase tracking-[0.12em] transition hover:translate-x-1"
              >
                View all events →
              </button>

            </div>

            {events.length === 0 ? (

              <div className="border-y border-[#181716]/10 py-20 text-center">

                <p className="font-serif text-3xl">
                  Your first story starts here.
                </p>

                <p className="mt-3 text-sm text-[#181716]/45">
                  Create an event to begin collecting photographs.
                </p>

                <button
                  onClick={() => router.push("/admin/events/new")}
                  className="mt-6 border border-[#181716] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] transition hover:bg-[#181716] hover:text-white"
                >
                  Create event
                </button>

              </div>

            ) : (

              <div className="grid gap-8 md:grid-cols-2">

                {events.slice(0, 4).map((event, index) => (

                  <button
                    key={event.id}
                    onClick={() =>
                      router.push(`/admin/events/${event.id}`)
                    }
                    className="group grid grid-cols-1 gap-5 border-t border-[#181716]/10 pt-5 text-left sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-6"
                  >

                    {/* Image Area */}
                    <div className="relative aspect-[4/3] overflow-hidden bg-[#dedbd3]">

                      {event.thumbnail_url && (
                        <img
                          src={event.thumbnail_url}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                      )}

                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className={`font-serif text-5xl ${event.thumbnail_url ? "text-white/0" : "text-black/10"}`}>
                          {String(index + 1).padStart(2, "0")}
                        </span>
                      </div>

                      <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />

                    </div>

                    {/* Details */}
                    <div className="flex min-w-0 flex-col justify-between">

                      <div>

                        <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#181716]/35">
                          {event.event_date
                            ? formatDate(event.event_date)
                            : "Date not set"}
                        </p>

                        <h3 className="mt-3 font-serif text-2xl leading-tight">
                          {event.name}
                        </h3>

                        {event.description && (
                          <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-[#181716]/40">
                            {event.description}
                          </p>
                        )}

                      </div>

                      <div className="flex items-center justify-between border-t border-[#181716]/10 pt-3">

                        <span className="text-[9px] uppercase tracking-[0.15em] text-[#181716]/35">
                          Photography
                        </span>

                        <span className="text-[12px] transition group-hover:translate-x-1">
                          →
                        </span>

                      </div>

                    </div>

                  </button>

                ))}

              </div>

            )}

          </section>

          {/* =================================================
              WORKFLOW
          ================================================== */}

          <section className="border-t border-[#181716]/10 py-12">

            <div className="grid gap-10 lg:grid-cols-[300px_1fr]">

              <div>

                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#181716]/40">
                  Workflow
                </p>

                <h2 className="mt-5 font-serif text-4xl leading-tight tracking-[-0.03em]">
                  From capture
                  <br />
                  to delivery.
                </h2>

                <p className="mt-5 text-[13px] leading-6 text-[#181716]/45">
                  A simple, organized workflow to manage your photography
                  projects.
                </p>

              </div>

              <div className="grid border-y border-[#181716]/10 md:grid-cols-3">

                <WorkflowStep
                  number="01"
                  title="Collect"
                  description="Photographers upload their photographs."
                  active={photoCount > 0}
                />

                <WorkflowStep
                  number="02"
                  title="Curate"
                  description="Review and select the strongest images."
                  active={false}
                />

                <WorkflowStep
                  number="03"
                  title="Publish"
                  description="Share the finished gallery with your client."
                  active={galleryCount > 0}
                />

              </div>

            </div>

          </section>

          {/* =================================================
              QUICK ACTIONS
          ================================================== */}

          <section className="border-t border-[#181716]/10 pt-10">

            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#181716]/40">
              Quick actions
            </p>

            <div className="mt-6 grid gap-px border border-[#181716]/10 bg-[#181716]/10 md:grid-cols-2">

              <button
                onClick={() => router.push("/admin/events/new")}
                className="group bg-[#fffdf8] p-7 text-left transition hover:bg-[#efb44c]/20"
              >

                <span className="font-serif text-4xl">
                  +
                </span>

                <h3 className="mt-8 font-serif text-2xl">
                  Create new event
                </h3>

                <p className="mt-2 text-[12px] text-[#181716]/40">
                  Set up a new photography project.
                </p>

                <p className="mt-7 text-[11px] font-semibold uppercase tracking-[0.12em] opacity-50 transition group-hover:translate-x-1 group-hover:opacity-100">
                  Create event →
                </p>

              </button>

              <button
                onClick={() => router.push("/admin/events")}
                className="group bg-[#fffdf8] p-7 text-left transition hover:bg-[#176875]/10"
              >

                <span className="font-serif text-4xl">
                  02
                </span>

                <h3 className="mt-8 font-serif text-2xl">
                  Manage your projects
                </h3>

                <p className="mt-2 text-[12px] text-[#181716]/40">
                  View events, photographers and galleries.
                </p>

                <p className="mt-7 text-[11px] font-semibold uppercase tracking-[0.12em] opacity-50 transition group-hover:translate-x-1 group-hover:opacity-100">
                  View events →
                </p>

              </button>

            </div>

          </section>

          {/* Footer */}
          <footer className="flex flex-col justify-between gap-3 border-t border-[#181716]/10 py-8 sm:flex-row">

            <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#181716]/30">
              Trizen Photo Workspace
            </p>

            <p className="text-[9px] uppercase tracking-[0.18em] text-[#181716]/30">
              A more meaningful way to share photographs.
            </p>

          </footer>

        </section>
      </div>
    </main>
  );
}

/* ============================================================
   SIDEBAR ITEM
============================================================ */

function SidebarItem({
  label,
  icon,
  active,
  onPrefetch,
  onClick,
}: {
  label: string;
  icon: string;
  active?: boolean;
  onPrefetch?: () => void;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onPrefetch}
      className={`flex w-full items-center gap-4 px-4 py-3 text-left transition ${
        active
          ? "bg-[#ebe8e1] text-[#181716]"
          : "text-[#181716]/55 hover:bg-[#ebe8e1]/60 hover:text-[#181716]"
      }`}
    >
      <span className="w-5 text-center text-lg">
        {icon}
      </span>

      <span className="text-[13px] font-medium">
        {label}
      </span>
    </button>
  );
}

/* ============================================================
   DASHBOARD STAT
============================================================ */

function DashboardStat({
  value,
  label,
  description,
}: {
  value: string;
  label: string;
  description: string;
}) {
  return (
    <div className="border-r border-[#181716]/10 px-5 py-8 first:pl-0">

      <p className="font-serif text-5xl tracking-[-0.04em]">
        {value}
      </p>

      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#181716]/50">
        {label}
      </p>

      <p className="mt-1 text-[11px] text-[#181716]/35">
        {description}
      </p>

    </div>
  );
}

/* ============================================================
   WORKFLOW STEP
============================================================ */

function WorkflowStep({
  number,
  title,
  description,
  active,
}: {
  number: string;
  title: string;
  description: string;
  active: boolean;
}) {
  return (
    <div className="relative p-7">

      <div className="flex items-center justify-between">

        <span className="font-serif text-2xl text-[#181716]/30">
          {number}
        </span>

        <span
          className={`h-2 w-2 rounded-full ${
            active
              ? "bg-[#181716]"
              : "border border-[#181716]/30"
          }`}
        />

      </div>

      <h3 className="mt-10 text-[12px] font-semibold uppercase tracking-[0.16em]">
        {title}
      </h3>

      <p className="mt-3 max-w-[180px] text-[12px] leading-5 text-[#181716]/40">
        {description}
      </p>

    </div>
  );
}

/* ============================================================
   HELPERS
============================================================ */

function getInitials(name: string) {
  if (!name || name === "User") {
    return "U";
  }

  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

function getEmailName(email: string) {
  const localPart = email.split("@")[0]?.trim() || "there";
  return localPart
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}