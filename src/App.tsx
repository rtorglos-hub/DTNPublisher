import { useState, useEffect } from 'react';

export default function App() {
  const [botToken, setBotToken] = useState('');
  const [channelId, setChannelId] = useState('');
  const [driveUrl, setDriveUrl] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        setBotToken(data.botToken || '');
        setChannelId(data.channelId || '');
        setDriveUrl(data.driveUrl || '');
      });
  }, []);

  const handleSave = async (data: any) => {
    setLoading(true);
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      alert('Configuración guardada exitosamente');
    } catch (e) {
      console.error(e);
      alert('Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#E4E3E0] text-[#141414] flex flex-col font-sans overflow-hidden">
      <header className="h-14 border-b border-[#141414] flex items-center justify-between px-6 bg-[#E4E3E0]">
        <div className="flex items-center gap-4">
          <span className="font-black text-lg tracking-tighter uppercase">DTN Publisher</span>
          <div className="flex items-center gap-2 bg-[#141414] text-[#E4E3E0] px-3 py-1 text-[10px] font-mono">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            BOT STATUS: ONLINE [v2.4.1]
          </div>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-y-auto md:overflow-hidden">
        <section className="col-span-1 md:col-span-4 border-b md:border-b-0 md:border-r border-[#141414] flex flex-col overflow-hidden bg-white/50">
          <div className="p-4 border-b border-[#141414] flex justify-between items-end bg-[#E4E3E0]">
            <div>
              <h2 className="text-[10px] font-mono opacity-60 uppercase">Source: Google Drive</h2>
              <h1 className="text-xl font-serif italic">News Inbox</h1>
            </div>
          </div>
          <div className="p-4 border-b border-[#141414]">
            <label className="block text-[9px] uppercase opacity-40 mb-1">Drive URL</label>
            <input type="text" value={driveUrl} onChange={e => setDriveUrl(e.target.value)} className="w-full bg-white border border-[#141414] text-xs py-1 px-2 font-mono outline-none mb-2" placeholder="https://drive.google.com/..." />
            <button onClick={() => handleSave({ botToken, channelId, driveUrl })} disabled={loading} className="w-full border border-[#141414] py-1 text-[10px] font-bold hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors">
              {loading ? 'Saving...' : 'Save Drive URL'}
            </button>
          </div>
        </section>

        <section className="col-span-1 md:col-span-5 border-b md:border-b-0 md:border-r border-[#141414] flex flex-col overflow-hidden">
          <div className="p-4 border-b border-[#141414] bg-[#E4E3E0]">
            <h2 className="text-[10px] font-mono opacity-60 uppercase">Message Editor</h2>
            <h1 className="text-xl font-serif italic">Template Designer</h1>
          </div>
          <div className="flex-1 p-6 flex flex-col gap-6">
            <div className="flex-1 flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-wider opacity-60">Dynamic Template</label>
              <div className="flex-1 min-h-[300px] border border-[#141414] bg-white p-4 font-mono text-sm relative">
                <div className="absolute top-2 right-2 text-[9px] text-blue-600 font-bold">EDITING MODE</div>
                <span className="text-blue-600">📢 *{"{title}"}*</span><br/><br/>
                <span className="text-green-600">📝 {"{summary}"}</span><br/><br/>
                <span className="text-gray-400">------------------------</span><br/>
                <span className="text-red-500">🔗 Read full article: {"{link}"}</span><br/><br/>
                <span className="text-blue-600">{"#{category}"} #GlobalNews</span>
              </div>
            </div>
          </div>
        </section>

        <section className="col-span-1 md:col-span-3 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-[#141414] bg-[#E4E3E0]">
            <h2 className="text-[10px] font-mono opacity-60 uppercase">Automation</h2>
            <h1 className="text-xl font-serif italic">Scheduling</h1>
          </div>
          <div className="p-4 bg-[#141414] text-[#E4E3E0] h-[300px]">
            <h3 className="text-[10px] font-bold uppercase mb-4 opacity-50">Telegram Integration</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[9px] uppercase opacity-40 mb-1">Bot Token</label>
                <input type="password" value={botToken} onChange={e => setBotToken(e.target.value)} className="w-full bg-transparent border-b border-[#E4E3E0]/30 text-xs py-1 font-mono outline-none" />
              </div>
              <div>
                <label className="block text-[9px] uppercase opacity-40 mb-1">Channel ID</label>
                <input type="text" value={channelId} onChange={e => setChannelId(e.target.value)} className="w-full bg-transparent border-b border-[#E4E3E0]/30 text-xs py-1 font-mono outline-none" />
              </div>
              <button onClick={() => handleSave({ botToken, channelId, driveUrl })} disabled={loading} className="w-full border border-[#E4E3E0] py-2 text-[10px] font-bold hover:bg-[#E4E3E0] hover:text-[#141414] transition-all">
                {loading ? 'Saving...' : 'Save Bot Config'}
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="h-8 border-t border-[#141414] flex items-center px-6 justify-between bg-white text-[9px] font-mono uppercase tracking-widest">
        <span>Status: Idle</span>
        <span>System Time: {new Date().toISOString()}</span>
      </footer>
    </div>
  );
}
