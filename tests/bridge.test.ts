import {it,expect} from 'vitest';
import {signEnvelope,verifyEnvelope} from '../server/bridge.js';
it('R06 signed payload is bound to content and expiry',()=>{
 const envelope=signEnvelope({action:'send',id:'1'},'secret',100000,'nonce');
 expect(verifyEnvelope(envelope,'secret',100001)).toBe(true);
 expect(verifyEnvelope({...envelope,payload:'tampered'},'secret',100001)).toBe(false);
 expect(verifyEnvelope(envelope,'secret',500001)).toBe(false);
});
it('R06 rejects non-finite timestamps even with a valid signature',()=>{
 const envelope=signEnvelope({action:'send'},'secret',NaN,'nonce');
 expect(verifyEnvelope(envelope,'secret')).toBe(false);
 expect(verifyEnvelope(signEnvelope({},'secret',Date.now(),'x'.repeat(10000)),'secret')).toBe(false);
});
