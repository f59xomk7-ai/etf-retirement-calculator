import React, { useEffect, useMemo, useState } from "https://esm.sh/react@19.1.1";
import { createRoot } from "https://esm.sh/react-dom@19.1.1/client";
import { ETF_PROFILES, DISTRIBUTION_LABELS, findEtfProfile, normalizeTwSymbol } from "./data.mjs";
import { loadAppState, saveAppState } from "./storage.mjs";
import { yahooQuoteProvider } from "./quoteProvider.mjs";
import {
  getPortfolio,
  getRetirementCashflow,
  projectRetirement,
  toNumber,
  validateState,
} from "./calculations.mjs";

const h = React.createElement;
const twd = new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 });
const twdPrice = new Intl.NumberFormat("zh-TW", {
  style: "currency",
  currency: "TWD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const pct = new Intl.NumberFormat("zh-TW", { style: "percent", maximumFractionDigits: 1 });
const number = new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 0 });

function Button({ children, onClick, variant = "primary", type = "button", title }) {
  return h("button", { className: `btn ${variant}`, onClick, type, title }, children);
}

function Field({ label, value, onChange, type = "number", min = "0", step = "1", children }) {
  return h("label", { className: "field" }, [
    h("span", { key: "label" }, label),
    children ||
      h("input", {
        key: "input",
        type,
        min,
        step,
        value,
        onChange: (event) => onChange(event.target.value),
      }),
  ]);
}

function Metric({ label, value, tone = "" }) {
  return h("div", { className: `metric ${tone}` }, [h("span", { key: "label" }, label), h("strong", { key: "value" }, value)]);
}

function App() {
  const [state, setState] = useState(loadAppState);
  const [activeTab, setActiveTab] = useState("holdings");
  const [quotes, setQuotes] = useState({});
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);

  useEffect(() => saveAppState(state), [state]);

  useEffect(() => {
    let cancelled = false;
    async function refreshQuotes() {
      setIsLoadingQuotes(true);
      const nextQuotes = await yahooQuoteProvider(state.holdings);
      if (!cancelled) {
        setQuotes(nextQuotes);
        setIsLoadingQuotes(false);
      }
    }
    refreshQuotes();
    return () => {
      cancelled = true;
    };
  }, [state.holdings]);

  const portfolio = useMemo(() => getPortfolio(state.holdings, quotes), [state.holdings, quotes]);
  const projections = useMemo(
    () =>
      projectRetirement({
        portfolioValue: portfolio.totalValue,
        cash: state.cash,
        monthlyContribution: state.monthlyContribution,
        inputs: state.retirementInputs,
        weightedReturn: portfolio.weightedReturn,
      }),
    [portfolio.totalValue, portfolio.weightedReturn, state.cash, state.monthlyContribution, state.retirementInputs],
  );
  const baseProjection = projections.find((projection) => projection.key === "base") || projections[0];
  const cashflow = useMemo(
    () => getRetirementCashflow(portfolio.rows, baseProjection.monthlyExpenseAtRetirement),
    [portfolio.rows, baseProjection.monthlyExpenseAtRetirement],
  );
  const errors = validateState(state);

  function updateState(patch) {
    setState((current) => ({ ...current, ...patch }));
  }

  function updateRetirementInputs(key, value) {
    setState((current) => ({
      ...current,
      retirementInputs: { ...current.retirementInputs, [key]: toNumber(value) },
    }));
  }

  function updateHolding(id, key, value) {
    setState((current) => ({
      ...current,
      holdings: current.holdings.map((holding) =>
        holding.id === id
          ? {
              ...holding,
              [key]: key === "symbol" ? normalizeTwSymbol(value) : toNumber(value),
            }
          : holding,
      ),
    }));
  }

  function addHolding() {
    setState((current) => ({
      ...current,
      holdings: [
        ...current.holdings,
        { id: crypto.randomUUID(), symbol: "00919", shares: 1000, averageCost: 24, manualPrice: 24.1 },
      ],
    }));
  }

  function removeHolding(id) {
    setState((current) => ({ ...current, holdings: current.holdings.filter((holding) => holding.id !== id) }));
  }

  const tabs = [
    ["holdings", "我的持倉"],
    ["retirement", "退休試算"],
    ["cashflow", "退休現金流"],
  ];

  return h("main", { className: "app-shell" }, [
    h("section", { className: "hero", key: "hero" }, [
      h("div", { key: "copy" }, [
        h("p", { className: "eyebrow", key: "eyebrow" }, "ETF 退休金試算器"),
        h("h1", { key: "title" }, "離退休還有多遠，先用你的 ETF 持倉算一次。"),
        h(
          "p",
          { className: "hero-copy", key: "body" },
          "輸入目前持倉、現金與每月投入，估算退休時資產、資產壽命，並看月配與季配在退休後造成的現金流空窗。",
        ),
      ]),
      h("div", { className: "hero-panel", key: "panel" }, [
        Metric({ label: "目前投資市值", value: twd.format(portfolio.totalValue) }),
        Metric({ label: "退休時中性估算", value: twd.format(baseProjection.retirementPortfolioValue) }),
        Metric({
          label: "資產估計可撐到",
          value: baseProjection.assetLastsUntilAge >= 119 ? "120 歲以上" : `${baseProjection.assetLastsUntilAge.toFixed(1)} 歲`,
        }),
      ]),
    ]),
    h("nav", { className: "tabs", key: "tabs" }, tabs.map(([key, label]) => h("button", {
      className: activeTab === key ? "active" : "",
      onClick: () => setActiveTab(key),
      key,
    }, label))),
    errors.length > 0
      ? h("section", { className: "notice error", key: "errors" }, errors.map((error) => h("p", { key: error }, error)))
      : null,
    activeTab === "holdings"
      ? h(HoldingsView, {
          key: "holdings",
          state,
          quotes,
          portfolio,
          isLoadingQuotes,
          updateState,
          updateHolding,
          addHolding,
          removeHolding,
        })
      : null,
    activeTab === "retirement"
      ? h(RetirementView, { key: "retirement", state, portfolio, projections, updateState, updateRetirementInputs })
      : null,
    activeTab === "cashflow"
      ? h(CashflowView, { key: "cashflow", portfolio, baseProjection, cashflow, cash: state.cash })
      : null,
    h(
      "footer",
      { className: "footer", key: "footer" },
      "本工具為教育與規劃用途。Yahoo Finance 為原型資料源，報價可能延遲、暫停或失效，不構成投資建議。",
    ),
  ]);
}

function HoldingsView({ state, quotes, portfolio, isLoadingQuotes, updateState, updateHolding, addHolding, removeHolding }) {
  return h("section", { className: "content-grid" }, [
    h("div", { className: "panel wide", key: "table" }, [
      h("div", { className: "panel-header", key: "header" }, [
        h("div", { key: "title" }, [h("h2", null, "我的持倉"), h("p", null, "報價快取 2 小時；失敗時會用快取、手動價格或內建示範價格。")]),
        Button({ onClick: addHolding, children: "+ 新增 ETF", title: "新增持倉" }),
      ]),
      h("div", { className: "holdings-list", key: "rows" }, portfolio.rows.map((row) => h("div", { className: "holding-row", key: row.id }, [
        Field({ label: "代號", value: row.symbol, type: "text", onChange: (value) => updateHolding(row.id, "symbol", value) }),
        Field({ label: "股數", value: row.shares, onChange: (value) => updateHolding(row.id, "shares", value) }),
        Field({ label: "均價", value: row.averageCost, step: "0.01", onChange: (value) => updateHolding(row.id, "averageCost", value) }),
        Field({ label: "手動價格", value: row.manualPrice || row.price, step: "0.01", onChange: (value) => updateHolding(row.id, "manualPrice", value) }),
        h("div", { className: "quote-cell", key: "quote" }, [
          h("span", { key: "name" }, row.profile?.name || "自訂 ETF"),
          h("strong", { key: "price" }, twdPrice.format(row.price)),
          h("small", { key: "status" }, quotes[row.symbol]?.status || "報價暫不可用"),
        ]),
        h("div", { className: "value-cell", key: "value" }, [h("span", null, "市值"), h("strong", null, twd.format(row.marketValue))]),
        Button({ variant: "ghost", onClick: () => removeHolding(row.id), children: "刪除", title: "刪除持倉" }),
      ]))),
      h("p", { className: "muted", key: "loading" }, isLoadingQuotes ? "報價更新中..." : "報價來源：Yahoo Finance 非官方查詢，必要時會 fallback。"),
    ]),
    h("aside", { className: "panel", key: "summary" }, [
      h("h2", null, "資產摘要"),
      Metric({ label: "投資市值", value: twd.format(portfolio.totalValue) }),
      Metric({ label: "現金", value: twd.format(state.cash) }),
      Metric({ label: "未實現損益", value: twd.format(portfolio.gainLoss), tone: portfolio.gainLoss >= 0 ? "good" : "bad" }),
      Metric({ label: "預估年配息", value: twd.format(portfolio.annualDividend) }),
      Field({ label: "現金", value: state.cash, onChange: (value) => updateState({ cash: toNumber(value) }) }),
      Field({
        label: "每月投入",
        value: state.monthlyContribution,
        onChange: (value) => updateState({ monthlyContribution: toNumber(value) }),
      }),
    ]),
  ]);
}

function RetirementView({ state, portfolio, projections, updateRetirementInputs }) {
  const baseProjection = projections.find((projection) => projection.key === "base") || projections[0];
  return h("section", { className: "content-grid retirement-grid" }, [
    h("div", { className: "panel", key: "inputs" }, [
      h("h2", null, "退休條件"),
      Field({ label: "目前年齡", value: state.retirementInputs.currentAge, onChange: (value) => updateRetirementInputs("currentAge", value) }),
      Field({ label: "目標退休年齡", value: state.retirementInputs.retirementAge, onChange: (value) => updateRetirementInputs("retirementAge", value) }),
      Field({
        label: "每月投入到幾歲停止",
        value: state.retirementInputs.contributionStopAge,
        onChange: (value) => updateRetirementInputs("contributionStopAge", value),
      }),
      Field({
        label: "退休後每月支出",
        value: state.retirementInputs.monthlyRetirementExpense,
        onChange: (value) => updateRetirementInputs("monthlyRetirementExpense", value),
      }),
      Field({
        label: "預估年報酬率",
        value: state.retirementInputs.annualReturn,
        step: "0.001",
        onChange: (value) => updateRetirementInputs("annualReturn", value),
      }),
      Field({
        label: "目標提領率",
        value: state.retirementInputs.withdrawalRate,
        step: "0.001",
        onChange: (value) => updateRetirementInputs("withdrawalRate", value),
      }),
      Field({
        label: "年通膨率",
        value: state.retirementInputs.inflationRate,
        step: "0.001",
        onChange: (value) => updateRetirementInputs("inflationRate", value),
      }),
      h("p", { className: "muted" }, `目前組合加權報酬參考：${pct.format(portfolio.weightedReturn)}；本頁使用你設定的年報酬率。`),
    ]),
    h("div", { className: "panel wide", key: "scenarios" }, [
      h("div", { className: "panel-header" }, [
        h("div", null, [h("h2", null, "退休資產曲線"), h("p", null, "曲線顯示退休後資產逐年下降，終點就是資產可能領完的年齡。")]),
      ]),
      h(DrawdownChart, { projections, key: "chart" }),
      h("div", { className: "scenario-grid compact", key: "cards" }, projections.map((projection) => h("article", { className: "scenario-card", key: projection.key }, [
        h("span", { className: "badge" }, projection.label),
        h("strong", null, projection.assetLastsUntilAge >= 119 ? "120 歲+" : `${projection.assetLastsUntilAge.toFixed(1)} 歲`),
        h("p", null, `退休時資產 ${twd.format(projection.retirementPortfolioValue)}`),
        h("p", null, `實際提領率 ${Number.isFinite(projection.withdrawalRate) ? pct.format(projection.withdrawalRate) : "無法估算"}`),
        h("p", null, `目標提領月額 ${twd.format(projection.safeMonthlyWithdrawal)}`),
      ]))),
      h("div", { className: "notice", key: "note" }, [
        h("strong", null, "中性情境摘要"),
        h("p", null, `退休時每月支出約 ${twd.format(baseProjection.monthlyExpenseAtRetirement)}，資產估計可支撐到 ${baseProjection.assetLastsUntilAge >= 119 ? "120 歲以上" : `${baseProjection.assetLastsUntilAge.toFixed(1)} 歲`}。`),
      ]),
    ]),
  ]);
}

function DrawdownChart({ projections }) {
  const width = 780;
  const height = 310;
  const pad = { top: 24, right: 28, bottom: 38, left: 78 };
  const allPoints = projections.flatMap((projection) => projection.drawdownSeries || []);
  const minAge = Math.min(...allPoints.map((point) => point.age));
  const maxAge = Math.max(90, ...allPoints.map((point) => point.age));
  const maxBalance = Math.max(1, ...allPoints.map((point) => point.balance));
  const colors = { conservative: "#b94435", base: "#245c7a", optimistic: "#1f7a53" };

  function x(age) {
    return pad.left + ((age - minAge) / (maxAge - minAge)) * (width - pad.left - pad.right);
  }

  function y(balance) {
    return pad.top + (1 - balance / maxBalance) * (height - pad.top - pad.bottom);
  }

  function path(points) {
    return points.map((point, index) => `${index === 0 ? "M" : "L"} ${x(point.age).toFixed(1)} ${y(point.balance).toFixed(1)}`).join(" ");
  }

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({ ratio, value: maxBalance * ratio }));
  const xTicks = Array.from({ length: 5 }, (_, index) => minAge + ((maxAge - minAge) / 4) * index);

  return h("div", { className: "chart-wrap" }, [
    h("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": "退休資產耗盡曲線", key: "svg" }, [
      h("rect", { x: 0, y: 0, width, height, rx: 8, className: "chart-bg", key: "bg" }),
      ...yTicks.map((tick) =>
        h("g", { key: `y-${tick.ratio}` }, [
          h("line", { x1: pad.left, x2: width - pad.right, y1: y(tick.value), y2: y(tick.value), className: "grid-line" }),
          h("text", { x: pad.left - 10, y: y(tick.value) + 4, textAnchor: "end", className: "axis-label" }, compactTwd(tick.value)),
        ]),
      ),
      ...xTicks.map((age) =>
        h("text", { key: `x-${age}`, x: x(age), y: height - 12, textAnchor: "middle", className: "axis-label" }, `${Math.round(age)}歲`),
      ),
      ...projections.map((projection) =>
        h("path", {
          key: projection.key,
          d: path(projection.drawdownSeries || []),
          fill: "none",
          stroke: colors[projection.key],
          strokeWidth: projection.key === "base" ? 4 : 3,
          strokeLinecap: "round",
          strokeLinejoin: "round",
        }),
      ),
    ]),
    h("div", { className: "chart-legend", key: "legend" }, projections.map((projection) =>
      h("span", { key: projection.key }, [
        h("i", { style: { backgroundColor: colors[projection.key] } }),
        `${projection.label}：${projection.assetLastsUntilAge >= 119 ? "120歲+" : `${projection.assetLastsUntilAge.toFixed(1)}歲`}`,
      ]),
    )),
  ]);
}

function compactTwd(value) {
  if (value >= 100000000) return `${(value / 100000000).toFixed(1)}億`;
  if (value >= 10000) return `${Math.round(value / 10000)}萬`;
  return number.format(value);
}

function CashflowView({ portfolio, baseProjection, cashflow, cash }) {
  const maxDividend = Math.max(...cashflow.months.map((month) => month.dividend), 1);
  const highYieldShare =
    portfolio.totalValue > 0
      ? portfolio.rows
          .filter((row) => row.profile?.category.includes("高息") || row.profile?.category.includes("高股息"))
          .reduce((sum, row) => sum + row.marketValue, 0) / portfolio.totalValue
      : 0;

  return h("section", { className: "content-grid" }, [
    h("div", { className: "panel wide", key: "calendar" }, [
      h("div", { className: "panel-header" }, [
        h("div", null, [h("h2", null, "退休現金流月曆"), h("p", null, "月配或季配只影響現金流是否平滑，不代表總報酬更好。")]),
      ]),
      h("div", { className: "month-grid" }, cashflow.months.map((month) => h("article", { className: "month-card", key: month.month }, [
        h("span", null, `${month.month} 月`),
        h("div", { className: "bar", style: { "--bar": `${Math.max(6, (month.dividend / maxDividend) * 100)}%` } }),
        h("strong", null, twd.format(month.dividend)),
        h("small", { className: month.shortfall > 0 ? "bad-text" : "good-text" }, month.shortfall > 0 ? `缺口 ${twd.format(month.shortfall)}` : `餘裕 ${twd.format(month.surplus)}`),
      ]))),
    ]),
    h("aside", { className: "panel", key: "risk" }, [
      h("h2", null, "現金緩衝"),
      Metric({ label: "配息空窗月份", value: `${cashflow.shortfallMonths} 個月`, tone: cashflow.shortfallMonths > 0 ? "bad" : "good" }),
      Metric({ label: "建議現金水位", value: twd.format(cashflow.suggestedCashBuffer) }),
      Metric({ label: "目前現金", value: twd.format(cash), tone: cash >= cashflow.suggestedCashBuffer ? "good" : "bad" }),
      h("div", { className: "notice" }, [
        h("strong", null, "系統提示"),
        h("p", null, `中性情境退休時每月支出約 ${twd.format(baseProjection.monthlyExpenseAtRetirement)}。`),
        h("p", null, cash >= cashflow.suggestedCashBuffer ? "你的現金水位足以覆蓋建議緩衝。" : "目前現金水位偏低，退休後遇到配息空窗時需要額外準備。"),
        h("p", null, highYieldShare > 0.7 ? `高股息類 ETF 佔比約 ${pct.format(highYieldShare)}，配置較集中。` : `高股息類 ETF 佔比約 ${pct.format(highYieldShare)}。`),
      ]),
      h("div", { className: "legend" }, ETF_PROFILES.slice(0, 7).map((profile) => h("span", { key: profile.symbol }, `${profile.symbol} ${DISTRIBUTION_LABELS[profile.distributionFrequency]}`))),
    ]),
  ]);
}

createRoot(document.getElementById("root")).render(h(App));
