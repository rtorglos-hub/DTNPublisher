import { useState, useEffect } from "react";
import { 
  Bot, 
  CheckCircle, 
  AlertTriangle, 
  Info, 
  Copy, 
  Check, 
  Search, 
  Send, 
  Download, 
  Save, 
  Link2, 
  X, 
  FileText, 
  Folder,
  RefreshCw,
  ExternalLink,
  Filter
} from "lucide-react";

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

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
  title?: string;
}

export default function App() {
  const [config, setConfig] = useState<AppConfig>({ botToken: "", channelId: "", driveUrl: "" });
  const [entries, setEntries] = useState<DriveEntry[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dbConnected, setDbConnected] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [sending, setSending] = useState(false);
  const [testingBot, setTestingBot] = useState(false);
  const [template, setTemplate] = useState("{texto_telegram}");
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  // Search and Category Filters
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => setConfig(data))
      .catch(() => showToast("Error al cargar la configuración inicial", "error"));

    fetch("/api/health")
      .then((r) => r.json())
      .then((data) => setDbConnected(data.db === "connected"))
      .catch(() => setDbConnected(false));
  }, []);

  const showToast = (message: string, type: "success" | "error" | "info" = "info", title?: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type, title }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  async function handleSaveDriveUrl() {
    try {
      const next = { ...config, driveUrl: config.driveUrl };
      const r = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (r.ok) {
        showToast("Dirección de Google Drive guardada con éxito.", "success", "Enlace Guardado");
      } else {
        showToast("Error al guardar el enlace de Google Drive.", "error", "Error de Guardado");
      }
    } catch (e) {
      showToast(`Error de conexión: ${e}`, "error");
    }
  }

  async function handleSaveBotConfig() {
    if (!config.botToken) {
      showToast("El token del bot es obligatorio para verificar la conexión.", "error", "Error de Configuración");
      return;
    }
    
    setTestingBot(true);
    try {
      const response = await fetch("/api/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botToken: config.botToken }),
      });
      const data = await response.json();
      
      if (!response.ok || !data.ok) {
        showToast(data.error || "Token inválido o error de conexión.", "error", "Bot Inválido");
        return;
      }
      
      // Si el token es correcto, proceder a guardar la configuración
      const saveRes = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          botToken: config.botToken, 
          channelId: config.channelId, 
          driveUrl: config.driveUrl 
        }),
      });
      
      if (saveRes.ok) {
        showToast(
          `¡Configuración guardada! Bot verificado: @${data.username} (${data.first_name})`,
          "success",
          "Bot Conectado"
        );
      } else {
        showToast("Error al guardar la configuración en la base de datos.", "error", "Error de Guardado");
      }
    } catch (e) {
      showToast(`Error al validar bot: ${e}`, "error", "Error de Red");
    } finally {
      setTestingBot(false);
    }
  }

  async function fetchDrive() {
    if (!config.driveUrl) return;
    setFetching(true);
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
        showToast(data.error || "Error al descargar archivos", "error", "Error Google Drive");
      } else {
        setEntries(data.entries || []);
        showToast(`Se cargaron ${data.count} publicaciones correctamente.`, "success", "Descarga Exitosa");
      }
    } catch (e) {
      showToast(`Error de conexión: ${e}`, "error", "Error de Red");
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
    const visibleIndices = getFilteredEntriesIndices();
    const allVisibleSelected = visibleIndices.every(idx => selected.has(idx));

    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleIndices.forEach(idx => next.delete(idx));
      } else {
        visibleIndices.forEach(idx => next.add(idx));
      }
      return next;
    });
  }

  async function sendSelected() {
    const toSend = entries.filter((_, i) => selected.has(i));
    if (toSend.length === 0) return;
    setSending(true);
    
    try {
      const r = await fetch("/api/telegram/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: toSend, template }),
      });
      const data = await r.json();
      if (!r.ok) {
        showToast(data.error || "Error al enviar mensajes", "error", "Error de Envío");
      } else {
        showToast(
          `Publicados: ${data.success} | Fallidos: ${data.failed}`,
          data.failed === 0 ? "success" : "info",
          "Envío Terminado"
        );
        if (data.success > 0) {
          // Eliminar de la lista local los enviados con éxito
          setEntries((prev) => prev.filter((_, i) => !selected.has(i)));
          setSelected(new Set());
        }
      }
    } catch (e) {
      showToast(`Error de conexión: ${e}`, "error", "Error de Red");
    } finally {
      setSending(false);
    }
  }

  const handleCopyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopiedIndex(index);
        showToast("Mensaje copiado al portapapeles con éxito.", "success");
        setTimeout(() => setCopiedIndex(null), 2000);
      })
      .catch((e) => showToast(`No se pudo copiar el texto: ${e}`, "error"));
  };

  // Helper to extract unique categories
  const categories = Array.from(
    new Set(entries.map((e) => e.category).filter(Boolean) as string[])
  );

  // Filter entries based on search and selected category
  const filteredEntries = entries.filter((entry) => {
    const textToSearch = `${entry.title || ""} ${entry.summary || ""} ${entry.category || ""}`.toLowerCase();
    const matchesSearch = textToSearch.includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || entry.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Get index list of currently filtered items
  const getFilteredEntriesIndices = (): number[] => {
    return entries
      .map((entry, idx) => ({ entry, idx }))
      .filter(({ entry }) => {
        const textToSearch = `${entry.title || ""} ${entry.summary || ""} ${entry.category || ""}`.toLowerCase();
        const matchesSearch = textToSearch.includes(search.toLowerCase());
        const matchesCategory = !selectedCategory || entry.category === selectedCategory;
        return matchesSearch && matchesCategory;
      })
      .map(({ idx }) => idx);
  };

  return (
    <div className="w-full min-h-screen bg-[#F0EFEB] text-[#1A1A1A] flex flex-col font-sans selection:bg-[#FFD166] selection:text-[#1A1A1A]">
      
      {/* Toast Notification Container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`border-2 border-[#1A1A1A] p-4 bg-white shadow-[4px_4px_0px_#1A1A1A] transition-all transform duration-300 flex items-start gap-3 relative ${
              toast.type === "success" 
                ? "bg-[#D8F3DC]" 
                : toast.type === "error" 
                ? "bg-[#FAD2E1]" 
                : "bg-[#E8F0FE]"
            }`}
          >
            <div className="mt-0.5">
              {toast.type === "success" && <CheckCircle className="w-5 h-5 text-green-700" />}
              {toast.type === "error" && <AlertTriangle className="w-5 h-5 text-red-700" />}
              {toast.type === "info" && <Info className="w-5 h-5 text-blue-700" />}
            </div>
            <div className="flex-1">
              {toast.title && <h4 className="font-black text-xs uppercase tracking-wider mb-0.5">{toast.title}</h4>}
              <p className="text-xs font-mono">{toast.message}</p>
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-[#1A1A1A]/60 hover:text-[#1A1A1A]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="h-16 border-b-4 border-[#1A1A1A] flex items-center justify-between px-6 bg-[#FFD166] shadow-[0_4px_0_#1A1A1A]">
        <div className="flex items-center gap-3">
          <div className="bg-[#1A1A1A] text-[#FFD166] p-1.5 border-2 border-[#1A1A1A] shadow-[2px_2px_0_#FFD166] transform rotate-[-2deg]">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="font-black text-xl tracking-tighter uppercase italic">DTN Publisher</span>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-white border-2 border-[#1A1A1A] px-3 py-1 text-[10px] font-mono shadow-[2px_2px_0_#1A1A1A]">
            <span className={`w-2.5 h-2.5 rounded-full border border-[#1A1A1A] ${dbConnected ? "bg-green-500" : "bg-red-500"}`} />
            DB: {dbConnected ? "ONLINE" : "OFFLINE"}
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-white border-2 border-[#1A1A1A] px-3 py-1 text-[10px] font-mono shadow-[2px_2px_0_#1A1A1A]">
            <span className={`w-2.5 h-2.5 rounded-full border border-[#1A1A1A] ${config.botToken ? "bg-green-500" : "bg-yellow-400"}`} />
            BOT: {config.botToken ? "ONLINE" : "DESCONECTADO"}
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        
        {/* Left Column: Config Panel */}
        <section className="lg:col-span-3 border-b-4 lg:border-b-0 lg:border-r-4 border-[#1A1A1A] flex flex-col bg-white overflow-y-auto">
          
          {/* Header Section */}
          <div className="p-4 border-b-2 border-[#1A1A1A] bg-[#A8DADC] flex items-center gap-2">
            <Folder className="w-5 h-5" />
            <h1 className="text-md font-black uppercase tracking-tight">Recursos e Input</h1>
          </div>

          {/* Google Drive Config */}
          <div className="p-4 border-b-2 border-[#1A1A1A] bg-[#F1FAEE] space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wide text-[#457B9D]">Origen: Google Drive</h3>
            
            <div>
              <label className="block text-[9px] uppercase font-black opacity-60 mb-1">Enlace a Carpeta o Archivo</label>
              <div className="relative">
                <input
                  type="text"
                  value={config.driveUrl}
                  onChange={(e) => setConfig({ ...config, driveUrl: e.target.value })}
                  className="w-full bg-white border-2 border-[#1A1A1A] text-xs py-1.5 pl-7 pr-2 font-mono outline-none shadow-[2px_2px_0_#1A1A1A] focus:translate-x-[-1px] focus:translate-y-[-1px] focus:shadow-[3px_3px_0_#1A1A1A] transition-all"
                  placeholder="https://drive.google.com/..."
                />
                <Link2 className="w-4 h-4 absolute left-2 top-2 text-[#1A1A1A]/50" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={handleSaveDriveUrl}
                className="border-2 border-[#1A1A1A] py-1.5 text-[10px] font-black uppercase bg-[#E9D8A6] hover:bg-[#D9C896] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[2px_2px_0_#1A1A1A] transition-all shadow-[1px_1px_0_#1A1A1A]"
              >
                <div className="flex items-center justify-center gap-1">
                  <Save className="w-3.5 h-3.5" /> Guardar Link
                </div>
              </button>
              <button
                onClick={fetchDrive}
                disabled={fetching || !config.driveUrl}
                className="border-2 border-[#1A1A1A] py-1.5 text-[10px] font-black uppercase bg-[#1A1A1A] text-white hover:bg-[#333333] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[2px_2px_0_#1A1A1A] transition-all disabled:opacity-40 disabled:pointer-events-none"
              >
                <div className="flex items-center justify-center gap-1">
                  <Download className={`w-3.5 h-3.5 ${fetching ? "animate-spin" : ""}`} /> Descargar JSON
                </div>
              </button>
            </div>
          </div>

          {/* Template Config */}
          <div className="p-4 flex-1 flex flex-col bg-white">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-black uppercase tracking-wide text-[#E63946]">Plantilla de Envío</h3>
              <span className="text-[8px] font-mono bg-[#E63946]/10 text-[#E63946] border border-[#E63946] px-1.5 font-bold rounded">TELEGRAM</span>
            </div>
            <p className="text-[9px] text-[#1A1A1A]/70 mb-2">
              Usa <code className="bg-[#1A1A1A]/10 px-1 font-mono font-bold rounded">{`{texto_telegram}`}</code> para el contenido listo para enviar del JSON, o combina claves personalizadas.
            </p>
            <textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="flex-1 min-h-[180px] border-2 border-[#1A1A1A] bg-[#FDFDFD] p-3 font-mono text-xs outline-none resize-none shadow-[3px_3px_0_#1A1A1A] focus:translate-x-[-1px] focus:translate-y-[-1px] focus:shadow-[4px_4px_0_#1A1A1A] transition-all"
            />
          </div>
        </section>

        {/* Center Column: List of items */}
        <section className="lg:col-span-6 border-b-4 lg:border-b-0 lg:border-r-4 border-[#1A1A1A] flex flex-col overflow-hidden bg-[#FAF9F5]">
          
          {/* Header and Bulk Actions */}
          <div className="p-4 border-b-2 border-[#1A1A1A] bg-[#F0EFEB] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[9px] font-mono opacity-50 uppercase tracking-wider">Posts Cargados</h2>
                <h1 className="text-lg font-black uppercase tracking-tight flex items-center gap-1.5">
                  <FileText className="w-5 h-5" /> 
                  {entries.length > 0 ? `${entries.length} publicaciones listas` : "Bandeja vacía"}
                </h1>
              </div>
              
              {entries.length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={selectAll}
                    className="border-2 border-[#1A1A1A] bg-white px-3 py-1.5 text-[10px] font-black uppercase hover:bg-[#F0EFEB] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[2px_2px_0_#1A1A1A] transition-all shadow-[1px_1px_0_#1A1A1A]"
                  >
                    {selected.size === filteredEntries.length && filteredEntries.length > 0 ? "Deseleccionar" : "Seleccionar Todo"}
                  </button>
                  <button
                    onClick={sendSelected}
                    disabled={sending || selected.size === 0}
                    className="border-2 border-[#1A1A1A] bg-[#457B9D] text-white px-3 py-1.5 text-[10px] font-black uppercase hover:bg-[#3B6B8A] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[2px_2px_0_#1A1A1A] transition-all shadow-[1px_1px_0_#1A1A1A] disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <div className="flex items-center gap-1">
                      <Send className="w-3.5 h-3.5" /> Enviar {selected.size > 0 ? `(${selected.size})` : ""}
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Search and Filters */}
            {entries.length > 0 && (
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Buscar por título, contenido o etiquetas..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-white border-2 border-[#1A1A1A] text-xs py-1.5 pl-8 pr-2 outline-none font-mono placeholder:text-[#1A1A1A]/40"
                  />
                  <Search className="w-4 h-4 absolute left-2.5 top-2 text-[#1A1A1A]/40" />
                  {search && (
                    <button 
                      onClick={() => setSearch("")} 
                      className="absolute right-2 top-2 text-[#1A1A1A]/40 hover:text-[#1A1A1A]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Category tags filter */}
                {categories.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[9px] font-black uppercase tracking-wider text-[#1A1A1A]/50 mr-1 flex items-center gap-0.5">
                      <Filter className="w-3 h-3" /> Filtrar:
                    </span>
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className={`text-[9px] font-black uppercase px-2 py-0.5 border border-[#1A1A1A] transition-all hover:bg-[#1A1A1A]/10 ${
                        !selectedCategory ? "bg-[#1A1A1A] text-white" : "bg-white text-[#1A1A1A]"
                      }`}
                    >
                      Todos
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                        className={`text-[9px] font-black uppercase px-2 py-0.5 border border-[#1A1A1A] transition-all hover:bg-[#1A1A1A]/10 ${
                          selectedCategory === cat ? "bg-[#457B9D] text-white" : "bg-white text-[#1A1A1A]"
                        }`}
                      >
                        {cat.replace(/_/g, " ")}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* List items */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {entries.length === 0 ? (
              <div className="p-8 text-center bg-white border-2 border-dashed border-[#1A1A1A]/20 shadow-[3px_3px_0_rgba(0,0,0,0.05)] rounded-lg">
                <p className="font-mono text-xs opacity-50">
                  {fetching ? "Descargando publicaciones..." : "No hay publicaciones cargadas."}
                </p>
                {!fetching && (
                  <p className="font-mono text-[10px] opacity-40 mt-1">
                    Pega una URL válida de Drive y haz clic en Descargar.
                  </p>
                )}
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="p-8 text-center bg-white border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A]">
                <p className="font-mono text-xs opacity-50">Ninguna publicación coincide con la búsqueda.</p>
              </div>
            ) : (
              filteredEntries.map((entry, idx) => {
                const originalIndex = entries.indexOf(entry);
                const previewText = fillTemplate(template, entry);
                
                return (
                  <div
                    key={originalIndex}
                    className={`border-2 border-[#1A1A1A] p-4 transition-all duration-200 bg-white shadow-[4px_4px_0_#1A1A1A] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_#1A1A1A] ${
                      selected.has(originalIndex) ? "bg-[#FFD166]/10 border-[#FFD166]" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selected.has(originalIndex)}
                        onChange={() => toggleSelect(originalIndex)}
                        className="mt-1 w-4 h-4 cursor-pointer accent-[#1A1A1A] border-2 border-[#1A1A1A]"
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-black text-sm truncate uppercase tracking-tight text-[#1A1A1A]">
                            {entry.title || "Sin título"}
                          </h3>
                          {entry.category && (
                            <span className="bg-[#457B9D]/10 text-[#457B9D] border border-[#457B9D] px-2 py-0.5 text-[8px] font-black uppercase rounded">
                              {entry.category.replace(/_/g, " ")}
                            </span>
                          )}
                        </div>

                        <p className="text-xs opacity-80 mt-1 line-clamp-3 font-mono bg-gray-50 p-2 border border-[#1A1A1A]/10">
                          {entry.summary || ""}
                        </p>

                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#1A1A1A]/10">
                          <div className="flex gap-2">
                            {entry.link && (
                              <a
                                href={entry.link}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 text-[10px] font-bold hover:underline flex items-center gap-0.5 truncate max-w-[200px]"
                              >
                                <ExternalLink className="w-3 h-3" /> Ver fuente
                              </a>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleCopyToClipboard(previewText, originalIndex)}
                              className="border border-[#1A1A1A] bg-white px-2 py-1 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 hover:bg-[#1A1A1A]/5 shadow-[1px_1px_0_#1A1A1A]"
                            >
                              {copiedIndex === originalIndex ? (
                                <>
                                  <Check className="w-3 h-3 text-green-700" /> Copiado
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" /> Copiar Formato
                                </>
                              )}
                            </button>
                            <details className="inline-block">
                              <summary className="border border-[#1A1A1A] bg-white px-2 py-1 text-[9px] font-black uppercase tracking-wider cursor-pointer list-none flex items-center gap-1 hover:bg-[#1A1A1A]/5 shadow-[1px_1px_0_#1A1A1A]">
                                <Eye className="w-3 h-3" /> Vista Previa
                              </summary>
                              <pre className="absolute mt-2 left-0 right-0 mx-4 z-10 bg-white border-2 border-[#1A1A1A] p-3 text-[9px] font-mono whitespace-pre-wrap shadow-[5px_5px_0_#1A1A1A] max-h-[160px] overflow-y-auto">
                                {previewText}
                              </pre>
                            </details>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Right Column: Telegram Config */}
        <section className="lg:col-span-3 flex flex-col bg-white overflow-y-auto">
          
          <div className="p-4 border-b-2 border-[#1A1A1A] bg-[#FFD166] flex items-center gap-2">
            <Bot className="w-5 h-5" />
            <h1 className="text-md font-black uppercase tracking-tight">Integraciones</h1>
          </div>

          <div className="p-4 bg-[#1A1A1A] text-white flex-1 space-y-5">
            <div className="flex items-center justify-between border-b border-white/20 pb-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#FFD166]">Telegram Channel</h3>
              {testingBot && <RefreshCw className="w-4 h-4 animate-spin text-[#FFD166]" />}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[9px] uppercase font-black text-white/50 mb-1">Bot Token</label>
                <input
                  type="password"
                  value={config.botToken}
                  onChange={(e) => setConfig({ ...config, botToken: e.target.value })}
                  className="w-full bg-transparent border-b-2 border-white/30 text-xs py-1.5 font-mono outline-none text-[#FFD166] focus:border-[#FFD166] transition-colors"
                  placeholder="Introducir token del bot"
                />
              </div>

              <div>
                <label className="block text-[9px] uppercase font-black text-white/50 mb-1">Channel ID</label>
                <input
                  type="text"
                  value={config.channelId}
                  onChange={(e) => setConfig({ ...config, channelId: e.target.value })}
                  className="w-full bg-transparent border-b-2 border-white/30 text-xs py-1.5 font-mono outline-none text-[#FFD166] focus:border-[#FFD166] transition-colors"
                  placeholder="@mi_canal o -100123456789"
                />
                <span className="text-[8px] text-white/40 block mt-1 leading-normal">
                  Ejemplo: <b>@mi_canal</b> (público) o <b>-100192837465</b> (privado).
                </span>
              </div>

              <button
                onClick={handleSaveBotConfig}
                disabled={testingBot}
                className="w-full border-2 border-[#FFD166] py-2 text-[10px] font-black uppercase text-[#FFD166] hover:bg-[#FFD166] hover:text-[#1A1A1A] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0_rgba(255,209,102,0.4)] transition-all disabled:opacity-40 shadow-[1px_1px_0_rgba(255,209,102,0.2)]"
              >
                {testingBot ? "Verificando..." : "Guardar y Validar"}
              </button>
            </div>

            {/* Informative instructions */}
            <div className="bg-white/5 border border-white/10 p-3 rounded text-[9px] space-y-2 font-mono leading-relaxed text-white/70">
              <span className="font-bold text-[#FFD166] block uppercase tracking-wide">¿Cómo conseguir el ID?</span>
              <ul className="list-disc pl-4 space-y-1">
                <li>Agrega el bot a tu canal como <b>Administrador</b>.</li>
                <li>Para canales públicos, usa el alias (ej: @mi_canal).</li>
                <li>Para canales privados, reenvía un post del canal a un bot como <i>@RawDataBot</i> para obtener el ID numérico que inicia con <b>-100</b>.</li>
              </ul>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="h-10 border-t-2 border-[#1A1A1A] flex items-center px-6 justify-between bg-white text-[9px] font-black uppercase tracking-wider">
        <span>Estado: {sending ? "Enviando publicaciones..." : fetching ? "Cargando JSON..." : "Listo"}</span>
        <span>Entradas: {entries.length} | Seleccionados: {selected.size}</span>
      </footer>
    </div>
  );
}

function fillTemplate(template: string, entry: DriveEntry): string {
  return template
    .replace(/\{texto_telegram\}/g, String(entry.texto_telegram || entry.summary || ""))
    .replace(/\{fuente_nombre\}/g, String(entry.fuente_nombre || entry.title || ""))
    .replace(/\{fuente_url\}/g, String(entry.fuente_url || entry.link || ""))
    .replace(/\{categoria\}/g, String(entry.categoria || entry.category || ""))
    .replace(/\{title\}/g, String(entry.title || entry.fuente_nombre || ""))
    .replace(/\{summary\}/g, String(entry.summary || entry.texto_telegram || ""))
    .replace(/\{link\}/g, String(entry.link || entry.fuente_url || ""))
    .replace(/\{category\}/g, String(entry.category || entry.categoria || ""));
}
