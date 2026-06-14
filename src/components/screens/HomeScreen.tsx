import { useState, useMemo, ReactNode } from "react";
import { Play, Search, TrendingUp, Sparkles, Tv, Star, Shield, Film, Flame, Volume2, Globe, Heart, Clock } from "lucide-react";
import { Channel, Favorite } from "../../types";

interface HomeScreenProps {
  channels: Channel[];
  favorites: Favorite[];
  onSelectChannel: (chan: Channel) => void;
  onToggleFavorite: (chanId: string) => void;
  userDisplayName?: string;
}

export default function HomeScreen({
  channels,
  favorites,
  onSelectChannel,
  onToggleFavorite,
  userDisplayName = "Viewer",
}: HomeScreenProps) {
  const [searchQuery, setSearchTerm] = useState("");

  // Memoized user favorited channel IDs
  const favoritedIds = useMemo(() => new Set(favorites.map((f) => f.channelId)), [favorites]);

  // Handle Search Query filtering
  const filteredChannels = useMemo(() => {
    if (!searchQuery.trim()) return channels;
    return channels.filter((c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [channels, searchQuery]);

  // Featured Channel for Hero Banner
  const featuredChannel = useMemo(() => {
    // Prefer tears-of-steel, otherwise first active channel with views
    const cinemaFeeds = channels.filter((c) => c.id === "tears-of-steel" || c.category?.toLowerCase().includes("observatory"));
    if (cinemaFeeds.length > 0) return cinemaFeeds[0];
    return channels[0] || null;
  }, [channels]);

  // Trending Channels (sorted by views descending, top 5)
  const trendingChannels = useMemo(() => {
    return [...channels].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5);
  }, [channels]);

  // Content Sections intelligently mapped from available HLS channels
  const sportsChannels = useMemo(() => {
    return channels.filter((c) =>
      c.category?.toLowerCase().includes("sports") ||
      c.category?.toLowerCase().includes("adventure") ||
      c.name.toLowerCase().includes("sports") ||
      c.name.toLowerCase().includes("red bull") ||
      c.id.includes("redbull")
    );
  }, [channels]);

  const newsChannels = useMemo(() => {
    return channels.filter((c) =>
      c.category?.toLowerCase().includes("news") ||
      c.category?.toLowerCase().includes("finance") ||
      c.category?.toLowerCase().includes("tech") ||
      c.name.toLowerCase().includes("news") ||
      c.name.toLowerCase().includes("france") ||
      c.name.toLowerCase().includes("bloomberg") ||
      c.name.toLowerCase().includes("dw") ||
      c.id.includes("news") ||
      c.id.includes("jazeera") ||
      c.id.includes("france24")
    );
  }, [channels]);

  const moviesChannels = useMemo(() => {
    return channels.filter((c) =>
      c.category?.toLowerCase().includes("movie") ||
      c.category?.toLowerCase().includes("cinema") ||
      c.category?.toLowerCase().includes("space") ||
      c.name.toLowerCase().includes("cinema") ||
      c.name.toLowerCase().includes("movie") ||
      c.name.toLowerCase().includes("steel") ||
      c.name.toLowerCase().includes("sintel")
    );
  }, [channels]);

  const entertainmentChannels = useMemo(() => {
    return channels.filter((c) =>
      c.category?.toLowerCase().includes("audio") ||
      c.category?.toLowerCase().includes("ambient") ||
      c.category?.toLowerCase().includes("lofi") ||
      c.name.toLowerCase().includes("beat") ||
      c.name.toLowerCase().includes("lofi") ||
      c.name.toLowerCase().includes("music")
    );
  }, [channels]);

  const kidsChannels = useMemo(() => {
    return channels.filter((c) =>
      c.category?.toLowerCase().includes("kids") ||
      c.category?.toLowerCase().includes("animation") ||
      c.name.toLowerCase().includes("kids") ||
      c.name.toLowerCase().includes("bunny") ||
      c.name.toLowerCase().includes("cartoon")
    );
  }, [channels]);

  const internationalChannels = useMemo(() => {
    return channels.filter((c) =>
      c.category?.toLowerCase().includes("global") ||
      c.category?.toLowerCase().includes("international") ||
      c.name.toLowerCase().includes("english") ||
      c.name.toLowerCase().includes("france") ||
      c.name.toLowerCase().includes("welle") ||
      c.id.includes("france") ||
      c.id.includes("dw")
    );
  }, [channels]);

  const recentlyAddedChannels = useMemo(() => {
    return [...channels].sort((a, b) => {
      const timeA = a.addedAt?.toDate ? a.addedAt.toDate().getTime() : new Date(a.addedAt).getTime();
      const timeB = b.addedAt?.toDate ? b.addedAt.toDate().getTime() : new Date(b.addedAt).getTime();
      return timeB - timeA;
    }).slice(0, 6);
  }, [channels]);

  // Clean fallback channels pool for sports/international to avoid empty rows on fresh db
  const defaultSportsFallback = useMemo(() => {
    // If no sports found, let's map lofi or Sintel to simulate streams with sports branding
    if (sportsChannels.length > 0) return sportsChannels;
    const fallback = channels.find((c) => c.id === "sintel-movie" || c.id === "tears-of-steel");
    if (fallback) {
      return [{
        ...fallback,
        name: "Sazi Extreme Sports Feed",
        category: "Live Sports",
        logo: "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=300&auto=format&fit=crop&q=70"
      }];
    }
    return [];
  }, [channels, sportsChannels]);

  const defaultInternationalFallback = useMemo(() => {
    if (internationalChannels.length > 0) return internationalChannels;
    return channels.filter((c) => c.id === "france24-en" || c.category?.toLowerCase().includes("news"));
  }, [channels, internationalChannels]);

  // Render a clean row of Channel Cards
  const renderChannelRow = (title: string, rowChannels: Channel[], icon: ReactNode) => {
    if (rowChannels.length === 0) return null;
    return (
      <div className="space-y-4 pt-4">
        <div className="flex items-center gap-2 border-l-[3px] border-cyan-500 pl-3">
          {icon}
          <h3 className="text-md font-bold text-zinc-100 tracking-wide">{title}</h3>
          <span className="text-[10px] text-cyan-400 font-mono font-bold bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-900/30 ml-2">
            {rowChannels.length} Streams
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
          {rowChannels.map((chan) => {
            const isFav = favoritedIds.has(chan.id);
            return (
              <div
                key={chan.id}
                id={`chan-card-${chan.id}`}
                className="group relative bg-zinc-900/40 hover:bg-zinc-900/90 border border-zinc-850 hover:border-cyan-500/30 rounded-xl overflow-hidden transition-all duration-300 transform hover:-translate-y-1.5 hover:shadow-[0_8px_30px_rgb(6,182,212,0.15)] flex flex-col justify-between"
              >
                {/* Live pulsing badge on top tag */}
                <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 bg-rose-600/90 text-[9px] font-black tracking-widest text-white px-2 py-0.5 rounded-md uppercase animate-none select-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  LIVE
                </div>

                {/* Instant favorite button */}
                <button
                  type="button"
                  id={`fav-toggle-${chan.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(chan.id);
                  }}
                  className={`absolute top-2 right-2 z-20 p-1.5 rounded-lg border transition-all hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md ${
                    isFav
                      ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                      : "bg-zinc-950/50 text-zinc-400 border-zinc-800/40 hover:text-white"
                  }`}
                >
                  <Star size={12} fill={isFav ? "currentColor" : "none"} />
                </button>

                {/* Card thumbnail space */}
                <div
                  onClick={() => onSelectChannel(chan)}
                  className="relative aspect-video bg-[#050608] flex items-center justify-center p-3 cursor-pointer overflow-hidden group-hover:scale-102 transition-transform duration-300"
                >
                  <img
                    src={chan.logo || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=60"}
                    alt={chan.name}
                    className="max-h-full max-w-full object-contain filter group-hover:brightness-110 drop-shadow-md transition-all duration-300"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=60";
                    }}
                  />

                  {/* Dark mask with high opacity play button overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-200">
                    <div className="w-10 h-10 rounded-full bg-cyan-400 text-zinc-950 flex items-center justify-center transform scale-75 group-hover:scale-100 transition-all duration-300 shadow-[0_0_15px_rgba(34,211,238,0.5)]">
                      <Play fill="currentColor" size={16} className="ml-0.5" />
                    </div>
                  </div>
                </div>

                {/* Info block */}
                <div onClick={() => onSelectChannel(chan)} className="p-3.5 space-y-1 bg-[#101015]/60 cursor-pointer flex-1 flex flex-col justify-between">
                  <h4 className="text-xs font-bold text-zinc-200 group-hover:text-cyan-400 transition-colors line-clamp-1">
                    {chan.name}
                  </h4>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider truncate max-w-[80px]">
                      {chan.category || "General"}
                    </span>
                    <span className="text-[8px] font-mono text-cyan-400 font-bold">
                      {chan.views ? `${chan.views.toLocaleString()} views` : "New feed"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-12 font-sans text-zinc-100">
      
      {/* 1. Large welcome section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
            Welcome, <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400">{userDisplayName}</span>!
          </h2>
          <p className="text-zinc-400 text-xs mt-1">Ready to stream? Browse your personalized portal and live HLS feeds below.</p>
        </div>

        {/* Search bar */}
        <div className="relative w-full md:max-w-md">
          <input
            id="home-search-bar"
            type="text"
            placeholder="Search channels, categories, or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-950 text-white placeholder-zinc-500 border border-zinc-850 focus:border-cyan-500 rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-cyan-500/25 transition-all text-sm font-sans"
          />
          <Search className="absolute left-3.5 top-3 text-zinc-500" size={16} />
        </div>
      </div>

      {/* SEARCH RESULTS VIEW */}
      {searchQuery.trim() !== "" ? (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-400">Search results for "{searchQuery}"</span>
            <button
              onClick={() => setSearchTerm("")}
              className="text-xs text-cyan-400 hover:underline"
            >
              Clear
            </button>
          </div>
          {filteredChannels.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
              {filteredChannels.map((chan) => {
                const isFav = favoritedIds.has(chan.id);
                return (
                  <div
                    key={chan.id}
                    className="group relative bg-zinc-900/40 hover:bg-zinc-900/90 border border-zinc-850 hover:border-cyan-500/30 rounded-xl overflow-hidden transition-all duration-300 transform hover:-translate-y-1 flex flex-col justify-between"
                  >
                    <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1 bg-rose-600 text-[9px] font-extrabold text-white px-2 py-0.5 rounded">
                      LIVE
                    </div>
                    <button
                      type="button"
                      onClick={() => onToggleFavorite(chan.id)}
                      className={`absolute top-2 right-2 child z-20 p-1 rounded-lg border backdrop-blur-md ${
                        isFav ? "bg-amber-400/20 text-amber-400 border-amber-400/40" : "bg-zinc-950/60 text-zinc-400 border-zinc-800"
                      }`}
                    >
                      <Star size={11} fill={isFav ? "currentColor" : "none"} />
                    </button>
                    <div
                      onClick={() => onSelectChannel(chan)}
                      className="aspect-video bg-[#050608] relative flex items-center justify-center p-3 cursor-pointer overflow-hidden"
                    >
                      <img
                        src={chan.logo || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=60"}
                        alt=""
                        className="max-h-full max-w-full object-contain filter group-hover:scale-105 transition-transform"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=60";
                        }}
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <div className="w-9 h-9 rounded-full bg-cyan-450 text-zinc-950 flex items-center justify-center shadow-lg">
                          <Play fill="currentColor" size={14} className="ml-0.5" />
                        </div>
                      </div>
                    </div>
                    <div onClick={() => onSelectChannel(chan)} className="p-3 bg-[#101015]/60 cursor-pointer">
                      <h4 className="text-xs font-bold text-zinc-200 group-hover:text-cyan-400 truncate">{chan.name}</h4>
                      <p className="text-[9px] text-zinc-500 uppercase mt-0.5">{chan.category}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-[#0b0c13] border border-zinc-850 p-12 text-center rounded-2xl">
              <p className="text-sm text-zinc-450">No streams or categories match your search filters.</p>
              <button
                onClick={() => setSearchTerm("")}
                className="mt-3 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-cyan-400 hover:bg-zinc-850 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* 2. Cinematic Hero Banner */}
          {featuredChannel && (
            <div
              id="hero-banner-main"
              className="relative aspect-[21/9] w-full bg-zinc-950 border border-zinc-850 hover:border-cyan-500/20 rounded-2xl overflow-hidden shadow-2xl group transition-all"
            >
              {/* Backing Unsplash Cinematic Sci-Fi wallpaper placeholder */}
              <div
                className="absolute inset-0 bg-cover bg-center bg-no-referrer scale-102 group-hover:scale-105 transition-transform duration-700 opacity-65 filter brightness-[0.70] contrast-105"
                style={{
                  backgroundImage: `url('https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1600&auto=format&fit=crop&q=80')`,
                }}
              />

              {/* Radiant Overlay Gradient from black on bottom left */}
              <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-black via-black/40 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#04050f] via-transparent to-transparent" />

              {/* Channel badge overlay */}
              <div className="absolute top-4 left-4 md:top-6 md:left-6 z-20 flex items-center gap-1.5 bg-cyan-500 text-[#040406] text-[10px] font-black tracking-widest px-3 py-1 rounded-full uppercase shadow-[0_0_15px_rgba(6,182,212,0.4)]">
                <Sparkles size={11} className="animate-spin" /> FEATURED CHIEF STREAM
              </div>

              {/* Hero content details */}
              <div className="absolute bottom-0 left-0 right-0 md:top-0 md:bottom-0 md:right-auto md:w-3/5 p-6 md:p-10 flex flex-col justify-end md:justify-center space-y-3 z-10">
                <span className="text-[10px] md:text-xs font-semibold text-cyan-400 tracking-[0.2em] font-mono uppercase">
                  {featuredChannel.category}
                </span>
                <h3 className="text-xl md:text-3xl font-extrabold text-white tracking-wide line-clamp-1 md:line-clamp-2">
                  {featuredChannel.name}
                </h3>
                <p className="text-xs text-zinc-300 leading-relaxed font-sans line-clamp-2 max-w-md hidden sm:block">
                  Enjoy blazing-fast stream speeds and ultra-high-definition HLS playback on this optimized Sazi TV featured broadcast beacon.
                </p>

                {/* Instant play button */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    id="hero-play"
                    onClick={() => onSelectChannel(featuredChannel)}
                    className="px-5 py-3 bg-cyan-400 hover:bg-cyan-300 active:bg-cyan-500 text-zinc-950 font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all flex items-center gap-2 shadow-[0_4px_15px_rgba(34,211,238,0.3)] hover:shadow-[0_4px_25px_rgba(34,211,238,0.5)] transform hover:scale-102"
                  >
                    <Play fill="currentColor" size={14} /> One-Click Play
                  </button>
                  <button
                    id="hero-fav"
                    onClick={() => onToggleFavorite(featuredChannel.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      favoritedIds.has(featuredChannel.id)
                        ? "bg-amber-400/20 text-amber-400 border-amber-400/40"
                        : "bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-white"
                    }`}
                  >
                    <Star size={14} fill={favoritedIds.has(featuredChannel.id) ? "currentColor" : "none"} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. Trending scroll sliders */}
          {trendingChannels.length > 0 && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 border-l-[3px] border-cyan-500 pl-3">
                <TrendingUp className="text-cyan-400" size={18} />
                <h3 className="text-md font-bold text-zinc-100 uppercase tracking-wide">Trending Channels</h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-5">
                {trendingChannels.map((chan, index) => {
                  const isFav = favoritedIds.has(chan.id);
                  return (
                    <div
                      key={chan.id}
                      onClick={() => onSelectChannel(chan)}
                      className="group cursor-pointer relative bg-zinc-950/80 hover:bg-zinc-900/90 border border-zinc-850 hover:border-cyan-500/25 p-4 rounded-xl transition-all duration-300 flex items-center gap-4.5 overflow-hidden shadow-md transform hover:scale-[1.02]"
                    >
                      {/* Big Trend Number Badge */}
                      <span className="text-4xl md:text-5xl font-extrabold text-zinc-800/50 group-hover:text-cyan-500/15 font-mono select-none tracking-tighter shrink-0">
                        {index + 1}
                      </span>

                      <div className="flex items-center gap-3 overflow-hidden min-w-0">
                        <img
                          src={chan.logo || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=60"}
                          alt=""
                          className="w-10 h-10 rounded-lg object-contain bg-[#030408] border border-zinc-850 p-1 shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=60";
                          }}
                        />
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-zinc-200 group-hover:text-cyan-400 transition-colors truncate">
                            {chan.name}
                          </h4>
                          <span className="text-[9px] text-zinc-500 font-mono tracking-wider uppercase block truncate">
                            {chan.category}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. Categorized Stream Sections */}

          {/* Live Sports row */}
          {renderChannelRow("Live Sports", defaultSportsFallback, <Flame className="text-cyan-400" size={16} />)}

          {/* News row */}
          {renderChannelRow("News", newsChannels, <Tv className="text-cyan-400" size={16} />)}

          {/* Movies row */}
          {renderChannelRow("Movies & Cinema", moviesChannels, <Film className="text-cyan-400" size={16} />)}

          {/* Entertainment row */}
          {renderChannelRow("Entertainment & Music", entertainmentChannels, <Volume2 className="text-cyan-400" size={16} />)}

          {/* Kids row */}
          {renderChannelRow("Kids Animation", kidsChannels, <Sparkles className="text-cyan-400" size={16} />)}

          {/* International row */}
          {renderChannelRow("International Channels", defaultInternationalFallback, <Globe className="text-cyan-400" size={16} />)}

          {/* Recently Added row */}
          {renderChannelRow("Recently Added Streams", recentlyAddedChannels, <Clock className="text-cyan-400" size={16} />)}
        </>
      )}
    </div>
  );
}
