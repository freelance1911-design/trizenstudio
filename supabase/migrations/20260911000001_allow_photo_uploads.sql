alter table public.photos enable row level security;

drop policy if exists "Photographers can insert assigned event photos" on public.photos;
create policy "Photographers can insert assigned event photos"
on public.photos
for insert
to authenticated
with check (
  uploaded_by = (select auth.uid())
  and (
    exists (
      select 1
      from public.event_members
      where event_members.event_id = photos.event_id
        and event_members.user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'ADMIN'
    )
  )
);

drop policy if exists "Photographers can delete own photos" on public.photos;
create policy "Photographers can delete own photos"
on public.photos
for delete
to authenticated
using (uploaded_by = (select auth.uid()));
