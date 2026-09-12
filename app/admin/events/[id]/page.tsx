"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "../../../../src/lib/supabase/client";

type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: "ADMIN" | "TEAM_MEMBER";
};

type Event = {
  id: string;
  name: string;
  description: string | null;
  event_date: string | null;
  created_at: string;
  thumbnail_path: string | null;
};

type Member = {
  id: string;
  user_id: string;
  profile: Profile;
};

const BUCKET = "photos";

export default function EventDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [photographers, setPhotographers] = useState<Profile[]>([]);

  const [photoCount, setPhotoCount] = useState(0);
  const [selectedCount, setSelectedCount] = useState(0);
  const [galleryPublished, setGalleryPublished] = useState(false);

  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [selectedPhotographer, setSelectedPhotographer] = useState("");

  // Delete state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);

  useEffect(() => {
    if (eventId) {
      loadEvent();
    }
  }, [eventId]);

  async function loadEvent() {
    setLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const user = session?.user;

    if (!user) {
      router.push("/login");
      return;
    }

    // Verify admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "ADMIN") {
      router.push("/login");
      return;
    }

    const [
      { data: eventData },
      { data: memberData },
      { data: teamData },
      { count: photos },
      { data: gallery },
    ] = await Promise.all([
      supabase.from("events").select("*").eq("id", eventId).single(),
      supabase
        .from("event_members")
        .select(`id, user_id, profile:profiles (id, full_name, email, role)`)
        .eq("event_id", eventId),
      supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .eq("role", "TEAM_MEMBER")
        .order("full_name"),
      supabase.from("photos").select("*", { count: "exact", head: true }).eq("event_id", eventId),
      supabase
        .from("galleries")
        .select("id, published")
        .eq("event_id", eventId)
        .maybeSingle(),
    ]);

    if (!eventData) {
      router.push("/admin/events");
      return;
    }

    setEvent(eventData);

    if (eventData.thumbnail_path) {
      const { data: thumbnail } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(eventData.thumbnail_path, 60 * 60);
      setThumbnailUrl(thumbnail?.signedUrl || "");
    } else {
      setThumbnailUrl("");
    }

    setMembers(
      (memberData || []).map((member: any) => ({
        id: member.id,
        user_id: member.user_id,
        profile: member.profile,
      }))
    );

    setPhotographers(teamData || []);

    setPhotoCount(photos || 0);

    if (gallery) {
      setGalleryPublished(gallery.published === true);

      const { count } = await supabase
        .from("gallery_photos")
        .select("*", {
          count: "exact",
          head: true,
        })
        .eq("gallery_id", gallery.id);

      setSelectedCount(count || 0);
    } else {
      setGalleryPublished(false);
      setSelectedCount(0);
    }

    setLoading(false);
  }

  async function uploadThumbnail(file: File) {
    if (!event || !file.type.startsWith("image/")) {
      alert("Please choose an image file.");
      return;
    }

    setUploadingThumbnail(true);
    try {
      const path = `${eventId}/thumbnail/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type });
      if (uploadError) throw new Error(uploadError.message);

      const { error: updateError } = await supabase
        .from("events")
        .update({ thumbnail_path: path })
        .eq("id", eventId);
      if (updateError) throw new Error(updateError.message);

      if (event.thumbnail_path) {
        await supabase.storage.from(BUCKET).remove([event.thumbnail_path]);
      }

      const { data: thumbnail } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, 60 * 60);
      setThumbnailUrl(thumbnail?.signedUrl || "");
      setEvent({ ...event, thumbnail_path: path });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to upload thumbnail.");
    } finally {
      setUploadingThumbnail(false);
    }
  }

  async function removeThumbnail() {
    if (!event?.thumbnail_path || !window.confirm("Remove this event thumbnail?")) return;
    setUploadingThumbnail(true);
    await supabase.storage.from(BUCKET).remove([event.thumbnail_path]);
    const { error } = await supabase.from("events").update({ thumbnail_path: null }).eq("id", eventId);
    if (error) alert(error.message);
    else {
      setThumbnailUrl("");
      setEvent({ ...event, thumbnail_path: null });
    }
    setUploadingThumbnail(false);
  }

  async function addPhotographer() {
    if (!selectedPhotographer) return;

    setAdding(true);

    const { data: insertedMember, error } = await supabase
      .from("event_members")
      .insert({
        event_id: eventId,
        user_id: selectedPhotographer,
      })
      .select("id")
      .single();

    if (error) {
      alert(error.message);
      setAdding(false);
      return;
    }

    setSelectedPhotographer("");
    setShowModal(false);

    const photographer = photographers.find(
      (person) => person.id === selectedPhotographer
    );
    if (photographer) {
      setMembers((current) => [
        ...current,
        {
          id: insertedMember?.id || crypto.randomUUID(),
          user_id: photographer.id,
          profile: photographer,
        },
      ]);
    }

    setAdding(false);
  }

  async function removePhotographer(id: string) {
    if (!confirm("Remove this photographer from the event?")) {
      return;
    }

    setRemoving(id);

    const { error } = await supabase
      .from("event_members")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      setRemoving(null);
      return;
    }

    setMembers((current) => current.filter((member) => member.id !== id));
    setRemoving(null);
  }

  /**
   * Delete the complete event.
   *
   * Important:
   * Database records are removed through the event's
   * ON DELETE CASCADE relationships.
   *
   * Storage files must be deleted separately first.
   */
  async function deleteEvent() {
    if (!event) return;

    setDeleting(true);

    try {
      // --------------------------------------------------
      // 1. Get all photos belonging to this event
      // --------------------------------------------------

      const { data: photos, error: photosError } = await supabase
        .from("photos")
        .select("storage_path")
        .eq("event_id", eventId);

      if (photosError) {
        throw new Error(photosError.message);
      }

      // --------------------------------------------------
      // 2. Delete actual files from Supabase Storage
      // --------------------------------------------------

      if (photos && photos.length > 0) {
        const storagePaths = photos
          .map((photo) => photo.storage_path)
          .filter(Boolean);

        if (storagePaths.length > 0) {
          const { error: storageError } = await supabase.storage
            .from(BUCKET)
            .remove(storagePaths);

          if (storageError) {
            throw new Error(
              `Could not delete event photographs: ${storageError.message}`
            );
          }
        }
      }

      // --------------------------------------------------
      // 3. Delete event from database
      // --------------------------------------------------
      // Related event_members, photos, galleries and
      // gallery_photos should cascade automatically.

      const { error: eventError } = await supabase
        .from("events")
        .delete()
        .eq("id", eventId);

      if (eventError) {
        throw new Error(eventError.message);
      }

      // --------------------------------------------------
      // 4. Return to All Events
      // --------------------------------------------------

      router.push("/admin/events");
      router.refresh();
    } catch (error) {
      console.error("Delete event error:", error);

      alert(
        error instanceof Error
          ? error.message
          : "Something went wrong while deleting the event."
      );

      setDeleting(false);
    }
  }

  const assignedIds = members.map((member) => member.user_id);

  const available = photographers.filter(
    (person) => !assignedIds.includes(person.id)
  );

  // --------------------------------------------------
  // Loading
  // --------------------------------------------------

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f3ee]">
        <div className="h-5 w-5 animate-spin rounded-full border border-black/20 border-t-black" />
      </main>
    );
  }

  if (!event) return null;

  return (
    <main className="min-h-screen bg-[#f5f3ee] text-[#181716]">
      {/* ==================================================
          HEADER
      ================================================== */}

      <header className="border-b border-[#181716]/10">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-5 lg:px-10">
          <button
            onClick={() => router.push("/admin/events")}
            className="block text-left"
          >
            <Image src="/studio-trizen-logo.png" alt="Studio Trizen" width={96} height={76} className="h-10 w-12 object-contain" />
            <span className="sr-only">Studio Trizen</span>
          </button>

          <button
            onClick={() => router.push("/admin/events")}
            className="text-[12px] text-[#181716]/45 transition hover:text-[#181716]"
          >
            ← All events
          </button>
        </div>
      </header>

      {/* ==================================================
          MAIN
      ================================================== */}

      <section className="mx-auto max-w-[1400px] px-6 py-12 lg:px-10 lg:py-16">
        {/* ==================================================
            HERO
        ================================================== */}

        <div className="border-b border-[#181716]/10 pb-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#181716]/40">
            Event / Overview
          </p>

          <div className="mt-6 flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div>
              <h1 className="max-w-4xl font-serif text-5xl leading-[0.95] tracking-[-0.04em] md:text-7xl">
                {event.name}
              </h1>

              {event.description && (
                <p className="mt-6 max-w-2xl text-[14px] leading-7 text-[#181716]/50">
                  {event.description}
                </p>
              )}
            </div>

            <div className="text-left lg:text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#181716]/35">
                Event date
              </p>

              <p className="mt-2 font-serif text-2xl">
                {event.event_date
                  ? formatDate(event.event_date)
                  : "Not scheduled"}
              </p>

              {/* Delete Event */}
              <button
                onClick={() => setShowDeleteModal(true)}
                className="mt-6 border border-red-900/20 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-red-800 transition hover:border-red-800 hover:bg-red-800 hover:text-white"
              >
                Delete event
              </button>
            </div>
          </div>
        </div>

        <section className="grid gap-8 border-b border-[#181716]/10 py-10 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#181716]/35">
              Event thumbnail
            </p>
            <h2 className="mt-3 font-serif text-3xl">Set the cover image.</h2>
            <p className="mt-3 max-w-sm text-[12px] leading-6 text-[#181716]/45">
              This image appears on the event button for you and assigned photographers.
            </p>
          </div>

          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="aspect-[4/3] w-full max-w-xs overflow-hidden bg-[#ebe8e1]">
              {thumbnailUrl ? (
                <img src={thumbnailUrl} alt="Event thumbnail" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-[0.14em] text-[#181716]/35">
                  No thumbnail
                </div>
              )}
            </div>
            <div className="flex flex-col items-start gap-3">
              <label className="cursor-pointer border border-[#181716] bg-[#181716] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-transparent hover:text-[#181716]">
                {uploadingThumbnail ? "Uploading..." : "Choose image"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={uploadingThumbnail}
                  onChange={(input) => {
                    const file = input.target.files?.[0];
                    if (file) void uploadThumbnail(file);
                    input.target.value = "";
                  }}
                />
              </label>
              {thumbnailUrl && (
                <button onClick={removeThumbnail} disabled={uploadingThumbnail} className="text-[10px] font-semibold uppercase tracking-[0.12em] text-red-700/70 hover:text-red-700">
                  Remove thumbnail
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ==================================================
            STATS
        ================================================== */}

        <div className="grid grid-cols-2 border-b border-[#181716]/10 md:grid-cols-4">
          <Stat
            label="Photographers"
            value={members.length}
          />

          <Stat
            label="Uploaded"
            value={photoCount}
          />

          <Stat
            label="Selected"
            value={selectedCount}
          />

          <Stat
            label="Progress"
            value={
              photoCount > 0
                ? `${Math.round((selectedCount / photoCount) * 100)}%`
                : "—"
            }
          />
        </div>

        {/* ==================================================
            TEAM
        ================================================== */}

        <section className="py-12">
          <div className="flex flex-col justify-between gap-6 border-b border-[#181716]/10 pb-6 md:flex-row md:items-end">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#181716]/35">
                01 / Team
              </p>

              <h2 className="mt-3 font-serif text-4xl tracking-[-0.03em]">
                Photographers
              </h2>
            </div>

            <button
              onClick={() => setShowModal(true)}
              className="w-fit border border-[#181716] bg-[#181716] px-5 py-3 text-[12px] font-semibold text-white transition hover:bg-transparent hover:text-[#181716]"
            >
              + Add photographer
            </button>
          </div>

          {members.length === 0 ? (
            <div className="py-16 text-center">
              <p className="font-serif text-3xl">
                No photographers yet.
              </p>

              <p className="mt-3 text-sm text-[#181716]/45">
                Assign a photographer to begin collecting photographs.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#181716]/10">
              {members.map((member, index) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between py-6"
                >
                  <div className="flex items-center gap-5">
                    <span className="font-serif text-xl text-[#181716]/25">
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    <div>
                      <h3 className="text-[15px] font-semibold">
                        {member.profile.full_name}
                      </h3>

                      <p className="mt-1 text-[12px] text-[#181716]/40">
                        {member.profile.email}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => removePhotographer(member.id)}
                    disabled={removing === member.id}
                    className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#181716]/35 transition hover:text-red-700 disabled:opacity-40"
                  >
                    {removing === member.id
                      ? "Removing..."
                      : "Remove"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ==================================================
            WORKFLOW
        ================================================== */}

        <section className="border-t border-[#181716]/10 py-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#181716]/35">
            02 / Workflow
          </p>

          <h2 className="mt-3 font-serif text-4xl tracking-[-0.03em]">
            From camera to gallery.
          </h2>

          <div className="mt-8 grid gap-px border border-[#181716]/10 bg-[#181716]/10 md:grid-cols-4">
            <Workflow
              number="01"
              title="Assign"
              description="Build the event team."
              complete={members.length > 0}
            />

            <Workflow
              number="02"
              title="Collect"
              description="Photographers upload."
              complete={photoCount > 0}
            />

            <Workflow
              number="03"
              title="Curate"
              description="Select the best images."
              complete={selectedCount > 0}
            />

            <Workflow
              number="04"
              title="Publish"
              description="Deliver the gallery."
              complete={galleryPublished}
            />
          </div>
        </section>

        {/* ==================================================
            ACTIONS
        ================================================== */}

        <section className="border-t border-[#181716]/10 pt-10">
          <div className="grid gap-4 md:grid-cols-2">
            <button
              onClick={() =>
                router.push(`/admin/events/${eventId}/photos`)
              }
              className="group border border-[#181716]/15 p-7 text-left transition hover:border-[#181716]"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#181716]/35">
                Review
              </p>

              <h3 className="mt-4 font-serif text-3xl">
                Review photographs
              </h3>

              <p className="mt-3 text-[13px] leading-6 text-[#181716]/45">
                Browse uploads and curate the photographs you want to
                publish.
              </p>

              <p className="mt-7 text-[12px] font-semibold transition group-hover:translate-x-1">
                Open photo review →
              </p>
            </button>

            <button
              onClick={() =>
                router.push(`/admin/events/${eventId}/gallery`)
              }
              className="group border border-[#181716]/15 p-7 text-left transition hover:border-[#181716]"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#181716]/35">
                Delivery
              </p>

              <h3 className="mt-4 font-serif text-3xl">
                Manage gallery
              </h3>

              <p className="mt-3 text-[13px] leading-6 text-[#181716]/45">
                Prepare your selected photographs and publish a private
                customer gallery.
              </p>

              <p className="mt-7 text-[12px] font-semibold transition group-hover:translate-x-1">
                Open gallery manager →
              </p>
            </button>
          </div>
        </section>
      </section>

      {/* ==================================================
          ADD PHOTOGRAPHER MODAL
      ================================================== */}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-5 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#f5f3ee] p-7 shadow-2xl md:p-9">
            <div className="flex items-start justify-between border-b border-[#181716]/10 pb-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#181716]/35">
                  Team
                </p>

                <h2 className="mt-3 font-serif text-3xl">
                  Add photographer
                </h2>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="text-2xl text-[#181716]/40 transition hover:text-[#181716]"
              >
                ×
              </button>
            </div>

            <div className="py-7">
              {available.length === 0 ? (
                <p className="text-sm leading-6 text-[#181716]/50">
                  There are no unassigned team members available.
                </p>
              ) : (
                <>
                  <label className="text-[11px] font-semibold uppercase tracking-[0.15em]">
                    Select photographer
                  </label>

                  <select
                    value={selectedPhotographer}
                    onChange={(e) =>
                      setSelectedPhotographer(e.target.value)
                    }
                    className="mt-3 w-full border-b border-[#181716]/20 bg-transparent py-4 text-[15px] outline-none focus:border-[#181716]"
                  >
                    <option value="">
                      Choose a team member
                    </option>

                    {available.map((person) => (
                      <option
                        key={person.id}
                        value={person.id}
                      >
                        {person.full_name} — {person.email}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>

            <div className="flex justify-end gap-5 border-t border-[#181716]/10 pt-6">
              <button
                onClick={() => setShowModal(false)}
                className="text-[12px] font-medium text-[#181716]/45 transition hover:text-[#181716]"
              >
                Cancel
              </button>

              <button
                onClick={addPhotographer}
                disabled={!selectedPhotographer || adding}
                className="border border-[#181716] bg-[#181716] px-6 py-3 text-[12px] font-semibold text-white disabled:opacity-40"
              >
                {adding ? "Adding..." : "Add photographer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================
          DELETE EVENT MODAL
      ================================================== */}

      {showDeleteModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-5 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#f5f3ee] p-7 shadow-2xl md:p-9">
            {/* Modal Header */}
            <div className="border-b border-[#181716]/10 pb-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-red-800/70">
                Alert
              </p>

              <h2 className="mt-3 font-serif text-4xl tracking-[-0.03em]">
                Delete this event?
              </h2>
            </div>

            {/* Modal Content */}
            <div className="py-7">
              <p className="text-[14px] leading-7 text-[#181716]/60">
                You are about to permanently delete{" "}
                <span className="font-semibold text-[#181716]">
                  {event.name}
                </span>
                .
              </p>

              <div className="mt-5 border-l-2 border-red-900/30 pl-4">
                <p className="text-[13px] leading-6 text-[#181716]/50">
                  This will remove the event, assigned photographers,
                  uploaded photographs, gallery data, and selected
                  gallery photographs.
                </p>

                <p className="mt-3 text-[13px] font-semibold leading-6 text-red-900">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col-reverse gap-3 border-t border-[#181716]/10 pt-6 sm:flex-row sm:items-center sm:justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="px-5 py-3 text-[12px] font-semibold text-[#181716]/50 transition hover:text-[#181716] disabled:opacity-40"
              >
                Cancel
              </button>

              <button
                onClick={deleteEvent}
                disabled={deleting}
                className="border border-red-900 bg-red-900 px-6 py-3 text-[12px] font-semibold text-white transition hover:bg-red-950 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting
                  ? "Deleting event..."
                  : "Yes, delete event"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ======================================================
   STAT COMPONENT
====================================================== */

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="border-r border-[#181716]/10 px-5 py-7 first:pl-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#181716]/35">
        {label}
      </p>

      <p className="mt-3 font-serif text-4xl">
        {value}
      </p>
    </div>
  );
}

/* ======================================================
   WORKFLOW COMPONENT
====================================================== */

function Workflow({
  number,
  title,
  description,
  complete,
}: {
  number: string;
  title: string;
  description: string;
  complete: boolean;
}) {
  return (
    <div className={`p-6 transition-colors ${complete ? "bg-[#e7f0e9]" : "bg-[#f5f3ee]"}`}>
      <div className="flex items-center justify-between">
        <span className={`font-serif text-xl ${complete ? "text-[#2f6b45]" : "text-[#181716]/30"}`}>
          {number}
        </span>

        {complete && (
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#2f6b45]">
            Complete
          </span>
        )}
      </div>

      <h3 className="mt-8 text-[15px] font-semibold">
        {title}
      </h3>

      <p className="mt-2 text-[12px] leading-5 text-[#181716]/40">
        {description}
      </p>
    </div>
  );
}

/* ======================================================
   DATE FORMATTER
====================================================== */

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