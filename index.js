const fs = require("fs");
const moment = require("moment");
const Scrip = require("./lib/scrip");
const CapitalGain = require("./lib/capital-gain");
const Constants = require("./lib/constants");

const tradesDataFilePath = Constants.getTradesDataFilePath();
const ixPriceFilePath = Constants.getIxPriceFilePath();
const errorFilePath = Constants.getErrorFilePath();
const capitalGainsOutputFilePath = Constants.getCapitalGainsOutputFilePath();
const defaultSeparator = Constants.getSeparator();
const newline = Constants.getNewline();
const showProgressFlag = true;


run();


async function run() {
  const scripNamesSet = new Set();

  try {
    // Step 1 - Clear the errors file
    await clearFile(errorFilePath);

    // Step 2 - Open Ix Prices file
    const ixPricesRaw = await readFileAsArray(ixPriceFilePath, true);

    // Step 3 - Import Ix Prices
    const ixPrices = importIxPrices(ixPricesRaw);

    // console.log(Object.keys(ixPrices).length);

    // Step 4 - Open trade data file
    const tradesRaw = await readFileAsArray(tradesDataFilePath, true);

    // Step 5 - Sort trades
    const tradesSorted = sortTrades(tradesRaw);

    // Step 6 - Import trades
    const scrips = importTrades(tradesSorted, ixPrices, scripNamesSet);
    // Convert set to array and sort
    const scripNames = [...scripNamesSet];
    scripNames.sort();
    showProgress(newline.repeat(2));

    // Step 7 - Calculate Capital Gains
    calculateCapitalGains(scrips, scripNames);
    showProgress(newline.repeat(2));

    // Step 8 - Export Capital Gains to a file
    await exportCapitalGains(scrips, scripNames, capitalGainsOutputFilePath);
    showProgress(newline.repeat(2));

    // Step 9 - Export Unmatched Trades to the Capital Gains file
    await exportUnmatchedTrades(scrips, scripNames, capitalGainsOutputFilePath);
    showProgress(newline.repeat(2));

    // const debugScrip = scrips["532215"];
    // console.log(debugScrip.toString());

  } catch(err) {
    console.error(err);
  }
}


function clearFile(filepath) {
  return new Promise((resolve, reject) => {
    fs.writeFile(filepath, "", "utf8", function(err) {
    if (err) {
      console.error(err);
    }

    resolve();
    });
  });
}


function readFileAsArray(filepath, removeHeaderRow = false) {
  return new Promise((resolve, reject) => {
    fs.readFile(filepath, "utf8", function(err, data) {
      if (err) {
        return reject(err);
      }

      const rows = data.trim().split(newline);

      if (removeHeaderRow) {
        rows.shift();
      }

      return resolve(rows);
    });
  });
}


function importIxPrices(ixPricesRaw) {
  const ixPrices = {};
  for (let i = 0; i < ixPricesRaw.length; i++) {
    if (ixPricesRaw[i].trim() === "") {
      continue;
    }

    const [ scripCode, price ] = ixPricesRaw[i].trim().split(defaultSeparator);
    ixPrices[scripCode.trim()] = parseFloat(price.trim());
  }

  return ixPrices;
}


function sortTrades(tradesRaw) {
  const allTrades = [];

  for (let i = 0; i < tradesRaw.length; i++) {
    const trade = tradesRaw[i].trim().split(defaultSeparator);

    if (trade.length < 7) {
      continue;
    }

    const buyQty = trade[4] ? trade[4].trim() : "";
    const sellQty = trade[5] ? trade[5].trim() : "";

    allTrades.push({
      tradeDate: moment(trade[0].trim(), "YYYY-MM-DD"),
      scripCode: trade[2].trim(),
      scripName: trade[3].trim(),
      tradeAction: buyQty !== "" ? "BUY" : "SELL",
      tradeQty: buyQty !== "" ? parseInt(buyQty) : parseInt(sellQty),
      tradePrice: parseFloat(trade[6])
    });
  }

  return allTrades.sort((x, y) => x.tradeDate.diff(y.tradeDate));
}


function importTrades(trades, ixPrices, scripNamesSet) {
  const scrips = {};

  for (let trade of trades) {
    const {tradeDate, scripCode, scripName, tradeAction, tradeQty, tradePrice} = trade;
    if (!scrips.hasOwnProperty(scripName)) {
      const scripIxPrice = ixPrices.hasOwnProperty(scripCode) ? ixPrices[scripCode] : null;
      scrips[scripName] = new Scrip(scripCode, scripName, scripIxPrice);
    }

    scrips[scripName].addTrade(tradeAction, tradeDate, tradeQty, tradePrice);
    scripNamesSet.add(scripName);
    showProgress();
  }

  return scrips;
}


function calculateCapitalGains(scrips, scripNames) {
  for (let i = 0; i < scripNames.length; i++) {
    const scripName = scripNames[i];
    const scrip = scrips[scripName];
    const success = scrip.calcCapitalGains();
    showProgress(success ? "." : "x");
  }
}


async function exportCapitalGains(scrips, scripNames, filepath) {
  try {
    const fileHeader = getFileHeader(defaultSeparator);
    await writeToFile(filepath, fileHeader);

    for (let scripName of scripNames) {
      const scrip = scrips[scripName];
      for (let i = 0; i < scrip.capitalGains.length; i++) {
        const capGain = scrip.capitalGains[i];
        const prefixCols = [scrip.code, scrip.name].join(defaultSeparator);
        const dataRow = prefixCols + defaultSeparator + capGain.toString(defaultSeparator);
        await appendToFile(filepath, dataRow);
        showProgress();
      }

      if (scrip.capitalGains.length > 0) {
        const balanceRow = defaultSeparator + "Remaining Balance:" + defaultSeparator + scrip.balance + newline;
        await appendToFile(filepath, balanceRow);
      }
    }
  } catch(err) {
    console.error(err);
  }
}


async function exportUnmatchedTrades(scrips, scripNames, filepath) {
  try {

    await appendToFile(filepath, newline + defaultSeparator + "UNMATCHED TRADES");

    for (let scripName of scripNames) {
      const scrip = scrips[scripName];

      for (let buyTrade of scrip.buyTrades) {
        if (buyTrade.quantity === 0) {
          continue;
        }

        const dataRow = [
          scrip.code,
          scrip.name,
          buyTrade.quantity,
          buyTrade.date.format("DD-MMM-YYYY"),
          (buyTrade.quantity * buyTrade.price).toFixed(2),
          "",
          "",
          "",
          "",
          "",
          "",
          ""
        ].join(defaultSeparator);

        await appendToFile(filepath, dataRow);
        showProgress();
      }

      for (let sellTrade of scrip.sellTrades) {
        if (sellTrade.quantity === 0) {
          continue;
        }

        const dataRow = [
          scrip.code,
          scrip.name,
          sellTrade.quantity,
          "",
          "",
          "",
          sellTrade.date.format("DD-MMM-YYYY"),
          (sellTrade.quantity * sellTrade.price).toFixed(2),
          "",
          "",
          "",
          ""
        ].join(defaultSeparator);

        await appendToFile(filepath, dataRow);
        showProgress();
      }
    }
  } catch(err) {
    console.error(err);
  }
}


function getFileHeader(separator = ",") {
  const prefixCols = ["Scrip Code", "Scrip Name"].join(separator);
  return prefixCols + separator + CapitalGain.getHeader();
}


function writeToFile(filepath, data) {
  return new Promise((resolve, reject) => {
    fs.writeFile(filepath, data + newline, "utf8", function(err) {
      if (err) {
        return reject(err);
      }

      return resolve();
    });
  });
}


function appendToFile(filepath, data) {
  return new Promise((resolve, reject) => {
    fs.appendFile(filepath, data + newline, "utf8", function(err) {
      if (err) {
        return reject(err);
      }

      return resolve();
    });
  });
}


function showProgress(char = ".") {
  if (showProgressFlag) {
    process.stdout.write(char);
  }
}
