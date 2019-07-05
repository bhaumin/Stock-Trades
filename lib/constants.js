const moment = require("moment");

class Constants {
  static getTradesDataFilePath() {
    return "files/trades_data.csv";
  }

  static getCapitalGainsOutputFilePath() {
    return "files/out/capital_gains.csv";
  }

  static getErrorFilePath() {
    return "files/errors.log";
  }

  static getIxRateDate() {
    return moment("2018-01-31", "YYYY-MM-DD");
  }

  static getSeparator() {
    return ",";
  }

  static getNewline() {
    return "\n";
  }
}

module.exports = Constants;
