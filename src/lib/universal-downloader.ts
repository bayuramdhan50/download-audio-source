import { Platform } from './links';

export interface ExtractionResult {
  success: boolean;
  downloadUrl?: string;
  title?: string;
  error?: string;
}

// Helper untuk mengekstrak ID YouTube dari URL
function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
  return match ? match[1] : null;
}

// 1. Helper untuk mencoba Invidious API (khusus YouTube audio streams)
async function tryInvidiousApi(url: string): Promise<ExtractionResult | null> {
  const videoId = getYouTubeId(url);
  if (!videoId) return null;

  const invidiousInstances = [
    'https://inv.tux.zone/api/v1/videos/',
    'https://invidious.nerdvpn.de/api/v1/videos/',
    'https://invidious.flokinet.to/api/v1/videos/',
    'https://inv.perennialte.ch/api/v1/videos/',
    'https://invidious.projectsegfau.lt/api/v1/videos/',
    'https://inv.nocomment.life/api/v1/videos/',
    'https://invidious.privacydev.net/api/v1/videos/'
  ];

  for (const endpoint of invidiousInstances) {
    try {
      const res = await fetch(`${endpoint}${videoId}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.adaptiveFormats && Array.isArray(data.adaptiveFormats)) {
          // Cari stream audio dengan bitrate tertinggi
          const audioFormats = data.adaptiveFormats
            .filter((f: { type?: string; audioQuality?: string }) => (f.type && f.type.includes('audio')) || f.audioQuality)
            .sort((a: { bitrate?: number }, b: { bitrate?: number }) => (b.bitrate || 0) - (a.bitrate || 0));

          if (audioFormats.length > 0 && audioFormats[0].url) {
            return {
              success: true,
              downloadUrl: audioFormats[0].url,
              title: data.title || 'YouTube Audio',
            };
          }
        }
      }
    } catch {
      // Abaikan error jaringan ke instance ini, lanjut ke berikutnya
    }
  }
  return null;
}

// 2. Helper untuk mencoba Cobalt API (banyak instance komunitas aktif)
async function tryCobaltApi(url: string): Promise<ExtractionResult | null> {
  const instances = [
    'https://api.cobalt.best/',
    'https://cobalt.api.timdorr.com/',
    'https://cobalt.qylix.workers.dev/',
    'https://cobalt.kudoai.com/',
    'https://cobalt.clynt.cc/',
    'https://cobalt.canine.cloud/',
    'https://api.server.cobalt.tools/',
    'https://api.cobalt.tools/'
  ];

  for (const endpoint of instances) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: url,
          downloadMode: 'audio',
          isAudioOnly: true,
          audioFormat: 'mp3',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const downloadUrl = data.url || data.audio || data.picker?.[0]?.url;
        if (downloadUrl) {
          return {
            success: true,
            downloadUrl: downloadUrl,
            title: data.filename ? data.filename.replace(/\.[^/.]+$/, '') : undefined,
          };
        }
      }
    } catch {
      // Abaikan error jaringan ke instance ini, coba instance berikutnya
    }
  }
  return null;
}

// 3. Helper untuk mencoba TikTok API Fallbacks (TikWM & Tiklydown)
async function tryTikTokFallbacks(url: string): Promise<ExtractionResult | null> {
  // TikWM
  try {
    const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
    if (res.ok) {
      const json = await res.json();
      if (json && json.data && (json.data.music || json.data.play)) {
        return {
          success: true,
          downloadUrl: json.data.music || json.data.play,
          title: json.data.title || 'TikTok Audio',
        };
      }
    }
  } catch {}

  // Tiklydown
  try {
    const res = await fetch(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`);
    if (res.ok) {
      const json = await res.json();
      if (json && (json.music || json.video)) {
        return {
          success: true,
          downloadUrl: json.music || json.video?.noWatermark || json.video,
          title: json.title || 'TikTok Audio',
        };
      }
    }
  } catch {}

  return null;
}

// Mengekstrak tautan audio MP3 (Mencoba server standalone lokal terlebih dahulu, fallback ke API publik saat di GitHub Pages)
export async function extractAudioUrl(url: string, platform: Platform): Promise<ExtractionResult> {
  if (platform === 'Direct Audio' || platform === 'Roblox Asset') {
    return {
      success: true,
      downloadUrl: url,
    };
  }

  // 1. Coba panggil server lokal mandiri (/api/extract)
  try {
    const res = await fetch(`/api/extract?url=${encodeURIComponent(url)}&platform=${encodeURIComponent(platform)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.downloadUrl) {
        return {
          success: true,
          downloadUrl: data.downloadUrl,
          title: data.title,
        };
      }
    }
  } catch {
    // Jika gagal terhubung ke /api/extract (misal saat berjalan di GitHub Pages statis), lanjut ke fallback
  }

  // 2. Jika platform TikTok, coba TikTok APIs
  if (platform === 'TikTok') {
    const tikResult = await tryTikTokFallbacks(url);
    if (tikResult) return tikResult;
  }

  // 3. Jika platform YouTube (atau URL mengandung youtu), coba Invidious API terlebih dahulu
  if (platform === 'YouTube' || url.includes('youtu')) {
    const invResult = await tryInvidiousApi(url);
    if (invResult) return invResult;
  }

  // 4. Coba Cobalt API (untuk YouTube, TikTok, SoundCloud, Spotify, dll)
  const cobaltResult = await tryCobaltApi(url);
  if (cobaltResult) return cobaltResult;

  // 5. Jika semua fallback gagal
  return {
    success: false,
    error: 'Gagal mengunduh audio. Saat berjalan di GitHub Pages statis tanpa server lokal, pastikan link valid atau server API pengunduh publik sedang aktif.',
  };
}
