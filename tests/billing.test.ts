import {it,expect} from 'vitest';
import {calculateCharge} from '../server/billing.js';
import {day} from '../server/domain.js';
const rate=(amount:string,effective:string,vehicleType='')=>({amount,effective:day(effective),vehicleType});
it('R03 area rate split and final rounding across January',()=>{
 const result=calculateCharge({kind:'AREA',rates:[rate('1000','2026-01-01'),rate('2000','2026-01-16')],start:day('2026-01-01'),end:day('2026-02-01'),length:31,area:'50',counts:[],vehicles:[],readings:[]});
 expect(result.amount).toBe(75806);
});
it('R03 person history changes effective mid-month',()=>{
 expect(calculateCharge({kind:'PERSON',rates:[rate('31000','2026-01-01')],start:day('2026-01-01'),end:day('2026-02-01'),length:31,area:'1',counts:[{count:2,effective:day('2026-01-01')},{count:3,effective:day('2026-01-16')}],vehicles:[],readings:[]}).amount).toBe(78000);
});
it('R03 missing exact handover meter boundary blocks utility only',()=>{
 expect(()=>calculateCharge({kind:'WATER',rates:[rate('10000','2026-01-01')],start:day('2026-01-15'),end:day('2026-02-01'),length:31,area:'1',counts:[],vehicles:[],readings:[{date:day('2026-01-01'),value:'20'},{date:day('2026-02-01'),value:'30'}]})).toThrow('Thiếu chỉ số');
});
it('R03 utility is consumption not days prorated',()=>{
 expect(calculateCharge({kind:'ELECTRICITY',rates:[rate('3000','2026-01-01')],start:day('2026-01-15'),end:day('2026-02-01'),length:31,area:'1',counts:[],vehicles:[],readings:[{date:day('2026-01-15'),value:'100'},{date:day('2026-02-01'),value:'120'}]}).amount).toBe(60000);
});
it('R03 utility ignores person/vehicle changes but needs readings at tariff changes',()=>{
 const result=calculateCharge({kind:'ELECTRICITY',rates:[rate('3000','2026-01-01'),rate('4500','2026-01-15')],start:day('2026-01-01'),end:day('2026-02-01'),length:31,area:'50',counts:[{count:3,effective:day('2026-01-20')}],vehicles:[{type:'CAR',start:day('2026-01-10'),end:null}],readings:[{date:day('2026-01-01'),value:'100'},{date:day('2026-01-15'),value:'120'},{date:day('2026-02-01'),value:'130'}]});
 expect(result.amount).toBe(105000);expect(result.segments).toHaveLength(2);
});
it('R03 vehicle types prorate independently through a leap February and exclude ending date',()=>{
 expect(calculateCharge({kind:'VEHICLE',rates:[rate('2900','2024-02-01','CAR'),rate('290','2024-02-01','MOTORBIKE')],start:day('2024-02-01'),end:day('2024-03-01'),length:29,area:'1',counts:[],vehicles:[{type:'CAR',start:day('2024-02-10'),end:day('2024-02-20')},{type:'MOTORBIKE',start:day('2024-02-01'),end:null}],readings:[]}).amount).toBe(1290);
});
