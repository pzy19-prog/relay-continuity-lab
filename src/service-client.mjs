function req(ok,code){if(!ok)throw new Error(code);}

export function normalizeServiceUrl(value=process.env.RELAY_SERVICE_URL||'http://127.0.0.1:4318'){
  const url=new URL(value);
  req(url.protocol==='http:','SERVICE_HTTP_ONLY');
  req(['127.0.0.1','localhost','[::1]'].includes(url.hostname),'REMOTE_SERVICE_REFUSED');
  req(!url.username&&!url.password,'SERVICE_CREDENTIALS_REFUSED');
  url.pathname=url.pathname.endsWith('/')?url.pathname:url.pathname+'/';
  return url;
}

export async function serviceGet(pathname,{base}={}){
  const baseUrl=normalizeServiceUrl(base);
  const target=new URL(String(pathname).replace(/^\//,''),baseUrl);
  const res=await fetch(target,{headers:{accept:'application/json'}});
  const data=await res.json().catch(()=>({error:'SERVICE_RESPONSE_INVALID'}));
  if(!res.ok)throw new Error(data.error||('SERVICE_HTTP_'+res.status));
  return data;
}
