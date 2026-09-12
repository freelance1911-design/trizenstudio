import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { slug, pin } = await request.json();

    if (!slug || !pin) {
      return NextResponse.json(
        { error: "Gallery slug and PIN are required." },
        { status: 400 }
      );
    }

    if (!/^\d{6}$/.test(pin)) {
      return NextResponse.json(
        { error: "PIN must be 6 digits." },
        { status: 400 }
      );
    }

    const pinHash = crypto
      .createHash("sha256")
      .update(pin)
      .digest("hex");

    const { data: gallery, error: galleryError } =
      await supabaseAdmin
        .from("galleries")
        .select("id, event_id, slug")
        .eq("slug", slug)
        .eq("pin_hash", pinHash)
        .eq("published", true)
        .single();

    if (galleryError || !gallery) {
      return NextResponse.json(
        { error: "Incorrect PIN or gallery unavailable." },
        { status: 401 }
      );
    }

    const { data: galleryPhotos, error: photosError } =
      await supabaseAdmin
        .from("gallery_photos")
        .select(`
          photo_id,
          photos (
            id,
            filename,
            storage_path,
            file_size,
            created_at
          )
        `)
        .eq("gallery_id", gallery.id);

    if (photosError) {
      console.error(photosError);

      return NextResponse.json(
        { error: "Unable to load gallery photos." },
        { status: 500 }
      );
    }

    const photos = [];

    for (const item of galleryPhotos ?? []) {
      const photo = Array.isArray(item.photos)
        ? item.photos[0]
        : item.photos;

      if (!photo) continue;

      const { data: signedUrl, error: signedUrlError } =
        await supabaseAdmin.storage
          .from("photos")
          .createSignedUrl(photo.storage_path, 3600);

      if (signedUrlError || !signedUrl) {
        console.error(signedUrlError);
        continue;
      }

      photos.push({
        id: photo.id,
        filename: photo.filename,
        fileSize: photo.file_size,
        createdAt: photo.created_at,
        url: signedUrl.signedUrl,
      });
    }

    return NextResponse.json({
      gallery: {
        id: gallery.id,
        slug: gallery.slug,
      },
      photos,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}