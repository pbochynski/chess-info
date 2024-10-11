import { parseQueryString } from "./query-parser.js";

let tournaments = [];

function tournamentDiv(tournament) {
  const div = document.createElement('div');
  div.classList.add('tournament');
  const title = document.createElement('p');
  const a = document.createElement('a');
  a.href = tournament.link;
  a.target = "_blank";
  a.textContent = tournament.title;
  title.appendChild(a);
  div.appendChild(title);
  const date = document.createElement('small');
  date.textContent = `${tournament.date}, ${tournament.city}, (${tournament.category || tournament.tempo})`;
  div.appendChild(date);
  return div;


}
async function loadTournamentsJson(year, month) {
  let res = await fetch(`tournaments-${year}-${month}.json`);
  if (res.status !== 200) {
    return [];
  }
  return await res.json();
}

// Load tournaments from a JSON files named tournaments-${year}-${month}.json from last 4 years
// using fetch API 
async function loadTournaments() {
  let endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 6);
  let year = endDate.getFullYear();
  let month = endDate.getMonth() + 1;
  let monthsToScrape = 5 * 12 + 6; // 5 years back + 6 months ahead


  let tasks = [];
  while (monthsToScrape > 0) {
    tasks.push(loadTournamentsJson(year, month));
    month--;
    if (month < 1) {
      year--;
      month = 12;
    }
    monthsToScrape--;
  }
  let ids = {}
  let results = await Promise.allSettled(tasks);
  for (let result of results) {
    if (result.status === 'fulfilled') {
      console.log("tournaments loaded");
      for (let t of result.value) {
        let id = (t.year || "") + t.id
        if (!ids[id]) {
          tournaments.push(t);
          ids[id] = true;
        } else {
          console.log("duplicate tournament", id);
        }
      }
    }
  }
  tournaments.sort((a, b) => a.date.localeCompare(b.date));
  console.log("Loaded tournaments:", tournaments.length);
}
function playerSearchScore(tournament, params) {
  let score = 0
  if (!tournament.players)
    return 0;
  let qp = params.filter(p => p.key.startsWith('player.')).map(p => { return { key: p.key.slice(7), value: p.value } });
  if (qp.length === 0) {
    return 0;
  }

  tournament.players.forEach(p => {
    let ok = true;
    for (let param of qp) {
      if (!p[param.key] || !p[param.key].toLowerCase().includes(param.value.toLowerCase())) {
        ok = false;
        break
      }
    }
    if (ok) {
      score += 1;
    }
  });

  return score;
}

function searchScore(tournament, query) {
  let score = 0
  let params = parseQueryString(query);
  if (params.some(p => p.key.startsWith('player.'))) {
    score += playerSearchScore(tournament, params);
    if (score == 0) {
      return 0;
    }
  }
  let ok = true;
  for (let param of params) {
    if (!param.key.startsWith('player.')) {
      if (!tournament[param.key] || !tournament[param.key].toString().toLowerCase().includes(param.value.toLowerCase())) {
        ok = false;
        break;
      }
      score += 1;
    }
  }
  if (!ok) {
    score = 0;
  }
  return score;

}



function search(query) {
  console.log("searching for", query);
  for (let tournament of tournaments) {
    tournament.score = searchScore(tournament, query);
  }
  // filter by score > 0 and sort by date
  return tournaments.filter(t => t.score > 0).sort((a, b) => b.date.localeCompare(a.date));
}

async function performSearch(query) {
  const tournamentsContainer = document.getElementById("tournaments");
  let tournaments = search(query);
  console.log("search results:", tournaments.length);
  tournamentsContainer.innerHTML = "";
  tournaments.forEach(tournament => {
    tournamentsContainer.appendChild(tournamentDiv(tournament));
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const searchBtn = document.getElementById("search-btn");
  const searchInput = document.getElementById("search");

  // Search button click event
  searchBtn.onclick = async () => {
    let query = searchInput.value.trim();
    if (query === "") {
      // Optionally handle empty searches
      return;
    }

    // Update the URL with the search query
    const newUrl = `${window.location.pathname}?q=${encodeURIComponent(query)}`;
    history.pushState({ query }, "", newUrl);

    // Perform the search and update the UI
    performSearch(query);
  };

  // Enter key event listener
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      searchBtn.click();
    }
  });

  // Handle back/forward navigation
  window.addEventListener("popstate", (event) => {
    if (event.state && event.state.query) {
      searchInput.value = event.state.query;
      performSearch(event.state.query);
    } else {
      // Optionally handle the state when there's no query (e.g., clear results)
      searchInput.value = "";
      tournamentsContainer.innerHTML = "";
    }
  });

  // On initial load, check if there's a query in the URL
  const urlParams = new URLSearchParams(window.location.search);
  const initialQuery = urlParams.get('q');
  if (initialQuery) {
    searchInput.value = initialQuery;
    // Replace the state to ensure popstate works correctly
    history.replaceState({ query: initialQuery }, "", window.location.href);
    performSearch(initialQuery);
  }

  // Load tournaments data
  loadTournaments().then(() => {performSearch(initialQuery)});

});
