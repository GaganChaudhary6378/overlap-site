-- Hosted verification; all synthetic users/rooms roll back. No Auth email is sent.
begin;
insert into auth.users(id) values
 ('00000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-000000000002'),
 ('00000000-0000-0000-0000-000000000003');

set local role authenticated;
do $$
declare
  v_created jsonb; v_room uuid; v_invite text; v_claim jsonb; v_snapshot jsonb; v_token text; v_count integer; v_path text;
begin
  if has_function_privilege('anon','public.create_room(text,text)','execute') then raise exception 'Anonymous can create rooms'; end if;
  begin
    perform public.create_room('No auth','Nobody');
    raise exception 'Expected unauthenticated rejection';
  exception when others then
    if sqlerrm <> 'Sign in first' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
  v_created:=public.create_room('Pair room','Alice');
  v_room:=(v_created->>'room_id')::uuid; v_invite:=v_created->>'invite_token';
  if length(v_invite)<>64 then raise exception 'Invite entropy incorrect'; end if;
  perform public.claim_lines(v_room,'src/login.ts',40,80,'main','Codex');
  foreach v_path in array array['../secret','src//login.ts','src/login.ts/'] loop
    begin
      perform public.claim_lines(v_room,v_path,1,2,'main','Codex');
      raise exception 'Expected path rejection';
    exception when others then
      if sqlerrm <> 'Use a relative file path without dot segments' then raise; end if;
    end;
  end loop;
  begin
    insert into public.room_members values(v_room,'00000000-0000-0000-0000-000000000003','Mallory',now());
    raise exception 'Expected direct write rejection';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
  select count(*) into v_count from public.rooms;
  if v_count<>0 then raise exception 'RLS exposed a room'; end if;
  select count(*) into v_count from public.room_claims;
  if v_count<>0 then raise exception 'RLS exposed claims'; end if;
  begin
    perform public.room_snapshot(v_room);
    raise exception 'Expected snapshot access rejection';
  exception when others then
    if sqlerrm <> 'Room access denied' then raise; end if;
  end;
  begin
    perform public.claim_lines(v_room,'src/login.ts',50,60,'main','Codex');
    raise exception 'Expected claim access rejection';
  exception when others then
    if sqlerrm <> 'Room access denied' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
  perform public.join_room(v_invite,'Bob');
  v_claim:=public.claim_lines(v_room,'src/login.ts',60,90,'feature','Codex');
  if jsonb_array_length(v_claim->'conflicts')<>1 then raise exception 'Overlap was not detected across branches'; end if;
  v_snapshot:=public.room_snapshot(v_room);
  if jsonb_array_length(v_snapshot->'members')<>2 or jsonb_array_length(v_snapshot->'claims')<>2 then raise exception 'Two-user snapshot incorrect'; end if;
  perform public.release_claim((v_claim->'conflicts'->0->>'id')::uuid);
  if jsonb_array_length(public.room_snapshot(v_room)->'claims')<>2 then raise exception 'Bob deleted Alice claim'; end if;
  perform public.release_claim((v_claim->>'claim_id')::uuid);
  if jsonb_array_length(public.room_snapshot(v_room)->'claims')<>1 then raise exception 'Release failed'; end if;
  begin
    perform public.rotate_invite(v_room);
    raise exception 'Expected owner-only rejection';
  exception when others then
    if sqlerrm <> 'Only the owner can replace an invite' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
  v_token:=public.rotate_invite(v_room);
  begin
    perform public.join_room(v_invite,'Old token');
    raise exception 'Expected old invite rejection';
  exception when others then
    if sqlerrm <> 'Invite is invalid or has been replaced' then raise; end if;
  end;
  perform public.revoke_member(v_room,'00000000-0000-0000-0000-000000000002');
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
  begin
    perform public.heartbeat(v_room);
    raise exception 'Expected revoked user rejection';
  exception when others then
    if sqlerrm <> 'Room access denied' then raise; end if;
  end;
  begin
    perform public.join_room(v_token,'Bob');
    raise exception 'Expected revoked invite rejection';
  exception when others then
    if sqlerrm <> 'Invite is invalid or has been replaced' then raise; end if;
  end;
  raise notice 'PASS: authenticated creation, RLS isolation, membership, invalid paths, overlap, release ownership, invite rotation, revocation';
end;
$$;
reset role;
-- Simulate expiry under the database owner; authenticated clients cannot alter timestamps.
update public.room_claims set expires_at=now()-interval '1 second';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
do $$
declare v_room uuid;
begin
  select id into v_room from public.rooms;
  perform public.heartbeat(v_room);
  if jsonb_array_length(public.room_snapshot(v_room)->'claims')<>0 then raise exception 'Heartbeat resurrected expired claims'; end if;
  raise notice 'PASS: lease expiry and heartbeat do not resurrect claims';
end;
$$;
-- The same account may edit on two devices. Presence-only watchers renew neither.
do $$
declare v_room uuid; v_created jsonb; v_conflict jsonb;
begin
  v_created := public.create_room('Device room','Alice');
  v_room := (v_created->>'room_id')::uuid;
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
  perform public.join_room(v_created->>'invite_token','Bob');
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
  perform public.claim_lines(v_room,'src/login.ts',1,10,'main','Codex','10000000-0000-0000-0000-000000000001');
  perform public.claim_lines(v_room,'src/login.ts',20,30,'main','Codex','10000000-0000-0000-0000-000000000002');
  if jsonb_array_length(public.room_snapshot(v_room)->'claims')<>2 then raise exception 'Device claims overwrote each other'; end if;
end;
$$;
reset role;
update public.room_claims set expires_at=now()+interval '30 seconds'
  where device_id in ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002');
set local role authenticated;
do $$
declare v_room uuid; v_a timestamptz; v_b timestamptz;
begin
  select id into v_room from public.rooms where name='Device room';
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
  perform public.heartbeat(v_room,'10000000-0000-0000-0000-000000000001');
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
  perform public.heartbeat(v_room);
  select expires_at into v_a from public.room_claims where room_id=v_room and device_id='10000000-0000-0000-0000-000000000001';
  select expires_at into v_b from public.room_claims where room_id=v_room and device_id='10000000-0000-0000-0000-000000000002';
  if v_a<>now()+interval '30 seconds' or v_b<>now()+interval '30 seconds' then raise exception 'Presence watcher renewed device claims'; end if;
  perform public.heartbeat(v_room,'10000000-0000-0000-0000-000000000002');
  select expires_at into v_a from public.room_claims where room_id=v_room and device_id='10000000-0000-0000-0000-000000000001';
  select expires_at into v_b from public.room_claims where room_id=v_room and device_id='10000000-0000-0000-0000-000000000002';
  if v_a<>now()+interval '30 seconds' or v_b<>now()+interval '90 seconds' then raise exception 'Device heartbeat renewed the wrong device'; end if;
end;
$$;
reset role;
update public.room_claims set expires_at=now()-interval '1 second' where device_id='10000000-0000-0000-0000-000000000001';
set local role authenticated;
do $$
declare v_room uuid; v_a timestamptz;
begin
  select id into v_room from public.rooms where name='Device room';
  perform public.heartbeat(v_room,'10000000-0000-0000-0000-000000000002');
  perform public.heartbeat(v_room,'10000000-0000-0000-0000-000000000001');
  select expires_at into v_a from public.room_claims where room_id=v_room and device_id='10000000-0000-0000-0000-000000000001';
  if v_a>now() or jsonb_array_length(public.room_snapshot(v_room)->'claims')<>1 then raise exception 'Another device kept an expired lease active'; end if;
  raise notice 'PASS: same-user device leases coexist; presence-only and other-device heartbeats cannot renew or resurrect them';
end;
$$;
-- Two workers on one device keep independent claims and renew only their own lease.
reset role;
set local role authenticated;
do $$
declare v_room uuid; v_created jsonb; v_conflict jsonb;
begin
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
  v_created:=public.create_room('Worker room','Alice'); v_room:=(v_created->>'room_id')::uuid;
  perform public.claim_lines(v_room,'src/login.ts',1,10,'main','Codex','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','function login');
  perform public.claim_lines(v_room,'src/login.ts',20,30,'main','Codex','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','function logout');
  if jsonb_array_length(public.room_snapshot(v_room)->'claims')<>2 then raise exception 'Worker claims overwrote each other'; end if;
  v_conflict:=public.claim_lines(v_room,'src/login.ts',50,60,'main','Codex','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003','function login');
  if jsonb_array_length(v_conflict->'conflicts')<>1 then raise exception 'Logical target did not conflict after line shift'; end if;
end;
$$;
reset role;
update public.room_claims set expires_at=now()+interval '30 seconds' where room_id=(select id from public.rooms where name='Worker room');
set local role authenticated;
do $$
declare v_room uuid; v_first timestamptz; v_second timestamptz;
begin
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
  select id into v_room from public.rooms where name='Worker room';
  perform public.heartbeat(v_room,'20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001');
  select expires_at into v_first from public.room_claims where room_id=v_room and worker_id='30000000-0000-0000-0000-000000000001';
  select expires_at into v_second from public.room_claims where room_id=v_room and worker_id='30000000-0000-0000-0000-000000000002';
  if v_first<=now()+interval '89 seconds' or v_second<>now()+interval '30 seconds' then raise exception 'Worker heartbeat renewed the wrong lease'; end if;
  raise notice 'PASS: same-device workers keep independent leases';
end;
$$;
rollback;
