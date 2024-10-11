function parseQueryString(input) {
  const result = [];
  const regex = /([a-zA-Z0-9_\.]+):"([^"]+)"|([a-zA-Z0-9_\.]+):(\S+)|"([^"]+)"|(\S+)/g;
  let match;

  while ((match = regex.exec(input)) !== null) {
    if (match[1]) {
      // Match for key:"value"
      result.push({ key: match[1], value: match[2] });
    } else if (match[3]) {
      // Match for key:value
      result.push({ key: match[3], value: match[4] });
    } else if (match[5]) {
      // Match for "value"
      result.push({ key: "title", value: match[5] });
    } else if (match[6]) {
      // Match for single word
      result.push({ key: "title", value: match[6] });
    }
  }

  return result;
}

export { parseQueryString };