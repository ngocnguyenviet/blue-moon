import {db} from './db.js';
import {config} from './config.js';
import {signEnvelope,verifyEnvelope} from './bridge.js';
import {today,addDays,iso,ensure,day} from './domain.js';
import {lock,type Tx} from './finance.js';
export async function householdNotice(householdId:string,kind:string,key:string,subject:string,body:string,tx:Tx=db){
 const user=await tx.user.findFirst({where:{householdId,active:true}});if(!user)return;
 for(const channel of ['EMAIL','SMS'])await tx.notification.upsert({where:{key:key+':'+channel},create:{key:key+':'+channel,householdId,recipient:channel==='EMAIL'?user.email:user.phone,channel,kind,subject,body,status:channel==='SMS'?'SIMULATED':'QUEUED'},update:{}});
}
export async function sendNotification(id:string){
 const result=await db.$transaction(async tx=>{await lock(tx,'outbox:'+id);const n=await tx.notification.findUniqueOrThrow({where:{id}});if(['ACCEPTED','SIMULATED','SENDING','EXPIRED','SUPPRESSED'].includes(n.status))return null;
  if(n.channel==='SMS'){await tx.notification.update({where:{id},data:{status:'SIMULATED'}});return null;}
  if(n.kind==='OTP'){
   const otp=await tx.otp.findUnique({where:{id:n.key.slice(4)},include:{user:true}});
   if(!otp||otp.used||otp.expiresAt<=new Date()||!otp.user.active||otp.email!==otp.user.email){await tx.notification.update({where:{id},data:{status:'EXPIRED'}});return null;}
  }else if(n.householdId){
   const user=await tx.user.findFirst({where:{householdId:n.householdId,active:true}});
   if(!user||user.email!==n.recipient){await tx.notification.update({where:{id},data:{status:'SUPPRESSED',error:'Thông tin liên hệ đã đổi hoặc tài khoản đã khóa'}});return null;}
  }
  if(n.kind==='REMINDER'&&n.householdId){
   const parts=n.key.split(':'),due=day(parts[2]);const current=await tx.charge.findMany({where:{householdId:n.householdId,status:'PUBLISHED',outstanding:{gt:0},due}});
   if(!current.length||parts[3]==='BEFORE_DUE'&&today()>due){await tx.notification.update({where:{id},data:{status:'SUPPRESSED',error:'Không còn khoản cần nhắc trong nhóm này'}});return null;}
   // Keep the signed payload stable after dispatch starts so bridge retries retain the same fingerprint.
   if(n.attempts===0)n.body=current.map(c=>`${c.name}: ${c.outstanding.toLocaleString('vi-VN')} đ, hạn ${iso(c.due)}`).join('\n');
  }
  if(!config.allowlist.includes(n.recipient.toLowerCase())){await tx.notification.update({where:{id},data:{status:'BLOCKED',error:'Địa chỉ chưa được xác nhận trong EMAIL_ALLOWLIST'}});return null;}
  if(!config.scriptUrl){await tx.notification.update({where:{id},data:{status:'NOT_CONFIGURED',error:'Chưa cấu hình Gmail Apps Script'}});return null;}
  await tx.notification.update({where:{id},data:{status:'SENDING',body:n.body,attempts:{increment:1},nextAt:new Date(Date.now()+60000)}});return n;
 });if(!result)return false;
 try{const response=await fetch(config.scriptUrl,{method:'POST',body:JSON.stringify(signEnvelope({action:'send',id:result.id,to:result.recipient,subject:result.subject,body:result.body},config.bridgeSecret)),headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(25000)});ensure(response.ok,'Bridge HTTP lỗi');const envelope=await response.json();ensure(verifyEnvelope(envelope,config.bridgeSecret),'Phản hồi bridge không xác thực');const reply=JSON.parse(envelope.payload);ensure(reply.id===id,'Sai mã thông báo');
  const status=reply.status==='ACCEPTED'?'ACCEPTED':reply.status==='QUOTA'?'RETRY':'UNKNOWN';await db.notification.update({where:{id},data:{status,sentAt:status==='ACCEPTED'?new Date():null,error:reply.error||'',nextAt:addDays(new Date(),1)}});return status==='ACCEPTED';
 }catch{await db.notification.update({where:{id},data:{status:'UNKNOWN',error:'Chưa rõ kết quả gửi; bridge sẽ đối chiếu mã thông báo khi thử lại',nextAt:new Date(Date.now()+3600000)}});return false;}
}
export async function reminders(){const now=today();let queued=0;
 const charges=await db.charge.findMany({where:{status:'PUBLISHED',outstanding:{gt:0}},include:{household:true}});
 const grouped=new Map<string,typeof charges>();for(const c of charges){const before=addDays(c.due,-3),after=addDays(c.due,1);const label=now>=after?'OVERDUE':now>=before&&now<=c.due?'BEFORE_DUE':null;if(!label)continue;const key=`${c.householdId}:${iso(c.due)}:${label}`;grouped.set(key,[...(grouped.get(key)||[]),c]);}
 for(const [key,items]of grouped){await householdNotice(items[0].householdId,'REMINDER','reminder:'+key,'BlueMoon · Nhắc hạn thanh toán',items.map(c=>`${c.name}: ${c.outstanding.toLocaleString('vi-VN')} đ, hạn ${iso(c.due)}`).join('\n'));queued++;}return queued;
}
export async function processOutbox(){
 await reminders();await db.notification.updateMany({where:{status:'SENDING',nextAt:{lte:new Date()}},data:{status:'UNKNOWN'}});
 const where={channel:'EMAIL',status:{in:['QUEUED','RETRY','UNKNOWN','NOT_CONFIGURED','BLOCKED']},nextAt:{lte:new Date()}};
 const otps=await db.notification.findMany({where:{...where,kind:'OTP'},orderBy:{createdAt:'asc'},take:50});
 const rows=[...otps,...await db.notification.findMany({where:{...where,kind:{not:'OTP'}},orderBy:{createdAt:'asc'},take:50-otps.length})];
 let accepted=0;for(const row of rows)if(await sendNotification(row.id))accepted++;
 await db.nonce.deleteMany({where:{expiresAt:{lt:new Date()}}});return{processed:rows.length,accepted};
}
