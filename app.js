import { parseQueryString, addOrReplaceParam } from "./query-parser.js";

let map;
let markers = [];

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

  // Add "Search in this area" button
  const searchButton = L.control({ position: 'topright' });
  searchButton.onAdd = function () {
    const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
    div.innerHTML = '<button id="searchAreaBtn" style="padding: 5px;">Szukaj w tym obszarze</button>';
    return div;
  };
  searchButton.addTo(map);

  // Event listener for the search button
  document.getElementById('searchAreaBtn').addEventListener('click', searchInArea);
  map.on('moveend', filterByArea);
  map.on('zoomend', filterByArea);

}
function filterByArea() {
  const bounds = map.getBounds();
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  let filtered = filter(sw, ne);
  addMarkers(filtered);
}
function searchInArea() {
  console.log("searching in area");
  // Get current map bounds
  const bounds = map.getBounds();
  const lat1 = bounds.getSouthWest().lat;
  const lng1 = bounds.getSouthWest().lng;
  const lat2 = bounds.getNorthEast().lat;
  const lng2 = bounds.getNorthEast().lng;

  // comma separated string of the bounds with precision of 4 decimal places
  let area = `${lat1.toFixed(4)},${lng1.toFixed(4)},${lat2.toFixed(4)},${lng2.toFixed(4)}`;

  // Update the search input value
  const searchInput = document.getElementById("search");
  let q = addOrReplaceParam(searchInput.value.trim(), 'area', area)
  searchInput.value = q;
  performSearch(q, true);
}

function filter(sw, ne) {
  let filtered = []
  const tournamentsContainer = document.getElementById("tournaments");
  for (let tournament of tournamentsContainer.children) {
    if (tournament.data.geo && tournament.data.geo.lat >= sw.lat && tournament.data.geo.lng >= sw.lng
      && tournament.data.geo.lat <= ne.lat && tournament.data.geo.lng <= ne.lng) {
      tournament.style.display = "block";
      filtered.push(tournament.data);
    } else {
      tournament.style.display = "none";
    }
  }
  return filtered;
}

// Helper function to calculate the centroid of a cluster
function calculateCentroid(tournaments) {
  let latSum = 0;
  let lngSum = 0;
  let ne = { lat: tournaments[0].geo.lat, lng: tournaments[0].geo.lng };
  let sw = { lat: tournaments[0].geo.lat, lng: tournaments[0].geo.lng };
  tournaments.forEach(item => {
    if (item.geo.lat > ne.lat) ne.lat = item.geo.lat;
    if (item.geo.lng > ne.lng) ne.lng = item.geo.lng;
    if (item.geo.lat < sw.lat) sw.lat = item.geo.lat;
    if (item.geo.lng < sw.lng) sw.lng = item.geo.lng;
    latSum += item.geo.lat;
    lngSum += item.geo.lng;
  });
  return {
    lat: latSum / tournaments.length,
    lng: lngSum / tournaments.length,
    ne, sw
  };
}

function groupByLocation(tournaments) {
  if (tournaments.length === 0) {
    return [];
  }
  // Filter tournaments that have geographic information
  let tournamentsWithGeo = tournaments.filter(t => t.geo && t.geo.lat && t.geo.lng)

  const sw = map.getBounds().getSouthWest();
  const ne = map.getBounds().getNorthEast();

  const overlap = { lat: 0.07 * (ne.lat - sw.lat), lng: 0.07 * (ne.lng - sw.lng) }

  // Group tournaments by city
  let groups = [];
  tournamentsWithGeo.forEach(t => {
    let g = groups.find(g => Math.abs(g.lat - t.geo.lat) < overlap.lat
      && Math.abs(g.lng - t.geo.lng) < overlap.lng);
    if (!g) {
      g = { lat: t.geo.lat, lng: t.geo.lng, tournaments: [t] };
      groups.push(g);
    } else {
      g.tournaments.push(t);

    }
  });
  for (let g of groups) {
    let c = calculateCentroid(g.tournaments);
    g.lat = c.lat;
    g.lng = c.lng;
    g.sw = c.sw;
    g.ne = c.ne;
  }

  return groups;
}


function addMarkers(tournaments) {
  // Clear existing markers
  markers.forEach(marker => marker.remove());
  markers = [];

  let groups = groupByLocation(tournaments);


  for (let g of groups) {
    let tournamentCount = g.tournaments.length;

    // Create a custom marker icon with the tournament count inside
    var myIcon = L.divIcon({
      html: `<div style="background-color: blue; color: white; border-radius: 50%; width: 40px; height: 40px; display: flex; justify-content: center; align-items: center; font-size: 16px;">${tournamentCount}</div>`,
      className: 'custom-marker',
      iconArchor: [20, 20]
    });

    // Create the marker with label
    const marker = L.marker([g.lat, g.lng], {
      title: `${tournamentCount} tournament(s)`,
      icon: myIcon
    }).addTo(map);

    marker.on('click', function () {
      filter(g.sw, g.ne)
    })

    // Add the marker to the list
    markers.push(marker);

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
      for (let t of result.value) {
        let id = (t.year || "") + t.id
        if (!ids[id]) {
          tournaments.push(t);
          ids[id] = true;
        }
      }
    }
  }
  tournaments.sort((a, b) => a.date.localeCompare(b.date));
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

function searchScore(tournament, params) {
  if (!params.some(p => p.key === 'archived')) {
    params.push({ key: 'archived', value: 'false' });
  }

  let ok = true;
  for (let param of params) {
    if (param.key === 'archived') {
      if (param.value === 'false' && tournament.date < new Date().toISOString().slice(0, 10)) {
        ok = false;
        break;
      }
      continue;
    }
    if (param.key.startsWith('player.')) {
      let playerScore = playerSearchScore(tournament, params);
      if (playerScore == 0) {
        ok = false;
        break
      }
      continue;
    }
    if (param.key === 'area') {
      let area = param.value.split(',').map(x => parseFloat(x));
      if (tournament.geo && tournament.geo.lat && tournament.geo.lng) {
        let lat = parseFloat(tournament.geo.lat);
        let lng = parseFloat(tournament.geo.lng);
        if (lat < area[0] || lat > area[2] || lng < area[1] || lng > area[3]) {
          ok = false;
          break;
        }
      } else {
        ok = false;
        break;
      }
      continue;
    }
    if (!tournament[param.key] || !tournament[param.key].toString().toLowerCase().includes(param.value.toLowerCase())) {
      ok = false;
      break;
    }
  }
  return ok ? 1 : 0;
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


function performSearch(query, pushHistory = true) {
  console.log("performing search for", query, "pushHistory", pushHistory);
  console.log("current history state", history.state);
  // Update the URL with the search query
  if (pushHistory) {

    if (!history.state || history.state.query !== query) {
      const newUrl = `${window.location.pathname}?q=${encodeURIComponent(query)}`;
      history.pushState({ query }, "", newUrl);
      console.log("pushing history state", history.state);
    }
  }

  const tournamentsContainer = document.getElementById("tournaments");

  let params = parseQueryString(query);

  // filter by score > 0 and sort by date
  let results = tournaments.filter(t => searchScore(t, params) > 0).sort(sortByDate);

  console.log("search results:", results.length);
  tournamentsContainer.innerHTML = "";
  results.forEach(tournament => {
    tournamentsContainer.appendChild(tournamentDiv(tournament));
  });
  addMarkers(results);
}

document.addEventListener('DOMContentLoaded', () => {
  const searchBtn = document.getElementById("search-btn");
  const searchInput = document.getElementById("search");
  const mapToggle = document.getElementById("map-toggle");
  const archToggle = document.getElementById("arch-toggle");
  const mapContainer = document.getElementById("map");
  const tournamentsContainer = document.getElementById("tournaments");

  // Search button click event
  searchBtn.onclick = async () => {
    let query = searchInput.value.trim();
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
    console.log("popstate event", event.state);
    if (event.state && event.state.query) {
      searchInput.value = event.state.query;
      let qp = parseQueryString(event.state.query);
      archToggle.checked = qp.find(p => p.key === 'archived' && p.value === 'true') ? true : false;
      performSearch(event.state.query, false);
      if (qp.find(p => p.key === 'area')) {
        let area = qp.find(p => p.key === 'area').value.split(',').map(x => parseFloat(x));
        map.fitBounds([[area[0], area[1]], [area[2], area[3]]]);
      }
    } else {
      // Optionally handle the state when there's no query (e.g., clear results)
      searchInput.value = "";
      tournamentsContainer.innerHTML = "";
    }
  });

  // On initial load, check if there's a query in the URL
  initMap(); // Initialize the map
  const urlParams = new URLSearchParams(window.location.search);
  const initialQuery = urlParams.get('q');
  if (initialQuery) {
    searchInput.value = initialQuery;
    let qp = parseQueryString(initialQuery);
    archToggle.checked = qp.find(p => p.key === 'archived' && p.value === 'true') ? true : false;
    // Replace the state to ensure popstate works correctly
    history.replaceState({ query: initialQuery }, "", window.location.href);
    performSearch(initialQuery, false);
    if (qp.find(p => p.key === 'area')) {
      let area = qp.find(p => p.key === 'area').value.split(',').map(x => parseFloat(x));
      map.fitBounds([[area[0], area[1]], [area[2], area[3]]]);
    }
  }

  // Load tournaments data
  loadTournaments().then(() => {
      performSearch(initialQuery || "", false);
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
    let q = addOrReplaceParam(searchInput.value.trim(), 'archived', archToggle.checked)
    searchInput.value = q;
    performSearch(q);
  });
});

export { loadTournaments }
