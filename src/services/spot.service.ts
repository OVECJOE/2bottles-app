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

type SpotCreateResponse = { spotId: string };
type SpotRatingResponse = { ok: boolean };
type SpotUploadResponse = SpotUploadResult;

const SPOT_API_BASE = (import.meta.env.VITE_SPOT_API_BASE as string | undefined)?.trim() || '';
const MOCK_SPOTS_KEY = '2b:mock-spots';

function getApiUrl(path: string): string {
  if (!SPOT_API_BASE) return '';
  return `${SPOT_API_BASE.replace(/\/$/, '')}${path}`;
}

function readMockSpots(): any[] {
  try {
    return JSON.parse(localStorage.getItem(MOCK_SPOTS_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeMockSpots(spots: any[]) {
  localStorage.setItem(MOCK_SPOTS_KEY, JSON.stringify(spots));
}

async function mockCreateSpot(input: SpotCreateInput): Promise<SpotCreateResponse> {
  const spotId = `spot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const spots = readMockSpots();
  spots.push({
    id: spotId,
    venueName: input.venueName,
    venueAddress: input.venueAddress || '',
    category: input.category || '',
    coordinates: input.coordinates || null,
    reason: input.reason || '',
    rating: null,
    comment: '',
    uploads: [],
    createdAt: Date.now(),
  });
  writeMockSpots(spots);
  return { spotId };
}

async function mockSubmitRating(spotId: string, input: SpotRatingInput): Promise<SpotRatingResponse> {
  const spots = readMockSpots();
  const idx = spots.findIndex((s) => s.id === spotId);
  if (idx >= 0) {
    spots[idx].rating = input.rating;
    spots[idx].comment = input.comment || '';
    spots[idx].ratedAt = Date.now();
    writeMockSpots(spots);
  }
  return { ok: true };
}

async function mockUpload(
  spotId: string,
  file: File,
  description?: string,
  onProgress?: (progress: number) => void,
): Promise<SpotUploadResponse> {
  if (onProgress) {
    for (let p = 10; p <= 95; p += 15) {
      onProgress(p);
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
  }

  const result: SpotUploadResult = {
    url: URL.createObjectURL(file),
    completedAt: new Date().toISOString(),
    type: file.type.startsWith('video/') ? 'video' : 'image',
    description: description?.trim() || undefined,
  };

  const spots = readMockSpots();
  const idx = spots.findIndex((s) => s.id === spotId);
  if (idx >= 0) {
    spots[idx].uploads = spots[idx].uploads || [];
    spots[idx].uploads.push(result);
    writeMockSpots(spots);
  }

  if (onProgress) onProgress(100);
  return result;
}

export async function createSpot(input: SpotCreateInput): Promise<SpotCreateResponse> {
  const url = getApiUrl('/spot');
  if (!url) return mockCreateSpot(input);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) throw new Error('Unable to create spot.');
  const data = await res.json();
  return { spotId: data.spotId || data.id };
}

export async function submitSpotRating(spotId: string, input: SpotRatingInput): Promise<SpotRatingResponse> {
  const url = getApiUrl(`/spot/${encodeURIComponent(spotId)}/rating`);
  if (!url) return mockSubmitRating(spotId, input);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) throw new Error('Unable to save rating.');
  return { ok: true };
}

export async function uploadSpotMedia(
  spotId: string,
  file: File,
  description?: string,
  onProgress?: (progress: number) => void,
): Promise<SpotUploadResponse> {
  const url = getApiUrl(`/spot/${encodeURIComponent(spotId)}/upload`);
  if (!url) return mockUpload(spotId, file, description, onProgress);

  return new Promise<SpotUploadResponse>((resolve, reject) => {
    const form = new FormData();
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
        const parsed = JSON.parse(xhr.responseText || '{}');
        resolve({
          url: parsed.url,
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
