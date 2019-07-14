
class Trade {
  constructor(date, quantity, price) {
    this.date = date;
    this.quantity = quantity;
    this.origQuantity = quantity;
    this.price = price;
  }

  clone() {
    return new Trade(this.date, this.quantity, this.price);
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
      this.origQuantity,
      this.price
    ].join(separator);
  }

  static getHeader(separator = ",") {
    return [
      "Date",
      "Qty",
      "Price"
    ].join(separator);
  }
}

module.exports = Trade;
