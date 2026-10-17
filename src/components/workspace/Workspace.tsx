"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase";
import {
  activeConflicts, claimLines, createRoom, getRoomSnapshot, heartbeat, joinRoom, listRooms,
  releaseClaim, revokeMember, rotateInvite, subscribeToRoom, type Room, type RoomSnapshot,
} from "@/lib/rooms";

function message(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error && error.code === "over_email_send_rate_limit") {
    return "Supabase email limit reached. Try again later, or configure custom SMTP in Supabase Auth settings.";
  }
  return error instanceof Error ? error.message : "Request failed. Check your connection and try again.";
}

function appRedirectUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  return `${configured || window.location.origin}/app`;
}

function subscribeToConnectivity(onChange: () => void) {
  window.addEventListener("online", onChange); window.addEventListener("offline", onChange);
  return () => { window.removeEventListener("online", onChange); window.removeEventListener("offline", onChange); };
}

export default function Workspace() {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    async function initialize() {
      try {
        const supabase = getSupabaseClient();
        if (!supabase) { if (active) setLoading(false); return; }
        const { data, error } = await supabase.auth.getSession();
        if (!active) return;
        setClient(supabase);
        if (error) setError(error.message);
        setUser(data.session?.user ?? null); setLoading(false);
        const subscription = supabase.auth.onAuthStateChange((_event, session) => {
          if (active) { setUser(session?.user ?? null); setLoading(false); }
        });
        unsubscribe = () => subscription.data.subscription.unsubscribe();
      } catch (error) { if (active) { setError(message(error)); setLoading(false); } }
    }
    void initialize();
    return () => { active = false; unsubscribe(); };
  }, []);

  return (
    <main className="workspace">
      <header>
        <Link href="/" className="wordmark">Overlap<span className="text-brass">.</span></Link>
        <div className="eyebrow">The shared signal desk · Est. 2026</div>
      </header>
      <div className="intro">
        <p className="eyebrow">One line, one agent</p>
        <h1>See every edit before it collides.</h1>
      <p className="muted">Create a room, invite your team, and connect each coding agent. Connected agents announce work automatically; manual claims remain as a fallback.</p>
      </div>
      {error && <p role="alert" className="notice error">{error}</p>}
      {loading ? <p role="status" className="notice">Opening your signal desk…</p> : !client ? (
        <section className="panel auth">
          <p className="eyebrow">Configuration needed</p><h2>Prepare your shared desk.</h2>
          <p>Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, then restart the app.</p>
          <p className="small muted">Apply the Supabase migration and configure email sign-in first. The project README covers local setup.</p>
        </section>
      ) : user ? <Rooms key={user.id} client={client} user={user} /> : <SignIn client={client} />}
      <footer className="small muted">Editing signals sync between teammates. Code changes travel through your Git workflow.</footer>
    </main>
  );
}

function SignIn({ client }: { client: SupabaseClient }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const { error } = sent
        ? await client.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" })
        : await client.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: appRedirectUrl() } });
      if (error) throw error;
      setSent(true);
    } catch (error) { setError(message(error)); }
    finally { setBusy(false); }
  }

  return <section className="panel auth">
    <p className="eyebrow">Welcome to the room</p><h2>Take your place.</h2>
    <p className="small muted">Email confirms your room identity. Your ChatGPT subscription connects separately on your own Mac.</p>
    <form onSubmit={submit}>
      <label htmlFor="email">Your email</label>
      <input id="email" type="email" autoComplete="email" required value={email} disabled={sent} onChange={(event) => setEmail(event.target.value)} />
      {sent && <><p role="status" className="notice success">Check your email. Follow the sign-in link, or enter the code if your email includes one.</p>
        <label htmlFor="code">Email code</label><input id="code" autoComplete="one-time-code" inputMode="numeric" required value={code} onChange={(event) => setCode(event.target.value)} /></>}
      {error && <p role="alert" className="notice error">{error}</p>}
      <button className="primary" disabled={busy}>{busy ? "Please wait…" : sent ? "Verify code" : "Email me a sign-in link"}</button>
      {sent && <button type="button" disabled={busy} onClick={() => { setSent(false); setCode(""); }}>Use another email / resend</button>}
    </form>
    <ol className="getting-started" aria-label="How Overlap works">
      <li><strong>1.</strong>Confirm your email</li>
      <li><strong>2.</strong>Open or join a room</li>
      <li><strong>3.</strong>Claim lines before editing</li>
    </ol>
  </section>;
}

function Rooms({ client, user }: { client: SupabaseClient; user: User }) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState("");
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState(user.email?.split("@")[0] ?? "Teammate");
  const [inviteInput, setInviteInput] = useState("");
  const [invite, setInvite] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void listRooms(client).then((data) => {
      if (!active) return;
      setRooms(data);
      const requested = new URL(window.location.href).searchParams.get("room");
      setRoomId(data.some((room) => room.id === requested) ? requested! : data[0]?.id ?? "");
    }).catch((error) => { if (active) setError(message(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client]);

  function openRoom(id: string) {
    setRoomId(id); setInvite("");
    const url = new URL(window.location.href); url.searchParams.set("room", id);
    window.history.replaceState(null, "", url);
  }

  async function enterRoom(event: FormEvent<HTMLFormElement>, create: boolean) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      let id: string;
      let token = "";
      if (create) {
        const result = await createRoom(client, name.trim(), displayName.trim());
        id = result.room_id; token = result.invite_token;
      } else id = await joinRoom(client, inviteInput.trim(), displayName.trim());
      setRooms(await listRooms(client)); openRoom(id); setInvite(token); setName(""); setInviteInput("");
    } catch (error) { setError(message(error)); }
    finally { setBusy(false); }
  }

  async function newInvite() {
    setBusy(true); setError("");
    try { setInvite(await rotateInvite(client, roomId)); }
    catch (error) { setError(message(error)); }
    finally { setBusy(false); }
  }

  return <>
    <div className="row small" style={{ justifyContent: "space-between", marginBottom: 20 }}>
      <span className="muted">Signed in as {user.email}</span>
      <button onClick={async () => { const { error } = await client.auth.signOut(); if (error) setError(error.message); }}>Sign out</button>
    </div>
    {error && <p role="alert" className="notice error">{error}</p>}
    <div className="desk">
      <aside>
        <section className="panel">
          <p className="eyebrow">Your rooms</p><h2>Choose a desk.</h2>
          {loading ? <p role="status" className="small">Loading rooms…</p> : rooms.length ? rooms.map((room) => <button key={room.id} className="room-link" aria-pressed={roomId === room.id} onClick={() => openRoom(room.id)}># {room.name}</button>) : <p className="small muted">Create a room, or join one with a private invite.</p>}
          <label htmlFor="display-name">Name teammates see</label><input id="display-name" value={displayName} maxLength={40} onChange={(event) => setDisplayName(event.target.value)} />
          <form onSubmit={(event) => void enterRoom(event, true)}>
            <label htmlFor="room-name">New room name</label><input id="room-name" placeholder="auth-sprint" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
            <button className="primary" disabled={busy || !displayName.trim()}>Create room</button>
          </form>
          <details><summary>Have an invite?</summary><form onSubmit={(event) => void enterRoom(event, false)}>
            <label htmlFor="invite-token">Private invite code</label><input id="invite-token" required value={inviteInput} onChange={(event) => setInviteInput(event.target.value)} autoComplete="off" />
            <button disabled={busy || !displayName.trim()}>Join room</button>
          </form></details>
        </section>
        <section className="panel">
          <p className="eyebrow">Bring your subscription</p><h2>Your own connection.</h2>
          <p className="small muted">ChatGPT sign-in happens locally. Run <code>npm run bridge</code> on your Mac, then open its connection desk.</p>
          <a className="button" href="http://127.0.0.1:4319" target="_blank" rel="noopener noreferrer">Connect ChatGPT on this Mac ↗</a>
          <p className="small muted" style={{ marginTop: 12 }}>Each teammate connects their own account. Room members never receive your OpenAI credentials.</p>
        </section>
      </aside>
      <div>
        {roomId ? <>
          {rooms.find((room) => room.id === roomId)?.owner_id === user.id && <section className="panel">
            <div className="row"><h3>Invite a teammate</h3><button disabled={busy} onClick={() => void newInvite()}>Generate new invite</button></div>
            <p className="small muted">Share privately. Generating an invite invalidates the previous code. Existing members keep access.</p>
            {invite && <><p className="invite">{invite}</p><button onClick={async () => { try { await navigator.clipboard.writeText(invite); } catch { setError("Copy unavailable. Select the invite code and copy it manually."); } }}>Copy invite code</button></>}
          </section>}
          <RoomDesk key={roomId} client={client} roomId={roomId} user={user} onMemberRemoved={() => setInvite("")} />
        </> : <section className="window"><div className="chrome"><WindowDots /> No room open</div><div className="window-body"><h2>Every good collaboration starts somewhere.</h2><p className="muted">Create your first room, then share its invite with a teammate.</p><p className="small muted">For example: create “auth-sprint” and claim the lines you plan to edit in <code>src/login.ts</code>.</p></div></section>}
      </div>
    </div>
  </>;
}

function WindowDots() {
  return <span className="dots" aria-hidden="true"><i /><i /><i /></span>;
}

function RoomDesk({ client, roomId, user, onMemberRemoved }: { client: SupabaseClient; roomId: string; user: User; onMemberRemoved: () => void }) {
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const online = useSyncExternalStore(subscribeToConnectivity, () => navigator.onLine, () => true);
  const [connection, setConnection] = useState("Connecting");
  const [now, setNow] = useState(0);
  const serverOffset = useRef(0);
  const reload = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    let active = true;
    let request = 0;
    const load = async () => {
      const version = ++request;
      try {
        const state = await getRoomSnapshot(client, roomId);
        if (active && version === request) {
          serverOffset.current = Date.parse(state.server_time) - Date.now();
          setSnapshot(state); setError(""); setNow(Date.now() + serverOffset.current);
        }
      } catch (error) { if (active && version === request) setError(message(error)); }
    };
    reload.current = load;
    const pulse = async () => {
      try { await heartbeat(client, roomId); if (active) await load(); }
      catch (error) { if (active) setError(message(error)); }
    };
    const onlineChanged = () => { if (navigator.onLine) void pulse(); };
    void pulse();
    const unsubscribe = subscribeToRoom(client, roomId, () => { void load(); }, (status) => {
      if (active) setConnection(status === "SUBSCRIBED" ? "Live" : "Reconnecting · polling");
    });
    const poll = window.setInterval(() => { if (navigator.onLine) void pulse(); }, 25000);
    const snapshots = window.setInterval(() => { if (navigator.onLine) void load(); }, 12000);
    const clock = window.setInterval(() => setNow(Date.now() + serverOffset.current), 5000);
    window.addEventListener("online", onlineChanged);
    return () => { active = false; reload.current = async () => {}; unsubscribe(); window.clearInterval(poll); window.clearInterval(snapshots); window.clearInterval(clock); window.removeEventListener("online", onlineChanged); };
  }, [client, roomId]);

  async function claim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice(""); setError("");
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      const result = await claimLines(client, { roomId, filePath: String(values.get("file")), startLine: Number(values.get("start")), endLine: Number(values.get("end")), branch: String(values.get("branch")), targetKey: String(values.get("target")), agent: String(values.get("agent")) });
      setNotice(result.conflicts.length ? `Overlap warning: ${result.conflicts.length} existing claim(s) touch these lines. Coordinate with your teammate before editing.` : "Lines claimed. Your teammates can now see your editing signal.");
      await reload.current();
    } catch (error) { setError(message(error)); }
    finally { setBusy(false); }
  }

  async function release(id: string) {
    setBusy(true); setError(""); setNotice("");
    try { await releaseClaim(client, id); await reload.current(); }
    catch (error) { setError(message(error)); }
    finally { setBusy(false); }
  }

  async function removeMember(userId: string, displayName: string) {
    if (!window.confirm(`Remove ${displayName} from this room? This also invalidates the current invite code.`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await revokeMember(client, roomId, userId);
      onMemberRemoved();
      setNotice("Member removed. The previous invite is invalid. Generate a new invite to add someone else.");
      await reload.current();
    } catch (error) { setError(message(error)); }
    finally { setBusy(false); }
  }

  const claims = snapshot?.claims.filter((claim) => Date.parse(claim.expires_at) > now) ?? [];
  const collisions = claims.filter((claim) => activeConflicts(claim, claims, now).length > 0);
  const onlineMembers = snapshot?.members.filter((member) => now - Date.parse(member.last_seen) < 90000) ?? [];
  return <section className="window">
    <div className="chrome"><WindowDots /><span>Room #{snapshot?.room.name ?? "…"}</span><span role="status" className={`status ${online && !error && connection === "Live" ? "live" : "warning"}`}>{!online ? "Offline" : error ? "Sync failed" : connection}</span></div>
    <div className="window-body">
      <p className="eyebrow">Live editing signals</p><h2>A clear view of the lines.</h2>
      {!online && <p role="alert" className="notice error">You are offline. Signals may be outdated. Claims expire unless your Mac reconnects.</p>}
      {error && <p role="alert" className="notice error">{error} <button onClick={() => void reload.current()}>Retry</button></p>}
      {!snapshot ? <p role="status">Loading room…</p> : <>
        <ul className="members" aria-label="Connected teammates">{onlineMembers.map((member) => <li key={member.user_id}>● {member.display_name}{member.user_id === user.id ? " (you)" : ""}</li>)}</ul>
        {collisions.length > 0 && <p role="alert" className="notice error">Overlap detected. {collisions.length} claims share lines with another teammate. Coordinate before editing.</p>}
        <h3>{claims.length} active agent {claims.length === 1 ? "signal" : "signals"}</h3>
        {claims.length ? claims.map((claim) => <article className="claim" key={claim.id}>
          <div><code>{claim.file_path}:{claim.start_line}–{claim.end_line}</code><p className="small muted">{claim.display_name} · {claim.agent} · {claim.branch}{claim.target_key ? ` · ${claim.target_key}` : ""}{activeConflicts(claim, claims, now).length > 0 ? " · ⚠ Overlap" : ""}</p></div>
          {claim.user_id === user.id && <button disabled={busy || !online} onClick={() => void release(claim.id)}>Release</button>}
        </article>) : <p className="empty">No active agent signals. Connect an agent, or add a manual fallback signal.</p>}
        <details><summary>Manual claim fallback</summary>
          <form onSubmit={(event) => void claim(event)}>
            <label htmlFor="claim-file">Repository-relative file path</label><input id="claim-file" name="file" required placeholder="src/login.ts" maxLength={500} />
            <label htmlFor="claim-target">Logical target</label><input id="claim-target" name="target" placeholder="function validateLogin" maxLength={300} />
            <div className="fields"><div><label htmlFor="claim-start">First line</label><input id="claim-start" name="start" type="number" min={1} max={10000000} defaultValue={1} required /></div><div><label htmlFor="claim-end">Last line</label><input id="claim-end" name="end" type="number" min={1} max={10000000} defaultValue={50} required /></div></div>
            <div className="fields"><div><label htmlFor="claim-branch">Branch</label><input id="claim-branch" name="branch" required defaultValue="main" maxLength={120} /></div><div><label htmlFor="claim-agent">Agent</label><select id="claim-agent" name="agent"><option>Codex</option><option>Claude Code</option><option>Cursor</option><option>Manual</option></select></div></div>
            <button className="primary" disabled={busy || !online}>{busy ? "Updating…" : "Add manual signal"}</button>
          </form>
        </details>
        {notice && <p role="status" className="notice">{notice}</p>}
        <p className="small muted" style={{ marginTop: 18 }}>Supported agent tools announce before writing. File watchers announce after a save. Signals are advisory and expire if their bridge disconnects.</p>
        {snapshot.room.owner_id === user.id && snapshot.members.some((member) => member.user_id !== user.id) && <details>
          <summary>Manage room members</summary>
          {snapshot.members.filter((member) => member.user_id !== user.id).map((member) => <div className="claim" key={member.user_id}>
            <p className="small">{member.display_name} · {onlineMembers.some((online) => online.user_id === member.user_id) ? "Connected" : "Away"}</p>
            <button disabled={busy || !online} onClick={() => void removeMember(member.user_id, member.display_name)}>Remove {member.display_name}</button>
          </div>)}
        </details>}
      </>}
    </div>
  </section>;
}
