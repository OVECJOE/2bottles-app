import type { Coordinates } from "./location.types";

export interface Venue {
    id: string;
    name: string;
    category: string;          // 'cafe' | 'restaurant' | 'cinema' | …
    emoji: string;
    address: string;
    coordinates: Coordinates;
    distanceKm: number;
    etaMinutesFromYou: number;
    etaMinutesFromPartner: number;
}