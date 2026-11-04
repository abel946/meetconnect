import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PROD_ORIGIN = "https://meetconnect-admin.vercel.app";
const corsHeaders = (origin: string | null) => {
  const allowed = !origin || origin === PROD_ORIGIN ||
    /^https:\/\/meetconnect-admin-[a-z0-9-]+-abemelekbekele375-5949\.vercel\.app$/.test(origin) ||
    /^http:\/\/localhost:5173$/.test(origin);
  return {
    "Access-Control-Allow-Origin": allowed && origin ? origin : PROD_ORIGIN,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
};
const reply = (body: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders(origin) });

const encoder = new TextEncoder();
const ITERATIONS = 310000;
const PASSWORD_MIN = 12;
const CEO_EMAIL = "abemelekbekele375@gmail.com";

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), c => c.charCodeAt(0));
}
async function hashPassword(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS }, key, 256);
  return new Uint8Array(bits);
}
function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
async function digest(value: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}
function decodeBearer(req: Request): string {
  return (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return reply({ error: "Method not allowed." }, 405, origin);
  const allowedOrigin = !origin || origin === PROD_ORIGIN ||
    /^https:\/\/meetconnect-admin-[a-z0-9-]+-abemelekbekele375-5949\.vercel\.app$/.test(origin) ||
    /^http:\/\/localhost:5173$/.test(origin);
  if (!allowedOrigin) return reply({ error: "Origin not allowed." }, 403, origin);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !serviceKey || !anonKey) return reply({ error: "Admin authentication service is not configured." }, 500, origin);

  let body: { action?: string; username?: string; password?: string; setupToken?: string };
  try { body = await req.json(); } catch { return reply({ error: "Invalid request." }, 400, origin); }
  const action = String(body.action || "");
  const username = String(body.username || "").trim().toUpperCase();
  const password = String(body.password || "");
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const publicClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });

  if (action === "status") {
    const { data, error } = await admin.from("meetconnect_admin_password_credentials")
      .select("password_set_at").eq("username", "CEO").maybeSingle();
    if (error) return reply({ error: "Could not check CEO password setup." }, 500, origin);
    return reply({ configured: Boolean(data?.password_set_at) }, 200, origin);
  }

  if (username !== "CEO") return reply({ error: "CEO username or password is incorrect." }, 401, origin);
  if (password.length < PASSWORD_MIN || password.length > 128) {
    return reply({ error: `Use a password between ${PASSWORD_MIN} and 128 characters.` }, 400, origin);
  }

  if (action === "setup") {
    const setupToken = String(body.setupToken || "");
    if (setupToken.length < 32 || setupToken.length > 256) return reply({ error: "The one-time CEO setup link is invalid or expired." }, 401, origin);
    const tokenHash = await digest(setupToken);
    const { data: tokenRow } = await admin.from("meetconnect_admin_setup_tokens")
      .select("token_hash").eq("token_hash", tokenHash).is("used_at", null)
      .gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!tokenRow) return reply({ error: "The one-time CEO setup link is invalid, expired or already used." }, 401, origin);

    const { data: member } = await admin.from("meetconnect_admin_members").select("user_id").limit(1).maybeSingle();
    if (!member?.user_id) return reply({ error: "The CEO administrator account is not configured." }, 403, origin);
    const { data: userInfo, error: userError } = await admin.auth.admin.getUserById(member.user_id);
    if (userError || userInfo.user?.email?.toLowerCase() !== CEO_EMAIL) {
      return reply({ error: "The registered CEO administrator account could not be verified." }, 403, origin);
    }
    const { data: existing } = await admin.from("meetconnect_admin_password_credentials")
      .select("password_set_at").eq("username", "CEO").maybeSingle();
    if (existing?.password_set_at) return reply({ error: "The CEO password has already been created. Use the login form." }, 409, origin);

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await hashPassword(password, salt);
    const { error: insertError } = await admin.from("meetconnect_admin_password_credentials").insert({
      username: "CEO", user_id: member.user_id, password_salt: toBase64(salt),
      password_hash: toBase64(hash), password_set_at: new Date().toISOString()
    });
    if (insertError) return reply({ error: "Password setup could not be saved. It may already have been completed." }, 409, origin);
    await admin.from("meetconnect_admin_setup_tokens").update({ used_at: new Date().toISOString() })
      .eq("token_hash", tokenHash).is("used_at", null);
    return reply({ success: true, message: "CEO password created." }, 200, origin);
  }

  if (action !== "login") return reply({ error: "Unsupported action." }, 400, origin);

  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const clientKey = await digest(forwarded + "|meetconnect-admin-password-login");
  const { data: attempt } = await admin.from("meetconnect_admin_password_attempts").select("*")
    .eq("client_key", clientKey).maybeSingle();
  const now = Date.now();
  let count = attempt?.attempts ?? 0;
  let windowStart = attempt?.window_started_at ? Date.parse(attempt.window_started_at) : 0;
  if (!windowStart || now - windowStart > 15 * 60 * 1000) { count = 0; windowStart = now; }
  if (count >= 5) return reply({ error: "Too many attempts. Wait 15 minutes before trying again." }, 429, origin);
  await admin.from("meetconnect_admin_password_attempts").upsert({
    client_key: clientKey, window_started_at: new Date(windowStart).toISOString(), attempts: count + 1
  });

  const { data: credential, error: credentialError } = await admin.from("meetconnect_admin_password_credentials")
    .select("user_id,password_salt,password_hash").eq("username", "CEO").maybeSingle();
  if (credentialError || !credential) return reply({ error: "CEO password has not been set up yet. Complete the one-time setup first." }, 403, origin);
  const candidate = await hashPassword(password, fromBase64(credential.password_salt));
  if (!equalBytes(candidate, fromBase64(credential.password_hash))) {
    return reply({ error: "CEO username or password is incorrect." }, 401, origin);
  }

  const { data: member } = await admin.from("meetconnect_admin_members").select("user_id")
    .eq("user_id", credential.user_id).maybeSingle();
  const { data: userInfo, error: userError } = await admin.auth.admin.getUserById(credential.user_id);
  const email = userInfo.user?.email;
  if (!member || userError || !email || email.toLowerCase() !== CEO_EMAIL) {
    return reply({ error: "The CEO administrator account is not authorized." }, 403, origin);
  }
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) return reply({ error: "Could not create a secure CEO session. Please try again." }, 500, origin);
  const { data: verified, error: sessionError } = await publicClient.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (sessionError || !verified.session) return reply({ error: "Could not establish the CEO session. Please try again." }, 500, origin);
  await admin.from("meetconnect_admin_password_attempts").delete().eq("client_key", clientKey);
  return reply({ session: verified.session, user: { id: credential.user_id, username: "CEO" } }, 200, origin);
});
