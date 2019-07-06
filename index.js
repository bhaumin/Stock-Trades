const fs = require("fs");
const Scrip = require("./lib/scrip");
const CapitalGain = require("./lib/capital-gain");
const Constants = require("./lib/constants");

const tradesDataFilePath = Constants.getTradesDataFilePath();
const errorFilePath = Constants.getErrorFilePath();
const capitalGainsOutputFilePath = Constants.getCapitalGainsOutputFilePath();
const defaultSeparator = Constants.getSeparator();
const newline = Constants.getNewline();

// Init/Reset errors.log file
(function() {
  fs.writeFile(errorFilePath, "", "utf8", function(err) {
    if (err) {
      console.error(err);
    }
  });
})();

processStart(tradesDataFilePath, capitalGainsOutputFilePath);

async function processStart(tradesFilepath, capGainsFilePath) {
  const scripCodesSet = new Set();

  try {
    // Step 1 - Open trade data file
    const allTradesRaw = await readFileAsArray(tradesFilepath);

    // Step 2 - Import trades
    const allScrips = importTrades(allTradesRaw, scripCodesSet);
    // Convert set to array and sort
    const scripCodes = [...scripCodesSet];
    scripCodes.sort();
    showProgress(newline.repeat(2));

    // Step 3 - Calculate Capital Gains
    calculateCapitalGains(allScrips, scripCodes);
    showProgress(newline.repeat(2));

    // Step 4 - Export to a file
    await exportCapitalGains(allScrips, scripCodes, capGainsFilePath);
    showProgress(newline.repeat(2));

  } catch(err) {
    console.error(err);
  }
}

function readFileAsArray(filepath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filepath, "utf8", function(err, data) {
      if (err) {
        reject(err);
      }

      const rows = data.trim().split(newline);
      resolve(rows);
    });
  });
}

function importTrades(allTradesRaw, scripCodesSet) {
  const scrips = {};

  for (let i = 1; i < allTradesRaw.length; i++) {
    const trade = allTradesRaw[i].trim().split(",");

    if (trade.length < 7) {
      continue;
    }

    const tradeDate = trade[0];
    const tradeTime = trade[1];
    const scripCode = trade[2].trim();
    const scripName = trade[3].trim();
    const buyQty = trade[4] ? trade[4].trim() : "";
    const sellQty = trade[5] ? trade[5].trim() : "";
    const tradeAction = buyQty !== "" ? "BUY" : "SELL";
    const tradeQty = buyQty !== "" ? buyQty : sellQty;
    const tradePrice = parseFloat(trade[6]);

    if (!scrips.hasOwnProperty(scripCode)) {
      scrips[scripCode] = new Scrip(scripCode, scripName);
    }

    scrips[scripCode].addTrade(tradeAction, tradeDate, tradeTime, tradeQty, tradePrice);
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
        reject(err);
      }

      resolve();
    });
  });
}

function appendToFile(filepath, data) {
  return new Promise((resolve, reject) => {
    fs.appendFile(filepath, data + newline, "utf8", function(err) {
      if (err) {
        reject(err);
      }

      resolve();
    });
  });
}

function showProgress(char = ".") {
  process.stdout.write(char);
}
