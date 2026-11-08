import type {
  FootprintCandle,
  FootprintPriceLevel,
  LiveTrade,
  MarketTicker,
  OrderFlowSettings,
} from "./types";

export function getIntervalMilliseconds(interval: string): number {
  switch (interval) {
    case "1m":
      return 60 * 1000;
    case "3m":
      return 3 * 60 * 1000;
    case "5m":
      return 5 * 60 * 1000;
    case "15m":
      return 15 * 60 * 1000;
    case "1h":
      return 60 * 60 * 1000;
    default:
      return 60 * 1000;
  }
}

export function roundToTick(price: number, tickSize: number): number {
  if (tickSize <= 0) return price;
  const inv = 1 / tickSize;
  return Math.round(price * inv) / inv;
}

export class OrderFlowEngine {
  private settings: OrderFlowSettings;
  private ws: WebSocket | null = null;
  private tickerWs: WebSocket | null = null;
  private isDestroyed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectionStatus: "connecting" | "connected" | "reconnecting" | "disconnected" = "disconnected";

  private candles: FootprintCandle[] = [];
  private ticker: MarketTicker | null = null;
  private runningCvd = 0;

  // Listeners
  private onCandlesChangeCallbacks: Array<(candles: FootprintCandle[]) => void> = [];
  private onTickerChangeCallbacks: Array<(ticker: MarketTicker) => void> = [];
  private onConnectionChangeCallbacks: Array<(status: "connecting" | "connected" | "reconnecting" | "disconnected") => void> = [];
  private onLiveTradeCallbacks: Array<(trade: LiveTrade) => void> = [];

  constructor(settings: OrderFlowSettings) {
    this.settings = settings;
  }

  public getCandles(): FootprintCandle[] {
    return this.candles;
  }

  public getTicker(): MarketTicker | null {
    return this.ticker;
  }

  public getSettings(): OrderFlowSettings {
    return this.settings;
  }

  public updateSettings(newSettings: Partial<OrderFlowSettings>) {
    const symbolChanged = newSettings.symbol && newSettings.symbol !== this.settings.symbol;
    const intervalChanged = newSettings.interval && newSettings.interval !== this.settings.interval;
    const tickSizeChanged = newSettings.tickSize && newSettings.tickSize !== this.settings.tickSize;
    const imbalanceRatioChanged =
      newSettings.imbalanceRatio && newSettings.imbalanceRatio !== this.settings.imbalanceRatio;

    this.settings = { ...this.settings, ...newSettings };

    if (symbolChanged || intervalChanged) {
      this.reconnect();
    } else if (tickSizeChanged || imbalanceRatioChanged) {
      // Recompute levels and imbalances for all existing candles
      this.recalculateAllCandles();
      this.notifyCandlesChange();
    }
  }

  public onCandles(cb: (candles: FootprintCandle[]) => void): () => void {
    this.onCandlesChangeCallbacks.push(cb);
    return () => {
      this.onCandlesChangeCallbacks = this.onCandlesChangeCallbacks.filter((c) => c !== cb);
    };
  }

  public onTicker(cb: (ticker: MarketTicker) => void): () => void {
    this.onTickerChangeCallbacks.push(cb);
    return () => {
      this.onTickerChangeCallbacks = this.onTickerChangeCallbacks.filter((c) => c !== cb);
    };
  }

  public onConnection(cb: (status: "connecting" | "connected" | "reconnecting" | "disconnected") => void): () => void {
    this.onConnectionChangeCallbacks.push(cb);
    return () => {
      this.onConnectionChangeCallbacks = this.onConnectionChangeCallbacks.filter((c) => c !== cb);
    };
  }

  public onTrade(cb: (trade: LiveTrade) => void): () => void {
    this.onLiveTradeCallbacks.push(cb);
    return () => {
      this.onLiveTradeCallbacks = this.onLiveTradeCallbacks.filter((c) => c !== cb);
    };
  }

  public async start() {
    this.isDestroyed = false;
    this.setConnectionStatus("connecting");
    await this.seedInitialCandles();
    this.connectWebSockets();
  }

  public stop() {
    this.isDestroyed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.tickerWs) {
      this.tickerWs.close();
      this.tickerWs = null;
    }
    this.setConnectionStatus("disconnected");
  }

  private reconnect() {
    this.stop();
    this.candles = [];
    this.runningCvd = 0;
    this.notifyCandlesChange();
    void this.start();
  }

  private setConnectionStatus(status: "connecting" | "connected" | "reconnecting" | "disconnected") {
    this.connectionStatus = status;
    this.onConnectionChangeCallbacks.forEach((cb) => cb(status));
  }

  private notifyCandlesChange() {
    this.onCandlesChangeCallbacks.forEach((cb) => cb([...this.candles]));
  }

  private notifyTickerChange() {
    if (this.ticker) {
      this.onTickerChangeCallbacks.forEach((cb) => cb({ ...this.ticker! }));
    }
  }

  // ── SEED INITIAL CANDLES FROM REST API ──
  private async seedInitialCandles() {
    const symbol = this.settings.symbol.toUpperCase();
    const interval = this.settings.interval;
    const intervalMs = getIntervalMilliseconds(interval);

    try {
      // 1. Fetch background historical klines
      const klineUrls = [
        `https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=50`,
        `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=50`,
      ];

      let rawKlines: any[] = [];
      for (const url of klineUrls) {
        try {
          const resp = await fetch(url, { signal: AbortSignal.timeout(4500) });
          if (resp.ok) {
            rawKlines = await resp.json();
            if (Array.isArray(rawKlines) && rawKlines.length > 0) break;
          }
        } catch {
          // Try next URL fallback
        }
      }

      if (Array.isArray(rawKlines) && rawKlines.length > 0) {
        const seededCandles: FootprintCandle[] = [];
        let cvdAcc = 0;

        for (const k of rawKlines) {
          const openTime = Number(k[0]);
          const open = parseFloat(k[1]);
          const high = parseFloat(k[2]);
          const low = parseFloat(k[3]);
          const close = parseFloat(k[4]);
          const vol = parseFloat(k[5]);
          const takerBuyBaseVol = parseFloat(k[9]) || vol * 0.5;
          const takerSellVol = Math.max(0, vol - takerBuyBaseVol);
          const delta = takerBuyBaseVol - takerSellVol;
          cvdAcc += delta;

          const candle: FootprintCandle = {
            time: openTime,
            open,
            high,
            low,
            close,
            volume: vol,
            buyVolume: takerBuyBaseVol,
            sellVolume: takerSellVol,
            delta,
            minDelta: Math.min(0, delta),
            maxDelta: Math.max(0, delta),
            cvd: cvdAcc,
            pocPrice: roundToTick((open + high + low + close) / 4, this.settings.tickSize),
            levels: new Map(),
            sortedLevels: [],
          };

          // Generate base synthetic profile distribute between high and low if no tick data yet
          this.populateInitialLevelsForCandle(candle);
          seededCandles.push(candle);
        }

        this.candles = seededCandles;
        this.runningCvd = cvdAcc;
      }

      // 2. Fetch recent 1000 aggTrades to build granular Footprint clusters for the latest candles!
      const aggUrls = [
        `https://data-api.binance.vision/api/v3/aggTrades?symbol=${symbol}&limit=1000`,
        `https://api.binance.com/api/v3/aggTrades?symbol=${symbol}&limit=1000`,
      ];

      let rawAggs: any[] = [];
      for (const url of aggUrls) {
        try {
          const resp = await fetch(url, { signal: AbortSignal.timeout(4500) });
          if (resp.ok) {
            rawAggs = await resp.json();
            if (Array.isArray(rawAggs) && rawAggs.length > 0) break;
          }
        } catch {}
      }

      if (Array.isArray(rawAggs) && rawAggs.length > 0) {
        for (const t of rawAggs) {
          this.processTrade({
            price: parseFloat(t.p),
            qty: parseFloat(t.q),
            isBuyerMaker: Boolean(t.m),
            time: Number(t.T),
          });
        }
      }

      this.notifyCandlesChange();
    } catch (err) {
      console.warn("[OrderFlowEngine] Seed initial candles warning:", err);
    }
  }

  private populateInitialLevelsForCandle(candle: FootprintCandle) {
    const tickSize = this.settings.tickSize;
    const startPrice = roundToTick(candle.low, tickSize);
    const endPrice = roundToTick(candle.high, tickSize);
    const steps = Math.max(1, Math.round((endPrice - startPrice) / tickSize));
    const avgVolPerLevel = candle.volume / (steps + 1);

    const levels = new Map<number, FootprintPriceLevel>();
    for (let p = startPrice; p <= endPrice + 0.0001; p += tickSize) {
      const pKey = Math.round(p * 100) / 100;
      const isUp = candle.close >= candle.open;
      const buyFraction = isUp ? 0.58 : 0.42;
      const askVol = avgVolPerLevel * buyFraction;
      const bidVol = avgVolPerLevel * (1 - buyFraction);

      levels.set(pKey, {
        price: pKey,
        bidVolume: bidVol,
        askVolume: askVol,
        totalVolume: askVol + bidVol,
        delta: askVol - bidVol,
        isBuyImbalance: false,
        isSellImbalance: false,
      });
    }

    candle.levels = levels;
    this.updateCandleCalculations(candle);
  }

  // ── WEBSOCKET CONNECTION ENGINE ──
  private connectWebSockets() {
    if (this.isDestroyed) return;

    const symLower = this.settings.symbol.toLowerCase();
    const wsEndpoints = [
      `wss://data-stream.binance.vision/ws/${symLower}@aggTrade`,
      `wss://stream.binance.com:9443/ws/${symLower}@aggTrade`,
      `wss://fstream.binance.com/ws/${symLower}@aggTrade`,
    ];

    let currentEndpointIndex = 0;

    const tryNextEndpoint = () => {
      if (this.isDestroyed) return;
      const url = wsEndpoints[currentEndpointIndex % wsEndpoints.length]!;
      currentEndpointIndex++;

      try {
        if (this.ws) {
          this.ws.close();
          this.ws = null;
        }

        const socket = new WebSocket(url);
        this.ws = socket;

        socket.onopen = () => {
          if (this.isDestroyed) {
            socket.close();
            return;
          }
          this.setConnectionStatus("connected");
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.e === "aggTrade") {
              const trade: LiveTrade = {
                price: parseFloat(data.p),
                qty: parseFloat(data.q),
                isBuyerMaker: Boolean(data.m),
                time: Number(data.T),
              };
              this.processTrade(trade);
              this.onLiveTradeCallbacks.forEach((cb) => cb(trade));
            }
          } catch {}
        };

        socket.onerror = () => {
          // Socket error
        };

        socket.onclose = () => {
          if (!this.isDestroyed) {
            this.setConnectionStatus("reconnecting");
            this.reconnectTimer = setTimeout(() => {
              tryNextEndpoint();
            }, 2000);
          }
        };
      } catch (err) {
        if (!this.isDestroyed) {
          this.reconnectTimer = setTimeout(() => tryNextEndpoint(), 3000);
        }
      }
    };

    tryNextEndpoint();
    this.connectTickerSocket();
  }

  private connectTickerSocket() {
    if (this.isDestroyed) return;
    const symLower = this.settings.symbol.toLowerCase();
    const tickerUrl = `wss://data-stream.binance.vision/ws/${symLower}@ticker`;

    try {
      const socket = new WebSocket(tickerUrl);
      this.tickerWs = socket;

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.e === "24hrTicker") {
            const t: MarketTicker = {
              symbol: data.s,
              price: parseFloat(data.c),
              change24h: parseFloat(data.P),
              high24h: parseFloat(data.h),
              low24h: parseFloat(data.l),
              volume24h: parseFloat(data.v),
              lastTradeTime: Number(data.E),
              lastTradeSide: this.ticker?.lastTradeSide || "buy",
              lastTradeQty: this.ticker?.lastTradeQty || 0,
            };
            this.ticker = t;
            this.notifyTickerChange();
          }
        } catch {}
      };
    } catch {}
  }

  // ── REAL-TIME TRADE AGGREGATION & CANDLE BUCKETING ──
  public processTrade(trade: LiveTrade) {
    const intervalMs = getIntervalMilliseconds(this.settings.interval);
    const candleOpenTime = Math.floor(trade.time / intervalMs) * intervalMs;
    const tickSize = this.settings.tickSize;
    const bucketPrice = roundToTick(trade.price, tickSize);

    // Update Live Ticker Price
    if (this.ticker) {
      this.ticker.price = trade.price;
      this.ticker.lastTradeTime = trade.time;
      this.ticker.lastTradeSide = trade.isBuyerMaker ? "sell" : "buy";
      this.ticker.lastTradeQty = trade.qty;
      this.notifyTickerChange();
    } else {
      this.ticker = {
        symbol: this.settings.symbol,
        price: trade.price,
        change24h: 0,
        high24h: trade.price,
        low24h: trade.price,
        volume24h: 0,
        lastTradeTime: trade.time,
        lastTradeSide: trade.isBuyerMaker ? "sell" : "buy",
        lastTradeQty: trade.qty,
      };
      this.notifyTickerChange();
    }

    // Find or create candle
    let candle = this.candles.find((c) => c.time === candleOpenTime);

    if (!candle) {
      // New candle opened!
      const lastCandle = this.candles[this.candles.length - 1];
      const initialOpen = lastCandle ? lastCandle.close : trade.price;

      candle = {
        time: candleOpenTime,
        open: initialOpen,
        high: trade.price,
        low: trade.price,
        close: trade.price,
        volume: 0,
        buyVolume: 0,
        sellVolume: 0,
        delta: 0,
        minDelta: 0,
        maxDelta: 0,
        cvd: this.runningCvd,
        pocPrice: bucketPrice,
        levels: new Map(),
        sortedLevels: [],
      };

      this.candles.push(candle);
      // Keep up to 60 candles in memory
      if (this.candles.length > 60) {
        this.candles.shift();
      }
    }

    // Update OHLC
    candle.high = Math.max(candle.high, trade.price);
    candle.low = Math.min(candle.low, trade.price);
    candle.close = trade.price;
    candle.volume += trade.qty;

    // Is buyer maker?
    // If true -> Market Seller hit Bid (Sell Volume)
    // If false -> Market Buyer lifted Ask (Buy Volume)
    const isSell = trade.isBuyerMaker;
    if (isSell) {
      candle.sellVolume += trade.qty;
    } else {
      candle.buyVolume += trade.qty;
    }

    candle.delta = candle.buyVolume - candle.sellVolume;
    candle.minDelta = Math.min(candle.minDelta, candle.delta);
    candle.maxDelta = Math.max(candle.maxDelta, candle.delta);

    // Update Price Level Bucket
    const pKey = Math.round(bucketPrice * 100) / 100;
    let level = candle.levels.get(pKey);

    if (!level) {
      level = {
        price: pKey,
        bidVolume: 0,
        askVolume: 0,
        totalVolume: 0,
        delta: 0,
        isBuyImbalance: false,
        isSellImbalance: false,
      };
      candle.levels.set(pKey, level);
    }

    if (isSell) {
      level.bidVolume += trade.qty;
    } else {
      level.askVolume += trade.qty;
    }

    level.totalVolume = level.bidVolume + level.askVolume;
    level.delta = level.askVolume - level.bidVolume;

    // Recalculate sorted levels, POC, and diagonal imbalances
    this.updateCandleCalculations(candle);

    // Update running CVD
    this.recalculateCvd();
    this.notifyCandlesChange();
  }

  // ── CANDLE CALCULATIONS (POC, IMBALANCES, STACKED IMBALANCES) ──
  private updateCandleCalculations(candle: FootprintCandle) {
    // Sort levels descending by price (highest price first: e.g. 75850, 75840, 75830...)
    const sorted = Array.from(candle.levels.values()).sort((a, b) => b.price - a.price);
    candle.sortedLevels = sorted;

    let maxVol = -1;
    let poc = candle.close;

    for (const lvl of sorted) {
      if (lvl.totalVolume > maxVol) {
        maxVol = lvl.totalVolume;
        poc = lvl.price;
      }
    }
    candle.pocPrice = poc;

    // Diagonal Imbalance Calculation
    // In order flow: Compare Ask at Price P (buyer) with Bid at Price P-1 (seller one tick below)
    const ratio = this.settings.imbalanceRatio;
    const minQty = this.settings.minImbalanceQty;

    const stackedBuys: number[] = [];
    const stackedSells: number[] = [];
    let consecutiveBuys = 0;
    let consecutiveSells = 0;

    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i]!;
      const below = sorted[i + 1];

      // Buy Imbalance: Ask[i] >= Bid[i+1] * ratio (diagonal upward buying aggressive push)
      if (below && below.bidVolume > 0 && current.askVolume >= minQty) {
        if (current.askVolume >= below.bidVolume * ratio) {
          current.isBuyImbalance = true;
          consecutiveBuys++;
          if (consecutiveBuys >= 3) {
            stackedBuys.push(current.price);
          }
        } else {
          current.isBuyImbalance = false;
          consecutiveBuys = 0;
        }
      } else {
        current.isBuyImbalance = false;
        consecutiveBuys = 0;
      }

      // Sell Imbalance: Bid[i+1] >= Ask[i] * ratio (diagonal downward selling aggressive push)
      if (below && current.askVolume > 0 && below.bidVolume >= minQty) {
        if (below.bidVolume >= current.askVolume * ratio) {
          below.isSellImbalance = true;
          consecutiveSells++;
          if (consecutiveSells >= 3) {
            stackedSells.push(below.price);
          }
        } else {
          below.isSellImbalance = false;
          consecutiveSells = 0;
        }
      } else {
        if (below) below.isSellImbalance = false;
        consecutiveSells = 0;
      }
    }

    candle.stackedBuyImbalances = stackedBuys;
    candle.stackedSellImbalances = stackedSells;
  }

  private recalculateCvd() {
    let acc = 0;
    for (const c of this.candles) {
      acc += c.delta;
      c.cvd = acc;
    }
    this.runningCvd = acc;
  }

  private recalculateAllCandles() {
    for (const candle of this.candles) {
      this.updateCandleCalculations(candle);
    }
  }
}
