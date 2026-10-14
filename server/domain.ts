import {Decimal} from 'decimal.js';
export class DomainError extends Error { constructor(public status:number,message:string){super(message);} }
export function ensure(condition:unknown,message:string,status=400):asserts condition {if(!condition)throw new DomainError(status,message);}
export const day=(s:string|Date)=>{const d=s instanceof Date?s:new Date(s+'T00:00:00Z');ensure(!Number.isNaN(d.getTime())&&(s instanceof Date||(/^\d{4}-\d{2}-\d{2}$/.test(s)&&d.toISOString().slice(0,10)===s)),'Ngày không hợp lệ');return d;};
export const iso=(d:Date)=>d.toISOString().slice(0,10);
export const addDays=(d:Date,n:number)=>new Date(d.getTime()+n*86400000);
export const today=()=>day(new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date()));
export const days=(a:Date,b:Date)=>Math.max(0,Math.round((b.getTime()-a.getTime())/86400000));
export function monthBounds(month:string){ensure(/^\d{4}-(0[1-9]|1[0-2])$/.test(month),'Tháng không hợp lệ');const start=day(month+'-01');const end=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,1));return{start,end,length:days(start,end)};}
export function roundMoney(amount:Decimal.Value){return new Decimal(amount).toDecimalPlaces(0,Decimal.ROUND_HALF_UP).toNumber();}
export function prorate(rate:Decimal.Value,quantity:Decimal.Value,start:Date,end:Date,length:number){return new Decimal(rate).times(quantity).times(days(start,end)).div(length);}
export function integer(value:unknown,label='Số tiền'){const n=Number(value);ensure(Number.isSafeInteger(n)&&n>0&&n<=2000000000,`${label} phải là số nguyên dương hợp lệ`);return n;}
export function overlap(a:Date,b:Date|null,c:Date,d:Date|null){return a<(d??day('9999-12-31'))&&c<(b??day('9999-12-31'));}
