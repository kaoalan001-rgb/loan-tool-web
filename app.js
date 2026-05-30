const formatter = new Intl.NumberFormat("zh-TW", {
  style: "currency",
  currency: "TWD",
  maximumFractionDigits: 0,
});

const elements = {
  loanAmount: document.querySelector("#loanAmountInput"),
  loanRate: document.querySelector("#loanRateInput"),
  loanPeriods: document.querySelector("#loanPeriodsInput"),
  loanMethod: document.querySelector("#loanMethodInput"),
  loanPeriodsLabel: document.querySelector("#loanPeriodsLabel"),
  monthlyPaymentLabel: document.querySelector("#monthlyPaymentLabel"),
  monthlyPayment: document.querySelector("#monthlyPaymentAmount"),
  totalInterest: document.querySelector("#totalInterestAmount"),
  totalPayment: document.querySelector("#totalPaymentAmount"),
  compoundPrincipal: document.querySelector("#compoundPrincipalInput"),
  compoundContribution: document.querySelector("#compoundContributionInput"),
  compoundRate: document.querySelector("#compoundRateInput"),
  compoundPeriods: document.querySelector("#compoundPeriodsInput"),
  compoundDividendEnabled: document.querySelector("#compoundDividendEnabledInput"),
  compoundDividendRate: document.querySelector("#compoundDividendRateInput"),
  compoundPeriodsLabel: document.querySelector("#compoundPeriodsLabel"),
  compoundFuture: document.querySelector("#compoundFutureAmount"),
  compoundInvested: document.querySelector("#compoundInvestedAmount"),
  compoundGain: document.querySelector("#compoundGainAmount"),
  compoundDividend: document.querySelector("#compoundDividendAmount"),
  compoundMonthlyDividend: document.querySelector("#compoundMonthlyDividendAmount"),
  arbitrageApply: document.querySelector("#arbitrageApplyInput"),
  arbitrageGrid: document.querySelector("#arbitrageResultGrid"),
  arbitrageNet: document.querySelector("#arbitrageNetAmount"),
  arbitrageNetFormula: document.querySelector("#arbitrageNetFormula"),
  arbitrageReturn: document.querySelector("#arbitrageReturnAmount"),
  arbitrageLoanCost: document.querySelector("#arbitrageLoanCostAmount"),
  arbitrageCashflow: document.querySelector("#arbitrageCashflowAmount"),
  arbitrageStatus: document.querySelector("#arbitrageStatusText"),
};

let fitFrame = 0;

function scheduleFitAmountTexts() {
  cancelAnimationFrame(fitFrame);
  fitFrame = requestAnimationFrame(fitAmountTexts);
}

function fitAmountTexts() {
  fitFrame = 0;

  document.querySelectorAll(".loan-result-card strong").forEach((element) => {
    element.style.fontSize = "";

    let fontSize = Number.parseFloat(getComputedStyle(element).fontSize);
    while (element.scrollWidth > element.clientWidth && fontSize > 12) {
      fontSize -= 1;
      element.style.fontSize = `${fontSize}px`;
    }
  });
}

function calculateEqualPayment(principal, monthlyRate, months) {
  if (monthlyRate === 0) return principal / months;

  const growth = (1 + monthlyRate) ** months;
  return (principal * monthlyRate * growth) / (growth - 1);
}

function calculateLoan() {
  const loan = getLoanProjection();
  if (!loan) {
    renderLoanEmptyState();
    calculateArbitrage();
    return;
  }

  elements.loanPeriodsLabel.textContent = `${loan.months} 期`;
  elements.monthlyPaymentLabel.textContent = getLoanPaymentLabel(loan.method);
  elements.monthlyPayment.textContent = getLoanPaymentText(loan.method, loan.firstPayment, loan.lastPayment);
  elements.totalInterest.textContent = formatter.format(loan.totalInterest);
  elements.totalPayment.textContent = formatter.format(loan.totalPayment + getFinalPrincipalDue(loan.method, loan.principal));
  calculateArbitrage();
  scheduleFitAmountTexts();
}

function getLoanProjection() {
  const principal = Number(elements.loanAmount.value);
  const annualRate = Number(elements.loanRate.value);
  const periods = Number(elements.loanPeriods.value);
  const method = elements.loanMethod.value;

  if (!Number.isFinite(principal) || !Number.isFinite(annualRate) || !Number.isFinite(periods) || principal <= 0 || periods <= 0) {
    return null;
  }

  const months = Math.round(periods);
  const monthlyRate = annualRate / 100 / 12;
  const schedule = buildLoanSchedule(method, principal, monthlyRate, months);
  const firstPayment = schedule[0]?.payment || 0;
  const lastPayment = schedule.at(-1)?.payment || 0;
  const totalPayment = schedule.reduce((total, row) => total + row.payment, 0);
  const totalInterest = schedule.reduce((total, row) => total + row.interest, 0);

  return {
    firstPayment,
    lastPayment,
    method,
    months,
    principal,
    totalInterest,
    totalPayment,
  };
}

function buildLoanSchedule(method, principal, monthlyRate, months) {
  if (method === "equal-principal") return buildEqualPrincipalSchedule(principal, monthlyRate, months);
  if (method === "interest-only") return buildInterestOnlySchedule(principal, monthlyRate, months);
  return buildEqualPaymentSchedule(principal, monthlyRate, months);
}

function getLoanPaymentLabel(method) {
  if (method === "equal-principal") return "首月約繳";
  if (method === "interest-only") return "每月繳息";
  return "每月約繳";
}

function getLoanPaymentText(method, firstPayment, lastPayment) {
  if (method === "equal-principal") return `${formatter.format(firstPayment)} → ${formatter.format(lastPayment)}`;
  return formatter.format(firstPayment);
}

function getFinalPrincipalDue(method, principal) {
  return method === "interest-only" ? principal : 0;
}

function buildEqualPaymentSchedule(principal, monthlyRate, months) {
  const monthlyPayment = calculateEqualPayment(principal, monthlyRate, months);
  let balance = principal;

  return Array.from({ length: months }, (_, index) => {
    const interest = balance * monthlyRate;
    const principalPayment = index === months - 1 ? balance : monthlyPayment - interest;
    const payment = principalPayment + interest;
    balance = Math.max(balance - principalPayment, 0);

    return {
      period: index + 1,
      payment,
      principal: principalPayment,
      interest,
      balance,
    };
  });
}

function buildEqualPrincipalSchedule(principal, monthlyRate, months) {
  const monthlyPrincipal = principal / months;
  let balance = principal;

  return Array.from({ length: months }, (_, index) => {
    const interest = balance * monthlyRate;
    const principalPayment = index === months - 1 ? balance : monthlyPrincipal;
    const payment = principalPayment + interest;
    balance = Math.max(balance - principalPayment, 0);

    return {
      period: index + 1,
      payment,
      principal: principalPayment,
      interest,
      balance,
    };
  });
}

function buildInterestOnlySchedule(principal, monthlyRate, months) {
  const monthlyInterest = principal * monthlyRate;

  return Array.from({ length: months }, (_, index) => ({
    period: index + 1,
    payment: monthlyInterest,
    principal: 0,
    interest: monthlyInterest,
    balance: principal,
  }));
}

function renderLoanEmptyState() {
  elements.loanPeriodsLabel.textContent = "0 期";
  elements.monthlyPaymentLabel.textContent = "每月約繳";
  elements.monthlyPayment.textContent = "$0";
  elements.totalInterest.textContent = "$0";
  elements.totalPayment.textContent = "$0";
  scheduleFitAmountTexts();
}

function calculateCompound() {
  const compound = getCompoundProjection();
  if (!compound) {
    renderCompoundEmptyState();
    calculateArbitrage();
    return;
  }

  elements.compoundPeriodsLabel.textContent = `${compound.roundedPeriods} 期`;
  elements.compoundFuture.textContent = formatter.format(compound.futureValue);
  elements.compoundInvested.textContent = formatter.format(compound.invested);
  elements.compoundGain.textContent = formatter.format(compound.gain);
  elements.compoundDividend.textContent = formatter.format(compound.dividend);
  elements.compoundMonthlyDividend.textContent = formatter.format(compound.monthlyDividend);
  calculateArbitrage();
  scheduleFitAmountTexts();
}

function getCompoundProjection() {
  const principal = Number(elements.compoundPrincipal.value);
  const contribution = Number(elements.compoundContribution.value);
  const annualRate = Number(elements.compoundRate.value);
  const periods = Number(elements.compoundPeriods.value);
  const hasDividend = elements.compoundDividendEnabled.value === "yes";
  const dividendRate = hasDividend ? Number(elements.compoundDividendRate.value) : 0;

  if (
    !Number.isFinite(principal) ||
    !Number.isFinite(contribution) ||
    !Number.isFinite(annualRate) ||
    !Number.isFinite(periods) ||
    !Number.isFinite(dividendRate) ||
    principal < 0 ||
    contribution < 0 ||
    dividendRate < 0 ||
    periods <= 0
  ) {
    return null;
  }

  const roundedPeriods = Math.round(periods);
  const periodRate = annualRate / 100 / 12;
  const dividendPeriodRate = dividendRate / 100 / 12;
  const compoundResult = projectCompound(principal, contribution, periodRate, dividendPeriodRate, roundedPeriods);
  const futureValue = compoundResult.futureValue;
  const invested = principal + contribution * roundedPeriods;
  const dividend = hasDividend ? compoundResult.dividend : 0;
  const monthlyDividend = roundedPeriods > 0 ? dividend / roundedPeriods : 0;
  const gain = futureValue - invested;

  return {
    dividend,
    futureValue,
    gain,
    invested,
    monthlyDividend,
    roundedPeriods,
  };
}

function projectCompound(principal, contribution, periodRate, dividendPeriodRate, periods) {
  let balance = principal;
  let dividend = 0;

  for (let period = 0; period < periods; period += 1) {
    balance += balance * periodRate;
    dividend += balance * dividendPeriodRate;
    balance += contribution;
  }

  return { futureValue: balance, dividend };
}

function renderCompoundEmptyState() {
  elements.compoundPeriodsLabel.textContent = "0 期";
  elements.compoundFuture.textContent = "$0";
  elements.compoundInvested.textContent = "$0";
  elements.compoundGain.textContent = "$0";
  elements.compoundDividend.textContent = "$0";
  elements.compoundMonthlyDividend.textContent = "$0";
  scheduleFitAmountTexts();
}

function calculateArbitrage() {
  if (!elements.arbitrageApply.checked) {
    renderArbitrageEmptyState("勾選後開始比較貸款成本與複利收益。");
    return;
  }

  const loan = getLoanProjection();
  const compound = getCompoundProjection();
  if (!loan || !compound) {
    renderArbitrageEmptyState("請先輸入完整的貸款與複利條件。");
    return;
  }

  const totalLoanRepayment = loan.totalPayment + getFinalPrincipalDue(loan.method, loan.principal);
  const investmentValue = compound.futureValue + compound.dividend;
  const net = investmentValue - totalLoanRepayment;
  const monthlyCashflow = compound.monthlyDividend - loan.firstPayment;

  elements.arbitrageGrid.classList.remove("is-disabled");
  elements.arbitrageNet.textContent = formatter.format(net);
  elements.arbitrageNetFormula.textContent = `${formatter.format(compound.futureValue)} + ${formatter.format(compound.dividend)} - ${formatter.format(totalLoanRepayment)} = ${formatter.format(net)}`;
  elements.arbitrageReturn.textContent = formatter.format(investmentValue);
  elements.arbitrageLoanCost.textContent = formatter.format(totalLoanRepayment);
  elements.arbitrageCashflow.textContent = formatter.format(monthlyCashflow);
  elements.arbitrageNet.classList.toggle("negative-value", net < 0);
  elements.arbitrageCashflow.classList.toggle("negative-value", monthlyCashflow < 0);
  elements.arbitrageStatus.textContent = net >= 0
    ? "目前估算期末資產加配息高於貸款總還款。"
    : "目前估算貸款總還款高於期末資產加配息。";
  scheduleFitAmountTexts();
}

function renderArbitrageEmptyState(message) {
  elements.arbitrageGrid.classList.add("is-disabled");
  elements.arbitrageNet.textContent = "$0";
  elements.arbitrageNetFormula.textContent = "期末資產 + 配息 - 貸款總還款";
  elements.arbitrageReturn.textContent = "$0";
  elements.arbitrageLoanCost.textContent = "$0";
  elements.arbitrageCashflow.textContent = "$0";
  elements.arbitrageNet.classList.remove("negative-value");
  elements.arbitrageCashflow.classList.remove("negative-value");
  elements.arbitrageStatus.textContent = message;
  scheduleFitAmountTexts();
}

elements.loanAmount.addEventListener("input", calculateLoan);
elements.loanRate.addEventListener("input", calculateLoan);
elements.loanPeriods.addEventListener("input", calculateLoan);
elements.loanMethod.addEventListener("change", calculateLoan);
elements.compoundPrincipal.addEventListener("input", calculateCompound);
elements.compoundContribution.addEventListener("input", calculateCompound);
elements.compoundRate.addEventListener("input", calculateCompound);
elements.compoundPeriods.addEventListener("input", calculateCompound);
elements.compoundDividendEnabled.addEventListener("change", () => {
  const hasDividend = elements.compoundDividendEnabled.value === "yes";
  elements.compoundDividendRate.disabled = !hasDividend;
  if (!hasDividend) elements.compoundDividendRate.value = "0";
  if (hasDividend && Number(elements.compoundDividendRate.value) === 0) elements.compoundDividendRate.value = "4";
  calculateCompound();
});
elements.compoundDividendRate.addEventListener("input", calculateCompound);
elements.arbitrageApply.addEventListener("change", calculateArbitrage);
window.addEventListener("resize", scheduleFitAmountTexts);

calculateLoan();
calculateCompound();
calculateArbitrage();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}
