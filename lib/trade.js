const moment = require("moment");

class Trade {
  constructor(date, time, quantity, price, isClone = false) {
    this.date = isClone ? date : moment(date, "YYYY-MM-DD");
    this.time = isClone ? time : moment(time, "kk:mm:ss");
    this.quantity = isClone ? quantity : parseInt(quantity);
    this.price = isClone ? price : parseFloat(price);
  }

  clone() {
    return new Trade(this.date, this.time, this.quantity, this.price, true);
  }

  toString(separator = ",") {
    return [
      this.date.format("DD-MMM-YYYY"),
      this.time.format("kk:mm:ss"),
      this.quantity,
      this.price
    ].join(separator);
  }

  static getHeader(separator = ",") {
    return [
      "Date",
      "Time",
      "Qty",
      "Price"
    ].join(separator);
  }
}

module.exports = Trade;
