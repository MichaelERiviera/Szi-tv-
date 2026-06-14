import { useState, useMemo } from "react";
import { Search, Star, Play, SlidersHorizontal, ArrowLeft, ArrowRight, Zap, Target } from "lucide-react";
import { Channel, Favorite } from "../../types";

interface LibraryScreenProps {
  channels: Channel[];
  favorites: Favorite[];
  onSelectChannel: (chan: Channel) => void;
  onToggleFavorite: (chanId: string) => void;
}

export default function LibraryScreen({
  channels,
  favorites,
  onSelectChannel,
  onToggleFavorite,
}: LibraryScreenProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 16;

  // Extract all categories
  const categories = useMemo(() => {
    const list = new Set(channels.map((c) => c.category || "General"));
    return ["All", ...Array.from(list)];
  }, [channels]);

  // Favorite map
  const favoritedIds = useMemo(() => new Set(favorites.map((f) => f.channelId)), [favorites]);

  // Filter channels based on search and category
  const filteredChannels = useMemo(() => {
    setCurrentPage(1); // Reset page on filter
    return channels.filter((c) => {
      const matchSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = activeCategory === "All" || c.category === activeCategory;
      return matchSearch && matchCat;
    });
  }, [channels, searchTerm, activeCategory]);

  // Total pages
  const totalPages = Math.ceil(filteredChannels.length / itemsPerPage) || 1;

  // Slice channels for current page
  const paginatedChannels = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredChannels.slice(start, start + itemsPerPage);
  }, [filteredChannels, currentPage]);

  // Hot/Trending Channel picks (Sort by views descending)
  const trendingPick = useMemo(() => {
    return [...channels].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 4);
  }, [channels]);

  return (
    <div className="space-y-6">
      
      {/* Search Header and Categories Row */}
      <div className="bg-[#0b0c1f]/80 backdrop-blur-md border border-cyan-500/10 p-5 rounded-xl space-y-4 shadow-xl">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-400/10 border border-cyan-400/30 text-cyan-400 rounded-lg">
              <SlidersHorizontal size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide font-mono">CHANNELS INDEX</h2>
              <p className="text-xs text-slate-400">Filter, search, and bookmark {channels.length} cosmic broadcast nodes</p>
            </div>
          </div>

          {/* Search bar inputs */}
          <div className="relative w-full md:w-80">
            <input
              id="lib-search-term"
              type="text"
              placeholder="Filter satellite signals..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 text-white placeholder-slate-500 border border-slate-800 focus:border-cyan-400 text-xs rounded-lg pl-9 pr-4 py-2.5 focus:outline-none transition-all font-mono"
            />
            <Search className="absolute left-3 top-3 text-slate-500" size={14} />
          </div>
        </div>

        {/* Scrollable Category pills list */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-purple-500/20">
          {categories.map((cat) => (
            <button
              id={`lib-cat-${cat}`}
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider font-mono whitespace-nowrap border cursor-pointer transition-all ${
                activeCategory === cat
                  ? "bg-gradient-to-r from-cyan-500 to-violet-600 text-white border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                  : "bg-slate-950/50 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700"
              }`}
            >
              {cat.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* TRENDING / HOT STATION RAILS */}
      {searchTerm === "" && activeCategory === "All" && trendingPick.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-mono font-bold tracking-widest text-cyan-400 uppercase flex items-center gap-1.5">
            <Zap size={12} className="animate-bounce" /> HOT STATION BEACONS
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {trendingPick.map((c) => (
              <div
                id={`trending-${c.id}`}
                key={c.id}
                className="bg-gradient-to-b from-[#0b0c20]/90 to-slate-950 border border-violet-500/10 p-4 rounded-xl relative overflow-hidden group hover:border-cyan-500/30 transition-all shadow-md flex items-center gap-4"
              >
                <div className="absolute top-0 right-0 bg-violet-600/20 text-violet-400 border-l border-b border-violet-500/10 px-2.5 py-0.5 text-[8px] font-mono uppercase tracking-widest font-semibold rounded-bl-lg">
                  HOT
                </div>
                <img
                  src={c.logo}
                  alt=""
                  className="w-12 h-12 rounded-lg object-contain bg-[#03040b] p-1.5 border border-slate-800"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=60";
                  }}
                />
                <div className="flex-1 overflow-hidden">
                  <h4 className="text-xs font-bold text-white truncate group-hover:text-cyan-400 transition-colors">
                    {c.name}
                  </h4>
                  <p className="text-[9px] font-mono text-slate-500 truncate mt-0.5 uppercase">
                    {c.category}
                  </p>
                  <button
                    id={`play-trending-${c.id}`}
                    onClick={() => onSelectChannel(c)}
                    className="mt-1.5 text-[9px] font-mono text-cyan-400 hover:text-cyan-300 font-bold tracking-widest uppercase flex items-center gap-1 cursor-pointer"
                  >
                    Watch Now <Play size={8} fill="currentColor" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PAGINATED PRIMARY CHANNELS GRID */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-mono font-bold tracking-widest text-[#a5b4fc] uppercase">
            RESULTS: {filteredChannels.length} STATIONS FOUND
          </h4>
          <span className="text-[10px] font-mono text-slate-400">
            Page {currentPage} of {totalPages}
          </span>
        </div>

        {paginatedChannels.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {paginatedChannels.map((c) => (
              <div
                id={`lib-card-${c.id}`}
                key={c.id}
                className="bg-[#0b0c1f]/80 backdrop-blur-sm border border-cyan-500/10 hover:border-cyan-500/30 p-4 rounded-xl flex flex-col justify-between group transition-all duration-300 shadow-md relative"
              >
                <div className="flex gap-3.5 pb-3">
                  <img
                    src={c.logo}
                    alt=""
                    className="w-14 h-14 object-contain bg-[#03040b] rounded-lg border border-slate-800 p-1 group-hover:border-cyan-500/20 transition-colors shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=60";
                    }}
                  />
                  <div className="overflow-hidden space-y-0.5">
                    <h5 className="text-xs font-bold text-white leading-snug group-hover:text-cyan-400 transition-colors truncate">
                      {c.name}
                    </h5>
                    <p className="text-[9px] font-mono text-violet-400 uppercase tracking-wider font-semibold truncate">
                      {c.category}
                    </p>
                    <p className="text-[8px] font-mono text-slate-500 uppercase">
                      STATUS: {c.status || "ACTIVE"}
                    </p>
                  </div>
                </div>

                {/* Card Action footer button */}
                <div className="pt-3 border-t border-cyan-500/5 flex items-center justify-between gap-1.5">
                  <button
                    id={`watch-btn-${c.id}`}
                    onClick={() => onSelectChannel(c)}
                    className="flex-1 text-center py-1.5 bg-cyan-500/10 hover:bg-cyan-500 text-cyan-400 hover:text-white border border-cyan-500/20 hover:border-cyan-400 rounded-md text-[10px] font-bold font-mono tracking-widest uppercase transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    ACTIVATE <Play size={9} fill="currentColor" />
                  </button>

                  <button
                    id={`toggle-fav-btn-${c.id}`}
                    onClick={() => onToggleFavorite(c.id)}
                    className={`p-1.5 border rounded-md transition-colors cursor-pointer ${
                      favoritedIds.has(c.id)
                        ? "bg-amber-400/20 text-amber-400 border-amber-400/30"
                        : "bg-slate-950/40 text-slate-500 border-slate-800 hover:text-white hover:border-slate-700"
                    }`}
                  >
                    <Star size={11} fill={favoritedIds.has(c.id) ? "currentColor" : "none"} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-[#0b0c1f]/50 border border-slate-800 p-12 text-center rounded-xl space-y-3 shadow-inner">
            <Target size={30} className="text-slate-500 mx-auto animate-pulse" />
            <p className="text-xs font-mono text-slate-400 uppercase tracking-widest">
              Zero channels aligned to search parameters
            </p>
          </div>
        )}

        {/* Global Catalog Pagination Actions */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 pt-4 border-t border-cyan-500/5 select-none font-mono">
            <button
              id="lib-btn-prev"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
              className="p-2.5 bg-slate-950/60 hover:bg-slate-900 text-slate-350 disabled:opacity-30 border border-slate-800 rounded-lg text-xs disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              <ArrowLeft size={13} />
            </button>
            <span className="text-xs text-white">
              Page {currentPage} of {totalPages}
            </span>
            <button
              id="lib-btn-next"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
              className="p-2.5 bg-slate-950/60 hover:bg-slate-900 text-slate-350 disabled:opacity-30 border border-slate-800 rounded-lg text-xs disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              <ArrowRight size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
