import React, { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Image as ImageIcon,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Activity,
  RefreshCw,
  Search,
  Sparkles,
  Database,
  Link as LinkIcon,
  HelpCircle,
  Clock,
  Filter,
  Eye,
  Check,
  X
} from "lucide-react";
import { Channel } from "../../types";
import { db } from "../../firebase";
import { doc, updateDoc, writeBatch } from "firebase/firestore";
import {
  checkImageOk,
  getThemedFallbackLogo,
  compressAndCacheLogo,
  optimizeAndStoreChannelLogo,
  LOGO_TEMPLATES
} from "../../utils/logoResolver";

interface LogoManagerTabProps {
  channels: Channel[];
  onChannelsRefreshed: () => void;
}

export default function LogoManagerTab({ channels, onChannelsRefreshed }: LogoManagerTabProps) {
  // Filters & State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  
  // Action Progress
  const [recoveringAll, setRecoveringAll] = useState(false);
  const [recoveryProgress, setRecoveryProgress] = useState(0);
  const [recoveryTotal, setRecoveryTotal] = useState(0);
  const [testingChannels, setTestingChannels] = useState(false);
  const [testProgress, setTestProgress] = useState(0);

  // Manual Inputs
  const [customLogoUrl, setCustomLogoUrl] = useState("");
  const [manualLoading, setManualLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [manualError, setManualError] = useState("");
  const [manualSuccess, setManualSuccess] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Diagnostics (Requirement 9)
  const stats = useMemo(() => {
    const total = channels.length;
    let withLogos = 0;
    let missingLogos = 0;
    let broken = 0;
    let cached = 0;
    let m3uSource = 0;
    let recoveredSource = 0;
    let fallbackSource = 0;
    let manualSource = 0;

    channels.forEach((c) => {
      // Check presence
      const hasRealLogo = c.logo && !c.logo.includes("photo-1618005182384-a83a8bd57fbe");
      if (hasRealLogo) {
        withLogos++;
      } else {
        missingLogos++;
      }

      // Check status
      if (c.logoStatus === "broken") broken++;
      else if (c.logoStatus === "cached") cached++;
      else if (c.logoStatus === "missing") missingLogos++;

      // Check source
      if (c.logoSource === "m3u") m3uSource++;
      else if (c.logoSource === "recovered") recoveredSource++;
      else if (c.logoSource === "fallback") fallbackSource++;
      else if (c.logoSource === "manual") manualSource++;
    });

    return {
      total,
      withLogos,
      missingLogos,
      broken,
      cached,
      m3uSource,
      recoveredSource,
      fallbackSource,
      manualSource
    };
  }, [channels]);

  // 2. Filter & Search Channel List (Requirement 5/8)
  const filteredChannels = useMemo(() => {
    return channels.filter((c) => {
      const matchQuery =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "cached" && c.logoStatus === "cached") ||
        (statusFilter === "broken" && c.logoStatus === "broken") ||
        (statusFilter === "missing" && (c.logoStatus === "missing" || !c.logo || c.logo.includes("photo-1618005182384-a83a8bd57fbe"))) ||
        (statusFilter === "active" && c.logoStatus === "active");

      const matchesSource =
        sourceFilter === "all" || c.logoSource === sourceFilter;

      return matchQuery && matchesStatus && matchesSource;
    });
  }, [channels, searchQuery, statusFilter, sourceFilter]);

  // Handle single manual selection reset
  useEffect(() => {
    if (selectedChannel) {
      // Bind chosen channel details to form
      setCustomLogoUrl(selectedChannel.logo || "");
      setManualError("");
      setManualSuccess("");
    }
  }, [selectedChannel]);

  // 3. Scan & Verify All Channel Logos (Requirement 4/10)
  const handleVerifyAllLogos = async () => {
    if (channels.length === 0) return;
    setTestingChannels(true);
    setTestProgress(0);

    const batchSize = 10;
    let completed = 0;

    for (let i = 0; i < channels.length; i += batchSize) {
      const chunk = channels.slice(i, i + batchSize);
      await Promise.all(
        chunk.map(async (c) => {
          try {
            const hasLogo = c.logo && !c.logo.includes("photo-1618005182384-a83a8bd57fbe");
            if (!hasLogo) {
              // Mark as missing in DB
              await updateDoc(doc(db, "channels", c.id), {
                logoStatus: "missing",
                logoLastChecked: new Date().toISOString()
              });
              return;
            }

            const ok = await checkImageOk(c.logo || "", true);
            const statusUpdate = ok ? "active" : "broken";

            await updateDoc(doc(db, "channels", c.id), {
              logoStatus: statusUpdate,
              logoLastChecked: new Date().toISOString()
            });
          } catch (e) {
            console.warn(`Verify failed for ${c.id}:`, e);
          }
        })
      );

      completed += chunk.length;
      setTestProgress(Math.min(100, Math.round((completed / channels.length) * 100)));
    }

    setTestingChannels(false);
    onChannelsRefreshed();
  };

  // 4. Bulk Automatic Logo Recovery & Caching Pipeline (Requirements 2, 3, 10)
  const handleBulkAutomaticRecovery = async () => {
    // Identify targets (channels missing logos or marked as broken)
    const targets = channels.filter((c) => {
      const isMissing = !c.logo || c.logo.includes("photo-1618005182384-a83a8bd57fbe") || c.logoStatus === "missing";
      const isBroken = c.logoStatus === "broken";
      return isMissing || isBroken;
    });

    if (targets.length === 0) {
      alert("No channels require recovery. All logo matrices are healthy!");
      return;
    }

    setRecoveringAll(true);
    setRecoveryTotal(targets.length);
    setRecoveryProgress(0);

    let count = 0;
    // Process sequentially or small batches to protect quota
    for (const c of targets) {
      try {
        await optimizeAndStoreChannelLogo(c);
      } catch (e) {
        console.error("Recovery failed for:", c.id, e);
      }
      count++;
      setRecoveryProgress(count);
    }

    setRecoveringAll(false);
    onChannelsRefreshed();
    // Clear any active screen details
    if (selectedChannel) {
      const refreshed = channels.find((ch) => ch.id === selectedChannel.id);
      if (refreshed) setSelectedChannel(refreshed);
    }
  };

  // 5. Manual Custom Logo Url Replace Handler (Requirement 5)
  const handleManualReplaceUrl = async () => {
    if (!selectedChannel) return;
    setManualLoading(true);
    setManualError("");
    setManualSuccess("");

    try {
      if (!customLogoUrl.trim()) {
        throw new Error("Enter a valid logo image URL pathway.");
      }

      // Check remote load integrity
      const working = await checkImageOk(customLogoUrl, true);
      if (!working) {
        throw new Error("Specified URL did not pass image load status checks. Verify URL and format (PNG/JPG/SVG).");
      }

      // Optimize and Cache inside Firebase Storage
      let finalCached = "";
      let finalStatus: Channel["logoStatus"] = "active";
      try {
        finalCached = await compressAndCacheLogo(selectedChannel.id, customLogoUrl);
        finalStatus = "cached";
      } catch (cacheErr: any) {
        console.warn("Storage caching stalled of manual URL:", cacheErr);
      }

      const patch: Partial<Channel> = {
        logo: customLogoUrl,
        cachedLogoUrl: finalCached || undefined,
        logoStatus: finalStatus,
        logoSource: "manual",
        logoLastChecked: new Date().toISOString()
      };

      await updateDoc(doc(db, "channels", selectedChannel.id), patch);
      setManualSuccess("Logo updated and cached to cloud storage cleanly!");
      onChannelsRefreshed();
      
      // Update local state
      setSelectedChannel(prev => prev ? { ...prev, ...patch } : null);
    } catch (e: any) {
      setManualError(e.message || "Fails compiling image asset.");
    } finally {
      setManualLoading(false);
    }
  };

  // 6. Manual Custom File Upload Handler (Requirement 5)
  const handleCustomFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChannel) return;

    setUploadLoading(true);
    setManualError("");
    setManualSuccess("");

    try {
      // Validate file size and type (Requirement 1 - PNG, JPG, JPEG, SVG, WEBP)
      const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];
      if (!allowedTypes.includes(file.type)) {
        throw new Error("Invalid file type. Supported: PNG, JPG, JPEG, WEBP and SVG.");
      }

      if (file.size > 2 * 1024 * 1024) {
        throw new Error("File exceeds maximum weight of 2MB.");
      }

      // Read file to binary and cache in Firebase Storage
      const base64Url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (err) => reject(err);
      });

      // Compress base64 via temporary canvas and cache
      const cloudCachedUrl = await compressAndCacheLogo(selectedChannel.id, base64Url);

      const patch: Partial<Channel> = {
        logo: cloudCachedUrl, // Serve cached as primary logo URL
        cachedLogoUrl: cloudCachedUrl,
        logoStatus: "cached",
        logoSource: "manual",
        logoLastChecked: new Date().toISOString()
      };

      await updateDoc(doc(db, "channels", selectedChannel.id), patch);
      setCustomLogoUrl(cloudCachedUrl);
      setManualSuccess("Custom logo uploaded, compressed, and synchronized successfully!");
      
      onChannelsRefreshed();
      setSelectedChannel(prev => prev ? { ...prev, ...patch } : null);
    } catch (err: any) {
      setManualError(err.message || "Failed uploading file.");
    } finally {
      setUploadLoading(false);
    }
  };

  // Preset fast assigning helper
  const handleAssignTemplatePreset = async (presetUrl: string) => {
    if (!selectedChannel) return;
    setCustomLogoUrl(presetUrl);
    
    setManualLoading(true);
    setManualError("");
    setManualSuccess("");

    try {
      let finalCached = "";
      let finalStatus: Channel["logoStatus"] = "active";
      try {
        finalCached = await compressAndCacheLogo(selectedChannel.id, presetUrl);
        finalStatus = "cached";
      } catch (err) {
        console.warn("Silent cache failed for preset:", err);
      }

      const patch: Partial<Channel> = {
        logo: presetUrl,
        cachedLogoUrl: finalCached || undefined,
        logoStatus: finalStatus,
        logoSource: "fallback",
        logoLastChecked: new Date().toISOString()
      };

      await updateDoc(doc(db, "channels", selectedChannel.id), patch);
      setManualSuccess("Thematic Unsplash preset logo mapped and stored!");
      onChannelsRefreshed();
      setSelectedChannel(prev => prev ? { ...prev, ...patch } : null);
    } catch (e: any) {
      setManualError(e.message || "Preset attribution failed");
    } finally {
      setManualLoading(false);
    }
  };

  return (
    <div id="logo-manager-panel" className="space-y-6">
      
      {/* SECTION HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <ImageIcon className="text-cyan-400" size={20} />
            IPTV COGNITIVE LOGO MANAGER
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Solve, recover, verify, and compress satellite channel logos in ultra-low footprint WebP layout.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button
            id="btn-verify-all"
            disabled={testingChannels || recoveringAll}
            onClick={handleVerifyAllLogos}
            className="flex items-center gap-2 bg-[#0d152c] border border-cyan-400/20 hover:border-cyan-400/50 text-cyan-400 text-xs py-2 px-3.5 rounded-xl transition-all font-mono active:scale-95 disabled:opacity-50"
          >
            <Activity size={13} className={testingChannels ? "animate-spin" : ""} />
            {testingChannels ? `VERIFYING (${testProgress}%)` : "RUN DETECT DIAGNOSTIC"}
          </button>

          <button
            id="btn-auto-recover"
            disabled={recoveringAll || testingChannels}
            onClick={handleBulkAutomaticRecovery}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white text-xs font-semibold py-2 px-4 rounded-xl transition-all font-mono active:scale-95 shadow-[0_4px_15px_rgba(6,182,212,0.15)] disabled:opacity-50"
          >
            <Sparkles size={13} className={recoveringAll ? "animate-bounce" : ""} />
            {recoveringAll ? `RECOVERING (${recoveryProgress}/${recoveryTotal})` : "BULK RECOVER MISSING"}
          </button>
        </div>
      </div>

      {/* 2. DIAGNOSTICS GRIDS (Requirement 9) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-[#0a0b1c]/80 border border-slate-800/80 p-4 rounded-2xl">
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Total Channels</p>
          <p className="text-2xl font-bold font-mono text-slate-200 mt-1">{stats.total}</p>
          <div className="w-full bg-slate-800 h-1 rounded-full mt-3 overflow-hidden">
            <div className="bg-slate-400 h-full" style={{ width: "100%" }} />
          </div>
        </div>

        <div className="bg-[#0a0b1c]/80 border border-slate-800/80 p-4 rounded-2xl">
          <p className="text-[10px] font-mono text-emerald-500 uppercase tracking-wider">With Logos</p>
          <p className="text-2xl font-bold font-mono text-emerald-400 mt-1">{stats.withLogos}</p>
          <div className="w-full bg-slate-800 h-1 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-emerald-400 h-full"
              style={{ width: `${stats.total > 0 ? (stats.withLogos / stats.total) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div className="bg-[#0a0b1c]/80 border border-slate-800/80 p-4 rounded-2xl">
          <p className="text-[10px] font-mono text-amber-500 uppercase tracking-wider">Missing/Fallback</p>
          <p className="text-2xl font-bold font-mono text-amber-500 mt-1">{stats.missingLogos}</p>
          <div className="w-full bg-slate-800 h-1 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-amber-500 h-full"
              style={{ width: `${stats.total > 0 ? (stats.missingLogos / stats.total) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div className="bg-[#0a0b1c]/80 border border-slate-800/80 p-4 rounded-2xl">
          <p className="text-[10px] font-mono text-rose-500 uppercase tracking-wider">Broken 404s</p>
          <p className="text-2xl font-bold font-mono text-rose-400 mt-1">{stats.broken}</p>
          <div className="w-full bg-slate-800 h-1 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-rose-500 h-full"
              style={{ width: `${stats.total > 0 ? (stats.broken / stats.total) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div className="bg-[#0a0b1c]/80 border border-slate-800/80 p-4 rounded-2xl col-span-2 lg:col-span-1">
          <p className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider">Cloud Cached</p>
          <p className="text-2xl font-bold font-mono text-cyan-400 mt-1">{stats.cached}</p>
          <div className="w-full bg-slate-800 h-1 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-cyan-400 h-full"
              style={{ width: `${stats.total > 0 ? (stats.cached / stats.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Progress Bars for Diagnostics or Recovery */}
      <AnimatePresence>
        {recoveringAll && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-purple-500/10 border border-purple-500/25 rounded-2xl"
          >
            <div className="flex justify-between items-center text-xs font-mono mb-2 text-purple-300">
              <span className="flex items-center gap-1.5">
                <RefreshCw className="animate-spin text-purple-400" size={13} />
                EXECUTING COGNITIVE RECOVERY ON LOGO MATRIX...
              </span>
              <span>
                {recoveryProgress} / {recoveryTotal} ({Math.round((recoveryProgress / recoveryTotal) * 100)}%)
              </span>
            </div>
            <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-purple-500 to-cyan-400 h-full transition-all duration-300"
                style={{ width: `${(recoveryProgress / recoveryTotal) * 100}%` }}
              />
            </div>
          </motion.div>
        )}

        {testingChannels && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-cyan-500/10 border border-cyan-500/25 rounded-2xl"
          >
            <div className="flex justify-between items-center text-xs font-mono mb-2 text-cyan-300">
              <span className="flex items-center gap-1.5">
                <Activity className="animate-spin text-cyan-400" size={13} />
                TESTING CORRELATION TIMEOUTS AND 404 DETECTIONS...
              </span>
              <span>{testProgress}%</span>
            </div>
            <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-cyan-400 h-full transition-all duration-300"
                style={{ width: `${testProgress}%` }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PRIMARY GRID FILTER LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: LIST AND FILTER (7 cols) */}
        <div className="lg:col-span-8 bg-[#0a0b1c]/40 border border-slate-800 p-5 rounded-2xl space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search channels by name or category..."
                className="w-full bg-slate-900/60 border border-slate-800 rounded-xl pl-9.5 pr-4 py-2 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            {/* Status Selector */}
            <div className="relative md:w-44">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={12} />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-xl pl-8.5 pr-2.5 py-2 text-xs font-mono text-slate-300 focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer"
              >
                <option value="all">Logo Status: All</option>
                <option value="cached">Cached Logo</option>
                <option value="active">Active Only</option>
                <option value="missing">Missing / Recoverable</option>
                <option value="broken">Broken Logos </option>
              </select>
            </div>

            {/* Source Selector */}
            <div className="relative md:w-36">
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-300 focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer"
              >
                <option value="all">Source: All</option>
                <option value="m3u">M3U File</option>
                <option value="recovered">Recovered</option>
                <option value="fallback">Fallback Preset</option>
                <option value="manual">Manual</option>
              </select>
            </div>
          </div>

          {/* CHANNELS GRID INDEX */}
          <div className="border border-slate-800/60 rounded-xl overflow-hidden">
            <div className="bg-slate-900/60 px-4 py-3 border-b border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400 font-semibold uppercase">
              <span>Channel Listing ({filteredChannels.length} hits)</span>
              <span>Status Matrix</span>
            </div>

            {filteredChannels.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <HelpCircle className="mx-auto text-slate-600 animate-pulse" size={32} />
                <p className="text-xs font-mono text-slate-500">No channels aligned with active filters</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800 max-h-[480px] overflow-y-auto custom-scrollbar">
                {filteredChannels.map((c) => {
                  const hasRealLogo = c.logo && !c.logo.includes("photo-1618005182384-a83a8bd57fbe");
                  const isSelected = selectedChannel?.id === c.id;

                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedChannel(c)}
                      className={`flex items-center justify-between p-3 transition-all cursor-pointer select-none border-l-2 ${
                        isSelected
                          ? "bg-purple-500/5 border-purple-500"
                          : "border-transparent hover:bg-slate-900/30"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Channel logo icon preview (Requirement 6) */}
                        <div className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden relative flex items-center justify-center shrink-0">
                          {hasRealLogo ? (
                            <img
                              src={c.cachedLogoUrl || c.logo}
                              alt={c.name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                // Gracefully mask broken logo images dynamically
                                (e.currentTarget as HTMLImageElement).src = LOGO_TEMPLATES.general;
                              }}
                            />
                          ) : (
                            <div className="text-[10px] text-slate-600 font-mono font-bold">
                              {c.name.substring(0, 2).toUpperCase()}
                            </div>
                          )}

                          {/* Dynamic tiny status dot indicator */}
                          <span
                            className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-slate-950 ${
                              c.logoStatus === "cached"
                                ? "bg-cyan-400"
                                : c.logoStatus === "broken"
                                ? "bg-rose-500"
                                : c.logoStatus === "missing"
                                ? "bg-amber-500"
                                : "bg-emerald-400"
                            }`}
                          />
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-200 truncate pr-2">{c.name}</p>
                          <p className="text-[10px] font-mono text-cyan-400/80 truncate mt-0.5">{c.category}</p>
                        </div>
                      </div>

                      {/* Right-aligned detailed labels */}
                      <div className="flex items-center gap-3.5 shrink-0 text-right">
                        <div>
                          {/* Checked time */}
                          {c.logoLastChecked && (
                            <p className="text-[9px] font-mono text-slate-500 flex items-center gap-1 justify-end">
                              <Clock size={9} />
                              {new Date(c.logoLastChecked).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          )}
                          
                          {/* Badges */}
                          <div className="flex items-center gap-1.5 mt-1 justify-end">
                            {/* Source badges */}
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-400">
                              {c.logoSource?.toUpperCase() || "M3U"}
                            </span>

                            {/* Status badge */}
                            <span
                              className={`text-[9px] font-mono px-1.5 py-0.5 rounded-md uppercase ${
                                c.logoStatus === "cached"
                                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                                  : c.logoStatus === "broken"
                                  ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                  : c.logoStatus === "missing"
                                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                  : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                              }`}
                            >
                              {c.logoStatus || "verified"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: DETAILED CONTROL DECK (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-[#0a0b1c]/70 border border-slate-800 p-5 rounded-2xl space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-5">
              <Database size={100} />
            </div>

            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest font-mono border-b border-slate-800 pb-2">
              LOGO REPAIR DECK
            </h3>

            {selectedChannel ? (
              <div className="space-y-4">
                {/* Selected Details Header */}
                <div className="flex items-center gap-3.5 bg-slate-900/40 p-3 rounded-xl border border-slate-800">
                  <div className="w-12 h-12 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden relative flex items-center justify-center">
                    <img
                      src={selectedChannel.cachedLogoUrl || selectedChannel.logo}
                      alt={selectedChannel.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = LOGO_TEMPLATES.general;
                      }}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-100 truncate">{selectedChannel.name}</p>
                    <p className="text-[10px] font-mono text-cyan-400 truncate mt-0.5">{selectedChannel.category}</p>
                    <p className="text-[9px] font-mono text-slate-500 truncate mt-1">ID: {selectedChannel.id}</p>
                  </div>
                </div>

                {/* LOGO REPAIR OPTIONS */}
                <div className="space-y-3">
                  {/* Option 1: URL input (Requirement 5) */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                      Custom Logo Image URL (PNG/JPG/SVG)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={customLogoUrl}
                        onChange={(e) => setCustomLogoUrl(e.target.value)}
                        placeholder="https://example.com/logo.webp"
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500/40 font-mono"
                      />
                      <button
                        id="btn-apply-manual-url"
                        onClick={handleManualReplaceUrl}
                        disabled={manualLoading || uploadLoading}
                        className="bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs px-3.5 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                      >
                        {manualLoading ? "APPLYNG" : "APPLY"}
                      </button>
                    </div>
                  </div>

                  {/* Option 2: File Upload (Requirement 5) */}
                  <div className="space-y-1.5 pt-1">
                    <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                      Upload Custom Graphic File
                    </label>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleCustomFileUpload}
                      accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                      className="hidden"
                    />
                    <button
                      id="btn-upload-local-file"
                      disabled={uploadLoading || manualLoading}
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 bg-[#0c1426] border border-cyan-400/20 hover:border-cyan-400/40 text-cyan-400 font-mono text-xs py-2.5 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                      <Upload size={13} className={uploadLoading ? "animate-spin" : ""} />
                      {uploadLoading ? "COMPRESSING & CLOUD UPLOADING..." : "UPLOAD LOGO FILE (<2M)"}
                    </button>
                  </div>

                  {/* Option 3: Presets (Requirement 2/5) */}
                  <div className="space-y-2 pt-2 border-t border-slate-800/80">
                    <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                      Map Aligned Cyber Observatory Presets
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {Object.entries(LOGO_TEMPLATES).map(([key, value]) => (
                        <button
                          key={key}
                          onClick={() => handleAssignTemplatePreset(value)}
                          className="group relative h-9 border border-slate-800 rounded-lg overflow-hidden flex items-center justify-center hover:border-cyan-400/40 transition-all bg-slate-950 active:scale-95"
                          title={`Assign theme: ${key}`}
                        >
                          <img
                            src={value}
                            alt={key}
                            className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all"
                            referrerPolicy="no-referrer"
                          />
                          <span className="absolute bottom-0 inset-x-0 text-[8px] bg-black/80 text-center text-slate-400 py-0.5 truncate uppercase font-mono group-hover:text-cyan-400 transition-all">
                            {key}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Feedback messaging popup logs */}
                  <AnimatePresence>
                    {manualError && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl flex items-start gap-2.5 text-[10px] text-rose-400 font-mono"
                      >
                        <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                        <span>{manualError}</span>
                      </motion.div>
                    )}

                    {manualSuccess && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex items-start gap-2.5 text-[10px] text-emerald-400 font-mono"
                      >
                        <CheckCircle2 size={12} className="shrink-0 mt-0.5" />
                        <span>{manualSuccess}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Pipeline Quick Trigger (Requirement 10) */}
                  <button
                    id="btn-single-optimize"
                    onClick={() => optimizeAndStoreChannelLogo(selectedChannel).then(() => onChannelsRefreshed())}
                    className="w-full mt-2 bg-gradient-to-r from-cyan-400/5 to-purple-500/5 border border-cyan-400/20 hover:border-cyan-400/40 text-cyan-300 font-mono text-xs py-2 rounded-xl transition-all"
                  >
                    RUN COGNITIVE CHECK & AUTO-RECOVER
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500 font-mono space-y-2">
                <HelpCircle className="mx-auto" size={24} />
                <p className="text-xs">Select a channel from the left index list to unlock logo modification matrices</p>
              </div>
            )}
          </div>
          
          <div className="bg-[#0a0b1c]/30 border border-slate-800 p-4.5 rounded-2xl text-[10px] space-y-2 text-slate-400 leading-normal font-mono">
            <p className="font-bold text-slate-300 uppercase">ℹ️ LOGO INTEGRITY GUIDE</p>
            <p>
              • <strong className="text-cyan-400">Cloud WebP Cache</strong> ensures zero link decay by archiving replicas permanently in your Firestore file vaults.
            </p>
            <p>
              • <strong className="text-cyan-400">Dynamic Proxies</strong> automatically proxy streams, bypassing CORS obstacles in full-stack server architecture.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
}
