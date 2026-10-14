import {createHmac,timingSafeEqual,randomBytes} from 'node:crypto';
import {db} from './db.js';
import {config} from './config.js';
import {integer,ensure,today} from './domain.js';
import {lock,acceptPayment,audit} from './finance.js';
type Params=Record<string,string>;
const encode=(value:string)=>encodeURIComponent(value).replace(/%20/g,'+');
const canonical=(q:Params)=>Object.keys(q).filter(k=>k!=='vnp_SecureHash'&&k!=='vnp_SecureHashType').sort().map(k=>`${encode(k)}=${encode(q[k])}`).join('&');
const hmac=(value:string,secret:string)=>createHmac('sha512',secret).update(value).digest('hex');
export const vnpaySign=(q:Params,secret:string)=>hmac(canonical(q),secret);
const equalHash=(a:string,b:string)=>/^[a-f0-9]{128}$/i.test(a||'')&&timingSafeEqual(Buffer.from(a.toLowerCase(),'hex'),Buffer.from(b,'hex'));
export const vnpayVerify=(q:Params,secret:string)=>!!secret&&equalHash(q.vnp_SecureHash,vnpaySign(q,secret));
const stamp=(date=new Date())=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(date).replace(/\D/g,'');
const paidAt=(value:string)=>{ensure(/^\d{14}$/.test(value||''),'VNPAY thiếu ngày thanh toán');const d=new Date(`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}T${value.slice(8,10)}:${value.slice(10,12)}:${value.slice(12,14)}+07:00`);ensure(Number.isFinite(d.getTime())&&stamp(d)===value&&d.getTime()<=Date.now()+300000,'Ngày thanh toán VNPAY không hợp lệ');return d;};
export async function createOnlinePayment(input:{householdId:string;chargeId?:string;campaignId?:string;amount:number;key:string;payer:string},ip:string){
 integer(input.amount);ensure(Boolean(input.chargeId)!==Boolean(input.campaignId),'Chọn đúng một khoản thu hoặc đợt đóng góp');const ready=!!(config.vnpayCode&&config.vnpaySecret);ensure(ready||config.demo,'Chưa cấu hình merchant VNPAY Sandbox',503);
 const p=await db.$transaction(async tx=>{await lock(tx,'finance:'+input.householdId);const old=await tx.payment.findUnique({where:{key:input.key}});if(old){ensure(old.householdId===input.householdId&&old.amount===input.amount&&old.chargeId===(input.chargeId||null)&&old.campaignId===(input.campaignId||null),'Mã yêu cầu đã được dùng',409);return old;}
  if(input.campaignId){ensure(!input.chargeId,'Chỉ chọn một loại thanh toán');const c=await tx.campaign.findUnique({where:{id:input.campaignId}});ensure(c&&c.start<=today()&&c.end>=today(),'Đợt đóng góp không mở');}else{const c=await tx.charge.findUnique({where:{id:input.chargeId}});ensure(c&&c.householdId===input.householdId&&c.status==='PUBLISHED'&&input.amount<=c.outstanding,'Khoản hoặc số tiền không hợp lệ');}
  return tx.payment.create({data:{...input,method:ready?'VNPAY':'DEMO',providerDate:stamp()}});
 });
 if(p.method==='DEMO')return{payment:p,url:`/demo-payment/${p.id}`,mode:'LOCAL_SIMULATION'};
 const q:Params={vnp_Version:'2.1.0',vnp_Command:'pay',vnp_TmnCode:config.vnpayCode,vnp_Amount:String(p.amount*100),vnp_CurrCode:'VND',vnp_TxnRef:p.id,vnp_OrderInfo:'BlueMoon payment '+p.id,vnp_OrderType:'other',vnp_Locale:'vn',vnp_ReturnUrl:config.appUrl+'/api/v1/vnpay/return',vnp_IpAddr:ip.replace('::ffff:',''),vnp_CreateDate:p.providerDate,vnp_ExpireDate:stamp(new Date(Date.now()+15*60000))};
 return{payment:p,url:config.vnpayUrl+'?'+canonical(q)+'&vnp_SecureHash='+vnpaySign(q,config.vnpaySecret),mode:'VNPAY_SANDBOX'};
}
export async function handleIpn(q:Params){
 if(!vnpayVerify(q,config.vnpaySecret))return{RspCode:'97',Message:'Invalid signature'};
 if(q.vnp_TmnCode!==config.vnpayCode)return{RspCode:'97',Message:'Invalid merchant'};
 const p=await db.payment.findUnique({where:{id:q.vnp_TxnRef}});if(!p||p.method!=='VNPAY')return{RspCode:'01',Message:'Order not found'};
 if(q.vnp_Amount!==String(p.amount*100))return{RspCode:'04',Message:'Invalid amount'};
 const result=await db.$transaction(async tx=>{await lock(tx,'finance:'+p.householdId);const current=await tx.payment.findUniqueOrThrow({where:{id:p.id}});if(current.status!=='PENDING')return{RspCode:'02',Message:'Already confirmed'};
  if(q.vnp_ResponseCode==='00'&&q.vnp_TransactionStatus==='00'){await tx.payment.update({where:{id:p.id},data:{reference:q.vnp_TransactionNo||''}});await acceptPayment(tx,p.id,'VNPAY',paidAt(q.vnp_PayDate));}
  else{await tx.payment.update({where:{id:p.id},data:{status:'FAILED',reference:q.vnp_TransactionNo||''}});await audit(tx,'VNPAY','PAYMENT_FAILED',p.id,{response:q.vnp_ResponseCode,status:q.vnp_TransactionStatus});}
  return{RspCode:'00',Message:'Confirmed'};
 });return result;
}
export async function reconcile(id:string,ip:string){
 const p=await db.payment.findUniqueOrThrow({where:{id}});ensure(p.method==='VNPAY'&&config.vnpaySecret&&config.vnpayCode,'Giao dịch VNPAY chưa được cấu hình');if(p.status!=='PENDING')return p;
 const q:Params={vnp_RequestId:randomBytes(12).toString('hex'),vnp_Version:'2.1.0',vnp_Command:'querydr',vnp_TmnCode:config.vnpayCode,vnp_TxnRef:p.id,vnp_TransactionDate:p.providerDate,vnp_CreateDate:stamp(),vnp_IpAddr:ip.replace('::ffff:',''),vnp_OrderInfo:'BlueMoon query '+p.id};
 q.vnp_SecureHash=hmac(['vnp_RequestId','vnp_Version','vnp_Command','vnp_TmnCode','vnp_TxnRef','vnp_TransactionDate','vnp_CreateDate','vnp_IpAddr','vnp_OrderInfo'].map(k=>q[k]).join('|'),config.vnpaySecret);
 const response=await fetch('https://sandbox.vnpayment.vn/merchant_webapi/api/transaction',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(q),signal:AbortSignal.timeout(25000)});ensure(response.ok,'Truy vấn VNPAY thất bại',502);const r:Params=await response.json();
 const hash=hmac(['vnp_ResponseId','vnp_Command','vnp_ResponseCode','vnp_Message','vnp_TmnCode','vnp_TxnRef','vnp_Amount','vnp_BankCode','vnp_PayDate','vnp_TransactionNo','vnp_TransactionType','vnp_TransactionStatus','vnp_OrderInfo','vnp_PromotionCode','vnp_PromotionAmount'].map(k=>r[k]||'').join('|'),config.vnpaySecret);
 ensure(equalHash(r.vnp_SecureHash,hash)&&r.vnp_TmnCode===config.vnpayCode&&r.vnp_TxnRef===p.id&&String(r.vnp_Amount)===String(p.amount*100),'Phản hồi truy vấn VNPAY không xác thực',502);
 if(r.vnp_ResponseCode==='00'&&r.vnp_TransactionStatus==='00'){await db.$transaction(async tx=>{await lock(tx,'finance:'+p.householdId);await tx.payment.update({where:{id:p.id},data:{reference:r.vnp_TransactionNo||''}});return acceptPayment(tx,p.id,'VNPAY_QUERY',paidAt(r.vnp_PayDate));});}
 // A query processing error or unsettled status keeps the request pending for another authenticated reconciliation.
 return db.payment.findUniqueOrThrow({where:{id}});
}
