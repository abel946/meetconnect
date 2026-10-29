import React from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { Camera, CalendarCheck, ChevronRight, HeartHandshake, ShieldCheck, Wallet, UserRound, LogOut, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import './style.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const emptyForm = { name:'', gender:'female', birthDate:'', area:'Addis Ababa', serviceArea:'', bio:'', shortPrice:'500', longPrice:'2000' };
const adultMax = () => new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000).toISOString().slice(0,10);
function usernameEmail(value) {
  const username = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username)) return null;
  return username + '@accounts.meetconnect.app';
}
function App() {
  const [tab,setTab] = React.useState('Overview');
  const [session,setSession] = React.useState(null);
  const [loading,setLoading] = React.useState(true);
  const [accountName,setAccountName] = React.useState('');
  const [password,setPassword] = React.useState('');
  const [authMode,setAuthMode] = React.useState('register');
  const [authBusy,setAuthBusy] = React.useState(false);
  const [ageConfirmed,setAgeConfirmed] = React.useState(false);
  const [form,setForm] = React.useState(emptyForm);
  const [status,setStatus] = React.useState(null);
  const [requests,setRequests] = React.useState([]);
  const [notice,setNotice] = React.useState('');
  const [saving,setSaving] = React.useState(false);
  const [refreshing,setRefreshing] = React.useState(false);
  const say = (m) => { setNotice(m); window.scrollTo({top:0,behavior:'smooth'}); };
  const patch = (key,value) => setForm(old=>({...old,[key]:value}));

  const loadWorkspace = React.useCallback(async (currentSession) => {
    if (!supabase || !currentSession?.user) return;
    setRefreshing(true);
    const uid = currentSession.user.id;
    const [{data:profile,error:profileError},{data:listing,error:listingError}] = await Promise.all([
      supabase.from('profiles').select('display_name,gender,birth_date,area,bio,role').eq('id',uid).maybeSingle(),
      supabase.from('employee_profiles').select('bio,service_area,short_price_etb,long_price_etb,avatar_url,status').eq('id',uid).maybeSingle()
    ]);
    if (profileError) say('Could not load your account: ' + profileError.message);
    if (listingError) say('Could not load employee profile: ' + listingError.message);
    if (profile) setForm(old=>({...old,name:profile.display_name||old.name,gender:profile.gender||old.gender,birthDate:profile.birth_date||old.birthDate,area:profile.area||old.area,bio:listing?.bio||profile.bio||old.bio,serviceArea:listing?.service_area||old.serviceArea,shortPrice:String(listing?.short_price_etb??old.shortPrice),longPrice:String(listing?.long_price_etb??old.longPrice)}));
    setStatus(listing?.status || null);
    const {data:reqData,error:reqError} = await supabase.from('connection_requests').select('id,customer_id,employee_id,session_type,agreed_price_etb,status,created_at').eq('employee_id',uid).order('created_at',{ascending:false});
    if (!reqError) {
      const ids = [...new Set((reqData||[]).map(x=>x.customer_id))];
      let customerMap = {};
      if (ids.length) {
        const {data:customers} = await supabase.from('profiles').select('id,display_name,area').in('id',ids);
        (customers||[]).forEach(c=>customerMap[c.id]=c);
      }
      setRequests((reqData||[]).map(r=>({...r,customer:customerMap[r.customer_id]})));
    } else say('Could not load service requests: ' + reqError.message);
    setRefreshing(false);
  },[]);

  React.useEffect(() => {
    let mounted = true;
    async function init() {
      if (!supabase) { setLoading(false); return; }
      const {data:{session:existing}} = await supabase.auth.getSession();
      if (mounted && existing) { setSession(existing); await loadWorkspace(existing); }
      if (mounted) setLoading(false);
    }
    init();
    if (!supabase) return () => { mounted=false; };
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,nextSession) => {
      setSession(nextSession);
      if (nextSession) setTimeout(()=>loadWorkspace(nextSession),0);
      else { setStatus(null); setRequests([]); }
    });
    return () => { mounted=false; subscription.unsubscribe(); };
  },[loadWorkspace]);

  async function authenticate() {
    if (!supabase) return say('Supabase is not configured. Please check Vercel environment variables.');
    const loginEmail = usernameEmail(accountName);
    if (authMode === 'register' && !ageConfirmed) return say('Please confirm that you are 18 years old or older before registering.');
    if (!loginEmail) return say('Choose a unique account name using 3–30 letters, numbers, dots, underscores or hyphens. Start with a letter or number.');
    if (password.length < 8) return say('Use a password with at least 8 characters.');
    setAuthBusy(true);
    let result;
    try {
      if (authMode === 'register') {
        result = await supabase.auth.signUp({ email: loginEmail, password, options: { data: { account_name: accountName.trim() } } });
      } else {
        result = await supabase.auth.signInWithPassword({ email: loginEmail, password });
      }
    } catch (error) {
      setAuthBusy(false);
      return say('Could not contact the authentication service: ' + (error?.message || 'Please check your internet connection and try again.'));
    }
    setAuthBusy(false);
    if (result.error) return say((authMode === 'register' ? 'Registration failed: ' : 'Sign in failed: ') + result.error.message);
    if (result.data.session) {
      setSession(result.data.session);
      await loadWorkspace(result.data.session);
      say(authMode === 'register' ? 'Account created. Complete your employee profile below.' : 'Welcome back.');
    } else if (authMode === 'register') {
      say('Account created, but Supabase is asking for email confirmation. In Supabase Auth settings, turn off email confirmations to allow name-and-password registration without an email address.');
    } else {
      say('Sign in completed without a session. Check your Supabase phone-auth settings.');
    }
  }
  async function saveProfile(e) {
    e?.preventDefault();
    if (!session?.user) return say('Please register or sign in with your account name and password first.');
    if (!form.birthDate || form.birthDate > adultMax()) return say('MeetConnect is only for adults aged 18 or older.');
    if (!form.name.trim() || !form.serviceArea.trim()) return say('Enter your name and service area.');
    if (Number(form.shortPrice)<=0 || Number(form.longPrice)<=0) return say('Both session prices must be greater than zero.');
    setSaving(true);
    const {data,error} = await supabase.rpc('register_employee_profile',{
      p_display_name:form.name.trim(),p_gender:form.gender,p_birth_date:form.birthDate,
      p_bio:form.bio.trim(),p_area:form.area.trim(),p_service_area:form.serviceArea.trim(),
      p_short_price_etb:Number(form.shortPrice),p_long_price_etb:Number(form.longPrice),p_avatar_url:null
    });
    setSaving(false);
    if (error) return say('Could not submit your profile: ' + error.message);
    setStatus(data?.status || 'pending');
    say('Your employee profile was submitted successfully. It is waiting for admin approval.');
    await loadWorkspace(session);
    setTab('Overview');
  }
  async function updateRequest(id,nextStatus) {
    const {error} = await supabase.from('connection_requests').update({status:nextStatus}).eq('id',id).eq('status','pending');
    if (error) return say('Could not update request: ' + error.message);
    say(nextStatus==='accepted'?'Request accepted.':'Request declined.');
    await loadWorkspace(session);
  }
  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setSession(null); setPassword(''); setStatus(null); setRequests([]); setForm(emptyForm); setNotice('You have signed out.');
  }
  const money = value => Number(value||0).toLocaleString('en-US');
  if (loading) return <main><div className="panel"><h3>Loading MeetConnect…</h3><p>Preparing your secure employee workspace.</p></div></main>;
  if (!supabase) return <main><Header/><section className="hero"><small>EMPLOYEE SPACE</small><h1>Work with <em>confidence.</em></h1><p>Secure employee registration and profile management.</p></section><div className="notice"><ShieldCheck/><span><b>Backend setup needed</b><p>Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the employee Vercel project, then redeploy.</p></span></div></main>;
  if (!session) return <main><Header/><section className="hero"><small>EMPLOYEE SPACE</small><h1>Your work.<br/><em>Your future.</em></h1><p>Register or sign in using your account name and password.</p><span className="status">● Account name + password · 18+ required</span></section>{notice&&<div className="notice"><ShieldCheck/><span>{notice}</span></div>}<section className="panel auth-panel"><div className="auth-switch"><button type="button" className={authMode==='register'?'on':''} onClick={()=>{setAuthMode('register');setNotice('');}}>Register</button><button type="button" className={authMode==='login'?'on':''} onClick={()=>{setAuthMode('login');setNotice('');}}>Sign in</button></div><h3>{authMode==='register'?'Create employee account':'Employee sign in'}</h3><p>{authMode==='register'?'Choose a unique account name and password. Confirm you are 18+.':'Enter the account name and password you registered with.'}</p><label>Account name<input value={accountName} onChange={e=>setAccountName(e.target.value)} placeholder="e.g. abebe2026" autoComplete="username" maxLength={30}/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete={authMode==='register'?'new-password':'current-password'}/></label>{authMode==='register'&&<label className="age-confirm"><input type="checkbox" checked={ageConfirmed} onChange={e=>setAgeConfirmed(e.target.checked)}/><span>I confirm that I am 18 years old or older. I understand my employee profile will remain hidden until MeetConnect admin approves it.</span></label>}<button className="submit" disabled={authBusy} onClick={authenticate}>{authBusy?'Please wait…':authMode==='register'?'Create account →':'Sign in →'}</button><p className="auth-footnote">Use a unique account name (3–30 characters). Keep your password private.</p></section><footer>MeetConnect · Employee portal · Account name registration</footer></main>;
  return <main><header><HeaderBrand/><button className="avatar" onClick={signOut} title="Sign out"><LogOut size={17}/></button></header><section className="hero"><small>EMPLOYEE SPACE</small><h1>Work with <em>confidence.</em></h1><p>Manage your service profile, requests and earnings in one place.</p><span className={'status '+(status==='approved'?'approved':'')}>● {status==='approved'?'Approved employee':status==='pending'?'Pending admin approval':'Complete your employee profile'}</span></section>{notice&&<button className="notice notice-message" onClick={()=>setNotice('')}><ShieldCheck/><span>{notice}</span> ×</button>}<nav>{['Overview','Requests','Profile'].map(x=><button key={x} className={tab===x?'on':''} onClick={()=>setTab(x)}>{x}</button>)}</nav>
    {tab==='Overview'&&<><div className="prices"><article><small>YOUR SHORT PRICE</small><h2>{money(form.shortPrice)} <i>ETB</i></h2><small>10% platform commission: {money(Number(form.shortPrice)*.1)} ETB</small><p>You receive {money(Number(form.shortPrice)*.9)} ETB before payment fees/taxes.</p></article><article><small>YOUR LONG PRICE</small><h2>{money(form.longPrice)} <i>ETB</i></h2><small>10% platform commission: {money(Number(form.longPrice)*.1)} ETB</small><p>You receive {money(Number(form.longPrice)*.9)} ETB before payment fees/taxes.</p></article></div><section className="panel"><h3>Your workspace</h3>{[[CalendarCheck,'Service requests','Review and manage customer requests','Requests'],[Camera,'Your employee profile','Edit your bio, service area and prices','Profile'],[Wallet,'Earnings overview','See your price and commission split','Profile'],[ShieldCheck,'Safety & support','Keep personal information private','Profile']].map(([I,a,b,d])=><button className="row" key={a} onClick={()=>setTab(d)}><I/><span><b>{a}</b><small>{b}</small></span><ChevronRight/></button>)}</section><div className="notice"><HeartHandshake/><span><b>Your safety comes first</b><p>Keep service requests inside MeetConnect. Never share private location details publicly.</p></span></div></>}
    {tab==='Requests'&&<section className="panel"><div className="panel-title"><h3>Service requests</h3><button className="icon-btn" onClick={()=>loadWorkspace(session)}><RefreshCw size={16}/></button></div>{requests.length===0?<p>No service requests yet. New customer requests will appear here.</p>:requests.map(r=><article className="request-card" key={r.id}><div className="request-top"><b>{r.customer?.display_name||'MeetConnect customer'}</b><span className={'request-status '+r.status}>{r.status}</span></div><p>{r.session_type==='short'?'Short session':'Long session'} · {money(r.agreed_price_etb)} ETB</p><small>{new Date(r.created_at).toLocaleString()}</small>{r.status==='pending'&&<div className="request-actions"><button className="accept" onClick={()=>updateRequest(r.id,'accepted')}><CheckCircle2 size={16}/> Accept</button><button className="decline" onClick={()=>updateRequest(r.id,'declined')}><XCircle size={16}/> Decline</button></div>}</article>)}</section>}
    {tab==='Profile'&&<form className="panel" onSubmit={saveProfile}><h3>Your profile & pricing</h3><p>Complete your details accurately. Your profile stays hidden from discovery until an administrator approves it.</p><label>Full name<input required value={form.name} onChange={e=>patch('name',e.target.value)} placeholder="Your full name"/></label><label>Login account<input value={session.user.user_metadata?.account_name || accountName || "Account name"} readOnly/></label><label>Gender<select value={form.gender} onChange={e=>patch('gender',e.target.value)}><option value="female">Female</option><option value="male">Male</option></select></label><label>Date of birth<input type="date" required max={adultMax()} value={form.birthDate} onChange={e=>patch('birthDate',e.target.value)}/></label><label>City / general area<input required value={form.area} onChange={e=>patch('area',e.target.value)} placeholder="Addis Ababa"/></label><label>Service area<input required value={form.serviceArea} onChange={e=>patch('serviceArea',e.target.value)} placeholder="e.g. Bole, Addis Ababa"/></label><label>Introduction / bio<textarea maxLength={1000} rows="4" value={form.bio} onChange={e=>patch('bio',e.target.value)} placeholder="Introduce yourself and your services"/></label><label>Short session price (ETB)<input required type="number" min="1" value={form.shortPrice} onChange={e=>patch('shortPrice',e.target.value)}/></label><label>Long session price (ETB)<input required type="number" min="1" value={form.longPrice} onChange={e=>patch('longPrice',e.target.value)}/></label><div className="commission-note">MeetConnect commission is 10%. You receive 90% of the session price before payment-provider fees and applicable taxes.</div><button className="submit" disabled={saving}>{saving?'Saving securely…':status==='approved'?'Save profile changes':'Submit for admin review'}</button></form>}
    <footer>MeetConnect · Employee portal · <button className="footer-link" onClick={signOut}>Sign out</button></footer></main>;
}
function HeaderBrand(){return <div className="brand"><b className="logo">M</b><span><strong>MeetConnect</strong><small>EMPLOYEE PORTAL</small></span></div>}
function Header(){return <header><HeaderBrand/><span className="status">● 18+ required</span></header>}
createRoot(document.getElementById('root')).render(<App/>);
