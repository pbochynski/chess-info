import { parseQueryString } from "./query-parser.js";

let map;
let markers = [];

function initMap() {
  // Default center of Poland
  const defaultCenter = { lat: 52.237049, lng: 21.017532 };

  map = new google.maps.Map(document.getElementById("map"), {
    center: defaultCenter,
    zoom: 6,
  });
}

/**
 * Determines the scale of the marker based on the number of tournaments.
 * Adjust the base scale and multiplier as needed for better visualization.
 * @param {number} count - Number of tournaments in the city.
 * @returns {number} - Scale factor for the marker.
 */
function getMarkerScale(scale) {
  const baseScale = 1;
  // const scaleMultiplier = 0.5; // Adjust multiplier for size variation
  return baseScale + 2*scale;
}

/**
 * Determines the fill color of the marker based on the number of tournaments.
 * @param {number} count - Number of tournaments in the city.
 * @returns {string} - HEX color code.
 */
function getMarkerColor(count) {
  if (count <= 2) return "#FF5722"; // Orange
  if (count <= 5) return "#E64A19"; // Deep Orange
  return "#BF360C"; // Darker Orange
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
  const maxGroupSize = Math.max(...Object.values(grouped).map(group => group.length));

  // Iterate through each group to create markers
  for (let city in grouped) {
    let tournamentCount = grouped[city].length;
    let sampleTournament = grouped[city][0];
    let position = { lat: parseFloat(sampleTournament.geo.lat), lng: parseFloat(sampleTournament.geo.lng) };

    // Create a custom SVG icon
    let scale = getMarkerScale(tournamentCount/maxGroupSize)// Scale based on tournament count

    const icon = {
      path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
      fillColor: getMarkerColor(tournamentCount),
      fillOpacity: 0.8,
      strokeWeight: 1,
      strokeColor: "#FFFFFF",
      scale,
      anchor: new google.maps.Point(12, 22) * scale, // Scaled anchor point
      labelOrigin: new google.maps.Point(12, 10 * scale), // Adjust label origin based on scale

    };

    // Create the marker with label
    const marker = new google.maps.Marker({
      position,
      map,
      title: city,
      icon: icon,
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


// function addMarkers(tournaments) {
//   // Clear existing markers
//   markers.forEach(marker => marker.setMap(null));
//   markers = [];
//   let tournamentsWithGeo = tournaments.filter(t => t.geo && t.geo.lat && t.geo.lng);
//   // group by t.geo.city
//   let grouped = {};
//   tournamentsWithGeo.forEach(t => {
//     let key = t.geo.city;
//     if (!grouped[key]) {
//       grouped[key] = [];
//     }
//     grouped[key].push(t);
//   });
//   for (let key in grouped) {
//     let t = grouped[key][0];
//     let position = { lat: parseFloat(t.geo.lat), lng: parseFloat(t.geo.lng) };
//     let marker = new google.maps.Marker({
//       position, 
//       map,
//       title: key,
//     })
//     let divs = []

//     for (let i=0; i<grouped[key].length; i++) {
//       let t = grouped[key][i];
//       divs.push(`
//           <div>
//             <h3><a href="${t.link}" target="_blank">${t.title}</a></h3>
//             <p>${t.date}, ${t.geo.city}</p>
            
//           </div>
//         `)
//     }
//     const infoWindow = new google.maps.InfoWindow({
//       content: `
//           <div>
//             <h3>${key}</h3>
//             <p>${grouped[key].length} tournaments</p>
//           </div><br/>
//         `+divs.join('<br/>'),
//     });
//     marker.addListener("click", () => {
//       infoWindow.open(map, marker);
//     });
//     markers.push(marker);
//   }          

//   // Adjust map bounds to show all markers
//   if (markers.length > 0) {
//     const bounds = new google.maps.LatLngBounds();
//     markers.forEach(marker => bounds.extend(marker.getPosition()));
//     map.fitBounds(bounds);
//   }
// }

let tournaments = [];

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
  for (let tournament of tournaments) {
    tournament.score = searchScore(tournament, query);
  }
  // filter by score > 0 and sort by date
  return tournaments.filter(t => t.score > 0).sort(sortByDate);
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
  loadTournaments().then(() => {
    initMap(); // Initialize the map after loading tournaments
    if (initialQuery) {
      performSearch(initialQuery);
    } else {
      // Optionally display all tournaments or a default view
      performSearch("");
    }
  });
});

export {loadTournaments}
