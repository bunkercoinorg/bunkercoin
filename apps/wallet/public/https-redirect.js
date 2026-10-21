if (location.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(location.hostname)) {
  location.replace(location.href.replace(/^http:/, 'https:'));
}
