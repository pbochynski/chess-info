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

// If value contains spaces, it should be enclosed in double quotes
function paramsToString(params) {
  return params.map(p => {
    // if value is type of string and contains spaces, enclose it in double quotes
    let key = (p.key==="title") ? "" : p.key+":";
    if (typeof p.value === "string" && p.value.includes(" ")) {
      return `${key}"${p.value}"`;
    } else {
      return `${key}${p.value}`;
    }
  }).join(" ");
}

function addOrReplaceParam(txt, key, value) {
  let params = parseQueryString(txt);
  let found = false;
  for (let param of params) {
    if (param.key === key) {
      param.value = value;
      found = true;
      break;
    }
  }
  if (!found) {
    params.push({ key, value });
  }
  return paramsToString(params);
}

export { parseQueryString, paramsToString, addOrReplaceParam }  