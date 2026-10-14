import {it,expect} from 'vitest';
import {vnpaySign,vnpayVerify} from '../server/vnpay.js';
it('R05 binds amount merchant and transaction to signature',()=>{const q={vnp_Amount:'12300',vnp_TmnCode:'merchant',vnp_TxnRef:'ref',vnp_ResponseCode:'00',vnp_TransactionStatus:'00'};const signed={...q,vnp_SecureHash:vnpaySign(q,'secret')};expect(vnpayVerify(signed,'secret')).toBe(true);expect(vnpayVerify({...signed,vnp_Amount:'12000'},'secret')).toBe(false);});
