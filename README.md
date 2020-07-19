# Capital Gains Report
Generate capital gains report from all buy and sell stock trades with the following high level requirements (and complexities to handle):
* Trades input data may not be ordered by date
* Types of Gains - Intraday, Short-Term, Long-Term, Long-Term with Indexation (Indexation cost = Highest price on Jan 31st 2018)
* Indexation applies only for buy trades before Jan 31st 2018 and corresponding sell trade after that date
* Group all buy and sell trades by the day with the price being set to the avg price of those trades
* Calculate intraday gains prior to others
* Corporate Actions - consider IPOs, Splits, Bonus shares
* Any stock can have one or more corp actions on it
* Group all the capital gains in the report by stock and keep it sorted by the stock name
* Two or more stocks can have the same name in the raw trades data, but they will all have unique stock ticker code
