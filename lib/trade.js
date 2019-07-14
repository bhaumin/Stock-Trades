
class Trade {
  constructor(date, time, quantity, price) {
    this.date = date;
    this.time = time;
    this.quantity = quantity;
    this.origQuantity = quantity;
    this.price = price;
  }

  clone() {
    return new Trade(this.date, this.time, this.quantity, this.price);
  }

  merge(quantity, price) {
    const totalValue = (this.quantity * this.price) + (quantity * price);
    this.quantity += quantity;
    this.origQuantity = this.quantity;
    this.price = (totalValue / this.quantity).toFixed(2);
  }

  toString(separator = ",") {
    return [
      this.date.format("DD-MMM-YYYY"),
      this.time.format("kk:mm:ss"),
      this.origQuantity,
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
