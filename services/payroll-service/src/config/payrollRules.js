// Payroll rules + calculation (simplified on purpose). Edit the numbers here only.
export const PAYROLL_RULES = {
  standardMonthlyHours: 160, // used to derive an hourly rate from the monthly base salary
  overtimeMultiplier: 1.5, // overtime is paid at 150%
  taxRate: 0.1, // flat 10% income tax on gross
  socialRate: 0.05, // flat 5% social security / pension on gross
};

const round2 = (n) => Math.round(n * 100) / 100;

// ✅ DONE - pure function (no DB): the payslip maths for one month.
//   hourlyRate = baseSalary / 160 ; overtimePay = overtimeHours * hourlyRate * 1.5
//   gross = base + overtimePay ; tax = 10% of gross ; social = 5% of gross ; net = gross - tax - social
export const calculatePayslip = ({ baseSalary, overtimeHours = 0 }) => {
  const hourlyRate = baseSalary / PAYROLL_RULES.standardMonthlyHours;
  const overtimePay = overtimeHours * hourlyRate * PAYROLL_RULES.overtimeMultiplier;
  const gross = baseSalary + overtimePay;
  const tax = gross * PAYROLL_RULES.taxRate;
  const social = gross * PAYROLL_RULES.socialRate;
  const totalDeductions = tax + social;

  return {
    baseSalary: round2(baseSalary),
    overtimeHours: round2(overtimeHours),
    overtimePay: round2(overtimePay),
    gross: round2(gross),
    deductions: { tax: round2(tax), social: round2(social), total: round2(totalDeductions) },
    net: round2(gross - totalDeductions),
  };
};
