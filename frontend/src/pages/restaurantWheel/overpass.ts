import type { Restaurant } from "./types";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

export async function queryRestaurants(
  polygon: [number, number][]
): Promise<Restaurant[]> {
  // Overpass poly filter expects "lat lon lat lon ..." (space-separated)
  // Simplify polygon if too many vertices (Overpass has URL length limits)
  const simplified = simplifyPolygon(polygon, 100);
  const polyStr = simplified.map(([lon, lat]) => `${lat} ${lon}`).join(" ");

  const query = `
[out:json][timeout:25];
(
  node["amenity"="restaurant"](poly:"${polyStr}");
  way["amenity"="restaurant"](poly:"${polyStr}");
  node["amenity"="fast_food"](poly:"${polyStr}");
  way["amenity"="fast_food"](poly:"${polyStr}");
);
out center tags;
`;

  const resp = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!resp.ok) throw new Error(`Overpass error: ${resp.status}`);
  const data = await resp.json();

  const restaurants: Restaurant[] = [];
  const seen = new Set<string>();

  for (const el of data.elements) {
    const tags = el.tags || {};
    const name = tags.name;
    if (!name) continue;

    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (!lat || !lon) continue;

    // Deduplicate by name + approximate location
    const key = `${name.toLowerCase()}_${lat.toFixed(4)}_${lon.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const parts: string[] = [];
    if (tags["addr:housenumber"] && tags["addr:street"])
      parts.push(`${tags["addr:housenumber"]} ${tags["addr:street"]}`);
    else if (tags["addr:street"]) parts.push(tags["addr:street"]);
    if (tags["addr:city"]) parts.push(tags["addr:city"]);

    restaurants.push({
      id: `${el.type}/${el.id}`,
      name,
      cuisine: tags.cuisine?.split(";")[0],
      amenity: tags.amenity,
      address: parts.join(", ") || undefined,
      lat,
      lon,
    });
  }

  return restaurants.sort((a, b) => a.name.localeCompare(b.name));
}

function simplifyPolygon(
  coords: [number, number][],
  maxPoints: number
): [number, number][] {
  if (coords.length <= maxPoints) return coords;
  const step = coords.length / maxPoints;
  const result: [number, number][] = [];
  for (let i = 0; i < maxPoints; i++) {
    result.push(coords[Math.floor(i * step)]);
  }
  return result;
}
