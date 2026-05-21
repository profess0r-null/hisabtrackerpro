function getAccumulatedInterest(principal, loanDateStr, currentDateStr = null) {
  const DAILY_INTEREST_RATE = 0.030823 / 90; // daily rate
  const MAX_DAYS = 90;

  let loanDate = new Date(loanDateStr);
  loanDate.setHours(0, 0, 0, 0);

  let currentDate = currentDateStr ? new Date(currentDateStr) : new Date();
  currentDate.setHours(0, 0, 0, 0);

  const daysElapsed = Math.floor((currentDate - loanDate) / 86400000);
  const daysToCharge = Math.min(MAX_DAYS, Math.max(0, daysElapsed));

  const accumulatedInterest = Math.round(principal * DAILY_INTEREST_RATE * daysToCharge * 100) / 100;
  return accumulatedInterest;
}
function calculateDailyInterestLoan(principal, loanDateStr, extraFees = 0) {
  const DAILY_INTEREST_RATE = 0.030823 / 90;
  const TOTAL_3MONTH_RATE = 0.030823;
  const PROC_FEE_RATE = 0.00575;
  const MAX_DAYS = 90;

  let loanDate = new Date(loanDateStr);
  loanDate.setHours(0, 0, 0, 0);

  let today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysElapsed = Math.floor((today - loanDate) / 86400000);
  const daysToCharge = Math.min(MAX_DAYS, Math.max(0, daysElapsed));

  // Accumulated interest so far
  const accumulatedInterest = Math.round(principal * DAILY_INTEREST_RATE * daysToCharge * 100) / 100;

  // Interest if loan goes full 3 months
  const totalInterestIf3Months = Math.round(principal * TOTAL_3MONTH_RATE * 100) / 100;

  // Processing fee (one-time)
  const processingFee = Math.round(principal * PROC_FEE_RATE * 100) / 100;

  // Net amount (what borrower actually receives)
  const netAmount = Math.round((principal - processingFee) * 100) / 100;

  // Main amount = principal + accumulated interest (what's due if they pay now)
  const mainAmount = Math.round((principal + accumulatedInterest) * 100) / 100;

  // Total due today (including processing fee + extra fees)
  const totalDueToday = Math.round((mainAmount + processingFee + extraFees) * 100) / 100;

  // Max due at 3 months
  const maxDue3Months = Math.round((principal + totalInterestIf3Months + processingFee + extraFees) * 100) / 100;

  // Build daily schedule (for reference)
  const schedule = [];
  for (let day = 0; day <= Math.min(daysToCharge, 89); day++) {
    const interestAccrued = Math.round(principal * DAILY_INTEREST_RATE * day * 100) / 100;
    const amountDueOnDay = principal + interestAccrued;
    schedule.push({
      day,
      interestAccrued,
      amountDueOnDay
    });
  }

  return {
    principal,
    dailyRate: DAILY_INTEREST_RATE,
    daysElapsed: daysToCharge,
    accumulatedInterest,
    totalInterestIf3Months,
    processingFee,
    netAmount,
    extraFees,
    mainAmount,
    totalDueToday,
    maxDue3Months,
    schedule
  };
}

// Export for CommonJS / Node
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    getAccumulatedInterest, 
    calculateDailyInterestLoan 
  };
}
