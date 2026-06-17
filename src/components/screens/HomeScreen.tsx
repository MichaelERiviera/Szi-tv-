import { useState, useEffect, useMemo } from "react";
import {
  Play,
  Search,
  Tv,
  Star,
  Film,
  Flame,
  Volume2,
  Globe,
  Clock,
  Trophy,
  Filter,
  Calendar,
  Zap,
  Info,
  Check,
  Plus
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Channel, Favorite } from "../../types";

interface HomeScreenProps {
  channels: Channel[];
  favorites: Favorite[];
  onSelectChannel: (chan: Channel) => void;
  onToggleFavorite: (chanId: string) => void;
  userDisplayName?: string;
  isGuest?: boolean;
  onRequireLogin?: (tab?: "login" | "register") => void;
}

export interface FootballMatch {
  id: number;
  utcDate: string;
  status: "LIVE" | "FINISHED" | "SCHEDULED";
  minute?: number;
  competition: {
    name: string;
    emblem: string;
    code: string;
  };
  area: {
    name: string;
    code: string;
    flag: string;
  };
  homeTeam: {
    name: string;
    shortName: string;
    crest: string;
    tla: string;
  };
  awayTeam: {
    name: string;
    shortName: string;
    crest: string;
    tla: string;
  };
  score: {
    fullTime: {
      home: number | null;
      away: number | null;
    };
  };
  scoreChanged?: boolean;
}

const INITIAL_SIMULATED_MATCHES: FootballMatch[] = [
  {
    id: 1101,
    utcDate: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    status: "LIVE",
    minute: 41,
    competition: { name: "UEFA Champions League", emblem: "https://crests.football-data.org/CL.png", code: "CL" },
    area: { name: "Europe", code: "EUR", flag: "https://crests.football-data.org/74.svg" },
    homeTeam: { name: "Real Madrid CF", shortName: "Real Madrid", crest: "https://crests.football-data.org/86.png", tla: "RMA" },
    awayTeam: { name: "Manchester City FC", shortName: "Man City", crest: "https://crests.football-data.org/65.png", tla: "MCI" },
    score: { fullTime: { home: 2, away: 1 } }
  },
  {
    id: 1102,
    utcDate: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
    status: "LIVE",
    minute: 76,
    competition: { name: "UEFA Champions League", emblem: "https://crests.football-data.org/CL.png", code: "CL" },
    area: { name: "Europe", code: "EUR", flag: "https://crests.football-data.org/74.svg" },
    homeTeam: { name: "Arsenal FC", shortName: "Arsenal", crest: "https://crests.football-data.org/57.png", tla: "ARS" },
    awayTeam: { name: "FC Bayern München", shortName: "Bayern", crest: "https://crests.football-data.org/5.png", tla: "FCB" },
    score: { fullTime: { home: 1, away: 2 } }
  },
  {
    id: 1103,
    utcDate: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    status: "LIVE",
    minute: 14,
    competition: { name: "Premier League", emblem: "https://crests.football-data.org/PL.png", code: "PL" },
    area: { name: "England", code: "ENG", flag: "https://crests.football-data.org/770.svg" },
    homeTeam: { name: "Liverpool FC", shortName: "Liverpool", crest: "https://crests.football-data.org/64.png", tla: "LIV" },
    awayTeam: { name: "Chelsea FC", shortName: "Chelsea", crest: "https://crests.football-data.org/61.png", tla: "CHE" },
    score: { fullTime: { home: 0, away: 0 } }
  },
  {
    id: 1104,
    utcDate: new Date(Date.now() - 110 * 60 * 1000).toISOString(),
    status: "FINISHED",
    competition: { name: "La Liga", emblem: "https://crests.football-data.org/PD.png", code: "PD" },
    area: { name: "Spain", code: "ESP", flag: "https://crests.football-data.org/760.svg" },
    homeTeam: { name: "FC Barcelona", shortName: "Barcelona", crest: "https://crests.football-data.org/81.png", tla: "FCB" },
    awayTeam: { name: "Atletico Madrid", shortName: "Atleti", crest: "https://crests.football-data.org/78.png", tla: "ATM" },
    score: { fullTime: { home: 3, away: 1 } }
  }
];

export default function HomeScreen({
  channels,
  favorites,
  onSelectChannel,
  onToggleFavorite,
  userDisplayName = "Viewer",
  isGuest = false,
  onRequireLogin
}: HomeScreenProps) {
  const [matches, setMatches] = useState<FootballMatch[]>(INITIAL_SIMULATED_MATCHES);
  const [isUsingDemo, setIsUsingDemo] = useState(true);
  const [countdown, setCountdown] = useState(30);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeGridCategory, setActiveGridCategory] = useState<"all" | "sports" | "movies" | "news" | "entertainment">("all");

  const favoritedIds = useMemo(() => new Set(favorites.map((f) => f.channelId)), [favorites]);

  // Sync / poll matches
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const simInterval = setInterval(() => {
      if (!isUsingDemo) return;
      setMatches((prev) =>
        prev.map((m) => {
          if (m.status !== "LIVE") return m;
          const match = { ...m, scoreChanged: false };
          if (match.minute !== undefined) {
            match.minute += 1;
            if (match.minute > 90) match.status = "FINISHED";
          }
          if (Math.random() > 0.98) {
            const scoringTeam = Math.random() > 0.5 ? "home" : "away";
            if (match.score.fullTime.home !== null && match.score.fullTime.away !== null) {
              if (scoringTeam === "home") {
                match.score.fullTime.home += 1;
              } else {
                match.score.fullTime.away += 1;
              }
              match.scoreChanged = true;
            }
          }
          return match;
        })
      );
    }, 10000);
    return () => clearInterval(simInterval);
  }, [isUsingDemo]);

  // Clean goal indicator reset
  useEffect(() => {
    const activeChanges = matches.filter((m) => m.scoreChanged);
    if (activeChanges.length > 0) {
      const timer = setTimeout(() => {
        setMatches((prev) => prev.map((m) => (m.scoreChanged ? { ...m, scoreChanged: false } : m)));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [matches]);

  // Filter Channels helper
  const getCategorizedList = (categoryKey: "sports" | "movies" | "news" | "entertainment" | "all") => {
    return channels.filter((c) => {
      if (categoryKey === "all") return true;
      const catName = c.category?.toLowerCase() || "";
      const cName = c.name.toLowerCase();
      if (categoryKey === "sports") {
        return catName.includes("sport") || catName.includes("adventure") || cName.includes("sport") || cName.includes("red bull") || c.id.includes("redbull");
      }
      if (categoryKey === "movies") {
        return catName.includes("movie") || catName.includes("cinema") || catName.includes("space") || cName.includes("cinema") || cName.includes("movie") || c.id.includes("steel") || c.id.includes("sintel");
      }
      if (categoryKey === "news") {
        return catName.includes("news") || catName.includes("tech") || catName.includes("finance") || cName.includes("news") || c.id.includes("dw") || c.id.includes("france") || c.id.includes("jazeera");
      }
      if (categoryKey === "entertainment") {
        return catName.includes("audio") || catName.includes("music") || catName.includes("lofi") || catName.includes("ambient") || cName.includes("music") || cName.includes("lofi") || cName.includes("beat");
      }
      return true;
    });
  };

  // 1. Hero Banner Selection
  const heroChannel = useMemo(() => {
    if (channels.length === 0) return null;
    // Prefer Sintel or Red Bull TV if available, otherwise pick the one with most views
    const preferred = channels.find((c) => c.name.toLowerCase().includes("sintel") || c.name.toLowerCase().includes("red bull"));
    if (preferred) return preferred;
    return [...channels].sort((a, b) => (b.views || 0) - (a.views || 0))[0];
  }, [channels]);

  // 2. Trending Channels (Views Descending)
  const trendingChannels = useMemo(() => {
    return [...channels].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 6);
  }, [channels]);

  // 3. Recently Added (By AddedAt or fallback to reverse index)
  const recentlyAddedChannels = useMemo(() => {
    return [...channels]
      .sort((a, b) => {
        const timeA = a.addedAt?.toDate ? a.addedAt.toDate().getTime() : 0;
        const timeB = b.addedAt?.toDate ? b.addedAt.toDate().getTime() : 0;
        if (timeA && timeB) return timeB - timeA;
        return b.id.localeCompare(a.id);
      })
      .slice(0, 6);
  }, [channels]);

  // 4. All/Filtered channels list
  const filteredChannels = useMemo(() => {
    let list = getCategorizedList(activeGridCategory);
    if (searchQuery.trim()) {
      const term = searchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(term) ||
          (c.category && c.category.toLowerCase().includes(term))
      );
    }
    return list;
  }, [channels, searchQuery, activeGridCategory]);

  const handleFavoriteClick = (chanId: string) => {
    if (isGuest && onRequireLogin) {
      onRequireLogin("login");
    } else {
      onToggleFavorite(chanId);
    }
  };

  const handleCategorySelection = (cat: "all" | "sports" | "movies" | "news" | "entertainment") => {
    setActiveGridCategory(cat);
    const element = document.getElementById("all-channels-section");
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Scoreboard Renderer
  const renderUnifiedScoreboardCard = (title: string, matchSubset: FootballMatch[], accentColor: "blue" | "green" = "blue") => {
    const isBlue = accentColor === "blue";
    return (
      <div className="relative bg-[#07070c]/90 border border-zinc-900 rounded-2xl overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
        <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${isBlue ? "from-cyan-500 via-blue-500 to-indigo-500" : "from-emerald-500 via-teal-500 to-green-500"}`} />
        <div className="bg-[#0b0b14] px-5 py-3 border-b border-zinc-900 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <Trophy size={14} className={isBlue ? "text-cyan-400" : "text-emerald-400 animate-pulse"} />
            <span className="text-xs font-black font-mono uppercase tracking-wider text-zinc-100">{title}</span>
          </div>
          <span className="text-[9px] font-mono font-bold text-zinc-500 bg-[#040409] px-2 py-0.5 rounded border border-zinc-850">
            AUTO-SYNC: {countdown}S
          </span>
        </div>
        <div className="divide-y divide-zinc-900 bg-zinc-950/20">
          {matchSubset.map((m) => {
            const isLive = m.status === "LIVE";
            return (
              <div key={m.id} className={`flex items-center justify-between px-4 py-3.5 hover:bg-zinc-900/10 transition duration-200 relative ${m.scoreChanged ? "bg-emerald-950/20" : ""}`}>
                {m.scoreChanged && (
                  <div className="absolute inset-x-0 inset-y-0 bg-emerald-900/10 flex items-center justify-center animate-pulse">
                    <span className="text-[9px] text-emerald-400 font-black tracking-widest uppercase">⚽ GOAL! GOAL! SCORE UPDATED</span>
                  </div>
                )}
                {/* Home Team */}
                <div className="flex-1 flex items-center justify-end gap-2 text-right min-w-0">
                  <span className="text-xs font-bold text-zinc-350 truncate">{m.homeTeam.shortName}</span>
                  <img src={m.homeTeam.crest} className="w-4 h-4 object-contain" alt="" onError={(e) => ((e.target as HTMLImageElement).src = "https://crests.football-data.org/65.png")} />
                </div>
                {/* Central Score */}
                <div className="px-4 flex items-center justify-center shrink-0">
                  {m.score.fullTime.home !== null ? (
                    <span className="font-mono text-xs font-extrabold bg-[#050508] px-2.5 py-0.5 rounded-lg border border-zinc-850 text-white">
                      {m.score.fullTime.home} - {m.score.fullTime.away}
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded uppercase">VS</span>
                  )}
                </div>
                {/* Away Team */}
                <div className="flex-1 flex items-center justify-start gap-2 text-left min-w-0">
                  <img src={m.awayTeam.crest} className="w-4 h-4 object-contain" alt="" onError={(e) => ((e.target as HTMLImageElement).src = "https://crests.football-data.org/86.png")} />
                  <span className="text-xs font-bold text-zinc-350 truncate">{m.awayTeam.shortName}</span>
                </div>
                {/* Status Indicator */}
                <div className="w-16 flex justify-end shrink-0">
                  {isLive ? (
                    <span className="flex items-center gap-1 text-[8px] font-black text-rose-400 bg-rose-950/25 border border-rose-900/30 px-1.5 py-0.5 rounded">
                      <span className="w-1 h-1 bg-rose-500 rounded-full animate-ping" />
                      {m.minute}'
                    </span>
                  ) : (
                    <span className="text-[8px] text-zinc-500 font-mono">FIXTURE</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-12 pb-16 font-sans text-zinc-100 select-none">
      
      {/* 1. HERO BANNER */}
      {heroChannel ? (
        <div className="relative w-full rounded-2xl overflow-hidden aspect-[21/9] md:aspect-[21/8] bg-black border border-zinc-900 shadow-2xl group">
          {/* Main Background Cover Photo with absolute filters */}
          <div className="absolute inset-0 z-0">
            <img
              src={heroChannel.logo || "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1600&auto=format&fit=crop&q=80"}
              alt=""
              className="w-full h-full object-cover blur-[2px] opacity-40 scale-105 group-hover:scale-100 transition-transform duration-1000"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1600&auto=format&fit=crop&q=80";
              }}
            />
            {/* Dynamic visual overlay gradients to deliver crisp premium cinematic blending */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#04040a] via-black/40 to-black/35" />
            <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-black/80 to-transparent" />
          </div>

          {/* Banner Contents */}
          <div className="absolute inset-x-0 bottom-0 top-0 z-10 flex flex-col justify-end p-6 md:p-10 max-w-3xl space-y-3.5">
            <div className="flex gap-2 items-center flex-wrap">
              <span className="bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[9px] font-black tracking-widest uppercase px-2 py-0.5 rounded-md">
                FEATURED FEED
              </span>
              <span className="bg-zinc-950/80 border border-zinc-800 text-zinc-350 text-[9px] px-2 py-0.5 rounded-md uppercase">
                {heroChannel.category || "Livestream"}
              </span>
              <span className="bg-zinc-950/80 border border-zinc-800 text-[9px] text-[#00f0ff] px-2 py-0.5 rounded-md uppercase font-mono">
                HLS OPTIMIZED
              </span>
            </div>

            <h1 className="text-xl sm:text-3xl md:text-4xl font-extrabold uppercase tracking-tight text-white leading-tight">
              {heroChannel.name}
            </h1>

            <p className="text-zinc-400 text-xs line-clamp-2 md:line-clamp-3 leading-relaxed max-w-xl">
              Experience flawless high-fidelity streaming of premium television feeds. This selected broadcaster connects you with high bitrate live signals, featuring Sazi TV adaptive latency buffering.
            </p>

            <div className="flex gap-3 pt-3 flex-wrap">
              <button
                onClick={() => onSelectChannel(heroChannel)}
                className="px-5 py-2.5 bg-cyan-400 hover:bg-cyan-300 active:bg-cyan-500 text-zinc-950 rounded-xl font-bold text-xs tracking-wider uppercase transition-all duration-300 shadow-[0_0_15px_rgba(34,211,238,0.25)] flex items-center gap-2 cursor-pointer transform hover:scale-[1.02]"
              >
                <Play fill="currentColor" size={13} /> Play Broadcast
              </button>

              <button
                onClick={() => handleFavoriteClick(heroChannel.id)}
                className={`px-4 py-2.5 border rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                  favoritedIds.has(heroChannel.id)
                    ? "bg-amber-400/15 border-amber-500/40 text-amber-400"
                    : "bg-zinc-950/50 border-zinc-800 text-zinc-300 hover:text-white"
                }`}
              >
                {favoritedIds.has(heroChannel.id) ? (
                  <>
                    <Check size={13} className="text-amber-400" /> In Favorites
                  </>
                ) : (
                  <>
                    <Plus size={13} /> Add to Favorites
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative w-full rounded-2xl overflow-hidden aspect-[21/8] bg-slate-950/20 border border-zinc-900 border-dashed flex items-center justify-center">
          <div className="text-center space-y-2">
            <Tv className="text-zinc-600 mx-auto" size={32} />
            <p className="text-zinc-550 font-mono text-xs uppercase">No channels loaded to display Hero Banner</p>
          </div>
        </div>
      )}

      {/* 2. CATEGORIES FILTER TABS (NETFLIX STYLE QUICKLINKS) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-l-2 border-cyan-400 pl-3.5">
          <Filter size={14} className="text-cyan-400" />
          <h2 className="text-xs font-black font-mono tracking-widest text-zinc-400 uppercase">
            QUICK RECOMMENDATION TABS
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
          {[
            { id: "all", label: "All Broadcasts", icon: Globe, style: "from-blue-500/10 via-indigo-500/10 to-transparent", hover: "hover:border-blue-500/40" },
            { id: "sports", label: "Live Sports", icon: Flame, style: "from-emerald-500/10 via-teal-500/10 to-transparent", hover: "hover:border-emerald-500/40" },
            { id: "movies", label: "Movies & Cinema", icon: Film, style: "from-purple-500/10 via-pink-500/10 to-transparent", hover: "hover:border-purple-500/40" },
            { id: "news", label: "World News", icon: Globe, style: "from-cyan-500/10 via-blue-500/10 to-transparent", hover: "hover:border-cyan-500/40" },
            { id: "entertainment", label: "Entertainment", icon: Volume2, style: "from-pink-500/10 via-rose-500/10 to-transparent", hover: "hover:border-pink-500/40" }
          ].map((cat) => {
            const Icon = cat.icon;
            const isSelected = activeGridCategory === cat.id;
            return (
              <div
                key={cat.id}
                onClick={() => handleCategorySelection(cat.id as any)}
                className={`cursor-pointer rounded-xl p-4 border transition-all duration-300 relative overflow-hidden group flex items-center justify-between ${
                  isSelected
                    ? "bg-gradient-to-tr from-cyan-950/20 to-blue-950/20 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.1)]"
                    : `bg-[#05050b] border-zinc-850 ${cat.hover}`
                }`}
              >
                <div className="space-y-1 z-10">
                  <span className="text-[8px] font-mono font-bold text-zinc-500 uppercase tracking-widest block">GENRE</span>
                  <span className="text-xs font-black tracking-wide text-zinc-200 uppercase group-hover:text-white transition-colors">
                    {cat.label}
                  </span>
                </div>
                <div className={`p-2 rounded-lg ${isSelected ? "bg-cyan-500/15 text-cyan-400" : "bg-[#0a0a14] text-zinc-500 group-hover:text-cyan-400"} transition-all z-10 shrink-0 ml-2`}>
                  <Icon size={16} />
                </div>
                <div className={`absolute inset-0 bg-gradient-to-r ${cat.style} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. LIVE SPORTS SECTION */}
      <div className="space-y-5">
        <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
          <div className="flex items-center gap-2.5 border-l-2 border-emerald-400 pl-3.5">
            <Trophy className="text-emerald-400" size={15} />
            <h2 className="text-xs sm:text-sm font-black font-mono tracking-widest text-zinc-100 uppercase">
              LIVE SPORTS & MATCHDAY AGENTS
            </h2>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse" />
        </div>

        {/* Live Football matches */}
        {renderUnifiedScoreboardCard("EUROPEAN CHAMPIONS LEAGUE - REAT-TIME SIMULATOR", matches, "green")}

        {/* Sports IPTV Channels catalog */}
        <div className="space-y-3">
          <p className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest">
            SPORTS CHANNELS BROADCASTING LIVE
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {getCategorizedList("sports").slice(0, 6).map((chan) => (
              <div
                key={`sports-tag-${chan.id}`}
                onClick={() => onSelectChannel(chan)}
                className="group bg-[#05050b]/80 hover:bg-[#07070f] border border-zinc-850 hover:border-emerald-500/30 rounded-xl overflow-hidden cursor-pointer transition-all duration-300 transform hover:-translate-y-1 relative"
              >
                <div className="aspect-video bg-black p-3.5 relative flex items-center justify-center">
                  <img
                    src={chan.logo || "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=200"}
                    alt=""
                    className="max-h-full max-w-full object-contain filter group-hover:brightness-110"
                    referrerPolicy="no-referrer"
                    onError={(e) => ((e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=200")}
                  />
                  <div className="absolute top-1.5 left-1.5 bg-emerald-500 text-black text-[7px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded">
                    SPORTS
                  </div>
                </div>
                <div className="p-2.5 bg-[#030306] text-center border-t border-zinc-900">
                  <h4 className="text-[10px] font-extrabold text-zinc-300 truncate group-hover:text-emerald-400 transition-colors uppercase leading-tight">
                    {chan.name}
                  </h4>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. TRENDING CHANNELS (NETFLIX STYLE LARGE NUMBERS) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2.5 border-l-2 border-cyan-400 pl-3.5">
          <Zap className="text-cyan-400" size={15} />
          <h2 className="text-xs sm:text-sm font-black font-mono tracking-widest text-zinc-100 uppercase">
            TRENDING CHANNELS ON SAZI TV
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 pt-3">
          {trendingChannels.map((chan, index) => {
            const isFav = favoritedIds.has(chan.id);
            return (
              <div
                key={`trending-${chan.id}`}
                onClick={() => onSelectChannel(chan)}
                className="group relative bg-[#05050b]/90 border border-zinc-850 hover:border-cyan-500/30 rounded-xl overflow-hidden transition-all duration-300 flex flex-col justify-between cursor-pointer hover:-translate-y-1 hover:shadow-[0_8px_25px_rgba(6,182,212,0.1)]"
              >
                {/* Ranking number background overlay */}
                <div className="absolute -left-3 -bottom-5 text-[110px] font-black font-sans leading-none text-zinc-800/10 pointer-events-none tracking-tighter select-none z-0 group-hover:text-cyan-500/10 duration-500">
                  {index + 1}
                </div>

                {/* Bookmark Toggle */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFavoriteClick(chan.id);
                  }}
                  className={`absolute top-2 right-2 z-20 p-1.5 rounded-lg border backdrop-blur-md transition-all hover:scale-105 active:scale-95 ${
                    isFav
                      ? "bg-amber-400/20 border-amber-400/40 text-amber-300 shadow"
                      : "bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  <Star size={11} fill={isFav ? "currentColor" : "none"} />
                </button>

                {/* Logo Frame */}
                <div className="relative aspect-video bg-[#020204] flex items-center justify-center p-4">
                  <img
                    src={chan.logo || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200"}
                    className="max-h-full max-w-full object-contain filter group-hover:brightness-110 group-hover:scale-102 transition-all duration-300"
                    alt=""
                    referrerPolicy="no-referrer"
                    onError={(e) => ((e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200")}
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300">
                    <div className="w-8 h-8 rounded-full bg-cyan-400 text-zinc-950 flex items-center justify-center font-bold">
                      <Play fill="currentColor" size={12} className="ml-0.5" />
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-zinc-950/90 border-t border-zinc-900 z-10 relative">
                  <h4 className="text-[11px] font-extrabold text-zinc-300 group-hover:text-cyan-400 transition-colors truncate">
                    {chan.name}
                  </h4>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-[7.5px] font-bold text-zinc-500 uppercase tracking-wider">
                      {chan.category || "General"}
                    </span>
                    <span className="text-[8px] font-mono text-cyan-400">
                      {chan.views ? `${chan.views.toLocaleString()} views` : "HOT"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. RECENTLY ADDED CHANNELS */}
      <div className="space-y-4">
        <div className="flex items-center gap-2.5 border-l-2 border-purple-400 pl-3.5">
          <Clock className="text-purple-400" size={15} />
          <h2 className="text-xs sm:text-sm font-black font-mono tracking-widest text-zinc-100 uppercase">
            RECENTLY ADDED CHANNELS
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {recentlyAddedChannels.map((chan) => {
            const isFav = favoritedIds.has(chan.id);
            return (
              <div
                key={`recent-${chan.id}`}
                onClick={() => onSelectChannel(chan)}
                className="group relative bg-[#05050b]/90 border border-zinc-850 hover:border-purple-500/30 rounded-xl overflow-hidden transition-all duration-300 flex flex-col justify-between cursor-pointer hover:-translate-y-1 hover:shadow-[0_8px_25px_rgba(168,85,247,0.1)]"
              >
                {/* New badge flag indicator */}
                <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1 bg-purple-600/90 text-[7px] font-black tracking-widest text-white px-2 py-0.5 rounded uppercase shadow">
                  <span className="w-1 h-1 rounded-full bg-white animate-ping" />
                  NEW
                </div>

                {/* Bookmark Toggle */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFavoriteClick(chan.id);
                  }}
                  className={`absolute top-2 right-2 z-20 p-1.5 rounded-lg border backdrop-blur-md transition-all hover:scale-105 active:scale-95 ${
                    isFav
                      ? "bg-amber-400/20 border-amber-400/40 text-amber-300 shadow"
                      : "bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  <Star size={11} fill={isFav ? "currentColor" : "none"} />
                </button>

                {/* Logo Frame */}
                <div className="relative aspect-video bg-[#020204] flex items-center justify-center p-4">
                  <img
                    src={chan.logo || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200"}
                    className="max-h-full max-w-full object-contain filter group-hover:brightness-110"
                    alt=""
                    referrerPolicy="no-referrer"
                    onError={(e) => ((e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200")}
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300">
                    <div className="w-8 h-8 rounded-full bg-purple-400 text-zinc-950 flex items-center justify-center font-bold shadow-lg">
                      <Play fill="currentColor" size={12} className="ml-0.5" />
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-zinc-950/90 border-t border-zinc-900 z-10">
                  <h4 className="text-[11px] font-extrabold text-zinc-300 group-hover:text-purple-400 transition-colors truncate">
                    {chan.name}
                  </h4>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-[7.5px] font-bold text-zinc-500 uppercase tracking-wider">
                      {chan.category || "General"}
                    </span>
                    <span className="text-[8px] font-mono text-purple-400">
                      FRESH
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. ALL CHANNELS GRID (FULLY SEARCHABLE & FILTER PILLS) */}
      <div id="all-channels-section" className="space-y-5 scroll-mt-24 pt-4 border-t border-zinc-900/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 border-l-2 border-cyan-400 pl-3.5">
            <Tv className="text-cyan-400" size={15} />
            <h2 className="text-xs sm:text-sm font-black font-mono tracking-widest text-zinc-100 uppercase">
              ALL BROADCAST CHANNELS ({filteredChannels.length})
            </h2>
          </div>

          <div className="relative w-full sm:max-w-xs">
            <input
              type="text"
              placeholder="Filter list by broadcast name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#05050b] text-zinc-100 placeholder-zinc-500 border border-zinc-850 focus:border-cyan-500 rounded-xl py-2 pl-9 pr-4 text-xs font-sans tracking-wide outline-none focus:ring-1 focus:ring-cyan-500/20"
            />
            <Search className="absolute left-3 top-2.5 text-zinc-650" size={13} />
          </div>
        </div>

        {/* Channels Grid mapping */}
        <AnimatePresence mode="popLayout">
          {filteredChannels.length > 0 ? (
            <motion.div
              layout
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5"
            >
              {filteredChannels.map((chan) => {
                const isFav = favoritedIds.has(chan.id);
                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.25 }}
                    key={`all-chan-${chan.id}`}
                    onClick={() => onSelectChannel(chan)}
                    className="group relative bg-[#05050b]/90 border border-zinc-850 hover:border-cyan-500/30 rounded-xl overflow-hidden transition-all duration-300 flex flex-col justify-between cursor-pointer hover:-translate-y-1.5 hover:shadow-[0_8px_20px_rgba(6,182,212,0.12)]"
                  >
                    {/* Live Badge Flag */}
                    <div className="absolute top-2 left-2 z-20 flex items-center gap-1 bg-[#09090f]/75 border border-zinc-800 text-[6.5px] font-black tracking-wider text-zinc-400 px-1.5 py-0.5 rounded-md uppercase">
                      <span className="w-1 h-1 rounded-full bg-[#00f0ff] animate-pulse" />
                      IPTV
                    </div>

                    {/* Bookmark Toggle */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFavoriteClick(chan.id);
                      }}
                      className={`absolute top-2 right-2 z-20 p-1.5 rounded-lg border backdrop-blur-md transition-all hover:scale-105 active:scale-95 ${
                        isFav
                          ? "bg-amber-400/20 border-amber-400/40 text-amber-300 shadow"
                          : "bg-zinc-950/80 border-zinc-800 text-zinc-400 hover:text-white"
                      }`}
                    >
                      <Star size={11} fill={isFav ? "currentColor" : "none"} />
                    </button>

                    {/* Logo aspect-video container */}
                    <div className="relative aspect-video bg-[#020204] flex items-center justify-center p-4">
                      <img
                        src={chan.logo || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200"}
                        alt=""
                        className="max-h-full max-w-full object-contain filter group-hover:brightness-110"
                        referrerPolicy="no-referrer"
                        onError={(e) => ((e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200")}
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300">
                        <div className="w-9 h-9 rounded-full bg-[#00f0ff] text-zinc-950 flex items-center justify-center shadow-lg transition-transform duration-300 transform scale-90 group-hover:scale-100">
                          <Play fill="currentColor" size={13} className="ml-0.5" />
                        </div>
                      </div>
                    </div>

                    {/* Channel Description Details block */}
                    <div className="p-3 bg-zinc-950/95 border-t border-zinc-900 flex-1 flex flex-col justify-between gap-1.5">
                      <h4 className="text-[11px] font-extrabold text-zinc-250 group-hover:text-cyan-400 transition-colors truncate">
                        {chan.name}
                      </h4>
                      <div className="flex items-center justify-between">
                        <span className="text-[7.5px] font-bold text-zinc-500 uppercase tracking-widest bg-[#0a0a0f] px-1.5 py-0.5 rounded border border-zinc-900 truncate max-w-[85px]">
                          {chan.category || "General"}
                        </span>
                        <span className="text-[8px] font-mono text-cyan-500">
                          {chan.views ? `${chan.views.toLocaleString()} views` : "ONLINE"}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          ) : (
            <div className="bg-[#040409] border border-dashed border-zinc-850 p-12 text-center rounded-2xl">
              <p className="text-xs text-zinc-500 font-mono">No matching broadcasts found in this category.</p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setActiveGridCategory("all");
                }}
                className="mt-3.5 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-[10px] text-cyan-400 hover:bg-zinc-850 transition font-bold"
              >
                Reset filter preferences
              </button>
            </div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
