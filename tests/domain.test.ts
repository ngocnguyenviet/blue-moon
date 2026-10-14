import {describe,it,expect} from 'vitest';
import {day,monthBounds,prorate,roundMoney,overlap} from '../server/domain.js';
describe('R03 date and fee arithmetic',()=>{
 it.each(['2026-02-31','2026-04-31','not-a-date','2026-1-1'] )('rejects impossible date %s',s=>expect(()=>day(s)).toThrow());
 it.each([['2026-02',28],['2024-02',29],['2026-04',30],['2026-01',31]])('uses actual month length %s',(m,n)=>expect(monthBounds(String(m)).length).toBe(n));
 it('excludes departure day, preserves fractional segments until final rounding',()=>{expect(roundMoney(prorate(310000,1,day('2026-01-11'),day('2026-01-21'),31))).toBe(100000);expect(roundMoney('10.5')).toBe(11);});
 it('adjacent occupancies do not overlap',()=>expect(overlap(day('2026-01-01'),day('2026-01-15'),day('2026-01-15'),null)).toBe(false));
});
