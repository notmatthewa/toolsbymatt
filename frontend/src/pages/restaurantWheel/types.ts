export interface Restaurant {
  id: string;
  name: string;
  cuisine?: string;
  amenity?: string; // "restaurant" | "fast_food"
  address?: string;
  lat: number;
  lon: number;
}
