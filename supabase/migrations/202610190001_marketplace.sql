create extension if not exists pgcrypto;

create type public.account_role as enum ('user', 'admin');
create type public.store_status as enum ('draft', 'published', 'suspended');
create type public.product_status as enum ('draft', 'published', 'archived');
create type public.order_status as enum ('pending', 'paid', 'failed', 'refunded', 'canceled');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
create type public.payout_status as enum ('pending', 'processing', 'paid', 'failed', 'canceled');
create type public.product_kind as enum ('ebook', 'template', 'download', 'asset', 'software', 'course');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  role public.account_role not null default 'user',
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create function public.create_profile_for_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end;
$$;

create trigger auth_user_profile after insert on auth.users
for each row execute function public.create_profile_for_user();

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 40),
  description text not null default '' check (char_length(description) <= 500),
  logo_path text,
  banner_path text,
  social_links jsonb not null default '{}'::jsonb,
  status public.store_status not null default 'draft',
  stripe_account_id text unique,
  stripe_charges_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 100),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 40),
  description text not null check (char_length(description) between 1 and 10000),
  price_minor bigint not null check (price_minor between 50 and 100000000),
  currency text not null default 'usd' check (currency = 'usd'),
  category text not null check (char_length(category) between 2 and 40),
  product_type public.product_kind not null,
  cover_image_url text,
  status public.product_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, slug)
);

create table public.product_files (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null unique,
  original_name text not null check (char_length(original_name) <= 255),
  content_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 52428800),
  created_at timestamptz not null default now()
);

create table public.courses (
  product_id uuid primary key references public.products(id) on delete cascade,
  course_description text not null default '',
  created_at timestamptz not null default now()
);

create table public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(product_id) on delete cascade,
  title text not null,
  sort_order integer not null default 0,
  unique (course_id, sort_order)
);

create table public.course_lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.course_modules(id) on delete cascade,
  title text not null,
  content text not null default '',
  sort_order integer not null default 0,
  unique (module_id, sort_order)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id),
  buyer_email text not null,
  currency text not null check (currency ~ '^[a-z]{3}$'),
  amount_total_minor bigint not null check (amount_total_minor > 0),
  status public.order_status not null default 'pending',
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  creator_id uuid not null references public.profiles(id),
  title_snapshot text not null,
  gross_minor bigint not null check (gross_minor > 0),
  commission_minor bigint not null check (commission_minor between 0 and gross_minor),
  processing_fee_minor bigint not null default 0 check (processing_fee_minor between 0 and gross_minor),
  creator_net_minor bigint not null check (creator_net_minor between 0 and gross_minor),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  unique (order_id, product_id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  provider text not null check (provider in ('stripe')),
  provider_session_id text unique,
  provider_payment_id text unique,
  status public.payment_status not null default 'pending',
  amount_minor bigint not null check (amount_minor > 0),
  refunded_minor bigint not null default 0 check (refunded_minor >= 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(product_id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (course_id, user_id)
);

create table public.download_access (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  granted_at timestamptz not null default now(),
  unique (order_item_id, buyer_id)
);

create table public.creator_earnings (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null unique references public.order_items(id) on delete restrict,
  creator_id uuid not null references public.profiles(id),
  gross_minor bigint not null check (gross_minor > 0),
  commission_minor bigint not null check (commission_minor >= 0),
  processing_fee_minor bigint not null default 0 check (processing_fee_minor >= 0),
  net_minor bigint not null check (net_minor >= 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  created_at timestamptz not null default now()
);

create table public.creator_earning_adjustments (
  id uuid primary key default gen_random_uuid(),
  webhook_event_id text not null,
  order_item_id uuid not null references public.order_items(id),
  creator_id uuid not null references public.profiles(id),
  seller_debit_minor bigint not null check (seller_debit_minor >= 0),
  commission_reversed_minor bigint not null check (commission_reversed_minor >= 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  created_at timestamptz not null default now(),
  unique (webhook_event_id, order_item_id)
);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id),
  provider_reference text unique,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  status public.payout_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_settings (
  id integer primary key default 1 check (id = 1),
  commission_bps integer not null default 1000 check (commission_bps between 0 and 10000),
  fixed_fee_minor bigint not null default 0 check (fixed_fee_minor >= 0),
  supported_currencies text[] not null default array['usd'],
  minimum_payout_minor bigint not null default 0 check (minimum_payout_minor >= 0),
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (id) values (1) on conflict (id) do nothing;

create table public.webhook_events (
  id text primary key,
  provider text not null check (provider in ('stripe')),
  event_type text not null,
  processed_at timestamptz not null default now()
);
alter table public.creator_earning_adjustments
  add constraint creator_earning_adjustments_webhook_fk
  foreign key (webhook_event_id) references public.webhook_events(id);

create table public.abuse_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id),
  store_id uuid references public.stores(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  reason text not null check (char_length(reason) between 10 and 2000),
  status text not null default 'new' check (status in ('new', 'reviewing', 'resolved')),
  created_at timestamptz not null default now(),
  check (num_nonnulls(store_id, product_id) = 1)
);

create table public.rate_limit_entries (
  key text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1
);
alter table public.rate_limit_entries enable row level security;
revoke all on public.rate_limit_entries from public, anon, authenticated;

create index products_store_status_idx on public.products (store_id, status);
create index orders_buyer_created_idx on public.orders (buyer_id, created_at desc);
create index order_items_creator_idx on public.order_items (creator_id, order_id);
create index earnings_creator_created_idx on public.creator_earnings (creator_id, created_at desc);
create index download_access_buyer_idx on public.download_access (buyer_id);
create index stores_status_idx on public.stores (status);

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
$$;

create function public.is_order_buyer(p_order_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.orders o where o.id = p_order_id and o.buyer_id = (select auth.uid()))
$$;

create function public.is_order_creator(p_order_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.order_items i where i.order_id = p_order_id and i.creator_id = (select auth.uid()))
$$;

alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.products enable row level security;
alter table public.product_files enable row level security;
alter table public.courses enable row level security;
alter table public.course_modules enable row level security;
alter table public.course_lessons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.enrollments enable row level security;
alter table public.download_access enable row level security;
alter table public.creator_earnings enable row level security;
alter table public.creator_earning_adjustments enable row level security;
alter table public.payouts enable row level security;
alter table public.platform_settings enable row level security;
alter table public.webhook_events enable row level security;
alter table public.abuse_reports enable row level security;

create policy "profile owner or admin can view" on public.profiles for select to authenticated
using (id = (select auth.uid()) or public.is_admin());
create policy "profile owner can update public details" on public.profiles for update to authenticated
using (id = (select auth.uid()) or public.is_admin())
with check (id = (select auth.uid()) or public.is_admin());

revoke update on public.profiles from authenticated;
grant update (display_name, updated_at) on public.profiles to authenticated;

create policy "published stores are public" on public.stores for select to anon, authenticated
using (status = 'published' or owner_id = (select auth.uid()) or public.is_admin());
create policy "creator creates own store" on public.stores for insert to authenticated
with check (owner_id = (select auth.uid()));
create policy "creator updates own store" on public.stores for update to authenticated
using (owner_id = (select auth.uid()) or public.is_admin())
with check ((owner_id = (select auth.uid()) or public.is_admin()) and (stripe_account_id is null or public.is_admin()));
create policy "creator deletes own store" on public.stores for delete to authenticated
using (owner_id = (select auth.uid()) or public.is_admin());

create policy "published products are public" on public.products for select to anon, authenticated
using (status = 'published' and exists (select 1 from public.stores s where s.id = store_id and s.status = 'published')
  or exists (select 1 from public.stores s where s.id = store_id and (s.owner_id = (select auth.uid()) or public.is_admin())));
create policy "creator manages own products" on public.products for insert to authenticated
with check (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = (select auth.uid())));
create policy "creator edits own products" on public.products for update to authenticated
using (exists (select 1 from public.stores s where s.id = store_id and (s.owner_id = (select auth.uid()) or public.is_admin())))
with check (exists (select 1 from public.stores s where s.id = store_id and (s.owner_id = (select auth.uid()) or public.is_admin())));
create policy "creator deletes own products" on public.products for delete to authenticated
using (exists (select 1 from public.stores s where s.id = store_id and (s.owner_id = (select auth.uid()) or public.is_admin())));

create policy "creator manages own product files" on public.product_files for all to authenticated
using (exists (select 1 from public.products p join public.stores s on s.id = p.store_id where p.id = product_id and (s.owner_id = (select auth.uid()) or public.is_admin())))
with check (exists (select 1 from public.products p join public.stores s on s.id = p.store_id where p.id = product_id and (s.owner_id = (select auth.uid()) or public.is_admin())));

create policy "course info is public" on public.courses for select to anon, authenticated
using (exists (select 1 from public.products p where p.id = product_id and p.status = 'published'));
create policy "course owners manage courses" on public.courses for all to authenticated
using (exists (select 1 from public.products p join public.stores s on s.id = p.store_id where p.id = product_id and s.owner_id = (select auth.uid())))
with check (exists (select 1 from public.products p join public.stores s on s.id = p.store_id where p.id = product_id and s.owner_id = (select auth.uid())));

create policy "modules visible to creator or enrolled student" on public.course_modules for select to authenticated
using (exists (select 1 from public.courses c join public.products p on p.id = c.product_id join public.stores s on s.id = p.store_id where c.product_id = course_modules.course_id and s.owner_id = (select auth.uid())
  union all
  select 1 from public.enrollments e where e.course_id = course_modules.course_id and e.user_id = (select auth.uid())));
create policy "course owner manages modules" on public.course_modules for all to authenticated
using (exists (select 1 from public.products p join public.stores s on s.id = p.store_id where p.id = course_id and s.owner_id = (select auth.uid())))
with check (exists (select 1 from public.products p join public.stores s on s.id = p.store_id where p.id = course_id and s.owner_id = (select auth.uid())));

create policy "lessons visible to creator or enrolled student" on public.course_lessons for select to authenticated
using (exists (select 1 from public.course_modules m join public.products p on p.id = m.course_id join public.stores s on s.id = p.store_id where m.id = module_id and s.owner_id = (select auth.uid()))
  or exists (select 1 from public.course_modules m join public.enrollments e on e.course_id = m.course_id where m.id = module_id and e.user_id = (select auth.uid())));
create policy "course owner manages lessons" on public.course_lessons for all to authenticated
using (exists (select 1 from public.course_modules m join public.products p on p.id = m.course_id join public.stores s on s.id = p.store_id where m.id = module_id and s.owner_id = (select auth.uid())))
with check (exists (select 1 from public.course_modules m join public.products p on p.id = m.course_id join public.stores s on s.id = p.store_id where m.id = module_id and s.owner_id = (select auth.uid())));

create policy "buyer or product creator can view order" on public.orders for select to authenticated
using (buyer_id = (select auth.uid()) or public.is_admin() or public.is_order_creator(id));
create policy "buyer can view order items" on public.order_items for select to authenticated
using (public.is_order_buyer(order_id)
  or creator_id = (select auth.uid()) or public.is_admin());
create policy "buyer can view own payments" on public.payments for select to authenticated
using (exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = (select auth.uid())) or public.is_admin());
create policy "buyer can view own enrollments" on public.enrollments for select to authenticated
using (user_id = (select auth.uid()) or public.is_admin());
create policy "buyer can view own downloads" on public.download_access for select to authenticated
using (buyer_id = (select auth.uid()) or public.is_admin());
create policy "creator can view own earnings" on public.creator_earnings for select to authenticated
using (creator_id = (select auth.uid()) or public.is_admin());
create policy "creator can view own earning adjustments" on public.creator_earning_adjustments for select to authenticated
using (creator_id = (select auth.uid()) or public.is_admin());
create policy "creator can view own payout records" on public.payouts for select to authenticated
using (creator_id = (select auth.uid()) or public.is_admin());
create policy "reporter can view own reports" on public.abuse_reports for select to authenticated
using (reporter_id = (select auth.uid()) or public.is_admin());
create policy "reporter creates own reports" on public.abuse_reports for insert to authenticated
with check (reporter_id = (select auth.uid()));
create policy "commission settings are readable" on public.platform_settings for select to anon, authenticated using (true);

create function public.reject_earnings_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Earnings ledger rows are immutable';
end;
$$;
create trigger earnings_are_immutable before update or delete on public.creator_earnings
for each row execute function public.reject_earnings_mutation();

create function public.complete_stripe_order(
  p_event_id text, p_event_type text, p_order_id uuid, p_payment_id text,
  p_amount_minor bigint, p_currency text
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_item public.order_items%rowtype;
  v_previous_refund bigint;
  v_previous_seller_debit bigint;
  v_previous_fee_reversed bigint;
begin
  insert into public.webhook_events (id, provider, event_type)
  values (p_event_id, 'stripe', p_event_type) on conflict (id) do nothing;
  if not found then return false; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;

  if p_event_type = 'checkout.session.completed' then
    if p_amount_minor <> v_order.amount_total_minor or lower(p_currency) <> v_order.currency then
      raise exception 'Payment amount or currency mismatch';
    end if;
    if v_order.status = 'paid' then return true; end if;
    if v_order.status <> 'pending' then raise exception 'Order is not pending'; end if;

    update public.orders set status = 'paid', updated_at = now() where id = v_order.id;
    update public.payments set status = 'paid', provider_payment_id = p_payment_id, updated_at = now()
      where order_id = v_order.id;
    for v_item in select * from public.order_items where order_id = v_order.id loop
      insert into public.creator_earnings (order_item_id, creator_id, gross_minor, commission_minor, processing_fee_minor, net_minor, currency)
      values (v_item.id, v_item.creator_id, v_item.gross_minor, v_item.commission_minor, v_item.processing_fee_minor, v_item.creator_net_minor, v_item.currency)
      on conflict (order_item_id) do nothing;
      insert into public.download_access (order_item_id, buyer_id) values (v_item.id, v_order.buyer_id)
      on conflict (order_item_id, buyer_id) do nothing;
      if exists (select 1 from public.courses c where c.product_id = v_item.product_id) then
        insert into public.enrollments (course_id, user_id, order_id)
        values (v_item.product_id, v_order.buyer_id, v_order.id) on conflict (course_id, user_id) do nothing;
      end if;
    end loop;
  elsif p_event_type = 'checkout.session.expired' then
    update public.orders set status = 'failed', updated_at = now() where id = v_order.id and status = 'pending';
    update public.payments set status = 'failed', updated_at = now() where order_id = v_order.id and status = 'pending';
  elsif p_event_type = 'charge.refunded' then
    if lower(p_currency) <> v_order.currency or p_amount_minor < 0 or p_amount_minor > v_order.amount_total_minor then
      raise exception 'Refund amount or currency mismatch';
    end if;
    if v_order.status not in ('paid', 'refunded') then raise exception 'Cannot refund an unpaid order'; end if;
    select refunded_minor into v_previous_refund from public.payments where order_id = v_order.id for update;
    update public.payments set refunded_minor = greatest(refunded_minor, p_amount_minor),
      status = case when p_amount_minor >= amount_minor then 'refunded'::public.payment_status else status end,
      updated_at = now() where order_id = v_order.id;
    if p_amount_minor >= v_order.amount_total_minor then
      update public.orders set status = 'refunded', updated_at = now() where id = v_order.id and status = 'paid';
    end if;
    if p_amount_minor > coalesce(v_previous_refund, 0) then
    for v_item in select * from public.order_items where order_id = v_order.id loop
      select coalesce(sum(a.seller_debit_minor), 0), coalesce(sum(a.commission_reversed_minor), 0)
        into v_previous_seller_debit, v_previous_fee_reversed
        from public.creator_earning_adjustments a where a.order_item_id = v_item.id;
      insert into public.creator_earning_adjustments (
        webhook_event_id, order_item_id, creator_id, seller_debit_minor, commission_reversed_minor, currency
      ) values (
        p_event_id, v_item.id, v_item.creator_id,
        greatest(0, floor(v_item.creator_net_minor::numeric * p_amount_minor / v_order.amount_total_minor)::bigint - v_previous_seller_debit),
        greatest(0, floor(v_item.commission_minor::numeric * p_amount_minor / v_order.amount_total_minor)::bigint - v_previous_fee_reversed),
        v_item.currency
      ) on conflict (webhook_event_id, order_item_id) do nothing;
    end loop;
    end if;
  end if;
  return true;
end;
$$;

revoke all on function public.complete_stripe_order(text, text, uuid, text, bigint, text) from public, anon, authenticated;
grant execute on function public.complete_stripe_order(text, text, uuid, text, bigint, text) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-files', 'product-files', false, 52428800,
  array['application/pdf','application/zip','application/x-zip-compressed','application/epub+zip','application/octet-stream','text/plain','image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 52428800;

create policy "creators access their own private files" on storage.objects for select to authenticated
using (bucket_id = 'product-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "creators upload files into their own folder" on storage.objects for insert to authenticated
with check (bucket_id = 'product-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "creators delete their own files" on storage.objects for delete to authenticated
using (bucket_id = 'product-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create function public.guard_store_payment_account() returns trigger
language plpgsql set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if tg_op = 'INSERT' and (new.stripe_account_id is not null or new.stripe_charges_enabled) then
      raise exception 'Payment account fields can only be set by the platform';
    elsif tg_op = 'UPDATE'
      and (new.stripe_account_id is distinct from old.stripe_account_id
        or new.stripe_charges_enabled is distinct from old.stripe_charges_enabled) then
      raise exception 'Payment account fields can only be changed by the platform';
    end if;
  end if;
  return new;
end;
$$;
create trigger store_payment_account_guard before insert or update on public.stores
for each row execute function public.guard_store_payment_account();

create function public.consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  insert into public.rate_limit_entries (key, window_started_at, request_count)
  values (p_key, now(), 1)
  on conflict (key) do update set
    request_count = case
      when public.rate_limit_entries.window_started_at < now() - make_interval(secs => p_window_seconds) then 1
      else public.rate_limit_entries.request_count + 1 end,
    window_started_at = case
      when public.rate_limit_entries.window_started_at < now() - make_interval(secs => p_window_seconds) then now()
      else public.rate_limit_entries.window_started_at end
  returning request_count into v_count;
  return v_count <= p_limit;
end;
$$;
revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
