import {db} from './db.js';
import {monthBounds,day,today,ensure} from './domain.js';
export async function report(filter:{month?:string;quarter?:string;householdId?:string}={}){
 let start:Date|undefined,end:Date|undefined;
 if(filter.month){const b=monthBounds(filter.month);start=b.start;end=b.end;}
 if(filter.quarter){ensure(/^\d{4}-Q[1-4]$/.test(filter.quarter),'Quý không hợp lệ');const[y,q]=filter.quarter.split('-Q');start=new Date(Date.UTC(+y,(+q-1)*3,1));end=new Date(Date.UTC(+y,+q*3,1));}
 const householdId=filter.householdId;const charges=await db.charge.findMany({where:{householdId,status:'PUBLISHED',...(start&&end?{start:{gte:start,lt:end}}:{})},include:{household:true,apartment:true,ledger:true},orderBy:[{due:'asc'},{id:'asc'}]});
 const rows=charges.map(c=>{const sum=(type:string)=>c.ledger.filter(l=>l.type===type).reduce((s,l)=>s+l.amount,0);const increase=sum('ADJUST_INCREASE'),decrease=sum('ADJUST_DECREASE'),allocated=sum('CREDIT_APPLIED')-sum('ALLOCATION_REVERSED');return{id:c.id,household:c.household.name,householdId:c.householdId,apartment:c.apartment.code,name:c.name,due:c.due,original:c.amount,increase,decrease,assessment:c.amount+increase-decrease,allocated,writtenOff:c.writtenOff,outstanding:c.outstanding};});
 const timestampRange=start&&end?{gte:new Date(start.getTime()-7*3600000),lt:new Date(end.getTime()-7*3600000)}:undefined;
 const receiptRows=await db.payment.findMany({where:{householdId,receivedAt:timestampRange},include:{household:true,campaign:true},orderBy:{receivedAt:'desc'}});
 const movements=await db.ledger.findMany({where:{householdId,createdAt:timestampRange},include:{household:true},orderBy:{createdAt:'desc'}});
 const householdCredits=await db.ledger.groupBy({by:['householdId'],where:{householdId},_sum:{creditDelta:true}});
 const households=await db.household.findMany({where:{id:householdId},select:{id:true,name:true,code:true,difficult:true}});
 const creditRows=households.map(h=>({...h,credit:householdCredits.find(c=>c.householdId===h.id)?._sum.creditDelta??0}));
 const sum=(key:'assessment'|'allocated'|'writtenOff'|'outstanding')=>rows.reduce((s,c)=>s+c[key],0);
 return{rows,receipts:receiptRows,movements,credits:creditRows,summary:{assessment:sum('assessment'),allocated:sum('allocated'),writtenOff:sum('writtenOff'),outstanding:sum('outstanding'),overdue:rows.filter(c=>c.due<today()).reduce((s,c)=>s+c.outstanding,0),receipts:receiptRows.filter(p=>p.status==='SUCCESS').reduce((s,p)=>s+p.amount,0),contributions:receiptRows.filter(p=>p.status==='SUCCESS'&&p.campaignId).reduce((s,p)=>s+p.amount,0),refunds:movements.filter(m=>m.type==='REFUND').reduce((s,m)=>s+m.amount,0),credit:creditRows.reduce((s,h)=>s+h.credit,0)},period:{start,end},note:'Phải thu/còn nợ phản ánh trạng thái hiện tại của các khoản trong kỳ. Tiền nhận theo ngày nhận tiền; biến động theo thời điểm ghi sổ. Phân bổ số dư không phải tiền thực nhận mới.'};
}
