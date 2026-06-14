import { useState, useEffect, useMemo } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Starfield from "./components/Starfield";
import LoginScreen from "./components/screens/LoginScreen";
import HomeScreen from "./components/screens/HomeScreen";
import ObservatoryScreen from "./components/screens/ObservatoryScreen";
import LibraryScreen from "./components/screens/LibraryScreen";
import AdminScreen from "./components/screens/AdminScreen";
import ProfileScreen from "./components/screens/ProfileScreen";

import {
  fetchChannels,
  fetchUserFavorites,
  fetchWatchHistory,
  toggleFavorite,
  logWatchSession,
  incrementChannelViews,
  seedChannels,
  deleteChannel,
  deleteChannelsBatch,
  saveChannel,
  isSeedDisabledCheck,
  setSeedStatus,
} from "./utils/dbService";
import { DEFAULT_CHANNELS } from "./utils/m3uParser";
import { Channel, Favorite, WatchHistory } from "./types";
import {
  Loader2,
  ListRestart,
  Heart,
  Clock,
  Tv,
  LayoutGrid,
  User,
  Shield,
  Home,
  Play,
  Star,
  Info
} from "lucide-react";

function AppContent() {
  const { user, profile, loading: authLoading, isAdmin } = useAuth();
  
  // App state
  const [channels, setChannels] = useState<Channel[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [watchHistory, setWatchHistory] = useState<WatchHistory[]>([]);
  
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [currentScreen, setCurrentScreen] = useState<"home" | "live" | "categories" | "favorites" | "history" | "profile" | "admin">("home");
  const [dataLoading, setDataLoading] = useState(false);

  // Load all channels, favorites, and history
  const loadDatabaseState = async () => {
    if (!user) return;
    setDataLoading(true);
    try {
      const dbChannels = await fetchChannels();
      const listDisabled = await isSeedDisabledCheck() || localStorage.getItem("sazi_tv_purge_active") === "true";
      if (dbChannels.length === 0 && !listDisabled) {
        // Automatically seed the database with defaults on first run so they are real persistent documents!
        await seedChannels(DEFAULT_CHANNELS);
        setChannels(DEFAULT_CHANNELS);
      } else {
        setChannels(dbChannels);
      }

      const dbFavs = await fetchUserFavorites(user.uid);
      setFavorites(dbFavs);

      const dbHistory = await fetchWatchHistory(user.uid);
      setWatchHistory(dbHistory);
    } catch (err) {
      console.error("Telemetry sync error:", err);
      setChannels(DEFAULT_CHANNELS);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadDatabaseState();
    }
  }, [user]);

  // Favorite toggle action handler
  const handleToggleFav = async (channelId: string) => {
    if (!user) return;
    try {
      await toggleFavorite(user.uid, channelId);
      const dbFavs = await fetchUserFavorites(user.uid);
      setFavorites(dbFavs);
    } catch (e) {
      console.error("Favorite toggle failure:", e);
    }
  };

  // Launch live player session and transition to Live TV tab
  const handleSelectChannel = async (chan: Channel) => {
    setActiveChannel(chan);
    setCurrentScreen("live"); // Smoothly redirect to Live TV player screen
    
    if (user) {
      try {
        await incrementChannelViews(chan.id);
        await logWatchSession(user.uid, chan.id);
        
        const dbHistory = await fetchWatchHistory(user.uid);
        setWatchHistory(dbHistory);
      } catch (err) {
        // Log handled silently
      }
    }
  };

  // Log progress increments
  const handleLogProgress = async (seconds: number) => {
    if (user && activeChannel) {
      if (seconds > 0 && seconds % 10 === 0) {
        await logWatchSession(user.uid, activeChannel.id, seconds, 3600);
      }
    }
  };

  // Admin and db management commands
  const handleAddChannel = async (chan: Channel) => {
    await saveChannel(chan);
    await loadDatabaseState();
  };

  const handleSeedCuratedList = async () => {
    localStorage.removeItem("sazi_tv_purge_active");
    await setSeedStatus(false);
    await seedChannels(DEFAULT_CHANNELS);
    await loadDatabaseState();
  };

  const handleDeleteChannel = async (chanId: string | string[]) => {
    if (Array.isArray(chanId)) {
      const isPurgingAll = chanId.length >= channels.length;
      if (isPurgingAll) {
         localStorage.setItem("sazi_tv_purge_active", "true");
         setChannels([]);
         if (activeChannel) {
           setActiveChannel(null);
         }
         await setSeedStatus(true);
      } else {
         setChannels((prev) => prev.filter((c) => !chanId.includes(c.id)));
         if (activeChannel && chanId.includes(activeChannel.id)) {
           setActiveChannel(null);
         }
      }
      await deleteChannelsBatch(chanId);
    } else {
      const isLastOne = channels.length <= 1;
      if (isLastOne) {
         localStorage.setItem("sazi_tv_purge_active", "true");
         setChannels([]);
         if (activeChannel?.id === chanId) {
           setActiveChannel(null);
         }
         await setSeedStatus(true);
      } else {
         setChannels((prev) => prev.filter((c) => c.id !== chanId));
         if (activeChannel?.id === chanId) {
           setActiveChannel(null);
         }
      }
      await deleteChannel(chanId);
    }
    await loadDatabaseState();
  };

  // Memoized lists for rendering
  const favoriteChannels = useMemo(() => {
    const favSet = new Set(favorites.map((f) => f.channelId));
    return channels.filter((c) => favSet.has(c.id));
  }, [channels, favorites]);

  const historyChannels = useMemo(() => {
    const historyMap = new Map<string, any>(watchHistory.map((h) => [h.channelId, h.watchedAt]));
    return channels
      .filter((c) => historyMap.has(c.id))
      .sort((a, b) => {
        const watchedAtA = historyMap.get(a.id);
        const watchedAtB = historyMap.get(b.id);
        const timeA = watchedAtA ? (watchedAtA.toDate ? watchedAtA.toDate().getTime() : new Date(watchedAtA).getTime()) : 0;
        const timeB = watchedAtB ? (watchedAtB.toDate ? watchedAtB.toDate().getTime() : new Date(watchedAtB).getTime()) : 0;
        return timeB - timeA;
      });
  }, [channels, watchHistory]);

  const userDisplayName = profile?.displayName || user?.displayName || "Viewer";

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#040406] flex flex-col items-center justify-center gap-4 relative">
        <Starfield />
        <div className="relative">
          <Loader2 className="animate-spin text-cyan-400" size={36} />
          <div className="absolute inset-1.5 bg-cyan-400 rounded-full animate-ping opacity-25" />
        </div>
        <p className="text-cyan-400 font-sans text-xs tracking-widest uppercase font-bold select-none mt-2">
          Sazi TV Loading...
        </p>
      </div>
    );
  }

  // Login view fallback if not signed in
  if (!user) {
    return (
      <main className="min-h-screen bg-[#040406] text-zinc-100 relative overflow-hidden flex flex-col justify-between py-8">
        <Starfield />
        <LoginScreen />
        <footer className="text-center font-sans text-[11px] text-zinc-650 relative z-10 select-none tracking-wider uppercase mt-4">
          SAZI TV PLATFORM // PREMIUM STREAM ARCHITECTURE
        </footer>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#040406] text-zinc-100 flex flex-col relative overflow-x-hidden">
      {/* Premium ambient starry background */}
      <Starfield />

      {/* Header and responsive platform navigation bar */}
      <header className="sticky top-0 bg-[#040406]/85 backdrop-blur-xl border-b border-zinc-900/60 z-40 select-none">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Logo Branding */}
          <div className="flex items-center gap-3.5 cursor-pointer" onClick={() => setCurrentScreen("home")}>
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-tr from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.2)]">
                <Tv className="text-zinc-950" size={20} />
              </div>
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-zinc-950 animate-pulse" />
            </div>
            
            <div>
              <h1 className="text-md font-black tracking-widest text-white leading-none">
                SAZI <span className="text-cyan-400">TV</span>
              </h1>
              <p className="text-[9px] tracking-[0.25em] text-zinc-550 font-bold mt-1 uppercase">Premium portal</p>
            </div>
          </div>

          {/* Nav Links bar with Home, Live TV, Categories, Favorites, History, Profile */}
          <nav className="flex items-center flex-wrap justify-center gap-1.5 p-1 bg-[#09090d]/90 border border-zinc-850 rounded-xl font-sans text-xs">
            <button
              id="nav-btn-home"
              onClick={() => setCurrentScreen("home")}
              className={`px-3 py-2 rounded-lg font-semibold tracking-wide transition-all flex items-center gap-1.5 cursor-pointer ${
                currentScreen === "home"
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_12px_rgba(6,182,212,0.1)]"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Home size={15} /> <span>Home</span>
            </button>
            <button
              id="nav-btn-live"
              onClick={() => setCurrentScreen("live")}
              className={`px-3 py-2 rounded-lg font-semibold tracking-wide transition-all flex items-center gap-1.5 cursor-pointer ${
                currentScreen === "live"
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_12px_rgba(6,182,212,0.1)]"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Tv size={15} /> <span>Live TV</span>
            </button>
            <button
              id="nav-btn-categories"
              onClick={() => setCurrentScreen("categories")}
              className={`px-3 py-2 rounded-lg font-semibold tracking-wide transition-all flex items-center gap-1.5 cursor-pointer ${
                currentScreen === "categories"
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_12px_rgba(6,182,212,0.1)]"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <LayoutGrid size={15} /> <span>Categories</span>
            </button>
            <button
              id="nav-btn-favorites"
              onClick={() => setCurrentScreen("favorites")}
              className={`px-3 py-2 rounded-lg font-semibold tracking-wide transition-all flex items-center gap-1.5 cursor-pointer ${
                currentScreen === "favorites"
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_12px_rgba(6,182,212,0.1)]"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Heart size={15} /> <span>Favorites</span>
            </button>
            <button
              id="nav-btn-history"
              onClick={() => setCurrentScreen("history")}
              className={`px-3 py-2 rounded-lg font-semibold tracking-wide transition-all flex items-center gap-1.5 cursor-pointer ${
                currentScreen === "history"
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_12px_rgba(6,182,212,0.1)]"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Clock size={15} /> <span>History</span>
            </button>
            <button
              id="nav-btn-profile"
              onClick={() => setCurrentScreen("profile")}
              className={`px-3 py-2 rounded-lg font-semibold tracking-wide transition-all flex items-center gap-1.5 cursor-pointer ${
                currentScreen === "profile"
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_12px_rgba(6,182,212,0.1)]"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <User size={15} /> <span>Profile</span>
            </button>

            {/* Admin COMMAND tab */}
            {isAdmin && (
              <button
                id="nav-btn-admin-command"
                onClick={() => setCurrentScreen("admin")}
                className={`px-3 py-2 rounded-lg font-semibold tracking-wide transition-all flex items-center gap-1.5 cursor-pointer ${
                  currentScreen === "admin"
                    ? "bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-[0_0_12px_rgba(168,85,247,0.1)]"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Shield size={14} /> <span>Config</span>
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Main Screen Router Render Segment */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 py-8 relative z-10">
        
        {/* Loading overlay notification indicator for database telemetry */}
        {dataLoading && (
          <div className="fixed top-24 right-4 bg-zinc-950/90 border border-cyan-500/30 px-3.5 py-2 rounded-xl text-cyan-405 font-sans text-[11px] font-bold shadow-[0_0_20px_rgba(6,182,212,0.15)] flex items-center gap-2 animate-pulse z-50">
            <ListRestart size={14} className="animate-spin" /> Synchronizing data...
          </div>
        )}

        {/* 1. Home screen (Redesigned Main Landing Page) */}
        {currentScreen === "home" && (
          <HomeScreen
            channels={channels}
            favorites={favorites}
            onSelectChannel={handleSelectChannel}
            onToggleFavorite={handleToggleFav}
            userDisplayName={userDisplayName}
          />
        )}

        {/* 2. Live TV screen (observatory stream center) */}
        {currentScreen === "live" && (
          <ObservatoryScreen
            channels={channels}
            favorites={favorites}
            watchHistory={watchHistory}
            onSelectChannel={handleSelectChannel}
            activeChannel={activeChannel}
            onToggleFavorite={handleToggleFav}
            onLogProgress={handleLogProgress}
          />
        )}

        {/* 3. Categories screen (channels list/filters) */}
        {currentScreen === "categories" && (
          <LibraryScreen
            channels={channels}
            favorites={favorites}
            onSelectChannel={handleSelectChannel}
            onToggleFavorite={handleToggleFav}
          />
        )}

        {/* 4. Standalone Favorites screen */}
        {currentScreen === "favorites" && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-l-[3px] border-cyan-500 pl-3">
              <Heart className="text-cyan-400" size={18} fill="currentColor" />
              <h2 className="text-xl font-bold text-zinc-100 tracking-wide uppercase">Curated Favorites</h2>
            </div>
            
            {favoriteChannels.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
                {favoriteChannels.map((chan) => {
                  return (
                    <div
                      key={chan.id}
                      className="group relative bg-[#0e0e12] border border-zinc-850 hover:border-cyan-500/20 rounded-xl overflow-hidden transition-all duration-300 transform hover:-translate-y-1"
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleFav(chan.id)}
                        className="absolute top-2 right-2 z-20 p-1.5 rounded-lg border bg-zinc-950/80 text-amber-400 border-amber-500/30 hover:scale-110 transition-all cursor-pointer"
                      >
                        <Star size={11} fill="currentColor" />
                      </button>
                      <div
                        onClick={() => handleSelectChannel(chan)}
                        className="aspect-video bg-[#050608] relative flex items-center justify-center p-3 cursor-pointer overflow-hidden"
                      >
                        <img
                          src={chan.logo || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=60"}
                          alt=""
                          className="max-h-full max-w-full object-contain filter group-hover:brightness-110"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=60";
                          }}
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                          <div className="w-9 h-9 rounded-full bg-cyan-400 text-zinc-950 flex items-center justify-center font-bold">
                            <Play fill="currentColor" size={14} className="ml-0.5" />
                          </div>
                        </div>
                      </div>
                      <div onClick={() => handleSelectChannel(chan)} className="p-3 bg-zinc-950 cursor-pointer">
                        <h4 className="text-xs font-bold text-zinc-250 group-hover:text-cyan-400 truncate">{chan.name}</h4>
                        <p className="text-[9px] text-zinc-500 uppercase mt-0.5">{chan.category}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-[#0a0a0f] border border-dashed border-zinc-850 p-12 text-center rounded-2xl space-y-3">
                <Star className="text-zinc-650 mx-auto" size={28} />
                <p className="text-xs text-zinc-450 uppercase tracking-wider font-semibold">Your Favorites list is currently empty</p>
                <p className="text-[11px] text-zinc-550 max-w-xs mx-auto">Click the bookmark star icon on home channels list or any streaming player options to gather them here.</p>
                <button
                  onClick={() => setCurrentScreen("home")}
                  className="mt-4 px-4 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-cyan-455 rounded-xl font-bold text-xs"
                >
                  Explore Live Feeds
                </button>
              </div>
            )}
          </div>
        )}

        {/* 5. Standalone History screen */}
        {currentScreen === "history" && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-l-[3px] border-cyan-500 pl-3">
              <Clock className="text-cyan-400" size={18} />
              <h2 className="text-xl font-bold text-zinc-100 tracking-wide uppercase">Watch History</h2>
            </div>

            {historyChannels.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
                {historyChannels.map((chan) => {
                  const isFav = favorites.some((f) => f.channelId === chan.id);
                  return (
                    <div
                      key={`list-hist-${chan.id}`}
                      className="group relative bg-[#0e0e12] border border-zinc-850 hover:border-cyan-500/20 rounded-xl overflow-hidden transition-all duration-300 transform hover:-translate-y-1"
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleFav(chan.id)}
                        className="absolute top-2 right-2 z-20 p-1.5 rounded-lg border bg-zinc-950/85 text-zinc-450 hover:text-amber-400 border-zinc-800 hover:border-amber-500/30 transition-all cursor-pointer"
                      >
                        <Star size={11} fill={isFav ? "currentColor" : "none"} className={isFav ? "text-amber-400" : ""} />
                      </button>
                      <div
                        onClick={() => handleSelectChannel(chan)}
                        className="aspect-video bg-[#050608] relative flex items-center justify-center p-3 cursor-pointer overflow-hidden"
                      >
                        <img
                          src={chan.logo || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=60"}
                          alt=""
                          className="max-h-full max-w-full object-contain filter group-hover:brightness-110"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=60";
                          }}
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                          <div className="w-9 h-9 rounded-full bg-cyan-400 text-zinc-950 flex items-center justify-center font-bold">
                            <Play fill="currentColor" size={14} className="ml-0.5" />
                          </div>
                        </div>
                      </div>
                      <div onClick={() => handleSelectChannel(chan)} className="p-3 bg-zinc-950 cursor-pointer">
                        <h4 className="text-xs font-bold text-zinc-250 group-hover:text-cyan-400 truncate">{chan.name}</h4>
                        <p className="text-[9px] text-zinc-500 uppercase mt-0.5">{chan.category}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-[#0a0a0f] border border-dashed border-zinc-850 p-12 text-center rounded-2xl space-y-3">
                <Clock className="text-zinc-650 mx-auto" size={28} />
                <p className="text-xs text-zinc-455 uppercase tracking-wider font-semibold">Your Watch History is currently empty</p>
                <p className="text-[11px] text-zinc-550 max-w-xs mx-auto">Any stream that you play or resume from our dashboard portals will be registered here securely.</p>
                <button
                  onClick={() => setCurrentScreen("home")}
                  className="mt-4 px-4 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-cyan-455 rounded-xl font-bold text-xs"
                >
                  Stream Live Feeds
                </button>
              </div>
            )}
          </div>
        )}

        {/* 6. Profile screen */}
        {currentScreen === "profile" && (
          <ProfileScreen
            favorites={favorites}
            watchHistory={watchHistory}
            channels={channels}
            onSelectChannel={handleSelectChannel}
            onToggleFavorite={handleToggleFav}
          />
        )}

        {/* 7. Admin Config screen */}
        {currentScreen === "admin" && isAdmin && (
          <AdminScreen
            channels={channels}
            onAddChannel={handleAddChannel}
            onDeleteChannel={handleDeleteChannel}
            onSeedDefaults={handleSeedCuratedList}
          />
        )}
      </main>

      {/* Premium responsive status footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950/60 py-6 mt-16 backdrop-blur-md select-none font-sans text-xs">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-center">
          <p className="text-[11px] text-zinc-550">
            © {new Date().getFullYear()} SAZI TV // COHESIVE SECURE HLS WEB PLAYER
          </p>
          <div className="flex gap-4 text-[10px] text-cyan-400 font-mono font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Tv size={12} /> BROADCAST: DUPLEX_ACTIVE
            </span>
            <span className="flex items-center gap-1.5">
              <Info size={12} /> BUFFERING: OPTIMIZED_HLS
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
