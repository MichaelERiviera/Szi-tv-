import React, { useState, useMemo } from "react";
import { Play, Star, Clock, Search, SlidersHorizontal, Satellite, ArrowRight, Globe, Sparkles, Cpu, Layers, Tv, CheckCircle, Flame, Navigation } from "lucide-react";
import { Channel, Favorite, WatchHistory } from "../../types";
import CyberPlayer from "../CyberPlayer";

interface ObservatoryScreenProps {
  channels: Channel[];
  favorites: Favorite[];
  watchHistory: WatchHistory[];
  onSelectChannel: (chan: Channel) => void;
  activeChannel: Channel | null;
  onToggleFavorite: (chanId: string) => void;
  onLogProgress: (seconds: number) => void;
}

// 4 Satellite stations mapped to geographic domains
const MAP_REGIONS = [
  { id: "americas", name: "Americas Transceiver", x: 70, y: 110, countryCode: "US", categoryFilter: "Sports", delay: "12ms" },
  { id: "europe", name: "Europe Node Mirror", x: 195, y: 75, countryCode: "EU", categoryFilter: "Movies", delay: "24ms" },
  { id: "asia", name: "Asia-Pacific Relay", x: 290, y: 115, countryCode: "JP", categoryFilter: "News", delay: "38ms" },
  { id: "africa", name: "Atlantic Ground Hub", x: 190, y: 155, countryCode: "ZA", categoryFilter: "Entertainment", delay: "19ms" },
];

export default function ObservatoryScreen({
  channels,
  favorites,
  watchHistory,
  onSelectChannel,
  activeChannel,
  onToggleFavorite,
  onLogProgress,
}: ObservatoryScreenProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // AI Channel Finder State
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReasoning, setAiReasoning] = useState("");
  const [aiMatches, setAiMatches] = useState<Channel[]>([]);

  // Interactive Map State
  const [activeGeoRegion, setActiveGeoRegion] = useState<string | null>(null);

  // EPG Interactive guide hours list
  const epgTimelineHours = ["Now Broadcasting", "06:00 PM Broadcast", "08:00 PM Broadcast", "10:00 PM Broadcast"];

  // Mock schedule data for each category to keep it fresh and highly styled as an EPG Guide
  const staticSchedules: Record<string, string[]> = {
    Sports: ["Intergalactic Cyber Derby Live", "Gravity Zero Formula Racing", "Superbowl Galactic Bowl", "Orbit Stadium Telecast"],
    Movies: ["Neon Matrix: Overclocked", "A.I. Dreams & Holograms", "Zero Gravity Noir Cinema", "Solar Flare Odyssey"],
    News: ["Deep Space News Broadcast", "Solar System Weather Status", "Alpha Centauri Stock Indices", "Asteroid Mining Bulletin"],
    Entertainment: ["Late Night Mars Talkshow", "Synthwave Cyber Music Festival", "Starfleet Hologram Comedy", "Deep Space Drone Symphony"],
    General: ["Sector Telemetry Channel", "Satellite Matrix Calibrations", "Astral Core Audio Stream", "Cosmic Horizon Probe Feed"]
  };

  // Get unique list of categories from available channels
  const categories = useMemo(() => {
    const list = new Set(channels.map((c) => c.category || "General"));
    return ["All", ...Array.from(list)];
  }, [channels]);

  // Is channel favorited helper
  const favoritedIds = useMemo(() => new Set(favorites.map((f) => f.channelId)), [favorites]);

  // Map history to actual channel objects
  const recentChannels = useMemo(() => {
    const historyMap = new Map(watchHistory.map((h) => [h.channelId, h.watchedAt]));
    return channels
      .filter((c) => historyMap.has(c.id))
      .sort((a, b) => {
        const timeA = new Date(historyMap.get(a.id)).getTime();
        const timeB = new Date(historyMap.get(b.id)).getTime();
        return timeB - timeA;
      })
      .slice(0, 6);
  }, [channels, watchHistory]);

  // Filter channels for the side rail based on Search, Category dropdown, and Interactive Map clicks
  const railChannels = useMemo(() => {
    return channels.filter((c) => {
      // Search term
      const matchSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Category & Geo filtering combined
      let matchCat = true;
      if (activeGeoRegion) {
        const selectedRegion = MAP_REGIONS.find((r) => r.id === activeGeoRegion);
        if (selectedRegion) {
          // Geo region filters down to specific category profile
          matchCat = c.category === selectedRegion.categoryFilter;
        }
      } else if (selectedCategory !== "All") {
        matchCat = c.category === selectedCategory;
      }

      return matchSearch && matchCat;
    });
  }, [channels, searchTerm, selectedCategory, activeGeoRegion]);

  // Handle calling the server-side Gemini AI finder
  const triggerAiFinder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiReasoning("");
    setAiMatches([]);

    try {
      const response = await fetch("/api/ai/finder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt, channels }),
      });

      if (!response.ok) {
        throw new Error("AI satellite tracking is slightly out of range.");
      }

      const data = await response.json();
      setAiReasoning(data.reasoning || "Search process initialized with positive calibration signal.");
      
      const recommendedChannelIds: string[] = data.recommendedChannelIds || [];
      const matchingChannels = channels.filter((c) => recommendedChannelIds.includes(c.id));
      setAiMatches(matchingChannels);
    } catch (err: any) {
      setAiReasoning(`📡 **Satellite Distortions Detected**:\n\nUnable to establish solid telemetry lock. Fallback search activated.`);
      // Strict fallback search
      const text = aiPrompt.toLowerCase();
      const fallback = channels.filter((ch) => 
        ch.name.toLowerCase().includes(text) || ch.category.toLowerCase().includes(text)
      );
      setAiMatches(fallback.slice(0, 3));
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Active Stream Panel (Glassmorphism & Radar grid style) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Observational Stream HUD Area */}
        <div className="lg:col-span-2 space-y-4">
          {activeChannel ? (
            <div className="space-y-3">
              <CyberPlayer channel={activeChannel} onWatchedProgress={onLogProgress} />
              
              {/* Active Feed Details */}
              <div className="bg-[#0b0c1f]/80 backdrop-blur-md border border-cyan-500/10 p-5 rounded-xl flex items-center justify-between shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                <div className="flex items-center gap-4">
                  {activeChannel.logo && (
                    <img
                      src={activeChannel.logo}
                      alt={activeChannel.name}
                      className="w-12 h-12 object-contain bg-[#03040b] rounded-lg border border-slate-800 p-1.5 animate-pulse"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=60";
                      }}
                    />
                  )}
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-wide">{activeChannel.name}</h2>
                    <p className="text-xs text-violet-400 font-mono tracking-wider">
                      {activeChannel.category || "GENERAL FEED"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    id="obs-favorite-btn"
                    onClick={() => onToggleFavorite(activeChannel.id)}
                    className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                      favoritedIds.has(activeChannel.id)
                        ? "bg-amber-400/20 text-amber-400 border-amber-400/40"
                        : "bg-slate-950/40 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    <Star size={16} fill={favoritedIds.has(activeChannel.id) ? "currentColor" : "none"} />
                  </button>
                  <span className="text-[10px] font-mono text-cyan-400/80 bg-cyan-950/30 border border-cyan-500/20 px-2.5 py-1.5 rounded-md flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    SIGNAL LOAD: {activeChannel.views || 0} SEC
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative aspect-video bg-[#050612] border border-dashed border-cyan-500/20 rounded-xl flex flex-col items-center justify-center pointer-events-auto p-8 text-center min-h-[360px] shadow-[inset_0_0_35px_rgba(6,182,212,0.05)] overflow-hidden">
              <div className="absolute inset-0 pointer-events-none opacity-20 border border-cyan-500/5 bg-[linear-gradient(rgba(18,24,38,0)_95%,rgba(6,182,212,0.1)_95%),linear-gradient(90deg,rgba(18,24,38,0)_95%,rgba(6,182,212,0.1)_95%)] bg-[size:30px_30px]" />
              <Satellite size={54} className="text-cyan-400 animate-pulse mb-4 z-10" />
              <h3 className="text-lg font-bold text-white mb-2 z-10 tracking-widest font-mono">CYBERNETIC OBSERVATORY STANDBY</h3>
              <p className="text-sm text-slate-400 max-w-sm mb-6 z-10 leading-relaxed font-sans">
                Select an HLS broadcast beacon from the telemetry guide or trigger the real-time AI finder to engage active streams.
              </p>
              {channels.length > 0 && (
                <button
                  id="obs-auto-activate"
                  onClick={() => onSelectChannel(channels[0])}
                  className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white rounded-lg text-xs font-bold tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] cursor-pointer flex items-center gap-2 z-10 animate-transition"
                >
                  LOAD BROADCAST NODE <Play size={12} fill="currentColor" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Channels Side Rail Selector */}
        <div className="bg-[#0b0c1f]/80 backdrop-blur-md border border-cyan-500/10 rounded-xl overflow-hidden shadow-2xl flex flex-col h-[300px] lg:h-[550px]">
          <div className="p-4 border-b border-cyan-500/10 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-mono text-cyan-400 text-xs font-bold tracking-widest uppercase flex items-center gap-1.5">
                <Satellite size={12} className="animate-spin" /> BROADCAST BEACONS
              </h3>
              {activeGeoRegion && (
                <button
                  onClick={() => setActiveGeoRegion(null)}
                  className="text-[8px] font-mono border border-rose-500/30 text-rose-400 p-0.5 px-1.5 rounded uppercase font-bold"
                >
                  Clear Geo Pin
                </button>
              )}
            </div>
            
            {/* Search */}
            <div className="relative">
              <input
                id="rail-search-input"
                type="text"
                placeholder="Search frequencies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 text-white placeholder-slate-500 border border-slate-800 text-xs rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_12px_rgba(6,182,212,0.15)] transition-all font-mono"
              />
              <Search className="absolute left-2.5 top-2.5 text-slate-500" size={13} />
            </div>

            {/* Category Dropdown */}
            <div className="relative flex items-center gap-2">
              <SlidersHorizontal size={12} className="text-slate-500" />
              <select
                id="rail-category-select"
                disabled={!!activeGeoRegion}
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-slate-950 text-slate-300 border border-slate-800 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-cyan-400 cursor-pointer disabled:opacity-50"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Rail Channel Items List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin scrollbar-thumb-cyan-500/20">
            {railChannels.length > 0 ? (
              railChannels.map((chan) => (
                <button
                  id={`rail-chan-${chan.id}`}
                  key={chan.id}
                  onClick={() => onSelectChannel(chan)}
                  className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-center justify-between group cursor-pointer ${
                    activeChannel?.id === chan.id
                      ? "bg-cyan-500/10 border-cyan-400/40 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.1)]"
                      : "bg-[#050612]/40 border-slate-900 text-slate-400 hover:bg-slate-950/60 hover:text-white hover:border-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={chan.logo}
                      alt=""
                      className="w-8 h-8 rounded-md object-contain bg-[#03040b] p-1 border border-slate-800 group-hover:border-cyan-500/20 transition-colors"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=60";
                      }}
                    />
                    <div className="max-w-[120px] xs:max-w-none">
                      <p className="text-xs font-semibold truncate leading-tight flex items-center gap-1.5">
                        {chan.name}
                        {chan.avgRating && chan.avgRating >= 4 && (
                          <span className="text-[7px] text-[#22c55e] border border-[#22c55e]/25 bg-[#22c55e]/5 px-0.5 rounded font-black">
                            HI-RES
                          </span>
                        )}
                      </p>
                      <p className="text-[9px] font-mono text-violet-400 truncate mt-0.5 uppercase">
                        {chan.category}
                      </p>
                    </div>
                  </div>
                  <Play
                    size={11}
                    className={`opacity-0 group-hover:opacity-100 transition-opacity ${
                      activeChannel?.id === chan.id ? "opacity-100 text-cyan-400" : "text-slate-400"
                    }`}
                    fill={activeChannel?.id === chan.id ? "currentColor" : "none"}
                  />
                </button>
              ))
            ) : (
              <div className="py-8 text-center text-slate-600 text-[10px] font-mono tracking-widest">
                NO BEACONS MATCH SEARCH
              </div>
            )}
          </div>
        </div>

      </div>

      {/* World Map Explorer & AI Pathfinder Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
        
        {/* World Map Channel Explorer */}
        <div className="bg-[#0b0c20]/75 border border-cyan-500/10 p-5 rounded-xl space-y-4 shadow-[0_0_20px_rgba(6,182,212,0.05)] relative overflow-hidden">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-white tracking-widest font-mono uppercase flex items-center gap-2">
              <Globe size={16} className="text-cyan-400 animate-spin" /> World Satellite Explorer
            </h3>
            <span className="text-[9px] font-mono text-zinc-500">CLICK PIN TO LOCK</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed font-sans">
            Configure orbit coordinates geographically. Select different ground nodes below to instantly override side rail categories to matching geo-mirrors.
          </p>

          <div className="relative aspect-[375/185] bg-slate-950/80 rounded-xl border border-slate-900 overflow-hidden flex items-center justify-center p-2">
            
            {/* Futuristic Vector Map SVG Drawing contours very lightly */}
            <svg viewBox="0 0 375 185" className="absolute inset-0 w-full h-full text-[#1e293b]/35 fill-current">
              {/* North America contour */}
              <path d="M40 30h80l20 30-30 30-50-20z M60 70h40v15h-40z" />
              {/* South America Contour */}
              <path d="M100 100l30 30-10 40-20-40z" />
              {/* Eurasia / Africa contour */}
              <path d="M160 40h120l30 40-40 40-100-20z M170 100h40l20 30-20 40h-20z" />
              {/* Australia */}
              <path d="M300 130h40l10 20-30 10z" />
            </svg>

            {/* Radar Circular rings overlay */}
            <div className="absolute inset-x-0 top-0 bottom-0 pointer-events-none opacity-30 flex items-center justify-center">
              <div className="w-56 h-56 rounded-full border border-cyan-500/10 animate-ping" />
              <div className="w-24 h-24 rounded-full border border-cyan-500/5" />
            </div>

            {/* Map Geolocation pins to click */}
            {MAP_REGIONS.map((region) => (
              <button
                key={region.id}
                onClick={() => {
                  setActiveGeoRegion(activeGeoRegion === region.id ? null : region.id);
                  setSelectedCategory("All");
                }}
                type="button"
                className="absolute z-10 group/pin select-none cursor-pointer"
                style={{ left: `${region.x}px`, top: `${region.y}px` }}
              >
                {/* Ping visual circles */}
                <span className={`absolute -left-1.5 -top-1.5 w-6 h-6 rounded-full animate-ping opacity-60 ${activeGeoRegion === region.id ? "bg-cyan-400" : "bg-violet-400"}`} />
                <span className={`absolute -left-0.5 -top-0.5 w-4 h-4 rounded-full ${activeGeoRegion === region.id ? "bg-cyan-500 shadow-[0_0_10px_#22d3ee]" : "bg-violet-600"} border border-slate-950`} />
                
                {/* Info bubble on hover */}
                <div className="absolute left-4 bottom-4 pointer-events-none bg-slate-950/90 text-white font-mono text-[8px] p-2 rounded-md border border-cyan-400/30 opacity-0 group-hover/pin:opacity-100 transition-opacity whitespace-nowrap space-y-1">
                  <p className="font-bold uppercase tracking-wider">{region.name}</p>
                  <p className="text-cyan-400 font-semibold">{region.categoryFilter} Node feed | Delay: {region.delay}</p>
                </div>
              </button>
            ))}

            <div className="absolute bottom-2 left-2 bg-[#02050c]/80 border border-slate-900 p-1 rounded font-mono text-[8px] text-zinc-400 uppercase tracking-widest leading-none">
              GRID: {activeGeoRegion ? `${activeGeoRegion.toUpperCase()} STAGE` : "ALL MIRRORS"}
            </div>
          </div>
        </div>

        {/* AI Channel Finder Interface */}
        <div className="bg-[#0b0c20]/75 border border-cyan-500/10 p-5 rounded-xl space-y-4 shadow-[0_0_20px_rgba(6,182,212,0.05)] flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-white tracking-widest font-mono uppercase flex items-center gap-2">
                <Sparkles size={16} className="text-cyan-400 animate-pulse" /> Cybernetic AI Pathfinder
              </h3>
              <span className="text-[8px] font-mono border border-cyan-500/30 rounded px-1.5 py-0.5 text-cyan-400 font-bold uppercase">
                Gemini Active
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Formulate natural language questions to ask our onboard satellite cognitive pilot for live matches, films, or news relays.
            </p>

            <form onSubmit={triggerAiFinder} className="flex gap-2 pt-1">
              <input
                type="text"
                required
                placeholder="Ask e.g. Football games live right now..."
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="flex-1 bg-slate-950 text-xs text-white border border-slate-900 rounded-lg px-3 py-2 font-mono focus:outline-none focus:border-cyan-400"
              />
              <button
                type="submit"
                disabled={aiLoading}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-black font-mono font-bold text-xs rounded-lg uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_12px_rgba(6,182,212,0.15)] flex items-center gap-1 shrink-0"
              >
                {aiLoading ? "Prowling..." : "Query"}
              </button>
            </form>
          </div>

          <div className="bg-slate-950 border border-slate-900 p-3 h-32 rounded-lg overflow-y-auto space-y-2 mt-2 scrollbar-thin scrollbar-thumb-cyan-500/15">
            {aiReasoning ? (
              <div className="text-[9px] font-mono leading-relaxed text-zinc-300">
                <p className="font-extrabold text-violet-400 tracking-wider mb-1 uppercase">PILOT FINDINGS LOG:</p>
                <p>{aiReasoning.replace(/\*\*|🛸|📡/g, "")}</p>
                
                {aiMatches.length > 0 && (
                  <div className="flex flex-wrap gap-2.5 pt-2 border-t border-slate-900 mt-2">
                    {aiMatches.map((ch) => (
                      <button
                        key={`ai-${ch.id}`}
                        onClick={() => onSelectChannel(ch)}
                        type="button"
                        className="flex items-center gap-1.5 bg-cyan-950/20 hover:bg-cyan-500 hover:text-black border border-cyan-400/30 text-cyan-400 text-[8px] font-bold p-1 px-2.5 rounded transition uppercase"
                      >
                        <Play size={8} fill="currentColor" /> Play {ch.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-zinc-600 text-[10px] font-mono tracking-widest text-center">
                CYBER NAVIGATOR SEARCH CACHE IDLE
              </div>
            )}
          </div>
        </div>

      </div>

      {/* EPG TV Guide Horizontal Grid Timeline Section */}
      <div className="bg-[#0b0c20]/60 border border-cyan-500/10 p-5 rounded-xl space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-cyan-500/10 pb-3">
          <h3 className="text-xs font-bold tracking-widest font-mono text-[#cbd5e1] uppercase flex items-center gap-2">
            <Tv size={15} className="text-cyan-400" /> Interactive EPG Grid Timeline
          </h3>
          <span className="text-[8px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-1 px-2 rounded flex items-center gap-1 uppercase font-black tracking-widest">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
            LIVE FEED SYNCHRONIZED
          </span>
        </div>

        {/* EPG Hours Indicators Header */}
        <div className="grid grid-cols-12 gap-2 text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-wider pb-1 text-center border-b border-slate-900">
          <div className="col-span-3 text-left">Broadcaster Beacon</div>
          {epgTimelineHours.map((hour, idx) => (
            <div key={idx} className="col-span-3 text-center truncate">
              {hour}
            </div>
          ))}
        </div>

        {/* EPG Program Rows indexer */}
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-cyan-500/20">
          {channels.slice(0, 10).map((chan) => {
            const catSchedules = staticSchedules[chan.category || "General"] || staticSchedules.General;
            return (
              <div key={`epg-${chan.id}`} className="grid grid-cols-12 gap-2 items-center text-center">
                {/* Mini channel tag */}
                <button
                  type="button"
                  onClick={() => onSelectChannel(chan)}
                  className="col-span-3 text-left flex items-center gap-2 bg-slate-950/60 hover:bg-[#0c0d24] border border-slate-900 rounded p-1 px-2.5 transition text-xs font-bold font-mono tracking-wide cursor-pointer w-full"
                >
                  <img
                    src={chan.logo}
                    alt=""
                    className="w-5 h-5 rounded object-contain bg-black p-0.5"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=60";
                    }}
                  />
                  <span className={`truncate ${activeChannel?.id === chan.id ? "text-cyan-400 font-extrabold" : "text-zinc-300"}`}>
                    {chan.name}
                  </span>
                </button>

                {/* EPG blocks */}
                {epgTimelineHours.map((hour, idx) => {
                  const showName = catSchedules[idx % catSchedules.length];
                  return (
                    <div
                      key={`hour-${idx}`}
                      onClick={() => onSelectChannel(chan)}
                      className={`col-span-3 text-[10px] p-2.5 rounded border leading-tight transition cursor-pointer select-none font-sans font-medium text-center relative overflow-hidden truncate ${
                        idx === 0
                          ? activeChannel?.id === chan.id
                            ? "bg-cyan-500/10 border-cyan-450 text-cyan-400 font-bold"
                            : "bg-slate-950 border-slate-800 text-zinc-200"
                          : "bg-slate-950/40 border-slate-900/60 text-zinc-500 hover:text-zinc-300 hover:border-slate-800"
                      }`}
                      title={showName}
                    >
                      {showName}
                      {idx === 0 && (
                        <div className="absolute top-1 right-1 flex items-center gap-0.5">
                          <Flame size={7} className="text-red-500 fill-red-500" />
                          <span className="text-[6px] font-mono text-red-400 uppercase tracking-tighter">Live</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* RECENTLY OBSERVED & SATELLITE HISTORY LINKS */}
      {recentChannels.length > 0 && (
        <div className="bg-[#0b0c1f]/40 border border-cyan-500/5 p-6 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold tracking-widest text-[#a5b4fc] uppercase flex items-center gap-2">
              <Clock size={12} className="text-[#818cf8]" /> Continue Observation
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {recentChannels.map((c) => (
              <div
                id={`recent-rec-${c.id}`}
                key={c.id}
                onClick={() => onSelectChannel(c)}
                className="group cursor-pointer bg-slate-950/70 hover:bg-[#070919] border border-slate-850 hover:border-violet-500/40 p-3.5 rounded-lg transition-all flex flex-col items-center text-center relative overflow-hidden"
              >
                <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-violet-400 opacity-60" />
                <img
                  src={c.logo}
                  alt=""
                  className="w-12 h-12 object-contain bg-[#03040b] border border-slate-800 rounded-md p-1 group-hover:border-violet-500/20 transition-all mb-2"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=60";
                  }}
                />
                <h4 className="text-xs font-semibold text-slate-200 group-hover:text-cyan-400 truncate w-full">
                  {c.name}
                </h4>
                <span className="text-[8px] font-mono text-slate-500 truncate w-full mt-1 uppercase">
                  {c.category}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
