import { useState, useEffect, FormEvent } from "react";
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
  Filter,
  Eye,
  EyeOff,
  Zap,
  Lock,
  Mail,
  LogOut
} from "lucide-react";

interface AppConfig {
  botToken: string;
  channelId: string;
  channelId2?: string;
  selectedChannel?: "primary" | "secondary";
  driveUrl: string;
  scheduleDays?: string;
  scheduleStart?: string;
  scheduleEnd?: string;
  scheduleTimezone?: string;
  autoDeleteDays?: number;
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

type CollapsibleSection = "resources" | "template" | "autoDelete";
type SectionVisibility = Record<CollapsibleSection, boolean>;

const defaultSectionVisibility: SectionVisibility = {
  resources: true,
  template: true,
  autoDelete: true,
};

export default function App() {
  const [config, setConfig] = useState<AppConfig>({
    botToken: "",
    channelId: "",
    channelId2: "",
    selectedChannel: "primary",
    driveUrl: "",
    autoDeleteDays: 10
  });
  const [entries, setEntries] = useState<DriveEntry[]>(() => {
    try {
      const saved = localStorage.getItem("dtn_inbox_entries");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("dtn_inbox_entries", JSON.stringify(entries));
  }, [entries]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dbConnected, setDbConnected] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [sending, setSending] = useState(false);
  const [testingBot, setTestingBot] = useState(false);
  const [template, setTemplate] = useState("{texto_telegram}\n\n[button:👉 Leer más]");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState<number | null>(null);

  // Scheduling Configurations State
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [scheduleStart, setScheduleStart] = useState("");
  const [scheduleEnd, setScheduleEnd] = useState("");
  const [scheduleTimezone, setScheduleTimezone] = useState("Europe/Madrid");

  // Tab and Queue States
  const [activeTab, setActiveTab] = useState<"inbox" | "queue">("inbox");
  const [scheduledEntries, setScheduledEntries] = useState<any[]>([]);
  const [fetchingQueue, setFetchingQueue] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  const [autoDeleteDays, setAutoDeleteDays] = useState<number>(10);
  const [sectionVisibility, setSectionVisibility] = useState<SectionVisibility>(() => {
    try {
      const saved = localStorage.getItem("dtn_section_visibility");
      return saved ? { ...defaultSectionVisibility, ...JSON.parse(saved) } : defaultSectionVisibility;
    } catch (e) {
      return defaultSectionVisibility;
    }
  });

  useEffect(() => {
    localStorage.setItem("dtn_section_visibility", JSON.stringify(sectionVisibility));
  }, [sectionVisibility]);

  // Sync config values with local form states
  useEffect(() => {
    if (config) {
      setSelectedDays(config.scheduleDays ? config.scheduleDays.split(",").map(Number) : []);
      setScheduleStart(config.scheduleStart || "10:00");
      setScheduleEnd(config.scheduleEnd || "18:00");
      setScheduleTimezone(config.scheduleTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Madrid");
      setAutoDeleteDays(config.autoDeleteDays !== undefined ? config.autoDeleteDays : 10);
    }
  }, [config]);

  // Fetch queue items when Queue tab is selected
  useEffect(() => {
    if (activeTab === "queue") {
      fetchQueue();
    }
  }, [activeTab]);

  // Authentication State
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  // Authenticated fetch wrapper
  const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, options);
    if (response.status === 401) {
      setIsLoggedIn(false);
    }
    return response;
  };

  const responseErrorMessage = async (response: Response, fallback: string) => {
    try {
      const data = await response.json();
      return data.error ? `${fallback}: ${data.error}` : fallback;
    } catch {
      return fallback;
    }
  };

  useEffect(() => {
    const initApp = async () => {
      try {
        const r = await authenticatedFetch("/api/config");
        if (r.ok) {
          const data = await r.json();
          setConfig(data);
          setIsLoggedIn(true);
        } else if (r.status === 401) {
          setIsLoggedIn(false);
          return;
        } else {
          showToast("Error al cargar la configuración inicial", "error");
          setIsLoggedIn(true);
        }
      } catch (e) {
        showToast("Error al cargar la configuración inicial", "error");
        setIsLoggedIn(true);
      }

      try {
        const r = await authenticatedFetch("/api/health");
        if (r.ok) {
          const data = await r.json();
          setDbConnected(data.db === "connected");
        }
      } catch (e) {
        setDbConnected(false);
      }
    };

    initApp();
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const showToast = (message: string, type: "success" | "error" | "info" = "info", title?: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type, title }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const toggleSection = (section: CollapsibleSection) => {
    setSectionVisibility((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const VisibilityToggle = ({
    section,
    variant = "light",
  }: {
    section: CollapsibleSection;
    variant?: "light" | "dark";
  }) => {
    const isVisible = sectionVisibility[section];
    const Icon = isVisible ? Eye : EyeOff;
    return (
      <button
        type="button"
        onClick={() => toggleSection(section)}
        title={isVisible ? "Ocultar sección" : "Mostrar sección"}
        aria-label={isVisible ? "Ocultar sección" : "Mostrar sección"}
        className={`border-2 w-8 h-8 flex items-center justify-center transition-all cursor-pointer ${
          variant === "dark"
            ? "border-white/30 text-[#FFD166] hover:bg-[#FFD166] hover:text-[#1A1A1A] hover:border-[#FFD166]"
            : "border-[#1A1A1A] text-[#1A1A1A] bg-white/50 hover:bg-white hover:-translate-x-px hover:-translate-y-px hover:shadow-[2px_2px_0_#1A1A1A]"
        }`}
      >
        <Icon className="w-4 h-4" />
      </button>
    );
  };

  /** Returns indices in `entries[]` that pass the current search + category filter */
  const filteredIndices: number[] = entries
    .map((entry, idx) => ({ entry, idx }))
    .filter(({ entry }) => {
      const text = `${entry.title ?? ""} ${entry.summary ?? ""} ${entry.category ?? ""}`.toLowerCase();
      const matchesSearch = text.includes(search.toLowerCase());
      const matchesCategory = !selectedCategory || entry.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .map(({ idx }) => idx);

  const filteredEntries = filteredIndices.map((idx) => entries[idx]);

  /** Unique categories derived from loaded entries */
  const categories = Array.from(
    new Set(entries.map((e) => e.category).filter(Boolean) as string[])
  );

  const activeChannel = config.selectedChannel === "secondary" ? "secondary" : "primary";
  const activeChannelLabel = activeChannel === "secondary" ? "Canal 2" : "Canal 1";
  const activeChannelId = activeChannel === "secondary" ? config.channelId2 : config.channelId;
  const displayText = (value: unknown) =>
    String(value ?? "")
      .replace(/\\r\\n/g, "\n")
      .replace(/\\n/g, "\n")
      .replace(/\r\n/g, "\n");

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleSaveDriveUrl() {
    try {
      const r = await authenticatedFetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
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
      const response = await authenticatedFetch("/api/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botToken: config.botToken }),
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        showToast(data.error || "Token inválido o error de conexión.", "error", "Bot Inválido");
        return;
      }

      const saveRes = await authenticatedFetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (saveRes.ok) {
        showToast(
          `¡Configuración guardada! Bot verificado: @${data.username} (${data.first_name})`,
          "success",
          "Bot Conectado ✓"
        );
      } else {
        showToast(
          await responseErrorMessage(saveRes, "Error al guardar la configuración en la base de datos"),
          "error",
          "Error de Guardado"
        );
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
    setSearch("");
    setSelectedCategory(null);

    try {
      const r = await authenticatedFetch("/api/drive/fetch", {
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

  function toggleSelect(originalIndex: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(originalIndex)) next.delete(originalIndex);
      else next.add(originalIndex);
      return next;
    });
  }

  function selectAllFiltered() {
    const allSelected = filteredIndices.every((idx) => selected.has(idx));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        filteredIndices.forEach((idx) => next.delete(idx));
      } else {
        filteredIndices.forEach((idx) => next.add(idx));
      }
      return next;
    });
  }

  async function fetchQueue() {
    setFetchingQueue(true);
    try {
      const r = await authenticatedFetch("/api/telegram/schedule");
      const data = await r.json();
      if (!r.ok) {
        showToast(data.error || "Error al cargar la cola de envíos", "error", "Error de Cola");
      } else {
        setScheduledEntries(data.entries || []);
      }
    } catch (e) {
      showToast(`Error de conexión: ${e}`, "error");
    } finally {
      setFetchingQueue(false);
    }
  }

  async function deleteQueueItem(id: number) {
    try {
      const r = await authenticatedFetch(`/api/telegram/schedule?id=${id}`, {
        method: "DELETE",
      });
      if (r.ok) {
        showToast("Publicación eliminada de la cola con éxito.", "success", "Eliminado ✓");
        setScheduledEntries((prev) => prev.filter((item) => item.id !== id));
      } else {
        const data = await r.json();
        showToast(data.error || "Error al eliminar de la cola", "error");
      }
    } catch (e) {
      showToast(`Error de conexión: ${e}`, "error");
    }
  }

  async function scheduleSelected() {
    const toSchedule = entries.filter((_, i) => selected.has(i));
    if (toSchedule.length === 0) return;
    setScheduling(true);

    try {
      const r = await authenticatedFetch("/api/telegram/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: toSchedule, template, targetChannel: activeChannel }),
      });
      const data = await r.json();
      if (!r.ok) {
        showToast(data.error || "Error al programar mensajes", "error", "Error de Programación");
      } else {
        showToast(
          `Se programaron ${data.success} publicaciones correctamente.`,
          "success",
          `${activeChannelLabel} Asignado`
        );
        if (data.success > 0) {
          setEntries((prev) => prev.filter((_, i) => !selected.has(i)));
          setSelected(new Set());
        }
      }
    } catch (e) {
      showToast(`Error de conexión: ${e}`, "error", "Error de Red");
    } finally {
      setScheduling(false);
    }
  }

  async function handleSaveScheduleConfig() {
    try {
      const updatedConfig = {
        ...config,
        scheduleDays: selectedDays.join(","),
        scheduleStart,
        scheduleEnd,
        scheduleTimezone
      };
      
      const r = await authenticatedFetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedConfig),
      });
      if (r.ok) {
        setConfig(updatedConfig);
        showToast("Configuración de horario guardada con éxito.", "success", "Horario Guardado");
      } else {
        showToast("Error al guardar la configuración de horario.", "error", "Error de Guardado");
      }
    } catch (e) {
      showToast(`Error de conexión: ${e}`, "error");
    }
  }

  async function handleSaveAutoDeleteConfig() {
    try {
      const updatedConfig = {
        ...config,
        autoDeleteDays
      };
      
      const r = await authenticatedFetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedConfig),
      });
      if (r.ok) {
        setConfig(updatedConfig);
        showToast("Configuración de limpieza guardada con éxito.", "success", "Limpieza Guardada");
      } else {
        showToast("Error al guardar la configuración de limpieza.", "error", "Error de Guardado");
      }
    } catch (e) {
      showToast(`Error de conexión: ${e}`, "error");
    }
  }

  async function sendSelected() {
    const toSend = entries.filter((_, i) => selected.has(i));
    if (toSend.length === 0) return;
    setSending(true);

    try {
      const r = await authenticatedFetch("/api/telegram/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: toSend, template, targetChannel: activeChannel }),
      });
      const data = await r.json();
      if (!r.ok) {
        showToast(data.error || "Error al enviar mensajes", "error", "Error de Envío");
      } else {
        const firstError = Array.isArray(data.errors) && data.errors.length > 0 ? ` · ${data.errors[0].error}` : "";
        showToast(
          `Publicados: ${data.success} | Fallidos: ${data.failed}${firstError}`,
          data.failed === 0 ? "success" : "info",
          "Envío Terminado"
        );
        if (data.success > 0) {
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

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setAuthError("Por favor, introduce tu email y contraseña.");
      return;
    }

    setLoggingIn(true);
    setAuthError(null);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setAuthError(data.error || "Error al iniciar sesión.");
        showToast(data.error || "Error al iniciar sesión.", "error", "Error de Acceso");
        return;
      }

      setIsLoggedIn(true);
      showToast("Sesión iniciada correctamente", "success", "Acceso Concedido");

      // Cargar configuraciones tras autenticación
      const configRes = await fetch("/api/config");
      if (configRes.ok) {
        const configData = await configRes.json();
        setConfig(configData);
      }
      
      const healthRes = await fetch("/api/health");
      if (healthRes.ok) {
        const healthData = await healthRes.json();
        setDbConnected(healthData.db === "connected");
      }
    } catch (e) {
      setAuthError("Error de conexión con el servidor.");
      showToast("Error de conexión", "error");
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch (e) {
      // Ignorar error
    }
    setIsLoggedIn(false);
    showToast("Sesión cerrada correctamente", "info", "Sesión Finalizada");
  }

  const handleCopyToClipboard = (text: string, index: number) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopiedIndex(index);
        showToast("Mensaje copiado al portapapeles.", "success");
        setTimeout(() => setCopiedIndex(null), 2000);
      })
      .catch((e) => showToast(`No se pudo copiar: ${e}`, "error"));
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLoggedIn === null) {
    return (
      <div className="w-full min-h-screen bg-[#F0EFEB] flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-12 h-12 text-[#1A1A1A] animate-spin" />
          <span className="font-mono text-xs font-black uppercase tracking-wider text-[#1A1A1A]">
            Cargando aplicación...
          </span>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="w-full min-h-screen bg-[#F0EFEB] text-[#1A1A1A] flex flex-col items-center justify-center font-sans p-4 selection:bg-[#FFD166] selection:text-[#1A1A1A]">
        {/* Toast Notification Container */}
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-auto border-2 border-[#1A1A1A] p-4 shadow-[4px_4px_0px_#1A1A1A] flex items-start gap-3 ${
                toast.type === "success"
                  ? "bg-[#D8F3DC]"
                  : toast.type === "error"
                  ? "bg-[#FAD2E1]"
                  : "bg-[#E8F0FE]"
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {toast.type === "success" && <CheckCircle className="w-5 h-5 text-green-700" />}
                {toast.type === "error" && <AlertTriangle className="w-5 h-5 text-red-700" />}
                {toast.type === "info" && <Info className="w-5 h-5 text-blue-700" />}
              </div>
              <div className="flex-1 min-w-0">
                {toast.title && (
                  <h4 className="font-black text-xs uppercase tracking-wider mb-0.5">{toast.title}</h4>
                )}
                <p className="text-xs font-mono break-words">{toast.message}</p>
              </div>
              <button
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="shrink-0 text-[#1A1A1A]/60 hover:text-[#1A1A1A] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="max-w-md w-full bg-white border-4 border-[#1A1A1A] shadow-[8px_8px_0px_#1A1A1A] flex flex-col overflow-hidden">
          {/* Login Card Header */}
          <div className="bg-[#FFD166] border-b-4 border-[#1A1A1A] p-4 flex items-center gap-3">
            <div className="bg-[#1A1A1A] text-[#FFD166] p-1.5 border-2 border-[#1A1A1A]">
              <Zap className="w-5 h-5" />
            </div>
            <span className="font-black text-lg tracking-tighter uppercase italic">DTN Publisher</span>
          </div>

          <form onSubmit={handleLogin} className="p-6 space-y-5">
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight mb-1">Iniciar Sesión</h2>
              <p className="text-xs opacity-60 font-mono">
                Por favor, inicia sesión para acceder al panel de administración.
              </p>
            </div>

            {authError && (
              <div className="bg-[#FAD2E1] border-2 border-[#1A1A1A] p-3 shadow-[2px_2px_0px_#1A1A1A] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                <span className="text-[11px] font-mono leading-tight">{authError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-[9px] uppercase font-black opacity-60 mb-1">Email</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white border-2 border-[#1A1A1A] text-xs py-2 pl-8 pr-2 font-mono outline-none shadow-[2px_2px_0_#1A1A1A] focus:-translate-x-px focus:-translate-y-px focus:shadow-[3px_3px_0_#1A1A1A] transition-all"
                    placeholder="admin@example.com"
                  />
                  <Mail className="w-4 h-4 absolute left-2.5 top-2.5 text-[#1A1A1A]/40 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-[9px] uppercase font-black opacity-60 mb-1">Contraseña</label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white border-2 border-[#1A1A1A] text-xs py-2 pl-8 pr-2 font-mono outline-none shadow-[2px_2px_0_#1A1A1A] focus:-translate-x-px focus:-translate-y-px focus:shadow-[3px_3px_0_#1A1A1A] transition-all"
                    placeholder="••••••••"
                  />
                  <Lock className="w-4 h-4 absolute left-2.5 top-2.5 text-[#1A1A1A]/40 pointer-events-none" />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full border-2 border-[#1A1A1A] py-2 text-xs font-black uppercase bg-[#FFD166] hover:bg-[#F2C14E] hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_#1A1A1A] transition-all shadow-[2px_2px_0_#1A1A1A] flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {loggingIn ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Verificando...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" /> Entrar
                </>
              )}
            </button>
          </form>

          <div className="bg-[#F0EFEB] border-t-2 border-[#1A1A1A] p-3 text-[9px] text-center font-mono opacity-50 uppercase tracking-wide">
            Acceso restringido a administradores autorizados.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#F0EFEB] text-[#1A1A1A] flex flex-col font-sans selection:bg-[#FFD166] selection:text-[#1A1A1A]">

      {/* Toast Notification Container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto border-2 border-[#1A1A1A] p-4 shadow-[4px_4px_0px_#1A1A1A] flex items-start gap-3 ${
              toast.type === "success"
                ? "bg-[#D8F3DC]"
                : toast.type === "error"
                ? "bg-[#FAD2E1]"
                : "bg-[#E8F0FE]"
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {toast.type === "success" && <CheckCircle className="w-5 h-5 text-green-700" />}
              {toast.type === "error" && <AlertTriangle className="w-5 h-5 text-red-700" />}
              {toast.type === "info" && <Info className="w-5 h-5 text-blue-700" />}
            </div>
            <div className="flex-1 min-w-0">
              {toast.title && (
                <h4 className="font-black text-xs uppercase tracking-wider mb-0.5">{toast.title}</h4>
              )}
              <p className="text-xs font-mono break-words">{toast.message}</p>
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="shrink-0 text-[#1A1A1A]/60 hover:text-[#1A1A1A] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="h-16 border-b-4 border-[#1A1A1A] flex items-center justify-between px-6 bg-[#FFD166] shadow-[0_4px_0_#1A1A1A] shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-[#1A1A1A] text-[#FFD166] p-1.5 border-2 border-[#1A1A1A]">
            <Zap className="w-5 h-5" />
          </div>
          <span className="font-black text-xl tracking-tighter uppercase italic">DTN Publisher</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-white border-2 border-[#1A1A1A] px-3 py-1 text-[10px] font-mono shadow-[2px_2px_0_#1A1A1A]">
            <span
              className={`w-2.5 h-2.5 rounded-full border border-[#1A1A1A] ${
                dbConnected ? "bg-green-500" : "bg-red-500"
              }`}
            />
            DB: {dbConnected ? "ONLINE" : "OFFLINE"}
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-white border-2 border-[#1A1A1A] px-3 py-1 text-[10px] font-mono shadow-[2px_2px_0_#1A1A1A]">
            <span
              className={`w-2.5 h-2.5 rounded-full border border-[#1A1A1A] ${
                config.botToken ? "bg-green-500" : "bg-yellow-400"
              }`}
            />
            BOT: {config.botToken ? "ONLINE" : "DESCONECTADO"}
          </div>
          <button
            onClick={handleLogout}
            className="border-2 border-[#1A1A1A] px-3 py-1 text-[10px] font-black uppercase bg-[#1A1A1A] text-white hover:bg-[#333333] hover:-translate-x-px hover:-translate-y-px hover:shadow-[2px_2px_0_#1A1A1A] transition-all shadow-[1px_1px_0_#1A1A1A] flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Cerrar Sesión</span>
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0">

        {/* ── Left Column: Config Panel ── */}
        <section className="lg:col-span-3 border-b-4 lg:border-b-0 lg:border-r-4 border-[#1A1A1A] flex flex-col bg-white overflow-y-auto">

          <div className="p-4 border-b-2 border-[#1A1A1A] bg-[#A8DADC] flex items-center gap-2 shrink-0">
            <Folder className="w-5 h-5" />
            <h2 className="text-md font-black uppercase tracking-tight flex-1">Recursos e Input</h2>
            <VisibilityToggle section="resources" />
          </div>

          {/* Google Drive Config */}
          <div className="p-4 border-b-2 border-[#1A1A1A] bg-[#F1FAEE] space-y-3 shrink-0">
            <h3 className="text-xs font-black uppercase tracking-wide text-[#457B9D]">Origen: Google Drive</h3>

            {sectionVisibility.resources && (
              <>
                <div>
                  <label className="block text-[9px] uppercase font-black opacity-60 mb-1">
                    Enlace a Carpeta o Archivo
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={config.driveUrl}
                      onChange={(e) => setConfig({ ...config, driveUrl: e.target.value })}
                      className="w-full bg-white border-2 border-[#1A1A1A] text-xs py-1.5 pl-7 pr-2 font-mono outline-none shadow-[2px_2px_0_#1A1A1A] focus:-translate-x-px focus:-translate-y-px focus:shadow-[3px_3px_0_#1A1A1A] transition-all"
                      placeholder="https://drive.google.com/..."
                    />
                    <Link2 className="w-4 h-4 absolute left-2 top-2 text-[#1A1A1A]/50 pointer-events-none" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={handleSaveDriveUrl}
                    className="border-2 border-[#1A1A1A] py-1.5 text-[10px] font-black uppercase bg-[#E9D8A6] hover:bg-[#D9C896] hover:-translate-x-px hover:-translate-y-px hover:shadow-[2px_2px_0_#1A1A1A] transition-all shadow-[1px_1px_0_#1A1A1A] flex items-center justify-center gap-1"
                  >
                    <Save className="w-3.5 h-3.5" /> Guardar Link
                  </button>
                  <button
                    onClick={fetchDrive}
                    disabled={fetching || !config.driveUrl}
                    className="border-2 border-[#1A1A1A] py-1.5 text-[10px] font-black uppercase bg-[#1A1A1A] text-white hover:bg-[#333333] hover:-translate-x-px hover:-translate-y-px hover:shadow-[2px_2px_0_#1A1A1A] transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-1"
                  >
                    <Download className={`w-3.5 h-3.5 ${fetching ? "animate-bounce" : ""}`} />
                    {fetching ? "Cargando..." : "Descargar JSON"}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Template Config */}
          <div className={`p-4 flex flex-col gap-2 ${sectionVisibility.template ? "flex-1" : "shrink-0 border-b-2 border-[#1A1A1A]"}`}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-black uppercase tracking-wide text-[#E63946] flex-1">Plantilla de Envío</h3>
              <span className="text-[8px] font-mono bg-[#E63946]/10 text-[#E63946] border border-[#E63946] px-1.5 font-bold">
                TELEGRAM
              </span>
              <VisibilityToggle section="template" />
            </div>
            {sectionVisibility.template && (
              <>
                <p className="text-[9px] text-[#1A1A1A]/70 leading-relaxed">
                  Usa{" "}
                  <code className="bg-[#1A1A1A]/10 px-1 font-mono font-bold">{`{texto_telegram}`}</code>{" "}
                  para el contenido listo del JSON, o combina claves como{" "}
                  <code className="bg-[#1A1A1A]/10 px-1 font-mono font-bold">{`{fuente_nombre}`}</code>,{" "}
                  <code className="bg-[#1A1A1A]/10 px-1 font-mono font-bold">{`{fuente_url}`}</code>,{" "}
                  <code className="bg-[#1A1A1A]/10 px-1 font-mono font-bold">{`{categoria}`}</code>.
                </p>
                <textarea
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  className="flex-1 min-h-[180px] border-2 border-[#1A1A1A] bg-[#FDFDFD] p-3 font-mono text-xs outline-none resize-none shadow-[3px_3px_0_#1A1A1A] focus:-translate-x-px focus:-translate-y-px focus:shadow-[4px_4px_0_#1A1A1A] transition-all"
                />
              </>
            )}
          </div>
        </section>

        {/* ── Center Column: List of items ── */}
        <section className="lg:col-span-6 border-b-4 lg:border-b-0 lg:border-r-4 border-[#1A1A1A] flex flex-col min-h-0 bg-[#FAF9F5]">

          {/* Tab Selector */}
          <div className="flex border-b-2 border-[#1A1A1A] bg-[#F0EFEB] shrink-0 font-mono text-[10px] font-black uppercase">
            <button
              onClick={() => setActiveTab("inbox")}
              className={`flex-1 py-3 text-center border-r-2 border-[#1A1A1A] transition-all hover:bg-[#1A1A1A]/10 cursor-pointer ${
                activeTab === "inbox" ? "bg-[#FFD166] text-[#1A1A1A]" : "bg-white text-[#1A1A1A]/60"
              }`}
            >
              Bandeja de Entrada ({entries.length})
            </button>
            <button
              onClick={() => setActiveTab("queue")}
              className={`flex-1 py-3 text-center transition-all hover:bg-[#1A1A1A]/10 cursor-pointer ${
                activeTab === "queue" ? "bg-[#FFD166] text-[#1A1A1A]" : "bg-white text-[#1A1A1A]/60"
              }`}
            >
              Cola de Programados ({scheduledEntries.length})
            </button>
          </div>

          {activeTab === "inbox" ? (
            <>
              {/* Toolbar */}
              <div className="p-4 border-b-2 border-[#1A1A1A] bg-[#F0EFEB] space-y-3 shrink-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[9px] font-mono opacity-50 uppercase tracking-wider">Posts Cargados</p>
                    <h1 className="text-lg font-black uppercase tracking-tight flex items-center gap-1.5 truncate">
                      <FileText className="w-5 h-5 shrink-0" />
                      {entries.length > 0 ? `${entries.length} publicaciones` : "Bandeja vacía"}
                    </h1>
                  </div>

                  {entries.length > 0 && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={scheduleSelected}
                        disabled={scheduling || selected.size === 0}
                        className="border-2 border-[#1A1A1A] bg-[#FFD166] text-[#1A1A1A] px-3 py-1.5 text-[10px] font-black uppercase hover:bg-[#F2C14E] hover:-translate-x-px hover:-translate-y-px hover:shadow-[2px_2px_0_#1A1A1A] transition-all shadow-[1px_1px_0_#1A1A1A] disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap cursor-pointer"
                      >
                        {scheduling ? "Programando..." : `Programar${selected.size > 0 ? ` (${selected.size})` : ""}`}
                      </button>
                      <button
                        onClick={sendSelected}
                        disabled={sending || selected.size === 0}
                        className="border-2 border-[#1A1A1A] bg-[#457B9D] text-white px-3 py-1.5 text-[10px] font-black uppercase hover:bg-[#3B6B8A] hover:-translate-x-px hover:-translate-y-px hover:shadow-[2px_2px_0_#1A1A1A] transition-all shadow-[1px_1px_0_#1A1A1A] disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1 whitespace-nowrap cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {sending ? "Enviando..." : `Enviar${selected.size > 0 ? ` (${selected.size})` : ""}`}
                      </button>
                    </div>
                  )}
                </div>

                {entries.length > 0 && (
                  <div className="space-y-2">
                    {/* Search */}
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Buscar por título, contenido o etiqueta..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-white border-2 border-[#1A1A1A] text-xs py-1.5 pl-8 pr-7 outline-none font-mono placeholder:text-[#1A1A1A]/40"
                      />
                      <Search className="w-4 h-4 absolute left-2.5 top-2 text-[#1A1A1A]/40 pointer-events-none" />
                      {search && (
                        <button
                          onClick={() => setSearch("")}
                          className="absolute right-2 top-2 text-[#1A1A1A]/40 hover:text-[#1A1A1A] transition-colors cursor-pointer"
                          aria-label="Limpiar búsqueda"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Category filter pills */}
                    {categories.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[9px] font-black uppercase tracking-wider text-[#1A1A1A]/50 flex items-center gap-0.5 mr-1">
                          <Filter className="w-3 h-3" /> Filtrar:
                        </span>
                        <button
                          onClick={() => setSelectedCategory(null)}
                          className={`text-[9px] font-black uppercase px-2 py-0.5 border border-[#1A1A1A] transition-all hover:bg-[#1A1A1A]/10 cursor-pointer ${
                            !selectedCategory ? "bg-[#1A1A1A] text-white" : "bg-white text-[#1A1A1A]"
                          }`}
                        >
                          Todos
                        </button>
                        {categories.map((cat) => (
                          <button
                            key={cat}
                            onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                            className={`text-[9px] font-black uppercase px-2 py-0.5 border border-[#1A1A1A] transition-all hover:bg-[#1A1A1A]/10 cursor-pointer ${
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

              {/* Entry list */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {entries.length === 0 ? (
                  <div className="p-8 text-center bg-white border-2 border-dashed border-[#1A1A1A]/20">
                    <p className="font-mono text-xs opacity-50">
                      {fetching ? "Descargando publicaciones..." : "No hay publicaciones cargadas."}
                    </p>
                    {!fetching && (
                      <p className="font-mono text-[10px] opacity-40 mt-1">
                        Pega una URL de Drive en el panel izquierdo y haz clic en Descargar JSON.
                      </p>
                    )}
                  </div>
                ) : filteredEntries.length === 0 ? (
                  <div className="p-8 text-center bg-white border-2 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A]">
                    <p className="font-mono text-xs opacity-50">Ninguna publicación coincide con la búsqueda.</p>
                    <button
                      onClick={() => { setSearch(""); setSelectedCategory(null); }}
                      className="mt-2 text-[10px] font-black uppercase text-[#457B9D] hover:underline cursor-pointer"
                    >
                      Limpiar filtros
                    </button>
                  </div>
                ) : (
                  filteredEntries.map((entry, _visibleIdx) => {
                    const originalIndex = filteredIndices[_visibleIdx];
                    const previewText = fillTemplate(template, entry);

                    return (
                      <div
                        key={originalIndex}
                        className={`relative border-2 p-4 transition-all duration-200 bg-white shadow-[4px_4px_0_#1A1A1A] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#1A1A1A] ${
                          selected.has(originalIndex)
                            ? "border-[#FFD166] bg-[#FFF9E6]"
                            : "border-[#1A1A1A]"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selected.has(originalIndex)}
                            onChange={() => toggleSelect(originalIndex)}
                            className="mt-1 w-4 h-4 cursor-pointer accent-[#1A1A1A] shrink-0"
                          />

                          <div className="flex-1 min-w-0">
                            {/* Title + category */}
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <h3 className="font-black text-base uppercase tracking-tight text-[#1A1A1A] leading-tight">
                                {entry.title || "Sin título"}
                              </h3>
                              {entry.category && (
                                <span className="shrink-0 bg-[#457B9D]/10 text-[#457B9D] border border-[#457B9D] px-2 py-0.5 text-[10px] font-black uppercase">
                                  {(entry.category as string).replace(/_/g, " ")}
                                </span>
                              )}
                            </div>

                            {/* Summary */}
                            <p className="text-sm opacity-70 mt-1 max-h-24 overflow-hidden font-mono whitespace-pre-wrap">
                              {displayText(entry.summary)}
                            </p>

                            {/* Actions row */}
                            <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#1A1A1A]/10 flex-wrap gap-2">
                              {entry.link && (
                                <a
                                  href={entry.link as string}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  className="text-blue-600 text-xs font-bold hover:underline flex items-center gap-0.5"
                                >
                                  <ExternalLink className="w-3 h-3" /> Ver fuente
                                </a>
                              )}

                              <div className="flex gap-2 ml-auto">
                                {/* Copy button */}
                                <button
                                  onClick={() => handleCopyToClipboard(previewText, originalIndex)}
                                  className="border border-[#1A1A1A] bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 hover:bg-[#1A1A1A]/5 shadow-[1px_1px_0_#1A1A1A] transition-all cursor-pointer"
                                >
                                  {copiedIndex === originalIndex ? (
                                    <><Check className="w-4 h-4 text-green-700" /> Copiado</>
                                  ) : (
                                    <><Copy className="w-4 h-4" /> Copiar</>
                                  )}
                                </button>

                                {/* Preview toggle */}
                                <button
                                  onClick={() =>
                                    setPreviewOpen(previewOpen === originalIndex ? null : originalIndex)
                                  }
                                  className={`border border-[#1A1A1A] px-2 py-1 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-[1px_1px_0_#1A1A1A] transition-all cursor-pointer ${
                                    previewOpen === originalIndex
                                      ? "bg-[#1A1A1A] text-white"
                                      : "bg-white hover:bg-[#1A1A1A]/5"
                                  }`}
                                >
                                  <Eye className="w-3 h-3" />
                                  {previewOpen === originalIndex ? "Cerrar" : "Vista Previa"}
                                </button>
                              </div>
                            </div>

                            {/* Inline preview panel (no absolute positioning) */}
                            {previewOpen === originalIndex && (
                              <div className="mt-3 space-y-2">
                                <pre className="border-2 border-[#1A1A1A] bg-[#FFFBE6] p-3 text-xs font-mono whitespace-pre-wrap shadow-[3px_3px_0_#1A1A1A] max-h-[200px] overflow-y-auto">
                                  {previewText.replace(/\[button:(.*?)\]/, "").trim()}
                                </pre>
                                {previewText.match(/\[button:(.*?)\]/) && (entry.link || entry.fuente_url) && (
                                  <a
                                    href={(entry.link || entry.fuente_url) as string}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className="w-full border-2 border-[#1A1A1A] py-2 text-sm font-black uppercase bg-[#FFD166] text-[#1A1A1A] flex items-center justify-center gap-1.5 shadow-[2px_2px_0_#1A1A1A] hover:bg-[#F2C14E] transition-all"
                                  >
                                    {previewText.match(/\[button:(.*?)\]/)?.[1].trim() || "👉 Leer más"}
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <>
              {/* Queue Toolbar */}
              <div className="p-4 border-b-2 border-[#1A1A1A] bg-[#F0EFEB] flex items-center justify-between gap-2 shrink-0">
                <div>
                  <p className="text-[9px] font-mono opacity-50 uppercase tracking-wider">Cola de Publicación</p>
                  <h1 className="text-lg font-black uppercase tracking-tight flex items-center gap-1.5 truncate">
                    <RefreshCw className={`w-5 h-5 shrink-0 ${fetchingQueue ? "animate-spin" : ""}`} />
                    {scheduledEntries.length > 0 ? `${scheduledEntries.length} programados` : "Cola vacía"}
                  </h1>
                </div>
                <button
                  onClick={fetchQueue}
                  disabled={fetchingQueue}
                  className="border-2 border-[#1A1A1A] bg-white px-3 py-1.5 text-[10px] font-black uppercase hover:bg-[#F0EFEB] hover:-translate-x-px hover:-translate-y-px hover:shadow-[2px_2px_0_#1A1A1A] transition-all shadow-[1px_1px_0_#1A1A1A] flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${fetchingQueue ? "animate-spin" : ""}`} />
                  Actualizar
                </button>
              </div>

              {/* Queue List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {fetchingQueue ? (
                  <div className="p-8 text-center bg-white border-2 border-dashed border-[#1A1A1A]/20">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#1A1A1A]" />
                    <p className="font-mono text-xs opacity-50">Cargando cola de programación...</p>
                  </div>
                ) : scheduledEntries.length === 0 ? (
                  <div className="p-8 text-center bg-white border-2 border-dashed border-[#1A1A1A]/20">
                    <p className="font-mono text-xs opacity-50">No hay publicaciones programadas.</p>
                    <p className="font-mono text-[10px] opacity-40 mt-1">
                      Selecciona publicaciones en la Bandeja de Entrada y haz clic en "Programar".
                    </p>
                  </div>
                ) : (
                  scheduledEntries.map((post) => (
                    <div
                      key={post.id}
                      className="relative border-2 border-[#1A1A1A] p-4 bg-white shadow-[4px_4px_0_#1A1A1A] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#1A1A1A] transition-all"
                    >
                      <div className="flex-1 min-w-0">
                        {/* Title + Status badge */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <h3 className="font-black text-base uppercase tracking-tight text-[#1A1A1A] leading-tight">
                            {post.title || "Sin título"}
                          </h3>
                          <div className="flex items-center gap-1.5">
                            {(post.channel_label || post.channel_id) && (
                              <span
                                className="bg-[#FFD166] text-[#1A1A1A] border border-[#1A1A1A] px-2 py-0.5 text-[10px] font-black uppercase"
                                title={post.channel_id || ""}
                              >
                                {post.channel_label || "Canal"}
                              </span>
                            )}
                            {post.category && (
                              <span className="bg-[#457B9D]/10 text-[#457B9D] border border-[#457B9D] px-2 py-0.5 text-[10px] font-black uppercase">
                                {post.category.replace(/_/g, " ")}
                              </span>
                            )}
                            <span
                              className={`border px-2 py-0.5 text-[10px] font-black uppercase ${
                                post.status === "sent"
                                  ? "bg-green-100 text-green-800 border-green-800"
                                  : post.status === "failed"
                                  ? "bg-red-100 text-red-800 border-red-800"
                                  : "bg-yellow-100 text-yellow-800 border-yellow-800"
                              }`}
                            >
                              {post.status === "sent"
                                ? "Enviado"
                                : post.status === "failed"
                                ? "Fallido"
                                : "Pendiente"}
                            </span>
                          </div>
                        </div>

                        {/* Summary */}
                        <p className="text-sm opacity-70 mt-1 max-h-24 overflow-hidden font-mono whitespace-pre-wrap">
                          {displayText(post.summary)}
                        </p>

                        {/* Error details if failed */}
                        {post.status === "failed" && post.error_message && (
                          <div className="mt-2 bg-[#FAD2E1] border border-red-500 p-2 text-xs font-mono text-red-900">
                            <b>Error:</b> {post.error_message}
                          </div>
                        )}

                        {/* Timestamp and Actions */}
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#1A1A1A]/10 flex-wrap gap-2 text-[10px] font-mono opacity-60">
                          <div>
                            <span>Programado: {new Date(post.created_at).toLocaleString("es-ES")}</span>
                            {post.sent_at && (
                              <span className="block">Procesado: {new Date(post.sent_at).toLocaleString("es-ES")}</span>
                            )}
                          </div>
                          <div className="flex gap-2 ml-auto">
                            {post.status === "pending" && (
                              <button
                                onClick={() => deleteQueueItem(post.id)}
                                className="border border-[#E63946] bg-white text-[#E63946] px-2 py-1 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 hover:bg-[#E63946]/10 shadow-[1px_1px_0_#E63946] transition-all cursor-pointer"
                              >
                                <X className="w-4 h-4" /> Cancelar
                              </button>
                            )}
                            {post.status !== "pending" && (
                              <button
                                onClick={() => deleteQueueItem(post.id)}
                                className="border border-[#1A1A1A] bg-white text-[#1A1A1A]/60 px-2 py-1 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 hover:bg-[#1A1A1A]/5 shadow-[1px_1px_0_#1A1A1A] transition-all cursor-pointer"
                              >
                                Eliminar Reg
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </section>

        {/* ── Right Column: Telegram Config ── */}
        <section className="lg:col-span-3 flex flex-col bg-white overflow-y-auto">

          <div className="p-4 border-b-2 border-[#1A1A1A] bg-[#FFD166] flex items-center gap-2 shrink-0">
            <Bot className="w-5 h-5" />
            <h2 className="text-md font-black uppercase tracking-tight">Integraciones</h2>
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
                  className="w-full bg-transparent border-b-2 border-white/30 text-xs py-1.5 font-mono outline-none text-[#FFD166] focus:border-[#FFD166] transition-colors placeholder:text-white/20"
                  placeholder="123456:ABC-..."
                  autoComplete="off"
                />
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[9px] uppercase font-black text-white/50 mb-1.5">
                    Canal activo para nuevos posts
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: "primary" as const, label: "Canal 1", configured: Boolean(config.channelId) },
                      { value: "secondary" as const, label: "Canal 2", configured: Boolean(config.channelId2) }
                    ].map((channel) => {
                      const isSelected = activeChannel === channel.value;
                      return (
                        <button
                          key={channel.value}
                          type="button"
                          onClick={() => setConfig({ ...config, selectedChannel: channel.value })}
                          className={`border-2 px-3 py-2 text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${
                            isSelected
                              ? "bg-[#FFD166] text-[#1A1A1A] border-[#FFD166] shadow-[2px_2px_0_white]"
                              : "bg-transparent text-white/60 border-white/30 hover:text-white hover:border-white"
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                          {channel.label}
                          <span className={`w-1.5 h-1.5 rounded-full ${channel.configured ? "bg-green-400" : "bg-white/30"}`} />
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-[8px] text-white/40 block mt-1.5 leading-relaxed">
                    Los posts programados conservarán el canal activo al momento de programarlos.
                  </span>
                </div>

                <div>
                  <label className="block text-[9px] uppercase font-black text-white/50 mb-1">Canal 1 ID</label>
                  <input
                    type="text"
                    value={config.channelId}
                    onChange={(e) => setConfig({ ...config, channelId: e.target.value })}
                    className="w-full bg-transparent border-b-2 border-white/30 text-xs py-1.5 font-mono outline-none text-[#FFD166] focus:border-[#FFD166] transition-colors placeholder:text-white/20"
                    placeholder="@canal_principal o -100123456789"
                  />
                </div>

                <div>
                  <label className="block text-[9px] uppercase font-black text-white/50 mb-1">Canal 2 ID</label>
                  <input
                    type="text"
                    value={config.channelId2 || ""}
                    onChange={(e) => setConfig({ ...config, channelId2: e.target.value })}
                    className="w-full bg-transparent border-b-2 border-white/30 text-xs py-1.5 font-mono outline-none text-[#FFD166] focus:border-[#FFD166] transition-colors placeholder:text-white/20"
                    placeholder="@canal_secundario o -100123456789"
                  />
                  <span className="text-[8px] text-white/40 block mt-1 leading-relaxed">
                    Activo ahora: <b>{activeChannelLabel}</b>{activeChannelId ? ` (${activeChannelId})` : " sin configurar"}.
                  </span>
                </div>
              </div>

              <button
                onClick={handleSaveBotConfig}
                disabled={testingBot}
                className="w-full border-2 border-[#FFD166] py-2 text-[10px] font-black uppercase text-[#FFD166] hover:bg-[#FFD166] hover:text-[#1A1A1A] hover:-translate-x-px hover:-translate-y-px transition-all disabled:opacity-40 disabled:pointer-events-none"
              >
                {testingBot ? "Verificando token..." : "Guardar y Validar"}
              </button>
            </div>

            {/* Schedule configuration */}
            <div className="pt-4 border-t border-white/20 mt-4 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#FFD166] border-b border-white/20 pb-2">
                Horario de Envío Programado
              </h3>

              {/* Days selection */}
              <div>
                <label className="block text-[8px] uppercase font-black text-white/50 mb-1.5">
                  Días de la semana
                </label>
                <div className="flex gap-1">
                  {[
                    { label: "L", value: 1, name: "Lunes" },
                    { label: "M", value: 2, name: "Martes" },
                    { label: "X", value: 3, name: "Miércoles" },
                    { label: "J", value: 4, name: "Jueves" },
                    { label: "V", value: 5, name: "Viernes" },
                    { label: "S", value: 6, name: "Sábado" },
                    { label: "D", value: 0, name: "Domingo" }
                  ].map((d) => {
                    const isSelected = selectedDays.includes(d.value);
                    return (
                      <button
                        key={d.value}
                        type="button"
                        title={d.name}
                        onClick={() => {
                          setSelectedDays((prev) =>
                            prev.includes(d.value)
                              ? prev.filter((v) => v !== d.value)
                              : [...prev, d.value].sort()
                          );
                        }}
                        className={`w-8 h-8 font-black text-xs border-2 border-white flex items-center justify-center transition-all cursor-pointer ${
                          isSelected
                            ? "bg-[#FFD166] text-[#1A1A1A] font-black border-[#FFD166] shadow-[2px_2px_0_white]"
                            : "bg-transparent text-white opacity-60 hover:opacity-100"
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Hours selection */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[8px] uppercase font-black text-white/50 mb-1">
                    Hora Inicio
                  </label>
                  <input
                    type="time"
                    value={scheduleStart}
                    onChange={(e) => setScheduleStart(e.target.value)}
                    className="w-full bg-transparent border-b-2 border-white/30 text-xs py-1.5 font-mono outline-none text-[#FFD166] focus:border-[#FFD166] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[8px] uppercase font-black text-white/50 mb-1">
                    Hora Fin
                  </label>
                  <input
                    type="time"
                    value={scheduleEnd}
                    onChange={(e) => setScheduleEnd(e.target.value)}
                    className="w-full bg-transparent border-b-2 border-white/30 text-xs py-1.5 font-mono outline-none text-[#FFD166] focus:border-[#FFD166] transition-colors"
                  />
                </div>
              </div>

              {/* Timezone selection */}
              <div>
                <label className="block text-[8px] uppercase font-black text-white/50 mb-1">
                  Zona Horaria
                </label>
                <select
                  value={scheduleTimezone}
                  onChange={(e) => setScheduleTimezone(e.target.value)}
                  className="w-full bg-[#1A1A1A] border-b-2 border-white/30 text-xs py-1.5 font-mono outline-none text-[#FFD166] focus:border-[#FFD166] transition-colors cursor-pointer"
                >
                  <option value="Europe/Madrid">Madrid (Europe/Madrid)</option>
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">New York (America/New_York)</option>
                  <option value="America/Mexico_City">Mexico City (America/Mexico_City)</option>
                  <option value="America/Argentina/Buenos_Aires">Buenos Aires (Argentina)</option>
                  <option value="Europe/London">London (Europe/London)</option>
                </select>
              </div>

              <button
                onClick={handleSaveScheduleConfig}
                className="w-full border-2 border-[#FFD166] py-2 text-[10px] font-black uppercase bg-transparent text-[#FFD166] hover:bg-[#FFD166] hover:text-[#1A1A1A] hover:-translate-x-px hover:-translate-y-px transition-all cursor-pointer"
              >
                Guardar Horario
              </button>
            </div>

            {/* Limpieza Automática */}
            <div className="pt-4 border-t border-white/20 mt-4 space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-white/20 pb-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-[#FFD166]">
                  Limpieza Automática
                </h3>
                <VisibilityToggle section="autoDelete" variant="dark" />
              </div>

              {sectionVisibility.autoDelete && (
                <>
                  <div>
                    <label className="block text-[8px] uppercase font-black text-white/50 mb-1">
                      Borrar posts enviados tras (días)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={autoDeleteDays}
                      onChange={(e) => setAutoDeleteDays(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-transparent border-b-2 border-white/30 text-xs py-1.5 font-mono outline-none text-[#FFD166] focus:border-[#FFD166] transition-colors"
                      placeholder="Ej. 10 (0 para desactivar)"
                    />
                    <span className="text-[8px] text-white/40 block mt-1 leading-relaxed">
                      Los posts con estado "Enviado" se borrarán de la base de datos automáticamente si pasaron más de estos días (usa 0 para desactivar).
                    </span>
                  </div>

                  <button
                    onClick={handleSaveAutoDeleteConfig}
                    className="w-full border-2 border-[#FFD166] py-2 text-[10px] font-black uppercase bg-transparent text-[#FFD166] hover:bg-[#FFD166] hover:text-[#1A1A1A] hover:-translate-x-px hover:-translate-y-px transition-all cursor-pointer"
                  >
                    Guardar Configuración de Limpieza
                  </button>
                </>
              )}
            </div>

          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="h-10 border-t-2 border-[#1A1A1A] flex items-center px-6 justify-between bg-white text-[9px] font-black uppercase tracking-wider shrink-0">
        <span>Estado: {sending ? "Enviando..." : fetching ? "Cargando JSON..." : "Listo"}</span>
        <span>
          {entries.length > 0 && (
            <>
              {filteredEntries.length < entries.length
                ? `${filteredEntries.length} / ${entries.length} visibles`
                : `${entries.length} entradas`}
              {selected.size > 0 && ` · ${selected.size} seleccionadas`}
            </>
          )}
        </span>
      </footer>
    </div>
  );
}

function fillTemplate(template: string, entry: DriveEntry): string {
  const text = (value: unknown) =>
    String(value ?? "")
      .replace(/\\r\\n/g, "\n")
      .replace(/\\n/g, "\n")
      .replace(/\r\n/g, "\n");

  return template
    .replace(/\{texto_telegram\}/g, text(entry.texto_telegram ?? entry.summary ?? ""))
    .replace(/\{fuente_nombre\}/g, text(entry.fuente_nombre ?? entry.title ?? ""))
    .replace(/\{fuente_url\}/g, text(entry.fuente_url ?? entry.link ?? ""))
    .replace(/\{categoria\}/g, text(entry.categoria ?? entry.category ?? ""))
    .replace(/\{title\}/g, text(entry.title ?? entry.fuente_nombre ?? ""))
    .replace(/\{summary\}/g, text(entry.summary ?? entry.texto_telegram ?? ""))
    .replace(/\{link\}/g, text(entry.link ?? entry.fuente_url ?? ""))
    .replace(/\{category\}/g, text(entry.category ?? entry.categoria ?? ""));
}
