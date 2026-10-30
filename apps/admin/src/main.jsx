import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import { Users, UserCheck, ShieldAlert, Clock, RefreshCw, Database, Activity, ShieldCheck, LogOut, Search, Check, X, Video, Camera, LockKeyhole, KeyRound } from 'lucide-react';
import './style.css';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const ADMIN_EMAIL = 'abemelekbekele375@gmail.com';
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
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');
  const [username, setUsername] = useState('CEO');
  const [code, setCode] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [setupBusy, setSetupBusy] = useState(false);
  const [setup, setSetup] = useState(null);
  const [setupCode, setSetupCode] = useState('');
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

  const beginAuthenticatorSetup = useCallback(async current => {
    if (!supabase || !current?.access_token) return;
    setSetupBusy(true);
    setError('');
    try {
      const { data, error: fnError } = await supabase.functions.invoke('meetconnect-admin-auth', { body: { action: 'setup' } });
      if (fnError || data?.error) {
        const message = data?.error || fnError?.message || 'Could not start authenticator setup.';
        await supabase.auth.signOut();
        setSession(null); setIsAdmin(false);
        if (message.toLowerCase().includes('already configured')) setNotice('Google Authenticator is already configured. Sign in below with CEO and the current six-digit code.');
        else setError(message);
        return;
      }
      const qr = await QRCode.toDataURL(data.otpauthUri, { width: 220, margin: 2 });
      setSetup({ secret: data.secret, qr });
      setNotice('Scan the QR code in Google Authenticator, then enter the six-digit code shown there.');
    } catch (e) {
      setError(e?.message || 'Could not prepare Google Authenticator.');
      await supabase.auth.signOut();
      setSession(null); setIsAdmin(false);
    } finally { setSetupBusy(false); }
  }, []);

  useEffect(() => {
    if (!supabase) { setBusy(false); setError('Admin environment is missing the Supabase URL or public key.'); return; }
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      const current = data?.session;
      if (current && new URLSearchParams(window.location.search).get('setup') === '1') {
        await verifyAdminSession(current);
        if (alive) await beginAuthenticatorSetup(current);
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (current) {
        await verifyAdminSession(current);
      }
      if (alive) setBusy(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (next) setSession(next);
      else { setSession(null); setIsAdmin(false); setEmployees([]); }
    });
    loadStats();
    return () => { alive = false; subscription.unsubscribe(); };
  }, [verifyAdminSession, beginAuthenticatorSetup, loadStats]);

  useEffect(() => { if (isAdmin && session) { loadEmployees(); loadStats(); } }, [isAdmin, session, loadEmployees, loadStats]);

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
    if (!/^\d{6}$/.test(code.trim())) { setError('Enter the current six-digit Google Authenticator code.'); return; }
    setAuthBusy(true); setError(''); setNotice('');
    try {
      const { data, error: fnError } = await supabase.functions.invoke('meetconnect-admin-auth', {
        body: { action: 'login', username: username.trim().toUpperCase(), code: code.trim() }
      });
      if (fnError || data?.error) throw new Error(data?.error || fnError?.message || 'Sign-in failed.');
      if (!data?.session?.access_token || !data?.session?.refresh_token) throw new Error('Admin authentication returned no session.');
      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token, refresh_token: data.session.refresh_token
      });
      if (sessionError || !sessionData?.session) throw sessionError || new Error('Could not establish admin session.');
      await verifyAdminSession(sessionData.session);
      setCode('');
    } catch (e) { setError(e?.message || 'Sign-in failed.'); }
    finally { setAuthBusy(false); }
  }

  async function sendSetupLink() {
    if (!supabase) return;
    setSetupBusy(true); setError(''); setNotice('');
    const redirectTo = window.location.origin + '/?setup=1';
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: ADMIN_EMAIL,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: false }
    });
    setSetupBusy(false);
    if (sendError) setError('Could not send the one-time setup link: ' + sendError.message);
    else setNotice('A one-time setup link was sent to the registered CEO email. Open it on this device to configure Google Authenticator. After setup, future admin sign-ins use CEO + authenticator code only.');
  }

  async function confirmSetup(e) {
    e?.preventDefault();
    if (!/^\d{6}$/.test(setupCode.trim())) { setError('Enter the six-digit code from Google Authenticator.'); return; }
    setSetupBusy(true); setError('');
    const { data, error: fnError } = await supabase.functions.invoke('meetconnect-admin-auth', { body: { action: 'confirmSetup', code: setupCode.trim() } });
    setSetupBusy(false);
    if (fnError || data?.error) { setError(data?.error || fnError?.message || 'Could not verify the authenticator.'); return; }
    await supabase.auth.signOut();
    setSetup(null); setSetupCode(''); setNotice('Google Authenticator is now active. Sign in with CEO and the current six-digit code.');
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

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setSession(null); setIsAdmin(false); setEmployees([]); setCode(''); setSetup(null);
    setNotice('You have signed out of the admin console.');
  }

  return <div className="layout">
    <aside>
      <Brand />
      <small className="section">WORKSPACE</small>
      <div className="nav selected"><Activity size={17}/>Live Overview</div>
      <div className="nav"><UserCheck size={17}/>Employee Approval</div>
      <div className="asidebottom"><ShieldCheck/><span><b>{isAdmin ? 'Administrator session' : 'Protected controls'}</b><small>{isAdmin ? 'CEO authenticator verified' : 'Review actions require CEO sign-in'}</small></span></div>
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

      {!isAdmin ? <section className="panel auth-card">
        <div className="panelhead"><div><h2><LockKeyhole size={17} style={{verticalAlign:'middle',marginRight:8}}/>Administrator access</h2><p>Employee approval is restricted to the registered CEO administrator.</p></div><span className="badge pending">Protected</span></div>
        <div style={{padding:20}}>
          <form onSubmit={login}>
            <label>Administrator username<input value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" maxLength={20}/></label>
            <label>Google Authenticator code<input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="6-digit code" maxLength={6}/></label>
            <button className="primary" disabled={authBusy}>{authBusy ? 'Verifying…' : 'Sign in securely'}</button>
          </form>
          <div className="security-note" style={{marginTop:13}}>No admin registration is available. Only the CEO account on the server-side allowlist can sign in.</div>
          <button className="secondary" disabled={setupBusy} onClick={sendSetupLink}><KeyRound size={15}/> {setupBusy ? 'Sending…' : 'Set up Google Authenticator (first time)'}</button>
        </div>
      </section> : setup ? <section className="panel auth-card">
        <div className="panelhead"><div><h2>Set up Google Authenticator</h2><p>Scan this QR code, then verify the first six-digit code.</p></div></div>
        <div className="qr-wrap"><img className="auth-qr" src={setup.qr} alt="Google Authenticator setup QR code"/><small>Manual setup key</small><code className="secret-key">{setup.secret}</code></div>
        <form onSubmit={confirmSetup} style={{padding:'0 20px 20px'}}>
          <label>Six-digit verification code<input inputMode="numeric" value={setupCode} onChange={e=>setSetupCode(e.target.value.replace(/\D/g,'').slice(0,6))} maxLength={6}/></label>
          <button className="primary" disabled={setupBusy}>Verify and activate</button>
        </form>
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
      <section className="commission">
        <b>Administrator audit</b>
        <p>Approval decisions are written to the live employee_profiles table with reviewer, timestamp and reason. Employees cannot approve themselves. Only the CEO authenticator session can access review controls.</p>
      </section>
      <footer>MeetConnect Admin · Live database · Protected approval controls</footer>
    </main>
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
