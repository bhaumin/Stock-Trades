const Constants = require("./constants");

class CapitalGain {
  constructor(qty, bDate, bPrice, sDate, sPrice, ixPrice) {
    this.quantity = qty;
    this.buyDate = bDate;
    this.buyPrice = bPrice;
    this.buyValue = this.quantity * this.buyPrice;
    this.sellDate = sDate;
    this.sellPrice = sPrice;
    this.sellValue = this.quantity * this.sellPrice;
    this.ixPrice = ixPrice;

    this.ixCostBasis = null;
    this.intraDay = null;
    this.shortTerm = null;
    this.longTerm = null;
    this.longTermIx = null;

    const dateDiffInDays = sDate.diff(bDate, "days");
    const isIntraDayTrade = dateDiffInDays === 0;
    const isShortTermTrade = dateDiffInDays > 0 && dateDiffInDays < 365;
    const isLongTermTrade = dateDiffInDays >= 365;

    const ixPriceDate = Constants.getIxPriceDate();
    const shouldUseIxPrice = this.ixPrice && bDate.diff(ixPriceDate, "days") <= 0 && sDate.diff(ixPriceDate, "days") > 0;

    this.ixCostBasis = shouldUseIxPrice ? this.quantity * this.ixPrice : null;

    const capGainValue = this.sellValue - this.buyValue;
    const capGainValueIx = shouldUseIxPrice ? this.sellValue - this.ixCostBasis : null;

    if (isIntraDayTrade) {
      this.intraDay = capGainValue;
    } else if (isShortTermTrade) {
      this.shortTerm = capGainValue;
    } else if (isLongTermTrade) {
      this.longTerm = capGainValue;
      this.longTermIx = capGainValueIx;
    }
  }

  toString(separator = ",") {
    return [
      this.quantity,
      this.buyDate.format("DD-MMM-YYYY"),
      this.buyValue.toFixed(2),
      this.ixCostBasis ? this.ixCostBasis.toFixed(2) : "",
      this.sellDate.format("DD-MMM-YYYY"),
      this.sellValue.toFixed(2),
      this.intraDay ? this.intraDay.toFixed(2) : "",
      this.shortTerm ? this.shortTerm.toFixed(2) : "",
      this.longTerm ? this.longTerm.toFixed(2) : "",
      this.longTermIx ? this.longTermIx.toFixed(2) : ""
    ].join(separator);
  }

  static getHeader(separator = ",") {
    return [
      "Qty",
      "Buy Date",
      "Buy Value",
      "Ix Cost",
      "Sell Date",
      "Sell Value",
      "ITD P/L",
      "ST P/L",
      "LT P/L",
      "LT P/L (Ix)"
    ].join(separator);
  }

}

module.exports = CapitalGain;
