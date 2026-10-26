-- Run once in a Supabase project's SQL editor as the database owner. This
-- migration only creates gallery storage; existing SVG card endpoints do not
-- query these tables. Re-running is safe and refreshes functions/privileges.
begin;

create table if not exists public.gallery_entries (
  id text primary key check (id ~ '^[a-f0-9]{32}$'),
  manifest jsonb not null,
  constraint gallery_manifest_shape check ((
    jsonb_typeof(manifest) = 'object'
    and manifest ->> 'id' = id
    and manifest ->> 'ownerHash' ~ '^[a-f0-9]{64}$'
    and jsonb_typeof(manifest -> 'metadata') = 'object'
    and manifest #>> '{metadata,id}' = id
    and (manifest #>> '{metadata,version}')::integer between 1 and 100
    and manifest ? 'withdrawnAt'
    and octet_length(manifest::text) <= 131072
  ) is true)
);

create table if not exists public.gallery_revisions (
  entry_id text not null references public.gallery_entries(id),
  version integer not null check (version between 1 and 100),
  revision jsonb not null,
  primary key (entry_id, version),
  constraint gallery_revision_shape check ((
    jsonb_typeof(revision) = 'object'
    and (revision ->> 'version')::integer = version
    and revision #>> '{metadata,id}' = entry_id
    and (revision #>> '{metadata,version}')::integer = version
    and revision #>> '{document,kind}' = 'profilekit-card'
    and revision #>> '{document,version}' = '1'
    and jsonb_typeof(revision #> '{document,elements}') = 'array'
    and octet_length(revision::text) <= 9437184
  ) is true)
);

alter table public.gallery_entries enable row level security;
alter table public.gallery_revisions enable row level security;
-- No public policies: clients can only use ProfileKit's validated API. The
-- service role can read, while all writes go through the CAS function below.
revoke all on table public.gallery_entries, public.gallery_revisions from public, anon, authenticated, service_role;
grant select on table public.gallery_entries, public.gallery_revisions to service_role;

create or replace function public.profilekit_gallery_immutable_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Gallery revisions are immutable' using errcode = '55000';
end;
$$;
revoke all on function public.profilekit_gallery_immutable_revision() from public, anon, authenticated, service_role;
drop trigger if exists profilekit_gallery_immutable on public.gallery_revisions;
create trigger profilekit_gallery_immutable
before update or delete on public.gallery_revisions
for each row execute function public.profilekit_gallery_immutable_revision();

create or replace function public.profilekit_gallery_commit(
  p_id text,
  p_expected jsonb,
  p_manifest jsonb,
  p_revision jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_manifest jsonb;
  next_version integer;
  inserted_count integer;
begin
  if p_id is null or p_id !~ '^[a-f0-9]{32}$'
    or p_manifest is null or jsonb_typeof(p_manifest) <> 'object'
    or (p_manifest ->> 'id') is distinct from p_id
    or (p_manifest #>> '{metadata,id}') is distinct from p_id
    or coalesce(p_manifest ->> 'ownerHash', '') !~ '^[a-f0-9]{64}$'
    or not (p_manifest ? 'withdrawnAt') then
    raise exception 'Invalid gallery manifest' using errcode = 'PT400';
  end if;
  next_version := (p_manifest #>> '{metadata,version}')::integer;
  if next_version is null or next_version not between 1 and 100 then
    raise exception 'Invalid gallery version' using errcode = 'PT400';
  end if;
  if p_revision is not null and (
    (p_revision ->> 'version')::integer is distinct from next_version
    or (p_revision -> 'metadata') is distinct from (p_manifest -> 'metadata')
  ) then
    raise exception 'Revision must match manifest' using errcode = 'PT400';
  end if;

  if p_expected is null then
    if next_version <> 1 or p_revision is null or p_manifest -> 'withdrawnAt' <> 'null'::jsonb then
      raise exception 'New entries require a first revision' using errcode = 'PT400';
    end if;
    insert into public.gallery_entries(id, manifest) values (p_id, p_manifest)
      on conflict (id) do nothing;
    get diagnostics inserted_count = row_count;
    if inserted_count = 0 then
      raise exception 'Gallery entry already exists' using errcode = 'PT409';
    end if;
  else
    select manifest into current_manifest from public.gallery_entries where id = p_id for update;
    if not found or current_manifest is distinct from p_expected then
      raise exception 'Gallery entry changed' using errcode = 'PT409';
    end if;
    if (p_manifest -> 'ownerHash') is distinct from (current_manifest -> 'ownerHash')
      or (p_manifest #> '{metadata,createdAt}') is distinct from (current_manifest #> '{metadata,createdAt}')
      or (p_manifest #> '{metadata,author}') is distinct from (current_manifest #> '{metadata,author}')
      or (p_manifest #> '{metadata,source}') is distinct from (current_manifest #> '{metadata,source}')
      or (p_manifest #> '{metadata,attributions}') is distinct from (current_manifest #> '{metadata,attributions}') then
      raise exception 'Ownership and provenance are immutable' using errcode = 'PT400';
    end if;
    if p_revision is null then
      if (p_manifest -> 'metadata') is distinct from (current_manifest -> 'metadata')
        or jsonb_typeof(p_manifest -> 'withdrawnAt') <> 'string'
        or (current_manifest -> 'withdrawnAt' <> 'null'::jsonb
          and (p_manifest -> 'withdrawnAt') is distinct from (current_manifest -> 'withdrawnAt')) then
        raise exception 'Withdrawal must preserve revisions' using errcode = 'PT400';
      end if;
    else
      if current_manifest -> 'withdrawnAt' <> 'null'::jsonb
        or p_manifest -> 'withdrawnAt' <> 'null'::jsonb
        or next_version <> (current_manifest #>> '{metadata,version}')::integer + 1 then
        raise exception 'Revision is stale or withdrawn' using errcode = 'PT409';
      end if;
    end if;
    update public.gallery_entries set manifest = p_manifest where id = p_id;
  end if;

  if p_revision is not null then
    insert into public.gallery_revisions(entry_id, version, revision) values (p_id, next_version, p_revision);
  end if;
  return p_manifest;
end;
$$;

revoke all on function public.profilekit_gallery_commit(text, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.profilekit_gallery_commit(text, jsonb, jsonb, jsonb) to service_role;
comment on function public.profilekit_gallery_commit(text, jsonb, jsonb, jsonb) is 'ProfileKit server-only atomic gallery revision commit with exact manifest compare-and-swap';

commit;
