// The Drop droplet as a favicon. The SVG matches the theme's accent and
// switches to the lighter blue in dark mode.
export const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><style>path{fill:#2563eb}@media (prefers-color-scheme:dark){path{fill:#60a5fa}}</style><path d="M8 .75c2.9 3.45 5 6.1 5 8.75a5 5 0 0 1-10 0C3 6.85 5.1 4.2 8 .75z"/></svg>`;

// 48×48 PNG of the same droplet (#2563eb), served at /favicon.ico for browsers
// and uploaded pages that only ask for that path. Browsers accept PNG data there.
// Rendered once from the SVG path above with sharp.
const FAVICON_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAACXBIWXMAAAsTAAALEwEAmpwYAAACeElEQVRo3u1Zz2sTURCuBxW14A/EUqmK3d1Yo7SgUFov4sGrnnoTbN7bLlEpVioUwf9BpP4HIl6KFgpF8D9okV6lrR6EmORN1sYfFwMxzpTE5GBtTOfNbkoezCW7kO+bmW9m3mxXV+fs4uNM5K+QtSX4cwpOutpkPAU5Zzw81Vbg+8Y+HXCVWfI0VMhcBSuDt7KH2gR+ZY+r4WUNfIPN0bPYw/eUefwX8FUrPIq3aH24iQTKWxLAZ46CG/H0vC6cR4DFrb1f1YM23/pVeDFW4E/fKR7FvP+wHfh6JGDtzO2NIzESrXndNPg6iYVYiBrBTP83+D/l1dyPOu+H0fs/d0Cg5KhwNBLwvUHmIOVyq+AbmtzH5N18tzgB9N6znYJvIPFUtt4ruOZp84uLAPUHN2Wuynh+cnU/ps46G/iG0pocq+wTSB2YYQdft2mr4PvT2RPNdNvWzWwkgsxxm8Kdtej9mj2xAp5aP44LP2wT2JyVgi+HLYzJ8FDA+zUSD2wQWJcigLbKPyrLgd+0Ad8k+MSbMlPSBDyVn+S8Js5LE0AdvOJsXiviEdDwjlPAOfEIKPjM2cBK8gRMiTOFvsunkPnKmUJrEYj4PV8EsCJEIOI5zjI6EYEGFPcYXZZrYqZ8Vud6uGehN3L5D4v8w1wqPyQSBdqfjptLtjbPLwQIPLd2I0vq4jGbJZV2RFavlHQSAQzYuBfTTczxwwtCe6FwFP80yzn3uH5hRHa5hR/uaGJk8Pwygu+LZD96Oajs9XwIWokGeh1oxySyzNpW3LicTfhwD7359l+TKz2jd+jdSBa6za9fCtfRu2nycNXS9FuMvsp0TufsmvMbbn9fS+uLpFcAAAAASUVORK5CYII=';

export const FAVICON_PNG = Uint8Array.from(atob(FAVICON_PNG_BASE64), (char) => char.charCodeAt(0));

export const FAVICON_LINKS = '<link rel="icon" href="/favicon.svg" type="image/svg+xml" />\n    <link rel="icon" href="/favicon.ico" sizes="48x48" />';
