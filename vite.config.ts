import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import youtubedl from 'youtube-dl-exec';

// Membersihkan parameter playlist (&list=..., &index=..., &pp=...) agar tidak mengganggu ekstraksi video
function cleanMediaUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      const v = u.searchParams.get('v');
      if (v) {
        return `https://www.youtube.com/watch?v=${v}`;
      }
      if (u.pathname && u.pathname !== '/') {
        return `https://www.youtube.com${u.pathname}`;
      }
    }
  } catch {
    // abaikan jika bukan URL valid
  }
  return rawUrl;
}

// Helper untuk fetch stream dari Node.js dan mengalirkannya langsung ke browser (Bebas CORS & mendukung redirect!)
function pipeStreamFromUrl(streamUrl: string, res: any, filename: string, redirectCount = 0) {
  if (redirectCount > 5) {
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Terlalu banyak pengalihan (redirect) dari server sumber.' }));
    }
    return;
  }

  const protocol = streamUrl.startsWith('https') ? https : http;
  const req = protocol.get(
    streamUrl,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
      },
    },
    (streamRes) => {
      // Tangani redirect (301, 302, 303, 307, 308)
      if (streamRes.statusCode && streamRes.statusCode >= 300 && streamRes.statusCode < 400 && streamRes.headers.location) {
        let nextUrl = streamRes.headers.location;
        if (nextUrl.startsWith('/')) {
          const u = new URL(streamUrl);
          nextUrl = `${u.protocol}//${u.host}${nextUrl}`;
        }
        pipeStreamFromUrl(nextUrl, res, filename, redirectCount + 1);
        return;
      }

      if (streamRes.statusCode !== 200 && streamRes.statusCode !== 206) {
        if (!res.headersSent) {
          res.writeHead(streamRes.statusCode || 500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: `Server penyedia merespons dengan status ${streamRes.statusCode}` }));
        }
        return;
      }

      res.setHeader('Content-Type', streamRes.headers['content-type'] || 'audio/mpeg');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      streamRes.pipe(res);
    }
  );
  req.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Gagal mengalirkan data audio dari server lokal.' }));
    }
  });
  req.end();
}

// Plugin Vite Middleware Standalone untuk ekstraksi audio murni tanpa pihak ketiga / API eksternal
function standaloneAudioPlugin(): Plugin {
  return {
    name: 'standalone-audio-middleware',
    configureServer(server) {
      // 1. Endpoint /api/extract -> Mengecek validitas & mengembalikan URL stream lokal (/api/stream) dengan judul lagu asli
      server.middlewares.use('/api/extract', async (req, res, next) => {
        if (req.method !== 'GET') return next();
        const requestUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
        const rawUrl = requestUrl.searchParams.get('url');
        const platform = requestUrl.searchParams.get('platform') || 'Audio';

        if (!rawUrl) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'URL tidak valid' }));
          return;
        }

        const url = cleanMediaUrl(rawUrl);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');

        try {
          const info: any = await youtubedl(url, {
            dumpSingleJson: true,
            noWarnings: true,
            preferFreeFormats: true,
            noPlaylist: true,
            jsRuntimes: 'node',
            format: 'bestaudio/best',
          });

          let safeTitle = (info.title || platform).replace(/[/\\?%*:|"<>｜]/g, ' ').replace(/\s+/g, ' ').trim();
          if (!safeTitle) safeTitle = `${platform}-Audio-${Date.now()}`;

          const localStreamUrl = `/api/stream?url=${encodeURIComponent(url)}&title=${encodeURIComponent(safeTitle)}&platform=${encodeURIComponent(platform)}`;
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, downloadUrl: localStreamUrl, title: safeTitle }));
        } catch (err: any) {
          const errMsg = err instanceof Error ? err.message : 'Gagal mengekstrak informasi audio dari tautan tersebut.';
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: errMsg }));
        }
      });

      // 2. Endpoint /api/stream -> Mengunduh stream audio standalone (menggunakan yt-dlp murni) lalu pipe ke browser
      server.middlewares.use('/api/stream', async (req, res, next) => {
        if (req.method !== 'GET') return next();
        const requestUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
        const rawUrl = requestUrl.searchParams.get('url');
        const platform = requestUrl.searchParams.get('platform') || 'Audio';
        const customTitle = requestUrl.searchParams.get('title');

        if (!rawUrl) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'URL tidak valid' }));
          return;
        }

        const url = cleanMediaUrl(rawUrl);

        try {
          const info: any = await youtubedl(url, {
            dumpSingleJson: true,
            noWarnings: true,
            preferFreeFormats: true,
            noPlaylist: true,
            jsRuntimes: 'node',
            format: 'bestaudio/best',
          });

          let safeTitle = customTitle || info.title || platform;
          safeTitle = safeTitle.replace(/[/\\?%*:|"<>｜]/g, ' ').replace(/\s+/g, ' ').trim();
          if (!safeTitle) safeTitle = `${platform}-Audio-${Date.now()}`;
          const filename = `${safeTitle}.mp3`;

          let streamUrl = info.url;
          if (!streamUrl && info.formats && Array.isArray(info.formats)) {
            const audioFormats = info.formats.filter((f: any) => (f.acodec !== 'none' || f.vcodec === 'none') && f.url);
            if (audioFormats.length > 0) {
              streamUrl = audioFormats[audioFormats.length - 1].url;
            }
          }

          if (streamUrl) {
            pipeStreamFromUrl(streamUrl, res, filename);
            return;
          }
        } catch (ytDlpError) {
          if (!res.headersSent) {
            const errMsg = ytDlpError instanceof Error ? ytDlpError.message : 'Gagal mengunduh stream audio secara standalone.';
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: errMsg }));
          }
          return;
        }

        if (!res.headersSent) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Stream audio tidak ditemukan dari server penyedia.' }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), standaloneAudioPlugin()],
});
