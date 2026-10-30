// Server-only maintenance: one existing JPEG per authenticated invocation.
import {createClient} from 'npm:@supabase/supabase-js@2.57.0';
import jpeg from 'npm:jpeg-js@0.4.4';
function resize(raw,maxSide){const scale=Math.min(1,maxSide/Math.max(raw.width,raw.height)),width=Math.max(1,Math.round(raw.width*scale)),height=Math.max(1,Math.round(raw.height*scale)),data=new Uint8Array(width*height*4);
for(let y=0;y<height;y++)for(let x=0;x<width;x++){const sx=(x+.5)*raw.width/width-.5,sy=(y+.5)*raw.height/height-.5,x0=Math.max(0,Math.floor(sx)),y0=Math.max(0,Math.floor(sy)),x1=Math.min(raw.width-1,x0+1),y1=Math.min(raw.height-1,y0+1),fx=Math.max(0,sx-x0),fy=Math.max(0,sy-y0),to=(y*width+x)*4;for(let c=0;c<3;c++)data[to+c]=Math.round((raw.data[(y0*raw.width+x0)*4+c]*(1-fx)+raw.data[(y0*raw.width+x1)*4+c]*fx)*(1-fy)+(raw.data[(y1*raw.width+x0)*4+c]*(1-fx)+raw.data[(y1*raw.width+x1)*4+c]*fx)*fy);data[to+3]=255;}return {width,height,data};}
Deno.serve(async req=>{if(req.method!=='POST')return new Response('Method not allowed',{status:405});const token=Deno.env.get('FANTASTIX_PUSH_CRON_TOKEN');if(!token||req.headers.get('x-fantastix-token')!==token)return new Response('Unauthorized',{status:401});
const db=createClient(Deno.env.get('SUPABASE_URL')||'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',{auth:{persistSession:false,autoRefreshToken:false}}),bucket=db.storage.from('fantastix-photos');
const rpc=async(action,args={})=>{const r=await db.rpc('fantastix_photo_compress',{p_action:action,p_args:args});if(r.error)throw Error(r.error.message);return r.data;};
try{const p=await rpc('next');if(!p){const orphanPaths=await rpc('orphans');if(orphanPaths.length){const r=await bucket.remove(orphanPaths);if(r.error)throw r.error;}return Response.json({done:true,cleaned:orphanPaths.length});}
const src=await bucket.download(p.image_path);if(src.error)throw src.error;const raw=jpeg.decode(new Uint8Array(await src.data.arrayBuffer()),{useTArray:true,maxResolutionInMP:4,maxMemoryUsageInMB:96});let bytes,side=960;
for(let attempt=0;attempt<6;attempt++){bytes=jpeg.encode(resize(raw,side),58).data;if(bytes.length<=100000)break;side=Math.round(side*.82);}if(!bytes||bytes.length>100000)throw Error('Image could not be reduced');const verify=jpeg.decode(bytes,{useTArray:true,maxResolutionInMP:2,maxMemoryUsageInMB:32});if(verify.width<1||verify.height<1)throw Error('Invalid encoded image');
const path=p.image_path.slice(0,p.image_path.lastIndexOf('/')+1)+'compressed-'+crypto.randomUUID()+'.jpg';const upload=await bucket.upload(path,bytes,{contentType:'image/jpeg',upsert:false,cacheControl:'3600'});if(upload.error)throw upload.error;
const result=await rpc('finish',{id:p.id,old_image_path:p.image_path,old_thumb_path:p.thumb_path,path,bytes:bytes.length});if(!result.updated){await bucket.remove([path]);return Response.json({skipped:true});}
const removed=await bucket.remove([...new Set([p.image_path,p.thumb_path])]);if(removed.error)throw removed.error;
return Response.json({optimized:true,before:p.image_bytes+p.thumb_bytes,after:bytes.length,width:verify.width,height:verify.height});
}catch(e){return Response.json({error:String(e?.message||e)},{status:500});}});
