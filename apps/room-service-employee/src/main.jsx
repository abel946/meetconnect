import React, { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { BedDouble, Building2, Camera, CalendarDays, Check, ChevronRight, Clock, LogOut, MapPin, Plus, RefreshCw, ShieldCheck, Upload, UserRound, Wallet, X } from 'lucide-react';
import './style.css';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = url && key ? createClient(url, key) : null;
const emptyProvider = { provider_type:'hotel', business_name:'', contact_name:'', contact_phone:'', description:'', city:'Addis Ababa', address:'' };
const emptyRoom = { title:'', property_type:'hotel_room', description:'', city:'Addis Ababa', area:'', address:'', price_per_night_etb:'', max_guests:'2', bedrooms:'1', bathrooms:'1', amenities:'Wi-Fi, Hot water, Private bathroom', photo_urls:[] };
const money = n => Number(n || 0).toLocaleString('en-US');

function App() {
  const [session,setSession] = useState(null);
  const [loading,setLoading] = useState(true);
  const [authMode,setAuthMode] = useState('register');
  const [username,setUsername] = useState('');
  const [password,setPassword] = useState('');
  const [ageConfirmed,setAgeConfirmed] = useState(false);
  const [authBusy,setAuthBusy] = useState(false);
  const [tab,setTab] = useState('Overview');
  const [provider,setProvider] = useState(emptyProvider);
  const [providerStatus,setProviderStatus] = useState('');
  const [profileSaved,setProfileSaved] = useState(false);
  const [rooms,setRooms] = useState([]);
  const [bookings,setBookings] = useState([]);
  const [room,setRoom] = useState(emptyRoom);
  const [editingRoom,setEditingRoom] = useState('');
  const [saving,setSaving] = useState(false);
  const [uploading,setUploading] = useState(false);
  const [notice,setNotice] = useState('');
  const say = message => { setNotice(message); window.scrollTo({top:0,behavior:'smooth'}); };

  const loadWorkspace = useCallback(async current => {
    if (!supabase || !current?.user) return;
    const uid = current.user.id;
    const [{data:p,error:pe},{data:r,error:re},{data:b,error:be}] = await Promise.all([
      supabase.from('room_service_profiles').select('*').eq('owner_id',uid).maybeSingle(),
      supabase.rpc('get_my_room_listings'),
      supabase.from('room_bookings').select('*').order('created_at',{ascending:false})
    ]);
    if (pe) say('Could not load business profile: '+pe.message);
    if (re) say('Could not load room listings: '+re.message);
    if (be) say('Could not load reservations: '+be.message);
    if (p) {
      setProvider({provider_type:p.provider_type,business_name:p.business_name,contact_name:p.contact_name,contact_phone:p.contact_phone,description:p.description||'',city:p.city||'Addis Ababa',address:p.address||''});
      setProviderStatus(p.status);
      setProfileSaved(true);
    } else { setProviderStatus(''); setProfileSaved(false); }
    setRooms(r||[]);
    setBookings(b||[]);
  },[]);

  useEffect(() => {
    let alive = true;
    async function init() {
      if (!supabase) { setLoading(false); return; }
      const {data:{session:existing}} = await supabase.auth.getSession();
      if (alive && existing) { setSession(existing); await loadWorkspace(existing); }
      if (alive) setLoading(false);
    }
    init();
    if (!supabase) return () => { alive=false; };
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,next) => {
      setSession(next);
      if (next) setTimeout(()=>loadWorkspace(next),0);
      else { setRooms([]); setBookings([]); setProviderStatus(''); setProfileSaved(false); }
    });
    return () => { alive=false; subscription.unsubscribe(); };
  },[loadWorkspace]);

  async function authenticate() {
    const name = username.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(name)) return say('Use 3–30 letters, numbers, dots, underscores or hyphens for your account name.');
    if (password.length < 8) return say('Your password must contain at least 8 characters.');
    if (authMode==='register' && !ageConfirmed) return say('Please confirm you are 18 or older.');
    setAuthBusy(true);
    try {
      const {data,error} = await supabase.functions.invoke('room-service-username-auth',{body:{action:authMode==='register'?'register':'login',username:name,password,ageConfirmed}});
      if (error || data?.error) throw new Error(data?.error || error?.message || 'Authentication failed.');
      const {data:sessionData,error:sessionError} = await supabase.auth.setSession({access_token:data.session.access_token,refresh_token:data.session.refresh_token});
      if (sessionError) throw sessionError;
      setSession(sessionData.session);
      await loadWorkspace(sessionData.session);
      say(authMode==='register'?'Room Service account created. Complete your business profile to begin.':'Welcome back to Room Service.');
    } catch (e) { say(e?.message || 'Please try again.'); }
    finally { setAuthBusy(false); }
  }

  async function saveProvider(e) {
    e?.preventDefault();
    if (!provider.business_name.trim() || !provider.contact_name.trim() || !provider.contact_phone.trim() || !provider.address.trim()) return say('Complete all required business details.');
    setSaving(true);
    const payload = {...provider,owner_id:session.user.id,status:'pending',review_note:null,reviewed_at:null,reviewed_by:null,updated_at:new Date().toISOString()};
    const {error} = await supabase.from('room_service_profiles').upsert(payload,{onConflict:'owner_id'});
    setSaving(false);
    if (error) return say('Could not save business profile: '+error.message);
    setProviderStatus('pending'); setProfileSaved(true);
    say('Business profile submitted. It will appear in MeetConnect after Admin approval.');
    await loadWorkspace(session);
  }

  async function uploadPhotos(files) {
    if (!files?.length) return;
    if (files.length + room.photo_urls.length > 8) return say('You can add up to 8 room photos.');
    setUploading(true);
    const urls = [];
    for (const file of Array.from(files)) {
      if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 10*1024*1024) { setUploading(false); return say('Choose JPG, PNG or WebP photos up to 10 MB each.'); }
      const ext = (file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');
      const path = session.user.id+'/'+Date.now()+'-'+Math.random().toString(36).slice(2)+'.'+ext;
      const {error} = await supabase.storage.from('room-service-media').upload(path,file,{upsert:false,contentType:file.type,cacheControl:'3600'});
      if (error) { setUploading(false); return say('Photo upload failed: '+error.message); }
      const {data} = supabase.storage.from('room-service-media').getPublicUrl(path);
      if (data?.publicUrl) urls.push(data.publicUrl);
    }
    setRoom(old=>({...old,photo_urls:[...old.photo_urls,...urls]}));
    setUploading(false);
    say(urls.length+' room photo(s) uploaded. Save the room listing to submit them.');
  }

  async function saveRoom(e) {
    e?.preventDefault();
    if (providerStatus!=='approved') return say('Your business profile must be approved before you can publish rooms.');
    if (!room.title.trim() || !room.area.trim() || !room.address.trim() || Number(room.price_per_night_etb)<=0) return say('Enter a room title, location and valid nightly price.');
    if (!room.photo_urls.length) return say('Upload at least one room photo.');
    setSaving(true);
    const payload = {
      owner_id:session.user.id,title:room.title.trim(),property_type:room.property_type,description:room.description.trim(),
      city:room.city.trim(),area:room.area.trim(),address:room.address.trim(),price_per_night_etb:Number(room.price_per_night_etb),
      max_guests:Number(room.max_guests),bedrooms:Number(room.bedrooms),bathrooms:Number(room.bathrooms),
      amenities:room.amenities.split(',').map(x=>x.trim()).filter(Boolean),photo_urls:room.photo_urls,
      cover_image_url:room.photo_urls[0],is_available:true,status:'pending',review_note:null,reviewed_at:null,reviewed_by:null,updated_at:new Date().toISOString()
    };
    const result = editingRoom
      ? await supabase.from('room_listings').update(payload).eq('id',editingRoom).select('id').single()
      : await supabase.from('room_listings').insert(payload).select('id').single();
    setSaving(false);
    if (result.error) return say('Could not save room: '+result.error.message);
    setRoom(emptyRoom); setEditingRoom('');
    say('Room submitted for Admin approval. It will appear to customers after approval.');
    await loadWorkspace(session); setTab('Rooms');
  }

  function editRoom(item) {
    setEditingRoom(item.id);
    setRoom({title:item.title,property_type:item.property_type,description:item.description||'',city:item.city,area:item.area,address:item.address,price_per_night_etb:String(item.price_per_night_etb),max_guests:String(item.max_guests),bedrooms:String(item.bedrooms),bathrooms:String(item.bathrooms),amenities:(item.amenities||[]).join(', '),photo_urls:item.photo_urls||[]});
    setTab('Add room');
  }

  async function updateBooking(id,status) {
    const {error} = await supabase.from('room_bookings').update({status,updated_at:new Date().toISOString()}).eq('id',id).eq('status','pending');
    if (error) return say('Could not update reservation: '+error.message);
    say(status==='confirmed'?'Reservation confirmed.':'Reservation declined.');
    await loadWorkspace(session);
  }

  async function signOut() { await supabase.auth.signOut(); setSession(null); setPassword(''); setTab('Overview'); }

  if (loading) return <main className="loading"><div className="brand"><BedDouble/> MeetConnect Room Service</div><p>Preparing your workspace…</p></main>;
  if (!supabase) return <main className="auth"><h1>MeetConnect <em>Room Service</em></h1><p>Room owner and hotel staff workspace.</p><div className="notice">Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to this Vercel project.</div></main>;
  if (!session) return <main className="auth"><div className="brand"><BedDouble/> MeetConnect <em>Room Service</em></div><section className="hero"><small>HOTEL & PRIVATE ROOM PARTNERS</small><h1>Welcome guests.<br/><em>Grow your rooms.</em></h1><p>Manage room listings, availability and reservations in one secure workspace.</p></section>{notice&&<div className="notice">{notice}</div>}<section className="panel"><div className="switch"><button className={authMode==='register'?'on':''} onClick={()=>{setAuthMode('register');setNotice('');}}>Register</button><button className={authMode==='login'?'on':''} onClick={()=>{setAuthMode('login');setNotice('');}}>Sign in</button></div><label>Account name<input value={username} onChange={e=>setUsername(e.target.value)} placeholder="e.g. bolehotel" autoComplete="username"/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete={authMode==='register'?'new-password':'current-password'}/></label>{authMode==='register'&&<label className="age"><input type="checkbox" checked={ageConfirmed} onChange={e=>setAgeConfirmed(e.target.checked)}/> I confirm I am 18 or older and can manage this property.</label>}<button className="primary" disabled={authBusy} onClick={authenticate}>{authBusy?'Please wait…':authMode==='register'?'Create Room Service account →':'Sign in →'}</button><small className="fine">Your business and rooms remain hidden until approved by MeetConnect Admin.</small></section></main>;

  return <main className="workspace"><header><div className="brand"><BedDouble/><span>MeetConnect <em>Room Service</em><small>PARTNER WORKSPACE</small></span></div><button className="signout" onClick={signOut}><LogOut size={16}/></button></header>
    <section className="hero"><small>ROOM PARTNER DASHBOARD</small><h1>{provider.business_name||'Your property'}<br/><em>at a glance.</em></h1><p>Manage listings and guest reservations in one place.</p><span className={'status '+providerStatus}>{providerStatus?providerStatus.replace('_',' '):'Business profile needed'}</span></section>
    {notice&&<button className="notice" onClick={()=>setNotice('')}>{notice} ×</button>}
    <nav>{['Overview','Rooms','Add room','Bookings','Business profile'].map(x=><button key={x} className={tab===x?'on':''} onClick={()=>setTab(x)}>{x}</button>)}</nav>
    {tab==='Overview'&&<><div className="metrics"><article><small>ROOM LISTINGS</small><b>{rooms.length}</b></article><article><small>PENDING BOOKINGS</small><b>{bookings.filter(x=>x.status==='pending').length}</b></article><article><small>CONFIRMED BOOKINGS</small><b>{bookings.filter(x=>x.status==='confirmed').length}</b></article></div><section className="panel"><h3>Partner checklist</h3>{[[Building2,'Business profile',profileSaved?'Submitted for review':'Add your hotel or private-room details'],[BedDouble,'Room listings',rooms.length+' room listing(s)'],[CalendarDays,'Guest reservations',bookings.length+' reservation(s)']].map(([Icon,title,sub])=><div className="checkrow" key={title}><Icon/><span><b>{title}</b><small>{sub}</small></span><ChevronRight/></div>)}</section><div className="notice"><ShieldCheck/> Your listings are visible to customers only after MeetConnect Admin approval.</div></>}
    {tab==='Rooms'&&<section className="panel"><div className="panelhead"><h3>Your room listings</h3><button className="refresh" onClick={()=>loadWorkspace(session)}><RefreshCw size={16}/></button></div>{rooms.length===0?<p>No rooms added yet. Start by adding your first room.</p>:rooms.map(x=><article className="roomrow" key={x.id}>{x.cover_image_url?<img src={x.cover_image_url} alt={x.title}/>:<div className="photoempty"><Camera/>No photo</div>}<div><b>{x.title}</b><small>{x.city} · {x.area}</small><strong>{money(x.price_per_night_etb)} ETB / night</strong><span className={'status '+x.status}>{x.status}</span><button className="subtlebtn" onClick={()=>editRoom(x)}>Edit listing for review</button></div></article>)}</section>}
    {tab==='Add room'&&<form className="panel" onSubmit={saveRoom}><h3>{editingRoom?'Update room listing':'Add a room'}</h3><p>Hotel rooms and privately owned rooms are both welcome. Every new or edited listing is reviewed before publication.</p><label>Room / listing title<input required value={room.title} onChange={e=>setRoom({...room,title:e.target.value})} placeholder="e.g. Deluxe double room"/></label><label>Listing type<select value={room.property_type} onChange={e=>setRoom({...room,property_type:e.target.value})}><option value="hotel_room">Hotel room</option><option value="private_room">Private room</option></select></label><label>Description<textarea rows="3" value={room.description} onChange={e=>setRoom({...room,description:e.target.value})} placeholder="Describe the room and what makes it comfortable."/></label><div className="grid2"><label>City<input value={room.city} onChange={e=>setRoom({...room,city:e.target.value})}/></label><label>Area / neighborhood<input required value={room.area} onChange={e=>setRoom({...room,area:e.target.value})} placeholder="Bole, Addis Ababa"/></label></div><label>Address / directions<input required value={room.address} onChange={e=>setRoom({...room,address:e.target.value})}/></label><label>Price per night (ETB)<input required type="number" min="1" step="0.01" value={room.price_per_night_etb} onChange={e=>setRoom({...room,price_per_night_etb:e.target.value})}/></label><div className="grid3"><label>Guests<input type="number" min="1" max="20" value={room.max_guests} onChange={e=>setRoom({...room,max_guests:e.target.value})}/></label><label>Bedrooms<input type="number" min="0" max="20" value={room.bedrooms} onChange={e=>setRoom({...room,bedrooms:e.target.value})}/></label><label>Bathrooms<input type="number" min="0" max="20" step="0.5" value={room.bathrooms} onChange={e=>setRoom({...room,bathrooms:e.target.value})}/></label></div><label>Amenities (comma separated)<input value={room.amenities} onChange={e=>setRoom({...room,amenities:e.target.value})} placeholder="Wi-Fi, hot water, parking"/></label><div className="uploadbox"><b><Camera/> Room photos</b><div className="photos">{room.photo_urls.map((src,i)=><img src={src} alt={'Room '+(i+1)} key={src}/>)}</div><label className="upload"><Upload size={16}/> {uploading?'Uploading…':'Choose photos'}<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading} onChange={e=>{uploadPhotos(e.target.files);e.target.value='';}}/></label><small>Up to 8 images · JPG/PNG/WebP · 10 MB each</small></div><button className="primary" disabled={saving||uploading}>{saving?'Saving…':'Submit room for Admin approval →'}</button></form>}
    {tab==='Bookings'&&<section className="panel"><div className="panelhead"><h3>Guest reservations</h3><button className="refresh" onClick={()=>loadWorkspace(session)}><RefreshCw size={16}/></button></div>{bookings.length===0?<p>No reservations yet.</p>:bookings.map(b=><article className="booking" key={b.id}><div className="bookingtop"><b>{b.check_in} → {b.check_out}</b><span className={'status '+b.status}>{b.status}</span></div><p>{b.guests} guest(s) · {b.total_nights} night(s)</p><strong>{money(b.total_amount_etb)} ETB</strong><small>Payment: {b.payment_status} · {new Date(b.created_at).toLocaleString()}</small>{b.status==='pending'&&<div className="actions"><button className="approve" onClick={()=>updateBooking(b.id,'confirmed')}><Check/> Confirm</button><button className="decline" onClick={()=>updateBooking(b.id,'rejected')}><X/> Decline</button></div>}</article>)}</section>}
    {tab==='Business profile'&&<form className="panel" onSubmit={saveProvider}><h3>Business / owner profile</h3><p>Register as a hotel or a private room owner. MeetConnect Admin reviews this profile before you can publish rooms.</p><label>Provider type<select value={provider.provider_type} onChange={e=>setProvider({...provider,provider_type:e.target.value})}><option value="hotel">Hotel / guest house</option><option value="private_owner">Private room owner</option></select></label><label>Business / property name<input required value={provider.business_name} onChange={e=>setProvider({...provider,business_name:e.target.value})}/></label><label>Contact person<input required value={provider.contact_name} onChange={e=>setProvider({...provider,contact_name:e.target.value})}/></label><label>Phone number<input required type="tel" value={provider.contact_phone} onChange={e=>setProvider({...provider,contact_phone:e.target.value})}/></label><label>City<input value={provider.city} onChange={e=>setProvider({...provider,city:e.target.value})}/></label><label>Business address<input required value={provider.address} onChange={e=>setProvider({...provider,address:e.target.value})}/></label><label>Business description<textarea rows="4" value={provider.description} onChange={e=>setProvider({...provider,description:e.target.value})}/></label><button className="primary" disabled={saving}>{saving?'Submitting…':profileSaved?'Save changes for re-review':'Submit business profile →'}</button></form>}
    <footer>MeetConnect · Room Service partner workspace · All listings subject to Admin approval</footer>
  </main>;
}
createRoot(document.getElementById('root')).render(<App/>);