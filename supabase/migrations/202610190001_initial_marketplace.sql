-- MONO MARKET core schema. Run with `supabase db push` against a new project.
create extension if not exists pgcrypto;

create type public.user_role as enum ('user', 'creator', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 100),
  role public.user_role not null default 'user',
  is_suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '' check (char_length(description) <= 1000),
  logo_url text,
  banner_url text,
  website_url text,
  x_url text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index stores_public_idx on public.stores (is_published, slug);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null check (char_length(description) between 1 and 10000),
  price_minor integer not null check (price_minor >= 0 and price_minor <= 100000000),
  currency char(3) not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  category text not null check (char_length(category) between 1 and 64),
  product_type text not null check (product_type in ('ebook','pdf','template','download','asset','software','course')),
  cover_url text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, slug)
);
create index products_public_idx on public.products (store_id, status, published_at desc);
create index products_catalog_idx on public.products (status, category, published_at desc);

create table public.product_files (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  object_key text not null unique,
  original_name text not null check (char_length(original_name) between 1 and 180),
  content_type text not null check (char_length(content_type) <= 120),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 262144000),
  created_at timestamptz not null default now()
);
create index product_files_product_idx on public.product_files(product_id);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references public.products(id) on delete cascade,
  overview text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  position integer not null check (position >= 0),
  unique(course_id, position)
);
create table public.course_lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.course_modules(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  body text not null default '',
  media_object_key text,
  position integer not null check (position >= 0),
  is_preview boolean not null default false,
  unique(module_id, position)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles(id) on delete set null,
  customer_email text not null check (char_length(customer_email) <= 254),
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded','canceled')),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  subtotal_minor integer not null check (subtotal_minor >= 0),
  platform_fee_minor integer not null default 0 check (platform_fee_minor >= 0),
  fixed_fee_minor integer not null default 0 check (fixed_fee_minor >= 0),
  commission_bps integer not null check (commission_bps between 0 and 10000),
  total_minor integer not null check (total_minor >= 0),
  checkout_session_id text unique,
  access_token uuid not null default gen_random_uuid() unique,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_customer_idx on public.orders(customer_id, created_at desc);
create index orders_status_idx on public.orders(status, created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  product_title text not null,
  unit_amount_minor integer not null check (unit_amount_minor >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  unique(order_id, product_id)
);
create index order_items_product_idx on public.order_items(product_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  provider text not null,
  provider_payment_id text unique,
  provider_checkout_id text unique,
  status text not null default 'pending' check (status in ('pending','succeeded','failed','refunded')),
  processing_fee_minor integer not null default 0 check (processing_fee_minor >= 0),
  raw_reference jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(product_id, user_id)
);

create table public.download_access (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null unique references public.order_items(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  access_token uuid not null,
  download_count integer not null default 0 check (download_count >= 0),
  last_downloaded_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.creator_earnings (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null unique references public.order_items(id) on delete restrict,
  store_id uuid not null references public.stores(id) on delete restrict,
  gross_minor integer not null check (gross_minor >= 0),
  platform_fee_minor integer not null check (platform_fee_minor >= 0),
  processing_fee_minor integer not null check (processing_fee_minor >= 0),
  net_minor integer not null check (net_minor >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'pending_payout' check (status in ('pending_payout','paid_out','reversed')),
  created_at timestamptz not null default now()
);
create index creator_earnings_store_idx on public.creator_earnings(store_id, created_at desc);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  amount_minor integer not null check (amount_minor > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'pending' check (status in ('pending','processing','paid','failed','canceled')),
  provider_reference text unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table public.platform_settings (
  id boolean primary key default true check (id),
  commission_bps integer not null default 1000 check (commission_bps between 0 and 10000),
  fixed_fee_minor integer not null default 0 check (fixed_fee_minor >= 0),
  supported_currencies text[] not null default array['USD'],
  minimum_payout_minor integer not null default 1000 check (minimum_payout_minor >= 0),
  updated_at timestamptz not null default now()
);
insert into public.platform_settings (id) values (true) on conflict (id) do nothing;

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  status text not null default 'received' check (status in ('received','processing','processed','failed','ignored')),
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(provider, provider_event_id)
);

create table public.abuse_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  store_id uuid references public.stores(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  reason text not null check (char_length(reason) between 4 and 2000),
  status text not null default 'open' check (status in ('open','reviewed','resolved')),
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger stores_updated before update on public.stores for each row execute function public.set_updated_at();
create trigger products_updated before update on public.products for each row execute function public.set_updated_at();
create trigger courses_updated before update on public.courses for each row execute function public.set_updated_at();
create trigger orders_updated before update on public.orders for each row execute function public.set_updated_at();
create trigger payments_updated before update on public.payments for each row execute function public.set_updated_at();
create trigger settings_updated before update on public.platform_settings for each row execute function public.set_updated_at();

create or replace function public.set_published_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'published' and old.status is distinct from 'published' then new.published_at = now(); end if;
  if new.status <> 'published' then new.published_at = null; end if;
  return new;
end; $$;
create trigger products_published before insert or update on public.products for each row execute function public.set_published_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1)));
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.prevent_role_escalation()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and new.role is distinct from old.role and current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'Role changes require a trusted server process';
  end if;
  return new;
end; $$;
create trigger profiles_role_guard before update on public.profiles for each row execute function public.prevent_role_escalation();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin' and not is_suspended);
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
alter table public.payouts enable row level security;
alter table public.platform_settings enable row level security;
alter table public.webhook_events enable row level security;
alter table public.abuse_reports enable row level security;

create policy "profiles are visible to their owner" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "users update non-role profile fields" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "admins manage profiles" on public.profiles for all using (public.is_admin()) with check (public.is_admin());

create policy "published stores are public" on public.stores for select using (is_published or owner_id = auth.uid() or public.is_admin());
create policy "creator creates one store" on public.stores for insert with check (owner_id = auth.uid() and not exists (select 1 from public.profiles where id = auth.uid() and is_suspended));
create policy "owner updates own store" on public.stores for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner deletes own store" on public.stores for delete using (owner_id = auth.uid());
create policy "admins manage stores" on public.stores for all using (public.is_admin()) with check (public.is_admin());

create policy "published products are public" on public.products for select using (status = 'published' or exists(select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()) or public.is_admin());
create policy "creator inserts own products" on public.products for insert with check (exists(select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));
create policy "creator manages own products" on public.products for update using (exists(select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid())) with check (exists(select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));
create policy "creator deletes own products" on public.products for delete using (exists(select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));
create policy "admins manage products" on public.products for all using (public.is_admin()) with check (public.is_admin());

create policy "owner manages product files" on public.product_files for all using (exists(select 1 from public.products p join public.stores s on s.id = p.store_id where p.id = product_id and s.owner_id = auth.uid())) with check (exists(select 1 from public.products p join public.stores s on s.id = p.store_id where p.id = product_id and s.owner_id = auth.uid()));
create policy "admins manage product files" on public.product_files for all using (public.is_admin()) with check (public.is_admin());

create policy "course previews and enrolled courses readable" on public.courses for select using (exists(select 1 from public.products p join public.stores s on s.id=p.store_id where p.id=product_id and (s.owner_id=auth.uid() or public.is_admin() or exists(select 1 from public.enrollments e where e.product_id=p.id and e.user_id=auth.uid()))));
create policy "owner manages courses" on public.courses for all using (exists(select 1 from public.products p join public.stores s on s.id=p.store_id where p.id=product_id and s.owner_id=auth.uid())) with check (exists(select 1 from public.products p join public.stores s on s.id=p.store_id where p.id=product_id and s.owner_id=auth.uid()));
create policy "course modules readable by enrolled or owner" on public.course_modules for select using (exists(select 1 from public.courses c join public.products p on p.id=c.product_id join public.stores s on s.id=p.store_id where c.id=course_id and (s.owner_id=auth.uid() or public.is_admin() or exists(select 1 from public.enrollments e where e.product_id=p.id and e.user_id=auth.uid()))));
create policy "owner manages course modules" on public.course_modules for all using (exists(select 1 from public.courses c join public.products p on p.id=c.product_id join public.stores s on s.id=p.store_id where c.id=course_id and s.owner_id=auth.uid())) with check (exists(select 1 from public.courses c join public.products p on p.id=c.product_id join public.stores s on s.id=p.store_id where c.id=course_id and s.owner_id=auth.uid()));
create policy "course lessons readable by enrolled or preview" on public.course_lessons for select using (is_preview or exists(select 1 from public.course_modules m join public.courses c on c.id=m.course_id join public.products p on p.id=c.product_id join public.stores s on s.id=p.store_id where m.id=module_id and (s.owner_id=auth.uid() or public.is_admin() or exists(select 1 from public.enrollments e where e.product_id=p.id and e.user_id=auth.uid()))));
create policy "owner manages course lessons" on public.course_lessons for all using (exists(select 1 from public.course_modules m join public.courses c on c.id=m.course_id join public.products p on p.id=c.product_id join public.stores s on s.id=p.store_id where m.id=module_id and s.owner_id=auth.uid())) with check (exists(select 1 from public.course_modules m join public.courses c on c.id=m.course_id join public.products p on p.id=c.product_id join public.stores s on s.id=p.store_id where m.id=module_id and s.owner_id=auth.uid()));

create policy "customers see their orders" on public.orders for select using (customer_id = auth.uid() or public.is_admin());
create policy "customers see own order items" on public.order_items for select using (exists(select 1 from public.orders o where o.id=order_id and o.customer_id=auth.uid()) or exists(select 1 from public.products p join public.stores s on s.id=p.store_id where p.id=product_id and s.owner_id=auth.uid()) or public.is_admin());
create policy "customers see payments for own orders" on public.payments for select using (exists(select 1 from public.orders o where o.id=order_id and o.customer_id=auth.uid()) or public.is_admin());
create policy "users see own enrollments" on public.enrollments for select using (user_id=auth.uid() or public.is_admin());
create policy "users see own downloads" on public.download_access for select using (user_id=auth.uid() or public.is_admin());
create policy "creators view earnings" on public.creator_earnings for select using (exists(select 1 from public.stores s where s.id=store_id and s.owner_id=auth.uid()) or public.is_admin());
create policy "creators view payouts" on public.payouts for select using (exists(select 1 from public.stores s where s.id=store_id and s.owner_id=auth.uid()) or public.is_admin());
create policy "settings readable" on public.platform_settings for select using (true);
create policy "admins update settings" on public.platform_settings for update using (public.is_admin()) with check (public.is_admin());
create policy "users submit abuse reports" on public.abuse_reports for insert with check (reporter_id=auth.uid());
create policy "admins manage reports" on public.abuse_reports for all using (public.is_admin()) with check (public.is_admin());

-- Private storage: object names must begin with the authenticated uploader UUID.
insert into storage.buckets (id, name, public, file_size_limit) values ('product-files', 'product-files', false, 262144000) on conflict (id) do update set public = false, file_size_limit = 262144000;
create policy "upload only to own prefix" on storage.objects for insert to authenticated with check (bucket_id='product-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "manage files in own prefix" on storage.objects for update to authenticated using (bucket_id='product-files' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id='product-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete files in own prefix" on storage.objects for delete to authenticated using (bucket_id='product-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "read files in own prefix" on storage.objects for select to authenticated using (bucket_id='product-files' and (storage.foldername(name))[1] = auth.uid()::text);
