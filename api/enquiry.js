module.exports = async function(req,res){
res.setHeader('Cache-Control','no-store');
if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
const {TURNSTILE_SECRET_KEY,RESEND_API_KEY,ENQUIRY_EMAIL}=process.env;
if(!TURNSTILE_SECRET_KEY||!RESEND_API_KEY||!ENQUIRY_EMAIL) return res.status(503).json({error:'Enquiries are temporarily unavailable.'});
let b=req.body; if(typeof b==='string'){try{b=JSON.parse(b)}catch{return res.status(400).json({error:'Invalid request'})}}
if(!b||typeof b!=='object')return res.status(400).json({error:'Invalid request'});
const required=['name','email','company','website','category','geography'];const optional=['targets','useful'];const values={};
for(const k of [...required,...optional]){const v=b[k]??'';if(typeof v!=='string'||v.length>2000||(required.includes(k)&&!v.trim()))return res.status(400).json({error:'Please check your form details.'});values[k]=v.trim()}
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)||values.email.length>254)return res.status(400).json({error:'Enter a valid email address.'});
if(typeof b.token!=='string'||!b.token||b.token.length>2048)return res.status(400).json({error:'Complete the security check.'});
try{
const verification=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:TURNSTILE_SECRET_KEY,response:b.token}),signal:AbortSignal.timeout(10000)});
const check=await verification.json();
if(!check.success||!['tryaheadmark.com','www.tryaheadmark.com','aheadmark.vercel.app','aheadmark-frankichamaki.vercel.app'].includes(check.hostname)||check.action!=='scout')return res.status(400).json({error:'Security check failed. Please try again.'});
const message=Object.entries(values).map(([k,v])=>k+': '+v).join('\n')+'\nMarketing consent: '+(b.consent===true?'Yes':'No');
const sent=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.RESEND_FROM_EMAIL||'Aheadmark <onboarding@resend.dev>',to:[ENQUIRY_EMAIL],reply_to:values.email,subject:'New Aheadmark Scout enquiry',text:message}),signal:AbortSignal.timeout(15000)});
if(!sent.ok){console.error('Resend delivery rejected:',sent.status);return res.status(502).json({error:'Email delivery is temporarily unavailable. Please try again.'})}
return res.status(200).json({ok:true});
}catch(e){console.error('Enquiry service error');return res.status(502).json({error:'Unable to send your enquiry. Please try again.'})}
};