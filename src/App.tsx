import { useState, useEffect } from "react";

interface AppConfig {
  botToken: string;
  channelId: string;
  driveUrl: string;
}

interface DriveEntry {
  id?: string;
  title?: string;
  summary?: string;
  link?: string;
  category?: string;
  [key: string]: unknown;
}

export default function App() {
  const [config, setConfig] = useState<AppConfig>({ botToken: "", channelId: "", driveUrl: "" });
  const [entries, setEntries] = useState<DriveEntry[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dbConnected, setDbConnected] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");
  const [template, setTemplate] = useState(
    "📢 *{title}*\n\n📝 {summary}\n\n------------------------\n🔗 Read full article: {link}\n\n#{category} #GlobalNews"
  );

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => setConfig(data));
    fetch("/api/health")
      .then((r) => r.json())
      .then((data) => setDbConnected(data.db === "connected"));
  }, []);

  function updateConfig(partial: Partial<AppConfig>) {
    const next = { ...config, ...partial };
    setConfig(next);
    fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
  }

  async function fetchDrive() {
    if (!config.driveUrl) return;
    setFetching(true);
    setStatus("");
    setEntries([]);
    setSelected(new Set());
    try {
      const r = await fetch("/api/drive/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: config.driveUrl }),
      });
      const data = await r.json();
      if (!r.ok) {
        setStatus(`Error: ${data.error}`);
      } else {
        setEntries(data.entries || []);
        setStatus(`${data.count} entradas cargadas desde Google Drive`);
      }
    } catch (e) {
      setStatus(`Error de conexión: ${e}`);
    } finally {
      setFetching(false);
    }
  }

  function toggleSelect(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === entries.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(entries.map((_, i) => i)));
    }
  }

  async function sendSelected() {
    const toSend = entries.filter((_, i) => selected.has(i));
    if (toSend.length === 0) return;
    setSending(true);
    setStatus("");
    try {
      const r = await fetch("/api/telegram/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: toSend, template }),
      });
      const data = await r.json();
      if (!r.ok) {
        setStatus(`Error: ${data.error}`);
      } else {
        setStatus(`Enviados: ${data.success}, Fallidos: ${data.failed}`);
        if (data.success > 0) {
          setEntries((prev) => prev.filter((_, i) => !selected.has(i)));
          setSelected(new Set());
        }
      }
    } catch (e) {
      setStatus(`Error de conexión: ${e}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="w-full min-h-screen bg-[#E4E3E0] text-[#141414] flex flex-col font-sans overflow-hidden">
      <header className="h-14 border-b border-[#141414] flex items-center justify-between px-6 bg-[#E4E3E0]">
        <div className="flex items-center gap-4">
          <span className="font-black text-lg tracking-tighter uppercase">DTN Publisher</span>
          <div className="flex items-center gap-2 bg-[#141414] text-[#E4E3E0] px-3 py-1 text-[10px] font-mono">
            <span className={`w-2 h-2 rounded-full ${dbConnected ? "bg-green-500" : "bg-red-500"}`} />
            DB: {dbConnected ? "CONNECTED" : "OFFLINE"}
          </div>
          <div className="flex items-center gap-2 bg-[#141414] text-[#E4E3E0] px-3 py-1 text-[10px] font-mono">
            <span className={`w-2 h-2 rounded-full ${config.botToken ? "bg-green-500" : "bg-yellow-500"}`} />
            BOT: {config.botToken ? "ONLINE" : "NO CONFIGURED"}
          </div>
        </div>
      </header>

      {status && (
        <div className="h-8 bg-[#141414] text-[#E4E3E0] flex items-center px-6 text-[10px] font-mono">
          {status}
        </div>
      )}

      <main className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
        <section className="col-span-1 md:col-span-3 border-b md:border-b-0 md:border-r border-[#141414] flex flex-col overflow-hidden bg-white/50">
          <div className="p-4 border-b border-[#141414] bg-[#E4E3E0]">
            <h2 className="text-[10px] font-mono opacity-60 uppercase">Source: Google Drive</h2>
            <h1 className="text-xl font-serif italic">News Inbox</h1>
          </div>

          <div className="p-4 border-b border-[#141414] space-y-2">
            <label className="block text-[9px] uppercase opacity-40 mb-1">Drive URL</label>
            <input
              type="text"
              value={config.driveUrl}
              onChange={(e) => setConfig({ ...config, driveUrl: e.target.value })}
              className="w-full bg-white border border-[#141414] text-xs py-1 px-2 font-mono outline-none"
              placeholder="https://drive.google.com/..."
            />
            <button
              onClick={() => updateConfig({ driveUrl: config.driveUrl })}
              className="w-full border border-[#141414] py-1 text-[10px] font-bold hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
            >
              Save Drive URL
            </button>
            <button
              onClick={fetchDrive}
              disabled={fetching || !config.driveUrl}
              className="w-full bg-[#141414] text-[#E4E3E0] py-2 text-[10px] font-bold hover:opacity-80 transition-opacity disabled:opacity-40"
            >
              {fetching ? "Loading..." : "Download JSON Files"}
            </button>
          </div>

          <div className="p-4 flex-1 flex flex-col gap-2">
            <label className="block text-[9px] uppercase opacity-40 mb-1">Template</label>
            <textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="flex-1 min-h-[200px] border border-[#141414] bg-white p-3 font-mono text-xs outline-none resize-none"
            />
          </div>
        </section>

        <section className="col-span-1 md:col-span-6 border-b md:border-b-0 md:border-r border-[#141414] flex flex-col overflow-hidden">
          <div className="p-4 border-b border-[#141414] bg-[#E4E3E0] flex items-center justify-between">
            <div>
              <h2 className="text-[10px] font-mono opacity-60 uppercase">Loaded Entries</h2>
              <h1 className="text-xl font-serif italic">
                {entries.length > 0 ? `${entries.length} files ready` : "Inbox"}
              </h1>
            </div>
            {entries.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="border border-[#141414] px-3 py-1 text-[10px] font-bold hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
                >
                  {selected.size === entries.length ? "Deselect All" : "Select All"}
                </button>
                <button
                  onClick={sendSelected}
                  disabled={sending || selected.size === 0}
                  className="bg-blue-600 text-white px-3 py-1 text-[10px] font-bold hover:bg-blue-700 transition-colors disabled:opacity-40"
                >
                  {sending ? "Sending..." : `Send ${selected.size > 0 ? `(${selected.size})` : ""}`}
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {entries.length === 0 ? (
              <div className="p-6 text-center opacity-40 font-mono text-xs">
                {fetching ? "Loading entries..." : "No entries loaded. Paste a Drive URL and click Download."}
              </div>
            ) : (
              entries.map((entry, i) => {
                const preview = fillTemplate(template, entry);
                return (
                  <div
                    key={i}
                    className={`border-b border-[#141414]/10 p-4 hover:bg-black/5 transition-colors ${
                      selected.has(i) ? "bg-blue-50" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selected.has(i)}
                        onChange={() => toggleSelect(i)}
                        className="mt-1 accent-[#141414]"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm truncate">{entry.title || "Untitled"}</h3>
                        <p className="text-xs opacity-60 mt-1 line-clamp-2">{entry.summary || (entry.description as string) || ""}</p>
                        <div className="flex gap-2 mt-2 text-[10px] font-mono">
                          {entry.category && (
                            <span className="bg-[#141414]/10 px-2 py-0.5">{entry.category}</span>
                          )}
                          {entry.link && (
                            <span className="text-blue-600 truncate max-w-[200px]">{entry.link}</span>
                          )}
                        </div>
                        <details className="mt-2">
                          <summary className="text-[9px] font-mono opacity-40 cursor-pointer hover:opacity-60">
                            Preview message
                          </summary>
                          <pre className="mt-1 bg-white border border-[#141414]/20 p-2 text-[9px] font-mono whitespace-pre-wrap overflow-x-auto">
                            {preview}
                          </pre>
                        </details>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="col-span-1 md:col-span-3 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-[#141414] bg-[#E4E3E0]">
            <h2 className="text-[10px] font-mono opacity-60 uppercase">Automation</h2>
            <h1 className="text-xl font-serif italic">Scheduling</h1>
          </div>
          <div className="p-4 bg-[#141414] text-[#E4E3E0] flex-1">
            <h3 className="text-[10px] font-bold uppercase mb-4 opacity-50">Telegram Integration</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[9px] uppercase opacity-40 mb-1">Bot Token</label>
                <input
                  type="password"
                  value={config.botToken}
                  onChange={(e) => setConfig({ ...config, botToken: e.target.value })}
                  className="w-full bg-transparent border-b border-[#E4E3E0]/30 text-xs py-1 font-mono outline-none"
                />
              </div>
              <div>
                <label className="block text-[9px] uppercase opacity-40 mb-1">Channel ID</label>
                <input
                  type="text"
                  value={config.channelId}
                  onChange={(e) => setConfig({ ...config, channelId: e.target.value })}
                  className="w-full bg-transparent border-b border-[#E4E3E0]/30 text-xs py-1 font-mono outline-none"
                />
              </div>
              <button
                onClick={() => updateConfig({ botToken: config.botToken, channelId: config.channelId })}
                className="w-full border border-[#E4E3E0] py-2 text-[10px] font-bold hover:bg-[#E4E3E0] hover:text-[#141414] transition-all"
              >
                Save Bot Config
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="h-8 border-t border-[#141414] flex items-center px-6 justify-between bg-white text-[9px] font-mono uppercase tracking-widest">
        <span>Status: {sending ? "Sending..." : fetching ? "Downloading..." : "Idle"}</span>
        <span>Entries: {entries.length} | Selected: {selected.size}</span>
      </footer>
    </div>
  );
}

function fillTemplate(template: string, entry: DriveEntry): string {
  const summary = entry.summary || (entry.description as string) || "";
  return template
    .replace(/\{title\}/g, entry.title || "")
    .replace(/\{summary\}/g, summary)
    .replace(/\{link\}/g, entry.link || "")
    .replace(/\{category\}/g, entry.category || "");
}
