export type Platform = 'YouTube' | 'Spotify' | 'TikTok' | 'SoundCloud' | 'Roblox Asset' | 'Direct Audio' | 'Unknown';
export type LinkStatus = 'Downloadable' | 'Invalid' | 'Unsupported' | 'Duplicate';

export interface AudioLink {
  id: string;
  url: string;
  platform: Platform;
  status: LinkStatus;
  notes: string;
}

const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac'];
const URL_PATTERN = /https?:\/\/[^\s,;"'<>]+/gi;

export function extractUrls(input: string): string[] {
  return (input.match(URL_PATTERN) ?? []).map((url) => url.replace(/[).\]]+$/, ''));
}

export function detectPlatform(url: string): Platform {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return 'Unknown';
  }

  const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
  const path = parsed.pathname.toLowerCase();

  if (host.includes('youtube.com') || host === 'youtu.be') return 'YouTube';
  if (host.includes('spotify.com')) return 'Spotify';
  if (host.includes('tiktok.com')) return 'TikTok';
  if (host.includes('soundcloud.com')) return 'SoundCloud';
  if (host.includes('roblox.com') || host.includes('rbxcdn.com')) return 'Roblox Asset';
  if (AUDIO_EXTENSIONS.some((extension) => path.endsWith(extension)) || host.includes('cdn.') || host.includes('github.io')) {
    return 'Direct Audio';
  }

  return 'Unknown';
}

export function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function getLinkStatus(url: string, platform: Platform, isDuplicate: boolean): LinkStatus {
  if (isDuplicate) return 'Duplicate';
  if (!isValidHttpUrl(url)) return 'Invalid';
  if (['Direct Audio', 'Roblox Asset', 'YouTube', 'Spotify', 'TikTok', 'SoundCloud'].includes(platform)) return 'Downloadable';
  return 'Unsupported';
}

export function getStatusNotes(status: LinkStatus, platform: Platform): string {
  const notes: Record<LinkStatus, string> = {
    Downloadable: 'Tautan terdeteksi. Klik Download untuk mengunduh audio MP3.',
    Invalid: 'Format URL tidak valid atau rusak.',
    Unsupported: 'Platform ini belum mendukung pengunduhan otomatis.',
    Duplicate: 'Duplikat dari tautan yang sudah ada dalam daftar.',
  };

  return notes[status];
}

export function processLinks(input: string): AudioLink[] {
  const seen = new Set<string>();

  return extractUrls(input).map((url, index) => {
    const normalizedUrl = url.trim();
    const key = normalizedUrl.toLowerCase();
    const isDuplicate = seen.has(key);
    const platform = detectPlatform(normalizedUrl);
    const status = getLinkStatus(normalizedUrl, platform, isDuplicate);

    if (!isDuplicate) seen.add(key);

    return {
      id: `${key}-${index}`,
      url: normalizedUrl,
      platform,
      status,
      notes: getStatusNotes(status, platform),
    };
  });
}

export function summarizeLinks(links: AudioLink[]) {
  return {
    total: links.length,
    valid: links.filter((link) => link.status !== 'Invalid').length,
    downloadable: links.filter((link) => link.status === 'Downloadable').length,
  };
}
