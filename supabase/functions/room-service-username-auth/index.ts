import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return respond({ error: "Method not allowed." }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !serviceKey || !anonKey) return respond({ error: "Authentication service is not configured." }, 500);
  let body: { action?: string; username?: string; password?: string; ageConfirmed?: boolean };
  try { body = await req.json(); } catch { return respond({ error: "Invalid request." }, 400); }
  const username = String(body.username || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username)) return respond({ error: "Choose an account name with 3–30 letters, numbers, dots, underscores or hyphens." }, 400);
  if (password.length < 8 || password.length > 128) return respond({ error: "Use a password between 8 and 128 characters." }, 400);
  if (body.action === "register" && body.ageConfirmed !== true) return respond({ error: "Confirm that you are 18 or older." }, 400);

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const email = `${username}@accounts.meetconnect.app`;
  if (body.action === "register") {
    const { data: existing } = await admin.from("room_service_username_registry").select("username").eq("username", username).maybeSingle();
    if (existing) return respond({ error: "That account name is already taken." }, 409);
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { account_name: username, account_type: "room_provider" },
    });
    if (createError) return respond({ error: "Registration could not be completed: " + createError.message }, 400);
    const { error: registryError } = await admin.from("room_service_username_registry").insert({ username, user_id: created.user.id });
    if (registryError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return respond({ error: registryError.code === "23505" ? "That account name is already taken." : "Could not save the account name." }, 409);
    }
  } else if (body.action === "login") {
    const { data: registered } = await admin.from("room_service_username_registry").select("user_id").eq("username", username).maybeSingle();
    if (!registered) return respond({ error: "Room Service account name or password is incorrect." }, 401);
  } else return respond({ error: "Unsupported action." }, 400);

  const publicClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await publicClient.auth.signInWithPassword({ email, password });
  if (error || !data.session) return respond({ error: body.action === "login" ? "Room Service account name or password is incorrect." : "Account created, but sign-in could not be completed." }, 401);
  if (data.user.user_metadata?.account_type !== "room_provider") {
    await publicClient.auth.signOut();
    return respond({ error: "This account is not registered for Room Service." }, 403);
  }
  return respond({ session: data.session, user: { id: data.user.id, account_name: username } });
});