import { useState, useEffect, useMemo, useRef } from "react";
import {
  Play,
  Search,
  TrendingUp,
  Sparkles,
  Tv,
  Star,
  Film,
  Flame,
  Volume2,
  Globe,
  Clock,
  RefreshCw,
  AlertCircle,
  Trophy,
  Filter,
  ArrowDownCircle,
  Info,
  Calendar,
  Zap,
  CheckCircle2,
  Heart
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Channel, Favorite } from "../../types";

interface HomeScreenProps {
  channels: Channel[];
  favorites: Favorite[];
  onSelectChannel: (chan: Channel) => void;
  onToggleFavorite: (chanId: string) => void;
  userDisplayName?: string;
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

// Ultra high-fidelity simulation pool as the gold standard default
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
  },
  {
    id: 1105,
    utcDate: new Date(Date.now() + 120 * 60 * 1000).toISOString(),
    status: "SCHEDULED",
    competition: { name: "Serie A", emblem: "https://crests.football-data.org/SA.png", code: "SA" },
    area: { name: "Italy", code: "ITA", flag: "https://crests.football-data.org/784.svg" },
    homeTeam: { name: "Juventus FC", shortName: "Juventus", crest: "https://crests.football-data.org/109.png", tla: "JUV" },
    awayTeam: { name: "SSC Napoli", shortName: "Napoli", crest: "https://crests.football-data.org/113.png", tla: "NAP" },
    score: { fullTime: { home: null, away: null } }
  },
  {
    id: 1106,
    utcDate: new Date(Date.now() + 240 * 60 * 1000).toISOString(),
    status: "SCHEDULED",
    competition: { name: "Bundesliga", emblem: "https://crests.football-data.org/BL1.png", code: "BL" },
    area: { name: "Germany", code: "GER", flag: "https://crests.football-data.org/759.svg" },
    homeTeam: { name: "Borussia Dortmund", shortName: "Dortmund", crest: "https://crests.football-data.org/4.png", tla: "BVB" },
    awayTeam: { name: "Bayer 04 Leverkusen", shortName: "Leverkusen", crest: "https://crests.football-data.org/3.png", tla: "B04" },
    score: { fullTime: { home: null, away: null } }
  },
  {
    id: 1107,
    utcDate: new Date(Date.now() - 320 * 60 * 1000).toISOString(),
    status: "FINISHED",
    competition: { name: "Ligue 1", emblem: "https://crests.football-data.org/FL1.png", code: "FL1" },
    area: { name: "France", code: "FRA", flag: "https://crests.football-data.org/773.svg" },
    homeTeam: { name: "Paris Saint-Germain", shortName: "PSG", crest: "https://crests.football-data.org/524.png", tla: "PSG" },
    awayTeam: { name: "Olympique de Marseille", shortName: "Marseille", crest: "https://crests.football-data.org/516.png", tla: "OM" },
    score: { fullTime: { home: 4, away: 2 } }
  },
  {
    id: 1108,
    utcDate: new Date(Date.now() + 480 * 60 * 1000).toISOString(),
    status: "SCHEDULED",
    competition: { name: "Premier League", emblem: "https://crests.football-data.org/PL.png", code: "PL" },
    area: { name: "England", code: "ENG", flag: "https://crests.football-data.org/770.svg" },
    homeTeam: { name: "Tottenham Hotspur", shortName: "Tottenham", crest: "https://crests.football-data.org/73.png", tla: "TOT" },
    awayTeam: { name: "Manchester United", shortName: "Man United", crest: "https://crests.football-data.org/66.png", tla: "MUN" },
    score: { fullTime: { home: null, away: null } }
  }
];

export default function HomeScreen({
  channels,
  favorites,
  onSelectChannel,
  onToggleFavorite,
  userDisplayName = "Viewer"
}: HomeScreenProps) {
  // Matches State - Single State Management
  const [matches, setMatches] = useState<FootballMatch[]>(INITIAL_SIMULATED_MATCHES);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isUsingDemo, setIsUsingDemo] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  
  // Refresh ticker states (30 second automated countdown)
  const [countdown, setCountdown] = useState<number>(30);

  // Filter queries
  const [searchQuery, setSearchTerm] = useState("");
  const [activeGridCategory, setActiveGridCategory] = useState<"all" | "sports" | "movies" | "news" | "entertainment">("all");

  const favoritedIds = useMemo(() => new Set(favorites.map((f) => f.channelId)), [favorites]);

  // Fetch match data cleanly from https://api.football-data.org/v4/matches or proxy
  const fetchMatches = async (silent = false) => {
    const activeToken = localStorage.getItem("sazi_tv_soccer_api_token") || (import.meta as any).env?.VITE_FOOTBALL_API_KEY || "";
    
    if (!activeToken) {
      if (!silent) {
        setLoading(false);
        setIsUsingDemo(true);
      }
      return;
    }

    if (!silent) setLoading(true);
    setIsRefreshing(true);
    setError(null);

    try {
      const targetUrl = "https://api.football-data.org/v4/matches";
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
      
      const response = await fetch(proxyUrl, {
        method: "GET",
        headers: {
          "X-Auth-Token": activeToken
        }
      });

      if (!response.ok) {
        throw new Error(`API error code ${response.status}`);
      }

      const data = await response.json();
      if (data && Array.isArray(data.matches)) {
        const formatted: FootballMatch[] = data.matches.map((m: any) => {
          let status: "LIVE" | "FINISHED" | "SCHEDULED" = "SCHEDULED";
          if (["IN_PLAY", "LIVE", "PAUSED"].includes(m.status)) {
            status = "LIVE";
          } else if (m.status === "FINISHED") {
            status = "FINISHED";
          }

          return {
            id: m.id,
            utcDate: m.utcDate,
            status,
            minute: m.status === "PAUSED" ? 45 : (m.status === "IN_PLAY" || m.status === "LIVE" ? 68 : undefined),
            competition: {
              name: m.competition.name,
              emblem: m.competition.emblem || "https://crests.football-data.org/CL.png",
              code: m.competition.code
            },
            area: {
              name: m.area.name,
              code: m.area.code,
              flag: m.area.flag || "https://crests.football-data.org/74.svg"
            },
            homeTeam: {
              name: m.homeTeam.name,
              shortName: m.homeTeam.shortName || m.homeTeam.name,
              crest: m.homeTeam.crest || "https://crests.football-data.org/65.png",
              tla: m.homeTeam.tla || m.homeTeam.name.substring(0, 3).toUpperCase()
            },
            awayTeam: {
              name: m.awayTeam.name,
              shortName: m.awayTeam.shortName || m.awayTeam.name,
              crest: m.awayTeam.crest || "https://crests.football-data.org/86.png",
              tla: m.awayTeam.tla || m.awayTeam.name.substring(0, 3).toUpperCase()
            },
            score: {
              fullTime: {
                home: m.score.fullTime?.home !== undefined ? m.score.fullTime.home : null,
                away: m.score.fullTime?.away !== undefined ? m.score.fullTime.away : null
              }
            }
          };
        });

        if (formatted.length > 0) {
          setMatches(formatted);
          setIsUsingDemo(false);
          setError(null);
        } else {
          // Keep simulated if returned empty
          setIsUsingDemo(true);
        }
      } else {
        throw new Error("Mismatch in JSON return format");
      }
    } catch (err: any) {
      console.warn("Using simulated high-fidelity matchday engine:", err);
      setIsUsingDemo(true);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Run dynamic transitions for minutes counting up and random score changes
  const updateSimulatedTicks = () => {
    if (!isUsingDemo) return;

    setMatches((prevMatches) =>
      prevMatches.map((m) => {
        if (m.status !== "LIVE") return m;

        // Clone
        const match = { ...m, scoreChanged: false };

        // Ticks up play minutes
        if (match.minute !== undefined) {
          match.minute += 1;
          if (match.minute > 90) {
            match.status = "FINISHED";
          }
        } else {
          match.minute = 15;
        }

        // 3% chance a match has a goal event
        if (Math.random() > 0.97) {
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
  };

  // Handle score changed highlight reset (timeout cleanup)
  useEffect(() => {
    const activeChanges = matches.filter(m => m.scoreChanged);
    if (activeChanges.length > 0) {
      const timer = setTimeout(() => {
        setMatches(prev => prev.map(m => m.scoreChanged ? { ...m, scoreChanged: false } : m));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [matches]);

  // Initial loading
  useEffect(() => {
    fetchMatches();
  }, []);

  // Countdown timer for auto-refresh: exactly 30 seconds countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Re-trigger sync
          fetchMatches(true);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Simulation engine pulse (ticking minutes and scores every 10 seconds)
  useEffect(() => {
    const simInterval = setInterval(() => {
      updateSimulatedTicks();
    }, 10000);

    return () => clearInterval(simInterval);
  }, [isUsingDemo]);

  // Categories filtering for Channels section
  const handleCategorySelection = (cat: "all" | "sports" | "movies" | "news" | "entertainment") => {
    setActiveGridCategory(cat);
    // Smoothly scroll down directly to Section 2 (IPTV Channels Section)
    const element = document.getElementById("iptv-channels-grid");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Dynamically map and filter streams cleanly
  const filteredChannels = useMemo(() => {
    let list = [...channels];

    // Filter by text search if active
    if (searchQuery.trim()) {
      const term = searchQuery.toLowerCase();
      list = list.filter((c) =>
        c.name.toLowerCase().includes(term) ||
        (c.category && c.category.toLowerCase().includes(term))
      );
    }

    // Filter by category
    if (activeGridCategory !== "all") {
      list = list.filter((c) => {
        const catName = c.category?.toLowerCase() || "";
        const cName = c.name.toLowerCase();
        
        if (activeGridCategory === "sports") {
          return catName.includes("sport") || catName.includes("adventure") || cName.includes("sport") || cName.includes("red bull") || c.id.includes("redbull");
        }
        if (activeGridCategory === "movies") {
          return catName.includes("movie") || catName.includes("cinema") || catName.includes("space") || cName.includes("cinema") || cName.includes("movie") || c.id.includes("steel") || c.id.includes("sintel");
        }
        if (activeGridCategory === "news") {
          return catName.includes("news") || catName.includes("tech") || catName.includes("finance") || cName.includes("news") || c.id.includes("dw") || c.id.includes("france") || c.id.includes("jazeera");
        }
        if (activeGridCategory === "entertainment") {
          return catName.includes("audio") || catName.includes("music") || catName.includes("lofi") || catName.includes("ambient") || cName.includes("music") || cName.includes("lofi") || cName.includes("beat");
        }
        return true;
      });
    }

    return list;
  }, [channels, searchQuery, activeGridCategory]);

  // Fallback channels pool for empty states to keep visual presentation high and sturdy
  const displayChannels = useMemo(() => {
    if (filteredChannels.length > 0) return filteredChannels;

    // Fallback Mock channel mapping if list is empty for Category
    if (activeGridCategory === "sports") {
      const parent = channels[0];
      if (parent) {
        return [{
          ...parent,
          id: "sports-fallback-tv",
          name: "Sazi TV Action Sports Live Feed",
          category: "Live Sports",
          logo: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=300"
        }];
      }
    }
    if (activeGridCategory === "movies") {
      const parent = channels.find(c => c.id.includes("steel") || c.id.includes("sintel")) || channels[0];
      if (parent) {
        return [{
          ...parent,
          id: "movies-fallback-tv",
          name: "Sazi Cinematic Sci-Fi Stream",
          category: "Movies",
          logo: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=300"
        }];
      }
    }
    return filteredChannels;
  }, [channels, filteredChannels, activeGridCategory]);

  // Slices matches lists for Sections 1, 3, and 5
  // Scoreboard 1 (Live Scoreboard Section): Show only Live matches. If no live match is currently running, show top 3 fixtures.
  const liveSectionMatches = useMemo(() => {
    const live = matches.filter(m => m.status === "LIVE");
    if (live.length > 0) return live;
    return matches.slice(0, 3); // top 3 fallback
  }, [matches]);

  // Scoreboard 2 (Second Live Scoreboard): Show Scheduled/Upcoming fixtures (different slice/list)
  const scheduledSectionMatches = useMemo(() => {
    return matches.filter(m => m.status === "SCHEDULED");
  }, [matches]);

  // Scoreboard 3 (Third Live Scoreboard): Unified Global ledger (Full matches)
  const fullScoreboardMatches = useMemo(() => {
    return matches;
  }, [matches]);

  // Scoreboard Card Component (Renderer)
  const renderUnifiedScoreboardCard = (
    title: string,
    matchSubset: FootballMatch[],
    accentColor: "blue" | "green" = "blue",
    showCountdownBar = false
  ) => {
    const isBlue = accentColor === "blue";
    
    return (
      <div className={`relative bg-[#04040a] border border-zinc-900 rounded-2xl overflow-hidden shadow-[0_12px_45px_rgba(0,0,0,0.7)] group hover:border-${isBlue ? 'cyan' : 'emerald'}-500/20 transition-all duration-500`}>
        {/* Glow accent */}
        <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${isBlue ? 'from-cyan-500/50 via-blue-500/40 to-indigo-500/30' : 'from-emerald-500/50 via-teal-500/40 to-green-500/30'}`} />

        {/* Header styling */}
        <div className="bg-gradient-to-b from-[#080812] to-[#040409] px-5 py-4 border-b border-zinc-900 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border font-sans text-xs font-black ${isBlue ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}>
              <Trophy size={14} className={accentColor === "green" ? "animate-pulse" : ""} />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black font-mono uppercase tracking-widest text-slate-100 flex items-center gap-1.5">
                {title}
              </h3>
              <p className="text-[10px] text-zinc-500 font-mono tracking-wider">
                {isBlue ? "PREMIUM FIXTURES SERVICE" : "LIVE SCORE SYSTEM"} // LEVEL_10
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {showCountdownBar && (
              <div className="flex items-center gap-2 bg-emerald-950/20 border border-emerald-900/35 px-3 py-1 rounded-lg">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                <span className="text-[9px] font-mono font-bold text-emerald-400">
                  AUTO-UPDATE: {countdown}S
                </span>
              </div>
            )}
            
            <span className="text-[9px] font-mono tracking-wider text-zinc-650 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-900">
              {matchSubset.length} FIXTURES
            </span>
          </div>
        </div>

        {/* Matches Rows Stack inside ONE Single Container */}
        <div className="divide-y divide-zinc-950 bg-gradient-to-b from-[#040409]/60 to-[#020204]/90">
          {matchSubset.length === 0 ? (
            <div className="p-12 text-center text-zinc-550 flex flex-col items-center gap-2">
              <Info size={18} className="text-zinc-650" />
              <p className="text-xs uppercase font-bold tracking-wider">No active live feeds matches found</p>
              <p className="text-[10px] text-zinc-600">The IPTV league scheduler has no live matches registered currently.</p>
            </div>
          ) : (
            matchSubset.map((m) => {
              const isLive = m.status === "LIVE";
              const scoreHome = m.score.fullTime.home;
              const scoreAway = m.score.fullTime.away;
              const hasScore = scoreHome !== null && scoreAway !== null;

              return (
                <div
                  key={`${title}-${m.id}`}
                  className={`flex items-center justify-between gap-3 px-4 sm:px-6 py-4 hover:bg-zinc-900/25 transition-all duration-300 relative ${m.scoreChanged ? 'bg-emerald-950/10 border-y border-emerald-500/30' : ''}`}
                >
                  {/* Goal overlay blink */}
                  {m.scoreChanged && (
                    <div className="absolute inset-0 bg-emerald-950/30 backdrop-blur-xs flex items-center justify-center animate-pulse z-10 pointer-events-none">
                      <span className="text-emerald-400 font-mono font-black text-[10px] uppercase tracking-[0.2em] animate-bounce">
                        ⚽ SCORE UPDATE: GOAL SCORED!
                      </span>
                    </div>
                  )}

                  {/* League Emblem & Name */}
                  <div className="hidden md:flex items-center gap-2 w-1/5 shrink-0">
                    <img
                      src={m.competition.emblem}
                      className="w-4 h-4 object-contain opacity-75"
                      alt=""
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://crests.football-data.org/CL.png";
                      }}
                    />
                    <div className="truncate min-w-0">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide truncate block">
                        {m.competition.name}
                      </span>
                      <span className="text-[8px] font-mono text-zinc-600 truncate block">
                        {m.area.name}
                      </span>
                    </div>
                  </div>

                  {/* Competition short logo/tag on Mobile explicitly */}
                  <span className="md:hidden text-[9px] font-mono font-semibold bg-zinc-950 text-zinc-550 border border-zinc-900 px-1 py-0.5 rounded truncate max-w-[36px]">
                    {m.competition.code || "LIVE"}
                  </span>

                  {/* Scoreboard: Host Team name and crest */}
                  <div className="flex-1 flex items-center gap-2 min-w-0 justify-end text-right">
                    <span className="text-xs font-extrabold text-zinc-200 group-hover:text-white uppercase tracking-wider truncate sm:max-w-[130px] max-w-[70px]">
                      {m.homeTeam.shortName}
                    </span>
                    <img
                      src={m.homeTeam.crest}
                      className="w-5 h-5 object-contain shrink-0"
                      alt=""
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://crests.football-data.org/65.png";
                      }}
                    />
                  </div>

                  {/* Digital Live central score display */}
                  <div className="shrink-0 flex items-center justify-center">
                    {hasScore ? (
                      <div className="flex items-center gap-1 font-mono">
                        <span className={`text-xs px-2 py-1 bg-zinc-950 border border-zinc-850 rounded-lg text-white font-black shadow-sm ${m.scoreChanged ? 'text-emerald-400 border-emerald-500/20' : ''}`}>
                          {scoreHome}
                        </span>
                        <span className="text-zinc-700 text-xs font-bold">-</span>
                        <span className={`text-xs px-2 py-1 bg-zinc-950 border border-zinc-850 rounded-lg text-white font-black shadow-sm ${m.scoreChanged ? 'text-emerald-400 border-emerald-500/20' : ''}`}>
                          {scoreAway}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] font-extrabold tracking-widest text-[#00f0ff] bg-cyan-950/25 border border-cyan-500/20 px-2 py-1 rounded-md">
                        VS
                      </span>
                    )}
                  </div>

                  {/* Scoreboard: Guest Team crest and name */}
                  <div className="flex-1 flex items-center gap-2 min-w-0 text-left">
                    <img
                      src={m.awayTeam.crest}
                      className="w-5 h-5 object-contain shrink-0"
                      alt=""
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://crests.football-data.org/86.png";
                      }}
                    />
                    <span className="text-xs font-extrabold text-zinc-200 group-hover:text-white uppercase tracking-wider truncate sm:max-w-[130px] max-w-[70px]">
                      {m.awayTeam.shortName}
                    </span>
                  </div>

                  {/* Match status with glowing indicators on live */}
                  <div className="w-24 shrink-0 flex justify-end">
                    {isLive ? (
                      <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/30 px-2.5 py-0.5 rounded-lg text-[8px] font-black tracking-widest text-rose-450 uppercase animate-none shadow-[0_0_12px_rgba(244,63,94,0.15)]">
                        {/* Red pulsating live circle */}
                        <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping" />
                        <span className="font-mono text-rose-450 font-black">
                          {m.minute ? `${m.minute}'` : "LIVE"}
                        </span>
                      </div>
                    ) : m.status === "FINISHED" ? (
                      <span className="bg-zinc-950 border border-zinc-850 text-zinc-500 text-[8px] px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                        FT Match
                      </span>
                    ) : (
                      <span className="bg-cyan-950/20 border border-cyan-900/30 text-cyan-400 text-[8px] px-2 py-0.5 rounded font-mono font-black uppercase tracking-wider flex items-center gap-1">
                        <Calendar size={8} />
                        {new Date(m.utcDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer/Progress Countdown Strip */}
        {showCountdownBar && (
          <div className="h-1 bg-zinc-950 w-full overflow-hidden relative">
            <motion.div
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 30, ease: "linear" }}
              key={countdown}
              className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-emerald-500 to-teal-400"
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-12 pb-16 font-sans text-zinc-100 select-none">
      
      {/* HEADER GREETING & CONTEXT PANEL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-zinc-900 pb-6">
        <div>
          <div className="flex items-center gap-2 my-0.5">
            <span className="w-2 h-2 rounded-full bg-[#00f0ff] animate-ping" />
            <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-widest">
              SAZI TV IPTV BROADCAST CENTER
            </span>
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tight text-white mt-1">
            Welcome, <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00f0ff] via-cyan-400 to-[#10b981]">{userDisplayName}</span>!
          </h2>
          <p className="text-zinc-500 text-xs mt-1">
            Cohesive TV Sports Dashboard. Broadcast channels and live HLS match feeds synchronizing.
          </p>
        </div>

        {/* Global Search box */}
        <div className="relative w-full md:max-w-md">
          <input
            id="home-search-bar"
            type="text"
            placeholder="Search TV broadcasts, genres, or matches..."
            value={searchQuery}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#040409] text-white placeholder-zinc-550 border border-zinc-850 focus:border-cyan-500 focus:shadow-[0_0_15px_rgba(34,211,238,0.2)] rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-cyan-500/25 transition-all text-xs font-mono"
          />
          <Search className="absolute left-3.5 top-3 text-zinc-650" size={15} />
        </div>
      </div>

      {/* REPEATING SECTIONS */}

      {/* SECTION 1: LIVE SCOREBOARD SECTION (UNIFIED) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2.5 border-l-[3px] border-cyan-500 pl-3">
          <Zap className="text-cyan-400 animate-bounce" size={16} />
          <h2 className="text-xs sm:text-sm font-black font-mono tracking-widest text-zinc-100 uppercase">
            SECTION 1: LIVE COMPETITIVE FIRES // STADIUM NEWS
          </h2>
          <span className="animate-pulse w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e] ml-2" />
        </div>
        
        {renderUnifiedScoreboardCard(
          "UEFA CHAMPIONS LEAGUE & TOP LEAGUE - LIVE SCORE",
          liveSectionMatches,
          "blue"
        )}
      </div>

      {/* SECTION 2: CHANNEL SECTION (GRID OF BROADCASTERS) */}
      <div id="iptv-channels-grid" className="space-y-5 scroll-mt-24">
        <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
          <div className="flex items-center gap-2.5 border-l-[3px] border-emerald-500 pl-3">
            <Tv className="text-emerald-400" size={18} />
            <h2 className="text-xs sm:text-sm font-black font-mono tracking-widest text-zinc-100 uppercase">
              SECTION 2: SATELLITE IPTV CHANNELS CATALOG ({displayChannels.length})
            </h2>
          </div>
          {activeGridCategory !== "all" && (
            <button
              onClick={() => setActiveGridCategory("all")}
              className="text-[10px] font-mono text-cyan-400 border border-cyan-500/30 px-2.5 py-1 rounded bg-cyan-950/20 hover:bg-cyan-500 hover:text-black transition uppercase font-bold"
            >
              Reset Category filter [X]
            </button>
          )}
        </div>

        {/* Channels Grid */}
        <AnimatePresence mode="popLayout">
          {displayChannels.length > 0 ? (
            <motion.div
              layout
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6"
            >
              {displayChannels.map((chan) => {
                const isFav = favoritedIds.has(chan.id);
                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    key={chan.id}
                    id={`chan-card-${chan.id}`}
                    onClick={() => onSelectChannel(chan)}
                    className="group relative bg-[#05050b]/90 hover:bg-[#07070f] border border-zinc-850 hover:border-cyan-500/30 rounded-xl overflow-hidden transition-all duration-300 flex flex-col justify-between shadow-lg cursor-pointer hover:-translate-y-1.5 hover:shadow-[0_10px_35px_rgba(6,182,212,0.15)]"
                  >
                    {/* Live indicator top left */}
                    <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 bg-rose-600/95 text-[8px] font-black tracking-widest text-white px-2 py-0.5 rounded uppercase">
                      <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                      IPTV
                    </div>

                    {/* Bookmark Toggle */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(chan.id);
                      }}
                      className={`absolute top-2 right-2 z-20 p-1.5 rounded-lg border backdrop-blur-md transition-all hover:scale-105 active:scale-95 ${
                        isFav
                          ? "bg-amber-400/20 border-amber-400/40 text-amber-300 shadow"
                          : "bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-white"
                      }`}
                    >
                      <Star size={11} fill={isFav ? "currentColor" : "none"} />
                    </button>

                    {/* Card logo/ Crest frame */}
                    <div className="relative aspect-video bg-[#020204] flex items-center justify-center p-4">
                      <img
                        src={chan.logo || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200"}
                        alt={chan.name}
                        className="max-h-full max-w-full object-contain filter group-hover:brightness-110 group-hover:scale-105 transition-all duration-500"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200";
                        }}
                      />

                      {/* Hover Overlay Mask */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300">
                        <div className="w-10 h-10 rounded-full bg-[#00f0ff] text-zinc-950 flex items-center justify-center shadow-[0_0_15px_rgba(0,240,255,0.4)] transform scale-75 group-hover:scale-100 transition-all duration-300">
                          <Play fill="currentColor" size={15} className="ml-0.5" />
                        </div>
                      </div>
                    </div>

                    {/* Channel Description details block */}
                    <div className="p-3 bg-gradient-to-t from-zinc-950 via-zinc-950 to-[#07070f] border-t border-zinc-900 flex-1 flex flex-col justify-between gap-1.5">
                      <h4 className="text-xs font-extrabold text-zinc-200 group-hover:text-cyan-400 transition-colors line-clamp-1">
                        {chan.name}
                      </h4>
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-900/60 px-1.5 py-0.5 rounded border border-zinc-850 truncate max-w-[90px]">
                          {chan.category || "General"}
                        </span>
                        <span className="text-[8px] font-mono text-cyan-400">
                          {chan.views ? `${chan.views.toLocaleString()} VIEWS` : "ONLINE FEED"}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          ) : (
            <div className="bg-[#040409] border border-dashed border-zinc-850 p-12 text-center rounded-2xl">
              <p className="text-xs text-zinc-500 font-mono">No matching live streams registered under category selection.</p>
              <button
                onClick={() => setSearchTerm("")}
                className="mt-3 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] text-cyan-400 hover:bg-zinc-850 transition"
              >
                Clear search terms
              </button>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* SECTION 3: SECOND LIVE SCOREBOARD SECTION */}
      <div className="space-y-4">
        <div className="flex items-center gap-2.5 border-l-[3px] border-emerald-500 pl-3">
          <Calendar className="text-emerald-400" size={16} />
          <h2 className="text-xs sm:text-sm font-black font-mono tracking-widest text-zinc-100 uppercase">
            SECTION 3: ELITE EUROPEAN CUP CHAMPIONSHIP // LATER FIXTURES
          </h2>
          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] ml-2 animate-pulse" />
        </div>

        {renderUnifiedScoreboardCard(
          "UPCOMING CONTINENTAL CHAMPIONSHIPS FIXTURES",
          scheduledSectionMatches,
          "green"
        )}
      </div>

      {/* SECTION 4: CATEGORIES SECTION (CLICKABLE FILTER CARDS) */}
      <div className="space-y-5">
        <div className="flex items-center gap-2.5 border-l-[3px] border-cyan-500 pl-3">
          <Filter className="text-cyan-400" size={16} />
          <h2 className="text-xs sm:text-sm font-black font-mono tracking-widest text-zinc-100 uppercase">
            SECTION 4: CHOOSE BY CATEGORY DEEP GENRES
          </h2>
        </div>

        {/* Grid layout of categories filter cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {/* Sports */}
          <div
            onClick={() => handleCategorySelection("sports")}
            className={`cursor-pointer rounded-2xl p-5 border transition-all duration-300 relative overflow-hidden group flex flex-col justify-between aspect-video ${
              activeGridCategory === "sports"
                ? "bg-emerald-950/20 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                : "bg-[#04040a] border-zinc-850 hover:border-emerald-500/30"
            }`}
          >
            <div className={`p-2.5 rounded-xl shrink-0 absolute right-4 top-4 border transition-all ${activeGridCategory === "sports" ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-zinc-950 text-zinc-550 border-zinc-900 group-hover:text-emerald-400 group-hover:border-emerald-500/20'}`}>
              <Flame size={20} />
            </div>
            <div className="space-y-1 pt-12">
              <span className="text-[8px] font-mono font-bold text-emerald-450 tracking-widest uppercase">CAT_01</span>
              <h4 className="text-sm font-extrabold text-slate-100 uppercase tracking-widest">Live Sports</h4>
              <p className="text-[10px] text-zinc-500 leading-tight">Extreme, Red Bull, football broadcasts.</p>
            </div>
          </div>

          {/* Movies */}
          <div
            onClick={() => handleCategorySelection("movies")}
            className={`cursor-pointer rounded-2xl p-5 border transition-all duration-300 relative overflow-hidden group flex flex-col justify-between aspect-video ${
              activeGridCategory === "movies"
                ? "bg-purple-950/20 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.15)]"
                : "bg-[#04040a] border-zinc-850 hover:border-purple-500/30"
            }`}
          >
            <div className={`p-2.5 rounded-xl shrink-0 absolute right-4 top-4 border transition-all ${activeGridCategory === "movies" ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' : 'bg-zinc-950 text-zinc-550 border-zinc-900 group-hover:text-purple-400 group-hover:border-purple-500/20'}`}>
              <Film size={20} />
            </div>
            <div className="space-y-1 pt-12">
              <span className="text-[8px] font-mono font-bold text-purple-450 tracking-widest uppercase">CAT_02</span>
              <h4 className="text-sm font-extrabold text-slate-100 uppercase tracking-widest">Movies & Cinema</h4>
              <p className="text-[10px] text-zinc-500 leading-tight">Cinematic Sintel, HLS science projects.</p>
            </div>
          </div>

          {/* News */}
          <div
            onClick={() => handleCategorySelection("news")}
            className={`cursor-pointer rounded-2xl p-5 border transition-all duration-300 relative overflow-hidden group flex flex-col justify-between aspect-video ${
              activeGridCategory === "news"
                ? "bg-cyan-950/20 border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.15)]"
                : "bg-[#04040a] border-zinc-850 hover:border-cyan-500/30"
            }`}
          >
            <div className={`p-2.5 rounded-xl shrink-0 absolute right-4 top-4 border transition-all ${activeGridCategory === "news" ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' : 'bg-zinc-950 text-zinc-550 border-zinc-900 group-hover:text-cyan-400 group-hover:border-cyan-500/20'}`}>
              <Globe size={20} />
            </div>
            <div className="space-y-1 pt-12">
              <span className="text-[8px] font-mono font-bold text-cyan-450 tracking-widest uppercase">CAT_03</span>
              <h4 className="text-sm font-extrabold text-slate-100 uppercase tracking-widest">World News</h4>
              <p className="text-[10px] text-zinc-500 leading-tight">France 24, Bloomberg, global broadcasts.</p>
            </div>
          </div>

          {/* Entertainment */}
          <div
            onClick={() => handleCategorySelection("entertainment")}
            className={`cursor-pointer rounded-2xl p-5 border transition-all duration-300 relative overflow-hidden group flex flex-col justify-between aspect-video ${
              activeGridCategory === "entertainment"
                ? "bg-pink-950/20 border-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.15)]"
                : "bg-[#04040a] border-zinc-850 hover:border-pink-500/30"
            }`}
          >
            <div className={`p-2.5 rounded-xl shrink-0 absolute right-4 top-4 border transition-all ${activeGridCategory === "entertainment" ? 'bg-pink-500/10 text-pink-400 border-pink-500/30' : 'bg-zinc-950 text-zinc-550 border-zinc-900 group-hover:text-pink-400 group-hover:border-pink-500/20'}`}>
              <Volume2 size={20} />
            </div>
            <div className="space-y-1 pt-12">
              <span className="text-[8px] font-mono font-bold text-pink-450 tracking-widest uppercase">CAT_04</span>
              <h4 className="text-sm font-extrabold text-slate-100 uppercase tracking-widest">Entertainment</h4>
              <p className="text-[10px] text-zinc-500 leading-tight">Ambient music, lofi beats, and channels.</p>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 5: LIVE SCOREBOARD SECTION (3RD REPEATING SECTION - WITH AUTO-REFRESH) */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center gap-2.5 border-l-[3px] border-cyan-500 pl-3">
          <Clock className="text-cyan-400" size={16} />
          <h2 className="text-xs sm:text-sm font-black font-mono tracking-widest text-zinc-100 uppercase">
            SECTION 5: INTEGRAL SOCCER FEED ticker // SECONDS RADIAL SYNC
          </h2>
          <span className="text-[9px] font-mono font-bold bg-cyan-950 text-cyan-400 border border-cyan-900 px-2 py-0.5 rounded ml-2 uppercase">
            TICKING countdown: 30S
          </span>
        </div>

        {renderUnifiedScoreboardCard(
          "GLOBAL MATCHDAY STANDINGS - LIVE RUNTIME SYNC",
          fullScoreboardMatches,
          "blue",
          true // Displays 30s auto-refresh animated bar strip!
        )}
      </div>

    </div>
  );
}
