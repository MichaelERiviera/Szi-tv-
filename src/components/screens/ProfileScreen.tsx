import { useState, useMemo } from "react";
import { User, Mail, Calendar, Key, Shield, LogOut, Star, Clock, AlertCircle, CheckCircle2, Play } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Favorite, WatchHistory, Channel } from "../../types";

interface ProfileScreenProps {
  favorites: Favorite[];
  watchHistory: WatchHistory[];
  channels: Channel[];
  onSelectChannel: (chan: Channel) => void;
  onToggleFavorite: (chanId: string) => void;
}

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

  return (
    <div className="max-w-5xl mx-auto space-y-8 font-sans pb-12 text-zinc-100">
      
      {/* User Information Passport */}
      <div className="bg-[#09090d]/80 backdrop-blur-md border border-cyan-500/10 p-6 rounded-2xl flex flex-col md:flex-row gap-6 items-center shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-3 border-l border-b border-cyan-500/15 bg-zinc-950/80 text-cyan-400 font-mono text-[9px] uppercase tracking-widest font-bold rounded-bl-xl">
          USER PROFILE
        </div>
        
        {/* Glow Avatar */}
        <div className="relative shrink-0 select-none">
          <div className="w-20 h-20 bg-gradient-to-tr from-cyan-400 to-blue-500 rounded-full flex items-center justify-center p-0.5 shadow-[0_0_20px_rgba(34,211,238,0.3)]">
            <div className="w-full h-full bg-[#050610] rounded-full flex items-center justify-center text-cyan-400">
              <User size={36} />
            </div>
          </div>
          {profile?.role === "admin" && (
            <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-violet-600 to-indigo-600 text-white p-1 rounded-full border border-violet-400 shadow" title="System Commandant">
              <Shield size={12} />
            </div>
          )}
        </div>

        <div className="text-center md:text-left space-y-1">
          <h2 className="text-xl font-black text-white tracking-wide">
            {profile?.displayName || user?.displayName || "Sazi TV User"}
          </h2>
          <p className="text-xs text-cyan-400 font-mono tracking-widest uppercase">
            {profile?.role === "admin" ? "ADMINISTRATOR" : "SUBSCRIBER MEMBER"}
          </p>
          <p className="text-xs text-zinc-400 flex items-center justify-center md:justify-start gap-1 w-full truncate">
            <Mail size={13} className="text-zinc-500 shrink-0" /> {user?.email || "No email credential"}
          </p>
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
            <p className="text-xs text-zinc-450">You haven't bookmarked any favorite channels yet.</p>
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

      {/* Account Settings Adjustments */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
        
        {/* Account Password Settings */}
        <div className="bg-[#0a0a0f] border border-zinc-850 p-6 rounded-2xl space-y-4 shadow-md">
          <h3 className="text-sm font-extrabold text-white tracking-widest font-mono uppercase flex items-center gap-2">
            <Key size={16} className="text-cyan-400" /> Account Settings
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
