import {Decimal} from 'decimal.js';
import {isDeepStrictEqual} from 'node:util';
import type {Prisma} from '@prisma/client';
import {db} from './db.js';
import {day,iso,monthBounds,ensure,prorate,roundMoney} from './domain.js';
import {lock,audit,applyCredit} from './finance.js';
import {householdNotice} from './notifications.js';
type CalcInput={kind:string;rates:{amount:Decimal.Value;effective:Date;vehicleType:string}[];start:Date;end:Date;length:number;area:Decimal.Value;counts:{count:number;effective:Date}[];vehicles:{type:string;start:Date;end:Date|null;plate?:string}[];readings:{date:Date;value:Decimal.Value}[]};
export function calculateCharge(input:CalcInput){
 const {kind,start,end,length}=input;let total=new Decimal(0);const segments:object[]=[];
 const utility=['ELECTRICITY','WATER'].includes(kind);
 const boundaries=[start,end,...input.rates.map(r=>r.effective),...(!utility&&kind==='PERSON'?input.counts.map(c=>c.effective):[]),...(!utility&&kind==='VEHICLE'?input.vehicles.flatMap(v=>[v.start,...v.end?[v.end]:[]]):[])].filter(d=>d>=start&&d<=end);
 const dates=[...new Set(boundaries.map(iso))].sort().map(day);
 for(let i=0;i<dates.length-1;i++){const a=dates[i],b=dates[i+1];
  const add=(type:string,quantity:Decimal.Value)=>{const rate=input.rates.filter(r=>r.effective<=a&&r.vehicleType===type).sort((x,y)=>y.effective.getTime()-x.effective.getTime())[0];ensure(rate,'Thiếu đơn giá có hiệu lực');const value=prorate(rate.amount,quantity,a,b,length);total=total.plus(value);segments.push({from:iso(a),to:iso(b),rate:String(rate.amount),quantity:String(quantity),unrounded:value.toString(),vehicleType:type});};
  if(['ELECTRICITY','WATER'].includes(kind)){
   const rate=input.rates.filter(r=>r.effective<=a).sort((x,y)=>y.effective.getTime()-x.effective.getTime())[0];ensure(rate,'Thiếu đơn giá có hiệu lực');
   const first=input.readings.find(r=>iso(r.date)===iso(a)),last=input.readings.find(r=>iso(r.date)===iso(b));ensure(first&&last,`Thiếu chỉ số tại ${iso(a)} hoặc ${iso(b)}`);const usage=new Decimal(last.value).minus(first.value);ensure(usage.gte(0),'Chỉ số giảm');const value=usage.times(rate.amount);total=total.plus(value);segments.push({from:iso(a),to:iso(b),begin:String(first.value),finish:String(last.value),usage:usage.toString(),rate:String(rate.amount),unrounded:value.toString()});
  }else if(kind==='VEHICLE'){
   for(const type of ['BICYCLE','MOTORBIKE','CAR']){const quantity=input.vehicles.filter(v=>v.type===type&&v.start<=a&&(!v.end||v.end>a)).length;if(quantity)add(type,quantity);}
  }else if(kind==='PERSON'){const count=input.counts.filter(c=>c.effective<=a).sort((x,y)=>y.effective.getTime()-x.effective.getTime())[0];ensure(count,'Thiếu số người có hiệu lực');add('',count.count);}
  else add('',kind==='AREA'?input.area:1);
 }
 const amount=roundMoney(total);ensure(amount<=2000000000,'Khoản phí vượt giới hạn');return{amount,segments};
}
export async function generatePeriod(month:string,due:string,actorId:string){
 const {start,end,length}=monthBounds(month);const dueDate=day(due);
 return db.$transaction(async tx=>{
  await lock(tx,'domain');await lock(tx,'billing:'+month);
  const period=await tx.period.upsert({where:{month},create:{month,due:dueDate},update:{due:dueDate}});
  const fees=await tx.fee.findMany({where:{active:true},include:{rates:true}});
  const occupancies=await tx.occupancy.findMany({where:{start:{lt:end},OR:[{end:null},{end:{gt:start}}]},include:{apartment:{include:{readings:true}},household:{include:{counts:true,vehicles:true}}}});
  const blocked:{apartment:string;household:string;fee:string;reason:string}[]=[];let drafts=0;const validKeys:string[]=[];
  for(const o of occupancies){const a=o.start>start?o.start:start,b=o.end&&o.end<end?o.end:end;
   for(const f of fees){if(f.apartmentIds.length&&!f.apartmentIds.includes(o.apartmentId))continue;
    const key=`${period.id}:${f.id}:${o.id}`;const existing=await tx.charge.findUnique({where:{key}});if(existing&&existing.status!=='DRAFT')continue;
    try{const result=calculateCharge({kind:f.kind,rates:f.rates.map(r=>({...r,amount:r.amount.toString()})),start:a,end:b,length,area:o.apartment.area.toString(),counts:o.household.counts,vehicles:o.household.vehicles,readings:o.apartment.readings.filter(r=>r.kind===f.kind).map(r=>({...r,value:r.value.toString()}))});if(!result.amount)continue;
     const data={householdId:o.householdId,apartmentId:o.apartmentId,feeId:f.id,periodId:period.id,name:f.name+' · '+month,amount:result.amount,outstanding:result.amount,start:a,end:b,due:period.due,snapshot:{...result,apartment:o.apartment.code,household:o.household.name,kind:f.kind,length} as Prisma.InputJsonValue};
     await tx.charge.upsert({where:{key},create:{key,...data},update:data});validKeys.push(key);drafts++;
    }catch(e){blocked.push({apartment:o.apartment.code,household:o.household.name,fee:f.name,reason:(e as Error).message});}
   }
  }
  await tx.charge.deleteMany({where:{periodId:period.id,status:'DRAFT',key:{notIn:validKeys}}});await audit(tx,actorId,'GENERATE_PERIOD',period.id,{drafts,blocked});return{period,drafts,blocked};
 },{timeout:60000});
}
export async function publishCharges(ids:string[],actorId:string){ensure(ids.length>0&&ids.length<=500,'Chọn 1–500 khoản để phát hành');return db.$transaction(async tx=>{
 await lock(tx,'domain');await lock(tx,'publish');const charges=await tx.charge.findMany({where:{id:{in:ids},status:'DRAFT'},include:{fee:{include:{rates:true}},apartment:{include:{readings:true}},household:{include:{counts:true,vehicles:true}},period:true}});ensure(charges.length===ids.length,'Có khoản không còn là bản nháp');
 for(const c of charges){const o=await tx.occupancy.findUnique({where:{id:c.key.split(':')[2]}});ensure(o&&c.fee.active&&(!c.fee.apartmentIds.length||c.fee.apartmentIds.includes(c.apartmentId)),'Dữ liệu đã thay đổi. Hãy lập lại nháp.');const bounds=monthBounds(c.period.month);const start=o.start>bounds.start?o.start:bounds.start;const end=o.end&&o.end<bounds.end?o.end:bounds.end;ensure(start<end&&iso(start)===iso(c.start)&&iso(end)===iso(c.end),'Ngày cư trú đã đổi. Hãy lập lại nháp.');const result=calculateCharge({kind:c.fee.kind,rates:c.fee.rates.map(r=>({...r,amount:r.amount.toString()})),start,end,length:bounds.length,area:c.apartment.area.toString(),counts:c.household.counts,vehicles:c.household.vehicles,readings:c.apartment.readings.filter(r=>r.kind===c.fee.kind).map(r=>({...r,value:r.value.toString()}))});ensure(result.amount===c.amount&&isDeepStrictEqual(result.segments,(c.snapshot as {segments:object[]}).segments),'Cách tính đã đổi. Hãy lập lại nháp.');}
 for(const householdId of [...new Set(charges.map(c=>c.householdId))].sort())await lock(tx,'finance:'+householdId);
 await tx.charge.updateMany({where:{id:{in:ids}},data:{status:'PUBLISHED'}});
 for(const h of [...new Set(charges.map(c=>c.householdId))]){await applyCredit(tx,h,actorId);const list=charges.filter(c=>c.householdId===h);await householdNotice(h,'PUBLISHED','published:'+list.map(c=>c.id).sort().join('-'),'BlueMoon · Thông báo khoản thu',list.map(c=>`${c.name}: ${c.amount.toLocaleString('vi-VN')} đ`).join('\n'),tx);}
 await audit(tx,actorId,'PUBLISH',ids.join(','),{count:ids.length});return charges;
 },{timeout:60000});}
