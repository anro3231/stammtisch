/* FantastiX 3.11 - serverseitiger Web-Push-Versand.
 * Als Supabase Edge Function `fantastix-push` bereitstellen.
 * "Verify JWT" für Cron deaktivieren; Zugriff wird über geheimen
 * X-Fantastix-Token geprüft, der NIEMALS im Browser liegen darf.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.57.0';
import webPush from 'npm:web-push@3.6.7';

const env = (key: string) => Deno.env.get(key) ?? '';
const allowedHost = (input: string) => {
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' || url.port || url.username || url.password) return false;
    return url.hostname === 'web.push.apple.com' || url.hostname === 'fcm.googleapis.com' ||
      url.hostname === 'updates.push.services.mozilla.com' ||
      url.hostname.endsWith('.notify.windows.com');
  } catch { return false; }
};

type Delivery = {event_key:string;subscription_id:number;endpoint:string;p256dh:string;auth_secret:string;title:string;body:string;kind:string};

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', {status:405});
  const secret = env('FANTASTIX_PUSH_CRON_TOKEN');
  if (!secret || request.headers.get('x-fantastix-token') !== secret) {
    return new Response('Unauthorized', {status:401});
  }
  const url = env('SUPABASE_URL');
  const serviceRole = env('SUPABASE_SERVICE_ROLE_KEY');
  const pub = env('VAPID_PUBLIC_KEY');
  const priv = env('VAPID_PRIVATE_KEY');
  if (!url || !serviceRole || !pub || !priv) {
    return Response.json({error:'Missing server configuration'}, {status:500});
  }
  webPush.setVapidDetails('https://anro3231.github.io/andi/', pub, priv);
  const db = createClient(url, serviceRole, {auth:{persistSession:false,autoRefreshToken:false}});
  const reset = await db.rpc('fantastix_push_reset_stuck');
  if (reset.error) return Response.json({error:'reset failed'}, {status:500});
  const result = await db.rpc('fantastix_push_claim', {p_limit:35});
  if (result.error) return Response.json({error:'claim failed', detail:result.error.message}, {status:500});
  const deliveries = (result.data || []) as Delivery[];
  const metadata = deliveries.length ? await db.from('fantastix_push_events')
    .select('event_key,expires_at').in('event_key', deliveries.map(job => job.event_key)) : {data:[],error:null};
  if (metadata.error) return Response.json({error:'event metadata failed'}, {status:500});
  const expiries = new Map((metadata.data || []).map(event => [event.event_key,event.expires_at]));
  let ok = 0, failed = 0, removed = 0;
  for (const job of deliveries) {
    let successful = false, gone = false, error = '';
    try {
      if (!allowedHost(job.endpoint)) {gone=true;throw Error('Invalid endpoint host');}
      const expiry = expiries.get(job.event_key);
      const remaining = expiry ? Math.floor((Date.parse(expiry)-Date.now())/1000) : 86400;
      if (remaining <= 0) throw Error('Notification expired');
      const payload = JSON.stringify({
        title:job.title,body:job.body,kind:job.kind,tag:job.event_key,...(job.kind==='vote_reminder' ? {deadlineAt:expiry} : {})
      });
      await webPush.sendNotification({
        endpoint:job.endpoint,
        keys:{p256dh:job.p256dh,auth:job.auth_secret}
      },payload,{TTL:Math.min(86400,remaining), urgency:'normal'});
      successful=true; ok++;
    } catch (e) {
      const status = Number((e as {statusCode?:number})?.statusCode || 0);
      gone = gone || status === 404 || status === 410;
      error = `${status || 'Push'}: ${String((e as Error)?.message || e).slice(0,200)}`;
      if (gone) removed++; else failed++;
    }
    const done = await db.rpc('fantastix_push_finish', {
      p_event_key:job.event_key,p_subscription_id:job.subscription_id,
      p_ok:successful,p_error:error,p_gone:gone
    });
    if (done.error) console.error('Push finish:',done.error.message);
  }
  return Response.json({processed:deliveries.length,ok,failed,removed});
});
