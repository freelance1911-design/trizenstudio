"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";

type Photo = {
  id: string;
  filename: string;
  fileSize: number;
  createdAt: string;
  url: string;
};

export default function CustomerGalleryPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [pin, setPin] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState("");

  const returnToPin = () => {
    setPhotos([]);
    setPin("");
    setError("");
    setDownloadError("");
    setUnlocked(false);
  };

  const downloadPhoto = async (photo: Photo) => {
    setDownloadingId(photo.id);
    setDownloadError("");

    try {
      const response = await fetch(photo.url);

      if (!response.ok) {
        throw new Error("The photograph could not be downloaded.");
      }

      const blobUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = photo.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      setDownloadError(
        `Unable to download "${photo.filename}". Please try again.`
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const unlockGallery = async () => {
    setError("");

    if (!/^\d{6}$/.test(pin)) {
      setError("Please enter a valid 6-digit PIN.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/gallery/access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slug,
          pin,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to access gallery.");
        setLoading(false);
        return;
      }

      setPhotos(data.photos || []);
      setUnlocked(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!unlocked) {
    return (
      <main className="min-h-screen overflow-hidden bg-[#f7f4ee] text-[#17212b]">
        <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col px-6 py-6 sm:px-10 lg:px-14">
          <header className="flex items-center justify-between border-b border-[#17212b]/15 pb-5">
            <div className="flex items-center gap-3">
              <Image src="/studio-trizen-logo.png" alt="Studio Trizen" width={96} height={76} className="h-12 w-16 object-contain" />
              <div><p className="text-sm font-semibold tracking-[0.18em]">STUDIO TRIZEN</p><p className="text-[10px] uppercase tracking-[0.18em] text-[#69747a]">Private photography</p></div>
            </div>
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.2em] text-[#176875] sm:block">A personal collection</span>
          </header>

          <section className="grid flex-1 items-center gap-14 py-14 lg:grid-cols-[1fr_0.82fr] lg:py-20">
            <div>
              <p className="mb-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-[#176875]"><span className="h-2 w-2 rounded-full bg-[#e5763f]" /> Welcome to your gallery</p>
              <h1 className="max-w-2xl font-serif text-6xl leading-[0.86] tracking-[-0.05em] sm:text-8xl">Your memories,<br /><span className="text-[#e5763f]">beautifully kept.</span></h1>
              <p className="mt-8 max-w-lg text-base leading-7 text-[#69747a]">A private collection prepared especially for you by Studio Trizen. Enter your access PIN to step inside.</p>
              <div className="mt-10 flex items-center gap-4 text-xs uppercase tracking-[0.16em] text-[#69747a]"><span className="h-px w-10 bg-[#e5763f]" /> Curated with care</div>
            </div>

            <div className="relative mx-auto w-full max-w-md">
              <div className="absolute -right-5 -top-5 h-24 w-24 rounded-full bg-[#efb44c]" />
              <div className="absolute -bottom-6 -left-5 h-20 w-20 rounded-full bg-[#176875]" />
              <div className="relative border border-[#17212b]/15 bg-[#fffdf8] p-7 shadow-[12px_14px_0_#176875]/10 sm:p-9">
              <label
                htmlFor="pin"
                className="mb-3 block text-xs font-semibold uppercase tracking-[0.2em] text-[#176875]"
              >
                Gallery PIN
              </label>

              <input
                id="pin"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    unlockGallery();
                  }
                }}
                placeholder="000000"
                className="w-full border-b border-[#17212b]/20 bg-transparent px-0 py-4 text-3xl tracking-[0.35em] outline-none transition placeholder:text-black/15 focus:border-[#e5763f]"
              />

              {error && (
                <p className="mt-4 border border-red-900/10 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {error}
                </p>
              )}

              <button
                onClick={unlockGallery}
                disabled={loading || pin.length !== 6}
                className="mt-8 flex w-full items-center justify-center rounded-full bg-[#17212b] px-6 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-[#176875] disabled:cursor-not-allowed disabled:opacity-30"
              >
                {loading ? "Verifying..." : "Enter Gallery"}
              </button>
            </div>
            <p className="mt-6 text-center text-xs text-[#69747a]">Private, secure, and prepared with care.</p>
              </div>
          </section>
          <footer className="border-t border-[#17212b]/15 pt-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#69747a]">Studio Trizen / Made for meaningful stories</footer>
          </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f4ee] text-[#17212b]">
      <header className="border-b border-[#17212b]/10 bg-[#fffdf8]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 px-4 py-5 sm:px-6 sm:py-6 lg:px-10">
          <div>
            <div className="flex items-center gap-3"><Image src="/studio-trizen-logo.png" alt="Studio Trizen" width={96} height={76} className="h-12 w-16 object-contain" /><div><p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#176875]">Studio Trizen presents</p><h1 className="mt-1 font-serif text-3xl tracking-[-0.02em]">Your Collection</h1></div></div>
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.15em] text-[#176875]">Photographs</p><p className="mt-1 text-sm font-semibold">
                {photos.length}
              </p>
            </div>
            <button
              onClick={returnToPin}
              className="flex items-center gap-2 rounded-full border border-[#17212b]/15 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#17212b] transition hover:border-[#e5763f] hover:text-[#e5763f] sm:px-4"
            >
              <span aria-hidden="true">←</span>
              Back to PIN
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-10 lg:px-10 lg:py-16">
        {downloadError && (
          <p className="mb-6 border-l-2 border-red-700 bg-red-50 px-4 py-3 text-sm text-red-800">
            {downloadError}
          </p>
        )}

        {photos.length === 0 ? (
          <div className="border border-black/10 py-24 text-center">
            <h2 className="font-serif text-4xl">
              No photographs yet.
            </h2>

            <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-black/50">
              The gallery is available, but there are currently no selected
              photographs to display.
            </p>
          </div>
        ) : (
          <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="group relative mb-5 block break-inside-avoid overflow-hidden bg-white shadow-[0_12px_30px_rgba(23,33,43,0.08)]"
              >
                <img
                  src={photo.url}
                  alt={photo.filename}
                  className="block h-auto w-full transition duration-700 group-hover:scale-[1.02]"
                  loading="lazy"
                />
                <button
                  type="button"
                  onClick={() => void downloadPhoto(photo)}
                  disabled={downloadingId === photo.id}
                  className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full bg-[#fffdf8]/95 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#17212b] opacity-100 shadow-lg transition sm:opacity-0 sm:group-hover:opacity-100 hover:bg-[#e5763f] hover:text-white disabled:cursor-wait disabled:opacity-70"
                  aria-label={`Download ${photo.filename}`}
                >
                  <DownloadIcon />
                  {downloadingId === photo.id ? "Preparing..." : "Download"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-black/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-8 lg:px-10">
          <div className="flex items-center gap-3"><Image src="/studio-trizen-logo.png" alt="Studio Trizen" width={80} height={64} className="h-10 w-12 object-contain" /><p className="text-xs font-semibold uppercase tracking-[0.18em]">Studio Trizen</p></div>

          <p className="text-xs uppercase tracking-[0.15em] text-black/35">
            Private Photography Collection
          </p>
        </div>
      </footer>
    </main>
  );
}

function DownloadIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></svg>;
}