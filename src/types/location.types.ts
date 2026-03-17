export interface Coordinates {
    lat: number;
    lng: number;
}

export interface LocationState {
    own: Coordinates | null;
    partner: Coordinates | null;
    destination: Coordinates | null;
    ownEtaMinutes: number | null;
    partnerEtaMinutes: number | null;
    ownDistanceM: number | null;
    partnerDistanceM: number | null;
    isWatching: boolean;
    accuracy: number | null;       // metres
}