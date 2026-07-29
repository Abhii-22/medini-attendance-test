import { getDistance } from 'geolib'; // or use your custom Haversine distance formula

// 📌 Primary Office Location (Bhoja Complex, Vijayanagar, Bengaluru)
export const OFFICE_LOCATION = {
  latitude: 12.97087487502752,   
  longitude: 77.53661971826362,  
  radiusInMeters: 20, 
};

// 📌 Kalaburagi Branch 1 (PDA Engineering College Rd)
export const KALABURAGI_LOCATION_1 = {
  latitude: 17.318516,
  longitude: 76.827829,
  radiusInMeters: 50,
};

// 📌 Kalaburagi Branch 2 (Aiwan-e-Shahi Area)
export const KALABURAGI_LOCATION_2 = {
  latitude: 17.314874,
  longitude: 76.836176,
  radiusInMeters: 50,
};

// 🌐 List of all authorized operational locations
export const OFFICE_LOCATIONS = [
  {
    name: 'Bengaluru Main Office (Bhoja Complex)',
    latitude: 12.97087487502752,
    longitude: 77.53661971826362,
    radiusInMeters: 20,
  },
  {
    name: 'Kalaburagi Branch 1 (PDA Engineering College Rd)',
    latitude: 17.318516,
    longitude: 76.827829,
    radiusInMeters: 50,
  },
  {
    name: 'Kalaburagi Branch 2 (Aiwan-e-Shahi Area)',
    latitude: 17.314874,
    longitude: 76.836176,
    radiusInMeters: 50,
  },
];

// 🚀 HELPER: Check if user coordinates match ANY authorized office location
export const isUserWithinAnyOffice = (userLat: number, userLng: number) => {
  for (const office of OFFICE_LOCATIONS) {
    // Distance calculation using Haversine or geolib
    const distance = calculateHaversineDistance(userLat, userLng, office.latitude, office.longitude);
    if (distance <= office.radiusInMeters) {
      return { isInside: true, matchedOffice: office.name, distance };
    }
  }
  return { isInside: false, matchedOffice: null, distance: null };
};

// Standard Haversine Distance Formula (in meters)
export function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}