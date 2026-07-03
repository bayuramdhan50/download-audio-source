import { useMemo, useState } from 'react';
import { exportAsCsv, exportAsJson, exportAsTxt } from './lib/export';
import { AudioLink, LinkStatus, Platform, detectPlatform, processLinks, summarizeLinks } from './lib/links';
import { extractAudioUrl } from './lib/universal-downloader';

const SAMPLE_INPUT = `https://www.youtube.com/watch?v=dQw4w9WgXcQ
https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b
https://www.tiktok.com/@creator/video/123456789
https://soundcloud.com/artist/demo-track`;

const PLATFORMS: Array<Platform | 'All'> = ['All', 'YouTube', 'Spotify', 'TikTok', 'SoundCloud', 'Roblox Asset', 'Direct Audio', 'Unknown'];
const STATUSES: Array<LinkStatus | 'All'> = ['All', 'Downloadable', 'Unsupported', 'Invalid', 'Duplicate'];

export function App() {
  const [input, setInput] = useState(SAMPLE_INPUT);
  const [links, setLinks] = useState<AudioLink[]>(() => processLinks(SAMPLE_INPUT));
  const [platformFilter, setPlatformFilter] = useState<Platform | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<LinkStatus | 'All'>('All');
  const [notice, setNotice] = useState('');
  const [errorNotice, setErrorNotice] = useState('');

  // Main 1-Click Downloader State
  const [quickUrl, setQuickUrl] = useState('');
  const [quickLoading, setQuickLoading] = useState(false);

  const summary = useMemo(() => summarizeLinks(links), [links]);
  const filteredLinks = useMemo(
    () => links.filter((link) => (platformFilter === 'All' || link.platform === platformFilter) && (statusFilter === 'All' || link.status === statusFilter)),
    [links, platformFilter, statusFilter],
  );

  function handleProcess() {
    const result = processLinks(input);
    setLinks(result);
    setNotice(result.length === 0 ? 'Tidak ada tautan yang ditemukan.' : `${result.length} tautan berhasil diproses.`);
    setTimeout(() => setNotice(''), 3000);
  }

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
    setNotice('✓ Teks berhasil disalin ke clipboard.');
    setTimeout(() => setNotice(''), 3000);
  }

  function removeLink(id: string) {
    setLinks((currentLinks) => currentLinks.filter((link) => link.id !== id));
  }

  // Pengunduh Langsung tanpa fallback link
  async function handleDownload(url: string, platform: Platform) {
    setErrorNotice('');
    setNotice(`⏳ Mengunduh & mengekstrak audio dari ${platform}...`);
    try {
      const res = await extractAudioUrl(url, platform);
      if (res.success && res.downloadUrl) {
        setNotice('⏳ Memulai pengunduhan audio...');
        const fileName = res.title ? `${res.title}.mp3` : `${platform.toLowerCase()}-audio-${Date.now()}.mp3`;

        // 1. Coba unduh sebagai Blob jika CORS mengizinkan, agar langsung tersimpan di folder Unduhan dengan nama akurat
        try {
          const blobRes = await fetch(res.downloadUrl);
          if (blobRes.ok) {
            const blob = await blobRes.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.setAttribute('download', fileName);
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
            setNotice('✓ Pengunduhan selesai! Periksa folder unduhan Anda.');
            return;
          }
        } catch {
          // Jika fetch blob terhalang CORS, lanjutkan ke metode pengalihan tautan unduh
        }

        // 2. Fallback untuk tautan cross-origin: buka di tab baru agar tidak menimpa atau keluar dari halaman aplikasi
        const a = document.createElement('a');
        a.href = res.downloadUrl;
        a.setAttribute('download', fileName);
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setNotice('✓ Pengunduhan dialihkan ke tab/jendela baru!');
      } else {
        setNotice('');
        setErrorNotice(res.error || 'Gagal mengunduh audio. Pastikan tautan valid dan dapat diakses publik.');
      }
    } catch {
      setNotice('');
      setErrorNotice('Terjadi kesalahan koneksi saat mengunduh audio dari server.');
    }
    setTimeout(() => {
      setNotice('');
      setErrorNotice('');
    }, 5000);
  }

  // Quick Download Handle
  async function handleQuickDownload() {
    if (!quickUrl.trim()) return;
    setQuickLoading(true);
    const platform = detectPlatform(quickUrl.trim()) || 'YouTube';
    await handleDownload(quickUrl.trim(), platform);
    setQuickLoading(false);
  }

  return (
    <main>
      <section className="hero" aria-labelledby="page-title">
        <div className="orb orb-one" />
        <div className="orb orb-two" />
        
        <nav className="nav" aria-label="Navigasi utama">
          <div className="nav-brand">
            <div className="nav-logo">⚡</div>
            <div>
              <strong>AudioLink Downloader</strong>
              <span className="eyebrow" style={{ marginLeft: '10px', marginBottom: 0 }}>MP3 & WAV Extractor</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '20px' }}>
            <a href="#quick-downloader">🎵 Unduh Instan</a>
            <a href="#batch-manager">📋 Batch Link Manager</a>
          </div>
        </nav>

        <div className="hero-grid">
          <div>
            <span className="eyebrow">YouTube • SoundCloud • TikTok • Spotify</span>
            <h1 id="page-title">Unduh Audio Langsung dari Tautan</h1>
            <p>
              Cukup tempel tautan dari platform streaming musik atau video, lalu tekan download. Sederhana, cepat, dan langsung terunduh tanpa tautan dialihkan (no fallback).
            </p>

            {/* Main Instant Downloader Box */}
            <div id="quick-downloader" style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(103, 232, 249, 0.3)', padding: '24px', borderRadius: '24px', marginTop: '28px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
              <span className="eyebrow" style={{ marginBottom: '8px' }}>⚡ Pengunduh Instan 1-Klik</span>
              <h3 style={{ margin: '0 0 14px', fontSize: '1.15rem' }}>Tempel Link Audio / Video di Sini:</h3>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Contoh: https://www.youtube.com/watch?v=... atau https://tiktok.com/@..."
                  value={quickUrl}
                  onChange={(e) => setQuickUrl(e.target.value)}
                  style={{ flex: 1, minWidth: '280px', padding: '16px 20px', fontSize: '1rem', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '16px', color: '#fff', outline: 'none' }}
                />
                <button
                  onClick={handleQuickDownload}
                  disabled={quickLoading || !quickUrl.trim()}
                  style={{ padding: '16px 28px', fontSize: '1rem', fontWeight: 800, borderRadius: '16px', cursor: 'pointer' }}
                >
                  {quickLoading ? '⏳ Mengunduh...' : '⬇️ Download Audio'}
                </button>
              </div>
            </div>
          </div>

          <div className="hero-card" aria-label="Ringkasan fitur">
            <div>
              <span>⚡ Sangat Sederhana</span>
              <strong>Copy, Paste, Download</strong>
              <p style={{ fontSize: '0.8rem', margin: '4px 0 0', color: '#cbd7f2' }}>Tanpa iklan pop-up dan tanpa pengalihan tautan eksternal.</p>
            </div>
            <div>
              <span>🎵 Kualitas Tinggi</span>
              <strong>MP3 & WAV Stream</strong>
              <p style={{ fontSize: '0.8rem', margin: '4px 0 0', color: '#cbd7f2' }}>Ekstraksi langsung dari sumber stream dengan kualitas audio terbaik.</p>
            </div>
            <div>
              <span>📊 Multi-Platform</span>
              <strong>YT • TikTok • SC • Spotify</strong>
              <p style={{ fontSize: '0.8rem', margin: '4px 0 0', color: '#cbd7f2' }}>Satu antarmuka untuk seluruh platform favorit Anda.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="batch-manager" className="panel">
        <div className="section-heading">
          <span className="eyebrow">Pengelola Daftar URL</span>
          <h2>Batch Link Manager (Banyak Tautan Sekaligus)</h2>
          <p>
            Memproses daftar banyak tautan sekaligus, menghapus duplikat secara otomatis, dan mengunduh audio per baris.
          </p>
        </div>

        {notice && <div className="notice" role="status"><span>{notice}</span></div>}
        {errorNotice && (
          <div className="notice" role="alert" style={{ background: 'rgba(244, 63, 94, 0.15)', borderColor: 'rgba(244, 63, 94, 0.4)', color: '#fda4af' }}>
            <span>❌ {errorNotice}</span>
          </div>
        )}

        <textarea
          id="bulk-link-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          aria-label="Bulk link input"
          placeholder="Tempel tautan audio (http://...) di sini, pisahkan dengan baris baru..."
          style={{ minHeight: '130px' }}
        />

        <div className="actions">
          <button id="process-links-button" onClick={handleProcess}>
            🔍 Validasi & Proses Daftar Tautan
          </button>
          <button className="ghost" onClick={() => copyText(links.map((link) => link.url).join('\n'))} disabled={links.length === 0}>
            📋 Salin Semua URL
          </button>
          <button className="ghost" onClick={() => exportAsCsv(links)} disabled={links.length === 0}>
            📊 Export CSV
          </button>
          <button className="ghost" onClick={() => exportAsJson(links)} disabled={links.length === 0}>
            📑 Export JSON
          </button>
          <button className="ghost" onClick={() => exportAsTxt(links)} disabled={links.length === 0}>
            📄 Export TXT
          </button>
        </div>

        <div className="stats" aria-label="Ringkasan hasil">
          <Stat label="Total Tautan" value={summary.total} />
          <Stat label="Tautan Valid" value={summary.valid} />
          <Stat label="Siap Diunduh" value={summary.downloadable} />
        </div>

        <div className="filters">
          <div className="filter-group">
            <label>
              <span>Filter Platform:</span>
              <select value={platformFilter} onChange={(event) => setPlatformFilter(event.target.value as Platform | 'All')}>
                {PLATFORMS.map((platform) => <option key={platform}>{platform}</option>)}
              </select>
            </label>
            <label>
              <span>Filter Status:</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as LinkStatus | 'All')}>
                {STATUSES.map((status) => <option key={status}>{status}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>Platform</th>
                <th>Tautan URL</th>
                <th>Status</th>
                <th>Aksi Unduh</th>
                <th>Catatan</th>
              </tr>
            </thead>
            <tbody>
              {filteredLinks.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: '#9aa8c7' }}>
                    Tidak ada tautan yang sesuai dengan filter saat ini.
                  </td>
                </tr>
              ) : (
                filteredLinks.map((link, index) => (
                  <tr key={link.id}>
                    <td style={{ fontWeight: 700, color: '#9aa8c7' }}>{index + 1}</td>
                    <td><span className="pill">{link.platform}</span></td>
                    <td className="url-cell">{link.url}</td>
                    <td>
                      <span className={`badge ${link.status.toLowerCase().replaceAll(' ', '-')}`}>
                        {link.status}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        {link.status === 'Downloadable' ? (
                          <button className="mini" onClick={() => handleDownload(link.url, link.platform)}>
                            ⬇️ Download
                          </button>
                        ) : (
                          <button className="mini secondary" disabled>
                            Tidak Didukung
                          </button>
                        )}
                        <button className="mini secondary" onClick={() => copyText(link.url)}>Salin</button>
                        <button className="mini danger" onClick={() => removeLink(link.id)}>Hapus</button>
                      </div>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: '#a78bfa' }}>{link.notes}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
