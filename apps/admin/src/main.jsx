import React, { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Users, UserCheck, ShieldAlert, Clock, RefreshCw, Database, Activity, ShieldCheck } from 'lucide-react';
import './style.css';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

function Brand() {
  return <div className="brand"><b className="logo">M</b><span><strong>MeetConnect</strong><small>ADMIN CONSOLE</small></span></div>;
}

function Metric({ icon, label, value }) {
  return <article className="metric">{icon}<small>{label}</small><strong>{value ?? '—'}</strong></article>;
}

function App() {
  const [stats, setStats] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');

  const load = useCallback(async () => {
    if (!url || !key) {
      setError('Admin environment is missing the Supabase URL or public anon key.');
      setBusy(false);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch(url.replace(/\/$/, '') + '/functions/v1/meetconnect-admin-public-stats', {
        method: 'GET',
        headers: { apikey: key, Authorization: 'Bearer ' + key }
        });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || 'Could not read the live database.');
      if (data.source !== 'live_supabase_database') throw new Error('The data source could not be verified.');
      setStats(data);
      setUpdatedAt(data.generatedAt || new Date().toISOString());
    } catch (e) {
      setError((e && e.message) || 'Could not load live dashboard statistics.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return <div className="layout">
    <aside>
      <Brand />
      <small className="section">WORKSPACE</small>
      <div className="nav selected"><Activity size={17}/>Live Overview</div>
      <div className="asidebottom"><ShieldCheck/><span><b>Read-only view</b><small>Private records protected</small></span></div>
    </aside>
    <main className="content">
      <header>
        <div><small className="eyebrow">PLATFORM MANAGEMENT</small><h1>MeetConnect dashboard</h1><p>Live summary from your real Supabase database — no sample data.</p></div>
        <button className="refresh" onClick={load} disabled={busy} aria-label="Refresh live data"><RefreshCw size={17}/></button>
      </header>
      {error && <div className="alert">{error}</div>}
      <div className="metrics">
        <Metric icon={<Users/>} label="Registered profiles" value={stats?.profiles}/>
        <Metric icon={<Clock/>} label="Pending employees" value={stats?.pendingEmployees}/>
        <Metric icon={<UserCheck/>} label="Approved employees" value={stats?.approvedEmployees}/>
        <Metric icon={<ShieldAlert/>} label="Open safety reports" value={stats?.openReports}/>
      </div>
      <section className="panel">
        <div className="panelhead">
          <div><h2><Database size={17} style={{verticalAlign:'middle',marginRight:8}}/>Live database status</h2><p>{busy ? 'Connecting to Supabase and counting current records…' : stats ? 'Counts were read from the connected production database.' : 'Waiting for a successful database response.'}</p></div>
          <span className={'badge ' + (stats ? 'approved' : 'pending')}>{stats ? 'Connected' : busy ? 'Loading' : 'Not connected'}</span>
        </div>
        <div style={{padding:'22px 19px'}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}>
            <div><small style={{color:'#8792a7'}}>Employee records</small><div style={{fontSize:24,fontWeight:800,marginTop:7}}>{stats?.employees ?? '—'}</div></div>
            <div><small style={{color:'#8792a7'}}>Safety reports (all statuses)</small><div style={{fontSize:24,fontWeight:800,marginTop:7}}>{stats?.reports ?? '—'}</div></div>
            <div><small style={{color:'#8792a7'}}>Last refreshed</small><div style={{fontSize:13,fontWeight:700,marginTop:12}}>{updatedAt ? new Date(updatedAt).toLocaleString() : '—'}</div></div>
          </div>
        </div>
      </section>
      <section className="commission">
        <b>Investor-safe dashboard</b>
        <p>This page reads live database totals only. It does not display phone numbers, personal profiles, report details, or employee approval controls without administrator sign-in. All figures come from the real database, not demo data.</p>
      </section>
      <footer>MeetConnect Admin · Live database summary · Read-only</footer>
    </main>
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);