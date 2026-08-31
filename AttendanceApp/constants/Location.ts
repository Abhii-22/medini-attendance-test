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

// 📌 Kalaburagi Branch 3 (Aiwan-E-Shahi Area, Shambhognlli)
export const KALABURAGI_LOCATION_3 = {
  latitude: 17.31464,
  longitude: 76.83405,
  radiusInMeters: 50,
};

// 📌 Cambridge Institute Of Technology (Krishnarajapuram, Bengaluru)
export const CAMBRIDGE_IT_LOCATION = {
  latitude: 13.012195,
  longitude: 77.703683,
  radiusInMeters: 50,
};

// 📌 Soladevanahalli Campus (Bengaluru)
export const SOLADEVANAHALLI_LOCATION = {
  latitude: 13.083725,
  longitude: 77.484023,
  radiusInMeters: 50,
};

// 📌 Bengaluru MG Road Branch (Shanthala Nagar)
export const BENGALURU_MG_ROAD_LOCATION = {
  latitude: 12.974233,
  longitude: 77.608287,
  radiusInMeters: 50,
};

// 📌 VCET Puttur Branch
export const VCET_PUTTUR_LOCATION = {
  latitude: 12.78172,
  longitude: 75.18468,
  radiusInMeters: 50,
};

// 📌 BITM Ballari Branch
export const BITM_BALLARI_LOCATION = {
  latitude: 15.16864,
  longitude: 76.85019,
  radiusInMeters: 50,
};

// 📌 Paiyanur Branch (Rajiv Gandhi Salai, Tamil Nadu)
export const PAIYANUR_LOCATION = {
  latitude: 12.647998,
  longitude: 80.174428,
  radiusInMeters: 100,
};

// 📌 Karunguzhipallam Branch (Tamil Nadu)
export const KARUNGUZHIPALLAM_LOCATION = {
  latitude: 12.656691,
  longitude: 80.178922,
  radiusInMeters: 50,
};

// 📌 Central Telecom Society Location (Bengaluru)
export const CENTRAL_TELECOM_SOCIETY_LOCATION = {
  latitude: 13.160236,
  longitude: 77.636901,
  radiusInMeters: 50,
};

// 📌 Chikkaballapur Branch (Karnataka)
export const CHIKKABALLAPUR_LOCATION = {
  latitude: 13.395601,
  longitude: 77.732479,
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
  {
    name: 'Kalaburagi Branch 3 (Aiwan-E-Shahi Area, Shambhognlli)',
    latitude: 17.31464,
    longitude: 76.83405,
    radiusInMeters: 200,
  },
  {
    name: 'Cambridge Institute Of Technology (Krishnarajapuram)',
    latitude: 13.012195,
    longitude: 77.703683,
    radiusInMeters: 50,
  },
  {
    name: 'Soladevanahalli Campus (Bengaluru)',
    latitude: 13.083725,
    longitude: 77.484023,
    radiusInMeters: 50,
  },
  {
    name: 'Bengaluru MG Road Branch (Shanthala Nagar)',
    latitude: 12.974233,
    longitude: 77.608287,
    radiusInMeters: 50,
  },
  {
    name: 'VCET Puttur Campus',
    latitude: 12.78172,
    longitude: 75.18468,
    radiusInMeters: 50,
  },
  {
    name: 'BITM Ballari Campus',
    latitude: 15.16864,
    longitude: 76.85019,
    radiusInMeters: 50,
  },
  {
    name: 'Paiyanur Branch (Tamil Nadu)',
    latitude: 12.647998,
    longitude: 80.174428,
    radiusInMeters: 100,
  },
  {
    name: 'Karunguzhipallam Branch (Tamil Nadu)',
    latitude: 12.656691,
    longitude: 80.178922,
    radiusInMeters: 100,
  },
  {
    name: 'Central Telecom Society (Bengaluru)',
    latitude: 13.160236,
    longitude: 77.636901,
    radiusInMeters: 50,
  },
  {
    name: 'Chikkaballapur Branch (Karnataka)',
    latitude: 13.395601,
    longitude: 77.732479,
    radiusInMeters:100,
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