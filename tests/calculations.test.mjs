import assert from "node:assert/strict";
import {
  futureValue,
  getPortfolio,
  getRetirementCashflow,
  projectRetirement,
  validateState,
} from "../src/calculations.mjs";

const holdings = [
  { id: "a", symbol: "0050", shares: 1000, averageCost: 150, manualPrice: 180 },
  { id: "b", symbol: "00929", shares: 1000, averageCost: 18, manualPrice: 20 },
];

const portfolio = getPortfolio(holdings, {});
assert.equal(portfolio.totalValue, 200000);
assert.ok(portfolio.annualDividend > 0);

const projected = projectRetirement({
  portfolioValue: portfolio.totalValue,
  cash: 100000,
  monthlyContribution: 15000,
  inputs: {
    currentAge: 30,
    retirementAge: 55,
    contributionStopAge: 55,
    monthlyRetirementExpense: 45000,
    annualReturn: 0.055,
    withdrawalRate: 0.04,
    inflationRate: 0.02,
  },
  weightedReturn: portfolio.weightedReturn,
});
assert.equal(projected.length, 3);
assert.ok(projected[2].retirementPortfolioValue > projected[0].retirementPortfolioValue);
assert.ok(projected[1].drawdownSeries.length > 1);
assert.ok(projected[1].safeMonthlyWithdrawal > 0);

const cashflow = getRetirementCashflow(portfolio.rows, 45000);
assert.equal(cashflow.months.length, 12);
assert.ok(cashflow.shortfallMonths > 0);
assert.ok(cashflow.suggestedCashBuffer >= 270000);

assert.ok(futureValue({ principal: 100000, monthlyContribution: 10000, annualReturn: 0.05, years: 1 }) > 220000);

const errors = validateState({
  cash: 0,
  monthlyContribution: 0,
  holdings: [{ id: "x", symbol: "", shares: -1, averageCost: 0, manualPrice: 0 }],
  retirementInputs: {
    currentAge: 40,
    retirementAge: 35,
    contributionStopAge: 30,
    monthlyRetirementExpense: 0,
    annualReturn: 0.05,
    withdrawalRate: 0.04,
    inflationRate: 0.02,
  },
});
assert.ok(errors.length >= 3);

console.log("calculation tests passed");
