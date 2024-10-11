import { fetchTournaments as caTournaments} from "./chessarbiter-scraper.js";
import { fetchTournaments as cmTournaments} from "./chessmanager-scraper.js";
import * as fs from 'fs';

async function scrape(year, month) {
  let tasks = [];
  tasks.push(caTournaments(year, month));
  tasks.push(cmTournaments(year, month));
  let results = await Promise.allSettled(tasks);
  let tournaments = [];
  for (let result of results) {
    if (result.status === 'fulfilled') {
      tournaments.push(...result.value);
    }
  }
  console.log(year, month, 'tournaments:', tournaments.length);
  fs.writeFileSync(`tournaments-${year}-${month}.json`, JSON.stringify(tournaments, null, 2));
}


async function scrapeAll(skipExisting = true) {
  let endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 6);
  let year = endDate.getFullYear();
  let month = endDate.getMonth()+1; // 0-based to 1-based
  let monthsToScrape = 5 * 12 + 6; // 5 years back + 6 months ahead
  
  while (monthsToScrape > 0) {
    let filename = `tournaments-${year}-${month}.json`;  
    if (skipExisting && fs.existsSync(filename)) {
      console.log('Skipping', filename);
    } else {
      await scrape(year, month);
    }
    // new Date(year, month).getTime() > new Date().getTime()) {
    month--;
    if (month < 1) {
      year--;
      month = 12;
    }
    monthsToScrape--;
  }  
}
scrapeAll();