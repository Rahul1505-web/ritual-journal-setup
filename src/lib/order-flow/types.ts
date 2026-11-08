export type FootprintDisplayMode = "bidxask" | "delta" | "volume" | "clusters";

export interface FootprintPriceLevel {
  price: number; // bucket base price e.g. 75840
  bidVolume: number; // market sells hitting bid
  askVolume: number; // market buys lifting ask
  totalVolume: number; // bidVolume + askVolume
  delta: number; // askVolume - bidVolume
  isBuyImbalance: boolean; // diagonal ask >= diagonal bid * ratio
  isSellImbalance: boolean; // diagonal bid >= diagonal ask * ratio
}

export interface FootprintCandle {
  time: number; // candle open timestamp (ms)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
  delta: number;
  minDelta: number;
  maxDelta: number;
  cvd: number; // cumulative volume delta
  pocPrice: number; // price with maximum total volume
  levels: Map<number, FootprintPriceLevel>;
  sortedLevels: FootprintPriceLevel[]; // descending order (highest price first)
  stackedBuyImbalances?: number[]; // prices where 3+ consecutive buy imbalances exist
  stackedSellImbalances?: number[]; // prices where 3+ consecutive sell imbalances exist
}

export interface MarketTicker {
  symbol: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  lastTradeTime: number;
  lastTradeSide?: "buy" | "sell";
  lastTradeQty?: number;
}

export interface OrderFlowSettings {
  symbol: string; // e.g. "BTCUSDT"
  interval: "1m" | "3m" | "5m" | "15m";
  tickSize: number; // e.g. 10 for BTC
  imbalanceRatio: number; // e.g. 3.0 (300%)
  minImbalanceQty: number; // e.g. 0.05 BTC minimum volume to qualify for imbalance
  displayMode: FootprintDisplayMode;
  showPoc: boolean;
  showCvd: boolean;
  showStackedImbalances: boolean;
  clusterColorTheme: "classic" | "cyber" | "neon";
}

export interface LiveTrade {
  price: number;
  qty: number;
  isBuyerMaker: boolean; // true = taker sell (hit bid); false = taker buy (lift ask)
  time: number;
}
