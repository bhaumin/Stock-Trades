const fs = require("fs");
const Trade = require("./trade");
const CapitalGain = require("./capital-gain");
const Constants = require("./constants");

class Scrip {
  constructor(code, name) {
    this.code = code;
    this.name = name;
    this.ixRate = null;
    this.balance = 0;
    this.buyTrades = [];
    this.sellTrades = [];
    this.capitalGains = [];
    // this.buyTradesBackup = [];
    // this.sellTradesBackup = [];
  }

  addTrade(action, date, time, quantity, price) {
    if (action === "BUY") {
      this.addBuyTrade(new Trade(date, time, quantity, price));
    } else if (action === "SELL") {
      this.addSellTrade(new Trade(date, time, quantity, price));
    } else {
      throw new Error(`Trade action ${action} not supported.`);
    }
  }

  addBuyTrade(trade) {
    this.balance += trade.quantity;
    this.buyTrades.push(trade);
    // this.buyTradesBackup.push(trade.clone());
  }

  addSellTrade(trade) {
    this.balance -= trade.quantity;
    this.sellTrades.push(trade);
    // this.sellTradesBackup.push(trade.clone());
  }

  calcCapitalGains() {
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
          this.ixRate
        );

        this.capitalGains.push(capGain);
      }

      if (sellTrade.quantity > 0) {
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
  }

  toString(separator = ",") {
    return `
Scrip: ${this.name} (${this.code})
Indexed Rate: ${this.ixRate ? this.ixRate : ""}
Remaining Balance: ${this.balance}

CAPITAL GAINS:
Sr${separator}${CapitalGain.getHeader(separator)}
${this.capitalGains.map((x,i) => (i+1) + separator + x.toString(separator)).join("\n")}
    `;
  }
}

/*
BUY TRADES:
Sr${separator}${Trade.getHeader(separator)}
${this.buyTradesBackup.map((x,i) => (i+1) + separator + x.toString(separator)).join("\n")}

SELL TRADES:
Sr${separator}${Trade.getHeader(separator)}
${this.sellTradesBackup.map((x,i) => (i+1) + separator + x.toString(separator)).join("\n")}
*/

module.exports = Scrip;
