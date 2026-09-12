"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../../src/lib/supabase/client";

export default function NewEventPage() {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError("");

    if (!name.trim()) {
      setError("Please enter an event name.");
      return;
    }

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "ADMIN") {
      router.push("/login");
      return;
    }

    const { data: createdEvent, error: insertError } = await supabase
      .from("events")
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        event_date: eventDate || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error(insertError);
      setError(insertError.message);
      setLoading(false);
      return;
    }

    router.push(`/admin/events/${createdEvent.id}`);
  }

  return (
    <main className="min-h-screen bg-[#f5f3ee] text-[#181716]">
      <header className="border-b border-[#181716]/10">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-5 lg:px-10">
          <button
            onClick={() => router.push("/admin/events")}
            className="block text-left"
          >
            <Image src="/studio-trizen-logo.png" alt="Studio Trizen" width={96} height={76} className="h-10 w-12 object-contain" />
            <span className="sr-only">Studio Trizen</span>
          </button>

          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#181716]/35">
            New event
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-[1100px] px-6 py-14 lg:px-10 lg:py-24">
        <div className="grid gap-16 lg:grid-cols-[0.8fr_1.2fr]">
          {/* Intro */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#181716]/40">
              Workspace / Events / New
            </p>

            <h1 className="mt-5 font-serif text-5xl font-normal leading-[0.95] tracking-[-0.04em] md:text-7xl">
              Create
              <br />
              something
              <br />
              memorable.
            </h1>

            <p className="mt-7 max-w-sm text-[14px] leading-7 text-[#181716]/50">
              Set up the details for your photography project. You can
              assign photographers and begin collecting photographs once
              the event is created.
            </p>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="border-t border-[#181716]/15 pt-8"
          >
            <div className="space-y-9">
              <Field
                label="Event name"
                hint="Required"
              >
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Arjun & Priya Wedding"
                  className="w-full border-b border-[#181716]/20 bg-transparent py-4 text-xl outline-none placeholder:text-[#181716]/20 focus:border-[#181716]"
                />
              </Field>

              <Field
                label="Description"
                hint="Optional"
              >
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A short description of the event..."
                  rows={4}
                  className="w-full resize-none border-b border-[#181716]/20 bg-transparent py-4 text-[15px] leading-7 outline-none placeholder:text-[#181716]/20 focus:border-[#181716]"
                />
              </Field>

              <Field
                label="Event date"
                hint="Optional"
              >
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full border-b border-[#181716]/20 bg-transparent py-4 text-[15px] outline-none focus:border-[#181716]"
                />
              </Field>
            </div>

            {error && (
              <div className="mt-7 border-l-2 border-red-700 bg-red-700/5 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            )}

            <div className="mt-10 flex items-center justify-between border-t border-[#181716]/10 pt-7">
              <button
                type="button"
                onClick={() => router.push("/admin/events")}
                className="text-[13px] font-medium text-[#181716]/45 transition hover:text-[#181716]"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={loading}
                className="border border-[#181716] bg-[#181716] px-7 py-3.5 text-[13px] font-semibold text-white transition hover:bg-transparent hover:text-[#181716] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Creating..." : "Create event →"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-[12px] font-semibold uppercase tracking-[0.14em]">
          {label}
        </label>

        <span className="text-[10px] uppercase tracking-[0.12em] text-[#181716]/30">
          {hint}
        </span>
      </div>

      {children}
    </div>
  );
}