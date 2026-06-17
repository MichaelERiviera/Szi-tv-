import React, { useState, useMemo, useEffect } from "react";
import { User, Mail, Calendar, Key, Shield, LogOut, Star, Clock, AlertCircle, CheckCircle2, Play, Sun, Moon, MessageSquare, Send, Satellite } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Favorite, WatchHistory, Channel, ChannelRequest } from "../../types";
import { updateUserProfileAvatar, submitChannelRequest, fetchChannelRequests } from "../../utils/dbService";

interface ProfileScreenProps {
  favorites: Favorite[];
  watchHistory: WatchHistory[];
  channels: Channel[];
  onSelectChannel: (chan: Channel) => void;
  onToggleFavorite: (chanId: string) => void;
}

const AVAILABLE_AVATARS = [
  { id: "cyborg-1", label: "Neon Sentinel", emoji: "🤖", color: "from-cyan-500 to-blue-500" },
  { id: "pilot-1", label: "Aura Commando", emoji: "👨‍🚀", color: "from-indigo-500 to-purple-500" },
  { id: "hacker-1", label: "Binary Phantom", emoji: "👾", color: "from-purple-500 to-pink-500" },
  { id: "scout-1", label: "Quantum Rover", emoji: "🛰️", color: "from-pink-500 to-rose-500" },
  { id: "commander-1", label: "Cosmo Sovereign", emoji: "👑", color: "from-amber-500 to-orange-500" },
  { id: "rebel-1", label: "Solar Flare", emoji: "🔥", color: "from-emerald-500 to-teal-500" },
];

export default function ProfileScreen({
  favorites,
  watchHistory,
  channels,
  onSelectChannel,
  onToggleFavorite,
}: ProfileScreenProps) {
  const { profile, user, signOutUser, resetPassword } = useAuth();
  const [resetSent, setResetSent] = useState(false);
  const [errorMess, setErrorMess] = useState("");
  
  // Theme toggling State
  const [themeMode, setThemeMode] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("sazitv_theme") as "dark" | "light") || "dark";
  });

  // Avatar Selection State
  const [activeAvatar, setActiveAvatar] = useState<string>(profile?.avatarId || "cyborg-1");

  // Multi-state submit parameters
  const [reqChanName, setReqChanName] = useState("");
  const [reqCategory, setReqCategory] = useState("Sports");
  const [reqStreamUrl, setReqStreamUrl] = useState("");
  const [reqSubmitted, setReqSubmitted] = useState(false);
  const [reqSubmitting, setReqSubmitting] = useState(false);

  // Users requests listings
  const [historicalRequests, setHistoricalRequests] = useState<ChannelRequest[]>([]);

  useEffect(() => {
    if (themeMode === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
    localStorage.setItem("sazitv_theme", themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (user) {
      fetchChannelRequests().then((data) => {
        const userOnly = data.filter((r) => r.userId === user.uid);
        setHistoricalRequests(userOnly);
      });
    }
  }, [user, reqSubmitted]);

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setErrorMess("");
    try {
      await resetPassword(user.email);
      setResetSent(true);
    } catch (e: any) {
      setErrorMess(e.message || "Failed to transmit password recovery signal.");
    }
  };

  const handleAvatarChange = async (avatarId: string) => {
    if (!user) return;
    setActiveAvatar(avatarId);
    try {
      await updateUserProfileAvatar(user.uid, avatarId);
    } catch (err) {
      console.warn(err);
    }
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !reqChanName) return;
    setReqSubmitting(true);
    try {
      const uName = profile?.displayName || user.displayName || "Sazi Subscriber";
      await submitChannelRequest(user.uid, uName, reqChanName, reqCategory, reqStreamUrl);
      setReqSubmitted(true);
      setReqChanName("");
      setReqStreamUrl("");
      setTimeout(() => setReqSubmitted(false), 5000);
    } catch (e) {
      console.error(e);
    } finally {
      setReqSubmitting(false);
    }
  };

  // Convert Firestore Timestamp or Date safely
  const formattedDate = () => {
    if (!profile?.createdAt) return "Since June 2026";
    const d = profile.createdAt.toDate ? profile.createdAt.toDate() : new Date(profile.createdAt);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Resolve Favorite channels list
  const favoriteChannels = useMemo(() => {
    const favSet = new Set(favorites.map((f) => f.channelId));
    return channels.filter((c) => favSet.has(c.id));
  }, [channels, favorites]);

  // Resolve Watch history channels sorted chronologically
  const historyChannels = useMemo(() => {
    const historyMap = new Map(watchHistory.map((h) => [h.channelId, h.watchedAt]));
    return channels
      .filter((c) => historyMap.has(c.id))
      .sort((a, b) => {
        const timeA = new Date(historyMap.get(a.id)).getTime();
        const timeB = new Date(historyMap.get(b.id)).getTime();
        return timeB - timeA;
      })
      .slice(0, 8); // Top 8 history items
  }, [channels, watchHistory]);

  const resolvedAvatar = AVAILABLE_AVATARS.find((a) => a.id === activeAvatar) || AVAILABLE_AVATARS[0];

  return (
    <div className="max-w-5xl mx-auto space-y-8 font-sans pb-12 text-zinc-100">
      
      {/* User Information Passport */}
      <div className="bg-[#09090d]/80 backdrop-blur-md border border-cyan-500/10 p-6 rounded-2xl flex flex-col md:flex-row gap-6 items-center shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-3 border-l border-b border-cyan-500/15 bg-zinc-950/80 text-cyan-400 font-mono text-[9px] uppercase tracking-widest font-bold rounded-bl-xl">
          COMMAND PORTAL PASSPORT
        </div>
        
        {/* Glow Avatar */}
        <div className="relative shrink-0 select-none">
          <div className="relative group cursor-pointer" title="Switch Avatar Option below">
            <div className={`w-24 h-24 bg-gradient-to-tr ${resolvedAvatar.color} rounded-full flex items-center justify-center p-0.5 shadow-[0_0_25px_rgba(34,211,238,0.35)] animate-pulse`}>
              <div className="w-full h-full bg-[#050610] rounded-full flex items-center justify-center text-4xl">
                {resolvedAvatar.emoji}
              </div>
            </div>
          </div>
          {profile?.role === "admin" && (
            <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-violet-600 to-indigo-600 text-white p-1.5 rounded-full border border-violet-400 shadow" title="System Commandant">
              <Shield size={14} />
            </div>
          )}
        </div>

        <div className="text-center md:text-left space-y-1.5 flex-1">
          <h2 className="text-xl font-black text-white tracking-wide flex items-center justify-center md:justify-start gap-2">
            {profile?.displayName || user?.displayName || "Sazi TV User"}
          </h2>
          <p className="text-xs text-cyan-400 font-mono tracking-widest uppercase">
            {profile?.role === "admin" ? "ADMINISTRATOR COMMANDER" : "SUBSCRIBER MEMBER"}
          </p>
          <p className="text-xs text-zinc-400 flex items-center justify-center md:justify-start gap-1 w-full truncate">
            <Mail size={13} className="text-zinc-500 shrink-0" /> {user?.email || "No email credential"}
          </p>
        </div>

        {/* Global theme changer widget */}
        <div className="flex flex-col items-center gap-1.5 bg-[#0e0d1d] border border-cyan-500/10 p-3 rounded-xl">
          <span className="text-[9px] font-mono font-bold text-violet-400 uppercase tracking-widest">
            THEME CALIBRATION
          </span>
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-900">
            <button
              onClick={() => setThemeMode("dark")}
              type="button"
              className={`p-1.5 px-3.5 rounded text-xs transition duration-200 uppercase font-mono font-bold font-semibold flex items-center gap-1 ${themeMode === "dark" ? "bg-cyan-500 text-black shadow-[0_0_12px_rgba(6,182,212,0.4)]" : "text-zinc-400 hover:text-white"}`}
            >
              <Moon size={11} /> Dark
            </button>
            <button
              onClick={() => setThemeMode("light")}
              type="button"
              className={`p-1.5 px-3.5 rounded text-xs transition duration-200 uppercase font-mono font-bold font-semibold flex items-center gap-1 ${themeMode === "light" ? "bg-cyan-500 text-black shadow-[0_0_12px_rgba(6,182,212,0.4)]" : "text-zinc-400 hover:text-white"}`}
            >
              <Sun size={11} /> Light
            </button>
          </div>
        </div>
      </div>

      {/* Cyber-Explorer Avatar selection options */}
      <div className="bg-[#0a0c1f]/50 border border-cyan-500/10 p-5 rounded-2xl space-y-3">
        <h3 className="text-xs font-mono font-bold text-cyan-450 uppercase tracking-widest flex items-center gap-2">
          🤖 SELECT BROADCASTER PROFILE AVATAR
        </h3>
        <p className="text-xs text-zinc-400 font-sans">
          Pick a custom cyborg sensor or scout drone avatar below to instantly recalibrate your user identity visual signature.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-2">
          {AVAILABLE_AVATARS.map((av) => (
            <button
              key={av.id}
              onClick={() => handleAvatarChange(av.id)}
              type="button"
              className={`p-3 rounded-xl border transition-all text-center relative flex flex-col items-center gap-2 cursor-pointer ${activeAvatar === av.id ? "bg-cyan-500/10 border-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.2)]" : "bg-slate-950/70 border-slate-900 hover:border-cyan-500/30"}`}
            >
              <div className={`w-12 h-12 rounded-full bg-gradient-to-tr ${av.color} flex items-center justify-center text-2xl`}>
                {av.emoji}
              </div>
              <span className="text-[9px] font-mono font-bold tracking-widest text-zinc-200 text-center uppercase truncate w-full">
                {av.label}
              </span>
              {activeAvatar === av.id && (
                <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Counter Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 font-mono">
        <div className="bg-[#0a0a0f] border border-zinc-850 p-5 rounded-2xl text-center space-y-1 shadow-md hover:border-cyan-500/10 transition-colors">
          <Star size={20} className="text-amber-400 mx-auto" />
          <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Favorites Bookmarked</p>
          <p className="text-2xl font-black text-white">{favorites.length}</p>
        </div>

        <div className="bg-[#0a0a0f] border border-zinc-850 p-5 rounded-2xl text-center space-y-1 shadow-md hover:border-cyan-500/10 transition-colors">
          <Clock size={20} className="text-sky-400 mx-auto" />
          <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Stream History</p>
          <p className="text-2xl font-black text-white">{watchHistory.length}</p>
        </div>

        <div className="bg-[#0a0a0f] border border-zinc-850 p-5 rounded-2xl text-center space-y-1 shadow-md hover:border-cyan-500/10 transition-colors">
          <Calendar size={20} className="text-indigo-400 mx-auto" />
          <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Member Since</p>
          <p className="text-sm font-bold text-zinc-200 pt-2">{formattedDate()}</p>
        </div>
      </div>

      {/* Favorite Channels Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-l-[3px] border-cyan-500 pl-3">
          <Star className="text-cyan-400" size={16} />
          <h3 className="text-md font-bold text-zinc-100 tracking-wide uppercase">Your Favorite Channels</h3>
        </div>

        {favoriteChannels.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
            {favoriteChannels.map((chan) => (
              <div
                key={chan.id}
                className="group relative bg-[#101015] hover:bg-zinc-900 border border-zinc-850 hover:border-cyan-500/20 rounded-xl overflow-hidden transition-all duration-300 transform hover:-translate-y-1"
              >
                <div className="absolute top-2 left-2 z-20 flex items-center gap-1 bg-rose-600/90 text-[8px] font-black text-white px-1.5 py-0.5 rounded uppercase">
                  LIVE
                </div>
                <button
                  type="button"
                  onClick={() => onToggleFavorite(chan.id)}
                  className="absolute top-2 right-2 z-20 p-1.5 rounded-lg border bg-zinc-950/80 text-amber-400 border-amber-500/30 hover:scale-110 transition-all cursor-pointer"
                >
                  <Star size={11} fill="currentColor" />
                </button>
                <div
                  onClick={() => onSelectChannel(chan)}
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
                    <div className="w-9 h-9 rounded-full bg-cyan-450 text-zinc-950 flex items-center justify-center font-bold">
                      <Play fill="currentColor" size={14} className="ml-0.5" />
                    </div>
                  </div>
                </div>
                <div onClick={() => onSelectChannel(chan)} className="p-3 bg-[#101015] cursor-pointer">
                  <h4 className="text-xs font-bold text-zinc-200 group-hover:text-cyan-400 truncate">{chan.name}</h4>
                  <p className="text-[9px] text-zinc-500 mt-0.5 uppercase tracking-wide truncate">{chan.category}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-zinc-900/10 border border-dashed border-zinc-850 hover:border-cyan-500/10 transition-colors p-8 rounded-xl text-center space-y-2">
            <Star className="text-zinc-650 mx-auto" size={24} />
            <p className="text-xs text-zinc-455">You haven't bookmarked any favorite channels yet.</p>
            <p className="text-[10px] text-zinc-550">Click the star button on any stream to add it here.</p>
          </div>
        )}
      </div>

      {/* Watch History Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-l-[3px] border-cyan-500 pl-3">
          <Clock className="text-cyan-400" size={16} />
          <h3 className="text-md font-bold text-zinc-100 tracking-wide uppercase">Recently Watched</h3>
        </div>

        {historyChannels.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
            {historyChannels.map((chan) => (
              <div
                key={`hist-${chan.id}`}
                onClick={() => onSelectChannel(chan)}
                className="group cursor-pointer bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-850 hover:border-cyan-500/10 p-2.5 rounded-xl transition-all duration-200 text-center relative overflow-hidden"
              >
                <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                <img
                  src={chan.logo || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=60"}
                  alt=""
                  className="w-12 h-12 object-contain bg-[#030408] border border-zinc-850 rounded-lg p-1 mx-auto group-hover:border-cyan-500/20 transition-all mb-2"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=60";
                  }}
                />
                <h4 className="text-[10px] font-bold text-zinc-300 group-hover:text-cyan-400 truncate w-full">
                  {chan.name}
                </h4>
                <p className="text-[8px] text-zinc-550 truncate w-full uppercase mt-0.5">
                  {chan.category}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-zinc-900/10 border border-dashed border-zinc-850 hover:border-cyan-500/10 transition-colors p-8 rounded-xl text-center space-y-2">
            <Clock className="text-zinc-650 mx-auto" size={24} />
            <p className="text-xs text-zinc-455">No watch history detected yet.</p>
            <p className="text-[10px] text-zinc-550">Streams you active play will appear in your history registry.</p>
          </div>
        )}
      </div>

      {/* Account Settings, Channel Request Form & History Logs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
        
        {/* Interactive Channel Requests Hub */}
        <div className="bg-[#0a0a0f] border border-zinc-850 p-6 rounded-2xl space-y-4 shadow-md flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-sm font-extrabold text-white tracking-widest font-mono uppercase flex items-center gap-2">
              <Satellite size={16} className="text-cyan-400" /> AI-Satellite Target Request
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed font-sans">
              Missing an IPTV broadcasting node? Lodge a satellite transmission query, and we'll dynamically search, calibrate, and lock onto target frequencies.
            </p>

            <form onSubmit={handleRequestSubmit} className="space-y-3 pt-2">
              <div>
                <label className="text-[9px] font-mono text-zinc-500 uppercase font-black block mb-1">
                  Desired Channel Name
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. ESPN Latino, BBC World"
                  value={reqChanName}
                  onChange={(e) => setReqChanName(e.target.value)}
                  className="w-full bg-slate-950 text-xs text-white border border-slate-900 rounded-lg p-2.5 font-mono focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-mono text-zinc-500 uppercase font-black block mb-1">
                    Category Type
                  </label>
                  <select
                    value={reqCategory}
                    onChange={(e) => setReqCategory(e.target.value)}
                    className="w-full bg-slate-950 text-xs text-zinc-300 border border-slate-900 rounded-lg p-2.5 cursor-pointer focus:outline-none focus:border-cyan-400"
                  >
                    <option value="Sports">Sports</option>
                    <option value="Movies">Movies</option>
                    <option value="News">News</option>
                    <option value="Entertainment">Entertainment</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-mono text-zinc-500 uppercase font-black block mb-1">
                    Direct Stream M3U8 (Optional)
                  </label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={reqStreamUrl}
                    onChange={(e) => setReqStreamUrl(e.target.value)}
                    className="w-full bg-slate-950 text-xs text-white border border-slate-900 rounded-lg p-2.5 font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={reqSubmitting}
                className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.25)]"
              >
                Assemble request <Send size={12} />
              </button>
            </form>
          </div>

          {reqSubmitted && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs p-3 rounded-lg font-sans flex items-start gap-2">
              <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
              <span>Query broadcasted! Sazi target satellites are on active pursuit.</span>
            </div>
          )}
        </div>

        {/* Historic Request Logs Review */}
        <div className="bg-[#0a0a0f] border border-[#1e293b]/25 p-6 rounded-2xl flex flex-col justify-between shadow-md h-[400px]">
          <div className="space-y-3 h-full flex flex-col">
            <h3 className="text-sm font-extrabold text-white tracking-widest font-mono uppercase flex items-center gap-2">
              <MessageSquare size={16} className="text-[#818cf8]" /> active satellite queries
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed font-sans">
              Track the calibration status of requested frequencies logged by your Sazi subscriber profile card:
            </p>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-cyan-500/20 mt-2">
              {historicalRequests.length > 0 ? (
                historicalRequests.map((req) => (
                  <div key={req.id} className="bg-slate-950 p-3 rounded-xl border border-slate-900 flex items-center justify-between font-mono text-[10px]">
                    <div>
                      <p className="font-bold text-white uppercase">{req.channelName}</p>
                      <span className="text-zinc-550 text-[8px] uppercase">{req.category}</span>
                    </div>

                    <span className={`px-2 py-0.5 rounded border text-[8px] font-bold uppercase ${
                      req.status === "approved" ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/5" :
                      req.status === "rejected" ? "border-rose-500/30 text-rose-400 bg-rose-500/5" :
                      "border-amber-500/30 text-amber-400 bg-amber-500/5"
                    }`}>
                      {req.status}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-zinc-650 text-[10px] font-mono tracking-widest">
                  NO ACTIVE SATELLITE QUERIES RECORDED
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Account Password Settings & Log Out Area */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
        
        {/* Account Password Settings */}
        <div className="bg-[#0a0a0f] border border-zinc-850 p-6 rounded-2xl space-y-4 shadow-md">
          <h3 className="text-sm font-extrabold text-white tracking-widest font-mono uppercase flex items-center gap-2">
            <Key size={16} className="text-cyan-400" /> Credential Management
          </h3>
          <p className="text-xs text-zinc-400 leading-relaxed font-sans">
            Need to update your password credentials? Trigger a highly secure verification email link to safely configure your new password.
          </p>
          
          {resetSent ? (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs p-3.5 rounded-xl font-sans flex items-start gap-2">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              <span>Password reset email dispatched successfully! Please check your inbox.</span>
            </div>
          ) : (
            <button
              id="prof-password-reset"
              onClick={handlePasswordReset}
              className="w-full py-2.5 bg-cyan-500/10 hover:bg-cyan-500 hover:text-black border border-cyan-500/20 text-cyan-400 text-xs font-bold font-sans tracking-wide rounded-xl transition-all cursor-pointer"
            >
              Request Password Reset Link
            </button>
          )}

          {errorMess && (
            <div className="text-xs text-rose-400 font-sans flex items-center gap-1.5 py-1">
              <AlertCircle size={14} className="shrink-0" />
              <span>{errorMess}</span>
            </div>
          )}
        </div>

        {/* End Active Session Controls */}
        <div className="bg-[#0a0a0f] border border-zinc-850 p-6 rounded-2xl flex flex-col justify-between shadow-md">
          <div className="space-y-2">
            <h3 className="text-sm font-extrabold text-white tracking-widest font-mono uppercase flex items-center gap-2">
              <LogOut size={16} className="text-rose-500" /> Session Control
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed font-sans">
              Log out of your current Sazi TV command session to safely terminate credentials tokens, preferences logs, and active players.
            </p>
          </div>

          <button
            id="prof-logout-action"
            onClick={() => signOutUser()}
            className="w-full mt-6 py-2.5 bg-rose-500/10 hover:bg-rose-600 hover:text-white border border-rose-500/20 text-rose-400 text-xs font-bold font-sans tracking-wide rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            Log Out Session <LogOut size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
