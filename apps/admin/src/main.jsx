import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { Users, UserCheck, ShieldAlert, Clock, RefreshCw, Database, Activity, ShieldCheck, LogOut, Search, Check, X, Video, Camera, LockKeyhole, KeyRound, Building2 } from 'lucide-react';
import './style.css';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;

function Brand() {
  return <div className="brand"><b className="logo">M</b><span><strong>MeetConnect</strong><small>ADMIN CONSOLE</small></span></div>;
}
function Metric({ icon, label, value }) {
  return <article className="metric">{icon}<small>{label}</small><strong>{value ?? '—'}</strong></article>;
}
function App() {
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [roomProviders, setRoomProviders] = useState([]);
  const [roomListings, setRoomListings] = useState([]);
  const [roomBookings, setRoomBookings] = useState([]);
  const [roomFilter, setRoomFilter] = useState('pending');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');
  const [username] = useState('CEO');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordConfigured, setPasswordConfigured] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [setupBusy, setSetupBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('pending');
  const [workingId, setWorkingId] = useState('');

  const loadStats = useCallback(async () => {
    if (!url || !key) return;
    try {
      const response = await fetch(url.replace(/\/$/, '') + '/functions/v1/meetconnect-admin-public-stats', {
        headers: { apikey: key, Authorization: 'Bearer ' + key }
      });
      const data = await response.json();
      if (response.ok && data.source === 'live_supabase_database') setStats(data);
    } catch (e) { console.warn('Could not refresh public admin totals:', e); }
  }, []);

  const loadEmployees = useCallback(async () => {
    if (!supabase || !session) return;
    setBusy(true);
    setError('');
    try {
      const { data: rows, error: rowError } = await supabase.from('employee_profiles')
        .select('id,bio,service_area,short_price_etb,long_price_etb,avatar_url,video_url,status,created_at,reviewed_at,review_note')
        .order('created_at', { ascending: false });
      if (rowError) throw rowError;
      const ids = (rows || []).map(row => row.id);
      let profiles = [];
      if (ids.length) {
        const { data, error: profileError } = await supabase.from('profiles')
          .select('id,display_name,gender,birth_date,area,is_adult,role')
          .in('id', ids);
        if (profileError) throw profileError;
        profiles = data || [];
      }
      const byId = new Map(profiles.map(profile => [profile.id, profile]));
      setEmployees((rows || []).map(row => ({ ...row, profile: byId.get(row.id) || null })));
      setUpdatedAt(new Date().toISOString());
    } catch (e) {
      setError('Could not load employee applications: ' + (e?.message || 'Unknown database error.'));
    } finally { setBusy(false); }
  }, [session]);

  const loadRoomData = useCallback(async () => {
    if (!supabase || !session) return;
    const [{data:providers,error:providerError},{data:listings,error:listingError},{data:bookings,error:bookingError}] = await Promise.all([
      supabase.from('room_service_profiles').select('*').order('created_at',{ascending:false}),
      supabase.rpc('get_admin_room_listings'),
      supabase.from('room_bookings').select('*').order('created_at',{ascending:false})
    ]);
    if (providerError) setError('Could not load Room Service providers: '+providerError.message);
    if (listingError) setError('Could not load room listings: '+listingError.message);
    if (bookingError) setError('Could not load room reservations: '+bookingError.message);
    setRoomProviders(providers||[]);
    setRoomListings(listings||[]);
    setRoomBookings(bookings||[]);
  }, [session]);

  const verifyAdminSession = useCallback(async current => {
    if (!current || !supabase) { setSession(null); setIsAdmin(false); return; }
    const { data, error: checkError } = await supabase.rpc('is_meetconnect_admin');
    if (checkError || data !== true) {
      await supabase.auth.signOut();
      setSession(null); setIsAdmin(false);
      setError('This account is not authorized to access MeetConnect administration.');
      return;
    }
    setSession(current);
    setIsAdmin(true);
  }, []);

  useEffect(() => {
    if (!supabase) { setBusy(false); setError('Admin environment is missing the Supabase URL or public key.'); return; }
    let alive = true;
    Promise.all([
      supabase.auth.getSession(),
      supabase.functions.invoke('meetconnect-admin-password-auth', { body: { action: 'status' } })
    ]).then(async ([sessionResult, statusResult]) => {
      if (!alive) return;
      if (statusResult.data && !statusResult.error) setPasswordConfigured(statusResult.data.configured === true);
      const current = sessionResult.data?.session;
      if (current) await verifyAdminSession(current);
      if (alive) setBusy(false);
    }).catch(() => { if (alive) setBusy(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (next) setSession(next);
      else { setSession(null); setIsAdmin(false); setEmployees([]); }
    });
    loadStats();
    return () => { alive = false; subscription.unsubscribe(); };
  }, [verifyAdminSession, loadStats]);

  useEffect(() => { if (isAdmin && session) { loadEmployees(); loadRoomData(); loadStats(); } }, [isAdmin, session, loadEmployees, loadRoomData, loadStats]);

  const counts = useMemo(() => ({
    pending: employees.filter(x => x.status === 'pending').length,
    approved: employees.filter(x => x.status === 'approved').length,
    rejected: employees.filter(x => x.status === 'rejected').length,
    suspended: employees.filter(x => x.status === 'suspended').length
  }), [employees]);
  const visibleEmployees = useMemo(() => employees.filter(x => {
    const matchStatus = filter === 'all' || x.status === filter;
    const haystack = [x.profile?.display_name, x.profile?.area, x.service_area, x.profile?.gender, x.id].join(' ').toLowerCase();
    return matchStatus && haystack.includes(query.toLowerCase());
  }), [employees, filter, query]);

  async function login(e) {
    e?.preventDefault();
    if (!supabase) return;
    if (!password) { setError('Enter your CEO password.'); return; }
    setAuthBusy(true); setError(''); setNotice('');
    try {
      const { data, error: fnError } = await supabase.functions.invoke('meetconnect-admin-password-auth', {
        body: { action: 'login', username, password }
      });
      if (fnError || data?.error) throw new Error(data?.error || fnError?.message || 'Sign-in failed.');
      if (!data?.session?.access_token || !data?.session?.refresh_token) throw new Error('Admin authentication returned no session.');
      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token, refresh_token: data.session.refresh_token
      });
      if (sessionError || !sessionData?.session) throw sessionError || new Error('Could not establish admin session.');
      await verifyAdminSession(sessionData.session);
      setPassword('');
    } catch (e) { setError(e?.message || 'Sign-in failed.'); }
    finally { setAuthBusy(false); }
  }

  async function createAdminPassword(e) {
    e?.preventDefault();
    if (!supabase) return;
    if (password.length < 12) { setError('Use at least 12 characters for the CEO password.'); return; }
    if (password !== confirmPassword) { setError('The passwords do not match.'); return; }
    if (!session?.access_token) {
      setError('For first-time setup, an existing authorized CEO session is required. This prevents anyone else from claiming the CEO account.');
      return;
    }
    setSetupBusy(true); setError(''); setNotice('');
    try {
      const { data, error: fnError } = await supabase.functions.invoke('meetconnect-admin-password-auth', {
        body: { action: 'setup', username, password }
      });
      if (fnError || data?.error) throw new Error(data?.error || fnError?.message || 'Could not save the CEO password.');
      setPasswordConfigured(true);
      setPassword(''); setConfirmPassword('');
      setNotice('CEO password created. You can now sign out and log in using CEO + password only.');
    } catch (e) { setError(e?.message || 'Could not create the CEO password.'); }
    finally { setSetupBusy(false); }
  }

  async function reviewEmployee(employee, nextStatus) {
    if (!supabase || !session) return;
    let note = '';
    if (nextStatus === 'rejected' || nextStatus === 'suspended') {
      note = window.prompt(nextStatus === 'rejected' ? 'Reason for rejecting this application:' : 'Reason for suspending this employee:') || '';
      if (!note.trim()) { setNotice('A reason is required for this decision. No change was made.'); return; }
    } else if (!window.confirm('Approve this employee? Their profile will become visible to eligible customers.')) return;
    setWorkingId(employee.id); setError(''); setNotice('');
    const { data, error: updateError } = await supabase.from('employee_profiles').update({
      status: nextStatus, reviewed_at: new Date().toISOString(), reviewed_by: session.user.id, review_note: note.trim()
    }).eq('id', employee.id).select('id,status').maybeSingle();
    setWorkingId('');
    if (updateError || !data) {
      setError('The review was not saved: ' + (updateError?.message || 'No row was updated. Check administrator permissions.'));
      return;
    }
    setNotice('Employee status updated to ' + nextStatus + '. Customer discovery will reflect the new status.');
    await Promise.all([loadEmployees(), loadStats()]);
  }

  async function reviewRoomProvider(provider, nextStatus) {
    if (!supabase || !session) return;
    let note = '';
    if (nextStatus === 'rejected' || nextStatus === 'suspended') {
      note = window.prompt('Reason for '+nextStatus+' this room provider:') || '';
      if (!note.trim()) { setNotice('A reason is required. No change was made.'); return; }
    } else if (!window.confirm('Approve this room-service provider?')) return;
    setWorkingId(provider.owner_id); setError(''); setNotice('');
    const {data,error:reviewError} = await supabase.from('room_service_profiles').update({
      status:nextStatus,reviewed_at:new Date().toISOString(),reviewed_by:session.user.id,review_note:note.trim()
    }).eq('owner_id',provider.owner_id).select('owner_id,status').maybeSingle();
    setWorkingId('');
    if (reviewError || !data) { setError('Provider review was not saved: '+(reviewError?.message||'No row updated.')); return; }
    setNotice('Room Service provider '+nextStatus+'.');
    await loadRoomData();
  }

  async function reviewRoomListing(listing, nextStatus) {
    if (!supabase || !session) return;
    let note = '';
    if (nextStatus === 'rejected' || nextStatus === 'suspended') {
      note = window.prompt('Reason for '+nextStatus+' this room listing:') || '';
      if (!note.trim()) { setNotice('A reason is required. No change was made.'); return; }
    } else if (!window.confirm('Approve this room listing for customer discovery?')) return;
    setWorkingId(listing.id); setError(''); setNotice('');
    const {data,error:reviewError} = await supabase.from('room_listings').update({
      status:nextStatus,reviewed_at:new Date().toISOString(),reviewed_by:session.user.id,review_note:note.trim()
    }).eq('id',listing.id).select('id,status').maybeSingle();
    setWorkingId('');
    if (reviewError || !data) { setError('Room listing review was not saved: '+(reviewError?.message||'No row updated.')); return; }
    setNotice('Room listing '+nextStatus+'.');
    await loadRoomData();
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setSession(null); setIsAdmin(false); setEmployees([]); setPassword(''); setConfirmPassword('');
    setNotice('You have signed out of the admin console.');
  }

  return <div className="layout">
    <aside>
      <Brand />
      <small className="section">WORKSPACE</small>
      <div className="nav selected"><Activity size={17}/>Live Overview</div>
      <div className="nav"><UserCheck size={17}/>Employee Approval</div>
      <div className="asidebottom"><ShieldCheck/><span><b>{isAdmin ? 'Administrator session' : 'Protected controls'}</b><small>{isAdmin ? 'CEO password verified' : 'Review actions require CEO sign-in'}</small></span></div>
    </aside>
    <main className="content">
      <header>
        <div><small className="eyebrow">PLATFORM MANAGEMENT</small><h1>MeetConnect dashboard</h1><p>Live totals and employee applications from the connected Supabase database.</p></div>
        {isAdmin ? <button className="refresh" onClick={signOut} aria-label="Sign out"><LogOut size={17}/></button> : <button className="refresh" onClick={() => { loadStats(); if (isAdmin) loadEmployees(); }} aria-label="Refresh live data"><RefreshCw size={17}/></button>}
      </header>
      {error && <div className="alert">{error}</div>}
      {notice && <div className="notice">{notice}</div>}
      <div className="metrics">
        <Metric icon={<Users/>} label="Registered profiles" value={stats?.profiles}/>
        <Metric icon={<Clock/>} label="Pending employees" value={stats?.pendingEmployees}/>
        <Metric icon={<UserCheck/>} label="Approved employees" value={stats?.approvedEmployees}/>
        <Metric icon={<ShieldAlert/>} label="Open safety reports" value={stats?.openReports}/>
      </div>
      <section className="panel">
        <div className="panelhead">
          <div><h2><Database size={17} style={{verticalAlign:'middle',marginRight:8}}/>Live database status</h2><p>{stats ? 'Counts are read from the real Supabase database.' : 'Waiting for a successful database response.'}</p></div>
          <span className={'badge ' + (stats ? 'approved' : 'pending')}>{stats ? 'Connected' : busy ? 'Loading' : 'Not connected'}</span>
        </div>
        <div style={{padding:'18px 19px',display:'flex',gap:20,flexWrap:'wrap'}}>
          <div><small>Employee records</small><strong style={{display:'block',fontSize:23,marginTop:6}}>{stats?.employees ?? '—'}</strong></div>
          <div><small>Safety reports</small><strong style={{display:'block',fontSize:23,marginTop:6}}>{stats?.reports ?? '—'}</strong></div>
          <div><small>Last refreshed</small><strong style={{display:'block',fontSize:12,marginTop:11}}>{updatedAt ? new Date(updatedAt).toLocaleString() : '—'}</strong></div>
        </div>
      </section>

      {!passwordConfigured ? <section className="panel auth-card">
        <div className="panelhead"><div><h2><LockKeyhole size={17} style={{verticalAlign:'middle',marginRight:8}}/>Create CEO password</h2><p>One-time setup for the MeetConnect CEO administrator account.</p></div><span className="badge pending">First-time setup</span></div>
        <div style={{padding:20}}>
          <form onSubmit={createAdminPassword}>
            <label>CEO username<input value="CEO" readOnly autoComplete="username"/></label>
            <label>Create password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" minLength={12} maxLength={128} required placeholder="At least 12 characters"/></label>
            <label>Confirm password<input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} autoComplete="new-password" minLength={12} maxLength={128} required placeholder="Enter the same password again"/></label>
            <button className="primary" disabled={setupBusy}>{setupBusy ? 'Saving password…' : 'Create CEO password'}</button>
          </form>
          <div className="security-note" style={{marginTop:13}}>This one-time setup is restricted to an already authenticated CEO administrator session. No email, phone, OTP or authenticator code is used for future logins.</div>
        </div>
      </section> : !isAdmin ? <section className="panel auth-card">
        <div className="panelhead"><div><h2><LockKeyhole size={17} style={{verticalAlign:'middle',marginRight:8}}/>CEO administrator login</h2><p>Sign in with your fixed CEO username and password.</p></div><span className="badge pending">Protected</span></div>
        <div style={{padding:20}}>
          <form onSubmit={login}>
            <label>Username<input value="CEO" readOnly autoComplete="username"/></label>
            <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" maxLength={128} required placeholder="Enter CEO password"/></label>
            <button className="primary" disabled={authBusy}>{authBusy ? 'Signing in…' : 'Login'}</button>
          </form>
          <div className="security-note" style={{marginTop:13}}>CEO-only access. Password attempts are rate-limited and the password is stored as a salted cryptographic hash.</div>
        </div>
      </section> : <section className="panel">
        <div className="panelhead">
          <div><h2><UserCheck size={17} style={{verticalAlign:'middle',marginRight:8}}/>Employee approval</h2><p>Review submitted employee profiles, photos and short videos before publishing.</p></div>
          <button className="refresh" onClick={loadEmployees} disabled={busy}><RefreshCw size={16}/></button>
        </div>
        <div className="toolbar">
          <div className="search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name or service area"/></div>
          <div className="tabs">{['pending','approved','rejected','suspended','all'].map(x=><button key={x} className={filter===x?'active':''} onClick={()=>setFilter(x)}>{x[0].toUpperCase()+x.slice(1)} <b>{x==='all'?employees.length:counts[x]}</b></button>)}</div>
        </div>
        {busy ? <div className="empty">Loading employee applications…</div> : visibleEmployees.length === 0 ? <div className="empty">No {filter==='all'?'employee':filter} applications found.</div> : <div className="employee-grid">
          {visibleEmployees.map(employee=><article className="employee-card" key={employee.id}>
            <div className="employee-top">
              {employee.avatar_url ? <img src={employee.avatar_url} alt="Employee profile"/> : <div className="media-empty"><Camera size={24}/><small>No photo</small></div>}
              <div><h3>{employee.profile?.display_name || 'Employee applicant'}</h3><p>{employee.profile?.gender || '—'} · {employee.profile?.birth_date || 'Birth date not set'}</p><span className={'badge '+employee.status}>{employee.status}</span></div>
            </div>
            {employee.video_url ? <video className="review-video" src={employee.video_url} controls playsInline preload="metadata"/> : <div className="video-empty"><Video size={18}/> No introduction video</div>}
            <p className="bio">{employee.bio || 'No introduction provided.'}</p>
            <div className="details"><span><b>Service area</b>{employee.service_area || employee.profile?.area || '—'}</span><span><b>Short</b>{Number(employee.short_price_etb||0).toLocaleString()} ETB</span><span><b>Long</b>{Number(employee.long_price_etb||0).toLocaleString()} ETB</span></div>
            <small className="created">Submitted {employee.created_at ? new Date(employee.created_at).toLocaleString() : '—'}</small>
            {employee.review_note && <div className="review-note">Previous review: {employee.review_note}</div>}
            {employee.status==='pending' && <div className="actions"><button className="approve" disabled={workingId===employee.id} onClick={()=>reviewEmployee(employee,'approved')}><Check size={14}/> Approve</button><button className="reject" disabled={workingId===employee.id} onClick={()=>reviewEmployee(employee,'rejected')}><X size={14}/> Reject</button></div>}
            {employee.status==='approved' && <div className="actions"><button className="reject" disabled={workingId===employee.id} onClick={()=>reviewEmployee(employee,'suspended')}>Suspend</button></div>}
            {employee.status==='suspended' && <div className="actions"><button className="approve" disabled={workingId===employee.id} onClick={()=>reviewEmployee(employee,'approved')}><Check size={14}/> Reinstate</button></div>}
          </article>)}
        </div>}
      </section>}
      {isAdmin && <section className="panel room-admin-panel">
        <div className="panelhead"><div><h2><Building2 size={17} style={{verticalAlign:'middle',marginRight:8}}/>Room Service management</h2><p>Approve hotel and private-room providers and their room listings.</p></div><button className="refresh" onClick={loadRoomData}><RefreshCw size={16}/></button></div>
        <div className="tabs room-tabs">{['pending','approved','rejected','suspended','all'].map(x=><button key={x} className={roomFilter===x?'active':''} onClick={()=>setRoomFilter(x)}>{x[0].toUpperCase()+x.slice(1)}</button>)}</div>
        <h3 className="room-admin-heading">Provider applications ({roomProviders.filter(x=>roomFilter==='all'||x.status===roomFilter).length})</h3>
        <div className="room-admin-grid">
          {roomProviders.filter(x=>roomFilter==='all'||x.status===roomFilter).map(p=><article className="room-admin-card" key={p.owner_id}>
            <span className={'badge '+p.status}>{p.status}</span><h3>{p.business_name}</h3><p>{p.provider_type==='hotel'?'Hotel / guest house':'Private room owner'} · {p.city}</p><p>{p.contact_name} · {p.contact_phone}</p><p>{p.address}</p>{p.description&&<p>{p.description}</p>}
            {p.review_note&&<small>Previous note: {p.review_note}</small>}
            {p.status==='pending'&&<div className="actions"><button className="approve" disabled={workingId===p.owner_id} onClick={()=>reviewRoomProvider(p,'approved')}><Check size={14}/> Approve</button><button className="reject" disabled={workingId===p.owner_id} onClick={()=>reviewRoomProvider(p,'rejected')}><X size={14}/> Reject</button></div>}
            {p.status==='approved'&&<div className="actions"><button className="reject" disabled={workingId===p.owner_id} onClick={()=>reviewRoomProvider(p,'suspended')}>Suspend</button></div>}
            {p.status==='suspended'&&<div className="actions"><button className="approve" disabled={workingId===p.owner_id} onClick={()=>reviewRoomProvider(p,'approved')}>Reinstate</button></div>}
          </article>)}
          {roomProviders.filter(x=>roomFilter==='all'||x.status===roomFilter).length===0&&<div className="empty">No provider applications in this status.</div>}
        </div>
        <h3 className="room-admin-heading">Room listings ({roomListings.filter(x=>roomFilter==='all'||x.status===roomFilter).length})</h3>
        <div className="room-admin-grid">
          {roomListings.filter(x=>roomFilter==='all'||x.status===roomFilter).map(r=><article className="room-admin-card" key={r.id}>
            {r.cover_image_url&&<img className="room-admin-photo" src={r.cover_image_url} alt={r.title}/>}<span className={'badge '+r.status}>{r.status}</span><h3>{r.title}</h3><p>{r.property_type==='hotel_room'?'Hotel room':'Private room'} · {r.city} · {r.area}</p><p>{Number(r.price_per_night_etb).toLocaleString()} ETB / night · Up to {r.max_guests} guests</p><p>{r.address}</p>
            {r.review_note&&<small>Previous note: {r.review_note}</small>}
            {r.status==='pending'&&<div className="actions"><button className="approve" disabled={workingId===r.id} onClick={()=>reviewRoomListing(r,'approved')}><Check size={14}/> Approve</button><button className="reject" disabled={workingId===r.id} onClick={()=>reviewRoomListing(r,'rejected')}><X size={14}/> Reject</button></div>}
            {r.status==='approved'&&<div className="actions"><button className="reject" disabled={workingId===r.id} onClick={()=>reviewRoomListing(r,'suspended')}>Suspend</button></div>}
            {r.status==='suspended'&&<div className="actions"><button className="approve" disabled={workingId===r.id} onClick={()=>reviewRoomListing(r,'approved')}>Reinstate</button></div>}
          </article>)}
          {roomListings.filter(x=>roomFilter==='all'||x.status===roomFilter).length===0&&<div className="empty">No room listings in this status.</div>}
        </div>
      </section>}

        <h3 className="room-admin-heading">Reservation monitor ({roomBookings.length})</h3>
        <div className="room-admin-grid">
          {roomBookings.map(b=><article className="room-admin-card" key={b.id}>
            <span className={'badge '+b.status}>{b.status}</span>
            <h3>{roomListings.find(x=>x.id===b.listing_id)?.title || 'Room reservation'}</h3>
            <p>{b.check_in} → {b.check_out} · {b.total_nights} night(s)</p>
            <p>{b.guests} guest(s) · Customer ID: {b.customer_id}</p>
            <p><b>{Number(b.total_amount_etb).toLocaleString()} ETB</b> · Payment: {b.payment_status}</p>
            <small>Requested {b.created_at?new Date(b.created_at).toLocaleString():'—'}</small>
          </article>)}
          {roomBookings.length===0&&<div className="empty">No room reservations have been submitted yet.</div>}
        </div>
      <section className="commission">
        <b>Administrator audit</b>
        <p>Approval decisions are written to the live employee_profiles table with reviewer, timestamp and reason. Employees cannot approve themselves. Only the CEO password-authenticated session can access review controls.</p>
      </section>
      <footer>MeetConnect Admin · Live database · Protected approval controls</footer>
    </main>
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
