import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {createHmac,createHash,randomUUID} from 'node:crypto';
import {signEnvelope,verifyEnvelope} from '../server/bridge.js';

function bridge(){
 const secret='local-bridge-test-secret-32-characters';const props:Record<string,string>={BRIDGE_SECRET:secret,EMAIL_ALLOWLIST:'allowed@example.com',JOURNAL_ID:'test-sheet'};
 const rows:unknown[][]=[['id','hash','status','updatedAt','detail']];let sent=0,quota=100,fail=false;
 const range=(row:number,col:number,count=1,width=1)=>({setValues(values:unknown[][]){values.forEach((v,i)=>{rows[row-1+i]??=[];v.forEach((x,j)=>rows[row-1+i][col-1+j]=x);});return this;},getValues(){return rows.slice(row-1,row-1+count).map(r=>r.slice(col-1,col-1+width));},createTextFinder(text:string){return{matchEntireCell(){return this;},findNext(){const i=rows.findIndex(r=>r[0]===text);return i<0?null:{getRow:()=>i+1};}};}});
 const sheet={getLastRow:()=>rows.length,getRange:range,appendRow:(row:unknown[])=>rows.push(row)};
 const context=createContext({
  Date,JSON,Math,Number,String,Error,RegExp,
  PropertiesService:{getScriptProperties:()=>({getProperty:(key:string)=>props[key]??null,setProperty:(k:string,v:string)=>{props[k]=v;},getProperties:()=>({...props}),deleteProperty:(key:string)=>{delete props[key];}})},
  Utilities:{Charset:{UTF_8:'UTF-8'},DigestAlgorithm:{SHA_256:'SHA256'},getUuid:randomUUID,computeHmacSha256Signature:(value:string,key:string)=>[...createHmac('sha256',key).update(value).digest()],computeDigest:(_type:string,value:string)=>[...createHash('sha256').update(value).digest()]},
  LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
  SpreadsheetApp:{openById:()=>({getSheets:()=>[sheet]}),flush(){}},
  MailApp:{getRemainingDailyQuota:()=>quota,sendEmail(){sent++;if(fail)throw new Error('Unknown provider result');}},
  ContentService:{MimeType:{JSON:'application/json'},createTextOutput:(text:string)=>({setMimeType:()=>text})},
 });
 runInContext(readFileSync('integrations/apps-script/Code.gs','utf8'),context);
 const call=(data:object,nonce=randomUUID())=>{const envelope=signEnvelope(data,secret,Date.now(),nonce);const text=context.doPost({postData:{contents:JSON.stringify(envelope)}});const response=JSON.parse(text);expect(verifyEnvelope(response,secret)).toBe(true);return JSON.parse(response.payload);};
 return{call,context,rows,secret,sent:()=>sent,quota:(value:number)=>{quota=value;},fail:()=>{fail=true;}};
}
const mail={action:'send',id:'test-notification',to:'allowed@example.com',subject:'BlueMoon test',body:'Test message'};
it('R06 Apps Script accepts once, validates digest on id reuse and rejects replay',()=>{
 const b=bridge(),nonce=randomUUID();expect(b.call(mail,nonce).status).toBe('ACCEPTED');expect(b.call(mail).status).toBe('ACCEPTED');expect(b.sent()).toBe(1);
 expect(b.call({...mail,body:'Changed'}).status).toBe('REJECTED');expect(b.call(mail,nonce).status).toBe('REJECTED');
 expect(b.call({...mail,id:'blocked',to:'other@example.com'}).status).toBe('REJECTED');
});
it('R06 Apps Script quota is retryable and ambiguous send never auto-resends',()=>{
 const b=bridge();b.quota(0);expect(b.call(mail).status).toBe('QUOTA');expect(b.sent()).toBe(0);
 b.quota(100);b.fail();expect(b.call(mail).status).toBe('UNKNOWN');expect(b.call(mail).status).toBe('UNKNOWN');expect(b.sent()).toBe(1);
});
