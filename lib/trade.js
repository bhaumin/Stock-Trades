
class Trade {
  constructor(date, time, quantity, price) {
    this.date = date;
    this.time = time;
    this.quantity = quantity;
    this.price = price;
  }

  clone() {
    return new Trade(this.date, this.time, this.quantity, this.price);
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
