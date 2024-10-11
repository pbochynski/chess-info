import { decodeHtmlEntities } from './utils.js'
import ThrottledFetch from './throttle.js'

const queue = new ThrottledFetch(20, "ChessManager")  

function lastDayOfMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

function parseTournament(html, tournament) {
  const regex = /<div class="statistic">\s*<div class=".*?">\s*(.*)\s*(.*)?\s*<\/div>\s*<div class="label">\s*(.*)\s*<\/div>\s*<\/div>/gm
  let match
  const labels = ["Date", "City", "Tempo"]
  while ((match = regex.exec(html)) !== null) {
    let label = match[3]
    for (let l of labels) {
      if (label.includes(l)) {
        let key = l.toLocaleLowerCase()
        let value = match[1] + (match[2] ? match[2] : "")
        value = value.replace(/<br.*?>/g, " ")
        tournament[key] = value
      }
    }
  }
  // extract title from <h1> tag
  const titleRegex = /<h1.*?>([\s\S]*?)<\/h1>/gm
  let titleMatch = titleRegex.exec(html)
  tournament.title = titleMatch[1].trim()
  
  // convert date from format "dd.mm yyyy" to "yyyy-mm-dd"
  const dateRegex = /(\d{2})\.(\d{2}).(\d{4})/
  if (tournament.date.match(dateRegex)) {
    tournament.date = tournament.date.replace(dateRegex, "$3-$2-$1").slice(0, 10)    
  } 
  return tournament

}
function extractPlayers(html) {
  const tbodyRegex = /<tbody>([\s\S]*?)<\/tbody>/gm
  let tbodyMatch = tbodyRegex.exec(html)
  let tbody = tbodyMatch[1]
  const trRegex = /<tr.*?>([\s\S]*?)<\/tr>/gm
  let players = []
  let match
  while ((match = trRegex.exec(tbody)) !== null) {
    let tr = match[1]
    let player = {}
    const tdRegex = /<td.*?>([\s\S]*?)<\/td>/gm
    let tdMatch
    let i = 0
    while ((tdMatch = tdRegex.exec(tr)) !== null) {
      let td = tdMatch[1]
      switch(i) {
        case 1:
          player.country = td.match(/title="(.*)"/)[1].trim()
          break
        case 2:
          player.category = td.replace(/<.*?>/g, "").trim()
          break
        case 3:
          player.name = decodeHtmlEntities(td.replace(/<.*?>/g, "").trim())
          break
        case 4:
          player.club = decodeHtmlEntities(td.replace(/<.*?>/g, "").trim())
          break
        case 5:
          player.rank = td.replace(/<.*?>/g, "").trim()
          break
        case 6:
          player.birthday = td.replace(/<.*?>/g, "").trim()
          break
      }
      i++
    }
    players.push(player)
  }
  return players
}
async function fetchPlayers(tournament) {
  const playersUrl = `https://www.chessmanager.com/en/tournaments/${tournament.id}/players`
  let res = await queue.throttledFetch(playersUrl)
  let txt = await res.text()
  let players = extractPlayers(txt) 
  return players
}

async function fetchTournament(t) {
  const tournamentUrl = `https://www.chessmanager.com/en/tournaments/${t.id}`
  let res = await queue.throttledFetch(tournamentUrl)
  let txt = await res.text()
  parseTournament(txt, t)  
  t.players = await fetchPlayers(t)
  return t
}
function extractPagination(html) {
  const regex = /<a.*?href="https:\/\/www\.chessmanager\.com(?:[^"]*)offset=(\d*)".*?>/gm
  let match
  let offsets = []
  while ((match = regex.exec(html)) !== null) {
    offsets.push(Number(match[1]))
  }
  return offsets 
}
async function fetchTournaments(year, month) {
  const start = `${year}-${month}-01` 
  const end = `${year}-${month}-${lastDayOfMonth(year, month)}`
  
  let offset = 0
  let tournaments = []  
  while (true) {
    const tournamentsUrl = `https://www.chessmanager.com/en/tournaments?date_start=${start}&date_end=${end}&country=POL&offset=${offset}`;
    console.log(tournamentsUrl)
    let res = await queue.throttledFetch(tournamentsUrl)
    let txt = await res.text()
    let offsets = extractPagination(txt)
    let page = extractTournaments(txt)
    for (let t of page) {
      if (!tournaments.find(x => x.id === t.id)) {
        tournaments.push(t)
      }
    }
    if (offsets.length === 0) { 
      break
    }
    let currentOffsetIndex = offsets.indexOf(offset)
    if (currentOffsetIndex === offsets.length - 1) {
      break
    }
    offset = offsets[currentOffsetIndex + 1]  
  }
  let tasks = []
  for (let tournament of tournaments) {
    tasks.push(fetchTournament(tournament)) 
  }
  await Promise.allSettled(tasks)
  // filter out tournaments without date or with date not matching year and month params
  // month is padded with 0 
  console.log(`Filtering ${tournaments.length} tournaments by date`)
  tournaments = tournaments.filter(t => t.date && t.date.startsWith(`${year}-${month.toString().padStart(2, '0')}`))
  console.log(`Filtered ${tournaments.length} tournaments by date`)
  return tournaments
}
function parseContent(html) {
  const titleRegex = /<div class="header">\s*(.*)\s*<\/div>/gm
  let tournament = {}
  let match = titleRegex.exec(html)
  if (match) {
    tournament.title = match[1]
  }
  return tournament
}
function extractTournaments(html) {
  let tournaments = []
  const regex = /(<a\s+.*?href="https:\/\/www.chessmanager.com\/en\/tournaments\/(\d*)">(\s|.*)*?<\/a>)/gm
  let match
  while ((match = regex.exec(html)) !== null) {
    let id = match[2]
    let content = match[1]
    let tournament = parseContent(content)
    tournament.id = id
    tournament.link = `https://www.chessmanager.com/en/tournaments/${id}`
    tournaments.push(tournament)
  }
  return tournaments 
}

export { fetchTournaments}