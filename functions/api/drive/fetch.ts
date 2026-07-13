import { extractFolderId, fetchDriveEntries, fetchSingleDriveFile, fetchGenericJsonUrl } from "../../../src/drive.ts";

interface Env {
  GDRIVE_API_KEY?: string;
}

function isDriveUrl(url: string): boolean {
  return /drive\.google\.com|docs\.google\.com\//.test(url);
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const apiKey = context.env.GDRIVE_API_KEY || "";
  try {
    const { url } = (await context.request.json()) as { url?: string };
    if (!url) {
      return new Response(JSON.stringify({ error: "URL is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    let entries;

    if (isDriveUrl(url)) {
      // Google Drive URL — extract file/folder ID and use the Drive API
      const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      const folderId = extractFolderId(url);

      if (!folderId) {
        return new Response(
          JSON.stringify({ error: "Could not extract folder/file ID from URL" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      if (fileMatch) {
        entries = await fetchSingleDriveFile(folderId, apiKey);
      } else {
        entries = await fetchDriveEntries(folderId, apiKey);
      }
    } else {
      // Generic JSON URL — fetch directly
      entries = await fetchGenericJsonUrl(url);
    }

    return new Response(
      JSON.stringify({ entries, count: entries.length }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
