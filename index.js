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
  const scripCodesSet = new Set();

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
    const scrips = importTrades(tradesSorted, ixPrices, scripCodesSet);
    // Convert set to array and sort
    const scripCodes = [...scripCodesSet];
    scripCodes.sort();
    showProgress(newline.repeat(2));

    // Step 7 - Calculate Capital Gains
    calculateCapitalGains(scrips, scripCodes);
    showProgress(newline.repeat(2));

    // Step 8 - Export to a file
    await exportCapitalGains(scrips, scripCodes, capitalGainsOutputFilePath);
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

function importTrades(trades, ixPrices, scripCodesSet) {
  const scrips = {};

  for (let trade of trades) {
    const {tradeDate, scripCode, scripName, tradeAction, tradeQty, tradePrice} = trade;
    if (!scrips.hasOwnProperty(scripCode)) {
      const scripIxPrice = ixPrices.hasOwnProperty(scripCode) ? ixPrices[scripCode] : null;
      scrips[scripCode] = new Scrip(scripCode, scripName, scripIxPrice);
    }

    scrips[scripCode].addTrade(tradeAction, tradeDate, tradeQty, tradePrice);
    scripCodesSet.add(scripCode);
    showProgress();
  }

  return scrips;
}


function calculateCapitalGains(scrips, scripCodes) {
  for (let i = 0; i < scripCodes.length; i++) {
    const scripCode = scripCodes[i];
    const scrip = scrips[scripCode];
    const success = scrip.calcCapitalGains();
    showProgress(success ? "." : "x");
  }
}

async function exportCapitalGains(scrips, scripCodes, filepath) {
  try {
    const fileHeader = getFileHeader(defaultSeparator);
    await writeToFile(filepath, fileHeader);

    for (let scripCode of scripCodes) {
      const scrip = scrips[scripCode];
      for (let i = 0; i < scrip.capitalGains.length; i++) {
        const capGain = scrip.capitalGains[i];
        const prefixCols = [scrip.code, scrip.name].join(defaultSeparator);
        const dataRow = prefixCols + defaultSeparator + capGain.toString(defaultSeparator);
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
