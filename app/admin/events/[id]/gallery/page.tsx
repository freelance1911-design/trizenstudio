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

type Gallery = {
  id: string;
  event_id: string;
  slug: string;
  pin_hash: string;
  published: boolean;
  created_at: string;
  published_at: string | null;
};

type Photo = {
  id: string;
  filename: string;
  storage_path: string;
  uploaded_by: string;
  preview_url?: string;
  uploader?: {
    full_name: string;
  };
};

export default function GalleryManagerPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);

  const [galleryName, setGalleryName] = useState("");
  const [pin, setPin] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [messageArea, setMessageArea] = useState<"settings" | "delivery">("settings");

  useEffect(() => {
    if (eventId) {
      loadGallery();
    }
  }, [eventId]);

  async function loadGallery() {
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    // Admin verification
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "ADMIN") {
      router.push("/login");
      return;
    }

    // Event
    const { data: eventData, error: eventError } =
      await supabase
        .from("events")
        .select("id, name, event_date")
        .eq("id", eventId)
        .single();

    if (eventError || !eventData) {
      router.push("/admin/events");
      return;
    }

    setEvent(eventData);
    setGalleryName(eventData.name);

    // Gallery
    const { data: galleryData, error: galleryError } =
      await supabase
        .from("galleries")
        .select("*")
        .eq("event_id", eventId)
        .maybeSingle();

    if (galleryError) {
      console.error(galleryError);
    }

    if (galleryData) {
      setGallery(galleryData);

      // Existing selected photos
      const { data: galleryPhotos, error: photoError } =
        await supabase
          .from("gallery_photos")
          .select(`
            photo_id,
            photo:photos (
              id,
              filename,
              storage_path,
              uploaded_by,
              uploader:profiles!photos_uploaded_by_fkey (
                full_name
              )
            )
          `)
          .eq("gallery_id", galleryData.id);

      if (photoError) {
        console.error(photoError);
      }

      const loadedPhotos = await Promise.all(
        (galleryPhotos || []).map(async (item: any) => {
          const photo = item.photo;

          if (!photo) return null;

          const { data } = await supabase.storage
            .from("photos")
            .createSignedUrl(
              photo.storage_path,
              60 * 60
            );

          return {
            ...photo,
            uploader: photo.uploader,
            preview_url: data?.signedUrl || "",
          };
        })
      );

      setPhotos(
        loadedPhotos.filter(Boolean) as Photo[]
      );
    }

    setLoading(false);
  }

  async function saveGallery() {
    if (!event) return;

    setSaving(true);
    setMessageArea("settings");
    setError("");
    setSuccess("");

    if (!galleryName.trim()) {
      setError("Please enter a gallery name.");
      setSaving(false);
      return;
    }

    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      setError("PIN must contain exactly 6 digits.");
      setSaving(false);
      return;
    }

    const pinHash = await hashPin(pin);

    if (gallery) {
      const { error } = await supabase
        .from("galleries")
        .update({
          pin_hash: pinHash,
        })
        .eq("id", gallery.id);

      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }

      setGallery({
        ...gallery,
        pin_hash: pinHash,
      });

      setSuccess("Gallery settings saved.");
    } else {
      const slug = createSlug(event.name);

      const { data, error } = await supabase
        .from("galleries")
        .insert({
          event_id: event.id,
          slug,
          pin_hash: pinHash,
          published: false,
        })
        .select()
        .single();

      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }

      setGallery(data);
      setSuccess("Gallery created.");
    }

    setPin("");
    setSaving(false);
  }

  async function publishGallery() {
    setMessageArea("delivery");

    if (!gallery) {
      setError("Save the gallery settings first.");
      return;
    }

    if (photos.length === 0) {
      setError(
        "Select at least one photograph before publishing."
      );
      return;
    }

    setPublishing(true);
    setError("");
    setSuccess("");

    const { data, error } = await supabase
      .from("galleries")
      .update({
        published: true,
        published_at: new Date().toISOString(),
      })
      .eq("id", gallery.id)
      .select()
      .single();

    if (error) {
      setError(error.message);
      setPublishing(false);
      return;
    }

    setGallery(data);

    setSuccess(
      "Gallery published successfully."
    );

    setPublishing(false);
  }

  async function unpublishGallery() {
    if (!gallery) return;

    setMessageArea("delivery");

    const confirmed = window.confirm(
      "Unpublish this gallery? Customers will no longer be able to access it."
    );

    if (!confirmed) return;

    setPublishing(true);
    setError("");

    const { data, error } = await supabase
      .from("galleries")
      .update({
        published: false,
        published_at: null,
      })
      .eq("id", gallery.id)
      .select()
      .single();

    if (error) {
      setError(error.message);
      setPublishing(false);
      return;
    }

    setGallery(data);

    setSuccess("Gallery unpublished.");

    setPublishing(false);
  }

  function generateNewPin() {
    setPin(generatePin());
  }

  async function copyGalleryLink() {
    if (!gallery) return;

    const url =
      `${window.location.origin}/gallery/${gallery.slug}`;

    await navigator.clipboard.writeText(url);

    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 2000);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f3ee]">
        <div className="text-center">
          <div className="mx-auto h-5 w-5 animate-spin rounded-full border border-black/20 border-t-black" />

          <p className="mt-4 text-[10px] uppercase tracking-[0.2em] text-black/40">
            Loading gallery
          </p>
        </div>
      </main>
    );
  }

  if (!event) return null;

  const galleryUrl = gallery
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/gallery/${gallery.slug}`
    : "";

  return (
    <main className="min-h-screen bg-[#f5f3ee] text-[#181716]">
      {/* Header */}
      <header className="border-b border-[#181716]/10">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-5 lg:px-10">
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
            className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#181716]/45 hover:text-[#181716]"
          >
            ← Event overview
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-[1400px] px-6 py-12 lg:px-10 lg:py-16">
        {/* Intro */}
        <div className="border-b border-[#181716]/10 pb-12">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#181716]/40">
            Event / Gallery
          </p>

          <div className="mt-6 flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div>
              <h1 className="font-serif text-6xl leading-[0.9] tracking-[-0.045em] md:text-8xl">
                Deliver the
                <br />
                story.
              </h1>

              <p className="mt-7 max-w-xl text-[14px] leading-7 text-[#181716]/50">
                Prepare a private collection of selected photographs
                and share it securely with your client.
              </p>
            </div>

            <div className="lg:text-right">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#181716]/35">
                Event
              </p>

              <p className="mt-2 font-serif text-2xl">
                {event.name}
              </p>
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="grid grid-cols-2 border-b border-[#181716]/10 md:grid-cols-3">
          <div className="border-r border-[#181716]/10 px-5 py-8 first:pl-0">
            <p className="font-serif text-5xl">
              {String(photos.length).padStart(2, "0")}
            </p>

            <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#181716]/45">
              Selected photos
            </p>
          </div>

          <div className="border-r border-[#181716]/10 px-5 py-8">
            <p className="font-serif text-5xl">
              {gallery ? "01" : "00"}
            </p>

            <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#181716]/45">
              Gallery
            </p>
          </div>

          <div
            className={`px-5 py-8 ${
              gallery?.published
                ? "bg-emerald-700/[0.04]"
                : ""
            }`}
          >
            <p
              className={`font-serif text-5xl ${
                gallery?.published
                  ? "text-emerald-800"
                  : "text-[#181716]"
              }`}
            >
              {gallery?.published ? "LIVE" : "DRAFT"}
            </p>

            <p
              className={`mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                gallery?.published
                  ? "text-emerald-800/70"
                  : "text-[#181716]/45"
              }`}
            >
              Status
            </p>
          </div>
        </div>

        {/* Gallery settings */}
        <section className="grid gap-12 border-b border-[#181716]/10 py-12 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#181716]/40">
              01 / Settings
            </p>

            <h2 className="mt-4 font-serif text-4xl tracking-[-0.03em]">
              Gallery details.
            </h2>

            <p className="mt-5 max-w-sm text-[12px] leading-6 text-[#181716]/45">
              Give your collection a name and create a six-digit PIN
              that your client will use to access it.
            </p>
          </div>

          <div className="border-t border-[#181716]/10">
            {/* Name */}
            <div className="border-b border-[#181716]/10 py-6">
              <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#181716]/45">
                Gallery name
              </label>

              <input
                value={galleryName}
                onChange={(e) =>
                  setGalleryName(e.target.value)
                }
                className="mt-3 w-full bg-transparent font-serif text-2xl outline-none placeholder:text-[#181716]/20"
                placeholder="Arjun & Priya Wedding"
              />
            </div>

            {/* PIN */}
            <div className="border-b border-[#181716]/10 py-6">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#181716]/45">
                  Customer PIN
                </label>

                <button
                  onClick={generateNewPin}
                  className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#181716]/45 hover:text-[#181716]"
                >
                  Generate PIN
                </button>
              </div>

              <div className="mt-3 flex items-center gap-5">
                <input
                  value={pin}
                  onChange={(e) => {
                    const value =
                      e.target.value.replace(/\D/g, "");

                    if (value.length <= 6) {
                      setPin(value);
                    }
                  }}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  className="w-full bg-transparent font-serif text-4xl tracking-[0.25em] outline-none placeholder:text-[#181716]/15"
                />

                <button
                  onClick={async () => {
                    if (!pin) return;
                    setMessageArea("settings");
                    setError("");
                    setSuccess("");
                    try {
                      await navigator.clipboard.writeText(pin);
                      setSuccess("PIN copied.");
                    } catch {
                      setError("Copy was blocked by the browser.");
                    }
                  }}
                  disabled={pin.length !== 6}
                  className="shrink-0 border border-[#181716]/15 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] hover:border-[#181716] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Copy PIN
                </button>
              </div>

              <p className="mt-3 text-[11px] text-[#181716]/35">
                PIN is stored as a cryptographic hash.
              </p>
            </div>

            <div className="flex justify-end py-6">
              <button
                onClick={saveGallery}
                disabled={saving}
                className="border border-[#181716] bg-[#181716] px-7 py-3.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-transparent hover:text-[#181716] disabled:opacity-40"
              >
                {saving
                  ? "Saving..."
                  : "Save gallery settings →"}
              </button>
            </div>

            {messageArea === "settings" && (error || success) && (
              <FeedbackMessage error={error} success={success} />
            )}
          </div>
        </section>

        {/* Selected photos */}
        <section className="border-b border-[#181716]/10 py-12">
          <div className="flex flex-col justify-between gap-5 border-b border-[#181716]/10 pb-6 md:flex-row md:items-end">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#181716]/40">
                02 / Collection
              </p>

              <h2 className="mt-4 font-serif text-4xl">
                Selected photographs.
              </h2>
            </div>

            <button
              onClick={() =>
                router.push(
                  `/admin/events/${event.id}/photos`
                )
              }
              className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#181716]/45 hover:text-[#181716]"
            >
              Edit selection →
            </button>
          </div>

          {photos.length === 0 ? (
            <div className="py-20 text-center">
              <p className="font-serif text-3xl">
                No photographs selected.
              </p>

              <p className="mt-3 text-sm text-[#181716]/40">
                Return to Photo Review and select the images you want
                to deliver.
              </p>

              <button
                onClick={() =>
                  router.push(
                    `/admin/events/${event.id}/photos`
                  )
                }
                className="mt-6 border border-[#181716] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.12em]"
              >
                Open photo review
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 pt-7 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="group relative aspect-[4/5] overflow-hidden bg-[#dedbd3]"
                >
                  {photo.preview_url ? (
                    <img
                      src={photo.preview_url}
                      alt={photo.filename}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-black/30">
                      Preview unavailable
                    </div>
                  )}

                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent p-4 pt-12 text-white">
                    <p className="truncate text-[10px]">
                      {photo.filename}
                    </p>

                    <p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-white/50">
                      {photo.uploader?.full_name || "Photographer"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Delivery */}
        <section className="grid gap-12 py-12 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#181716]/40">
              03 / Delivery
            </p>

            <h2 className="mt-4 font-serif text-4xl">
              Share with your client.
            </h2>

            <p className="mt-5 max-w-sm text-[12px] leading-6 text-[#181716]/45">
              Publish the gallery when your selection is ready. Your
              client will receive a private URL and PIN.
            </p>
          </div>

          <div className="border-t border-[#181716]/10">
            {/* URL */}
            {gallery && (
              <div className="border-b border-[#181716]/10 py-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#181716]/40">
                  Gallery URL
                </p>

                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="break-all text-[13px]">
                    {galleryUrl}
                  </p>

                  <button
                    onClick={copyGalleryLink}
                    className="w-fit border border-[#181716]/15 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] hover:border-[#181716]"
                  >
                    {copied ? "Copied" : "Copy link"}
                  </button>
                </div>
              </div>
            )}

            {/* Status */}
            <div
              className={`flex items-center justify-between border-b py-6 ${
                gallery?.published
                  ? "border-emerald-700/20 bg-emerald-700/[0.04]"
                  : "border-[#181716]/10"
              }`}
            >
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#181716]/40">
                  Publishing status
                </p>

                <p
                  className={`mt-2 font-serif text-2xl ${
                    gallery?.published
                      ? "text-emerald-800"
                      : "text-[#181716]"
                  }`}
                >
                  {gallery?.published
                    ? "Published"
                    : "Draft"}
                </p>
              </div>

              <div
                className={`h-2.5 w-2.5 rounded-full ${
                  gallery?.published
                    ? "bg-emerald-600 shadow-[0_0_0_5px_rgba(5,150,105,0.12)]"
                    : "border border-[#181716]/30"
                }`}
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-4 py-7 sm:flex-row sm:justify-end">
              {gallery?.published ? (
                <button
                  onClick={unpublishGallery}
                  disabled={publishing}
                  className="border border-[#181716]/20 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] transition hover:border-red-700 hover:text-red-700 disabled:opacity-40"
                >
                  {publishing
                    ? "Updating..."
                    : "Unpublish gallery"}
                </button>
              ) : (
                <button
                  onClick={publishGallery}
                  disabled={
                    publishing ||
                    !gallery ||
                    photos.length === 0
                  }
                  className="border border-[#181716] bg-[#181716] px-7 py-3.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-transparent hover:text-[#181716] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {publishing
                    ? "Publishing..."
                    : "Publish gallery →"}
                </button>
              )}
            </div>

            {messageArea === "delivery" && (error || success) && (
              <FeedbackMessage error={error} success={success} />
            )}
          </div>
        </section>

        {/* Footer */}
        <footer className="flex flex-col justify-between gap-3 border-t border-[#181716]/10 py-8 sm:flex-row">
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#181716]/30">
            Trizen Photo Workspace
          </p>

          <p className="text-[9px] uppercase tracking-[0.18em] text-[#181716]/30">
            Private photography delivery
          </p>
        </footer>
      </section>
    </main>
  );
}

function FeedbackMessage({
  error,
  success,
}: {
  error: string;
  success: string;
}) {
  if (!error && !success) return null;

  return (
    <div
      role="status"
      className={`mt-5 border-l-2 px-5 py-4 text-[12px] ${
        error
          ? "border-red-700 bg-red-700/5 text-red-800"
          : "border-emerald-700 bg-emerald-700/5 text-emerald-800"
      }`}
    >
      <p className="font-semibold">
        {error ? "Action needs attention" : "All set"}
      </p>
      <p className="mt-1">{error || success}</p>
    </div>
  );
}

/* ============================================================
   HELPERS
============================================================ */

function generatePin() {
  return Math.floor(
    100000 + Math.random() * 900000
  ).toString();
}

function createSlug(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") +
    "-" +
    crypto.randomUUID().slice(0, 6)
  );
}

async function hashPin(pin: string) {
  const data = new TextEncoder().encode(pin);

  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    data
  );

  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) =>
      byte.toString(16).padStart(2, "0")
    )
    .join("");
}