import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const SITE_URL = "https://trizenstudio-fawn.vercel.app";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(request: NextRequest) {
  try {
    // --------------------------------------------------
    // 1. Get current logged-in admin
    // --------------------------------------------------

    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {},
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    // --------------------------------------------------
    // 2. Verify admin
    // --------------------------------------------------

    const { data: adminProfile, error: adminError } =
      await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (
      adminError ||
      !adminProfile ||
      adminProfile.role !== "ADMIN"
    ) {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 }
      );
    }

    // --------------------------------------------------
    // 3. Read request
    // --------------------------------------------------

    const body = await request.json();

    const fullName =
      typeof body.fullName === "string"
        ? body.fullName.trim()
        : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    // --------------------------------------------------
    // 4. Validate
    // --------------------------------------------------

    if (fullName.length < 2) {
      return NextResponse.json(
        { error: "Please enter a valid photographer name." },
        { status: 400 }
      );
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 5. Create Supabase Auth invitation
    // --------------------------------------------------

    const { data: invite, error: inviteError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "invite",
        email,
        options: {
          data: {
            full_name: fullName,
            role: "TEAM_MEMBER",
            password_set: false,
          },
            redirectTo: `${SITE_URL}/account/password`,
        },
      });

    if (
      inviteError ||
      !invite?.user ||
      !invite.properties?.action_link
    ) {
      return NextResponse.json(
        {
          error:
            inviteError?.message ??
            "Unable to create photographer account.",
        },
        { status: 400 }
      );
    }

    const newUserId = invite.user.id;

    // --------------------------------------------------
    // 6. Create OR update profile
    //
    // IMPORTANT:
    // Your Supabase Auth trigger may already have created
    // this profile. Therefore we use UPSERT instead of INSERT.
    // --------------------------------------------------

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: newUserId,
          full_name: fullName,
          email,
          role: "TEAM_MEMBER",
        },
        {
          onConflict: "id",
        }
      );

    if (profileError) {
      // Clean up Auth user if profile creation fails.
      await supabaseAdmin.auth.admin.deleteUser(newUserId);

      return NextResponse.json(
        { error: profileError.message },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 7. Success
    // --------------------------------------------------

    return NextResponse.json(
      {
        photographer: {
          id: newUserId,
          full_name: fullName,
          email,
        },
        setupLink: `${SITE_URL}/account/invite?link=${encodeURIComponent(invite.properties.action_link)}`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Failed to create photographer:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to create photographer account.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");

const token = authorization?.startsWith("Bearer ")
  ? authorization.slice(7)
  : null;

if (!token) {
  return NextResponse.json(
    { error: "Authentication required." },
    { status: 401 }
  );
}

const {
  data: { user },
  error: userError,
} = await supabaseAdmin.auth.getUser(token);

if (userError || !user) {
  return NextResponse.json(
    { error: "Authentication required." },
    { status: 401 }
  );
}

    const { data: adminProfile } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).single();
    if (!adminProfile || adminProfile.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const body = await request.json();
    const photographerId = typeof body.photographerId === "string" ? body.photographerId : "";
    if (!photographerId || photographerId === user.id) {
      return NextResponse.json({ error: "Invalid photographer account." }, { status: 400 });
    }

    const { data: photographer } = await supabaseAdmin.from("profiles").select("id, role").eq("id", photographerId).single();
    if (!photographer || photographer.role !== "TEAM_MEMBER") {
      return NextResponse.json({ error: "Photographer account not found." }, { status: 404 });
    }

    const { error: membershipError } = await supabaseAdmin.from("event_members").delete().eq("user_id", photographerId);
    if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 400 });

    const { error: profileError } = await supabaseAdmin.from("profiles").delete().eq("id", photographerId);
    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 });

    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(photographerId);
    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Failed to delete photographer:", error);
    return NextResponse.json({ error: "Unable to delete photographer account." }, { status: 500 });
  }
}