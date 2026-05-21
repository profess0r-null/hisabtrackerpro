function calculateBkashLoan(loanAmount, extraFees = 0, loanDateStr = null) {
  const INTEREST_RATE = 0.030823; 
  const PROC_FEE_RATE = 0.00575;    

  const interest       = Math.round(loanAmount * INTEREST_RATE * 100) / 100;
  const totalRepayment = Math.round((loanAmount + interest)    * 100) / 100;
  const processingFee  = Math.round(loanAmount * PROC_FEE_RATE * 100) / 100;
  const netAmount      = Math.round((loanAmount - processingFee) * 100) / 100;
  const grandTotal     = Math.round((totalRepayment + processingFee + extraFees) * 100) / 100;
  let daysElapsed = 0;
  if (loanDateStr) {
    const loanDate = new Date(loanDateStr);
    loanDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    daysElapsed = Math.min(90, Math.max(0, Math.floor((today - loanDate) / 86400000)));
  }

  return {
    loanAmount,
    interest,
    totalRepayment,
    processingFee,
    netAmount,
    extraFees,
    grandTotal,
    daysElapsed
  };
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { calculateBkashLoan };
}
