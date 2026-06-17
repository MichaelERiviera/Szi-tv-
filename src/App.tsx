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

function GuestCTA({
  title,
  message,
  onLogin,
  onRegister,
}: {
  title: string;
  message: string;
  onLogin: () => void;
  onRegister: () => void;
}) {
  return (
    <div className="bg-[#05050b]/80 border border-zinc-850 p-12 text-center rounded-2xl max-w-xl mx-auto space-y-6 shadow-2xl relative overflow-hidden my-12 animate-in fade-in duration-200">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-indigo-500/10" />
      <div className="w-14 h-14 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center mx-auto shadow-lg shadow-cyan-500/10">
        <Tv className="text-zinc-950" size={24} />
      </div>
      <div className="space-y-2">
        <h3 className="text-md font-extrabold text-white tracking-widest uppercase font-mono">{title}</h3>
        <p className="text-zinc-405 text-[11px] leading-relaxed max-w-sm mx-auto">{message}</p>
      </div>
      <div className="flex gap-3.5 items-center justify-center pt-2">
        <button
          onClick={onLogin}
          className="px-5 py-2.5 bg-cyan-450 hover:bg-cyan-300 text-zinc-950 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-300 shadow-[0_0_12px_rgba(34,211,238,0.25)] cursor-pointer"
        >
          Sign In Now
        </button>
        <button
          onClick={onRegister}
          className="px-4 py-2.5 border border-zinc-800 hover:border-zinc-700 bg-zinc-950/40 text-zinc-300 hover:text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
        >
          Sign Up Free
        </button>
      </div>
    </div>
  );
}

function AppContent() {
  const { user, profile, loading: authLoading, isAdmin, signOutUser } = useAuth();
  
  // App state
  const [channels, setChannels] = useState<Channel[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [watchHistory, setWatchHistory] = useState<WatchHistory[]>([]);
  
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [currentScreen, setCurrentScreen] = useState<"home" | "live" | "categories" | "favorites" | "history" | "profile" | "admin">("home");
  const [dataLoading, setDataLoading] = useState(false);

  // Modal authentication state controls
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginModalTab, setLoginModalTab] = useState<"login" | "register" | "forgot">("login");
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  // Load all channels, favorites, and history
  const loadDatabaseState = async () => {
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

      if (user) {
        const dbFavs = await fetchUserFavorites(user.uid);
        setFavorites(dbFavs);

        const dbHistory = await fetchWatchHistory(user.uid);
        setWatchHistory(dbHistory);
      } else {
        setFavorites([]);
        setWatchHistory([]);
      }
    } catch (err) {
      console.error("Telemetry sync error:", err);
      setChannels(DEFAULT_CHANNELS);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    loadDatabaseState();
  }, [user]);

  // Favorite toggle action handler
  const handleToggleFav = async (channelId: string) => {
    if (!user) {
      setLoginModalTab("login");
      setLoginModalOpen(true);
      return;
    }
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
    
    // Guest increments views as permitted by rules
    try {
      await incrementChannelViews(chan.id);
    } catch (err) {
      // Handled silently
    }

    if (user) {
      try {
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

  // Navigation tabs for quick looping
  const navTabs = [
    { id: "home", label: "Home", icon: Home },
    { id: "live", label: "Live TV", icon: Tv },
    { id: "categories", label: "Categories", icon: LayoutGrid },
    { id: "favorites", label: "Favorites", icon: Heart },
    { id: "history", label: "History", icon: Clock },
    { id: "profile", label: "Profile", icon: User },
  ] as const;

  // Notification center state
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; time: string; read: boolean; type: "broadcast" | "system" | "soccer" }>>([
    { id: "not-1", title: "🪐 Satellite orbit aligned: AI Pathfinder online", time: "10m ago", read: false, type: "system" },
    { id: "not-2", title: "⚽ Liverpool vs Chelsea LIVE matchday stream active", time: "25m ago", read: false, type: "soccer" },
    { id: "not-3", title: "🔌 Auto-Reconnect & Stream Health Matrix calibrated", time: "1h ago", read: true, type: "system" },
    { id: "not-4", title: "🎬 Action Premium Sintel stream loaded in cinematic pool", time: "2h ago", read: true, type: "broadcast" },
  ]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const unreadNotifsCount = notifications.filter((n) => !n.read).length;

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const triggerModalLogin = (tab: "login" | "register" | "forgot" = "login") => {
    setLoginModalTab(tab);
    setLoginModalOpen(true);
  };

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

  return (
    <div className="min-h-screen bg-[#040406] text-zinc-100 flex flex-col relative overflow-x-hidden pb-16 md:pb-0">
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

          {/* Combined Actions & Nav Links row */}
          <div className="flex items-center gap-4 flex-wrap justify-center">
            {/* Nav Links bar with Home, Live TV, Categories, Favorites, History, Profile */}
            <nav className="hidden sm:flex items-center gap-1.5 p-1 bg-[#09090d]/90 border border-zinc-850 rounded-xl font-sans text-xs">
              {navTabs.map((tab) => {
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    id={`nav-btn-${tab.id}`}
                    onClick={() => setCurrentScreen(tab.id as any)}
                    className={`px-3 py-2 rounded-lg font-semibold tracking-wide transition-all flex items-center gap-1.5 cursor-pointer ${
                      currentScreen === tab.id
                        ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_12px_rgba(6,182,212,0.1)]"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    <TabIcon size={14} /> <span>{tab.label}</span>
                  </button>
                );
              })}

              {/* Admin COMMAND tab */}
              {user && isAdmin && (
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

            {/* Notification Center Trigger Bell Element */}
            <div className="relative">
              <button
                type="button"
                id="notif-center-bell"
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="p-2 border border-slate-800 rounded-lg hover:border-cyan-400/50 bg-slate-950/40 text-slate-450 hover:text-cyan-400 transition cursor-pointer relative"
              >
                {/* Bell icon */}
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadNotifsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-[8px] font-bold text-white rounded-full flex items-center justify-center animate-pulse">
                    {unreadNotifsCount}
                  </span>
                )}
              </button>

              {/* Notification Popover Dropdown menu */}
              {isNotifOpen && (
                <div className="absolute right-0 mt-3 w-80 bg-slate-950 border border-slate-900 rounded-xl shadow-2xl p-4 z-50 space-y-3 font-sans">
                  <div className="flex items-center justify-between border-b border-cyan-500/10 pb-2">
                    <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-[#00f0ff] flex items-center gap-1">
                      Satellite Logs
                    </span>
                    {unreadNotifsCount > 0 && (
                      <button
                        onClick={markAllNotificationsRead}
                        className="text-[8px] font-mono text-zinc-550 hover:text-white uppercase"
                      >
                        Read All
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5 max-h-60 overflow-y-auto divide-y divide-slate-900/60 scrollbar-thin scrollbar-thumb-cyan-500/10">
                    {notifications.length > 0 ? (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          className={`py-2 flex items-start justify-between gap-1 text-[10px] ${!notif.read ? "bg-cyan-950/5 font-semibold text-white" : "text-zinc-400"}`}
                        >
                          <div className="space-y-0.5">
                            <p className="leading-snug">{notif.title}</p>
                            <span className="text-[8px] text-zinc-500 font-mono block">{notif.time}</span>
                          </div>
                          <button
                            onClick={() => clearNotification(notif.id)}
                            className="text-[14px] text-rose-500 hover:text-rose-400 font-mono font-bold px-1 select-none"
                            title="Purge"
                          >
                            ×
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="py-6 text-center text-zinc-600 text-[10px] font-mono uppercase tracking-widest">
                        Telemetry buffer empty
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown Menu Button (Top Right Corner) */}
            <div className="relative">
              <button
                type="button"
                id="profile-dropdown-trigger"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2.5 p-1.5 border border-slate-800 rounded-lg hover:border-cyan-400/50 bg-slate-950/40 text-slate-400 hover:text-cyan-400 transition cursor-pointer relative"
              >
                <div className="w-6 h-6 rounded-full bg-cyan-950 flex items-center justify-center text-xs font-bold border border-cyan-500/20 text-cyan-400">
                  {user ? (profile?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "M") : "G"}
                </div>
                <span className="hidden sm:inline text-xs font-bold mr-1 truncate max-w-[80px]">
                  {user ? (profile?.displayName || "Member") : "Guest Mode"}
                </span>
                {!user && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full border border-slate-950" />
                )}
              </button>

              {/* Dropdown Box Menu */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-3 w-64 bg-zinc-950 border border-zinc-900 rounded-xl shadow-2xl p-4 z-50 space-y-4 font-sans animate-in fade-in slide-in-from-top-3 duration-200">
                  <div className="border-b border-zinc-900 pb-3">
                    <span className="text-[8px] font-mono font-bold text-zinc-500 uppercase tracking-widest block mb-1">
                      USER IDENTITY STATE
                    </span>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center text-sm font-bold border border-cyan-500/30 text-cyan-400 shrink-0">
                        {user ? (profile?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "M") : "G"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-white truncate">
                          {user ? (profile?.displayName || "Sazi Member") : "Guest Viewer"}
                        </p>
                        <p className="text-[9px] text-zinc-400 font-mono truncate">
                          {user ? user.email : "Limited Mode (Offline)"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {user ? (
                    <div className="space-y-1">
                      <button
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          setCurrentScreen("profile");
                        }}
                        className="w-full text-left py-2 px-3 hover:bg-zinc-900 rounded-lg text-xs font-bold transition-all flex items-center gap-2 text-zinc-300 hover:text-white"
                      >
                        <User size={13} className="text-cyan-400" /> Go to Console
                      </button>
                      
                      {isAdmin && (
                        <button
                          onClick={() => {
                            setProfileDropdownOpen(false);
                            setCurrentScreen("admin");
                          }}
                          className="w-full text-left py-2 px-3 hover:bg-zinc-900 rounded-lg text-xs font-bold transition-all flex items-center gap-2 text-zinc-300 hover:text-purple-400"
                        >
                          <Shield size={13} className="text-purple-500" /> Admin Station
                        </button>
                      )}

                      <button
                        onClick={async () => {
                          setProfileDropdownOpen(false);
                          signOutUser();
                          setCurrentScreen("home");
                        }}
                        className="w-full text-left py-2 px-3 hover:bg-red-950/15 text-rose-400 hover:text-rose-300 rounded-lg text-xs font-bold transition-all flex items-center gap-2 border-t border-zinc-900/60 mt-2"
                      >
                        Sign Out Session
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="bg-amber-500/10 border border-amber-500/15 p-2 px-3 rounded-lg text-[10px] text-amber-300 font-sans leading-relaxed">
                        Sign in to activate Favorites playlists, watch history registries, and custom profiles.
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            setProfileDropdownOpen(false);
                            triggerModalLogin("login");
                          }}
                          className="py-2.5 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 text-center font-bold text-xs uppercase tracking-wide rounded-lg cursor-pointer transition-all shadow-[0_0_12px_rgba(34,211,238,0.15)]"
                        >
                          Log In
                        </button>
                        <button
                          onClick={() => {
                            setProfileDropdownOpen(false);
                            triggerModalLogin("register");
                          }}
                          className="py-2.5 bg-zinc-900 border border-zinc-850 hover:border-zinc-800 text-zinc-200 text-center font-bold text-xs uppercase tracking-wide rounded-lg cursor-pointer transition-colors"
                        >
                          Sign Up
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* Main Screen Router Render Segment */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 py-8 relative z-10">
        
        {/* Loading overlay notification indicator for database telemetry */}
        {dataLoading && (
          <div className="fixed top-24 right-4 bg-zinc-950/90 border border-cyan-500/30 px-3.5 py-2 rounded-xl text-cyan-400 font-sans text-[11px] font-bold shadow-[0_0_20px_rgba(6,182,212,0.15)] flex items-center gap-2 animate-pulse z-50">
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
            isGuest={!user}
            onRequireLogin={triggerModalLogin}
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
          user ? (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 border-l-[3px] border-cyan-500 pl-3">
                <Heart className="text-cyan-400" size={18} fill="currentColor" />
                <h2 className="text-xl font-bold text-zinc-100 tracking-wide uppercase">Curated Favorites</h2>
              </div>
              
              {favoriteChannels.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
                  {favoriteChannels.map((chan) => (
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
                  ))}
                </div>
              ) : (
                <div className="bg-[#0a0a0f] border border-dashed border-zinc-850 p-12 text-center rounded-2xl space-y-3">
                  <Star className="text-zinc-650 mx-auto" size={28} />
                  <p className="text-xs text-zinc-455 uppercase tracking-wider font-semibold">Your Favorites list is currently empty</p>
                  <p className="text-[11px] text-zinc-550 max-w-xs mx-auto">Click the bookmark star icon on home channels list or any streaming player options to gather them here.</p>
                  <button
                    onClick={() => setCurrentScreen("home")}
                    className="mt-4 px-4 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-cyan-400 rounded-xl font-bold text-xs"
                  >
                    Explore Live Feeds
                  </button>
                </div>
              )}
            </div>
          ) : (
            <GuestCTA
              title="Save Your Favorite channels"
              message="Accessing Favorites playlists requires a secure Sazi TV account. Register now to save custom IPTV feeds lists with stream telemetry status synchronized on all devices."
              onLogin={() => triggerModalLogin("login")}
              onRegister={() => triggerModalLogin("register")}
            />
          )
        )}

        {/* 5. Standalone History screen */}
        {currentScreen === "history" && (
          user ? (
            <div className="space-y-6 animate-in fade-in duration-200">
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
                    className="mt-4 px-4 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-cyan-400 rounded-xl font-bold text-xs"
                  >
                    Stream Live Feeds
                  </button>
                </div>
              )}
            </div>
          ) : (
            <GuestCTA
              title="Track Watch History"
              message="Keep track of all active streams played on Sazi TV. Registered command profiles synchronize watch timelines, telemetry benchmarks, and buffer performance automatically."
              onLogin={() => triggerModalLogin("login")}
              onRegister={() => triggerModalLogin("register")}
            />
          )
        )}

        {/* 6. Profile screen */}
        {currentScreen === "profile" && (
          user ? (
            <ProfileScreen
              favorites={favorites}
              watchHistory={watchHistory}
              channels={channels}
              onSelectChannel={handleSelectChannel}
              onToggleFavorite={handleToggleFav}
            />
          ) : (
            <GuestCTA
              title="SUBSCRIBER CONTROL CENTRE"
              message="Step inside the primary pilot portal to calibrate high-fidelity cyberpunk visual avatars, request advanced satellite IPTV relays, and manage credential parameters."
              onLogin={() => triggerModalLogin("login")}
              onRegister={() => triggerModalLogin("register")}
            />
          )
        )}

        {/* 7. Admin Config screen */}
        {currentScreen === "admin" && user && isAdmin && (
          <AdminScreen
            channels={channels}
            onAddChannel={handleAddChannel}
            onDeleteChannel={handleDeleteChannel}
            onSeedDefaults={handleSeedCuratedList}
            onRefreshDatabaseState={loadDatabaseState}
          />
        )}
      </main>

      {/* Premium responsive status footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950/60 py-6 mt-16 backdrop-blur-md select-none font-sans text-xs mb-16 sm:mb-0">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-center">
          <p className="text-[11px] text-zinc-550">
            © {new Date().getFullYear()} SAZI TV // COHESIVE SECURE HLS WEB PLAYER
          </p>
          <div className="flex gap-4 text-[10px] text-cyan-405 font-mono font-bold uppercase tracking-wider justify-center">
            <span className="flex items-center gap-1.5">
              <Tv size={12} /> BROADCAST: DUPLEX_ACTIVE
            </span>
            <span className="flex items-center gap-1.5">
              <Info size={12} /> BUFFERING: OPTIMIZED_HLS
            </span>
          </div>
        </div>
      </footer>

      {/* Modern, Premium Mobile app-style Bottom Dock Navigation bar (Only visible on Mobile viewports) */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#04040a]/95 backdrop-blur-xl border-t border-zinc-900 px-2 py-2 flex justify-around items-center space-x-1 shadow-[0_-5px_25px_rgba(0,0,0,0.8)]">
        {navTabs.map((tab) => {
          const TabIcon = tab.icon;
          const isActive = currentScreen === tab.id;
          return (
            <button
              key={`mobile-nav-${tab.id}`}
              onClick={() => setCurrentScreen(tab.id as any)}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-lg transition-all cursor-pointer relative ${
                isActive ? "text-cyan-400 font-bold" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <TabIcon size={18} className={isActive ? "drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]" : ""} />
              <span className="text-[9px] mt-1 font-sans">{tab.label}</span>
              {isActive && (
                <span className="absolute -top-1 w-5 h-0.5 bg-cyan-400 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* 8. MODAL AUTHENTICATION POPUP */}
      {loginModalOpen && (
        <LoginScreen
          isModal={true}
          initialTab={loginModalTab}
          onClose={() => setLoginModalOpen(false)}
        />
      )}
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
