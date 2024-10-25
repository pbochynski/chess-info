import fs from 'fs';

class Geo {
  constructor() {
    this.cities = this.plCities();
    this.matches = {}
  }

  plCities() {
    const citiesCsv = fs.readFileSync('pl.txt', 'utf8');
    let cities = [];
    let lines = citiesCsv.split('\n');
    for (let i = 0; i < lines.length; i++) {

      let cols = lines[i].split('\t');
      if (!cols[0]) {
        continue;
      }
      let city = {
        city: cols[1].replace(/"/g, ''),
        ascii: cols[2].replace(/"/g, ''),
        alt: cols[3].replace(/"/g, '').split(','),
        lat: parseFloat(cols[4].replace(/"/g, '')),
        lng: parseFloat(cols[5].replace(/"/g, '')),
      }
      cities.push(city);
    }
    return cities
  }


  bestMatch(c, cities) {
    let found = cities.find(city => city.city.toLowerCase() == c.toLocaleLowerCase())
    found = found || cities.find(city => city.ascii.toLowerCase() == c.toLocaleLowerCase())
    found = found || cities.find(city => city.alt.find(a => a.toLowerCase() == c.toLocaleLowerCase()))
    if (found) {
      return found
    }
    let parts1 = c.split(/[ \.\d,]+/);
    let parts2 = c.split(/[ \.\d,\/-]+/);
    let parts = []
    for (let part of parts1) {
      if (part.length > 2 && parts.indexOf(part) === -1) {
        parts.push(part)
      }
    }
    for (let part of parts2) {
      if (part.length > 2 && parts.indexOf(part) === -1) {
        parts.push(part)
      }
    }
    for (let part of parts) {
      found = cities.find(city => city.city.toLowerCase() == part.toLocaleLowerCase())
      found = found || cities.find(city => city.ascii.toLowerCase() == part.toLocaleLowerCase())
      found = found || cities.find(city => city.alt.find(a => a.toLowerCase() == part.toLocaleLowerCase()))
      if (found) {
        return found
      }
    }
    let [bestMatch, lowestDistance] = this.fuzzySearch(c, cities);
    return (lowestDistance < 3) ? bestMatch : null;
  }


  levenshteinDistance(a, b) {
    const matrix = [];

    // Initialize the matrix
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    // Fill the matrix
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,  // substitution
            matrix[i][j - 1] + 1,      // insertion
            matrix[i - 1][j] + 1       // deletion
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  fuzzySearch(searchTerm, cities) {
    let bestMatch = null;
    let lowestDistance = Infinity;

    cities.forEach(item => {
      const distance = this.levenshteinDistance(searchTerm.toLowerCase(), item.city.toLowerCase());
      if (distance < lowestDistance) {
        lowestDistance = distance;
        bestMatch = item;
      }
    });

    return [bestMatch, lowestDistance];
  }
  find(city){
    city = city.replace(/^[\s.\(\)]+|[\s.\(\)]+$/g, '');
    let best = this.matches[city] || this.bestMatch(city, this.cities);
    if (best) {
      this.matches[city] = best;
      return { city: best.city, lat: best.lat, lng: best.lng };
    }
    return null;
  }
}

export default Geo;

// let geo = new Geo();  
// console.log(geo.find(".Nakło nad Notecią."))