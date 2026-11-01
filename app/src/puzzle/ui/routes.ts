/** Screens of the puzzle game and their `#/...` addresses. Pure, so it is tested without a browser. */

export type Route =
  | { name: 'title' }
  | { name: 'map' }
  | { name: 'end' }
  | { name: 'level'; id: string };

const TITLE: Route = { name: 'title' };
const MAP: Route = { name: 'map' };
const END: Route = { name: 'end' };

/** Reads a location hash. Anything unknown opens the title; a broken level address opens the map. */
export function parseRoute(hash: string): Route {
  const path = hash.startsWith('#') ? hash.slice(1) : hash;
  if (path === '' || path === '/') return TITLE;
  if (path === '/map') return MAP;
  if (path === '/end') return END;
  const m = /^\/level\/(.*)$/.exec(path);
  if (!m) return TITLE;
  try {
    const id = decodeURIComponent(m[1] ?? '');
    return id === '' ? MAP : { name: 'level', id };
  } catch {
    return MAP; // malformed %-escape
  }
}

export function hashOf(route: Route): string {
  switch (route.name) {
    case 'title':
      return '#/';
    case 'map':
      return '#/map';
    case 'end':
      return '#/end';
    case 'level':
      return `#/level/${encodeURIComponent(route.id)}`;
  }
}

/** The screen one step up: what a back button opens. The title has none. */
export function parentRoute(route: Route): Route | null {
  switch (route.name) {
    case 'title':
      return null;
    case 'map':
      return TITLE;
    case 'level':
    case 'end':
      return MAP;
  }
}

/** How deep a screen sits (title 0, map 1, level and end 2); transitions slide forward when it grows. */
export function routeDepth(route: Route): number {
  return route.name === 'title' ? 0 : route.name === 'map' ? 1 : 2;
}

export const sameRoute = (a: Route, b: Route): boolean => hashOf(a) === hashOf(b);
