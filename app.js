import { parseQueryString } from "./query-parser.js";

let map;
let markers = [];
let showArchived = false;
let tournaments = [];

function initMap() {

  map = L.map('map', {
    center: [52.237049, 19],
    zoom: 6
  });
  const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

}

function filter(city) {
  const tournamentsContainer = document.getElementById("tournaments");
  for (let tournament of tournamentsContainer.children) {
    if (tournament.data.geo && tournament.data.geo.city === city) {
      tournament.style.display = "block";
    } else {
      tournament.style.display = "none";
    }
  }
}
function addMarkers(tournaments) {
  // Clear existing markers
  markers.forEach(marker => marker.remove());
  markers = [];

  // Filter tournaments that have geographic information
  let tournamentsWithGeo = tournaments.filter(t => t.geo && t.geo.lat && t.geo.lng);

  // Group tournaments by city
  let grouped = {};
  tournamentsWithGeo.forEach(t => {
    let key = t.geo.city;
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(t);
  });

  // Define bounds to adjust viewport later
  let bounds = [];

  // Iterate through each group to create markers
  for (let city in grouped) {
    let tournamentCount = grouped[city].length;
    let sampleTournament = grouped[city][0];
    let position = { lat: parseFloat(sampleTournament.geo.lat), lng: parseFloat(sampleTournament.geo.lng) };

    // Create a custom marker icon with the tournament count inside
    var myIcon = L.divIcon({
      html: `<div style="background-color: blue; color: white; border-radius: 50%; width: 40px; height: 40px; display: flex; justify-content: center; align-items: center; font-size: 16px;">${tournamentCount}</div>`,
      className: 'custom-marker'
    });

    // Create the marker with label
    const marker = L.marker([position.lat, position.lng], {
      title: `${city} - ${tournamentCount} tournament(s)`,
      icon: myIcon
    }).addTo(map);

    marker.on('click', function () {
      filter(city)
    })

    // Add the marker to the list
    markers.push(marker);

    // Add the position to the bounds array for adjusting viewport
    bounds.push([position.lat, position.lng]);
  }

  // Adjust map bounds to show all markers
  if (bounds.length > 0) {
    map.fitBounds(bounds,{maxZoom: 10});
  }
}

function tournamentDiv(tournament) {
  const div = document.createElement('div');
  div.classList.add('tournament');
  if (tournament.date < new Date().toISOString().slice(0, 10)) {
    div.classList.add('archive');
  }
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
  div.data = tournament;
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
  let monthsToScrape = 10 * 12 + 6; // 10 years back + 6 months ahead


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
  if (query === "") {
    return 1;
  }
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

function sortByDate(a, b) {
  const today = new Date().toISOString().slice(0, 10);
  if (a.date < today && b.date >= today) {
    return 1;
  }
  if (b.date < today && a.date >= today) {
    return -1;
  }
  if (a.date < today && b.date < today) {
    return b.date.localeCompare(a.date);
  }
  return a.date.localeCompare(b.date);

}

function search(query) {
  console.log("searching for", query);
  let filtered = tournaments;
  if (!showArchived) {
    filtered = tournaments.filter(t => t.date >= new Date().toISOString().slice(0, 10));
  }
  for (let tournament of filtered) {
    tournament.score = searchScore(tournament, query);
  }
  // filter by score > 0 and sort by date
  return filtered.filter(t => t.score > 0).sort(sortByDate);
}

async function performSearch(query) {
  const tournamentsContainer = document.getElementById("tournaments");
  let tournaments = search(query);
  console.log("search results:", tournaments.length);
  tournamentsContainer.innerHTML = "";
  tournaments.forEach(tournament => {
    tournamentsContainer.appendChild(tournamentDiv(tournament));
  });
  addMarkers(tournaments);
}

document.addEventListener('DOMContentLoaded', () => {
  const searchBtn = document.getElementById("search-btn");
  const searchInput = document.getElementById("search");
  const mapToggle = document.getElementById("map-toggle");
  const archToggle = document.getElementById("arch-toggle");
  const mapContainer = document.getElementById("map");

  // Search button click event
  searchBtn.onclick = async () => {
    let query = searchInput.value.trim();

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
  loadTournaments().then(() => {
    initMap(); // Initialize the map after loading tournaments
    if (initialQuery) {
      performSearch(initialQuery);
    } else {
      // Optionally display all tournaments or a default view
      performSearch("");
    }
  });
  // Toggle Map View On/Off
  mapToggle.addEventListener("change", () => {
    if (mapToggle.checked) {
      mapContainer.style.display = "block";
      // Trigger map resize to ensure proper rendering
      google.maps.event.trigger(map, 'resize');
      // Re-fit the map to show all markers
      if (markers.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        markers.forEach(marker => bounds.extend(marker.getPosition()));
        map.fitBounds(bounds);
      }
    } else {
      mapContainer.style.display = "none";

    }

  });

  // Toggle Archived Tournaments On/Off
  archToggle.addEventListener("change", () => {
    showArchived = archToggle.checked;

    performSearch(searchInput.value.trim());
  });
});

export { loadTournaments }
