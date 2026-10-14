import bcrypt from 'bcryptjs';
import {db} from './db.js';
import {day,monthBounds} from './domain.js';
import {calculateCharge,publishCharges} from './billing.js';
import {manualPayment,adjustCharge,acceptPayment,audit} from './finance.js';
import type {Prisma} from '@prisma/client';

const seedTarget='bluemoon-demo-v1';
const start=day('2026-04-01');
const kinds=[['Phí quản lý','AREA','8000'],['Phí an ninh','FIXED','150000'],['Phí vệ sinh','PERSON','30000'],['Phí gửi xe','VEHICLE','0'],['Tiền điện','ELECTRICITY','3000'],['Tiền nước','WATER','15000']] as const;

// Resume missing steps only. Existing users, histories, snapshots and QA edits stay intact.
async function seed(){
 if(await db.audit.findFirst({where:{action:'SEED_COMPLETE',target:seedTarget}})){console.log('Demo v1 đã hoàn tất; giữ nguyên mọi thay đổi sau đó.');return;}
 const password=await bcrypt.hash('BlueMoon2026!',12);
 const admin=await staff('manager','0900000001','Nguyễn Minh Anh','MANAGER',password);
 await staff('accountant','0900000002','Trần Thu Hà','ACCOUNTANT',password);
 const names=['Nguyễn Hoàng Nam','Trần Ngọc Mai','Lê Minh Khang','Phạm Thu Trang','Vũ Đức Anh','Đặng Bảo Ngọc','Bùi Quang Huy','Đỗ Thanh Thảo','Ngô Gia Bảo','Dương Linh Chi'];
 const apartmentIds:string[]=[],householdIds:string[]=[];
 for(let i=1;i<=30;i++){
  const code=`A${String(Math.floor((i-1)/5)+1).padStart(2,'0')}${String((i-1)%5+1).padStart(2,'0')}`;
  const a=await db.apartment.upsert({where:{code},create:{id:`seed-apartment-${i}`,code,floor:Math.floor((i-1)/5)+1,area:55+(i%5)*12.5},update:{}});apartmentIds.push(a.id);
  if(i===28||i===30)continue;
  const h=await db.household.upsert({where:{code:'H'+String(i).padStart(3,'0')},create:{id:`seed-household-${i}`,code:'H'+String(i).padStart(3,'0'),name:names[(i-1)%10]+(i>10?' '+String(i):''),phone:'091'+String(i).padStart(7,'0')},update:{}});householdIds.push(h.id);
  await db.headcount.upsert({where:{householdId_effective:{householdId:h.id,effective:start}},create:{householdId:h.id,count:2+i%4,effective:start},update:{}});
  if(!await db.occupancy.count({where:{householdId:h.id}}))await db.occupancy.upsert({where:{id:`seed-occupancy-${i}`},create:{id:`seed-occupancy-${i}`,householdId:h.id,apartmentId:a.id,start:day(i===29?'2026-07-12':'2026-04-01'),end:i===27?day('2026-08-15'):null},update:{}});
  await db.user.upsert({where:{householdId:h.id},create:{id:`seed-resident-${i}`,name:h.name,email:i===1?'resident@bluemoon.local':`resident${i}@bluemoon.local`,phone:h.phone,password,role:'RESIDENT',householdId:h.id,verified:true,mustChange:false},update:{}});
  await db.vehicle.upsert({where:{plate:`29-BM-${String(i).padStart(4,'0')}`},create:{householdId:h.id,plate:`29-BM-${String(i).padStart(4,'0')}`,type:'MOTORBIKE',start},update:{}});
  if(i%3===0)await db.vehicle.upsert({where:{plate:`30A-${String(i).padStart(5,'0')}`},create:{householdId:h.id,plate:`30A-${String(i).padStart(5,'0')}`,type:'CAR',start:day('2026-05-15')},update:{}});
  if(i%5===0)await db.vehicle.upsert({where:{plate:`XD-${i}`},create:{householdId:h.id,plate:`XD-${i}`,type:'BICYCLE',start,end:i===5?day('2026-07-20'):null},update:{}});
  if(i===2)await db.headcount.upsert({where:{householdId_effective:{householdId:h.id,effective:day('2026-07-15')}},create:{householdId:h.id,count:5,effective:day('2026-07-15')},update:{}});
 }
 const newH=await db.household.upsert({where:{code:'H031'},create:{id:'seed-household-31',code:'H031',name:'Trịnh Khánh Linh',phone:'0910000031'},update:{}});householdIds.push(newH.id);
 await db.headcount.upsert({where:{householdId_effective:{householdId:newH.id,effective:day('2026-08-15')}},create:{householdId:newH.id,count:3,effective:day('2026-08-15')},update:{}});
 if(!await db.occupancy.count({where:{householdId:newH.id}}))await db.occupancy.upsert({where:{id:'seed-occupancy-31'},create:{id:'seed-occupancy-31',householdId:newH.id,apartmentId:apartmentIds[26],start:day('2026-08-15')},update:{}});
 await db.user.upsert({where:{householdId:newH.id},create:{id:'seed-resident-31',name:newH.name,email:'resident31@bluemoon.local',phone:newH.phone,password,role:'RESIDENT',householdId:newH.id,verified:true,mustChange:false},update:{}});
 const feeIds:string[]=[];
 for(const[name,kind,amount]of kinds){
  const f=await db.fee.findFirst({where:{name,kind}})??await db.fee.upsert({where:{id:`seed-fee-${kind.toLowerCase()}`},create:{id:`seed-fee-${kind.toLowerCase()}`,name,kind},update:{}});feeIds.push(f.id);
  if(kind==='VEHICLE')for(const[type,price]of [['BICYCLE','20000'],['MOTORBIKE','100000'],['CAR','1200000']])await db.rate.upsert({where:{feeId_effective_vehicleType:{feeId:f.id,effective:start,vehicleType:type}},create:{feeId:f.id,amount:price,effective:start,vehicleType:type},update:{}});
  else await db.rate.upsert({where:{feeId_effective_vehicleType:{feeId:f.id,effective:start,vehicleType:''}},create:{feeId:f.id,amount,effective:start},update:{}});
 }
 for(let i=0;i<apartmentIds.length;i++){
  const apartmentId=apartmentIds[i];
  for(let m=4;m<=10;m++)for(const[kind,base,step]of [['ELECTRICITY',1000,120+i%9*10],['WATER',100,8+i%5]] as const){const date=day(`2026-${String(m).padStart(2,'0')}-01`);await db.reading.upsert({where:{apartmentId_kind_date:{apartmentId,kind,date}},create:{apartmentId,kind,date,value:base+(m-4)*step},update:{}});}
  if(i===26)for(const[kind,value]of [['ELECTRICITY',1890],['WATER',141]] as const)await db.reading.upsert({where:{apartmentId_kind_date:{apartmentId,kind,date:day('2026-08-15')}},create:{apartmentId,kind,date:day('2026-08-15'),value},update:{}});
  if(i===28)for(const[kind,value]of [['ELECTRICITY',1408],['WATER',135]] as const)await db.reading.upsert({where:{apartmentId_kind_date:{apartmentId,kind,date:day('2026-07-12')}},create:{apartmentId,kind,date:day('2026-07-12'),value},update:{}});
 }
 // Only repair the exact legacy demo typo, and only before any August utility publication.
 const legacy=await db.reading.findUnique({where:{apartmentId_kind_date:{apartmentId:apartmentIds[26],kind:'ELECTRICITY',date:day('2026-08-15')}}});
 if(legacy?.value.equals(1542)&&!await db.charge.count({where:{apartmentId:apartmentIds[26],fee:{kind:'ELECTRICITY'},period:{month:'2026-08'},status:'PUBLISHED'}}))await db.$transaction(async tx=>{const change=await tx.reading.updateMany({where:{id:legacy.id,value:1542},data:{value:1890}});if(change.count)await audit(tx,admin.id,'SEED_REPAIR',legacy.id,{from:1542,to:1890,reason:'Invalid original demo handover reading; no published August utility.'});});
 const fees=await db.fee.findMany({where:{id:{in:feeIds}},include:{rates:true}});
 const occupancies=await db.occupancy.findMany({where:{householdId:{in:householdIds}},include:{apartment:{include:{readings:true}},household:{include:{counts:true,vehicles:true}}}});
 const blocked:string[]=[];const periodCounts:Record<string,number>={};
 for(let m=4;m<=9;m++){
  const month=`2026-${String(m).padStart(2,'0')}`,bounds=monthBounds(month),period=await db.period.upsert({where:{month},create:{month,due:day(month+'-20')},update:{}}),planned:string[]=[];
  for(const o of occupancies){if(o.start>=bounds.end||o.end&&o.end<=bounds.start)continue;const from=o.start>bounds.start?o.start:bounds.start,to=o.end&&o.end<bounds.end?o.end:bounds.end;
   for(const f of fees){if(!f.active||f.apartmentIds.length&&!f.apartmentIds.includes(o.apartmentId))continue;const key=`${period.id}:${f.id}:${o.id}`;
    const old=await db.charge.findFirst({where:{OR:[{key},{periodId:period.id,feeId:f.id,householdId:o.householdId,apartmentId:o.apartmentId,start:from,end:to,status:'CANCELLED'}]}});
    if(old){if(old.status!=='CANCELLED')planned.push(old.id);continue;}
    try{const result=calculateCharge({kind:f.kind,rates:f.rates.map(r=>({...r,amount:r.amount.toString()})),start:from,end:to,length:bounds.length,area:o.apartment.area.toString(),counts:o.household.counts,vehicles:o.household.vehicles,readings:o.apartment.readings.filter(r=>r.kind===f.kind).map(r=>({...r,value:r.value.toString()}))});if(!result.amount)continue;
     const c=await db.charge.upsert({where:{key},create:{key,householdId:o.householdId,apartmentId:o.apartmentId,feeId:f.id,periodId:period.id,name:f.name+' · '+month,amount:result.amount,outstanding:result.amount,start:from,end:to,due:period.due,snapshot:{...result,apartment:o.apartment.code,household:o.household.name,kind:f.kind,length:bounds.length} as Prisma.InputJsonValue},update:{}});planned.push(c.id);
    }catch(e){blocked.push(`${month} ${o.apartment.code} ${f.name}: ${(e as Error).message}`);}
   }
  }
  const drafts=await db.charge.findMany({where:{id:{in:planned},status:'DRAFT'},orderBy:{id:'asc'}});
  for(const householdId of [...new Set(drafts.map(c=>c.householdId))])try{await publishCharges(drafts.filter(c=>c.householdId===householdId).map(c=>c.id),admin.id);}catch(e){blocked.push(`${month} ${householdId}: ${(e as Error).message}`);}
  const published=await db.charge.findMany({where:{id:{in:planned},status:'PUBLISHED'},include:{household:true,fee:true},orderBy:[{householdId:'asc'},{feeId:'asc'}]});
  for(const c of published){
   const key=`seed:${c.id}`;if(await db.payment.findUnique({where:{key}})||await db.ledger.count({where:{chargeId:c.id}}))continue;
   const code=Number(c.household.code.replace(/^H/,''));if(c.household.code!=='H002'&&(code%9===0||m===9&&['ELECTRICITY','WATER'].includes(c.fee.kind)))continue;
   const amount=c.household.code!=='H002'&&m===9&&c.fee.kind==='FIXED'?Math.floor(c.outstanding/2):c.outstanding;if(amount<=0)continue;
   await manualPayment({householdId:c.householdId,chargeId:c.id,amount,method:code%2?'CASH':'TRANSFER',key,payer:c.household.name,reference:'DEMO-'+c.id.slice(-6),receivedAt:`${month}-18T03:00:00.000Z`},admin.id);
  }
  periodCounts[month]=published.length;if(!published.length)blocked.push(`${month}: không có khoản demo đã phát hành; chưa thể xác nhận seed hoàn tất.`);console.log(`Demo ${month}: ${published.length} khoản phát hành.`);
 }
 const creditH=await db.household.findUniqueOrThrow({where:{code:'H002'}}),decreaseReason='Điều chỉnh phí minh họa đã nộp';
 if(!await db.ledger.count({where:{householdId:creditH.id,type:'ADJUST_DECREASE',reason:decreaseReason}})){const c=await db.charge.findFirst({where:{householdId:creditH.id,status:'PUBLISHED',outstanding:0,amount:{gte:20000}},orderBy:{due:'asc'}});if(c)await adjustCharge(c.id,'DECREASE',20000,decreaseReason,admin.id);}
 const oldH=await db.household.findUniqueOrThrow({where:{code:'H027'}}),writeOffReason='Ghi giảm khoản không thu hồi minh họa';
 if(!await db.ledger.count({where:{householdId:oldH.id,type:'WRITE_OFF',reason:writeOffReason}})){const old=await db.charge.findFirst({where:{householdId:oldH.id,outstanding:{gt:0},status:'PUBLISHED'},orderBy:{due:'asc'}});if(old){await db.household.updateMany({where:{id:oldH.id,note:''},data:{difficult:true,note:'Đã chuyển đi; nợ khó thu minh họa'}});await adjustCharge(old.id,'WRITE_OFF',Math.min(old.outstanding,50000),writeOffReason,admin.id);}}
 const campaign=await db.campaign.findFirst({where:{name:'Quỹ Trung thu BlueMoon 2026'}})??await db.campaign.upsert({where:{id:'seed-campaign-midautumn-2026'},create:{id:'seed-campaign-midautumn-2026',name:'Quỹ Trung thu BlueMoon 2026',description:'Cùng góp sức tổ chức một đêm hội ấm áp cho các em nhỏ. Mọi đóng góp đều tự nguyện.',start:day('2026-09-01'),end:day('2026-10-31')},update:{}});
 const resident=await db.household.findUniqueOrThrow({where:{code:'H001'}}),donation=await db.payment.upsert({where:{key:'seed:contribution:h001:midautumn'},create:{key:'seed:contribution:h001:midautumn',householdId:resident.id,campaignId:campaign.id,amount:100000,method:'CASH',payer:resident.name,reference:'DEMO-CONTRIBUTION',receivedAt:new Date('2026-09-18T03:00:00Z')},update:{}});
 if(donation.status==='PENDING')await db.$transaction(tx=>acceptPayment(tx,donation.id,admin.id));
 const residentUser=await db.user.findUnique({where:{householdId:resident.id}});
 await db.notification.upsert({where:{key:'seed:welcome'},create:{key:'seed:welcome',householdId:resident.id,recipient:residentUser?.email??'resident@bluemoon.local',channel:'EMAIL',kind:'WELCOME',subject:'Chào mừng đến với BlueMoon',body:'Tra cứu phí, lịch sử thanh toán và thông báo của hộ ngay tại cổng cư dân.',status:'NOT_CONFIGURED',error:'Dữ liệu mẫu; chưa gửi email thật'},update:{}});
 await db.notification.upsert({where:{key:'seed:sms'},create:{key:'seed:sms',householdId:resident.id,recipient:resident.phone,channel:'SMS',kind:'WELCOME',subject:'Chào mừng BlueMoon',body:'SMS minh họa. Không gửi tới điện thoại.',status:'SIMULATED'},update:{}});
 if(blocked.length){console.warn(blocked.join('\n'));throw new Error('Seed chưa hoàn tất; giữ dữ liệu đã sửa và chưa ghi completion marker. Bổ sung các dữ liệu được nêu rồi chạy lại.');}
 const counts={apartments:apartmentIds.length,households:householdIds.length,periods:6,periodCounts,charges:await db.charge.count({where:{householdId:{in:householdIds},feeId:{in:feeIds},period:{month:{gte:'2026-04',lte:'2026-09'}},status:'PUBLISHED'}})};
 await db.audit.create({data:{actorId:admin.id,action:'SEED_COMPLETE',target:seedTarget,detail:counts}});
 console.log(`Seed hoàn tất: ${counts.apartments} căn, 6 tháng, ${counts.charges} khoản. Mật khẩu demo ban đầu BlueMoon2026!; tài khoản/mật khẩu đã đổi được giữ nguyên.`);
}
async function staff(handle:string,phone:string,name:string,role:string,password:string){const old=await db.user.findFirst({where:{OR:[{email:handle+'@bluemoon.local'},{phone},{id:'seed-'+handle}]}});return old??db.user.upsert({where:{email:handle+'@bluemoon.local'},create:{id:'seed-'+handle,name,email:handle+'@bluemoon.local',phone,password,role,verified:true,mustChange:false},update:{}});}
seed().then(()=>db.$disconnect()).catch(async e=>{console.error(e instanceof Error?e.message:e);await db.$disconnect();process.exit(1);});
