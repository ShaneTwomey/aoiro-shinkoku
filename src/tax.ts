// Statutory sources, dates and corresponding tests: docs/rules.md.
export const RULESET = 'jp-national-2026.1';
export type BlueFacts = {
  approved: boolean; double: boolean; accrual: boolean; books: boolean;
  onTime: boolean; etax: boolean; qualified: boolean; notified: boolean;
  linked: boolean; linkedNotified?: boolean; priorRevenue?: number;
};
export function blueLimit(year: 2026 | 2027, f: BlueFacts): number | undefined {
  if (!f.approved) return 0;
  const regular = f.double && f.accrual && f.books && f.onTime;
  if (year === 2026) {
    if (!regular) return 100_000;
    return f.etax || (f.qualified && f.notified) ? 650_000 : 550_000;
  }
  if (regular && f.etax) return (f.qualified && f.notified) || (f.linked && f.linkedNotified) ? 750_000 : 650_000;
  if (!f.double) return f.priorRevenue === undefined ? undefined : f.priorRevenue > 10_000_000 ? 0 : 100_000;
  return 100_000;
}
export const blueDeduction = (profit: number, limit: number) => Math.min(Math.max(0,profit),limit);
export function basic2026(income: number) {
  if (income <= 4_890_000) return 1_040_000;
  if (income <= 6_550_000) return 670_000;
  if (income <= 23_500_000) return 620_000;
  if (income <= 24_000_000) return 480_000;
  if (income <= 24_500_000) return 320_000;
  if (income <= 25_000_000) return 160_000;
  return 0;
}
export function ordinaryTax(taxable: number) {
  const rates = [[1_950_000,5,0],[3_300_000,10,97_500],[6_950_000,20,427_500],
    [9_000_000,23,636_000],[18_000_000,33,1_536_000],[40_000_000,40,2_796_000],[Infinity,45,4_796_000]];
  const [,rate,offset] = rates.find(([limit]) => taxable <= limit)!;
  return Math.floor(taxable * rate / 100) - offset;
}
export function tax2026(profit: number, blueCap: number, social: number, mutual: number, withholding: number, advance: number) {
  const blue = blueDeduction(profit,blueCap);
  const income = profit - blue;
  const basic = basic2026(income);
  const deductions = social + mutual + basic;
  const taxable = Math.max(0,Math.floor((income - deductions) / 1000) * 1000);
  const normal = ordinaryTax(taxable);
  const surtax = Math.floor(normal * 21 / 1000);
  const combined = normal + surtax;
  const beforeAdvance = combined - withholding;
  const selfAssessed = beforeAdvance < 0 ? beforeAdvance : Math.floor(beforeAdvance / 100) * 100;
  const final = selfAssessed - advance;
  return {blue,income,basic,deductions,taxable,normal,surtax,combined,selfAssessed,final};
}
