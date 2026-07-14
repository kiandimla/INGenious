export async function api(path, options={}) {
  const response=await fetch(path,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(options.headers||{})},...options});
  if(response.status===204)return null;
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const e=new Error(data.error?.message||`Request failed (${response.status})`);e.code=data.error?.code;e.details=data.error?.details;throw e;}
  return data;
}
export const money=c=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format((c||0)/100);
