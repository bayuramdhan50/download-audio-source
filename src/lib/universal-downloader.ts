import { Platform } from './links';

export interface ExtractionResult {
  success: boolean;
  downloadUrl?: string;
  title?: string;
  error?: string;
}

// Helper untuk mencoba Cobalt API (public instances)
async function tryCobaltApi(url: string): Promise<ExtractionResult | null> {
  const instances = [
    'https://api.cobalt.tools/',
    'https://cobalt.api.timdorr.com/',
    'https://api.server.cobalt.tools/',
    'https://co.wuk.sh/api/json'
  ];

  for (const endpoint of instances) {
    try {
      // Coba format v10 / v7
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

// Helper untuk mencoba TikWM API (khusus TikTok)
async function tryTikwmApi(url: string): Promise<ExtractionResult | null> {
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
  } catch {
    // Abaikan error
  }
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

  // 2. Jika platform TikTok, coba TikWM API
  if (platform === 'TikTok') {
    const tikwmResult = await tryTikwmApi(url);
    if (tikwmResult) return tikwmResult;
  }

  // 3. Coba Cobalt API (untuk YouTube, TikTok, SoundCloud, dll)
  const cobaltResult = await tryCobaltApi(url);
  if (cobaltResult) return cobaltResult;

  // 4. Jika semua fallback gagal
  return {
    success: false,
    error: 'Gagal mengunduh audio. Saat berjalan di GitHub Pages statis tanpa server lokal, pastikan link valid atau server API pengunduh publik sedang aktif.',
  };
}
