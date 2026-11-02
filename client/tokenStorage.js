const tokenStorageKey = "token";

function getBasePath() {
  // This relies on the fact that flanotes always has a correctly formatted relative path set in <base> tag
  return document.querySelector('base').getAttribute('href')
}

function getCookieString(token) {
  const basePath = getBasePath();
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  return `${tokenStorageKey}=${token}; Path=${basePath}; SameSite=Strict${secure}`;
}

export function storeToken(token, persist = false) {
  document.cookie = getCookieString(token);
  sessionStorage.setItem(tokenStorageKey, token);
  if (persist === true) {
    localStorage.setItem(tokenStorageKey, token);
  }
}

export function getStoredToken() {
  return sessionStorage.getItem(tokenStorageKey);
}

export function loadStoredToken() {
  const token = localStorage.getItem(tokenStorageKey);
  if (token != null) {
    storeToken(token, false);
  }
}

export function clearStoredToken() {
  window.dispatchEvent(new Event('flatnotes:session-ended'));
  sessionStorage.clear();
  localStorage.clear();
  document.cookie =
    getCookieString() + "; expires=Thu, 01 Jan 1970 00:00:00 GMT";
}

export function isCurrentTokenStored() {
  const localToken = localStorage.getItem(tokenStorageKey);
  if (localToken == null) {
    return false;
  }
  const sessionToken = sessionStorage.getItem(tokenStorageKey);
  return localToken === sessionToken;
}
