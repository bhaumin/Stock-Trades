const fs = require("fs");
const Trade = require("./trade");
const CapitalGain = require("./capital-gain");
const Constants = require("./constants");

class Scrip {
  constructor(code, name, ixPrice) {
    this.code = code;
    this.name = name;
    this.ixPrice = ixPrice;
    this.balance = 0;
    this.buyTrades = [];
    this.sellTrades = [];
    this.buyTradesDebug = [];
    this.sellTradesDebug = [];
    this.capitalGains = [];
    this.lookupBuyTradeByDate = {};
  }

  addTrade(action, date, time, quantity, price) {
    if (action === "BUY") {
      this.balance += quantity;
      this.addOrMergeTrade(this.buyTrades, date, time, quantity, price);
      this.addBuyTradeToLookup(date, this.buyTrades.length-1);
      // this.addOrMergeTrade(this.buyTradesDebug, date, time, quantity, price, false);
    } else if (action === "SELL") {
      this.balance -= quantity;
      this.addOrMergeTrade(this.sellTrades, date, time, quantity, price);
      // this.addOrMergeTrade(this.sellTradesDebug, date, time, quantity, price, false);
    } else {
      throw new Error(`Trade action ${action} not supported.`);
    }
  }

  addOrMergeTrade(trades, date, time, quantity, price, allowMerge = true) {
    const lastTrade = this.getLastTrade(trades);
    if (allowMerge && lastTrade && lastTrade.date.diff(date, "days") === 0) {
      lastTrade.merge(quantity, price);
    } else {
      trades.push(new Trade(date, time, quantity, price));
    }
  }

  addBuyTradeToLookup(date, index) {
    const key = date.format("YYYYMMDD");
    if (!this.lookupBuyTradeByDate.hasOwnProperty(key)) {
      this.lookupBuyTradeByDate[key] = index;
    }
  }

  removeBuyTradeFromLookup(date) {
    const key = date.format("YYYYMMDD");
    if (this.lookupBuyTradeByDate.hasOwnProperty(key)) {
      delete this.lookupBuyTradeByDate[key];
    }
  }

  getBuyTradeByDate(date) {
    const key = date.format("YYYYMMDD");
    if (this.lookupBuyTradeByDate.hasOwnProperty(key)) {
      const index = this.lookupBuyTradeByDate[key];
      return this.buyTrades[index];
    }

    return null;
  }

  getLastTrade(trades) {
    const n = trades.length;
    return n > 0 ? trades[n-1] : null;
  }

  calcCapitalGains() {
    let allMatch = true;
    let buyTradeIndex = 0

    for (let sellTrade of this.sellTrades) {
      while (sellTrade.quantity > 0 && buyTradeIndex < this.buyTrades.length) {
        const sameDayBuyTrade = this.getBuyTradeByDate(sellTrade.date);
        const buyTrade = sameDayBuyTrade ? sameDayBuyTrade : this.buyTrades[buyTradeIndex];

        if (buyTrade.quantity === 0) {
          this.removeBuyTradeFromLookup(buyTrade.date);
          if (!sameDayBuyTrade) {
            buyTradeIndex++;
          }
          continue;
        }

        if (sellTrade.date.diff(buyTrade.date, "days") < 0) {
          break;
        }

        const remainingQty = sellTrade.quantity - buyTrade.quantity;
        let capGainQty = 0;

        if (remainingQty < 0) {
          capGainQty = sellTrade.quantity;
          buyTrade.quantity -= capGainQty;
          sellTrade.quantity = 0;
        } else {
          capGainQty = buyTrade.quantity;
          sellTrade.quantity -= capGainQty;
          buyTrade.quantity = 0;
          this.removeBuyTradeFromLookup(buyTrade.date);
          if (!sameDayBuyTrade) {
            buyTradeIndex++;
          }
        }

        const capGain = new CapitalGain(
          capGainQty,
          buyTrade.date,
          buyTrade.price,
          sellTrade.date,
          sellTrade.price,
          this.ixPrice
        );

        this.capitalGains.push(capGain);
      }

      if (sellTrade.quantity > 0) {
        allMatch = false;
        const errorFilePath = Constants.getErrorFilePath();
        const defaultSeparator = Constants.getSeparator();
        const newline = Constants.getNewline();

        let errorMessage = `${this.name} (${this.code}) - No matching buy trades to process sell trades!`;
        errorMessage += newline + `Sell Trade: ${sellTrade.toString(defaultSeparator)}`;
        fs.appendFile(errorFilePath, errorMessage + newline, "utf8", function(err) {
          if (err) {
            console.error(err);
          }
        });
      }
    }

    return allMatch;
  }

  toString(separator = ",") {
    const newline = Constants.getNewline();

    return `
Scrip: ${this.name} (${this.code})
Indexed Rate: ${this.ixPrice ? this.ixPrice : ""}
Remaining Balance: ${this.balance}

Buy Trades Lookup:
${Object.keys(this.lookupBuyTradeByDate).map(x => x + " => " + this.lookupBuyTradeByDate[x]).join(newline)}

BUY TRADES SEPARATE:
Sr${separator}${Trade.getHeader(separator)}
${this.buyTradesDebug.map((x,i) => (i+1) + separator + x.toString(separator)).join(newline)}

BUY TRADES MERGED:
Sr${separator}${Trade.getHeader(separator)}
${this.buyTrades.map((x,i) => (i+1) + separator + x.toString(separator)).join(newline)}

SELL TRADES SEPARATE:
Sr${separator}${Trade.getHeader(separator)}
${this.sellTradesDebug.map((x,i) => (i+1) + separator + x.toString(separator)).join(newline)}

SELL TRADES MERGED:
Sr${separator}${Trade.getHeader(separator)}
${this.sellTrades.map((x,i) => (i+1) + separator + x.toString(separator)).join(newline)}

CAPITAL GAINS:
Sr${separator}${CapitalGain.getHeader(separator)}
${this.capitalGains.map((x,i) => (i+1) + separator + x.toString(separator)).join(newline)}
    `;
  }
}

/*
*/

module.exports = Scrip;
