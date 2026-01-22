-- Create per-organization, per-year document sequence table to allocate unique sequential numbers
create table if not exists public.document_sequences (
  organization_id uuid not null,
  document_type text not null,
  year int not null default 0,
  last_number int not null default 0,
  updated_at timestamp with time zone not null default now(),
  primary key (organization_id, document_type, year)
);

-- Keep updated_at fresh
drop trigger if exists trg_document_sequences_updated_at on public.document_sequences;
create trigger trg_document_sequences_updated_at
before update on public.document_sequences
for each row execute function public.update_updated_at_column();

-- RLS
alter table public.document_sequences enable row level security;

-- Policies: only organization owner/member (or superadmin) can access
create policy "Document sequences are readable by organization members"
on public.document_sequences
for select
using (
  public.is_superadmin()
  or exists (
    select 1 from public.organizations o
    where o.id = document_sequences.organization_id
      and o.api_user_id = auth.uid()
  )
  or exists (
    select 1 from public.organization_members om
    where om.organization_id = document_sequences.organization_id
      and om.user_id = auth.uid()
  )
);

create policy "Document sequences are insertable by organization members"
on public.document_sequences
for insert
with check (
  public.is_superadmin()
  or exists (
    select 1 from public.organizations o
    where o.id = document_sequences.organization_id
      and o.api_user_id = auth.uid()
  )
  or exists (
    select 1 from public.organization_members om
    where om.organization_id = document_sequences.organization_id
      and om.user_id = auth.uid()
  )
);

create policy "Document sequences are updatable by organization members"
on public.document_sequences
for update
using (
  public.is_superadmin()
  or exists (
    select 1 from public.organizations o
    where o.id = document_sequences.organization_id
      and o.api_user_id = auth.uid()
  )
  or exists (
    select 1 from public.organization_members om
    where om.organization_id = document_sequences.organization_id
      and om.user_id = auth.uid()
  )
);

-- Allocate the next document number atomically (fixes concurrent saves + RLS-hidden quotes)
create or replace function public.next_document_number(
  p_organization_id uuid,
  p_document_type text
)
returns table(document_number text, sequential_number int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_format record;
  v_year int := extract(year from current_date);
  v_year_bucket int;
  v_year_str text := '';
  v_prefix text := '';
  v_suffix text := '';
  v_use_year boolean := true;
  v_year_format text := 'YY';
  v_digits int := 4;
  v_next int;
begin
  if p_organization_id is null then
    raise exception 'organization_id is required';
  end if;

  if p_document_type not in ('quote','order') then
    raise exception 'invalid document_type: %', p_document_type;
  end if;

  -- Authorization: caller must be owner, member, or superadmin
  if not (
    public.is_superadmin()
    or exists (
      select 1 from public.organizations o
      where o.id = p_organization_id
        and o.api_user_id = auth.uid()
    )
    or exists (
      select 1 from public.organization_members om
      where om.organization_id = p_organization_id
        and om.user_id = auth.uid()
    )
  ) then
    raise exception 'access denied';
  end if;

  -- Load numbering format (organization-level)
  select * into v_format
  from public.numbering_formats
  where organization_id = p_organization_id
    and document_type = p_document_type
  limit 1;

  -- Defaults if missing
  if found then
    v_prefix := coalesce(v_format.prefix, '');
    v_suffix := coalesce(v_format.suffix, '');
    v_use_year := coalesce(v_format.use_year, true);
    v_year_format := coalesce(v_format.year_format, case when p_document_type = 'order' then 'YYYY' else 'YY' end);
    v_digits := coalesce(v_format.sequential_digits, 4);
  else
    v_prefix := case when p_document_type = 'order' then 'SO-' else '' end;
    v_suffix := '';
    v_use_year := true;
    v_year_format := case when p_document_type = 'order' then 'YYYY' else 'YY' end;
    v_digits := 4;
  end if;

  v_year_bucket := case when v_use_year then v_year else 0 end;

  -- Atomic increment per org/doc/year
  insert into public.document_sequences (organization_id, document_type, year, last_number)
  values (p_organization_id, p_document_type, v_year_bucket, 1)
  on conflict (organization_id, document_type, year)
  do update set
    last_number = public.document_sequences.last_number + 1,
    updated_at = now()
  returning last_number into v_next;

  if v_use_year then
    if v_year_format = 'YY' then
      v_year_str := right(v_year::text, 2);
    else
      v_year_str := v_year::text;
    end if;
  end if;

  document_number := v_prefix
    || (case when v_use_year then v_year_str || '-' else '' end)
    || lpad(v_next::text, v_digits, '0')
    || v_suffix;

  sequential_number := v_next;

  -- Best-effort sync back to numbering_formats
  update public.numbering_formats
  set last_sequential_number = v_next
  where organization_id = p_organization_id
    and document_type = p_document_type;

  return next;
end;
$$;