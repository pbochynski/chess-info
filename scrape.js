import { fetchTournaments as caTournaments} from "./chessarbiter-scraper.js";
import { fetchTournaments as cmTournaments} from "./chessmanager-scraper.js";
import ThrottledFetch from './throttle.js'
import * as fs from 'fs';

const MONTHS_AHEAD = process.env.MONTHS_AHEAD || 4;
const MONTHS_BACK = process.env.MONTHS_BACK || 24;
const queue = new ThrottledFetch(10, "GithubPages")

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
async function fetchFromGithubPages(year, month) {  
  const baseUrl = 'https://pbochynski.github.io/chess-info/';
  let filename = `tournaments-${year}-${month}.json`;
  let url = `${baseUrl}${filename}`;
  let response = await queue.throttledFetch(url);
  if (response.status === 200) {
    let data = await response.text();
    fs.writeFileSync(filename, data);
    console.log('Fetched', filename);
  }
}
async function fetchAll() {
  let endDate = new Date();
  endDate.setMonth(endDate.getMonth() + MONTHS_AHEAD);
  let year = endDate.getFullYear();
  let month = endDate.getMonth()+1; // 0-based to 1-based
  let monthsToScrape = MONTHS_BACK; 
  let tasks = []; 
  while (monthsToScrape > 0) {
    tasks.push(fetchFromGithubPages(year, month));
    month--;
    if (month < 1) {
      year--;
      month = 12;
    }
    monthsToScrape--;
  }  
  await Promise.allSettled(tasks);
}

async function scrapeAll(skipExisting = true) {
  let endDate = new Date();
  endDate.setMonth(endDate.getMonth() + MONTHS_AHEAD);
  let year = endDate.getFullYear();
  let month = endDate.getMonth()+1; // 0-based to 1-based
  let monthsToScrape = MONTHS_BACK; 
  await fetchAll();
  
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