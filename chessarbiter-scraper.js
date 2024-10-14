import { decodeHtmlEntities } from './utils.js'
import ThrottledFetch from './throttle.js';


const queue = new ThrottledFetch(10, "ChessArbiter")



async function fetchTournaments(year, month) {
  const tournamentsUrl = `http://www.chessarbiter.com/turnieje.php\?rok\=${year}\&miesiac\=${month}`;
  console.log(tournamentsUrl)
  let res = await queue.throttledFetch(tournamentsUrl)
  let txt = await res.text()
  let tournaments = extractTournaments(txt, year)
  let tasks = []
  for (let tournament of tournaments) {
    tasks.push(fetchPlayers(tournament))
  }
  await Promise.allSettled(tasks) 
  return tournaments
}

async function fetchPlayer(tournament, n) {
  const playerUrl = `http://www.chessarbiter.com/turnieje/${tournament.year}/${tournament.id}/card_z$${n}`
  let res = await queue.throttledFetch(playerUrl)
  let txt = await res.text()
  let player = extractPlayer(txt)
  tournament.players.push(player)
  return player
}

async function fetchCaproPlayers(tournament) {
  const caproUrl = `https://www.chessarbiter.com/turnieje/${tournament.year}/${tournament.id}/capro_tournament.js`
  let res = await queue.throttledFetch(caproUrl)
  let txt = await res.text()
  let arrayRegex = /var (A\d+) = (.*);/gm
  let match
  let a = {}
  while ((match = arrayRegex.exec(txt)) !== null) {
    let arrayId = match[1]
    let array = JSON.parse(decodeHtmlEntities(match[2]))
    a[arrayId] = array
  }
  if (a['A11']) {
    let players = a['A11'].map((name, i) => {
      return {
        name,
        birthday: a['A18'][i],
        club: a['A17'][i],
        localID: a['A109'][i]
      }
    })
    tournament.players = players 
  }
  return tournament.players
}

async function fetchPlayers(tournament) {
  const playersUrl = `http://www.chessarbiter.com/turnieje/${tournament.year}/${tournament.id}/list_of_players`
  let res = await queue.throttledFetch(playersUrl)
  if (res.status !== 200) {
    await fetchCaproPlayers(tournament)
    return []
  }

  if (!tournament.players) {
    tournament.players = []
  }
  let txt = await res.text()
  const regex = /ALink\("card_z\$([\d]+)/g
  let match
  let tasks = []
  while ((match = regex.exec(txt)) !== null) {
    let number =  match[1]
    tasks.push(fetchPlayer(tournament, number))
  }
  await Promise.allSettled(tasks)
  return tournament.players
}

function extractTournaments(html, year) {

  // Split the HTML content by table rows (<tr>)
  let rows = html.split(/<tr[^>]*?>/).slice(1); // Ignore the first split part (before the first <tr>)
  let tournaments = [];
  // rows = rows.slice(50, 60)  // limit to 10 for testing
  rows.forEach(row => {
    // Split each row into cells (<td>)
    const cells = row.split(/<td[^>]*>/);
    if (cells.length >= 4) {
      // First cell: Extract tournament date
      const dateMatch = cells[1].match(/(\d{2}-\d{2})/);
      let date = null;
      if (dateMatch) {
        let dayMonth = dateMatch[1].split('-')
        date = year + '-' + dayMonth[1] + '-' + dayMonth[0];
      }

      // Second cell: Extract tournament link, title, and city

      const linkMatch = cells[2].match(/<a href\s?=\s?"(http[s]?:\/\/www\.chessarbiter\.com\/turnieje\/open\.php\?turn=[^"]+)"[^>]*>(.*?)<\/a>/);
      const link = linkMatch ? linkMatch[1] : null;
      if (!link) {
        return
      }
      const title = linkMatch ? decodeHtmlEntities(linkMatch[2]) : null;
      // match ti_ or trd_ prefix to get tournament id
      const tidMatch = link.match(/(ti_|tdr_)(\d+)/);
      const id = tidMatch ? tidMatch[1] + tidMatch[2] : null;
      if (!id) {
        console.log('no id', link)
        return
      } 


      const cityMatch = cells[2].match(/<div class="szary">\s*(.*?)\s*\[/);
      const city = cityMatch ? decodeHtmlEntities(cityMatch[1]) : null;

      // Third cell: Extract place (Country, State) and category
      const placeMatch = cells[3].match(/(.*)<br>/);
      const place = placeMatch ? decodeHtmlEntities(placeMatch[1]) : null;

      let category = null
      if (cells[3].indexOf("klasyczne") > 0)
        category = "klasyczne"
      else if (cells[3].indexOf("szybkie") > 0)
        category = "szybkie"
      else if (cells[3].indexOf("blitz") > 0)
        category = "blitz"
      else if (cells[3].indexOf("inne") > 0)
        category = "inne"
      let tournament = { date, link, title, city, place, category, id, year}
      tournaments.push(tournament)
    }
  });

  return tournaments;
}


function extractPlayer(html) {
  const regexMap = [
    { name: "name", regex: /<script>Tr\("Name".*?<\/td><td.*?>(.*?)<\/td>/ },
    { name: "birthday", regex: /<script>Tr\("Birthday".*?<\/td><td.*?>(.*?)<\/td>/ },
    { name: "club", regex: /<script>Tr\("Club".*?<\/td><td.*?>(.*?)<\/td>/ },
    { name: "localID", regex: /Local ID<\/td><td class=kcb>(\d*)/ }

  ]
  let player = {}
  regexMap.forEach(r => {
    const match = html.match(r.regex)
    if (match) {
      player[r.name] = decodeHtmlEntities(match[1])
    }
  })
  return player
}

export { fetchTournaments }

// let p = await fetchCaproPlayers({year: 2022, id: "ti_5305"})
// console.log(p)