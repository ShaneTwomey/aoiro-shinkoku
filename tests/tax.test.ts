import { describe, expect, it } from 'vitest';
import { basic2026, blueDeduction, blueLimit, ordinaryTax, tax2026, type BlueFacts } from '../src/tax';

const onTime: BlueFacts = {approved:true,double:true,accrual:true,books:true,onTime:true,
  etax:true,qualified:false,notified:false,linked:false};
describe('BLUE — special deduction from business profit',()=>{
  it('distinguishes the 2026 paper, timely e-Tax, qualified-book and late routes',()=>{
    expect(blueLimit(2026,onTime)).toBe(650000);
    expect(blueLimit(2026,{...onTime,etax:false})).toBe(550000);
    expect(blueLimit(2026,{...onTime,etax:false,qualified:true,notified:true})).toBe(650000);
    expect(blueLimit(2026,{...onTime,etax:false,qualified:true,notified:false})).toBe(550000);
    expect(blueLimit(2026,{...onTime,onTime:false})).toBe(100000);
    expect(blueLimit(2026,{...onTime,accrual:false})).toBe(100000);
    expect(blueLimit(2026,{...onTime,approved:false})).toBe(0);
    expect(blueDeduction(12_500,650_000)).toBe(12_500);
    expect(blueDeduction(-1,650_000)).toBe(0);
  });
  it('applies the enacted 2027 changes at the year boundary',()=>{
    const enhanced={...onTime,qualified:true,notified:true,linked:true};
    expect(blueLimit(2026,enhanced)).toBe(650000);
    expect(blueLimit(2027,enhanced)).toBe(750000);
    expect(blueLimit(2027,{...enhanced,linked:false})).toBe(750000);
    expect(blueLimit(2027,{...onTime,linked:true,linkedNotified:true})).toBe(750000);
    expect(blueLimit(2027,{...onTime,linked:true,linkedNotified:false})).toBe(650000);
    expect(blueLimit(2027,{...enhanced,notified:false})).toBe(650000);
    expect(blueLimit(2027,{...onTime,etax:false})).toBe(100000);
    expect(blueLimit(2027,{...enhanced,etax:false})).toBe(100000);
    const simple={...onTime,double:false,priorRevenue:10_000_001};
    expect(blueLimit(2026,simple)).toBe(100000);
    expect(blueLimit(2027,simple)).toBe(0);
    expect(blueLimit(2027,{...simple,priorRevenue:10_000_000})).toBe(100000);
    expect(blueLimit(2027,{...simple,priorRevenue:undefined})).toBeUndefined();
  });
});
describe('BASIC, RATE, ROUND, SURTAX, SOCIAL and MUTUAL',()=>{
  it('uses the 2026 statutory basic deduction at every inclusive boundary',()=>{
    for(const [income,on,above] of [[4_890_000,1040000,670000],[6_550_000,670000,620000],
      [23_500_000,620000,480000],[24_000_000,480000,320000],[24_500_000,320000,160000],[25_000_000,160000,0]]) {
      expect(basic2026(income)).toBe(on);
      expect(basic2026(income+1)).toBe(above);
    }
  });
  it('matches the NTA’s 2026 progressive example and high brackets',()=>{
    expect(ordinaryTax(6_500_000)).toBe(872500);
    expect(ordinaryTax(1_950_000)).toBe(97500);
    expect(ordinaryTax(1_951_000)).toBe(97600);
    expect(ordinaryTax(40_001_000)).toBe(13_204_450);
  });
  it('matches the independent fixture calculation',()=>{
    // (3,000,000−600,000−650,000−1,040,000)×5%=35,500;
    // 35,500×2.1%=745.5 → 745. 36,245 → 36,200 payable.
    expect(tax2026(2_400_000,650_000,0,0,0,0)).toEqual({
      blue:650_000,income:1_750_000,basic:1_040_000,deductions:1_040_000,taxable:710_000,
      normal:35_500,surtax:745,combined:36_245,selfAssessed:36_200,final:36_200,
    });
  });
  it('subtracts eligible premiums, truncates the base, and preserves a yen refund',()=>{
    // Income 1,750,000 minus deductions 1,140,123 => 609,877 => 609,000.
    // Tax 30,450 + 639 = 31,089. Withheld 40,000 and advance 10,000 => 18,911 refund.
    expect(tax2026(2_400_000,650_000,80_000,20_123,40_000,10_000))
      .toMatchObject({deductions:1_140_123,taxable:609_000,normal:30_450,surtax:639,final:-18_911});
    expect(tax2026(2_400_000,650_000,0,0,5_001,10_000).final).toBe(21_200);
  });
});
