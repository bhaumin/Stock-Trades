const moment = require("moment");
const Trade = require("./trade");
const CapitalGain = require("./capital-gain");
const Constants = require("./constants");


class Scrip {

  constructor(code, name, ixPrice, corpActions) {
    this.code = code;
    this.name = name;
    this.ixPrice = ixPrice;
    this.balance = 0;
    this.buyTrades = [];
    this.sellTrades = [];
    this.buyTradesDebug = [];
    this.sellTradesDebug = [];
    this.capitalGains = [];
    this.corpActions = corpActions;
    this.lookupBuyTradeByDate = {};
    this.ipoTrade = this.createIpoTrade();
    this.bonusActionIndex = 0;

    this.sortBonusActions();
    this.sortSplitActions();
  }


  addTrade(action, date, quantity, price) {
    this.recordBonusTradeQty(date);

    if (action === "BUY") {
      this.addBonusTrade(date);
      this.balance += quantity;
      this.addOrMergeTrade(this.buyTrades, date, quantity, price);
      this.addBuyTradeToLookup(date, this.buyTrades.length-1);
      // this.addOrMergeTrade(this.buyTradesDebug, date, quantity, price, false);
    } else if (action === "SELL") {
      this.balance -= quantity;
      this.addOrMergeTrade(this.sellTrades, date, quantity, price);
      // this.addOrMergeTrade(this.sellTradesDebug, date, quantity, price, false);
    } else {
      throw new Error(`Trade action ${action} not supported.`);
    }
  }


  addOrMergeTrade(trades, date, quantity, price, allowMerge = true) {
    const lastTrade = this.getLastTrade(trades);
    if (allowMerge && lastTrade && lastTrade.date.diff(date, "days") === 0) {
      lastTrade.merge(quantity, price);
    } else {
      trades.push(new Trade(date, quantity, price));
    }
  }


  createIpoTrade() {
    if (!this.hasIpo()) {
      return null;
    }

    const ipoInfo = this.corpActions[Constants.getIpoCode()];
    return new Trade(ipoInfo.ipoDate, Infinity, ipoInfo.ipoPrice);
  }


  recordBonusTradeQty(currTradeDate = moment()) {
    if (!this.hasBonus() || this.bonusActionIndex >= this.corpActions[Constants.getBonusCode()].length) {
      return;
    }

    const bonusActions = this.corpActions[Constants.getBonusCode()];
    const currentBonusAction = bonusActions[this.bonusActionIndex];

    if (currentBonusAction.hasOwnProperty("quantity")) {
      return;
    }

    if (currentBonusAction.recordDate.diff(currTradeDate, "days") <= 0) {
      const [bonusCount, shareCount] = currentBonusAction.ratio.split(":");
      currentBonusAction["quantity"] = Math.floor(this.balance * bonusCount / shareCount);
    }
  }


  addBonusTrade(currTradeDate = moment()) {
    if (!this.hasBonus() || this.bonusActionIndex >= this.corpActions[Constants.getBonusCode()].length) {
      return;
    }

    const bonusActions = this.corpActions[Constants.getBonusCode()];
    const currentBonusAction = bonusActions[this.bonusActionIndex];

    if (currentBonusAction.execDate.diff(currTradeDate, "days") <= 0 && currentBonusAction.quantity > 0) {
      this.balance += currentBonusAction.quantity;
      this.addOrMergeTrade(this.buyTrades, currentBonusAction.execDate, currentBonusAction.quantity, 0, false);
      this.bonusActionIndex++;
    }

  }


  processRemainingBonusActions() {
    while (this.hasBonus() && this.bonusActionIndex < this.corpActions[Constants.getBonusCode()].length) {
      this.recordBonusTradeQty();
      this.addBonusTrade();
    }
  }


  applySplitActions(buyTrade, sellTradeDate = moment()) {
    if (!this.hasSplit() || !buyTrade) {
      return;
    }

    const splitActions = this.corpActions[Constants.getSplitCode()];

    while (buyTrade.splitCount < splitActions.length
      && buyTrade.date.diff(splitActions[buyTrade.splitCount].execDate, "days") < 0
      && splitActions[buyTrade.splitCount].execDate.diff(sellTradeDate, "days") <= 0) {
        const currentSplitAction = splitActions[buyTrade.splitCount];
        const [oldFaceValue, newFaceValue] = currentSplitAction.ratio.split(":");
        const newQty = Math.floor(buyTrade.quantity * (oldFaceValue / newFaceValue));
        const newPrice = (buyTrade.price * (newFaceValue / oldFaceValue)).toFixed(2);
        this.balance += newQty !== Infinity ? newQty - buyTrade.quantity : 0;
        buyTrade.quantity = newQty;
        buyTrade.price = newPrice;
        buyTrade.splitCount++;
    }
  }


  applySplitActionsToRemainingBuyTrades(startIndex) {
    let buyTradeIndex = startIndex;
    while (buyTradeIndex < this.buyTrades.length) {
      const buyTrade = this.buyTrades[buyTradeIndex];

      if (buyTrade.quantity > 0) {
        this.applySplitActions(buyTrade);
      }

      buyTradeIndex++;
    }
  }


  sortBonusActions() {
    if (!this.hasBonus()) {
      return;
    }

    const bonusActions = this.corpActions[Constants.getBonusCode()];
    bonusActions.sort((a,b) => a.recordDate.diff(b.recordDate, "days"));
  }


  sortSplitActions() {
    if (!this.hasSplit()) {
      return;
    }

    const splitActions = this.corpActions[Constants.getSplitCode()];
    splitActions.sort((a,b) => a.execDate.diff(b.execDate, "days"));
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
    // Process all remaining bonus actions, if any
    this.processRemainingBonusActions();

    let buyTradeIndex = 0

    for (let sellTrade of this.sellTrades) {
      while (sellTrade.quantity > 0 && buyTradeIndex < this.buyTrades.length) {
        const sameDayBuyTrade = this.getBuyTradeByDate(sellTrade.date);

        // Bonus and other $0 buy trades cannot be counted for intraday calculation
        const isIntraDayBuyTrade = sameDayBuyTrade && sameDayBuyTrade.price > 0;

        // Check if there is a same day buy trade, otherwise go FIFO
        const buyTrade = isIntraDayBuyTrade ? sameDayBuyTrade : this.buyTrades[buyTradeIndex];

        if (buyTrade.quantity === 0) {
          this.removeBuyTradeFromLookup(buyTrade.date);
          if (!isIntraDayBuyTrade) {
            buyTradeIndex++;
          }
          continue;
        }

        if (sellTrade.date.diff(buyTrade.date, "days") < 0) {
          break;
        }

        this.applySplitActions(buyTrade, sellTrade.date);

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
          if (!isIntraDayBuyTrade) {
            buyTradeIndex++;
          }
        }

        this.recordCapitalGain(capGainQty, buyTrade.date, buyTrade.price, sellTrade.date, sellTrade.price);
      }

      // If there is no matching buy trades, look if there was an IPO
      if (sellTrade.quantity > 0 && this.hasIpo()) {
        const sellQty = sellTrade.quantity;
        this.balance += sellQty;
        sellTrade.quantity = 0;

        this.applySplitActions(this.ipoTrade, sellTrade.date);
        this.recordCapitalGain(sellQty, this.ipoTrade.date, this.ipoTrade.price, sellTrade.date, sellTrade.price, "IPO");
      }

    }

    this.applySplitActionsToRemainingBuyTrades(buyTradeIndex);
  }


  recordCapitalGain(quantity, buyDate, buyPrice, sellDate, sellPrice, desc) {
    const periodStartDate = Constants.getCapitalGainsPeriodStartDate();

    // No need to record capital gain, if sell date before period start date
    if (sellDate.diff(periodStartDate) < 0) {
      return;
    }

    const capGain = new CapitalGain(
      quantity,
      buyDate,
      buyPrice,
      sellDate,
      sellPrice,
      this.ixPrice,
      desc
    );

    this.capitalGains.push(capGain);
  }


  hasIpo() {
    return this.corpActions && this.corpActions.hasOwnProperty(Constants.getIpoCode());
  }

  hasBonus() {
    return this.corpActions && this.corpActions.hasOwnProperty(Constants.getBonusCode());
  }

  hasSplit() {
    return this.corpActions && this.corpActions.hasOwnProperty(Constants.getSplitCode());
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
