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
    this.capitalGains = [];
    this.buyTradesMergedDebug = [];
    this.sellTradesMergedDebug = [];
    this.buyTradesSepDebug = [];
    this.sellTradesSepDebug = [];
  }

  addTrade(action, date, time, quantity, price) {
    if (action === "BUY") {
      this.balance += quantity;
      this.addOrMergeTrade(this.buyTrades, date, time, quantity, price);
      // this.addOrMergeTrade(this.buyTradesSepDebug, date, time, quantity, price, false);
      // this.addOrMergeTrade(this.buyTradesMergedDebug, date, time, quantity, price, true);
    } else if (action === "SELL") {
      this.balance -= quantity;
      this.addOrMergeTrade(this.sellTrades, date, time, quantity, price);
      // this.addOrMergeTrade(this.sellTradesSepDebug, date, time, quantity, price, false);
      // this.addOrMergeTrade(this.sellTradesMergedDebug, date, time, quantity, price, true);
    } else {
      throw new Error(`Trade action ${action} not supported.`);
    }
  }

  addOrMergeTrade(trades, date, time, quantity, price, allowMerge = true) {
    const lastTrade = this.getLastTrade(trades);
    if (allowMerge && lastTrade && lastTrade.date.diff(date, "days") === 0) {
      const totalValue = (lastTrade.quantity * lastTrade.price) + (quantity * price);
      const totalQty = lastTrade.quantity + quantity;
      lastTrade.price = (totalValue / totalQty).toFixed(2);
      lastTrade.quantity = totalQty;
    } else {
      trades.push(new Trade(date, time, quantity, price));
    }
  }

  getLastTrade(trades) {
    const n = trades.length;
    return n > 0 ? trades[n-1] : null;
  }

  calcCapitalGains() {
    let allMatch = true;
    for (let sellTrade of this.sellTrades) {
      while (sellTrade.quantity > 0 && this.buyTrades.length > 0) {
        const buyTrade = this.buyTrades[0];

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
          this.buyTrades.shift();
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

BUY TRADES SEPARATE:
Sr${separator}${Trade.getHeader(separator)}
${this.buyTradesSepDebug.map((x,i) => (i+1) + separator + x.toString(separator)).join(newline)}

BUY TRADES MERGED:
Sr${separator}${Trade.getHeader(separator)}
${this.buyTradesMergedDebug.map((x,i) => (i+1) + separator + x.toString(separator)).join(newline)}

SELL TRADES SEPARATE:
Sr${separator}${Trade.getHeader(separator)}
${this.sellTradesSepDebug.map((x,i) => (i+1) + separator + x.toString(separator)).join(newline)}

SELL TRADES MERGED:
Sr${separator}${Trade.getHeader(separator)}
${this.sellTradesMergedDebug.map((x,i) => (i+1) + separator + x.toString(separator)).join(newline)}

CAPITAL GAINS:
Sr${separator}${CapitalGain.getHeader(separator)}
${this.capitalGains.map((x,i) => (i+1) + separator + x.toString(separator)).join(newline)}
    `;
  }
}

/*
*/

module.exports = Scrip;
