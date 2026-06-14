import { useState, useMemo } from "react";
import { Play, Star, Clock, Search, SlidersHorizontal, Satellite, ArrowRight } from "lucide-react";
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

  // Filter channels for the side rail
  const railChannels = useMemo(() => {
    return channels.filter((c) => {
      const matchSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = selectedCategory === "All" || c.category === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [channels, searchTerm, selectedCategory]);

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
                      className="w-12 h-12 object-contain bg-[#03040b] rounded-lg border border-slate-800 p-1.5"
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
                  <span className="text-[10px] font-mono text-cyan-400/80 bg-cyan-950/30 border border-cyan-500/20 px-2.5 py-1.5 rounded-md">
                    VIEWERS: {activeChannel.views || 0}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative aspect-video bg-[#050612] border border-dashed border-cyan-500/20 rounded-xl flex flex-col items-center justify-center pointer-events-auto p-8 text-center min-h-[360px] shadow-[inset_0_0_35px_rgba(6,182,212,0.05)] overflow-hidden">
              <div className="absolute inset-0 pointer-events-none opacity-20 border border-cyan-500/5 bg-[linear-gradient(rgba(18,24,38,0)_95%,rgba(6,182,212,0.1)_95%),linear-gradient(90deg,rgba(18,24,38,0)_95%,rgba(6,182,212,0.1)_95%)] bg-[size:30px_30px]" />
              <Satellite size={54} className="text-cyan-400 animate-pulse mb-4 z-10" />
              <h3 className="text-lg font-bold text-white mb-2 z-10 tracking-widest font-mono">OBSERVATORY OFFLINE</h3>
              <p className="text-sm text-slate-400 max-w-sm mb-6 z-10 leading-relaxed font-sans">
                Select an HLS broadcast beacon from the satellite guide or explore the channels library to activate sensory visual feeds.
              </p>
              {channels.length > 0 && (
                <button
                  id="obs-auto-activate"
                  onClick={() => onSelectChannel(channels[0])}
                  className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white rounded-lg text-xs font-bold tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] cursor-pointer flex items-center gap-2 z-10"
                >
                  LOAD PRIME ANTENNA <Play size={12} fill="currentColor" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Channels Side Rail Selector */}
        <div className="bg-[#0b0c1f]/80 backdrop-blur-md border border-cyan-500/10 rounded-xl overflow-hidden shadow-2xl flex flex-col h-[300px] lg:h-[550px]">
          <div className="p-4 border-b border-cyan-500/10 space-y-3">
            <h3 className="font-mono text-cyan-400 text-xs font-bold tracking-widest uppercase flex items-center gap-1.5">
              <Satellite size={12} /> TELEMETRY SATELLITES
            </h3>
            
            {/* Search */}
            <div className="relative">
              <input
                id="rail-search-input"
                type="text"
                placeholder="Search telemetry..."
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
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-slate-950 text-slate-300 border border-slate-800 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-cyan-400 cursor-pointer"
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
                      <p className="text-xs font-semibold truncate leading-tight">{chan.name}</p>
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
