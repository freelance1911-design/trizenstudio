"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "../../../../../src/lib/supabase/client";

type Event = {
  id: string;
  name: string;
  event_date: string | null;
};

type Photo = {
  id: string;
  event_id: string;
  uploaded_by: string;
  filename: string;
  storage_path: string;
  file_size: number;
  created_at: string;
  uploader?: {
    full_name: string;
    email: string;
  };
  preview_url?: string;
};

export default function PhotoReviewPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [creatingGallery, setCreatingGallery] = useState(false);

  const [filter, setFilter] = useState<"ALL" | "SELECTED">("ALL");
  const [previewPhoto, setPreviewPhoto] = useState<Photo | null>(null);

  useEffect(() => {
    if (eventId) {
      loadReview();
    }
  }, [eventId]);

  async function loadReview() {
    setLoading(true);

    try {
      // Use the cached browser session to avoid an unnecessary auth request.
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      // Keep the admin check before loading event/photo data.
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError || !profile || profile.role !== "ADMIN") {
        router.replace("/login");
        return;
      }

      // Event data, photos and gallery data are independent after auth,
      // so fetch them together instead of waiting for each request.
      const [eventResult, photoResult, galleryResult] = await Promise.all([
        supabase
          .from("events")
          .select("id, name, event_date")
          .eq("id", eventId)
          .single(),

        supabase
          .from("photos")
          .select(`
            id,
            event_id,
            uploaded_by,
            filename,
            storage_path,
            file_size,
            created_at,
            uploader:profiles!photos_uploaded_by_fkey (
              full_name,
              email
            )
          `)
          .eq("event_id", eventId)
          .order("created_at", { ascending: false }),

        supabase
          .from("galleries")
          .select("id")
          .eq("event_id", eventId)
          .maybeSingle(),
      ]);

      if (eventResult.error || !eventResult.data) {
        router.replace("/admin/events");
        return;
      }

      setEvent(eventResult.data);

      if (photoResult.error) {
        console.error("Failed to load photos:", photoResult.error);
        setPhotos([]);
      } else {
        const photoData = photoResult.data ?? [];

        // One Storage request for all paths instead of one request per photo.
        // This is the main performance improvement for large galleries.
        const storagePaths = photoData.map((photo: any) => photo.storage_path);

        let signedUrls: Record<string, string> = {};

        if (storagePaths.length > 0) {
          const { data: signedData, error: signedError } =
            await supabase.storage
              .from("photos")
              .createSignedUrls(storagePaths, 60 * 60);

          if (signedError) {
            console.error("Failed to create signed photo URLs:", signedError);
          } else {
            signedUrls = Object.fromEntries(
              (signedData ?? [])
                .filter((item) => item.signedUrl)
                .map((item) => [item.path, item.signedUrl])
            );
          }
        }

        setPhotos(
          photoData.map((photo: any) => ({
            ...photo,
            uploader: photo.uploader,
            preview_url: signedUrls[photo.storage_path] ?? "",
          }))
        );
      }

      // Fetch selected photo IDs after we know whether a gallery exists.
      // This is only one small metadata query and does not touch Storage.
      if (galleryResult.data?.id) {
        const { data: galleryPhotos, error: galleryPhotosError } =
          await supabase
            .from("gallery_photos")
            .select("photo_id")
            .eq("gallery_id", galleryResult.data.id);

        if (galleryPhotosError) {
          console.error(
            "Failed to load gallery selections:",
            galleryPhotosError
          );
        }

        setSelectedIds(
          (galleryPhotos ?? []).map((item) => item.photo_id)
        );
      } else {
        setSelectedIds([]);
      }
    } catch (error) {
      console.error("Failed to load photo review:", error);
    } finally {
      setLoading(false);
    }
  }

  function togglePhoto(photoId: string) {
    setSelectedIds((current) => {
      if (current.includes(photoId)) {
        return current.filter((id) => id !== photoId);
      }

      return [...current, photoId];
    });
  }

  function selectAll() {
    setSelectedIds(photos.map((photo) => photo.id));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  async function saveSelection() {
    if (!event) return;

    setCreatingGallery(true);

    // Check if gallery exists
    let { data: gallery } = await supabase
      .from("galleries")
      .select("id")
      .eq("event_id", event.id)
      .maybeSingle();

    // Create draft gallery if necessary
    if (!gallery) {
      const slug =
        `${event.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")}-${crypto.randomUUID().slice(0, 6)}`;

      const pin = generatePin();

      const { data: createdGallery, error } = await supabase
        .from("galleries")
        .insert({
          event_id: event.id,
          slug,
          pin_hash: pin,
          published: false,
        })
        .select("id")
        .single();

      if (error) {
        console.error(error);
        alert(error.message);
        setCreatingGallery(false);
        return;
      }

      gallery = createdGallery;
    }

    // Remove current selections
    const { error: deleteError } = await supabase
      .from("gallery_photos")
      .delete()
      .eq("gallery_id", gallery.id);

    if (deleteError) {
      alert(deleteError.message);
      setCreatingGallery(false);
      return;
    }

    // Insert new selections
    if (selectedIds.length > 0) {
      const rows = selectedIds.map((photoId) => ({
        gallery_id: gallery.id,
        photo_id: photoId,
      }));

      const { error: insertError } = await supabase
        .from("gallery_photos")
        .insert(rows);

      if (insertError) {
        alert(insertError.message);
        setCreatingGallery(false);
        return;
      }
    }

    setCreatingGallery(false);

    router.push(`/admin/events/${event.id}/gallery`);
  }

  const visiblePhotos =
    filter === "SELECTED"
      ? photos.filter((photo) => selectedIds.includes(photo.id))
      : photos;

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f3ee] text-[#181716]">
        <header className="border-b border-[#181716]/10">
          <div className="mx-auto max-w-[1500px] px-6 lg:px-10">
            <div className="flex items-center justify-between py-5">
              <div className="h-4 w-16 animate-pulse bg-[#181716]/10" />
              <div className="h-3 w-28 animate-pulse bg-[#181716]/10" />
            </div>

            <div className="border-t border-[#181716]/10 py-8">
              <div className="h-2 w-24 animate-pulse bg-[#181716]/10" />
              <div className="mt-4 h-12 w-72 animate-pulse bg-[#181716]/10" />
              <div className="mt-3 h-3 w-96 max-w-full animate-pulse bg-[#181716]/10" />
            </div>
          </div>
        </header>

        <section className="mx-auto max-w-[1500px] px-6 py-10 lg:px-10">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, index) => (
              <div
                key={index}
                className="aspect-[4/5] animate-pulse bg-[#181716]/8"
              />
            ))}
          </div>
        </section>
      </main>
    );
  }

  if (!event) return null;

  return (
    <main className="min-h-screen bg-[#f5f3ee] text-[#181716]">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-[#181716]/10 bg-[#f5f3ee]/95 backdrop-blur">
        <div className="mx-auto max-w-[1500px] px-6 lg:px-10">
          <div className="flex items-center justify-between py-5">
            <button
              onClick={() =>
                router.push(`/admin/events/${event.id}`)
              }
              className="block text-left"
            >
              <Image src="/studio-trizen-logo.png" alt="Studio Trizen" width={96} height={76} className="h-10 w-12 object-contain" />
              <span className="sr-only">Studio Trizen</span>
            </button>

            <button
              onClick={() =>
                router.push(`/admin/events/${event.id}`)
              }
              className="text-[12px] text-[#181716]/45 hover:text-[#181716]"
            >
              ← Event overview
            </button>
          </div>

          <div className="flex flex-col justify-between gap-6 border-t border-[#181716]/10 py-7 md:flex-row md:items-end">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#181716]/35">
                Photo review
              </p>

              <h1 className="mt-3 font-serif text-4xl tracking-[-0.03em] md:text-5xl">
                {event.name}
              </h1>

              <p className="mt-2 text-[13px] text-[#181716]/45">
                Curate the photographs that will appear in the customer
                gallery.
              </p>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-[0.15em] text-[#181716]/35">
                  Selected
                </p>

                <p className="mt-1 font-serif text-3xl">
                  {selectedIds.length}
                </p>
              </div>

              <div className="h-10 w-px bg-[#181716]/10" />

              <div className="text-right">
                <p className="text-[10px] uppercase tracking-[0.15em] text-[#181716]/35">
                  Uploaded
                </p>

                <p className="mt-1 font-serif text-3xl">
                  {photos.length}
                </p>
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex flex-col gap-4 border-t border-[#181716]/10 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-1">
              <button
                onClick={() => setFilter("ALL")}
                className={`px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                  filter === "ALL"
                    ? "bg-[#181716] text-white"
                    : "text-[#181716]/45 hover:text-[#181716]"
                }`}
              >
                All ({photos.length})
              </button>

              <button
                onClick={() => setFilter("SELECTED")}
                className={`px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                  filter === "SELECTED"
                    ? "bg-[#181716] text-white"
                    : "text-[#181716]/45 hover:text-[#181716]"
                }`}
              >
                Selected ({selectedIds.length})
              </button>
            </div>

            <div className="flex gap-5">
              <button
                onClick={selectAll}
                disabled={photos.length === 0}
                className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#181716]/50 hover:text-[#181716] disabled:opacity-30"
              >
                Select all
              </button>

              <button
                onClick={clearSelection}
                disabled={selectedIds.length === 0}
                className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#181716]/50 hover:text-[#181716] disabled:opacity-30"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Gallery */}
      <section className="mx-auto max-w-[1500px] px-6 py-8 lg:px-10 lg:py-12">
        {visiblePhotos.length === 0 ? (
          <div className="py-24 text-center">
            <p className="font-serif text-4xl">
              {photos.length === 0
                ? "No photographs yet."
                : "No selected photographs."}
            </p>

            <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-[#181716]/45">
              {photos.length === 0
                ? "Photographs uploaded by your event team will appear here."
                : "Select photographs from the full collection to see them here."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visiblePhotos.map((photo) => {
              const selected = selectedIds.includes(photo.id);

              return (
                <div
                  key={photo.id}
                  className={`group relative aspect-[4/5] overflow-hidden bg-[#dedbd3] ${
                    selected
                      ? "ring-2 ring-[#181716] ring-offset-2 ring-offset-[#f5f3ee]"
                      : ""
                  }`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Preview ${photo.filename}`}
                  onClick={() => setPreviewPhoto(photo)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setPreviewPhoto(photo);
                    }
                  }}
                >
                  {photo.preview_url ? (
                    <img
                      src={photo.preview_url}
                      alt={photo.filename}
                      loading="lazy"
                      decoding="async"
                      className={`absolute inset-0 h-full w-full object-cover transition duration-500 ${
                        selected
                          ? "scale-[1.02]"
                          : "group-hover:scale-[1.03]"
                      }`}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs text-black/30">
                        Preview unavailable
                      </span>
                    </div>
                  )}

                  {/* Overlay */}
                  <div
                    className={`absolute inset-0 transition ${
                      selected
                        ? "bg-black/15"
                        : "bg-black/0 group-hover:bg-black/10"
                    }`}
                  />

                  {/* Selection */}
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      togglePhoto(photo.id);
                    }}
                    aria-label={selected ? `Deselect ${photo.filename}` : `Select ${photo.filename}`}
                    className={`absolute right-3 top-3 flex h-8 w-8 items-center justify-center border transition ${
                      selected
                        ? "border-[#181716] bg-[#181716] text-white"
                        : "border-white/70 bg-white/70 text-transparent backdrop-blur-sm group-hover:text-[#181716]"
                    }`}
                  >
                    ✓
                  </button>

                  {/* Bottom information */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent p-4 pt-12 text-white">
                    <p className="truncate text-[11px] font-medium">
                      {photo.filename}
                    </p>

                    <p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-white/60">
                      {photo.uploader?.full_name || "Unknown"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {previewPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#181716]/85 p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={`Preview of ${previewPhoto.filename}`}
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="relative flex max-h-full w-full max-w-5xl flex-col bg-[#f5f3ee] md:flex-row"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative flex min-h-[55vh] flex-1 items-center justify-center bg-black md:min-h-[75vh]">
              {previewPhoto.preview_url ? (
                <img
                  src={previewPhoto.preview_url}
                  alt={previewPhoto.filename}
                  className="max-h-[75vh] max-w-full object-contain"
                />
              ) : (
                <span className="text-sm text-white/50">Preview unavailable</span>
              )}

              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                aria-label="Close preview"
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center bg-white/90 text-xl text-[#181716]"
              >
                ×
              </button>
            </div>

            <div className="flex w-full flex-col justify-between gap-8 p-6 md:w-72 md:p-8">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#181716]/40">
                  Photograph
                </p>
                <h2 className="mt-3 break-words font-serif text-2xl">
                  {previewPhoto.filename}
                </h2>
                <p className="mt-3 text-[11px] text-[#181716]/50">
                  Uploaded by {previewPhoto.uploader?.full_name || "Unknown"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => togglePhoto(previewPhoto.id)}
                className="border border-[#181716] bg-[#181716] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-transparent hover:text-[#181716]"
              >
                {selectedIds.includes(previewPhoto.id)
                  ? "Deselect photograph"
                  : "Select photograph"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom action */}
      <div className="sticky bottom-0 z-20 border-t border-[#181716]/10 bg-[#f5f3ee]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-5 px-6 py-4 lg:px-10">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">
              {selectedIds.length} photographs selected
            </p>

            <p className="mt-1 hidden text-[11px] text-[#181716]/40 sm:block">
              These images will be prepared for the customer gallery.
            </p>
          </div>

          <button
            onClick={saveSelection}
            disabled={creatingGallery || photos.length === 0}
            className="border border-[#181716] bg-[#181716] px-6 py-3 text-[12px] font-semibold text-white transition hover:bg-transparent hover:text-[#181716] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {creatingGallery
              ? "Saving..."
              : "Continue to gallery →"}
          </button>
        </div>
      </div>
    </main>
  );
}

function generatePin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}