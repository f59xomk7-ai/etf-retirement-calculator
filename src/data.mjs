export const DISTRIBUTION_MONTHS = {
  monthly: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  quarterly: [1, 4, 7, 10],
  semiannual: [1, 7],
  annual: [7],
  none: [],
};

export const DISTRIBUTION_LABELS = {
  monthly: "月配",
  quarterly: "季配",
  semiannual: "半年配",
  annual: "年配",
  none: "不配息",
};

export const ETF_PROFILES = [
  {
    symbol: "0050",
    name: "元大台灣50",
    category: "市值型",
    distributionFrequency: "semiannual",
    estimatedYield: 0.018,
    estimatedTotalReturn: 0.07,
    demoPrice: 182.1,
  },
  {
    symbol: "006208",
    name: "富邦台50",
    category: "市值型",
    distributionFrequency: "semiannual",
    estimatedYield: 0.019,
    estimatedTotalReturn: 0.07,
    demoPrice: 111.4,
  },
  {
    symbol: "0056",
    name: "元大高股息",
    category: "高股息",
    distributionFrequency: "quarterly",
    estimatedYield: 0.055,
    estimatedTotalReturn: 0.055,
    demoPrice: 38.2,
  },
  {
    symbol: "00878",
    name: "國泰永續高股息",
    category: "高股息",
    distributionFrequency: "quarterly",
    estimatedYield: 0.06,
    estimatedTotalReturn: 0.055,
    demoPrice: 22.7,
  },
  {
    symbol: "00919",
    name: "群益台灣精選高息",
    category: "高股息",
    distributionFrequency: "quarterly",
    estimatedYield: 0.085,
    estimatedTotalReturn: 0.058,
    demoPrice: 24.1,
  },
  {
    symbol: "00929",
    name: "復華台灣科技優息",
    category: "科技高息",
    distributionFrequency: "monthly",
    estimatedYield: 0.07,
    estimatedTotalReturn: 0.056,
    demoPrice: 19.4,
  },
  {
    symbol: "00940",
    name: "元大台灣價值高息",
    category: "高股息",
    distributionFrequency: "monthly",
    estimatedYield: 0.07,
    estimatedTotalReturn: 0.052,
    demoPrice: 9.8,
  },
  {
    symbol: "00713",
    name: "元大台灣高息低波",
    category: "低波高息",
    distributionFrequency: "quarterly",
    estimatedYield: 0.055,
    estimatedTotalReturn: 0.052,
    demoPrice: 54.3,
  },
  {
    symbol: "00923",
    name: "群益台ESG低碳50",
    category: "ESG市值型",
    distributionFrequency: "quarterly",
    estimatedYield: 0.035,
    estimatedTotalReturn: 0.062,
    demoPrice: 23.4,
  },
  {
    symbol: "00757",
    name: "統一FANG+",
    category: "海外成長",
    distributionFrequency: "none",
    estimatedYield: 0,
    estimatedTotalReturn: 0.085,
    demoPrice: 92.6,
  },
  {
    symbol: "00679B",
    name: "元大美債20年",
    category: "債券",
    distributionFrequency: "quarterly",
    estimatedYield: 0.04,
    estimatedTotalReturn: 0.035,
    demoPrice: 30.6,
  },
  {
    symbol: "00720B",
    name: "元大投資級公司債",
    category: "債券",
    distributionFrequency: "quarterly",
    estimatedYield: 0.045,
    estimatedTotalReturn: 0.038,
    demoPrice: 35.2,
  },
];

export function findEtfProfile(symbol) {
  const normalized = normalizeTwSymbol(symbol);
  return ETF_PROFILES.find((profile) => profile.symbol === normalized);
}

export function normalizeTwSymbol(symbol) {
  return String(symbol || "")
    .trim()
    .toUpperCase()
    .replace(/\.TW$/, "");
}

export function toYahooSymbol(symbol) {
  const normalized = normalizeTwSymbol(symbol);
  return normalized.includes(".") ? normalized : `${normalized}.TW`;
}
