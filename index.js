const fs = require("fs");
const moment = require("moment");
const Scrip = require("./lib/scrip");
const CapitalGain = require("./lib/capital-gain");
const Constants = require("./lib/constants");

const tradesDataFilePath = Constants.getTradesDataFilePath();
const ixPriceFilePath = Constants.getIxPriceFilePath();
const corpActionsFilePath = Constants.getCorpActionsFilePath();
// const errorFilePath = Constants.getErrorFilePath();
const capitalGainsOutputFilePath = Constants.getCapitalGainsOutputFilePath();
const defaultSeparator = Constants.getSeparator();
const newline = Constants.getNewline();
const showProgressFlag = false;


run();


async function run() {

  try {
    // Step 1 - Clear the errors file
    // await clearFile(errorFilePath);

    // Step 2 - Open and import Ix Prices
    const ixPricesRaw = fileExists(ixPriceFilePath) ? await readFileAsArray(ixPriceFilePath, true) : null;
    const ixPrices = ixPricesRaw ? importIxPrices(ixPricesRaw) : null;
    // console.log(Object.keys(ixPrices).length);

    // Step 3 - Open and import Corp Actions
    const corpActionsRaw = fileExists(corpActionsFilePath) ? await readFileAsArray(corpActionsFilePath, true) : null;
    const corpActions = corpActionsRaw ? importCorpActions(corpActionsRaw) : null;
    // console.log(corpActions);

    // Step 4 - Open, sort and import trade data
    const tradesRaw = await readFileAsArray(tradesDataFilePath, true);
    const tradesSorted = sortTrades(tradesRaw);
    const scripNamesSet = new Set();
    const scrips = importTrades(tradesSorted, scripNamesSet, ixPrices, corpActions);
    // Convert set to array and sort
    const scripNames = [...scripNamesSet];
    scripNames.sort();
    showProgress(newline.repeat(2));

    // Step 5 - Calculate Capital Gains
    calculateCapitalGains(scrips, scripNames);
    showProgress(newline.repeat(2));

    // Step 6 - Export Capital Gains to a file
    await exportCapitalGains(scrips, scripNames, capitalGainsOutputFilePath);
    showProgress(newline.repeat(2));

    // Step 7 - Export Unmatched Trades to the Capital Gains file
    await exportUnmatchedTrades(scrips, scripNames, capitalGainsOutputFilePath);
    showProgress(newline.repeat(2));

    // For IPO testing
    // const debugScrip = scrips["COAL INDIA_533278"];
    // console.log(debugScrip.toString());

    // For Bonus testing
    // const debugScrip = scrips["ADITY BIR CA_540691"];
    // console.log(debugScrip.toString());

    // For Split testing
    // const debugScrip = scrips["PHIL CAR BLK_506590"];
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


function fileExists(filepath) {
  return fs.existsSync(filepath);
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


function importCorpActions(corpActionsRaw) {
  const corpActions = {};

  for (let i = 0; i < corpActionsRaw.length; i++) {
    if (corpActionsRaw[i].trim() === "") {
      continue;
    }

    const currentRow = corpActionsRaw[i].trim().split(defaultSeparator).map(x => x ? x.trim() : null);

    if (currentRow.length < 6) {
      continue;
    }

    const [ scripCode, recordDate, execDate, actionType, actionRatio, actionPrice ] = currentRow;

    if (!corpActions.hasOwnProperty(scripCode)) {
      corpActions[scripCode] = {};
    }

    const corpActionsByScrip = corpActions[scripCode];

    if (!corpActionsByScrip.hasOwnProperty(actionType)) {
      switch (actionType) {
        case "I":
          corpActionsByScrip[actionType] = {
            ipoDate: moment(execDate, "YYYY-MM-DD"),
            ipoPrice: actionPrice ? parseFloat(actionPrice) : null
          };
          break;
        case "B":
        case "S":
          corpActionsByScrip[actionType] = [];
          break;
      }
    }

    if (["B","S"].indexOf(actionType) >= 0) {
      corpActionsByScrip[actionType].push({
        recordDate: recordDate ? moment(recordDate, "YYYY-MM-DD") : null,
        execDate: moment(execDate, "YYYY-MM-DD"),
        ratio: actionRatio
      });
    }
  }

  return corpActions;
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

  return allTrades.sort((a, b) => a.tradeDate.diff(b.tradeDate, "days"));
}


function importTrades(trades, scripNamesSet, ixPrices, corpActions) {
  const scrips = {};

  for (let trade of trades) {
    const {tradeDate, scripCode, scripName, tradeAction, tradeQty, tradePrice} = trade;
    const scripKey = scripName + "_" + scripCode;
    if (!scrips.hasOwnProperty(scripKey)) {
      const scripIxPrice = ixPrices && ixPrices.hasOwnProperty(scripCode) ? ixPrices[scripCode] : null;
      const scripCorpActions = corpActions && corpActions.hasOwnProperty(scripCode) ? corpActions[scripCode] : null;
      scrips[scripKey] = new Scrip(scripCode, scripName, scripIxPrice, scripCorpActions);
    }

    scrips[scripKey].addTrade(tradeAction, tradeDate, tradeQty, tradePrice);
    scripNamesSet.add(scripKey);
    showProgress();
  }

  return scrips;
}


function calculateCapitalGains(scrips, scripNames) {
  for (let scripName of scripNames) {
    const scrip = scrips[scripName];
    scrip.calcCapitalGains();
    showProgress();
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
        const capGainDesc = capGain.desc ? ` (${capGain.desc})` : "";
        const prefixCols = [scrip.code, scrip.name + capGainDesc].join(defaultSeparator);
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

      let bIndex = 0;
      let sIndex = 0;

      while (bIndex < scrip.buyTrades.length && sIndex < scrip.sellTrades.length) {
        const buyTrade = scrip.buyTrades[bIndex];
        const sellTrade = scrip.sellTrades[sIndex];

        if (buyTrade.quantity === 0 && sellTrade.quantity === 0) {
          bIndex++;
          sIndex++;
          continue;
        } else if (buyTrade.quantity === 0) {
          bIndex++;
          continue;
        } else if (sellTrade.quantity === 0) {
          sIndex++;
          continue;
        }

        let dataRow;
        if (buyTrade.date.diff(sellTrade.date) <= 0) {
          dataRow = getUnmatchedTradeDataRow(scrip.code, scrip.name, buyTrade, null, defaultSeparator);
          bIndex++;
        } else {
          dataRow = getUnmatchedTradeDataRow(scrip.code, scrip.name, null, sellTrade, defaultSeparator);
          sIndex++;
        }

        await appendToFile(filepath, dataRow);
        showProgress();
      }

      while (bIndex < scrip.buyTrades.length) {
        const buyTrade = scrip.buyTrades[bIndex];

        if (buyTrade.quantity === 0) {
          bIndex++;
          continue;
        }

        const dataRow = getUnmatchedTradeDataRow(scrip.code, scrip.name, buyTrade, null, defaultSeparator);
        await appendToFile(filepath, dataRow);
        bIndex++;
        showProgress();
      }

      while (sIndex < scrip.sellTrades.length) {
        const sellTrade = scrip.sellTrades[sIndex];

        if (sellTrade.quantity === 0) {
          sIndex++;
          continue;
        }

        const dataRow = getUnmatchedTradeDataRow(scrip.code, scrip.name, null, sellTrade, defaultSeparator);
        await appendToFile(filepath, dataRow);
        sIndex++;
        showProgress();
      }
    }
  } catch(err) {
    console.error(err);
  }
}


function getUnmatchedTradeDataRow(scripCode, scripName, buyTrade, sellTrade, separator = ",") {
  const prefixData = [scripCode, scripName].join(separator);
  const trade = buyTrade ? buyTrade : sellTrade;
  const type = buyTrade ? "BUY" : "SELL";
  const tradeData = trade.toStringForUnmatched(type, separator);
  const suffixData = new Array(4).fill("").join(separator);

  return [
    prefixData,
    tradeData,
    suffixData
  ].join(separator);
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
