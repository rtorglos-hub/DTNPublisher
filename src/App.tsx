/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export default function App() {
  return (
    <div className="w-full min-h-screen bg-[#E4E3E0] text-[#141414] flex flex-col font-sans overflow-hidden">
      {/* Top Navigation / Status Bar */}
      <header className="h-14 border-b border-[#141414] flex items-center justify-between px-6 bg-[#E4E3E0]">
        <div className="flex items-center gap-4">
          <span className="font-black text-lg tracking-tighter uppercase">DTN Publisher</span>
          <div className="flex items-center gap-2 bg-[#141414] text-[#E4E3E0] px-3 py-1 text-[10px] font-mono">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            BOT STATUS: ONLINE [v2.4.1]
          </div>
        </div>
        <div className="flex gap-6 text-[11px] font-bold uppercase tracking-widest">
          <span>Session: 04:12:03</span>
          <span className="opacity-50">ID: TG_7729_AF</span>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-y-auto md:overflow-hidden">
        {/* Column 1: News Feed (Fetched from Drive) */}
        <section className="col-span-1 md:col-span-4 border-b md:border-b-0 md:border-r border-[#141414] flex flex-col overflow-hidden bg-white/50">
          <div className="p-4 border-b border-[#141414] flex justify-between items-end bg-[#E4E3E0]">
            <div>
              <h2 className="text-[10px] font-mono opacity-60 uppercase">Source: Google Drive</h2>
              <h1 className="text-xl font-serif italic">News Inbox</h1>
            </div>
            <button className="px-3 py-1 border border-[#141414] text-[10px] font-bold uppercase hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors">
              Connect Drive
            </button>
          </div>
          <div className="flex-1 overflow-y-auto font-mono text-[11px] p-4 text-center">
             <p>Connect your Google Drive to fetch your news articles.</p>
          </div>
        </section>

        {/* Column 2: Editor & Template */}
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

        {/* Column 3: Scheduler & Bot Config */}
        <section className="col-span-1 md:col-span-3 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-[#141414] bg-[#E4E3E0]">
            <h2 className="text-[10px] font-mono opacity-60 uppercase">Automation</h2>
            <h1 className="text-xl font-serif italic">Scheduling</h1>
          </div>
          
          <div className="p-4 border-b border-[#141414] flex-1 overflow-y-auto">
             <p className="text-[10px] font-mono opacity-60">Configure your posting schedule here.</p>
          </div>

          <div className="p-4 bg-[#141414] text-[#E4E3E0] h-[220px]">
            <h3 className="text-[10px] font-bold uppercase mb-4 opacity-50">Telegram Integration</h3>
             <p className="text-[10px] font-mono opacity-60">Configure your bot here.</p>
          </div>
        </section>
      </main>

      {/* Footer Bar */}
      <footer className="h-8 border-t border-[#141414] flex items-center px-6 justify-between bg-white text-[9px] font-mono uppercase tracking-widest">
        <div className="flex gap-4">
          <span>Status: Idle</span>
        </div>
        <div>
          <span>System Time: {new Date().toISOString()}</span>
        </div>
      </footer>
    </div>
  );
}
