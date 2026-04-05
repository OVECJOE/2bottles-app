type Coordinates = { lat: number; lng: number };

export type SpotCreateInput = {
  venueName: string;
  venueAddress?: string;
  category?: string;
  coordinates?: Coordinates;
  reason?: string;
};

export type SpotRatingInput = {
  rating: number;
  comment?: string;
};

export type SpotUploadResult = {
  url: string;
  completedAt: string;
  type: 'image' | 'video';
  description?: string;
};

export type SpotCreateResponse = {
  spotId: string;
};

export type SpotRatingResponse = {
  ok: boolean;
  averageRating?: number;
  ratingsCount?: number;
};

export type SpotSuggestion = {
  id: string;
  name: string;
  address: string;
  category: string;
  coordinates: Coordinates;
  score: number;
  averageRating?: number;
  ratingsCount?: number;
  reasons?: string[];
};

export type SpotSuggestionQuery = {
  lat: number;
  lng: number;
  partnerLat?: number;
  partnerLng?: number;
  radiusMeters?: number;
  limit?: number;
  categories?: string[];
  tags?: string[];
  minRating?: number;
  includeUserSaved?: boolean;
};

type SpotUploadResponse = SpotUploadResult;

const SPOT_API_BASE = (import.meta.env.VITE_SPOT_API_BASE as string | undefined)?.trim() || '/api';

type CreateSpotApiResponse = {
  spotId?: string;
  id?: string;
  spot?: { id?: string };
};

type UploadSpotApiResponse = {
  url?: string;
  completedAt?: string;
  type?: 'image' | 'video';
  description?: string;
};

type RatingSpotApiResponse = {
  ok?: boolean;
  averageRating?: number;
  ratingsCount?: number;
};

type SpotSuggestionApiItem = {
  id?: string;
  name?: string;
  address?: string;
  category?: string;
  score?: number;
  averageRating?: number;
  ratingsCount?: number;
  reasons?: string[];
  coordinates?: {
    lat?: number;
    lng?: number;
  };
};

type SpotSuggestionApiResponse = {
  spots?: SpotSuggestionApiItem[];
  data?: SpotSuggestionApiItem[];
};

function getApiUrl(path: string): string {
  return `${SPOT_API_BASE.replace(/\/$/, '')}${path}`;
}

async function parseJsonOrEmpty<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const body = await parseJsonOrEmpty<{ message?: string; error?: string }>(res);
  return body?.message || body?.error || fallback;
}

function ensureSpotId(data: CreateSpotApiResponse | null): string {
  const candidate = data?.spotId || data?.id || data?.spot?.id || '';
  if (!candidate) {
    throw new Error('Spot created but backend response has no spot id.');
  }
  return candidate;
}

function mapSuggestion(item: SpotSuggestionApiItem): SpotSuggestion | null {
  const lat = item.coordinates?.lat;
  const lng = item.coordinates?.lng;

  if (!item.id || !item.name || !item.address || !item.category) return null;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;

  return {
    id: item.id,
    name: item.name,
    address: item.address,
    category: item.category,
    coordinates: { lat, lng },
    score: typeof item.score === 'number' ? item.score : 0,
    averageRating: item.averageRating,
    ratingsCount: item.ratingsCount,
    reasons: Array.isArray(item.reasons) ? item.reasons : undefined,
  };
}

function buildSuggestionParams(query: SpotSuggestionQuery): URLSearchParams {
  const params = new URLSearchParams({
    lat: String(query.lat),
    lng: String(query.lng),
  });

  if (typeof query.partnerLat === 'number') params.set('partnerLat', String(query.partnerLat));
  if (typeof query.partnerLng === 'number') params.set('partnerLng', String(query.partnerLng));
  if (typeof query.radiusMeters === 'number') params.set('radiusMeters', String(query.radiusMeters));
  if (typeof query.limit === 'number') params.set('limit', String(query.limit));
  if (typeof query.minRating === 'number') params.set('minRating', String(query.minRating));
  if (typeof query.includeUserSaved === 'boolean') params.set('includeUserSaved', String(query.includeUserSaved));

  for (const category of query.categories ?? []) {
    params.append('category', category);
  }
  for (const tag of query.tags ?? []) {
    params.append('tag', tag);
  }

  return params;
}

export async function createSpot(input: SpotCreateInput): Promise<SpotCreateResponse> {
  const url = getApiUrl('/spot');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw new Error(await readErrorMessage(res, 'Unable to create spot.'));
  }

  const data = await parseJsonOrEmpty<CreateSpotApiResponse>(res);
  return { spotId: ensureSpotId(data) };
}

export async function submitSpotRating(spotId: string, input: SpotRatingInput): Promise<SpotRatingResponse> {
  const url = getApiUrl(`/spot/${encodeURIComponent(spotId)}/rating`);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw new Error(await readErrorMessage(res, 'Unable to save rating.'));
  }

  const data = await parseJsonOrEmpty<RatingSpotApiResponse>(res);
  return {
    ok: data?.ok ?? true,
    averageRating: data?.averageRating,
    ratingsCount: data?.ratingsCount,
  };
}

export async function uploadSpotMedia(
  spotId: string,
  file: File,
  description?: string,
  onProgress?: (progress: number) => void,
): Promise<SpotUploadResponse> {
  const url = getApiUrl('/spot/media');

  return new Promise<SpotUploadResponse>((resolve, reject) => {
    const form = new FormData();
    form.append('spotId', spotId);
    form.append('file', file);
    if (description?.trim()) form.append('description', description.trim());

    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);

    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) return;
      const pct = Math.round((event.loaded / event.total) * 100);
      onProgress(pct);
    };

    xhr.onerror = () => reject(new Error('Upload failed.'));
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error('Upload failed.'));
        return;
      }

      try {
        const parsed = JSON.parse(xhr.responseText || '{}') as UploadSpotApiResponse;
        const mediaUrl = parsed.url || '';
        if (!mediaUrl) {
          reject(new Error('Upload succeeded but no media URL was returned.'));
          return;
        }
        resolve({
          url: mediaUrl,
          completedAt: parsed.completedAt || new Date().toISOString(),
          type: parsed.type || (file.type.startsWith('video/') ? 'video' : 'image'),
          description: parsed.description || description?.trim() || undefined,
        });
      } catch {
        reject(new Error('Invalid upload response.'));
      }
    };

    xhr.send(form);
  });
}

export async function suggestSpots(query: SpotSuggestionQuery): Promise<SpotSuggestion[]> {
  const params = buildSuggestionParams(query);
  const url = getApiUrl(`/spot?${params.toString()}`);

  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(await readErrorMessage(res, 'Unable to fetch spot suggestions.'));
  }

  const data = await parseJsonOrEmpty<SpotSuggestionApiResponse>(res);
  const rows = data?.spots || data?.data || [];
  return rows.map(mapSuggestion).filter((item): item is SpotSuggestion => item !== null);
}
