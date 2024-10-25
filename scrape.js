import { fetchTournaments as caTournaments} from "./chessarbiter-scraper.js";
import { fetchTournaments as cmTournaments} from "./chessmanager-scraper.js";
import ThrottledFetch from './throttle.js'
import * as fs from 'fs';
import Geo from './geo.js'; 

const queue = new ThrottledFetch(10, "GithubPages")
const geo = new Geo();

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
  tournaments = addGeoTags(tournaments);
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
  let monthsToScrape = 126; // 10 years back + 6 months ahead 
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

function addGeoTags(tournaments) {
  for (let t of tournaments) {
    let best = geo.find(t.city);  
    if (best) {
      t.geo = best
    }
  }
  return tournaments;
}

function addGeoTagsToFiles() {
  // scan current directory for files with tournaments
  let files = fs.readdirSync('.');
  for (let file of files) {
    if (file.startsWith('tournaments-') && file.endsWith('.json')) {
      let tournaments = JSON.parse(fs.readFileSync(file, 'utf8'));
      console.log('Processing', file);
      addGeoTags(tournaments);
      fs.writeFileSync(file, JSON.stringify(tournaments, null, 2));
    }
  }
}


async function scrapeAll() {
  await fetchAll();
  // addGeoTagsToFiles();
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