export function navigate(path) {
  window.location.href = path;
}

export function getQueryParam(name) {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}
