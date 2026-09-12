"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../src/lib/supabase/client";

type Role = "ADMIN" | "TEAM_MEMBER";

type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: Role;
};

type Event = {
  id: string;
  name: string;
  description: string | null;
  event_date: string | null;
  thumbnail_path?: string | null;
  thumbnail_url?: string;
};

type Member = {
  id: string;
  event_id: string;
  user_id: string;
};

type Photo = {
  id: string;
  event_id: string;
  uploaded_by: string;
  filename: string;
  storage_path: string;
  file_size: number;
  created_at: string;
  preview_url?: string;
};

type PhotographerActivity = Profile & {
  uploadCount: number;
  eventCount: number;
};

type PreviewFile = {
  file: File;
  url: string;
};

/* ============================================================
   CONFIG
============================================================ */

const BUCKET = "photos";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

const MAX_INITIAL_PHOTOS = 20;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

/* ============================================================
   MAIN PAGE
============================================================ */

export default function TeamPage() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [photographers, setPhotographers] =
    useState<Profile[]>([]);

  const [events, setEvents] =
    useState<Event[]>([]);

  const [memberships, setMemberships] =
    useState<Member[]>([]);

  const [photos, setPhotos] =
    useState<Photo[]>([]);

  const [selectedEventId, setSelectedEventId] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  /* ==========================================================
     LOAD WORKSPACE
  ========================================================== */

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      await loadWorkspace(mounted);
    }

    initialize();

    return () => {
      mounted = false;
    };
  }, []);

  async function loadWorkspace(
    mounted = true
  ) {
    try {
      setLoading(true);
      setError("");

      /*
       * getSession() reads the existing browser session
       * without making an unnecessary auth round trip.
       */
      const {
      data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
      console.error("Workspace: no active session");
      router.replace("/login");
      return;
     }

      const currentUser = session.user;

      console.log("TEAM SESSION USER:", currentUser.email);
      console.log("TEAM SESSION USER ID:", currentUser.id);
      

      /*
       * PROFILE + MEMBERSHIP
       *
       * These two requests do not depend on each other,
       * so run them simultaneously.
       */
      const [
        profileResult,
        membershipResult,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, full_name, email, role"
          )
          .eq("id", currentUser.id)
          .single(),

        supabase
          .from("event_members")
          .select(
            "id, event_id, user_id"
          )
          .eq("user_id", currentUser.id),
      ]);

      if (!mounted) return;

      const {
        data: profileData,
        error: profileError,
      } = profileResult;

      const {
        data: membershipData,
        error: membershipError,
      } = membershipResult;

       if (profileError || !profileData) {
       console.error("Profile unavailable:", profileError);

       await supabase.auth.signOut();

       router.replace("/login");
       return;
       }
      /*
       * Both ADMIN and TEAM_MEMBER can access /team.
       */
      if (
        profileData.role !== "ADMIN" &&
        profileData.role !== "TEAM_MEMBER"
      ) {
        router.replace("/login");
        return;
      }

      if (
        profileData.role === "TEAM_MEMBER" &&
        currentUser.user_metadata?.password_set === false
      ) {
        router.replace("/account/password");
        return;
      }

      setProfile(
        profileData as Profile
      );

      /*
       * ========================================================
       * ADMIN
       * ========================================================
       */

      if (
        profileData.role === "ADMIN"
      ) {
        await loadAdminWorkspace();

        if (mounted) {
          setLoading(false);
        }

        return;
      }

      /*
       * ========================================================
       * TEAM MEMBER
       * ========================================================
       */

      if (membershipError) {
        console.error(
          membershipError
        );

        setEvents([]);
        setPhotos([]);
        return;
      }

      const memberData =
        (membershipData ||
          []) as Member[];

      setMemberships(memberData);

      const eventIds =
        memberData.map(
          (item) => item.event_id
        );

      /*
       * No assignments.
       */
      if (eventIds.length === 0) {
        setEvents([]);
        setPhotos([]);

        return;
      }

      /*
       * EVENTS + PHOTOS
       *
       * These can also be loaded simultaneously.
       */
      const [
        eventsResult,
        photosResult,
      ] = await Promise.all([
        supabase
          .from("events")
          .select(
            "id, name, description, event_date, thumbnail_path"
          )
          .in("id", eventIds)
          .order("event_date", {
            ascending: true,
            nullsFirst: false,
          }),

        supabase
          .from("photos")
          .select(
            "id, event_id, uploaded_by, filename, storage_path, file_size, created_at"
          )
          .eq(
            "uploaded_by",
            currentUser.id
          )
          .order("created_at", {
            ascending: false,
          })
          .limit(
            MAX_INITIAL_PHOTOS
          ),
      ]);

      if (!mounted) return;

      if (eventsResult.error) {
        console.error(
          eventsResult.error
        );
      }

      if (photosResult.error) {
        console.error(
          photosResult.error
        );
      }

      const loadedEvents =
        (eventsResult.data ||
          []) as Event[];

      const thumbnailPaths = loadedEvents
        .map((event) => event.thumbnail_path)
        .filter((path): path is string => Boolean(path));
      const { data: thumbnailUrls } = thumbnailPaths.length
        ? await supabase.storage.from(BUCKET).createSignedUrls(thumbnailPaths, 60 * 60)
        : { data: [] };
      const thumbnailUrlByPath = Object.fromEntries(
        (thumbnailUrls || [])
          .filter((item) => item.signedUrl)
          .map((item) => [item.path, item.signedUrl])
      );
      const eventsWithThumbnails = loadedEvents.map((event) => ({
        ...event,
        thumbnail_url: event.thumbnail_path
          ? thumbnailUrlByPath[event.thumbnail_path] || ""
          : "",
      }));

      const loadedPhotos =
        (photosResult.data ||
          []) as Photo[];

      setEvents(eventsWithThumbnails);

      /*
       * Select first event automatically.
       */
      if (loadedEvents.length > 0) {
        setSelectedEventId(
          (current) =>
            current ||
            eventsWithThumbnails[0].id
        );
      }

      /*
       * No photographs.
       */
      if (
        loadedPhotos.length === 0
      ) {
        setPhotos([]);
        return;
      }

      /*
       * ========================================================
       * BATCH SIGNED URL GENERATION
       * ========================================================
       *
       * Instead of:
       *
       * createSignedUrl()
       * createSignedUrl()
       * createSignedUrl()
       *
       * use one batch request.
       */
      const storagePaths =
        loadedPhotos.map(
          (photo) =>
            photo.storage_path
        );

      const {
        data: signedUrls,
        error: signedUrlError,
      } =
        await supabase.storage
          .from(BUCKET)
          .createSignedUrls(
            storagePaths,
            60 * 60
          );

      if (signedUrlError) {
        console.error(
          "Signed URL error:",
          signedUrlError
        );
      }

      const photosWithUrls =
        loadedPhotos.map(
          (photo, index) => ({
            ...photo,
            preview_url:
              signedUrls?.[index]
                ?.signedUrl || "",
          })
        );

      if (!mounted) return;

      setPhotos(
        photosWithUrls
      );
    } catch (err) {
      console.error(
        "Workspace loading error:",
        err
      );

      if (mounted) {
        setError(
          "Unable to load the workspace. Please refresh and try again."
        );
      }
    } finally {
      if (mounted) {
        setLoading(false);
      }
    }
  }

  /* ============================================================
     ADMIN WORKSPACE DATA
  ============================================================ */

  async function loadAdminWorkspace() {
    /*
     * All four requests are independent.
     *
     * Run them together.
     */
    const [
      photographersResult,
      eventsResult,
      membershipsResult,
      photosResult,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, full_name, email, role"
        )
        .eq(
          "role",
          "TEAM_MEMBER"
        )
        .order("full_name"),

      supabase
        .from("events")
        .select(
          "id, name, description, event_date, thumbnail_path"
        )
        .order("event_date", {
          ascending: true,
          nullsFirst: false,
        }),

      supabase
        .from("event_members")
        .select(
          "id, event_id, user_id"
        ),

      supabase
        .from("photos")
        .select(
          "id, event_id, uploaded_by, filename, storage_path, file_size, created_at"
        )
        .order("created_at", {
          ascending: false,
        })
        .limit(500),
    ]);

    setPhotographers(
      (photographersResult.data ||
        []) as Profile[]
    );

    setEvents(
      (eventsResult.data ||
        []) as Event[]
    );

    setMemberships(
      (membershipsResult.data ||
        []) as Member[]
    );

    setPhotos(
      (photosResult.data ||
        []) as Photo[]
    );
  }

  /* ============================================================
     SIGN OUT
  ============================================================ */

  async function handleSignOut() {
    await supabase.auth.signOut();

    router.replace("/login");
  }

  /* ============================================================
     LOADING
  ============================================================ */

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f4ee]">
        <div className="text-center">

          <div className="mx-auto h-5 w-5 animate-spin rounded-full border border-black/20 border-t-black" />

          <p className="mt-4 text-[10px] uppercase tracking-[0.2em] text-black/40">
            Loading workspace
          </p>

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
            onClick={() => window.location.reload()}
            className="mt-6 border border-[#17212b] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em]"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  /* ============================================================
     ADMIN
  ============================================================ */

  if (profile.role === "ADMIN") {
    return (
      <AdminWorkspace
        profile={profile}
        photographers={photographers}
        events={events}
        memberships={memberships}
        photos={photos}
        router={router}
        handleSignOut={handleSignOut}
        loadAdminWorkspace={
          loadAdminWorkspace
        }
        error={error}
        success={success}
        setError={setError}
        setSuccess={setSuccess}
      />
    );
  }

  /* ============================================================
     TEAM MEMBER
  ============================================================ */

  return (
    <TeamMemberWorkspace
      profile={profile}
      events={events}
      photos={photos}
      selectedEventId={
        selectedEventId
      }
      setSelectedEventId={
        setSelectedEventId
      }
      router={router}
      handleSignOut={
        handleSignOut
      }
      supabase={supabase}
      setPhotos={setPhotos}
      error={error}
      success={success}
      setError={setError}
      setSuccess={setSuccess}
    />
  );
}

/* ==============================================================
   ADMIN WORKSPACE
============================================================== */

function AdminWorkspace({
  profile,
  photographers,
  events,
  memberships,
  photos,
  router,
  handleSignOut,
  loadAdminWorkspace,
  error,
  success,
  setError,
  setSuccess,
}: {
  profile: Profile;
  photographers: Profile[];
  events: Event[];
  memberships: Member[];
  photos: Photo[];
  router: ReturnType<
    typeof useRouter
  >;
  handleSignOut: () => Promise<void>;
  loadAdminWorkspace: () => Promise<void>;
  error: string;
  success: string;
  setError: (
    value: string
  ) => void;
  setSuccess: (
    value: string
  ) => void;
}) {
  const supabase = createClient();

  const [
    showAssignModal,
    setShowAssignModal,
  ] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPhotographerName, setNewPhotographerName] = useState("");
  const [newPhotographerEmail, setNewPhotographerEmail] = useState("");
  const [creatingPhotographer, setCreatingPhotographer] = useState(false);
  const [setupLink, setSetupLink] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [deletingPhotographer, setDeletingPhotographer] = useState<string | null>(null);

  const [
    assignPhotographer,
    setAssignPhotographer,
  ] = useState("");

  const [
    assignEvent,
    setAssignEvent,
  ] = useState("");

  const [
    assigning,
    setAssigning,
  ] = useState(false);

  const [
    removing,
    setRemoving,
  ] = useState<string | null>(
    null
  );

  const activity =
    useMemo(() => {
      return photographers.map(
        (person) => ({
          ...person,

          uploadCount:
            photos.filter(
              (photo) =>
                photo.uploaded_by ===
                person.id
            ).length,

          eventCount:
            memberships.filter(
              (member) =>
                member.user_id ===
                person.id
            ).length,
        })
      );
    }, [
      photographers,
      photos,
      memberships,
    ]);

  async function createPhotographer() {
    setCreatingPhotographer(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/photographers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: newPhotographerName,
          email: newPhotographerEmail,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Unable to create photographer account.");
        return;
      }

      setSetupLink(result.setupLink);
      setSuccess(`${result.photographer.full_name} was added to your team.`);
      setNewPhotographerName("");
      setNewPhotographerEmail("");
      await loadAdminWorkspace();
    } catch {
      setError("Unable to create photographer account.");
    } finally {
      setCreatingPhotographer(false);
    }
  }

  async function copySetupLink() {
    if (!setupLink) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(setupLink);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = setupLink;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const copied = document.execCommand("copy");
        document.body.removeChild(textArea);
        if (!copied) throw new Error("Copy command was rejected.");
      }

      setLinkCopied(true);
      setSuccess("Setup link copied. Send it to the photographer securely.");
      window.setTimeout(() => setLinkCopied(false), 2500);
    } catch {
      setError("Copy was blocked by the browser. Select the link and copy it manually.");
    }
  }

  async function deletePhotographer(photographer: Profile) {
    if (!window.confirm(`Delete ${photographer.full_name}'s account? This removes their profile and event assignments.`)) return;
    setDeletingPhotographer(photographer.id);
    setError("");
    setSuccess("");
    try {
      const {
  data: { session },
} = await supabase.auth.getSession();

if (!session?.access_token) {
  setError("Your admin session has expired. Please log in again.");
  return;
}

const response = await fetch("/api/admin/photographers", {
  method: "DELETE",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  },
  body: JSON.stringify({
    photographerId: photographer.id,
  }),
});
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "Unable to delete photographer.");
        return;
      }
      setSuccess(`${photographer.full_name}'s account was deleted.`);
      await loadAdminWorkspace();
    } catch {
      setError("Unable to delete photographer.");
    } finally {
      setDeletingPhotographer(null);
    }
  }

  async function assignPhotographerToEvent() {
    if (
      !assignPhotographer ||
      !assignEvent
    ) {
      return;
    }

    setAssigning(true);
    setError("");
    setSuccess("");

    const { error } =
      await supabase
        .from("event_members")
        .insert({
          event_id: assignEvent,
          user_id:
            assignPhotographer,
        });

    if (error) {
      setError(
        error.message
      );
      setAssigning(false);
      return;
    }

    setSuccess(
      "Photographer assigned successfully."
    );

    setAssignPhotographer("");
    setAssignEvent("");
    setShowAssignModal(false);

    await loadAdminWorkspace();

    setAssigning(false);
  }

  async function removePhotographer(
    membershipId: string
  ) {
    const confirmed =
      window.confirm(
        "Remove this photographer from the event?"
      );

    if (!confirmed) {
      return;
    }

    setRemoving(
      membershipId
    );

    setError("");
    setSuccess("");

    const { error } =
      await supabase
        .from("event_members")
        .delete()
        .eq(
          "id",
          membershipId
        );

    if (error) {
      setError(
        error.message
      );
      setRemoving(null);
      return;
    }

    setSuccess(
      "Photographer removed from the event."
    );

    await loadAdminWorkspace();

    setRemoving(null);
  }

  function openAssignModal(
    photographerId = "",
    eventId = ""
  ) {
    setAssignPhotographer(
      photographerId
    );

    setAssignEvent(
      eventId
    );

    setShowAssignModal(true);

    setError("");
    setSuccess("");
  }

  return (
    <main className="min-h-screen bg-[#f7f4ee] text-[#17212b]">

      {/* Sidebar */}

      <aside className="fixed inset-y-0 left-0 hidden w-[255px] border-r border-[#181716]/10 bg-[#f5f3ee] lg:block">

        <div className="flex h-full flex-col px-5 py-7">

          <div className="px-4">

            <button
              onClick={() =>
                router.push("/admin")
              }
              className="block text-left"
            >
              <Image src="/studio-trizen-logo.png" alt="Studio Trizen" width={96} height={76} className="h-12 w-16 object-contain" />
              <span className="sr-only">Studio Trizen</span>
            </button>

            <p className="mt-1 text-[9px] uppercase tracking-[0.28em] text-[#181716]/45">
              Photo Workspace
            </p>

          </div>

          <div className="mt-16">

            <p className="px-4 text-[9px] font-semibold uppercase tracking-[0.28em] text-[#181716]/35">
              Workspace
            </p>

            <nav className="mt-4 space-y-1">

              <SidebarLink
                label="Overview"
                icon="⌂"
                onClick={() =>
                  router.push(
                    "/admin"
                  )
                }
              />

              <SidebarLink
                label="Events"
                icon="□"
                onClick={() =>
                  router.push(
                    "/admin/events"
                  )
                }
              />

              <SidebarLink
                label="Photos"
                icon="▧"
                onClick={() =>
                  router.push(
                    "/admin/photos"
                  )
                }
              />

              <SidebarLink
                label="Galleries"
                icon="▱"
                onClick={() =>
                  router.push(
                    "/admin/galleries"
                  )
                }
              />

              <SidebarLink
                label="Team"
                icon="♧"
                active
                onClick={() =>
                  router.push(
                    "/team"
                  )
                }
              />

            </nav>

          </div>

          <div className="mt-auto">

            <button
              onClick={() => router.push("/account/password")}
              className="flex w-full items-center gap-4 px-4 py-3 text-left text-[13px] text-[#181716]/55 transition hover:text-[#176875]"
            >
              <span className="text-lg">✦</span>
              Password & security
            </button>

            <button
              onClick={
                handleSignOut
              }
              className="flex w-full items-center gap-4 px-4 py-3 text-left text-[13px] text-[#181716]/55 transition hover:text-[#181716]"
            >
              <span className="text-lg">
                ↪
              </span>

              Sign out
            </button>

            <div className="mt-7 border-t border-[#181716]/10 px-4 pt-6">

              <div className="flex items-center gap-3">

                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#181716] text-xs font-semibold text-white">
                  {getInitials(
                    profile.full_name
                  )}
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

      {/* Main */}

      <div className="lg:pl-[255px]">

        <header className="border-b border-[#181716]/10">

          <div className="flex items-center justify-between px-6 py-5 lg:px-10">

            <div>

              <p className="text-[11px] uppercase tracking-[0.2em] text-[#181716]/45">
                Team management
              </p>

              <p className="mt-1 text-[13px] font-medium">
                Photography operations
              </p>

            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <button onClick={() => { setSetupLink(""); setShowCreateModal(true); }} className="rounded-full border border-[#17212b]/15 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] transition hover:border-[#e5763f] hover:text-[#e5763f]">+ Add photographer</button>
              <button onClick={() => setShowAssignModal(true)} className="rounded-full border border-[#e5763f] bg-[#e5763f] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-[#17212b]">Assign photographer</button>
              <button onClick={() => router.push("/account/password")} className="rounded-full border border-[#17212b]/15 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] transition hover:border-[#176875] hover:text-[#176875]">Password</button>
            </div>

          </div>

        </header>

        <section className="mx-auto max-w-[1400px] px-6 py-12 lg:px-10 lg:py-16">

          {/* Hero */}

          <div className="border-b border-[#181716]/10 pb-12">

            <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[#181716]/40">
              Team / Overview
            </p>

            <div className="mt-6 grid gap-10 xl:grid-cols-[1fr_300px]">

              <div>

                <h1 className="font-serif text-6xl leading-[0.9] tracking-[-0.045em] md:text-8xl">
                  Your
                  <br />
                  photographers.
                </h1>

                <p className="mt-7 max-w-2xl text-[14px] leading-7 text-[#181716]/50">
                  Build your photography team,
                  assign events, monitor uploads
                  and keep every project moving
                  from capture to delivery.
                </p>

              </div>

              <div className="border-l border-[#181716]/10 pl-8 pt-3">

                <p className="font-serif text-xl italic leading-8 text-[#181716]/55">
                  “Great teams turn moments into stories.”
                </p>

                <p className="mt-6 text-[9px] font-semibold uppercase tracking-[0.25em] text-[#181716]/35">
                  Trizen
                </p>

              </div>

            </div>

          </div>

          {/* Stats */}

          <div className="grid grid-cols-2 border-b border-[#181716]/10 md:grid-cols-4">

            <AdminStat
              value={String(
                photographers.length
              ).padStart(2, "0")}
              label="Photographers"
              description="Active team"
            />

            <AdminStat
              value={String(
                events.length
              ).padStart(2, "0")}
              label="Events"
              description="Photography projects"
            />

            <AdminStat
              value={String(
                photos.length
              ).padStart(2, "0")}
              label="Uploads"
              description="Team photographs"
            />

            <AdminStat
              value={String(
                memberships.length
              ).padStart(2, "0")}
              label="Assignments"
              description="Event placements"
            />

          </div>

          {error && (
            <div className="mt-6 border-l-2 border-red-700 bg-red-700/5 px-4 py-3 text-[12px] text-red-800">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-6 border-l-2 border-green-700 bg-green-700/5 px-4 py-3 text-[12px] text-green-800">
              {success}
            </div>
          )}

          {/* Photographers */}

          <section className="py-12">

            <div className="border-b border-[#181716]/10 pb-6">

              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#181716]/40">
                01 / Team
              </p>

              <h2 className="mt-3 font-serif text-4xl tracking-[-0.03em]">
                All photographers
              </h2>

            </div>

            {photographers.length === 0 ? (

              <div className="py-20 text-center">

                <p className="font-serif text-3xl">
                  No photographers yet.
                </p>

                <p className="mt-3 text-sm text-[#181716]/45">
                  Team members will appear here
                  once their accounts are created.
                </p>

              </div>

            ) : (

              <div className="divide-y divide-[#181716]/10">

                {photographers.map(
                  (
                    photographer,
                    index
                  ) => {

                    const personActivity =
                      activity.find(
                        (item) =>
                          item.id ===
                          photographer.id
                      );

                    return (
                      <div
                        key={
                          photographer.id
                        }
                        className="grid gap-5 py-7 lg:grid-cols-[60px_1fr_180px_180px_160px]"
                      >

                        <div className="font-serif text-2xl text-[#181716]/20">
                          {String(
                            index + 1
                          ).padStart(
                            2,
                            "0"
                          )}
                        </div>

                        <div>

                          <h3 className="text-[15px] font-semibold">
                            {
                              photographer.full_name
                            }
                          </h3>

                          <p className="mt-1 text-[12px] text-[#181716]/40">
                            {
                              photographer.email
                            }
                          </p>

                        </div>

                        <div>

                          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#181716]/35">
                            Events
                          </p>

                          <p className="mt-2 font-serif text-2xl">
                            {
                              personActivity?.eventCount ||
                              0
                            }
                          </p>

                        </div>

                        <div>

                          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#181716]/35">
                            Uploads
                          </p>

                          <p className="mt-2 font-serif text-2xl">
                            {
                              personActivity?.uploadCount ||
                              0
                            }
                          </p>

                        </div>

                        <div className="flex flex-wrap items-center gap-4 lg:justify-end">

                          <button
                            onClick={() =>
                              openAssignModal(
                                photographer.id
                              )
                            }
                            className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#181716]/50 transition hover:text-[#181716]"
                          >
                            Assign event →
                          </button>

                          <button
                            onClick={() => deletePhotographer(photographer)}
                            disabled={deletingPhotographer === photographer.id}
                            className="text-[10px] font-semibold uppercase tracking-[0.12em] text-red-700/60 transition hover:text-red-700 disabled:opacity-40"
                          >
                            {deletingPhotographer === photographer.id ? "Deleting..." : "Delete"}
                          </button>

                        </div>

                      </div>
                    );
                  }
                )}

              </div>

            )}

          </section>

          {/* Assignments */}

          <section className="border-t border-[#181716]/10 py-12">

            <div className="border-b border-[#181716]/10 pb-6">

              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#181716]/40">
                02 / Assignments
              </p>

              <h2 className="mt-3 font-serif text-4xl">
                Assigned events
              </h2>

            </div>

            <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">

              {events.map(
                (event, index) => {

                  const eventMembers =
                    memberships.filter(
                      (member) =>
                        member.event_id ===
                        event.id
                    );

                  const eventAccent = [
                    {
                      border: "border-t-[#e5763f]",
                      tint: "bg-[#fff1e8]",
                      label: "text-[#c45d2d]",
                      badge: "bg-[#e5763f] text-white",
                    },
                    {
                      border: "border-t-[#176875]",
                      tint: "bg-[#e8f4f3]",
                      label: "text-[#176875]",
                      badge: "bg-[#176875] text-white",
                    },
                    {
                      border: "border-t-[#efb44c]",
                      tint: "bg-[#fff8e6]",
                      label: "text-[#a16e08]",
                      badge: "bg-[#efb44c] text-[#17212b]",
                    },
                  ][index % 3];

                  return (
                    <div
                      key={event.id}
                      className={`border border-[#181716]/10 border-t-4 ${eventAccent.border} p-6 transition-shadow hover:shadow-[0_10px_30px_rgba(23,33,43,0.08)]`}
                    >

                      <div className={`-mx-6 -mt-6 mb-6 flex items-start justify-between p-6 pb-5 ${eventAccent.tint}`}>

                        <div>

                          <p className={`text-[9px] font-semibold uppercase tracking-[0.18em] ${eventAccent.label}`}>
                            {event.event_date
                              ? formatDate(
                                  event.event_date
                                )
                              : "Date not set"}
                          </p>

                          <h3 className="mt-3 font-serif text-2xl">
                            {event.name}
                          </h3>

                        </div>

                        <span className={`flex h-9 min-w-9 items-center justify-center px-2 font-serif text-xl ${eventAccent.badge}`}>
                          {String(
                            eventMembers.length
                          ).padStart(
                            2,
                            "0"
                          )}
                        </span>

                      </div>

                      <div className="mt-7 border-t border-[#181716]/10 pt-5">

                        {eventMembers.length ===
                        0 ? (

                          <p className="text-[12px] text-[#181716]/40">
                            No photographers assigned.
                          </p>

                        ) : (

                          <div className="space-y-4">

                            {eventMembers.map(
                              (
                                member
                              ) => {

                                const person =
                                  photographers.find(
                                    (
                                      item
                                    ) =>
                                      item.id ===
                                      member.user_id
                                  );

                                if (!person) {
                                  return null;
                                }

                                return (
                                  <div
                                    key={
                                      member.id
                                    }
                                    className="flex items-center justify-between gap-3"
                                  >

                                    <div className="min-w-0">

                                      <p className="truncate text-[12px] font-semibold">
                                        {
                                          person.full_name
                                        }
                                      </p>

                                      <p className="truncate text-[10px] text-[#181716]/35">
                                        {
                                          person.email
                                        }
                                      </p>

                                    </div>

                                    <button
                                      onClick={() =>
                                        removePhotographer(
                                          member.id
                                        )
                                      }
                                      disabled={
                                        removing ===
                                        member.id
                                      }
                                      className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#181716]/30 hover:text-red-700"
                                    >
                                      {removing ===
                                      member.id
                                        ? "..."
                                        : "Remove"}
                                    </button>

                                  </div>
                                );
                              }
                            )}

                          </div>

                        )}

                        <button
                          onClick={() =>
                            openAssignModal(
                              "",
                              event.id
                            )
                          }
                          className="mt-6 w-full border border-[#181716]/15 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] transition hover:border-[#181716]"
                        >
                          + Assign photographer
                        </button>

                      </div>

                    </div>
                  );
                }
              )}

            </div>

          </section>

          {/* Activity */}

          <section className="border-t border-[#181716]/10 py-12">

            <div className="border-b border-[#181716]/10 pb-6">

              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#181716]/40">
                03 / Activity
              </p>

              <h2 className="mt-3 font-serif text-4xl">
                Photographer activity
              </h2>

            </div>

            <div className="mt-7 border-y border-[#181716]/10">

              {activity.map(
                (
                  person,
                  index
                ) => (

                  <div
                    key={person.id}
                    className="grid gap-5 border-b border-[#181716]/10 py-6 last:border-b-0 md:grid-cols-[60px_1fr_150px_150px]"
                  >

                    <span className="font-serif text-xl text-[#181716]/20">
                      {String(
                        index + 1
                      ).padStart(
                        2,
                        "0"
                      )}
                    </span>

                    <div>

                      <p className="text-[13px] font-semibold">
                        {
                          person.full_name
                        }
                      </p>

                      <p className="mt-1 text-[10px] text-[#181716]/35">
                        {
                          person.email
                        }
                      </p>

                    </div>

                    <div>

                      <p className="text-[9px] uppercase tracking-[0.15em] text-[#181716]/35">
                        Uploads
                      </p>

                      <p className="mt-2 font-serif text-2xl">
                        {
                          person.uploadCount
                        }
                      </p>

                    </div>

                    <div>

                      <p className="text-[9px] uppercase tracking-[0.15em] text-[#181716]/35">
                        Assignments
                      </p>

                      <p className="mt-2 font-serif text-2xl">
                        {
                          person.eventCount
                        }
                      </p>

                    </div>

                  </div>

                )
              )}

            </div>

          </section>

          <footer className="border-t border-[#181716]/10 py-8">

            <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#181716]/30">
              Trizen Photo Workspace
            </p>

          </footer>

        </section>

      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5 backdrop-blur-sm">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto bg-[#f5f3ee] p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between border-b border-[#181716]/10 pb-6">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#176875]">Team access</p>
                <h2 className="mt-3 font-serif text-3xl">Add photographer</h2>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-2xl text-[#181716]/40" aria-label="Close">×</button>
            </div>

            {!setupLink ? (
              <div className="space-y-5 py-7">
                <p className="text-sm leading-6 text-[#181716]/55">Create an Auth account with the photographer&apos;s name and email. They will set their own password from the secure setup link.</p>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.15em]">Full name<input value={newPhotographerName} onChange={(event) => setNewPhotographerName(event.target.value)} className="mt-2 w-full border-b border-[#181716]/20 bg-transparent py-3 text-sm outline-none focus:border-[#e5763f]" placeholder="Aarav Sharma" /></label>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.15em]">Email address<input type="email" value={newPhotographerEmail} onChange={(event) => setNewPhotographerEmail(event.target.value)} className="mt-2 w-full border-b border-[#181716]/20 bg-transparent py-3 text-sm outline-none focus:border-[#e5763f]" placeholder="aarav@example.com" /></label>
                <div className="flex justify-end border-t border-[#181716]/10 pt-6"><button onClick={createPhotographer} disabled={creatingPhotographer || !newPhotographerName.trim() || !newPhotographerEmail.trim()} className="rounded-full bg-[#17212b] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-40">{creatingPhotographer ? "Creating..." : "Create account"}</button></div>
              </div>
            ) : (
              <div className="space-y-5 py-7">
                <div className="border-l-2 border-[#176875] bg-[#176875]/10 px-4 py-3 text-sm leading-6 text-[#176875]">Account created. Share this setup link with the photographer so they can choose their password.</div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.15em]">Secure setup link<textarea readOnly value={setupLink} onFocus={(event) => event.currentTarget.select()} className="mt-2 h-24 w-full resize-none border border-[#181716]/15 bg-white p-3 text-xs leading-5 outline-none focus:border-[#e5763f]" /></label>
                <div className="flex justify-end gap-4 border-t border-[#181716]/10 pt-6"><button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#181716]/50">Done</button><button type="button" onClick={copySetupLink} disabled={!setupLink} className="rounded-full bg-[#e5763f] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-[#17212b] disabled:cursor-not-allowed disabled:opacity-50">{linkCopied ? "Copied" : "Copy setup link"}</button></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Assign Modal */}

      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5 backdrop-blur-sm">

          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto bg-[#f5f3ee] p-6 shadow-2xl sm:p-8">

            <div className="flex items-start justify-between border-b border-[#181716]/10 pb-6">

              <div>

                <p className="text-[10px] uppercase tracking-[0.2em] text-[#181716]/35">
                  Assignment
                </p>

                <h2 className="mt-3 font-serif text-3xl">
                  Assign photographer
                </h2>

              </div>

              <button
                onClick={() =>
                  setShowAssignModal(
                    false
                  )
                }
                className="text-2xl text-[#181716]/40"
              >
                ×
              </button>

            </div>

            <div className="space-y-6 py-7">

              <div>

                <label className="text-[10px] font-semibold uppercase tracking-[0.15em]">
                  Photographer
                </label>

                <select
                  value={
                    assignPhotographer
                  }
                  onChange={(event) =>
                    setAssignPhotographer(
                      event.target.value
                    )
                  }
                  className="mt-3 w-full border-b border-[#181716]/20 bg-transparent py-4 text-[14px] outline-none"
                >

                  <option value="">
                    Choose photographer
                  </option>

                  {photographers.map(
                    (person) => (
                      <option key={person.id} value={person.id}>
                        {person.full_name}
                      </option>
                    )
                  )}

                </select>

              </div>

              <div>

                <label className="text-[10px] font-semibold uppercase tracking-[0.15em]">
                  Event
                </label>

                <select
                  value={assignEvent}
                  onChange={(event) =>
                    setAssignEvent(
                      event.target.value
                    )
                  }
                  className="mt-3 w-full border-b border-[#181716]/20 bg-transparent py-4 text-[14px] outline-none"
                >

                  <option value="">
                    Choose event
                  </option>

                  {events.map(
                    (event) => (
                      <option
                        key={event.id}
                        value={event.id}
                      >
                        {event.name}
                      </option>
                    )
                  )}

                </select>

              </div>

            </div>

            <div className="flex justify-end gap-5 border-t border-[#181716]/10 pt-6">

              <button
                onClick={() =>
                  setShowAssignModal(
                    false
                  )
                }
                className="text-[12px] text-[#181716]/45"
              >
                Cancel
              </button>

              <button
                onClick={assignPhotographerToEvent}
                disabled={
                  !assignPhotographer ||
                  !assignEvent ||
                  assigning
                }
                className="border border-[#181716] bg-[#181716] px-6 py-3 text-[12px] font-semibold text-white disabled:opacity-40"
              >
                {assigning
                  ? "Assigning..."
                  : "Assign photographer"}
              </button>

            </div>

          </div>

        </div>
      )}

    </main>
  );
}

/* ==============================================================
   TEAM MEMBER WORKSPACE
============================================================== */

function TeamMemberWorkspace({
  profile,
  events,
  photos,
  selectedEventId,
  setSelectedEventId,
  router,
  handleSignOut,
  supabase,
  setPhotos,
  error,
  success,
  setError,
  setSuccess,
}: {
  profile: Profile;
  events: Event[];
  photos: Photo[];
  selectedEventId: string;
  setSelectedEventId: (
    value: string
  ) => void;
  router: ReturnType<
    typeof useRouter
  >;
  handleSignOut: () => Promise<void>;
  supabase: ReturnType<
    typeof createClient
  >;
  setPhotos: (
    value: Photo[]
  ) => void;
  error: string;
  success: string;
  setError: (
    value: string
  ) => void;
  setSuccess: (
    value: string
  ) => void;
}) {
  const [
    previewFiles,
    setPreviewFiles,
  ] = useState<PreviewFile[]>(
    []
  );

  const [
    uploading,
    setUploading,
  ] = useState(false);

  const [
    uploadProgress,
    setUploadProgress,
  ] = useState(0);

  const [
    dragActive,
    setDragActive,
  ] = useState(false);

  const dragDepth = useRef(0);

  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);

  async function deletePhoto(photo: Photo) {
    if (!window.confirm(`Delete ${photo.filename}? This cannot be undone.`)) return;

    setDeletingPhotoId(photo.id);
    setError("");
    setSuccess("");

    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .remove([photo.storage_path]);

    if (storageError) {
      setError(`Could not delete the image: ${storageError.message}`);
      setDeletingPhotoId(null);
      return;
    }

    const { error: databaseError } = await supabase
      .from("photos")
      .delete()
      .eq("id", photo.id)
      .eq("uploaded_by", profile.id);

    if (databaseError) {
      setError(`The image file was removed, but its record could not be deleted: ${databaseError.message}`);
      setDeletingPhotoId(null);
      return;
    }

    setPhotos(photos.filter((item) => item.id !== photo.id));
    setSuccess("Photograph deleted.");
    setDeletingPhotoId(null);
  }

  const selectedEvent =
    events.find(
      (event) =>
        event.id ===
        selectedEventId
    );

  const selectedEventPhotos =
    photos.filter(
      (photo) =>
        photo.event_id ===
        selectedEventId
    );

  function handleFiles(
    files: FileList | File[]
  ) {
    setError("");
    setSuccess("");

    const incoming =
      Array.from(files);

    if (
      incoming.length === 0
    ) {
      return;
    }

    const invalidType =
      incoming.find(
        (file) =>
          !ALLOWED_TYPES.includes(
            file.type
          )
      );

    if (invalidType) {
      setError(
        `"${invalidType.name}" is not supported. Use JPEG, PNG or WebP.`
      );

      return;
    }

    const oversized =
      incoming.find(
        (file) =>
          file.size >
          MAX_FILE_SIZE
      );

    if (oversized) {
      setError(
        `"${oversized.name}" is larger than 20 MB.`
      );

      return;
    }

    const previews =
      incoming.map(
        (file) => ({
          file,
          url: URL.createObjectURL(
            file
          ),
        })
      );

    setPreviewFiles(
      (current) => [
        ...current,
        ...previews,
      ]
    );
  }

  function handleDragEnter(
    event: React.DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();

    if (
      uploading ||
      !event.dataTransfer.types.includes("Files")
    ) {
      return;
    }

    dragDepth.current += 1;
    setDragActive(true);
  }

  function handleDragLeave(
    event: React.DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();

    if (uploading) {
      return;
    }

    dragDepth.current = Math.max(
      0,
      dragDepth.current - 1
    );

    if (dragDepth.current === 0) {
      setDragActive(false);
    }
  }

  function handleDrop(
    event: React.DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragActive(false);

    if (uploading) {
      return;
    }

    const files = Array.from(
      event.dataTransfer.files
    );

    if (files.length > 0) {
      handleFiles(files);
    }
  }

  function removePreview(
    index: number
  ) {
    setPreviewFiles(
      (current) => {

        const item =
          current[index];

        if (item) {
          URL.revokeObjectURL(
            item.url
          );
        }

        return current.filter(
          (_, i) =>
            i !== index
        );
      }
    );
  }

  function clearPreviews() {
    previewFiles.forEach(
      (item) =>
        URL.revokeObjectURL(
          item.url
        )
    );

    setPreviewFiles([]);
  }

  async function uploadPhotos() {
     const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    setError("Your session has expired. Please log in again.");
    return;
  }

    if (!selectedEventId) {
      setError(
        "Please select an event first."
      );

      return;
    }

    if (
      previewFiles.length === 0
    ) {
      setError(
        "Choose at least one photograph."
      );

      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError("");
    setSuccess("");

    let completed = 0;

    const newPhotos: Photo[] =
      [];

    for (
      const item of previewFiles
    ) {
      const file =
        item.file;

      const safeFilename =
        file.name
          .replace(
            /[^a-zA-Z0-9._-]/g,
            "-"
          )
          .replace(
            /-+/g,
            "-"
          );

      const uniqueName =
        `${Date.now()}-${crypto.randomUUID()}-${safeFilename}`;

      const storagePath =
        `${selectedEventId}/${crypto.randomUUID()}/${uniqueName}`;

      /*
       * Upload to lowercase "photos" bucket.
       */
      const {
        error: uploadError,
      } =
        await supabase.storage
          .from(BUCKET)
          .upload(
            storagePath,
            file,
            {
              cacheControl:
                "3600",
              upsert: false,
              contentType:
                file.type,
            }
          );

      if (uploadError) {
        setError(
          `Upload failed for "${file.name}". ${uploadError.message}`
        );

        setUploading(false);

        return;
      }

      const {
        data: photo,
        error: databaseError,
      } =
        await supabase
          .from("photos")
          .insert({
            event_id:
              selectedEventId,
            uploaded_by:
              user.id,
            filename:
              file.name,
            storage_path:
              storagePath,
            file_size:
              file.size,
          })
          .select()
          .single();

      if (databaseError) {
        await supabase.storage
          .from(BUCKET)
          .remove([
            storagePath,
          ]);

        setError(
          `Could not save "${file.name}". ${databaseError.message}`
        );

        setUploading(false);

        return;
      }

      if (photo) {
        newPhotos.push(
          photo as Photo
        );
      }

      completed++;

      setUploadProgress(
        Math.round(
          (completed /
            previewFiles.length) *
            100
        )
      );
    }

    /*
     * Generate signed URLs in one batch
     * after the upload is complete.
     */
    if (
      newPhotos.length > 0
    ) {
      const paths =
        newPhotos.map(
          (photo) =>
            photo.storage_path
        );

      const {
        data: urls,
      } =
        await supabase.storage
          .from(BUCKET)
          .createSignedUrls(
            paths,
            60 * 60
          );

      const withUrls =
        newPhotos.map(
          (photo, index) => ({
            ...photo,
            preview_url:
              urls?.[index]
                ?.signedUrl || "",
          })
        );

      setPhotos([
        ...withUrls,
        ...photos,
      ]);
    }

    clearPreviews();

    setSuccess(
      `${newPhotos.length} ${
        newPhotos.length === 1
          ? "photograph"
          : "photographs"
      } uploaded successfully.`
    );

    setUploadProgress(100);
    setUploading(false);
  }

  return (
    <main className="min-h-screen bg-[#f7f4ee] text-[#17212b]">

      {/* Sidebar */}

      <aside className="fixed inset-y-0 left-0 hidden w-[255px] border-r border-[#181716]/10 bg-[#f5f3ee] lg:block">

        <div className="flex h-full flex-col px-5 py-7">

          <div className="px-4">

            <button
              onClick={() =>
                router.push(
                  "/team"
                )
              }
              className="block text-left"
            >
              <Image src="/studio-trizen-logo.png" alt="Studio Trizen" width={96} height={76} className="h-12 w-16 object-contain" />
              <span className="sr-only">Studio Trizen</span>
            </button>

            <p className="mt-1 text-[9px] uppercase tracking-[0.28em] text-[#181716]/45">
              Photographer Workspace
            </p>

          </div>

          <div className="mt-16">

            <p className="px-4 text-[9px] font-semibold uppercase tracking-[0.28em] text-[#181716]/35">
              Workspace
            </p>

            <div className="mt-4 bg-[#ebe8e1] px-4 py-3">

              <p className="text-[13px] font-medium">
                My workspace
              </p>

            </div>

          </div>

          <div className="mt-auto">

            <button
              onClick={() => router.push("/account/password")}
              className="flex w-full items-center gap-4 px-4 py-3 text-left text-[13px] text-[#181716]/55 transition hover:text-[#176875]"
            >
              <span className="text-lg">✦</span>
              Password & security
            </button>

            <button
              onClick={
                handleSignOut
              }
              className="flex w-full items-center gap-4 px-4 py-3 text-left text-[13px] text-[#181716]/55 hover:text-[#181716]"
            >
              <span className="text-lg">
                ↪
              </span>

              Sign out
            </button>

            <div className="mt-7 border-t border-[#181716]/10 px-4 pt-6">

              <div className="flex items-center gap-3">

                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#181716] text-xs font-semibold text-white">
                  {getInitials(
                    profile.full_name
                  )}
                </div>

                <div className="min-w-0">

                  <p className="truncate text-[12px] font-semibold">
                    {
                      profile.full_name
                    }
                  </p>

                  <p className="truncate text-[10px] text-[#181716]/40">
                    {
                      profile.email
                    }
                  </p>

                </div>

              </div>

            </div>

          </div>

        </div>

      </aside>

      {/* Main */}

      <div className="lg:pl-[255px]">

        <header className="border-b border-[#181716]/10">

          <div className="flex items-center justify-between px-6 py-5 lg:px-10">

            <div>

              <p className="text-[11px] uppercase tracking-[0.2em] text-[#181716]/45">
                Photographer workspace
              </p>

              <p className="mt-1 text-[13px] font-medium">
                {
                  profile.full_name
                }
              </p>

            </div>

            <button
              onClick={
                handleSignOut
              }
              className="border border-[#181716]/15 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]"
            >
              Sign out
            </button>

          </div>

        </header>

        <section className="mx-auto max-w-[1400px] px-6 py-12 lg:px-10 lg:py-16">

          {/* Hero */}

          <div className="border-b border-[#181716]/10 pb-12">

            <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[#181716]/40">
              My workspace
            </p>

            <h1 className="mt-5 font-serif text-6xl leading-[0.9] tracking-[-0.045em] md:text-8xl">
              Capture the
              <br />
              moment.
            </h1>

            <p className="mt-7 max-w-xl text-[14px] leading-7 text-[#181716]/50">
              Upload your photographs directly
              to the events you&apos;ve been assigned
              to.
            </p>

          </div>

          {/* Stats */}

          <div className="grid grid-cols-2 border-b border-[#181716]/10 md:grid-cols-3">

            <WorkspaceStat
              value={String(
                events.length
              ).padStart(2, "0")}
              label="Assigned events"
            />

            <WorkspaceStat
              value={String(
                photos.length
              ).padStart(2, "0")}
              label="Your uploads"
            />

            <WorkspaceStat
              value={String(
                selectedEventPhotos.length
              ).padStart(2, "0")}
              label="Current event"
            />

          </div>

          {/* Messages */}

          {error && (
            <div className="mt-6 border-l-2 border-red-700 bg-red-700/5 px-4 py-3 text-[12px] text-red-800">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-6 border-l-2 border-green-700 bg-green-700/5 px-4 py-3 text-[12px] text-green-800">
              {success}
            </div>
          )}

          {/* Events */}

          <section className="py-12">

            <div className="border-b border-[#181716]/10 pb-6">

              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#181716]/40">
                Assigned events
              </p>

              <h2 className="mt-3 font-serif text-4xl">
                Your assignments.
              </h2>

            </div>

            {events.length ===
            0 ? (

              <div className="py-20 text-center">

                <p className="font-serif text-3xl">
                  No assignments yet.
                </p>

                <p className="mt-3 text-sm text-[#181716]/45">
                  Your administrator will
                  assign photography events
                  to your account.
                </p>

              </div>

            ) : (

              <div className="grid gap-3 py-6 md:grid-cols-2 xl:grid-cols-3">

                {events.map(
                  (
                    event,
                    index
                  ) => {

                    const active =
                      selectedEventId ===
                      event.id;

                    const count =
                      photos.filter(
                        (photo) =>
                          photo.event_id ===
                          event.id
                      ).length;

                    return (
                      <button
                        key={
                          event.id
                        }
                        onClick={() =>
                          setSelectedEventId(
                            event.id
                          )
                        }
                        className={`border p-5 text-left transition ${
                          active
                            ? "border-[#181716] bg-[#ebe8e1]"
                            : "border-[#181716]/10 hover:border-[#181716]/30"
                        }`}
                      >

                      {event.thumbnail_url && (
                        <img
                          src={event.thumbnail_url}
                          alt=""
                          className="mb-5 aspect-[4/3] w-full object-cover"
                        />
                      )}

                        <div className="flex justify-between">

                          <span className="font-serif text-2xl text-[#181716]/25">
                            {String(
                              index + 1
                            ).padStart(
                              2,
                              "0"
                            )}
                          </span>

                          {active && (
                            <span className="text-[9px] uppercase tracking-[0.16em]">
                              Selected
                            </span>
                          )}

                        </div>

                        <h3 className="mt-8 font-serif text-2xl">
                          {
                            event.name
                          }
                        </h3>

                        <div className="mt-6 flex justify-between border-t border-[#181716]/10 pt-4">

                          <span className="text-[10px] uppercase tracking-[0.14em] text-[#181716]/40">
                            {event.event_date
                              ? formatDate(
                                  event.event_date
                                )
                              : "Date not set"}
                          </span>

                          <span className="text-[10px] uppercase tracking-[0.14em] text-[#181716]/40">
                            {count} uploads
                          </span>

                        </div>

                      </button>
                    );
                  }
                )}

              </div>

            )}

          </section>

          {/* Upload */}

          {selectedEvent && (
            <section className="border-t border-[#181716]/10 py-12">

              <div className="grid gap-10 lg:grid-cols-[300px_1fr]">

                <div>

                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#181716]/40">
                    Upload
                  </p>

                  <h2 className="mt-4 font-serif text-4xl">
                    Bring your
                    <br />
                    photographs.
                  </h2>

                  <p className="mt-5 text-[12px] leading-6 text-[#181716]/45">
                    Add multiple photographs
                    at once.
                  </p>

                </div>

                <div>

                  <div
                    onDragEnter={handleDragEnter}
                    onDragOver={(
                      event
                    ) => {
                      event.preventDefault();
                      if (
                        !uploading &&
                        event.dataTransfer.types.includes(
                          "Files"
                        )
                      ) {
                        event.dataTransfer.dropEffect = "copy";
                      }
                    }}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    aria-label="Drop photographs here to add them to the upload queue"
                    className={`min-h-[260px] border border-dashed p-8 transition ${
                      dragActive
                        ? "border-[#181716] bg-[#ebe8e1]"
                        : "border-[#181716]/20"
                    }`}
                  >

                    <div className="flex min-h-[210px] flex-col items-center justify-center text-center">

                      <span className="font-serif text-5xl text-[#181716]/20">
                        +
                      </span>

                      <h3 className="mt-5 font-serif text-2xl">
                        Drop photographs here
                      </h3>

                      <p className="mt-2 text-[12px] text-[#181716]/40">
                        or choose files
                      </p>

                      <label className="mt-6 cursor-pointer border border-[#181716] bg-[#181716] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white hover:bg-transparent hover:text-[#181716]">

                        Choose photographs

                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          onChange={(
                            event
                          ) => {

                            if (
                              event
                                .target
                                .files
                            ) {
                              handleFiles(
                                event
                                  .target
                                  .files
                              );
                            }

                            event.target.value =
                              "";
                          }}
                          className="hidden"
                        />

                      </label>

                    </div>

                  </div>

                  {previewFiles.length >
                    0 && (

                    <div className="mt-8">

                      <div className="flex justify-between border-b border-[#181716]/10 pb-4">

                        <p className="font-serif text-2xl">
                          {
                            previewFiles.length
                          }{" "}
                          ready
                        </p>

                        <button
                          onClick={
                            clearPreviews
                          }
                          disabled={
                            uploading
                          }
                          className="text-[10px] uppercase tracking-[0.12em] text-[#181716]/40"
                        >
                          Clear
                        </button>

                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">

                        {previewFiles.map(
                          (
                            item,
                            index
                          ) => (

                            <div
                              key={`${item.file.name}-${index}`}
                              className="group relative aspect-square overflow-hidden bg-[#dedbd3]"
                            >

                              <img
                                src={
                                  item.url
                                }
                                alt={
                                  item.file.name
                                }
                                className="h-full w-full object-cover"
                              />

                              <button
                                onClick={() =>
                                  removePreview(
                                    index
                                  )
                                }
                                disabled={
                                  uploading
                                }
                                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center bg-[#f5f3ee] opacity-0 transition group-hover:opacity-100"
                              >
                                ×
                              </button>

                            </div>

                          )
                        )}

                      </div>

                      {uploading && (
                        <div className="mt-7">

                          <div className="mb-2 flex justify-between text-[10px] uppercase tracking-[0.12em] text-[#181716]/40">

                            <span>
                              Uploading
                            </span>

                            <span>
                              {
                                uploadProgress
                              }
                              %
                            </span>

                          </div>

                          <div className="h-[2px] bg-[#181716]/10">

                            <div
                              className="h-full bg-[#181716] transition-all duration-300"
                              style={{
                                width: `${uploadProgress}%`,
                              }}
                            />

                          </div>

                        </div>
                      )}

                      <div className="mt-7 flex justify-end">

                        <button
                          onClick={
                            uploadPhotos
                          }
                          disabled={
                            uploading
                          }
                          className="border border-[#181716] bg-[#181716] px-7 py-3.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white hover:bg-transparent hover:text-[#181716] disabled:opacity-40"
                        >
                          {uploading
                            ? "Uploading..."
                            : "Upload photographs →"}
                        </button>

                      </div>

                    </div>

                  )}

                </div>

              </div>

            </section>
          )}

          {/* Recent photos */}

          <section className="border-t border-[#181716]/10 py-12">

            <div className="border-b border-[#181716]/10 pb-6">

              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#181716]/40">
                Recent uploads
              </p>

              <h2 className="mt-3 font-serif text-4xl">
                Your photographs.
              </h2>

            </div>

            {selectedEventPhotos.length ===
            0 ? (

              <div className="py-20 text-center">

                <p className="font-serif text-3xl">
                  Nothing uploaded yet.
                </p>

              </div>

            ) : (

              <div className="grid grid-cols-2 gap-3 pt-7 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">

                {selectedEventPhotos.map(
                  (photo) => (

                    <div
                      key={
                        photo.id
                      }
                      className="group relative aspect-[4/5] overflow-hidden bg-[#dedbd3]"
                    >

                      {photo.preview_url ? (

                        <img
                          src={
                            photo.preview_url
                          }
                          alt={
                            photo.filename
                          }
                          loading="lazy"
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                        />

                      ) : (

                        <div className="flex h-full items-center justify-center text-[10px] text-black/30">
                          Preview unavailable
                        </div>

                      )}

                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent p-4 pt-12 text-white">

                        <p className="truncate text-[10px]">
                          {
                            photo.filename
                          }
                        </p>

                        <p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-white/55">
                          {
                            formatFileSize(
                              photo.file_size
                            )
                          }
                        </p>

                      </div>

                      <button
                        onClick={() => deletePhoto(photo)}
                        disabled={deletingPhotoId === photo.id}
                        className="absolute right-3 top-3 border border-white/70 bg-black/55 px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-white opacity-0 transition group-hover:opacity-100 disabled:opacity-50"
                      >
                        {deletingPhotoId === photo.id ? "Deleting..." : "Delete"}
                      </button>

                    </div>

                  )
                )}

              </div>

            )}

          </section>

        </section>

      </div>

    </main>
  );
}

/* ==============================================================
   SIDEBAR
============================================================== */

function SidebarLink({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
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

/* ==============================================================
   ADMIN STAT
============================================================== */

function AdminStat({
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

/* ==============================================================
   WORKSPACE STAT
============================================================== */

function WorkspaceStat({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <div className="border-r border-[#181716]/10 px-5 py-8 first:pl-0">

      <p className="font-serif text-5xl tracking-[-0.04em]">
        {value}
      </p>

      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#181716]/45">
        {label}
      </p>

    </div>
  );
}

/* ==============================================================
   HELPERS
============================================================== */

function getInitials(
  name: string
) {
  if (
    !name ||
    name === "User"
  ) {
    return "U";
  }

  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(
      (word) =>
        word[0]
    )
    .join("")
    .toUpperCase();
}

function formatDate(
  date: string
) {
  return new Date(
    `${date}T00:00:00`
  ).toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

function formatFileSize(
  bytes: number
) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}