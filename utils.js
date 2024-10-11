function decodeHtmlEntities(encodedStr) {
  // Replace decimal entities (e.g., &#NNNN;)
  encodedStr = encodedStr.replace(/&#(\d+);/g, (match, dec) => {
    return String.fromCharCode(dec);
  });
  // Replace hexadecimal entities (e.g., &#xNNNN;)
  encodedStr = encodedStr.replace(/&#x([0-9A-Fa-f]+);/g, (match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });

  return encodedStr;
}

export { decodeHtmlEntities };