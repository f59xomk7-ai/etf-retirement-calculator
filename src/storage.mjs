const APP_KEY = "etf-retirement-calculator:v1";
const QUOTE_KEY = "etf-retirement-calculator:quotes:v1";

export const defaultState = {
  cash: 120000,
  monthlyContribution: 15000,
  holdings: [
    { id: crypto.randomUUID(), symbol: "0050", shares: 1000, averageCost: 150, manualPrice: 182.1 },
    { id: crypto.randomUUID(), symbol: "00878", shares: 2000, averageCost: 20, manualPrice: 22.7 },
  ],
  retirementInputs: {
    currentAge: 32,
    retirementAge: 55,
    contributionStopAge: 55,
    monthlyRetirementExpense: 45000,
    annualReturn: 0.06,
    withdrawalRate: 0.04,
    inflationRate: 0.02,
  },
};

export function loadAppState() {
  try {
    const raw = localStorage.getItem(APP_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw);
    return {
      ...defaultState,
      ...parsed,
      retirementInputs: {
        ...defaultState.retirementInputs,
        ...(parsed.retirementInputs || {}),
      },
    };
  } catch {
    return defaultState;
  }
}

export function saveAppState(state) {
  localStorage.setItem(APP_KEY, JSON.stringify(state));
}

export function loadQuoteCache() {
  try {
    return JSON.parse(localStorage.getItem(QUOTE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveQuoteCache(cache) {
  localStorage.setItem(QUOTE_KEY, JSON.stringify(cache));
}
