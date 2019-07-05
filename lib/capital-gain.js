const Constants = require("./constants");

class CapitalGain {
  constructor(qty, bDate, bPrice, sDate, sPrice, ixRate) {
    this.quantity = qty;
    this.buyDate = bDate;
    this.buyPrice = bPrice;
    this.buyValue = this.quantity * this.buyPrice;
    this.sellDate = sDate;
    this.sellPrice = sPrice;
    this.sellValue = this.quantity * this.sellPrice;

    this.ixRate = null;
    this.ixCostBasis = null;
    this.intraDay = null;
    this.shortTerm = null;
    this.longTerm = null;
    this.longTermIx = null;

    const dateDiffInDays = sDate.diff(bDate, "days");
    const isIntraDayTrade = dateDiffInDays === 0;
    const isShortTermTrade = dateDiffInDays > 0 && dateDiffInDays < 365;
    const isLongTermTrade = dateDiffInDays >= 365;

    const ixRateDate = Constants.getIxRateDate();
    const shouldUseIxRate = bDate.diff(ixRateDate, "days") <= 0 && sDate.diff(ixRateDate, "days") > 0;

    if (shouldUseIxRate) {
      this.ixRate = ixRate;
      this.ixCostBasis = this.quantity * this.ixRate;
    }

    const capGainValue = this.sellValue - this.buyValue;
    const capGainValueIx = this.sellValue - this.ixCostBasis;

    if (isIntraDayTrade) {
      this.intraDay = capGainValue;
    } else if (isShortTermTrade) {
      this.shortTerm = shouldUseIxRate ? capGainValueIx : capGainValue;
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
