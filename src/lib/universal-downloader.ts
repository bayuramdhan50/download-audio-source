import { Platform } from './links';

export interface ExtractionResult {
  success: boolean;
  downloadUrl?: string;
  title?: string;
  error?: string;
}

// Mengekstrak tautan audio MP3 secara 100% Standalone via server lokal (Tanpa API pihak ketiga apapun)
export async function extractAudioUrl(url: string, platform: Platform): Promise<ExtractionResult> {
  if (platform === 'Direct Audio' || platform === 'Roblox Asset') {
    return {
      success: true,
      downloadUrl: url,
    };
  }

  try {
    // Panggil langsung ke Vite Dev Server middleware (/api/extract) yang menjalankan pemrosesan standalone lokal
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
      return {
        success: false,
        error: data.error || 'Gagal mengunduh audio secara standalone.',
      };
    }
    return {
      success: false,
      error: `Server merespons dengan status ${res.status}. Pastikan server pengembangan aktif.`,
    };
  } catch {
    return {
      success: false,
      error: 'Gagal terhubung ke pemroses audio lokal. Pastikan Anda menjalankan aplikasi via server (npm run dev).',
    };
  }
}
