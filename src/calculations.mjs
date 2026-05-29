import { DISTRIBUTION_MONTHS, findEtfProfile, normalizeTwSymbol } from "./data.mjs";

export const SCENARIOS = [
  { key: "conservative", label: "保守", returnAdjustment: -0.02 },
  { key: "base", label: "中性", returnAdjustment: 0 },
  { key: "optimistic", label: "樂觀", returnAdjustment: 0.02 },
];

export function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function getHoldingPrice(holding, quotes = {}) {
  const symbol = normalizeTwSymbol(holding.symbol);
  const profile = findEtfProfile(symbol);
  return toNumber(quotes[symbol]?.price, toNumber(holding.manualPrice, profile?.demoPrice || 0));
}

export function getPortfolio(holdings, quotes = {}) {
  const rows = holdings.map((holding) => {
    const symbol = normalizeTwSymbol(holding.symbol);
    const profile = findEtfProfile(symbol);
    const shares = Math.max(0, toNumber(holding.shares));
    const price = Math.max(0, getHoldingPrice(holding, quotes));
    const marketValue = shares * price;
    const cost = shares * Math.max(0, toNumber(holding.averageCost));
    return {
      ...holding,
      symbol,
      profile,
      price,
      shares,
      marketValue,
      cost,
      gainLoss: marketValue - cost,
      yieldIncome: marketValue * (profile?.estimatedYield || 0),
      totalReturn: profile?.estimatedTotalReturn || 0.04,
    };
  });
  const totalValue = rows.reduce((sum, row) => sum + row.marketValue, 0);
  const totalCost = rows.reduce((sum, row) => sum + row.cost, 0);
  const annualDividend = rows.reduce((sum, row) => sum + row.yieldIncome, 0);
  const weightedReturn =
    totalValue > 0 ? rows.reduce((sum, row) => sum + row.totalReturn * (row.marketValue / totalValue), 0) : 0.04;

  return {
    rows,
    totalValue,
    totalCost,
    gainLoss: totalValue - totalCost,
    annualDividend,
    weightedReturn,
  };
}

export function futureValue({ principal, monthlyContribution, annualReturn, years, contributionMonths = null }) {
  const months = Math.max(0, Math.round(years * 12));
  const monthlyRate = annualReturn / 12;
  const activeContributionMonths = contributionMonths ?? months;
  let value = Math.max(0, principal);
  for (let month = 0; month < months; month += 1) {
    value = value * (1 + monthlyRate) + (month < activeContributionMonths ? Math.max(0, monthlyContribution) : 0);
  }
  return value;
}

export function projectRetirement({ portfolioValue, cash, monthlyContribution, inputs, weightedReturn }) {
  const currentAge = toNumber(inputs.currentAge);
  const retirementAge = toNumber(inputs.retirementAge);
  const contributionStopAge = Math.min(retirementAge, Math.max(currentAge, toNumber(inputs.contributionStopAge, retirementAge)));
  const yearsToRetirement = Math.max(0, retirementAge - currentAge);
  const contributionMonths = Math.max(0, Math.round((contributionStopAge - currentAge) * 12));
  const inflationRate = Math.max(0, toNumber(inputs.inflationRate));
  const inflatedExpense = toNumber(inputs.monthlyRetirementExpense) * (1 + inflationRate) ** yearsToRetirement;
  const startingAssets = Math.max(0, portfolioValue) + Math.max(0, toNumber(cash));
  const baseAnnualReturn = Number.isFinite(toNumber(inputs.annualReturn, NaN))
    ? toNumber(inputs.annualReturn)
    : weightedReturn;
  const targetWithdrawalRate = Math.max(0, toNumber(inputs.withdrawalRate, 0.04));

  return SCENARIOS.map((scenario) => {
    const annualReturn = Math.max(-0.08, baseAnnualReturn + scenario.returnAdjustment);
    const retirementPortfolioValue = futureValue({
      principal: startingAssets,
      monthlyContribution,
      annualReturn,
      years: yearsToRetirement,
      contributionMonths,
    });
    const annualNeed = inflatedExpense * 12;
    const withdrawalRate = retirementPortfolioValue > 0 ? annualNeed / retirementPortfolioValue : Infinity;
    const safeMonthlyWithdrawal = (retirementPortfolioValue * targetWithdrawalRate) / 12;
    const assetLastsUntilAge = estimateAssetLastsUntilAge({
      retirementAge,
      assets: retirementPortfolioValue,
      monthlyExpense: inflatedExpense,
      annualReturn,
      inflationRate,
    });

    return {
      ...scenario,
      annualReturn,
      retirementPortfolioValue,
      monthlyExpenseAtRetirement: inflatedExpense,
      withdrawalRate,
      targetWithdrawalRate,
      safeMonthlyWithdrawal,
      assetLastsUntilAge,
      drawdownSeries: generateDrawdownSeries({
        retirementAge,
        assets: retirementPortfolioValue,
        monthlyExpense: inflatedExpense,
        annualReturn,
        inflationRate,
      }),
    };
  });
}

export function estimateAssetLastsUntilAge({ retirementAge, assets, monthlyExpense, annualReturn, inflationRate }) {
  let balance = Math.max(0, assets);
  let expense = Math.max(0, monthlyExpense);
  const monthlyReturn = annualReturn / 12;
  const monthlyInflation = inflationRate / 12;
  const maxMonths = 70 * 12;

  for (let month = 0; month < maxMonths; month += 1) {
    balance = balance * (1 + monthlyReturn) - expense;
    expense *= 1 + monthlyInflation;
    if (balance <= 0) {
      return retirementAge + month / 12;
    }
  }
  return 120;
}

export function generateDrawdownSeries({ retirementAge, assets, monthlyExpense, annualReturn, inflationRate }) {
  let balance = Math.max(0, assets);
  let expense = Math.max(0, monthlyExpense);
  const monthlyReturn = annualReturn / 12;
  const monthlyInflation = inflationRate / 12;
  const points = [{ age: retirementAge, balance }];
  const maxMonths = 70 * 12;

  for (let month = 1; month <= maxMonths; month += 1) {
    balance = Math.max(0, balance * (1 + monthlyReturn) - expense);
    expense *= 1 + monthlyInflation;
    if (month % 12 === 0 || balance === 0) {
      points.push({ age: retirementAge + month / 12, balance });
    }
    if (balance === 0) break;
  }

  return points;
}

export function getRetirementCashflow(portfolioRows, monthlyExpense) {
  const months = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    dividend: 0,
    expense: monthlyExpense,
    shortfall: monthlyExpense,
  }));

  for (const row of portfolioRows) {
    const frequency = row.profile?.distributionFrequency || "none";
    const payMonths = DISTRIBUTION_MONTHS[frequency] || [];
    if (payMonths.length === 0) continue;
    const perPayment = row.yieldIncome / payMonths.length;
    for (const month of payMonths) {
      months[month - 1].dividend += perPayment;
    }
  }

  for (const month of months) {
    month.shortfall = Math.max(0, month.expense - month.dividend);
    month.surplus = Math.max(0, month.dividend - month.expense);
  }

  const shortfallMonths = months.filter((month) => month.shortfall > 0).length;
  const maxShortfall = Math.max(...months.map((month) => month.shortfall));
  return {
    months,
    shortfallMonths,
    maxShortfall,
    suggestedCashBuffer: Math.max(monthlyExpense * 6, maxShortfall * 3),
  };
}

export function validateState(state) {
  const errors = [];
  if (toNumber(state.retirementInputs.currentAge) < 1) errors.push("目前年齡需大於 0。");
  if (toNumber(state.retirementInputs.retirementAge) <= toNumber(state.retirementInputs.currentAge)) {
    errors.push("目標退休年齡需大於目前年齡。");
  }
  if (toNumber(state.retirementInputs.contributionStopAge) < toNumber(state.retirementInputs.currentAge)) {
    errors.push("停止投入年齡不可小於目前年齡。");
  }
  if (toNumber(state.retirementInputs.monthlyRetirementExpense) <= 0) {
    errors.push("退休後每月支出需大於 0。");
  }
  for (const holding of state.holdings) {
    if (!normalizeTwSymbol(holding.symbol)) errors.push("ETF 代號不可空白。");
    if (toNumber(holding.shares) < 0 || toNumber(holding.averageCost) < 0 || toNumber(holding.manualPrice) < 0) {
      errors.push("持倉股數、成本與手動價格不可為負數。");
      break;
    }
  }
  return errors;
}
