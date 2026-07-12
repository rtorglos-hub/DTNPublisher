export function extractFolderId(url: string): string | null {
  const patterns = [
    /\/drive\/folders\/([a-zA-Z0-9_-]+)/,
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export interface DriveEntry {
  id?: string;
  title?: string;
  summary?: string;
  link?: string;
  category?: string;
  [key: string]: unknown;
}

export async function fetchDriveEntries(folderId: string, apiKey: string): Promise<DriveEntry[]> {
  const apiBase = `https://www.googleapis.com/drive/v3/files`;

  const listUrl = `${apiBase}?q='${folderId}'+in+parents&key=${apiKey}&fields=files(id,name,mimeType)&pageSize=100`;
  const listRes = await fetch(listUrl);
  if (!listRes.ok) {
    const err = await listRes.text();
    throw new Error(`Drive API list error: ${listRes.status} - ${err}`);
  }

  const listData = (await listRes.json()) as { files?: { id: string; name: string; mimeType: string }[] };
  const files = (listData.files || []).filter((f) => f.name.endsWith(".json"));

  const allEntries: DriveEntry[] = [];
  for (const file of files) {
    const dlUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${apiKey}`;
    const dlRes = await fetch(dlUrl);
    if (!dlRes.ok) continue;

    const data = await dlRes.json();
    if (Array.isArray(data)) {
      allEntries.push(...data);
    } else {
      allEntries.push(data);
    }
  }

  return allEntries;
}

export async function fetchSingleDriveFile(fileId: string, apiKey: string): Promise<DriveEntry[]> {
  const dlUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`;
  const dlRes = await fetch(dlUrl);
  if (!dlRes.ok) {
    const err = await dlRes.text();
    throw new Error(`Drive API download error: ${dlRes.status} - ${err}`);
  }

  const data = await dlRes.json();
  if (Array.isArray(data)) return data;
  return [data];
}
