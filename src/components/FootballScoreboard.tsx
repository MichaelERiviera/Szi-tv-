import { useState, useEffect, useRef } from "react";
import {
  Trophy,
  Activity,
  Flame,
  Globe,
  Clock,
  Search,
  RefreshCw,
  AlertTriangle,
  Settings,
  X,
  Plus,
  Play,
  Check,
  AlertCircle
} from "lucide-react";

// Types matching the football-data.org API + adding simulated properties
export interface FootballMatch {
  id: number;
  utcDate: string;
  status: "LIVE" | "IN_PLAY" | "PAUSED" | "FINISHED" | "TIMED" | "SCHEDULED";
  minute?: number; // active minute of play
  competition: {
    id: number;
    name: string;
    code: string;
    emblem: string;
  };
  area: {
    name: string;
    code: string;
    flag: string;
  };
  homeTeam: {
    id: number;
    name: string;
    shortName: string;
    tla: string;
    crest: string;
  };
  awayTeam: {
    id: number;
    name: string;
    shortName: string;
    tla: string;
    crest: string;
  };
  score: {
    winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    duration: string;
    fullTime: {
      home: number | null;
      away: number | null;
    };
  };
  events?: {
    minute: number;
    type: "GOAL" | "RED_CARD" | "YELLOW_CARD" | "SUBSTITUTION";
    team: "home" | "away";
    player: string;
  }[];
  scoreChanged?: boolean; // triggering green flashing border
  lastGoalTeam?: "home" | "away";
}

// Initial realistic simulated database for fallback/enrichment play
const SIMULATED_MATCHES: FootballMatch[] = [
  {
    id: 10001,
    utcDate: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // started 45 mins ago
    status: "LIVE",
    minute: 48,
    competition: { id: 2001, name: "Champions League", code: "CL", emblem: "https://crests.football-data.org/CL.png" },
    area: { name: "Europe", code: "EUR", flag: "https://crests.football-data.org/74.svg" },
    homeTeam: { id: 65, name: "Manchester City FC", shortName: "Man City", tla: "MCI", crest: "https://crests.football-data.org/65.png" },
    awayTeam: { id: 86, name: "Real Madrid CF", shortName: "Real Madrid", tla: "RMA", crest: "https://crests.football-data.org/86.png" },
    score: { winner: null, duration: "REGULAR", fullTime: { home: 1, away: 1 } },
    events: [
      { minute: 18, type: "GOAL", team: "away", player: "Vinícius Júnior" },
      { minute: 34, type: "YELLOW_CARD", team: "home", player: "Rúben Dias" },
      { minute: 41, type: "GOAL", team: "home", player: "Erling Haaland" }
    ]
  },
  {
    id: 10002,
    utcDate: new Date(Date.now() - 75 * 60 * 1000).toISOString(), // started 75 mins ago
    status: "LIVE",
    minute: 78,
    competition: { id: 2001, name: "Champions League", code: "CL", emblem: "https://crests.football-data.org/CL.png" },
    area: { name: "Europe", code: "EUR", flag: "https://crests.football-data.org/74.svg" },
    homeTeam: { id: 57, name: "Arsenal FC", shortName: "Arsenal", tla: "ARS", crest: "https://crests.football-data.org/57.png" },
    awayTeam: { id: 5, name: "FC Bayern München", shortName: "Bayern", tla: "FCB", crest: "https://crests.football-data.org/5.png" },
    score: { winner: null, duration: "REGULAR", fullTime: { home: 2, away: 3 } },
    events: [
      { minute: 12, type: "GOAL", team: "home", player: "Bukayo Saka" },
      { minute: 28, type: "GOAL", team: "away", player: "Harry Kane" },
      { minute: 45, type: "GOAL", team: "away", player: "Leroy Sané" },
      { minute: 61, type: "GOAL", team: "home", player: "Martin Ødegaard" },
      { minute: 72, type: "GOAL", team: "away", player: "Jamal Musiala" }
    ]
  },
  {
    id: 10003,
    utcDate: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // started 10 mins ago
    status: "LIVE",
    minute: 12,
    competition: { id: 2021, name: "Premier League", code: "PL", emblem: "https://crests.football-data.org/PL.png" },
    area: { name: "England", code: "ENG", flag: "https://crests.football-data.org/770.svg" },
    homeTeam: { id: 64, name: "Liverpool FC", shortName: "Liverpool", tla: "LIV", crest: "https://crests.football-data.org/64.png" },
    awayTeam: { id: 61, name: "Chelsea FC", shortName: "Chelsea", tla: "CHE", crest: "https://crests.football-data.org/61.png" },
    score: { winner: null, duration: "REGULAR", fullTime: { home: 0, away: 0 } },
    events: []
  },
  {
    id: 10004,
    utcDate: new Date(Date.now() - 120 * 60 * 1000).toISOString(), // finished recently
    status: "FINISHED",
    competition: { id: 2014, name: "La Liga", code: "PD", emblem: "https://crests.football-data.org/PD.png" },
    area: { name: "Spain", code: "ESP", flag: "https://crests.football-data.org/760.svg" },
    homeTeam: { id: 78, name: "Club Atlético de Madrid", shortName: "Atleti", tla: "ATM", crest: "https://crests.football-data.org/78.png" },
    awayTeam: { id: 81, name: "FC Barcelona", shortName: "Barcelona", tla: "FCB", crest: "https://crests.football-data.org/81.png" },
    score: { winner: "AWAY_TEAM", duration: "REGULAR", fullTime: { home: 1, away: 2 } },
    events: [
      { minute: 22, type: "GOAL", team: "home", player: "Antoine Griezmann" },
      { minute: 55, type: "GOAL", team: "away", player: "Robert Lewandowski" },
      { minute: 82, type: "GOAL", team: "away", player: "Raphinha" },
      { minute: 89, type: "RED_CARD", team: "home", player: "Koke" }
    ]
  },
  {
    id: 10005,
    utcDate: new Date(Date.now() - 300 * 60 * 1000).toISOString(), // older finished
    status: "FINISHED",
    competition: { id: 2019, name: "Serie A", code: "SA", emblem: "https://crests.football-data.org/SA.png" },
    area: { name: "Italy", code: "ITA", flag: "https://crests.football-data.org/784.svg" },
    homeTeam: { id: 98, name: "AC Milan", shortName: "Milan", tla: "MIL", crest: "https://crests.football-data.org/98.png" },
    awayTeam: { id: 108, name: "FC Internazionale Milano", shortName: "Inter", tla: "INT", crest: "https://crests.football-data.org/108.png" },
    score: { winner: "HOME_TEAM", duration: "REGULAR", fullTime: { home: 3, away: 1 } },
    events: [
      { minute: 8, type: "GOAL", team: "home", player: "Rafael Leão" },
      { minute: 40, type: "GOAL", team: "away", player: "Lautaro Martínez" },
      { minute: 58, type: "GOAL", team: "home", player: "Olivier Giroud" },
      { minute: 85, type: "GOAL", team: "home", player: "Rafael Leão" }
    ]
  },
  {
    id: 10006,
    utcDate: new Date(Date.now() + 120 * 60 * 1000).toISOString(), // starts in 2 hours
    status: "SCHEDULED",
    competition: { id: 2019, name: "Serie A", code: "SA", emblem: "https://crests.football-data.org/SA.png" },
    area: { name: "Italy", code: "ITA", flag: "https://crests.football-data.org/784.svg" },
    homeTeam: { id: 109, name: "Juventus FC", shortName: "Juventus", tla: "JUV", crest: "https://crests.football-data.org/109.png" },
    awayTeam: { id: 113, name: "SSC Napoli", shortName: "Napoli", tla: "NAP", crest: "https://crests.football-data.org/113.png" },
    score: { winner: null, duration: "REGULAR", fullTime: { home: null, away: null } },
    events: []
  },
  {
    id: 10007,
    utcDate: new Date(Date.now() + 360 * 60 * 1000).toISOString(), // starts in 6 hours
    status: "SCHEDULED",
    competition: { id: 2002, name: "Bundesliga", code: "BL1", emblem: "https://crests.football-data.org/BL1.png" },
    area: { name: "Germany", code: "GER", flag: "https://crests.football-data.org/759.svg" },
    homeTeam: { id: 4, name: "Borussia Dortmund", shortName: "Dortmund", tla: "BVB", crest: "https://crests.football-data.org/4.png" },
    awayTeam: { id: 3, name: "Bayer 04 Leverkusen", shortName: "Leverkusen", tla: "B04", crest: "https://crests.football-data.org/3.png" },
    score: { winner: null, duration: "REGULAR", fullTime: { home: null, away: null } },
    events: []
  },
  {
    id: 10008,
    utcDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // starts tomorrow
    status: "SCHEDULED",
    competition: { id: 2015, name: "Ligue 1", code: "FL1", emblem: "https://crests.football-data.org/FL1.png" },
    area: { name: "France", code: "FRA", flag: "https://crests.football-data.org/773.svg" },
    homeTeam: { id: 524, name: "Paris Saint-Germain FC", shortName: "PSG", tla: "PSG", crest: "https://crests.football-data.org/524.png" },
    awayTeam: { id: 516, name: "Olympique de Marseille", shortName: "Marseille", tla: "OM", crest: "https://crests.football-data.org/516.png" },
    score: { winner: null, duration: "REGULAR", fullTime: { home: null, away: null } },
    events: []
  }
];

export default function FootballScoreboard() {
  const [matches, setMatches] = useState<FootballMatch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "LIVE" | "FINISHED" | "SCHEDULED">("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  // Custom API Token config
  const [apiToken, setApiToken] = useState<string>(() => {
    return localStorage.getItem("sazi_tv_soccer_api_token") || "";
  });
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [isUsingDemo, setIsUsingDemo] = useState<boolean>(true);
  
  // Custom proxy toggle (since football-data.org doesn't allow direct client requests due to CORS)
  const [useProxy, setUseProxy] = useState<boolean>(true);

  // Auto-refresh timer ring countdown
  const [countdown, setCountdown] = useState<number>(30);

  // Ref to track matches to calculate goals and trigger pulse alerts
  const matchesRef = useRef<FootballMatch[]>([]);

  // Fetch from football-data API
  const fetchFootballData = async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    setIsRefreshing(true);

    const targetUrl = "https://api.football-data.org/v4/matches";
    
    // Cloudflare Page environment variables can contain VITE_FOOTBALL_API_KEY
    const activeToken = apiToken || (import.meta as any).env?.VITE_FOOTBALL_API_KEY || "";
    
    if (!activeToken) {
      // Fallback seamlessly to simulated mock data if there's no API Token defined
      loadSimulatedData();
      setIsRefreshing(false);
      setLoading(false);
      setIsUsingDemo(true);
      return;
    }

    try {
      // Build fetch request with CORS bypass proxy if requested
      const requestUrl = useProxy 
        ? `/api/proxy?url=${encodeURIComponent(targetUrl)}`
        : targetUrl;

      const headers: Record<string, string> = {
        "X-Auth-Token": activeToken,
      };

      const response = await fetch(requestUrl, {
        method: "GET",
        headers: headers,
      });

      if (!response.ok) {
        throw new Error(`API returned HTTP status ${response.status}`);
      }

      const data = await response.json();
      
      if (data && Array.isArray(data.matches)) {
        processAndFilterApiData(data.matches);
        setIsUsingDemo(false);
        setError(null);
      } else {
        throw new Error("Invalid football-data response format");
      }
    } catch (err: any) {
      console.warn("Football-data fetch failed. Initiating high-fidelity Sazi TV Live Simulator...", err);
      // Give a neat small warning but fall back immediately so user gets an outstanding UI
      setError(`Failed to fetch from football-data.org (${err.message || err.toString()}). Displaying Sazi TV Live Matchday Simulator!`);
      loadSimulatedData();
      setIsUsingDemo(true);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
      setLastUpdated(new Date());
      setCountdown(30);
    }
  };

  // Maps live API statuses to simplified UI statuses
  const processAndFilterApiData = (apiMatches: any[]) => {
    const formatted: FootballMatch[] = apiMatches.map((m: any) => {
      // Map statuses
      let status: "LIVE" | "FINISHED" | "SCHEDULED" = "SCHEDULED";
      if (["IN_PLAY", "LIVE", "PAUSED"].includes(m.status)) {
        status = "LIVE";
      } else if (m.status === "FINISHED") {
        status = "FINISHED";
      }

      return {
        id: m.id,
        utcDate: m.utcDate,
        status: status,
        minute: m.status === "PAUSED" ? 45 : (m.status === "IN_PLAY" ? 70 : undefined), // placeholder minute
        competition: {
          id: m.competition.id,
          name: m.competition.name,
          code: m.competition.code,
          emblem: m.competition.emblem || "https://crests.football-data.org/CL.png"
        },
        area: {
          name: m.area.name,
          code: m.area.code,
          flag: m.area.flag || "https://crests.football-data.org/74.svg"
        },
        homeTeam: {
          id: m.homeTeam.id,
          name: m.homeTeam.name,
          shortName: m.homeTeam.shortName || m.homeTeam.name,
          tla: m.homeTeam.tla || m.homeTeam.name.substring(0,3).toUpperCase(),
          crest: m.homeTeam.crest || "https://crests.football-data.org/65.png"
        },
        awayTeam: {
          id: m.awayTeam.id,
          name: m.awayTeam.name,
          shortName: m.awayTeam.shortName || m.awayTeam.name,
          tla: m.awayTeam.tla || m.awayTeam.name.substring(0,3).toUpperCase(),
          crest: m.awayTeam.crest || "https://crests.football-data.org/86.png"
        },
        score: {
          winner: m.score.winner,
          duration: m.score.duration || "REGULAR",
          fullTime: {
            home: m.score.fullTime?.home !== undefined ? m.score.fullTime.home : null,
            away: m.score.fullTime?.away !== undefined ? m.score.fullTime.away : null
          }
        },
        events: []
      };
    });

    setMatches(formatted);
    matchesRef.current = formatted;
  };

  // Simulator Engine (Simulates actual matches updating live)
  const loadSimulatedData = () => {
    // Check if matches already initialized in ref
    if (matchesRef.current.length === 0) {
      setMatches(SIMULATED_MATCHES);
      matchesRef.current = JSON.parse(JSON.stringify(SIMULATED_MATCHES));
    } else {
      setMatches(matchesRef.current);
    }
  };

  // Run dynamic ticker for minutes and random goals in Simulation/Demo mode
  const runSimulatorTransitions = () => {
    if (!isUsingDemo) return;

    let goalsTriggered: { matchId: number; team: "home" | "away"; player: string; newScore: string }[] = [];

    const updated = matchesRef.current.map((match) => {
      // Create clone
      const m = { ...match };
      m.scoreChanged = false;

      if (m.status === "LIVE") {
        // 1. Tick up minute
        if (m.minute !== undefined) {
          m.minute += 1;
          if (m.minute > 90) {
            m.status = "FINISHED";
            m.score.winner = m.score.fullTime.home! > m.score.fullTime.away! 
              ? "HOME_TEAM" 
              : m.score.fullTime.home! < m.score.fullTime.away! ? "AWAY_TEAM" : "DRAW";
          }
        } else {
          m.minute = 1;
        }

        // 2. High-adrenaline 1% chance of a Goal occurring per tick (highly engaging!)
        const goalOdds = Math.random();
        if (goalOdds > 0.95) {
          const teamScoring = Math.random() > 0.5 ? "home" : "away";
          const scoringName = teamScoring === "home" ? m.homeTeam.name : m.awayTeam.name;
          const scoringTLA = teamScoring === "home" ? m.homeTeam.tla : m.awayTeam.tla;
          
          if (teamScoring === "home" && m.score.fullTime.home !== null) {
            m.score.fullTime.home += 1;
            m.scoreChanged = true;
            m.lastGoalTeam = "home";
          } else if (teamScoring === "away" && m.score.fullTime.away !== null) {
            m.score.fullTime.away += 1;
            m.scoreChanged = true;
            m.lastGoalTeam = "away";
          }

          const players = teamScoring === "home" 
            ? ["Foden", "De Bruyne", "Saka", "Salah", "Leão", "Ødegaard", "Vlahović"]
            : ["Bellingham", "Mbappé", "Vinícius", "Musiala", "Kane", "Gavi", "Lautaro"];
          const randomPlayer = players[Math.floor(Math.random() * players.length)];

          if (!m.events) m.events = [];
          m.events.unshift({
            minute: m.minute || 45,
            type: "GOAL",
            team: teamScoring,
            player: randomPlayer
          });

          goalsTriggered.push({
            matchId: m.id,
            team: teamScoring,
            player: randomPlayer,
            newScore: `${m.score.fullTime.home} - ${m.score.fullTime.away}`
          });
        }

        // 3. Rare 1.5% odds of yellow / red cards
        const cardOdds = Math.random();
        if (cardOdds > 0.985) {
          const teamCard = Math.random() > 0.5 ? "home" : "away";
          const type = Math.random() > 0.85 ? "RED_CARD" as const : "YELLOW_CARD" as const;
          const players = teamCard === "home" 
            ? ["Dias", "Saliba", "Rice", "Rodri", "Hernandez"]
            : ["Rudiger", "Carvajal", "Kimmich", "Upamecano", "Acerbi"];
          const randomPlayer = players[Math.floor(Math.random() * players.length)];
          
          if (!m.events) m.events = [];
          m.events.unshift({
            minute: m.minute || 45,
            type: type,
            team: teamCard,
            player: randomPlayer
          });
        }
      }
      return m;
    });

    matchesRef.current = updated;
    setMatches(updated);
    setLastUpdated(new Date());

    // Flash custom dynamic notifications for goal events
    if (goalsTriggered.length > 0) {
      goalsTriggered.forEach(g => {
        console.log(`⚽ SCORE ALERT: Goal scored by ${g.player}! New score: ${g.newScore}`);
      });
    }
  };

  // Countdown auto-refresh ticker (runs every second)
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Trigger refresh automatically
          fetchFootballData(true);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(clockInterval);
  }, [apiToken, useProxy, isUsingDemo]);

  // Periodic simulator updates ticker (runs every 15 seconds)
  useEffect(() => {
    const simInterval = setInterval(() => {
      runSimulatorTransitions();
    }, 15000);

    return () => clearInterval(simInterval);
  }, [isUsingDemo]);

  // Initial load
  useEffect(() => {
    fetchFootballData();
  }, []);

  // Handle Token inputs
  const saveTokenValue = (token: string) => {
    setApiToken(token);
    localStorage.setItem("sazi_tv_soccer_api_token", token);
    setShowConfig(false);
    // Restart fetch
    setTimeout(() => {
      fetchFootballData();
    }, 100);
  };

  const removeToken = () => {
    setApiToken("");
    localStorage.removeItem("sazi_tv_soccer_api_token");
    setIsUsingDemo(true);
    setError(null);
    loadSimulatedData();
    setCountdown(30);
  };

  // Computed / Filtered matches for lists
  const filteredMatches = matches.filter((match) => {
    // 1. Text Search Filter matches
    const searchMatch = 
      match.homeTeam.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      match.awayTeam.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      match.competition.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      match.area.name.toLowerCase().includes(searchQuery.toLowerCase());

    if (!searchMatch) return false;

    // 2. Tab Category Filter matches
    if (filter === "ALL") return true;
    return match.status === filter;
  });

  // Calculate live count totals
  const liveCount = matches.filter((m) => m.status === "LIVE").length;
  const finishedCount = matches.filter((m) => m.status === "FINISHED").length;
  const scheduledCount = matches.filter((m) => m.status === "SCHEDULED").length;

  return (
    <div id="football-scoreboard" className="bg-[#050508] border border-zinc-850 rounded-2xl p-4 md:p-6 shadow-[0_12px_40px_rgba(0,0,0,0.5)] relative overflow-hidden transition-all">
      {/* Radiant visual ambient backdrops */}
      <div className="absolute -left-16 -top-16 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -right-16 -bottom-16 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

      {/* Title block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-5 mb-5 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/35 rounded-xl flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)] animate-none">
            <Trophy size={20} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-md font-black tracking-widest text-white uppercase sm:text-lg">
                SAZI TV <span className="text-cyan-400">LIVE</span> MATCHES
              </h2>
              {isUsingDemo && (
                <span className="text-[9px] font-mono tracking-wider text-emerald-400 font-bold bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-900/30">
                  DEMO LIVE FEED
                </span>
              )}
            </div>
            <p className="text-[10px] tracking-wide text-zinc-450 uppercase font-bold mt-1">
              Active sports feeds // Auto-updating countdown: <span className="text-cyan-400 font-mono font-black">{countdown}s</span>
            </p>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Settings panel trigger */}
          <button
            type="button"
            id="scoreboard-config-btn"
            onClick={() => setShowConfig(!showConfig)}
            className={`p-2 rounded-xl border flex items-center justify-center gap-1.5 transition-all text-xs font-bold cursor-pointer backdrop-blur-md ${
              showConfig 
                ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/40" 
                : apiToken 
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                  : "bg-zinc-900 border-zinc-800 text-zinc-455 hover:text-zinc-200 hover:border-zinc-700"
            }`}
            title="Configure Football API Key"
          >
            <Settings size={14} className={isRefreshing ? "animate-spin" : ""} />
            <span className="hidden sm:inline">{apiToken ? "API Configured" : "Football API Setup"}</span>
          </button>

          {/* Quick manual refresh */}
          <button
            type="button"
            id="scoreboard-refresh-btn"
            onClick={() => fetchFootballData()}
            disabled={isRefreshing}
            className="p-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-750 transition-all rounded-xl flex items-center justify-center gap-1.5 cursor-pointer text-xs font-bold disabled:opacity-50"
          >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
            <span>Fetch Matches</span>
          </button>
        </div>
      </div>

      {/* Collision Alert Banner for Errors or API Token setup */}
      {showConfig && (
        <div className="mb-6 bg-zinc-950 border border-zinc-800 p-4 rounded-xl relative z-20 shadow-xl">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Settings className="text-cyan-400" size={16} />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Football-Data.org Integrations</h4>
            </div>
            <button
              onClick={() => setShowConfig(false)}
              className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
          
          <p className="text-[11px] text-zinc-400 leading-relaxed mb-4">
            Input your personal API token from <a href="https://www.football-data.org/" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">football-data.org</a> to sync professional real World Champions League, Premier League, and La Liga matches! Without a token, we fallback to our state-of-the-art interactive live matches simulation.
          </p>

          <form onSubmit={(e) => {
            e.preventDefault();
            const input = (e.currentTarget.elements.namedItem("authToken") as HTMLInputElement).value;
            saveTokenValue(input.trim());
          }} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="authToken" className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">API Authentication Token (X-Auth-Token)</label>
              <div className="flex gap-2">
                <input
                  id="authToken"
                  name="authToken"
                  type="password"
                  placeholder="Paste your 32-character token here..."
                  defaultValue={apiToken}
                  className="flex-1 bg-zinc-900 text-white placeholder-zinc-650 border border-zinc-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-400 hover:bg-cyan-300 text-zinc-950 font-bold text-xs rounded-xl transition-all shadow-[0_0_15px_rgba(34,211,238,0.2)] cursor-pointer"
                >
                  Connect API
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-zinc-900 text-[10px] text-zinc-450 hover:text-zinc-350">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useProxy}
                    onChange={(e) => setUseProxy(e.target.checked)}
                    className="accent-cyan-500"
                  />
                  <span>Bypass client CORS Blocks</span>
                </label>
              </div>

              {apiToken && (
                <button
                  type="button"
                  onClick={removeToken}
                  className="text-rose-400 hover:underline font-semibold cursor-pointer"
                >
                  Unlink Token & Use Simulator
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Error Output Indicator */}
      {error && !apiToken && (
        <div className="mb-4 bg-rose-950/20 border border-rose-900/40 rounded-xl p-3 flex items-start gap-2.5 text-rose-300 text-[11px]">
          <AlertCircle className="shrink-0 mt-0.5 text-rose-450" size={14} />
          <div className="flex-1">
            <span className="font-extrabold block mb-0.5">Foot-Data Sync issue:</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Search and Tab Filter Nav Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-6 relative z-10">
        
        {/* Tab Filters */}
        <div className="flex items-center flex-wrap gap-1 p-1 bg-zinc-950 border border-zinc-850 rounded-xl self-start overflow-hidden">
          <button
            onClick={() => setFilter("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filter === "ALL"
                ? "bg-zinc-900 border border-zinc-800 text-white shadow-md"
                : "text-zinc-450 hover:text-zinc-300"
            }`}
          >
            All matches <span className="opacity-50 ml-1 font-mono font-normal">({matches.length})</span>
          </button>
          
          <button
            onClick={() => setFilter("LIVE")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              filter === "LIVE"
                ? "bg-rose-500/10 border border-rose-500/20 text-rose-400 shadow-md"
                : "text-zinc-450 hover:text-zinc-300"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping shrink-0" />
            Live scoreboard <span className="opacity-50 ml-1 font-mono font-normal">({liveCount})</span>
          </button>
          
          <button
            onClick={() => setFilter("FINISHED")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filter === "FINISHED"
                ? "bg-zinc-900 border border-zinc-800 text-zinc-300 shadow-md"
                : "text-zinc-450 hover:text-zinc-300"
            }`}
          >
            Finished <span className="opacity-50 ml-1 font-mono font-normal">({finishedCount})</span>
          </button>
          
          <button
            onClick={() => setFilter("SCHEDULED")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filter === "SCHEDULED"
                ? "bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 shadow-md"
                : "text-zinc-450 hover:text-zinc-300"
            }`}
          >
            Scheduled <span className="opacity-50 ml-1 font-mono font-normal">({scheduledCount})</span>
          </button>
        </div>

        {/* Small inline search filter filter */}
        <div className="relative flex-1 md:max-w-xs">
          <input
            type="text"
            placeholder="Filter teams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-950 text-xs placeholder-zinc-600 border border-zinc-850 focus:border-cyan-500 rounded-xl py-2 pl-8 pr-3 focus:outline-none transition-all"
          />
          <Search className="absolute left-2.5 top-2.5 text-zinc-650" size={13} />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2.5 text-zinc-550 hover:text-zinc-300 cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Main Scoreboard Cards Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <RefreshCw className="animate-spin text-cyan-400" size={24} />
          <p className="text-zinc-500 font-mono text-[10px] uppercase font-bold tracking-widest animate-pulse">Syncing Soccer Database...</p>
        </div>
      ) : filteredMatches.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 relative z-10">
          {filteredMatches.map((match) => {
            const isLive = match.status === "LIVE" || match.status === "IN_PLAY" || match.status === "PAUSED";
            const scoreHome = match.score.fullTime.home;
            const scoreAway = match.score.fullTime.away;
            const hasScore = scoreHome !== null && scoreAway !== null;

            // Compute unique score changed border highlights
            const customBorderHighlight = match.scoreChanged
              ? "border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
              : isLive
                ? "border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.15)] bg-[#0c0406]/80 hover:bg-[#120609]/90 hover:border-rose-500"
                : "border-zinc-850 hover:border-zinc-750 bg-zinc-900/35 hover:bg-zinc-900/70";

            return (
              <div
                key={match.id}
                className={`relative border rounded-xl overflow-hidden p-4 group transition-all duration-300 flex flex-col justify-between ${customBorderHighlight}`}
              >
                {/* Goalscorer Alert micro indicator */}
                {match.scoreChanged && (
                  <div className="absolute inset-0 bg-emerald-950/25 backdrop-blur-xs flex flex-col items-center justify-center z-20 animate-fade-in pointer-events-none text-center">
                    <span className="text-emerald-400 font-black text-sm tracking-widest uppercase animate-bounce">
                      ⚽ GOAL !
                    </span>
                    <span className="text-white text-[10px] font-bold">
                      Score Updated: {scoreHome} - {scoreAway}
                    </span>
                  </div>
                )}

                {/* Card Header (Competition Details) */}
                <div className="flex items-center justify-between border-b border-zinc-900/60 pb-3.5 mb-3.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={match.competition.emblem}
                      alt={match.competition.name}
                      className="w-4 h-4 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://crests.football-data.org/CL.png";
                      }}
                    />
                    <div className="truncate">
                      <span className="text-[10px] font-bold text-zinc-300 group-hover:text-cyan-400 transition-colors uppercase tracking-wider block">
                        {match.competition.name}
                      </span>
                      <span className="text-[8px] font-mono font-medium text-zinc-550 flex items-center gap-1">
                        <Globe size={8} /> {match.area.name}
                      </span>
                    </div>
                  </div>

                  {/* Red/Green Status Tag */}
                  <div>
                    {isLive ? (
                      <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/35 px-2 py-0.5 rounded-md">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                        <span className="text-[8px] font-black tracking-widest text-rose-400 font-mono uppercase">
                          LIVE {match.minute ? `${match.minute}'` : ""}
                        </span>
                      </div>
                    ) : match.status === "FINISHED" ? (
                      <div className="bg-zinc-950 border border-zinc-800 px-2 py-0.5 rounded-md">
                        <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest font-mono">
                          FT Match
                        </span>
                      </div>
                    ) : (
                      <div className="bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded-md flex items-center gap-1 text-[8px] font-bold text-cyan-400 font-mono uppercase">
                        <Clock size={8} />
                        <span>
                          {new Date(match.utcDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Scoreboard block */}
                <div className="grid grid-cols-7 items-center gap-1.5 py-2">
                  
                  {/* Home Team */}
                  <div className="col-span-3 text-center flex flex-col items-center gap-2 min-w-0">
                    <div className="w-12 h-12 bg-zinc-950/90 border border-zinc-850 p-2.5 rounded-full flex items-center justify-center shadow-inner relative group-hover:scale-105 transition-transform">
                      <img
                        src={match.homeTeam.crest}
                        alt={match.homeTeam.name}
                        className="max-h-full max-w-full object-contain filter"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "https://crests.football-data.org/65.png";
                        }}
                      />
                    </div>
                    <span className="text-[11px] font-extrabold text-zinc-200 uppercase tracking-wide truncate max-w-full" title={match.homeTeam.name}>
                      {match.homeTeam.shortName}
                    </span>
                    <span className="text-[8px] font-mono text-zinc-500 tracking-wider font-bold">
                      {match.homeTeam.tla}
                    </span>
                  </div>

                  {/* Digital Score box/Timer VS */}
                  <div className="col-span-1 text-center flex flex-col justify-center items-center">
                    {hasScore ? (
                      <div className="flex items-center gap-1 font-mono">
                        <span className={`text-base font-black px-2 py-1 bg-zinc-950 border border-zinc-850 rounded-lg shadow-md tracking-tighter ${match.lastGoalTeam === "home" ? "text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.25)]" : "text-white"}`}>
                          {scoreHome}
                        </span>
                        <span className="text-zinc-650 font-black text-[10px]">-</span>
                        <span className={`text-base font-black px-2 py-1 bg-zinc-950 border border-zinc-850 rounded-lg shadow-md tracking-tighter ${match.lastGoalTeam === "away" ? "text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.25)]" : "text-white"}`}>
                          {scoreAway}
                        </span>
                      </div>
                    ) : (
                      <div className="text-[10px] font-mono font-black text-cyan-400 bg-cyan-950/20 border border-cyan-900/30 px-1.5 py-1 rounded">
                        VS
                      </div>
                    )}

                    {match.status === "SCHEDULED" && (
                      <span className="text-[8px] font-mono text-zinc-450 mt-2 font-semibold">
                        {new Date(match.utcDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>

                  {/* Away Team */}
                  <div className="col-span-3 text-center flex flex-col items-center gap-2 min-w-0">
                    <div className="w-12 h-12 bg-zinc-950/90 border border-zinc-850 p-2.5 rounded-full flex items-center justify-center shadow-inner relative group-hover:scale-105 transition-transform">
                      <img
                        src={match.awayTeam.crest}
                        alt={match.awayTeam.name}
                        className="max-h-full max-w-full object-contain filter"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "https://crests.football-data.org/86.png";
                        }}
                      />
                    </div>
                    <span className="text-[11px] font-extrabold text-zinc-200 uppercase tracking-wide truncate max-w-full" title={match.awayTeam.name}>
                      {match.awayTeam.shortName}
                    </span>
                    <span className="text-[8px] font-mono text-zinc-500 tracking-wider font-bold">
                      {match.awayTeam.tla}
                    </span>
                  </div>
                </div>

                {/* Event Logs toggle for high interaction */}
                {match.events && match.events.length > 0 && (
                  <div className="mt-4 border-t border-zinc-900/50 pt-3 text-[9px] text-zinc-500">
                    <span className="font-bold text-zinc-400 uppercase tracking-wider block mb-2 font-mono">Live Logs:</span>
                    <div className="space-y-1.5 max-h-20 overflow-y-auto pr-1">
                      {match.events.map((ev, i) => (
                        <div key={i} className="flex items-center gap-1.5 justify-start">
                          <span className="font-bold text-cyan-400 font-mono w-6 shrink-0">{ev.minute}'</span>
                          <span className="text-zinc-400 flex items-center gap-1 leading-tight">
                            {ev.type === "GOAL" ? (
                              <span className="text-emerald-400 font-black">⚽ Goal!</span>
                            ) : ev.type === "RED_CARD" ? (
                              <span className="text-rose-500 font-black">🟥 Red</span>
                            ) : (
                              <span className="text-amber-500 font-bold">🟨 Yellow</span>
                            )}
                            <span className="font-bold text-zinc-300">({ev.player})</span>
                            <span className="text-zinc-600">[{ev.team === "home" ? match.homeTeam.tla : match.awayTeam.tla}]</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-zinc-950 border border-zinc-850 rounded-2xl py-12 p-8 text-center space-y-3 relative z-10">
          <Search className="text-zinc-600 mx-auto" size={24} />
          <p className="text-xs text-zinc-400 uppercase font-bold tracking-wider">No matching fixtures found</p>
          <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">Try typing a different name or browse other tabs on the match controller panel.</p>
        </div>
      )}
    </div>
  );
}
