import { fetchTournaments as caTournaments} from "./chessarbiter-scraper.js";
import { fetchTournaments as cmTournaments} from "./chessmanager-scraper.js";
import ThrottledFetch from './throttle.js'
import * as fs from 'fs';


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
  endDate.setMonth(endDate.getMonth() + 6);
  let year = endDate.getFullYear();
  let month = endDate.getMonth()+1; // 0-based to 1-based
  let monthsToScrape = 66; 
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

async function scrapeAll() {
  await fetchAll();
  let startDate = process.env.START_DATE 
  let endDate = process.env.END_DATE
  if (!startDate || !endDate) {
    console.log('Skipping update. Please provide START_DATE and END_DATE environment variables to update data.');
    return;
  }
  
  while (startDate<=endDate) {
    let year = Number(startDate.slice(0, 4));
    let month = Number(startDate.slice(5, 7));
    await scrape(year, month);
    if (month === 12) {
      year++;
      month = 1;
    } else {
      month++;
    }
    startDate = `${year}-${month.toString().padStart(2, '0')}`;
  }  
}
scrapeAll();