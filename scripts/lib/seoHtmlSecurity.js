const PRERENDER_START = '<div id="root"><!--seo-prerender-start-->';
const PRERENDER_END = '<!--seo-prerender-end--></div>';

function isWhitespace(character) {
  return character === ' ' || character === '\n' || character === '\r' || character === '\t' || character === '\f';
}

function isNameCharacter(character) {
  const codePoint = character?.codePointAt(0) ?? -1;
  return (
    (codePoint >= 48 && codePoint <= 57) ||
    (codePoint >= 65 && codePoint <= 90) ||
    (codePoint >= 97 && codePoint <= 122) ||
    character === ':' ||
    character === '-' ||
    character === '_'
  );
}

function findTagEnd(html, startIndex) {
  let quote = '';

  for (let index = startIndex + 1; index < html.length; index += 1) {
    const character = html[index];

    if (quote) {
      if (character === quote) quote = '';
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '>') {
      return index;
    }
  }

  throw new Error('Malformed generated HTML: unterminated tag.');
}

function parseAttributes(html, startIndex, endIndex) {
  const attributes = new Map();
  let index = startIndex;

  while (index < endIndex) {
    while (index < endIndex && isWhitespace(html[index])) index += 1;
    if (html[index] === '/') {
      index += 1;
      continue;
    }
    if (index >= endIndex) break;

    const nameStart = index;
    while (index < endIndex && isNameCharacter(html[index])) index += 1;
    if (index === nameStart) throw new Error('Malformed generated HTML: invalid attribute name.');

    const name = html.slice(nameStart, index).toLowerCase();
    while (index < endIndex && isWhitespace(html[index])) index += 1;

    let value = '';
    if (html[index] === '=') {
      index += 1;
      while (index < endIndex && isWhitespace(html[index])) index += 1;

      const quote = html[index] === '"' || html[index] === "'" ? html[index] : '';
      if (quote) {
        index += 1;
        const valueStart = index;
        while (index < endIndex && html[index] !== quote) index += 1;
        if (index >= endIndex) throw new Error('Malformed generated HTML: unterminated attribute value.');
        value = html.slice(valueStart, index);
        index += 1;
      } else {
        const valueStart = index;
        while (index < endIndex && !isWhitespace(html[index])) index += 1;
        value = html.slice(valueStart, index);
      }
    }

    attributes.set(name, value);
  }

  return attributes;
}

function tokenizeHtml(html) {
  const tokens = [];
  let cursor = 0;

  while (cursor < html.length) {
    const start = html.indexOf('<', cursor);
    if (start === -1) break;

    if (html.startsWith('<!--', start)) {
      const commentEnd = html.indexOf('-->', start + 4);
      if (commentEnd === -1) throw new Error('Malformed generated HTML: unterminated comment.');
      tokens.push({ type: 'comment', start, end: commentEnd + 3 });
      cursor = commentEnd + 3;
      continue;
    }

    const endIndex = findTagEnd(html, start);
    let index = start + 1;
    while (index < endIndex && isWhitespace(html[index])) index += 1;

    if (html[index] === '!' || html[index] === '?') {
      tokens.push({ type: 'declaration', start, end: endIndex + 1 });
      cursor = endIndex + 1;
      continue;
    }

    const closing = html[index] === '/';
    if (closing) {
      index += 1;
      while (index < endIndex && isWhitespace(html[index])) index += 1;
    }

    const nameStart = index;
    while (index < endIndex && isNameCharacter(html[index])) index += 1;
    if (index === nameStart) throw new Error('Malformed generated HTML: invalid tag name.');

    tokens.push({
      type: 'tag',
      name: html.slice(nameStart, index).toLowerCase(),
      closing,
      attributes: closing ? new Map() : parseAttributes(html, index, endIndex),
      start,
      end: endIndex + 1
    });
    cursor = endIndex + 1;
  }

  return tokens;
}

function removeRanges(text, ranges) {
  let cursor = 0;
  let output = '';

  for (const range of ranges) {
    if (range.start < cursor) continue;
    output += text.slice(cursor, range.start);
    cursor = range.end;
  }

  return output + text.slice(cursor);
}

function removePrerenderedRoot(html) {
  const start = html.indexOf(PRERENDER_START);
  if (start === -1) return html;

  const end = html.indexOf(PRERENDER_END, start + PRERENDER_START.length);
  if (end === -1 || html.indexOf(PRERENDER_START, start + PRERENDER_START.length) !== -1) {
    throw new Error('Malformed generated HTML: invalid prerender root markers.');
  }

  return `${html.slice(0, start)}<div id="root"></div>${html.slice(end + PRERENDER_END.length)}`;
}

export function cleanGeneratedSeo(html) {
  const input = String(html || '');
  const tokens = tokenizeHtml(input);
  const removals = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type !== 'tag' || token.closing) continue;

    if (token.name === 'meta' && token.attributes.has('data-seo-generated')) {
      removals.push({ start: token.start, end: token.end });
      continue;
    }

    if (token.name === 'script' && token.attributes.has('data-seo-structured-data')) {
      const closingIndex = tokens.findIndex(
        (candidate, candidateIndex) =>
          candidateIndex > index && candidate.type === 'tag' && candidate.closing && candidate.name === 'script'
      );
      if (closingIndex === -1) throw new Error('Malformed generated HTML: structured-data script is not closed.');
      removals.push({ start: token.start, end: tokens[closingIndex].end });
      index = closingIndex;
    }
  }

  return removePrerenderedRoot(removeRanges(input, removals));
}

export function removeCanonicalLinks(html) {
  const input = String(html || '');
  const removals = tokenizeHtml(input)
    .filter(
      (token) =>
        token.type === 'tag' &&
        !token.closing &&
        token.name === 'link' &&
        String(token.attributes.get('rel') || '')
          .toLowerCase()
          .split(' ')
          .filter(Boolean)
          .includes('canonical')
    )
    .map((token) => ({ start: token.start, end: token.end }));

  return removeRanges(input, removals);
}

export function hasOnlySameOriginExecutableScripts(html, documentUrl) {
  let baseUrl;
  let tokens;

  try {
    baseUrl = new URL(documentUrl);
    tokens = tokenizeHtml(String(html || ''));
  } catch {
    return false;
  }

  for (const token of tokens) {
    if (token.type !== 'tag' || token.closing || token.name !== 'script') continue;

    const type = String(token.attributes.get('type') || '').trim().toLowerCase();
    if (type === 'application/ld+json') continue;

    const source = token.attributes.get('src');
    if (!source) return false;

    try {
      const sourceUrl = new URL(source, baseUrl);
      if (!['http:', 'https:'].includes(sourceUrl.protocol) || sourceUrl.origin !== baseUrl.origin) return false;
    } catch {
      return false;
    }
  }

  return true;
}
