import {Prisma} from '@prisma/client';
import {db} from './db.js';
import {ensure,integer,today} from './domain.js';
import {householdNotice} from './notifications.js';
export type Tx=Prisma.TransactionClient;
export const lock=async(tx:Tx,key:string)=>{await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;};
export const audit=(tx:Tx,actorId:string,action:string,target:string,detail:object)=>tx.audit.create({data:{actorId,action,target,detail:detail as Prisma.InputJsonValue}});
export async function credit(tx:Tx,householdId:string){return(await tx.ledger.aggregate({where:{householdId},_sum:{creditDelta:true}}))._sum.creditDelta??0;}
export async function entry(tx:Tx,data:{householdId:string;chargeId?:string;paymentId?:string;sourceId?:string;type:string;amount:number;creditDelta?:number;reason:string;actorId:string}){const e=await tx.ledger.create({data});if(e.creditDelta>0&&!e.sourceId)await tx.ledger.update({where:{id:e.id},data:{sourceId:e.id}});return e;}
async function spendCredit(tx:Tx,householdId:string,amount:number,actorId:string,type:string,reason:string,chargeId?:string,paymentId?:string){
 const balances=await tx.ledger.groupBy({by:['sourceId'],where:{householdId,sourceId:{not:null}},_sum:{creditDelta:true}});
 const available=new Map(balances.filter(b=>(b._sum.creditDelta??0)>0).map(b=>[b.sourceId!,b._sum.creditDelta!]));
 const sources=await tx.ledger.findMany({where:{householdId,paymentId,id:{in:[...available.keys()]}},orderBy:[{createdAt:'asc'},{id:'asc'}]});let remaining=amount;
 for(const source of sources){if(!remaining)break;const n=Math.min(remaining,available.get(source.id)!);await entry(tx,{householdId,chargeId,paymentId:source.paymentId??undefined,sourceId:source.id,type,amount:n,creditDelta:-n,reason,actorId});remaining-=n;}
 ensure(remaining===0,'Số dư không đủ');
}
async function releaseAllocation(tx:Tx,a:{id:string;householdId:string;chargeId:string|null;paymentId:string|null;sourceId:string|null},amount:number,actorId:string){
 await entry(tx,{householdId:a.householdId,chargeId:a.chargeId!,paymentId:a.paymentId??undefined,sourceId:a.sourceId??undefined,type:'ALLOCATION_REVERSED',amount,creditDelta:amount,reason:a.id,actorId});
}
async function remainingAllocation(tx:Tx,a:{id:string;amount:number}){return a.amount-((await tx.ledger.aggregate({where:{type:'ALLOCATION_REVERSED',reason:a.id},_sum:{amount:true}}))._sum.amount??0);}
export async function applyCredit(tx:Tx,householdId:string,actorId:string){
 let balance=await credit(tx,householdId);if(balance<=0)return;
 const charges=await tx.charge.findMany({where:{householdId,status:'PUBLISHED',outstanding:{gt:0}},orderBy:[{due:'asc'},{createdAt:'asc'},{id:'asc'}]});
 for(const charge of charges){const amount=Math.min(balance,charge.outstanding);if(!amount)break;
  await tx.charge.update({where:{id:charge.id},data:{outstanding:{decrement:amount}}});
  await spendCredit(tx,householdId,amount,actorId,'CREDIT_APPLIED','Bù từ số dư theo hạn thanh toán',charge.id);balance-=amount;
 }
}
export async function acceptPayment(tx:Tx,paymentId:string,actorId:string,providerPaidAt?:Date){
 const initial=await tx.payment.findUniqueOrThrow({where:{id:paymentId}});await lock(tx,'finance:'+initial.householdId);
 const p=await tx.payment.findUniqueOrThrow({where:{id:paymentId}});if(p.status==='SUCCESS')return p;ensure(p.status==='PENDING','Giao dịch không còn chờ xác nhận');
 const receivedAt=['VNPAY','DEMO'].includes(p.method)?providerPaidAt??new Date():p.receivedAt;
 await tx.payment.update({where:{id:p.id},data:{status:'SUCCESS',receivedAt}});
 const receipt=await entry(tx,{householdId:p.householdId,paymentId:p.id,type:p.campaignId?'CONTRIBUTION':'RECEIPT',amount:p.amount,creditDelta:p.campaignId?0:p.amount,reason:p.reference||'Thu tiền',actorId});
 if(p.chargeId&&!p.campaignId){const c=await tx.charge.findUniqueOrThrow({where:{id:p.chargeId}});if(c.status==='PUBLISHED'){const allocated=Math.min(p.amount,c.outstanding);if(allocated){await tx.charge.update({where:{id:c.id},data:{outstanding:{decrement:allocated}}});await entry(tx,{householdId:p.householdId,chargeId:c.id,paymentId:p.id,sourceId:receipt.id,type:'CREDIT_APPLIED',amount:allocated,creditDelta:-allocated,reason:'Thanh toán khoản đã chọn',actorId});}}}
 if(!p.campaignId)await applyCredit(tx,p.householdId,actorId);
 await householdNotice(p.householdId,'PAYMENT','payment:'+p.id,'BlueMoon · Xác nhận thu tiền',`Đã ghi nhận ${p.amount.toLocaleString('vi-VN')} đ. Mã phiếu ${p.id}.${p.method==='DEMO'?' Thanh toán mô phỏng, không có tiền thật.':''}`,tx);
 await audit(tx,actorId,'PAYMENT_SUCCESS',p.id,{amount:p.amount,method:p.method});return{...p,status:'SUCCESS',receivedAt};
}
export async function manualPayment(input:{householdId:string;chargeId?:string;campaignId?:string;amount:number;method:string;key:string;payer:string;reference?:string;receivedAt?:string},actorId:string){
 integer(input.amount);ensure(['CASH','TRANSFER'].includes(input.method),'Phương thức không hợp lệ');ensure(Boolean(input.chargeId)!==Boolean(input.campaignId),'Chọn đúng một khoản thu hoặc đợt đóng góp');
 const receivedAt=input.receivedAt?new Date(input.receivedAt):new Date();ensure(Number.isFinite(receivedAt.getTime())&&receivedAt<=new Date(),'Ngày nhận tiền không hợp lệ hoặc ở tương lai');
 return db.$transaction(async tx=>{
  await lock(tx,'finance:'+input.householdId);
  const existing=await tx.payment.findUnique({where:{key:input.key}});if(existing){ensure(existing.householdId===input.householdId&&existing.amount===input.amount&&existing.chargeId===(input.chargeId||null)&&existing.campaignId===(input.campaignId||null),'Mã yêu cầu đã dùng cho giao dịch khác',409);return existing;}
  if(input.campaignId){ensure(!input.chargeId,'Chỉ chọn khoản phí hoặc đợt đóng góp');const c=await tx.campaign.findUnique({where:{id:input.campaignId}});ensure(c&&c.start<=today()&&c.end>=today(),'Đợt đóng góp không mở');}
  else {const c=await tx.charge.findUnique({where:{id:input.chargeId}});ensure(c&&c.householdId===input.householdId&&c.status==='PUBLISHED','Khoản thu không hợp lệ');ensure(input.amount<=c.outstanding,'Không được nộp vượt số còn nợ');}
  const p=await tx.payment.create({data:{...input,receivedAt}});
  return acceptPayment(tx,p.id,actorId);
 });
}
export async function adjustCharge(id:string,type:string,amount:number,reason:string,actorId:string){
 integer(amount);ensure(reason.trim().length>=5,'Cần lý do ít nhất 5 ký tự');
 return db.$transaction(async tx=>{const initial=await tx.charge.findUniqueOrThrow({where:{id}});await lock(tx,'finance:'+initial.householdId);const c=await tx.charge.findUniqueOrThrow({where:{id}});ensure(c.status==='PUBLISHED','Chỉ xử lý khoản đã phát hành');
  const common={householdId:c.householdId,chargeId:id,amount,reason,actorId};
  if(type==='INCREASE'){await tx.charge.update({where:{id},data:{outstanding:{increment:amount}}});await entry(tx,{...common,type:'ADJUST_INCREASE'});await applyCredit(tx,c.householdId,actorId);}
  else if(type==='DECREASE'){
   const assessment=c.amount+((await tx.ledger.aggregate({where:{chargeId:id,type:'ADJUST_INCREASE'},_sum:{amount:true}}))._sum.amount??0)-((await tx.ledger.aggregate({where:{chargeId:id,type:'ADJUST_DECREASE'},_sum:{amount:true}}))._sum.amount??0);
   ensure(amount<=assessment-c.writtenOff,'Giảm vượt giá trị khoản thu còn hiệu lực');const reduction=Math.min(c.outstanding,amount);
   await tx.charge.update({where:{id},data:{outstanding:{decrement:reduction}}});await entry(tx,{...common,type:'ADJUST_DECREASE'});
   let release=amount-reduction;
   const allocations=await tx.ledger.findMany({where:{chargeId:id,type:'CREDIT_APPLIED'},orderBy:[{createdAt:'desc'},{id:'desc'}]});
   for(const a of allocations){if(!release)break;const n=Math.min(release,await remainingAllocation(tx,a));if(n>0){await releaseAllocation(tx,a,n,actorId);release-=n;}}
   ensure(release===0,'Phân bổ khoản thu không khớp; cần đối chiếu sổ');await applyCredit(tx,c.householdId,actorId);
  }
  else if(type==='WRITE_OFF'){ensure(amount<=c.outstanding,'Ghi giảm vượt nợ');await tx.charge.update({where:{id},data:{outstanding:{decrement:amount},writtenOff:{increment:amount}}});await entry(tx,{...common,type});}
  else if(type==='RESTORE'){ensure(amount<=c.writtenOff,'Khôi phục vượt khoản đã ghi giảm');await tx.charge.update({where:{id},data:{outstanding:{increment:amount},writtenOff:{decrement:amount}}});await entry(tx,{...common,type});await applyCredit(tx,c.householdId,actorId);}
  else ensure(false,'Loại điều chỉnh không hợp lệ');
  const event=await audit(tx,actorId,type,id,{amount,reason});await householdNotice(c.householdId,type,'adjust:'+event.id,'BlueMoon · Cập nhật khoản thu',`${c.name}: ${type}, ${amount.toLocaleString('vi-VN')} đ. Lý do: ${reason}`,tx);return tx.charge.findUniqueOrThrow({where:{id}});
 });
}
export async function cancelCharge(id:string,reason:string,actorId:string){ensure(reason.trim().length>=5,'Cần lý do');return db.$transaction(async tx=>{const initial=await tx.charge.findUniqueOrThrow({where:{id}});await lock(tx,'finance:'+initial.householdId);const c=await tx.charge.findUniqueOrThrow({where:{id}});const allocations=await tx.ledger.count({where:{chargeId:id,type:'CREDIT_APPLIED'}});ensure(!allocations,'Khoản đã có thanh toán phải điều chỉnh');ensure(c.status!=='CANCELLED','Khoản đã hủy');await tx.charge.update({where:{id},data:{status:'CANCELLED',outstanding:0,key:c.key+':cancelled:'+Date.now()}});await audit(tx,actorId,'CANCEL_CHARGE',id,{reason});});}
export async function cancelPayment(id:string,reason:string,actorId:string){
 ensure(reason.trim().length>=5,'Cần lý do');return db.$transaction(async tx=>{const initial=await tx.payment.findUniqueOrThrow({where:{id}});await lock(tx,'finance:'+initial.householdId);const p=await tx.payment.findUniqueOrThrow({where:{id}});ensure(p.status==='SUCCESS'&&!['VNPAY','DEMO'].includes(p.method)&&!p.refunded,'Chỉ hủy phiếu nhập tay thành công chưa hoàn tiền');
 if(!p.campaignId){const allocations=await tx.ledger.findMany({where:{householdId:p.householdId,paymentId:id,type:'CREDIT_APPLIED'},orderBy:[{createdAt:'desc'},{id:'desc'}]});
 for(const a of allocations){const n=await remainingAllocation(tx,a);if(n<=0)continue;await tx.charge.update({where:{id:a.chargeId!},data:{outstanding:{increment:n}}});await releaseAllocation(tx,a,n,actorId);}}
 if(!p.campaignId)await spendCredit(tx,p.householdId,p.amount,actorId,'RECEIPT_REVERSED',reason,undefined,id);else await entry(tx,{householdId:p.householdId,paymentId:id,type:'RECEIPT_REVERSED',amount:p.amount,reason,actorId});await tx.payment.update({where:{id},data:{status:'CANCELLED'}});await applyCredit(tx,p.householdId,actorId);await audit(tx,actorId,'CANCEL_PAYMENT',id,{reason});
 });
}
export async function refund(id:string,amount:number,reason:string,reference:string,actorId:string){integer(amount);ensure(reason.length>=5&&reference.trim(),'Cần lý do và tham chiếu hoàn tiền');return db.$transaction(async tx=>{const initial=await tx.payment.findUniqueOrThrow({where:{id}});await lock(tx,'finance:'+initial.householdId);const p=await tx.payment.findUniqueOrThrow({where:{id}});ensure(p.status==='SUCCESS'&&amount<=p.amount-p.refunded,'Hoàn vượt số tiền còn được hoàn');if(!p.campaignId){ensure(amount<=await credit(tx,p.householdId),'Chỉ hoàn số dư chưa phân bổ; điều chỉnh khoản thu trước nếu cần');await spendCredit(tx,p.householdId,amount,actorId,'REFUND',reason+' · '+reference,undefined,id);}else await entry(tx,{householdId:p.householdId,paymentId:id,type:'REFUND',amount,reason:reason+' · '+reference,actorId});await tx.payment.update({where:{id},data:{refunded:{increment:amount}}});await audit(tx,actorId,'REFUND',id,{amount,reason,reference});});}
