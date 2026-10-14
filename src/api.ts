export async function api<T=any>(url:string,options:RequestInit={}){const response=await fetch('/api/v1'+url,{...options,credentials:'same-origin',headers:{'Content-Type':'application/json',...options.headers}});const result=await response.json();if(!response.ok)throw new Error(result.error||'Yêu cầu không thành công');return result as T;}
export const post=(url:string,data:object)=>api(url,{method:'POST',body:JSON.stringify(data)});
export const patch=(url:string,data:object)=>api(url,{method:'PATCH',body:JSON.stringify(data)});
export const money=(n:number|undefined)=>new Intl.NumberFormat('vi-VN').format(n||0)+' đ';
export const fmtDate=(s:string|undefined)=>s?new Date(s).toLocaleDateString('vi-VN'):'—';
export const dateValue=(s:string|undefined)=>s?.slice(0,10)||'';
