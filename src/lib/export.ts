import type { AudioLink } from './links';

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportAsJson(links: AudioLink[]) {
  downloadFile('audio-links.json', JSON.stringify(links, null, 2), 'application/json');
}

export function exportAsTxt(links: AudioLink[]) {
  const validUrls = links.filter((link) => link.status !== 'Invalid').map((link) => link.url).join('\n');
  downloadFile('audio-links.txt', validUrls, 'text/plain');
}

export function exportAsCsv(links: AudioLink[]) {
  const header = ['Platform', 'URL', 'Status', 'Notes'];
  const rows = links.map((link) => [link.platform, link.url, link.status, link.notes]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n');

  downloadFile('audio-links.csv', csv, 'text/csv');
}
