-- content-engine automations: plain Postgres, any host.
-- Idempotent: safe to run more than once. No deletes anywhere.

create table if not exists ce_state (
  id           text primary key,
  since_id     text,
  last_plug_id text,
  updated_at   timestamptz not null default now()
);

create table if not exists ce_posts (
  post_id              text primary key,
  created_at           timestamptz not null,
  kind                 text not null,
  check_due_at         timestamptz not null,
  -- pending | checking | passed | below_bar | skipped | expired | failed
  status               text not null default 'pending',
  skip_reason          text,
  impressions_at_check bigint,
  plug_id              text,
  -- null | notified | replied | failed
  plug_status          text,
  plug_reply_id        text,
  plug_error           text,
  updated_at           timestamptz not null default now()
);
create index if not exists ce_posts_due on ce_posts (status, check_due_at);

create table if not exists ce_rt_slots (
  post_id    text not null references ce_posts (post_id),
  seq        int  not null,
  -- repost = one write; bump = un-repost then repost (two writes)
  action     text not null check (action in ('repost', 'bump')),
  due_at     timestamptz not null,
  -- pending | running | done | failed | skipped
  status     text not null default 'pending',
  writes     int  not null default 0,
  error      text,
  updated_at timestamptz not null default now(),
  primary key (post_id, seq)
);
create index if not exists ce_rt_slots_due on ce_rt_slots (status, due_at);

-- One row per X write attempt (repost / un-repost), logged just before the
-- call is made. The daily write cap counts these, so it errs on the safe side.
create table if not exists ce_writes (
  id      bigserial primary key,
  post_id text not null,
  seq     int  not null,
  kind    text not null check (kind in ('repost', 'unrepost')),
  at      timestamptz not null default now()
);
create index if not exists ce_writes_at on ce_writes (at);
