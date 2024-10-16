import { parseQueryString } from "./query-parser.js";

let map;
let markers = [];
let showArchived = false;
let tournaments = [];

function initMap() {
  // Default center of Poland
  const defaultCenter = { lat: 52.237049, lng: 21.017532 };

  map = new google.maps.Map(document.getElementById("map"), {
    center: defaultCenter,
    zoom: 6,
  });
}


function addMarkers(tournaments) {
  // Clear existing markers
  markers.forEach(marker => marker.setMap(null));
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


  // Iterate through each group to create markers
  for (let city in grouped) {
    let tournamentCount = grouped[city].length;
    let sampleTournament = grouped[city][0];
    let position = { lat: parseFloat(sampleTournament.geo.lat), lng: parseFloat(sampleTournament.geo.lng) };



    // Create the marker with label
    const marker = new google.maps.Marker({
      position,
      map,
      title: city,

      label: {
        text: String(tournamentCount),
        color: "white",
        fontSize: "12px",
        fontWeight: "bold",
      },
    });

    // Prepare InfoWindow content
    let infoContent = `
      <div>
        <h3>${city}</h3>
        <p>${tournamentCount} tournament${tournamentCount > 1 ? 's' : ''}</p>
        ${grouped[city].map(t => `
          <div style="margin-bottom: 10px;">
            <a href="${t.link}" target="_blank"><strong>${t.title}</strong></a><br/>
            <small>${t.date}</small>
          </div>
        `).join('')}
      </div>
    `;

    // Create InfoWindow
    const infoWindow = new google.maps.InfoWindow({
      content: infoContent,
    });

    // Add click listener to open InfoWindow
    marker.addListener("click", () => {
      infoWindow.open(map, marker);
    });

    markers.push(marker);
  }

  // Adjust map bounds to show all markers
  if (markers.length > 0) {
    const bounds = new google.maps.LatLngBounds();
    markers.forEach(marker => bounds.extend(marker.getPosition()));
    map.fitBounds(bounds);
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
