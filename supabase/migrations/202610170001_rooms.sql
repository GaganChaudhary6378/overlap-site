-- Run once in a Supabase project. Only authenticated RPCs may change room state.
create extension if not exists pgcrypto with schema extensions;

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  owner_id uuid not null references auth.users(id) on delete cascade,
  invite_hash text not null unique,
  created_at timestamptz not null default now()
);
create table public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  last_seen timestamptz not null default now(),
  primary key (room_id, user_id)
);
create table public.room_claims (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null,
  user_id uuid not null,
  device_id uuid not null default '00000000-0000-0000-0000-000000000000',
  file_path text not null check (char_length(file_path) between 1 and 500),
  start_line integer not null check (start_line >= 1),
  end_line integer not null check (end_line >= start_line and end_line <= 10000000),
  branch text not null check (char_length(branch) between 1 and 120),
  agent text not null check (char_length(agent) between 1 and 40),
  expires_at timestamptz not null default (now() + interval '90 seconds'),
  foreign key (room_id, user_id) references public.room_members(room_id, user_id) on delete cascade,
  unique (room_id, user_id, device_id, file_path)
);
create index room_claims_active on public.room_claims(room_id, expires_at);

create function public.is_room_member(p_room_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.room_members where room_id = p_room_id and user_id = auth.uid());
$$;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_claims enable row level security;
create policy room_read on public.rooms for select to authenticated using (public.is_room_member(id));
create policy member_read on public.room_members for select to authenticated using (public.is_room_member(room_id));
create policy claim_read on public.room_claims for select to authenticated using (public.is_room_member(room_id));
revoke all on public.rooms, public.room_members, public.room_claims from anon, authenticated;
grant select on public.rooms, public.room_members, public.room_claims to authenticated;

create function public.create_room(p_name text, p_display_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_invite text;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  v_invite := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.rooms(name, owner_id, invite_hash)
    values(trim(p_name), auth.uid(), encode(extensions.digest(v_invite, 'sha256'), 'hex')) returning id into v_id;
  insert into public.room_members(room_id,user_id,display_name) values(v_id,auth.uid(),trim(p_display_name));
  return jsonb_build_object('room_id',v_id,'invite_token',v_invite);
end;
$$;
create function public.join_room(p_invite_token text, p_display_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if p_invite_token is null or p_invite_token !~ '^[a-f0-9]{64}$' then raise exception 'Invalid invite'; end if;
  select id into v_id from public.rooms where invite_hash = encode(extensions.digest(p_invite_token,'sha256'),'hex') for update;
  if v_id is null then raise exception 'Invite is invalid or has been replaced'; end if;
  insert into public.room_members(room_id,user_id,display_name) values(v_id,auth.uid(),trim(p_display_name))
    on conflict(room_id,user_id) do update set display_name=excluded.display_name,last_seen=now();
  return v_id;
end;
$$;
create function public.rotate_invite(p_room_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_invite text;
begin
  v_invite := encode(extensions.gen_random_bytes(32),'hex');
  update public.rooms set invite_hash=encode(extensions.digest(v_invite,'sha256'),'hex') where id=p_room_id and owner_id=auth.uid();
  if not found then raise exception 'Only the owner can replace an invite'; end if;
  return v_invite;
end;
$$;
create function public.room_snapshot(p_room_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_room_member(p_room_id) then raise exception 'Room access denied'; end if;
  return jsonb_build_object(
    'room',(select jsonb_build_object('id',id,'name',name,'owner_id',owner_id) from public.rooms where id=p_room_id),
    'members',coalesce((select jsonb_agg(to_jsonb(m) order by m.display_name) from public.room_members m where room_id=p_room_id),'[]'::jsonb),
    'claims',coalesce((select jsonb_agg(to_jsonb(c) || jsonb_build_object('display_name',m.display_name) order by c.file_path)
      from public.room_claims c join public.room_members m using(room_id,user_id)
      where c.room_id=p_room_id and c.expires_at>now()),'[]'::jsonb),
    'server_time',now());
end;
$$;
create function public.claim_lines(p_room_id uuid,p_file_path text,p_start_line integer,p_end_line integer,p_branch text,p_agent text,p_device_id uuid default '00000000-0000-0000-0000-000000000000') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_conflicts jsonb;
begin
  -- One room lock makes simultaneous claims observe a consistent conflict set.
  perform 1 from public.rooms where id=p_room_id for update;
  if not public.is_room_member(p_room_id) then raise exception 'Room access denied'; end if;
  if p_file_path is null or p_file_path ~ '(^/|//|/$|\\|(^|/)\.\.?(/|$)|[[:cntrl:]])' then raise exception 'Use a relative file path without dot segments'; end if;
  if p_start_line is null or p_end_line is null or p_start_line<1 or p_end_line<p_start_line or p_end_line>10000000 then raise exception 'Invalid line range'; end if;
  delete from public.room_claims where room_id=p_room_id and expires_at<=now();
  insert into public.room_claims(room_id,user_id,device_id,file_path,start_line,end_line,branch,agent)
    values(p_room_id,auth.uid(),p_device_id,p_file_path,p_start_line,p_end_line,trim(p_branch),trim(p_agent))
    on conflict(room_id,user_id,device_id,file_path) do update set start_line=excluded.start_line,end_line=excluded.end_line,
      branch=excluded.branch,agent=excluded.agent,expires_at=now()+interval '90 seconds' returning id into v_id;
  update public.room_members set last_seen=now() where room_id=p_room_id and user_id=auth.uid();
  select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('display_name',m.display_name)),'[]'::jsonb) into v_conflicts
    from public.room_claims c join public.room_members m using(room_id,user_id)
    where c.room_id=p_room_id and c.user_id<>auth.uid() and c.file_path=p_file_path
      and c.start_line<=p_end_line and c.end_line>=p_start_line and c.expires_at>now();
  return jsonb_build_object('claim_id',v_id,'conflicts',v_conflicts);
end;
$$;
create function public.heartbeat(p_room_id uuid,p_device_id uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_room_member(p_room_id) then raise exception 'Room access denied'; end if;
  update public.room_members set last_seen=now() where room_id=p_room_id and user_id=auth.uid();
  -- No device means presence only. Expired claims must be explicitly reclaimed.
  update public.room_claims set expires_at=now()+interval '90 seconds' where room_id=p_room_id and user_id=auth.uid() and device_id=p_device_id and expires_at>now();
end;
$$;
create function public.release_claim(p_claim_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.room_claims where id=p_claim_id and user_id=auth.uid();
end;
$$;
create function public.revoke_member(p_room_id uuid,p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.rooms where id=p_room_id and owner_id=auth.uid() for update;
  if not found then raise exception 'Only the owner can remove members'; end if;
  if p_user_id=auth.uid() then raise exception 'Owner cannot remove themselves'; end if;
  -- Replace the invite too, so the removed member cannot use the old token to rejoin.
  update public.rooms set invite_hash=encode(extensions.digest(encode(extensions.gen_random_bytes(32),'hex'),'sha256'),'hex') where id=p_room_id;
  delete from public.room_members where room_id=p_room_id and user_id=p_user_id;
end;
$$;

-- Functions are public-executable by default in PostgreSQL; explicitly restrict each RPC.
revoke all on function public.is_room_member(uuid), public.create_room(text,text), public.join_room(text,text),
  public.rotate_invite(uuid), public.room_snapshot(uuid), public.claim_lines(uuid,text,integer,integer,text,text,uuid),
  public.heartbeat(uuid,uuid), public.release_claim(uuid), public.revoke_member(uuid,uuid) from public, anon;
grant execute on function public.is_room_member(uuid), public.create_room(text,text), public.join_room(text,text),
  public.rotate_invite(uuid), public.room_snapshot(uuid), public.claim_lines(uuid,text,integer,integer,text,text,uuid),
  public.heartbeat(uuid,uuid), public.release_claim(uuid), public.revoke_member(uuid,uuid) to authenticated;

alter publication supabase_realtime add table public.room_members, public.room_claims;
