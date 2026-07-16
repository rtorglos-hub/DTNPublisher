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

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n");
}

function normalizeEntry(entry: any): DriveEntry {
  if (!entry || typeof entry !== "object") return entry;
  
  const normalized: DriveEntry = { ...entry };

  if (typeof normalized.texto_telegram === "string") {
    normalized.texto_telegram = normalizeText(normalized.texto_telegram);
  }
  
  if (!normalized.title) {
    normalized.title = entry.title || entry.fuente_nombre || entry.name || "Untitled";
  }
  if (!normalized.summary) {
    normalized.summary = normalizeText(entry.summary || entry.texto_telegram || entry.descripcion || entry.description || "");
  } else {
    normalized.summary = normalizeText(normalized.summary);
  }
  if (!normalized.link) {
    normalized.link = entry.link || entry.fuente_url || entry.url || "";
  }
  if (!normalized.category) {
    normalized.category = entry.category || entry.categoria || "";
  }
  
  return normalized;
}

function normalizeDriveData(data: any): DriveEntry[] {
  if (Array.isArray(data)) {
    return data.map(normalizeEntry);
  }
  
  if (data && typeof data === "object") {
    // Buscar propiedades de tipo array conocidas
    const arrayKeys = ["posts", "articles", "items", "entries", "data"];
    for (const key of arrayKeys) {
      if (Array.isArray(data[key])) {
        return data[key].map(normalizeEntry);
      }
    }
    
    // Buscar cualquier otra propiedad que sea un array
    for (const key in data) {
      if (Array.isArray(data[key])) {
        return data[key].map(normalizeEntry);
      }
    }
  }
  
  return [normalizeEntry(data)];
}

export async function fetchDriveEntries(folderId: string, apiKey: string): Promise<DriveEntry[]> {
  if (!apiKey) {
    throw new Error("La lectura de carpetas completas de Google Drive requiere configurar un GDRIVE_API_KEY. Si no dispones de una clave, introduce un enlace directo al archivo JSON en su lugar.");
  }

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
    allEntries.push(...normalizeDriveData(data));
  }

  return allEntries;
}

export async function fetchSingleDriveFile(fileId: string, apiKey: string): Promise<DriveEntry[]> {
  const dlUrl = apiKey
    ? `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`
    : `https://docs.google.com/uc?export=download&id=${fileId}`;

  const dlRes = await fetch(dlUrl);
  if (!dlRes.ok) {
    const err = await dlRes.text();
    throw new Error(apiKey ? `Drive API download error: ${dlRes.status} - ${err}` : `Public download error: ${dlRes.status} - ${err}`);
  }

  const data = await dlRes.json();
  return normalizeDriveData(data);
}

export async function fetchGenericJsonUrl(url: string): Promise<DriveEntry[]> {
  const res = await fetch(url, {
    headers: { "Accept": "application/json" },
    redirect: "follow",
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Error al descargar JSON desde la URL: ${res.status} - ${err}`);
  }

  const data = await res.json();
  return normalizeDriveData(data);
}
