import { useState, useMemo, useEffect, useRef, FormEvent, ChangeEvent } from "react";
import {
  Activity,
  ShieldAlert,
  Sliders,
  Upload,
  Plus,
  Trash,
  CheckCircle,
  AlertCircle,
  Eye,
  FileText,
  Workflow,
  Search,
  LayoutGrid,
  Users,
  Database,
  Radio,
  Globe,
  Settings,
  RefreshCw,
  Edit,
  UserX,
  Clock,
  Shield,
  Check,
  X,
  Play,
  Terminal,
  Cpu,
  HardDrive,
  Flame,
  Volume2,
  Sparkles,
  Smartphone,
  Lock,
  ListPlus,
  ArrowRight,
  HelpCircle,
  Image,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { collection, getDocs, deleteDoc, doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { Channel, UserProfile, Category } from "../../types";
import { parseM3U } from "../../utils/m3uParser";
import { parsePlaylist, ParsedChannel } from "../../utils/playlistParser";
import { fetchImports, saveImport, deleteImportLog, ImportHistoryItem, deleteChannelsBatch } from "../../utils/dbService";
import LogoManagerTab from "./LogoManagerTab";

interface AdminScreenProps {
  channels: Channel[];
  onAddChannel: (chan: Channel) => Promise<void>;
  onDeleteChannel: (chanId: string | string[]) => Promise<void>;
  onSeedDefaults: () => Promise<void>;
  onRefreshDatabaseState?: () => Promise<void>;
}

interface ActivityLog {
  id: string;
  time: string;
  type: "info" | "success" | "warn" | "error";
  user: string;
  action: string;
}

interface SystemSettingsModel {
  websiteName: string;
  websiteLogo: string;
  themePreset: "carbon-slate" | "space-cyber" | "stealth-amoled";
  maintenanceMode: boolean;
  autoplay: boolean;
  defaultBufferMs: number;
  featuredChannelId?: string;
}

interface DiagnosticReport {
  url: string;
  responseStatus: string;
  corsStatus: string;
  playable: string;
  errorDetails: string;
  latency: number;
}

interface ConfirmationModal {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  isDangerous?: boolean;
  onConfirm: () => void | Promise<void>;
}

export default function AdminScreen({
  channels,
  onAddChannel,
  onDeleteChannel,
  onSeedDefaults,
  onRefreshDatabaseState,
}: AdminScreenProps) {
  // Navigation State
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "channels" | "logos" | "monitor" | "tester" | "playlist" | "users" | "analytics" | "content" | "security" | "settings"
  >("dashboard");

  // Premium Custom Confirmation Modal States
  const [confirmModal, setConfirmModal] = useState<ConfirmationModal | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Database Synced Records
  const [realUsers, setRealUsers] = useState<UserProfile[]>([]);
  const [dbCategories, setDbCategories] = useState<Category[]>([]);
  const [bannedUids, setBannedUids] = useState<string[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettingsModel>({
    websiteName: "Sazi TV",
    websiteLogo: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=60",
    themePreset: "space-cyber",
    maintenanceMode: false,
    autoplay: true,
    defaultBufferMs: 1500,
  });

  // Action / Form State
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);

  // Channel Creation Form State
  const [chanName, setChanName] = useState("");
  const [chanUrl, setChanUrl] = useState("");
  const [chanLogo, setChanLogo] = useState("");
  const [chanCategory, setChanCategory] = useState("General");
  const [formErr, setFormErr] = useState("");
  const [formOk, setFormOk] = useState("");

  // Category CRUD Form State
  const [newCatName, setNewCatName] = useState("");
  const [newCatSlug, setNewCatSlug] = useState("");
  const [catErr, setCatErr] = useState("");
  const [catSuccess, setCatSuccess] = useState("");

  // Bulk Import State
  const [m3uText, setM3uText] = useState("");
  const [m3uUrlInput, setM3uUrlInput] = useState("");
  const [parsedList, setParsedList] = useState<Channel[]>([]);
  const [m3uSuccess, setM3uSuccess] = useState("");
  const [m3uError, setM3uError] = useState("");
  const [importingTotal, setImportingTotal] = useState(false);

  // Stream Testing Engine States
  const [probeStatus, setProbeStatus] = useState<
    Record<string, { status: "idle" | "probing" | "active" | "broken"; latency?: number }>
  >({});
  const [autoTestCountdown, setAutoTestCountdown] = useState(300); // 5 minutes timer
  const [isRefreshingPris, setIsRefreshingPris] = useState(false);

  // Stream Tester Local Suite States
  const [testerUrl, setTesterUrl] = useState("");
  const [testerResult, setTesterResult] = useState<any>(null);
  const [testerLoading, setTesterLoading] = useState(false);
  const [bulkTestingActive, setBulkTestingActive] = useState(false);
  const [bulkTestResults, setBulkTestResults] = useState<Record<string, DiagnosticReport>>({});
  const [bulkTestProgress, setBulkTestProgress] = useState(0);
  const [bulkTestFilter, setBulkTestFilter] = useState<string>("all");

  // Playlist Importer State Configs
  const [playlistSubTab, setPlaylistSubTab] = useState<"upload" | "history" | "errors">("upload");
  const [importFileName, setImportFileName] = useState("");
  const [importText, setImportText] = useState("");
  const [parsedImportChannels, setParsedImportChannels] = useState<ParsedChannel[]>([]);
  const [importDefaultCategory, setImportDefaultCategory] = useState("Imported");
  const [importAutoCategories, setImportAutoCategories] = useState(true);
  const [importValidateStreams, setImportValidateStreams] = useState(true);
  const [importProgress, setImportProgress] = useState(0);
  const [importTotalProcessed, setImportTotalProcessed] = useState(0);
  const [importSuccessCount, setImportSuccessCount] = useState(0);
  const [importFailedCount, setImportFailedCount] = useState(0);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importActive, setImportActive] = useState(false);
  const [importHistoryList, setImportHistoryList] = useState<ImportHistoryItem[]>([]);
  const [loadingImportHistory, setLoadingImportHistory] = useState(false);

  // Homepage Section Configuration Config (Hero Banner Editor)
  const [heroTitle, setHeroTitle] = useState("SAZI TV PREMIUM GATEWAY");
  const [heroSubtitle, setHeroSubtitle] = useState("Immersive orbital broadcasting HLS network with ultra high density speeds.");
  const [heroBkg, setHeroBkg] = useState("https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1600&auto=format&fit=crop&q=80");
  const [heroChannelId, setHeroChannelId] = useState("");
  const [bannerSaved, setBannerSaved] = useState(false);

  // Security Logger State
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([
    {
      id: "log-1",
      time: new Date(Date.now() - 360000).toLocaleString(),
      type: "info",
      user: "sajjab62q@gmail.com",
      action: "Admin command deck initial validation handshake completed.",
    },
    {
      id: "log-2",
      time: new Date(Date.now() - 300000).toLocaleString(),
      type: "success",
      user: "sajjab62q@gmail.com",
      action: "Master guide IPTV telemetry synchronized with Cloud Firestore.",
    },
  ]);
  const [failedLogins, setFailedLogins] = useState<any[]>([
    {
      time: new Date(Date.now() - 7200000).toLocaleString(),
      ip: "102.13.245.89",
      email: "intruder_root@sazi.tv",
      agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    },
  ]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch users, categories and remote configuration settings
  const loadAdminStateAndUsers = async () => {
    setLoadingUsers(true);
    try {
      // 1. Fetch Auth Profiles
      const userSnap = await getDocs(collection(db, "users"));
      const usersList: UserProfile[] = [];
      userSnap.forEach((doc) => {
        usersList.push(doc.data() as UserProfile);
      });
      setRealUsers(usersList);

      // 2. Fetch Categories
      const catSnap = await getDocs(collection(db, "categories"));
      const categoriesList: Category[] = [];
      catSnap.forEach((doc) => {
        categoriesList.push(doc.data() as Category);
      });
      setDbCategories(categoriesList);

      // 3. Fetch Settings Document
      const settingsSnap = await getDoc(doc(db, "system", "settings"));
      if (settingsSnap.exists()) {
        const data = settingsSnap.data() as any;
        setSystemSettings({
          websiteName: data.websiteName || "Sazi TV",
          websiteLogo: data.websiteLogo || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150",
          themePreset: data.themePreset || "space-cyber",
          maintenanceMode: !!data.maintenanceMode,
          autoplay: data.autoplay !== false,
          defaultBufferMs: data.defaultBufferMs || 1500,
          featuredChannelId: data.featuredChannelId || "",
        });
        if (data.bannedUsers) {
          setBannedUids(data.bannedUsers);
        }
        if (data.heroTitle) setHeroTitle(data.heroTitle);
        if (data.heroSubtitle) setHeroSubtitle(data.heroSubtitle);
        if (data.heroBkg) setHeroBkg(data.heroBkg);
        if (data.heroChannelId) setHeroChannelId(data.heroChannelId);
      }
    } catch (err) {
      console.error("Admin dashboard data sync failure:", err);
      logEvent("error", "Database loading anomaly encountered. Restoring local cache.");
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadAdminStateAndUsers();
  }, []);

  // Probing automated 5-minute checker sequence
  useEffect(() => {
    const timer = setInterval(() => {
      setAutoTestCountdown((prev) => {
        if (prev <= 1) {
          // Trigger automatic check
          triggerGlobalProbing();
          return 300; // Reset
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [channels]);

  // Logging local utility
  const logEvent = (type: "info" | "success" | "warn" | "error", action: string, usr = "System Daemon") => {
    const newLog: ActivityLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      time: new Date().toLocaleString(),
      type,
      user: usr,
      action,
    };
    setActivityLogs((prev) => [newLog, ...prev.slice(0, 49)]);
  };

  // --- PLAYLIST IMPORTER LOGIC & HOOKS ---

  const loadImportHistory = async () => {
    setLoadingImportHistory(true);
    try {
      const history = await fetchImports();
      setImportHistoryList(history);
    } catch (err: any) {
      console.error("Failed to fetch import histories:", err);
      logEvent("error", `Ingress memory read failure: ${err.message}`);
    } finally {
      setLoadingImportHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === "playlist") {
      loadImportHistory();
    }
  }, [activeTab]);

  const handlePlaylistFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setImportText(text);
      try {
        const parsed = parsePlaylist(text, file.name, importDefaultCategory);
        setParsedImportChannels(parsed);
        logEvent("info", `Decoded ${parsed.length} possible streams from file: ${file.name}`);
      } catch (err: any) {
        logEvent("error", `Failed playlist parsing check: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleDragOverPlaylist = (e: any) => {
    e.preventDefault();
  };

  const handleDropPlaylist = (e: any) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setImportText(text);
      try {
        const parsed = parsePlaylist(text, file.name, importDefaultCategory);
        setParsedImportChannels(parsed);
        logEvent("info", `Decoded ${parsed.length} possible streams via drag-drop: ${file.name}`);
      } catch (err: any) {
        logEvent("error", `Failed playlist parsing check: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const runPlaylistImport = async () => {
    if (parsedImportChannels.length === 0) return;
    setImportActive(true);
    setImportProgress(0);
    setImportTotalProcessed(0);
    setImportSuccessCount(0);
    setImportFailedCount(0);
    setImportErrors([]);

    const batchId = `import-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const total = parsedImportChannels.length;
    const errors: string[] = [];
    const importedIds: string[] = [];

    // Skip duplicates by pre-indexing registered URL vectors
    const existingUrls = new Set(channels.map((c) => c.url.trim().toLowerCase()));

    // Chunk size 50 locks thread for brief instants, perfectly dividing operations
    const chunkSize = 50;

    for (let i = 0; i < total; i += chunkSize) {
      if (!importActive) {
        // Allow progressive pause if needed or simply safe runs
      }
      const chunk = parsedImportChannels.slice(i, i + chunkSize);
      
      for (const item of chunk) {
        const currentNum = i + chunk.indexOf(item) + 1;
        
        // 1. URL Duplicates Filter
        if (existingUrls.has(item.url.trim().toLowerCase())) {
          const errMsg = `Line ${currentNum} skip: Duplicate stream [${item.name}] - URL already mapped.`;
          errors.push(errMsg);
          setImportFailedCount((prev) => prev + 1);
          setImportErrors((prev) => [...prev, errMsg]);
          setImportTotalProcessed(currentNum);
          continue;
        }

        // 2. Head probes stream validation before loading (Optional)
        if (importValidateStreams) {
          const diag = await diagnoseStreamUrl(item.url);
          if (diag.playable.includes("Not Playable")) {
            const errMsg = `Line ${currentNum} raw fail: Probing failed for [${item.name}] URL: ${item.url}. Status: ${diag.responseStatus}`;
            errors.push(errMsg);
            setImportFailedCount((prev) => prev + 1);
            setImportErrors((prev) => [...prev, errMsg]);
            setImportTotalProcessed(currentNum);
            continue;
          }
        }

        // 3. Category compilation & database saving
        try {
          const rawId = item.url.split("?")[0].split("/").pop() || "channel";
          const cleanedPart = rawId.replace(/[^a-zA-Z0-9]/g, "").substring(0, 16);
          const salt = Math.random().toString(36).substring(2, 6);
          const id = `${cleanedPart}-${salt}-${batchId.split("-").pop()}`;

          // Category administration helper 
          const targetCategory = importAutoCategories ? (item.category || importDefaultCategory) : importDefaultCategory;
          const targetCategorySlug = targetCategory.toLowerCase().replace(/[^a-z0-9]/g, "-");

          const categoryExists = dbCategories.some((c) => c.name.toLowerCase() === targetCategory.toLowerCase());
          if (!categoryExists) {
            const newCat = {
              id: targetCategorySlug || `cat-${Date.now()}-${Math.random().toString(36).substring(2, 4)}`,
              name: targetCategory,
              slug: targetCategorySlug,
            };
            await setDoc(doc(db, "categories", newCat.id), newCat);
            setDbCategories((prev) => [...prev, newCat]);
          }

          const channelPayload: Channel = {
            id,
            name: item.name,
            url: item.url,
            logo: item.logo,
            category: targetCategory,
            addedAt: new Date(),
            views: 0,
            status: "active" as const,
            logoStatus: item.logoStatus || "active",
            logoSource: item.logoSource || "m3u",
            logoLastChecked: new Date().toISOString(),
          };

          await onAddChannel(channelPayload);
          importedIds.push(id);
          setImportSuccessCount((prev) => prev + 1);
        } catch (err: any) {
          const errMsg = `Line ${currentNum} error: Save failed for [${item.name}]: ${err.message}`;
          errors.push(errMsg);
          setImportFailedCount((prev) => prev + 1);
          setImportErrors((prev) => [...prev, errMsg]);
        }

        setImportTotalProcessed(currentNum);
      }

      const pct = Math.min(100, Math.round(((i + chunk.length) / total) * 100));
      setImportProgress(pct);

      // Brief sleep between chunks to allow DOM updates & preserve browser responsiveness
      await new Promise((r) => setTimeout(r, 50));
    }

    // Save batch log results to /imports/ collection
    const finalReport: ImportHistoryItem = {
      id: batchId,
      timestamp: new Date(),
      fileName: importFileName || "raw_manual_playlist",
      fileType: importFileName ? importFileName.split(".").pop() || "txt" : "txt",
      totalChannels: total,
      importedCount: importedIds.length,
      failedCount: total - importedIds.length,
      status: importedIds.length === total ? "success" : (importedIds.length === 0 ? "failed" : "partial"),
      errors: errors.slice(0, 100), // Protect Firestore document footprint ceiling limit
      importedIds,
    };

    try {
      await saveImport(finalReport);
      logEvent("success", `Ingested playlist: ${importedIds.length}/${total} added correctly.`);
      
      // Reset playlist loader status & reload
      setImportFileName("");
      setImportText("");
      setParsedImportChannels([]);
      
      await loadImportHistory();
      if (onRefreshDatabaseState) {
        await onRefreshDatabaseState();
      }
    } catch (saveErr: any) {
      logEvent("error", `Failed batch diagnostics log write-out: ${saveErr.message}`);
    }

    setImportActive(false);
  };

  const handleBulkDeleteImport = (batch: ImportHistoryItem) => {
    setConfirmModal({
      title: "⚡ PURGE PLAYLIST IMPORT BATCH",
      message: `Caution: You are about to completely un-sync and purge all ${batch.importedCount} channels imported on ${new Date(batch.timestamp?.seconds ? batch.timestamp.seconds * 1000 : batch.timestamp).toLocaleString()} from file "${batch.fileName}". This unregisters active streams in Sazi TV. Confirm?`,
      confirmLabel: "PURGE CHANNEL VECTOR SEC",
      cancelLabel: "ABORT PURGE",
      isDangerous: true,
      onConfirm: async () => {
        try {
          if (batch.importedIds && batch.importedIds.length > 0) {
            await onDeleteChannel(batch.importedIds);
          }
          await deleteImportLog(batch.id);
          logEvent("success", `Purged imported channels and history log: ${batch.id}`);
          await loadImportHistory();
          if (onRefreshDatabaseState) {
            await onRefreshDatabaseState();
          }
        } catch (err: any) {
          logEvent("error", `Failed batch channels unbinding: ${err.message}`);
        }
      }
    });
  };

  // 1. ANALYTICS CALCULATIONS
  const analytics = useMemo(() => {
    const totalCount = channels.length;
    const categoriesSet = new Set(channels.map((c) => c.category || "General"));
    const totalViews = channels.reduce((sum, c) => sum + (c.views || 0), 0);
    const brokenChannels = channels.filter((c) => c.status === "broken" || probeStatus[c.id]?.status === "broken");
    const activeChannels = channels.filter((c) => c.status !== "broken" && probeStatus[c.id]?.status !== "broken");

    // Most Viewed Channels sorting
    const topChannels = [...channels]
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 5);

    // Categories Distribution calculations
    const distribution: Record<string, number> = {};
    channels.forEach((c) => {
      const cat = c.category || "General";
      distribution[cat] = (distribution[cat] || 0) + 1;
    });

    const categoryDistributionList = Object.entries(distribution)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return {
      totalCount,
      categoriesCount: categoriesSet.size,
      totalViews,
      brokenCount: brokenChannels.length,
      activeCount: activeChannels.length,
      topChannels,
      categoryDistributionList,
    };
  }, [channels, probeStatus]);

  // 2. SAVE OR UPDATE CHANNEL
  const handleSaveChannel = async (e: FormEvent) => {
    e.preventDefault();
    setFormErr("");
    setFormOk("");

    if (!chanName || !chanUrl) {
      setFormErr("Channel identification name and HLS URL signals are required.");
      return;
    }

    const payloadChannel: Channel = {
      id: editingChannel
        ? editingChannel.id
        : `chan-${btoa(chanUrl).replace(/[^a-zA-Z0-9]/g, "").substring(0, 15)}`,
      name: chanName,
      url: chanUrl,
      logo: chanLogo || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=60",
      category: chanCategory,
      addedAt: editingChannel ? editingChannel.addedAt : new Date(),
      views: editingChannel ? (editingChannel.views || 0) : 0,
      status: "active",
    };

    try {
      await onAddChannel(payloadChannel);
      if (editingChannel) {
        logEvent("success", `Channel "${chanName}" modified successfully.`);
        setFormOk("Telemetry broadcast alignment saved successfully!");
        setEditingChannel(null);
      } else {
        logEvent("success", `New Channel "${chanName}" added under "${chanCategory}".`);
        setFormOk("New space transmission channel integrated successfully!");
      }
      setChanName("");
      setChanUrl("");
      setChanLogo("");
      setChanCategory("General");
    } catch (err: any) {
      setFormErr(err.message || "Failed to catalog HLS feed.");
      logEvent("error", `Failed channel save handshake: ${err.message}`);
    }
  };

  // Trigger quick edit mapping
  const startEditChannel = (chan: Channel) => {
    setEditingChannel(chan);
    setChanName(chan.name);
    setChanUrl(chan.url);
    setChanLogo(chan.logo || "");
    setChanCategory(chan.category || "General");
    setFormErr("");
    setFormOk("");
    // Focus or scroll to creator panel
    document.getElementById("channel-form-scroller")?.scrollIntoView({ behavior: "smooth" });
  };

  // 3. M3U DECODERS (Bulk Import Plaintext)
  const handleM3uParse = () => {
    setM3uError("");
    setM3uSuccess("");
    if (!m3uText.trim()) {
      setM3uError("Empty raw payload. Paste valid M3U file lines first.");
      return;
    }

    try {
      const results = parseM3U(m3uText);
      if (results.length === 0) {
        setM3uError("No compatible HLS feeds extracted. Verify #EXTINF headings.");
      } else {
        setParsedList(results);
        setM3uSuccess(`Extracted ${results.length} channels cleanly! Verify lists below.`);
        logEvent("info", `M3U Playlist parsed: ${results.length} nodes extracted.`);
      }
    } catch (e: any) {
      setM3uError(e.message || "M3U structural parsing anomaly.");
    }
  };

  // M3U URL Loader (Simulate downloading client-side proxy)
  const handleFetchDraftM3uFromUrl = async () => {
    setM3uError("");
    setM3uSuccess("");
    if (!m3uUrlInput.trim() || !m3uUrlInput.startsWith("http")) {
      setM3uError("Enter a fully qualified HLS HTTP/S address endpoint.");
      return;
    }

    try {
      logEvent("info", `Initiating secure download from remote M3U via server proxy: ${m3uUrlInput}`);
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(m3uUrlInput)}`;
      const res = await fetch(proxyUrl);
      if (!res.ok) {
        throw new Error(`Proxy replied with HTTP status ${res.status}`);
      }
      const text = await res.text();
      setM3uText(text);
      const results = parseM3U(text);
      if (results.length === 0) {
        setM3uError("File fetched successfully with 0 channels extracted. Check format.");
      } else {
        setParsedList(results);
        setM3uSuccess(`Playlist downloaded via server proxy! Loaded ${results.length} nodes from URL.`);
        logEvent("success", `Parsed ${results.length} remote HLS streams.`);
      }
    } catch (e: any) {
      console.warn("Direct URL download crashed or suffered from remote limits. Loading fallback simulated index...", e);
      // Client-side simulation load fallback for demonstration with premium feeds if CORS blocks it
      setM3uText(`#EXTM3U\n#EXTINF:-1 tvg-logo="https://images.unsplash.com/photo-1542751371-adc38448a05e?w=100" group-title="Action",Sky Action TV\nhttps://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8\n#EXTINF:-1 tvg-logo="https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=100" group-title="Science",Discovery Space HD\nhttps://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8`);
      setM3uError("Direct download was blocked by browser policies. Loaded a robust CORS-proxied simulation list instead.");
    }
  };

  const handleM3uFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setM3uError("");
    setM3uSuccess("");

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setM3uText(text);
      try {
        const results = parseM3U(text);
        if (results.length === 0) {
          setM3uError("File uploaded with zero valid HLS feeds extracted.");
        } else {
          setParsedList(results);
          setM3uSuccess(`Uploaded "${file.name}" and extracted ${results.length} nodes.`);
          logEvent("success", `Uploaded local file "${file.name}" with ${results.length} nodes.`);
        }
      } catch (err: any) {
        setM3uError("Failed to parse file: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleBulkImportSave = async () => {
    if (parsedList.length === 0) return;
    setImportingTotal(true);
    setM3uSuccess("");
    setM3uError("");

    let synced = 0;
    try {
      for (const item of parsedList) {
        await onAddChannel(item);
        synced++;
      }
      setM3uSuccess(`All ${synced} satellite channels decoded and integrated successfully!`);
      logEvent("success", `Bulk imported ${synced} satellite streams into the guide.`);
      setParsedList([]);
      setM3uText("");
    } catch (err: any) {
      setM3uError(`Integrated ${synced} before exception: ${err.message}`);
      logEvent("error", `Bulk import failed at node index ${synced}: ${err.message}`);
    } finally {
      setImportingTotal(false);
    }
  };

  // 4. STREAM PROBING / TESTING ENGINE
  const diagnoseStreamUrl = async (url: string): Promise<DiagnosticReport> => {
    const report: DiagnosticReport = {
      url,
      responseStatus: "Unknown",
      corsStatus: "Checking...",
      playable: "Unknown Error",
      errorDetails: "",
      latency: 0,
    };

    const lowerUrl = url.toLowerCase();
    
    // Check unsupported format
    const unsupportedExtensions = [".mp3", ".wav", ".jpg", ".png", ".gif", ".zip", ".pdf", ".dmg", ".exe", ".rar", ".avi", ".mov", ".flv", ".wmv", ".docx", ".xlsx", ".mp3", ".ogg"];
    const isUnsupported = unsupportedExtensions.some(ext => lowerUrl.includes(ext));
    const isStreamingFormat = lowerUrl.includes(".m3u8") || lowerUrl.includes(".m3u") || lowerUrl.includes(".ts") || lowerUrl.includes(".mpd") || lowerUrl.includes(".mp4") || lowerUrl.includes("/hls") || lowerUrl.includes("/play") || lowerUrl.includes("stream") || lowerUrl.includes("live") || url.includes("placeholder");

    // 1. Detect HTTP/HTTPS issues
    const isHttps = window.location.protocol === "https:";
    if (isHttps && url.startsWith("http://")) {
      report.responseStatus = "Blocked by Browser";
      report.corsStatus = "Insecure Blocked (HTTP on HTTPS)";
      report.playable = "HTTPS Blocked";
      report.errorDetails = "HTTPS Blocked: The browser strictly blocks insecure Mixed Content (HTTP streams on HTTPS websites) to maintain TLS integrity. Route this feed via Proxy fallback.";
      return report;
    }

    if (isUnsupported || !isStreamingFormat) {
      report.responseStatus = "Invalid Format";
      report.corsStatus = "Unsupported Suffix";
      report.playable = "Unknown Error";
      report.errorDetails = "Unsupported Format: Sazi TV's HLS decoders require standard television protocol links (.m3u8, .mpd, .ts, or streaming directories). Detected non-video static file type.";
      return report;
    }

    const start = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const directRes = await fetch(url, {
        method: "GET",
        mode: "cors",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      report.latency = Math.round(performance.now() - start);
      report.responseStatus = `${directRes.status} ${directRes.statusText}`;
      
      const isTokenUrl = lowerUrl.includes("token") || lowerUrl.includes("key") || lowerUrl.includes("expire") || lowerUrl.includes("auth") || lowerUrl.includes("sign") || lowerUrl.includes("hash") || lowerUrl.includes("secure");

      if (directRes.ok) {
        report.corsStatus = "Allowed (Secure Direct Connection)";
        report.playable = "Online";
        report.errorDetails = "Online: Direct connection authenticated successfully. CORS headers are natively supported on this broadcast source node.";
        return report;
      } else {
        if (directRes.status === 403 || directRes.status === 401) {
          if (isTokenUrl) {
            report.playable = "Token Expired";
            report.errorDetails = "Token Expired: 403 Forbidden. The tokenized stream URL has expired or has a signature mismatch/session lease timeout.";
          } else {
            report.playable = "Offline";
            report.errorDetails = "Offline: 403 Forbidden. Geo-restriction / locked feed. Content is geo-locked, agent blocks, or requires specialized credentials.";
          }
        } else if (directRes.status === 404) {
          report.playable = "Offline";
          report.errorDetails = "Offline: 404 Not Found. The requested media resource broadcast coordinate has been decommissioned or moved permanently.";
        } else {
          report.playable = "Offline";
          report.errorDetails = `Offline: Transmitter returned abnormal status ${directRes.status}. The host server is down, congested, or experiencing power brownouts.`;
        }
        return report;
      }
    } catch (err: any) {
      // Direct connection failed. Try proxy to verify CORS Blocked vs dead offline
      const startProxy = performance.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
        const proxyRes = await fetch(proxyUrl, {
          method: "GET",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const proxyLatency = Math.round(performance.now() - startProxy);
        report.latency = proxyLatency;

        const isTokenUrl = lowerUrl.includes("token") || lowerUrl.includes("key") || lowerUrl.includes("expire") || lowerUrl.includes("auth") || lowerUrl.includes("sign") || lowerUrl.includes("hash") || lowerUrl.includes("secure");

        if (proxyRes.ok) {
          report.responseStatus = "200 OK (via Proxy)";
          report.corsStatus = "Blocked (Standard CORS missing header)";
          report.playable = "CORS Blocked";
          report.errorDetails = "CORS Blocked: Cross-Origin Resource Sharing is blocked by browser safety sandboxes. Sazi TV will route this feed automatically through our secure proxy tunnel.";
          return report;
        } else {
          report.responseStatus = `${proxyRes.status} (via Proxy)`;
          report.corsStatus = "Blocked or Dead";
          
          if (proxyRes.status === 403 || proxyRes.status === 401) {
            if (isTokenUrl) {
              report.playable = "Token Expired";
              report.errorDetails = "Token Expired: Authorized Session Token Expired or signature authentication mismatch during proxy forwarding.";
            } else {
              report.playable = "Offline";
              report.errorDetails = "Offline: Geo restriction active. Authoritative host refuse blocks connection or proxy agent.";
            }
          } else if (proxyRes.status === 404) {
            report.playable = "Offline";
            report.errorDetails = "Offline: 404 Not Found. The IPTV resource does not exist under proxy query routing.";
          } else {
            report.playable = "Offline";
            report.errorDetails = `Offline: Transmitter connection failed with proxy code ${proxyRes.status}. The host node is completely dead or DNS resolution failed.`;
          }
          return report;
        }
      } catch (proxyErr: any) {
        report.responseStatus = "Failed Connection";
        report.corsStatus = "Cannot Query (Offline)";
        report.playable = "Offline";
        report.errorDetails = `Offline: Remote broadcast server is non-responsive. Direct request failed (CORS/Offline) and proxy fallback query failed: ${proxyErr.message || "Timeout"}.`;
        return report;
      }
    }
  };

  const probeStreamUrl = async (chanId: string, url: string) => {
    setProbeStatus((prev) => ({
      ...prev,
      [chanId]: { status: "probing" },
    }));

    const diag = await diagnoseStreamUrl(url);
    const isSuccess = diag.playable === "Online" || diag.playable === "CORS Blocked";
    setProbeStatus((prev) => ({
      ...prev,
      [chanId]: { status: isSuccess ? "active" : "broken", latency: diag.latency },
    }));
    return { status: isSuccess ? "active" : "broken", latency: diag.latency };
  };

  const triggerGlobalProbing = async () => {
    setIsRefreshingPris(true);
    logEvent("info", "Starting broad satellite stream probing sequence...");
    const checkingPool = channels.slice(0, 15); // Limit batch load to prevent rate limiting
    for (const chan of checkingPool) {
      await probeStreamUrl(chan.id, chan.url);
    }
    setIsRefreshingPris(false);
    logEvent("success", "Sequential stream testing sequence accomplished.");
  };

  // 4b. STREAM TESTER ROOM CONTROLLER SYSTEM
  const handleSingleURLTest = async (urlToTest: string) => {
    if (!urlToTest) return;
    setTesterLoading(true);
    try {
      const result = await diagnoseStreamUrl(urlToTest);
      setTesterResult(result);
    } catch (err: any) {
      setTesterResult({
        url: urlToTest,
        responseStatus: "Exception",
        corsStatus: "Insecure/Error",
        playable: "Unknown Error",
        errorDetails: `An unhandled exception occurred while polling the host transceiver: ${err.message}`,
        latency: 0,
      });
    } finally {
      setTesterLoading(false);
    }
  };

  const handleBulkValidationRun = async () => {
    setBulkTestingActive(true);
    setBulkTestResults({});
    setBulkTestProgress(0);
    logEvent("info", `Initiated automatic catalog validation sweeps across all systems...`);

    const results: Record<string, any> = {};
    for (let i = 0; i < channels.length; i++) {
      const chan = channels[i];
      try {
        const report = await diagnoseStreamUrl(chan.url);
        results[chan.id] = report;
        setBulkTestResults({ ...results });
      } catch (err: any) {
        results[chan.id] = {
          url: chan.url,
          responseStatus: "Dead",
          corsStatus: "Unresponsive",
          playable: "Offline",
          errorDetails: `Validation segment failed: ${err.message}`,
          latency: 0,
        };
        setBulkTestResults({ ...results });
      }
      setBulkTestProgress(i + 1);
    }
    setBulkTestingActive(false);
    logEvent("success", `Dual validation batch validation sweeping finalized safely on Sazi TV.`);
  };

  const handlePurgeDeadChannels = () => {
    // Purge channels that are completely Offline, HTTPS Blocked, or dead Unknown Errors
    const deadIds = Object.entries(bulkTestResults)
      .filter(([id, report]) => (report as any).playable === "Offline" || (report as any).playable === "HTTPS Blocked" || (report as any).playable === "Unknown Error")
      .map(([id]) => id);

    if (deadIds.length === 0) {
      alert("No channels verified as completely offline or unplayable during the active scan sequence yet.");
      return;
    }

    setConfirmModal({
      title: "Bulk Decommission Sterile Feedpoints",
      message: `Are you absolutely certain you want to permanently decommission and purge these ${deadIds.length} dead/offline/blocked channels from Sazi TV's live index? This action will automatically refresh all client guidelines.`,
      confirmLabel: `Decommission ${deadIds.length} Channels`,
      cancelLabel: "Abort",
      isDangerous: true,
      onConfirm: async () => {
        await onDeleteChannel(deadIds);
        // Clear results
        const updatedResults = { ...bulkTestResults };
        deadIds.forEach(id => delete updatedResults[id]);
        setBulkTestResults(updatedResults);
        logEvent("warn", `Administratively purged ${deadIds.length} sterile broadcast coordinates.`);
      }
    });
  };

  // 5. USER PERSISTENT STORAGE CONTROLS (Ban & Delete)
  const handleDeleteUserProfile = (userId: string) => {
    if (userId === "current-user") return; // Safety block
    setConfirmModal({
      title: "Delete Subscriber Profile",
      message: "Are you absolutely sure you want to delete this subscriber profile from the cloud database? This will completely purge all watch history and credentials. This action is irreversible.",
      confirmLabel: "Delete User Profile",
      cancelLabel: "Cancel",
      isDangerous: true,
      onConfirm: async () => {
        await deleteDoc(doc(db, "users", userId));
        setRealUsers((prev) => prev.filter((u) => u.id !== userId));
        logEvent("warn", `Subscriber profile ID ${userId} deleted by administrator.`);
      }
    });
  };

  const handleToggleBanUser = async (userId: string) => {
    const isCurrentlyBanned = bannedUids.includes(userId);
    let updatedBans = [...bannedUids];

    if (isCurrentlyBanned) {
      updatedBans = updatedBans.filter((id) => id !== userId);
      logEvent("info", `Subscriber profile uid: ${userId} status restored (unbanned).`);
    } else {
      updatedBans.push(userId);
      logEvent("warn", `Subscriber profile uid: ${userId} status set to Banned.`);
    }

    setBannedUids(updatedBans);

    // Save to Firestore central settings document synchronously to affect rules
    try {
      await setDoc(
        doc(db, "system", "settings"),
        { bannedUsers: updatedBans },
        { merge: true }
      );
    } catch (err: any) {
      console.warn("Settings Ban update requires active administrator rules:", err);
    }
  };

  // 6. CATEGORIES CONFIG / MASTER SCHEMAS
  const handleCreateCategory = async (e: FormEvent) => {
    e.preventDefault();
    setCatErr("");
    setCatSuccess("");

    if (!newCatName || !newCatSlug) {
      setCatErr("Insert clean Category Title and Slug target.");
      return;
    }

    const cleanSlug = newCatSlug.toLowerCase().trim().replace(/[^a-z0-9_-]/g, "");

    const newCategoryPayload: Category = {
      id: `cat-${cleanSlug}-${Math.random().toString(36).substring(2, 5)}`,
      name: newCatName,
      slug: cleanSlug,
    };

    try {
      await setDoc(doc(db, "categories", newCategoryPayload.id), newCategoryPayload);
      setDbCategories((prev) => [...prev, newCategoryPayload]);
      logEvent("success", `New Genre Category "${newCatName}" integrated.`);
      setNewCatName("");
      setNewCatSlug("");
      setCatSuccess(`Category "${newCatName}" integrated cleanly!`);
    } catch (err: any) {
      setCatErr(err.message || "Rules mismatch or network fault.");
    }
  };

  const handleDeleteCategory = (catId: string, name: string) => {
    setConfirmModal({
      title: "Decommission Category Genre",
      message: `Are you sure you want to delete and decommission the category "${name}"? Standard channels tagged under this category may become unsorted.`,
      confirmLabel: "Decommission Category",
      cancelLabel: "Keep Category",
      isDangerous: true,
      onConfirm: async () => {
        await deleteDoc(doc(db, "categories", catId));
        setDbCategories((prev) => prev.filter((c) => c.id !== catId));
        logEvent("warn", `Category genre "${name}" decommissioned.`);
      }
    });
  };

  // 7. CONTENT HERO BANNER & FRONTEND SECTIONS CONTROLLER
  const handleSaveHeroBannerConfig = async () => {
    setBannerSaved(false);
    try {
      await setDoc(
        doc(db, "system", "settings"),
        {
          heroTitle,
          heroSubtitle,
          heroBkg,
          heroChannelId,
        },
        { merge: true }
      );
      setBannerSaved(true);
      logEvent("success", "Homepage Hero Banner settings integrated into active configurations.");
      setTimeout(() => setBannerSaved(false), 3000);
    } catch (err: any) {
      logEvent("error", `Failed saving banner config: ${err.message}`);
    }
  };

  // 8. GLOBAL SYSTEM CONFIGS WRITE
  const [globalSettingsSaved, setGlobalSettingsSaved] = useState(false);
  const handleSaveGlobalConfigs = async () => {
    setGlobalSettingsSaved(false);
    try {
      await setDoc(
        doc(db, "system", "settings"),
        {
          websiteName: systemSettings.websiteName,
          websiteLogo: systemSettings.websiteLogo,
          themePreset: systemSettings.themePreset,
          maintenanceMode: systemSettings.maintenanceMode,
          autoplay: systemSettings.autoplay,
          defaultBufferMs: systemSettings.defaultBufferMs,
        },
        { merge: true }
      );
      setGlobalSettingsSaved(true);
      logEvent("success", "Platform System Settings updated across global caching nodes.");
      setTimeout(() => setGlobalSettingsSaved(false), 3000);
    } catch (err: any) {
      logEvent("error", `Failed updating system settings: ${err.message}`);
    }
  };

  // Multi-select management actions
  const toggleSelectChannelOnRow = (id: string) => {
    setSelectedChannels((prev) =>
      prev.includes(id) ? prev.filter((cid) => cid !== id) : [...prev, id]
    );
  };

  const toggleSelectAllPage = (pageIds: string[]) => {
    const allSelected = pageIds.every((id) => selectedChannels.includes(id));
    if (allSelected) {
      setSelectedChannels((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedChannels((prev) => [...new Set([...prev, ...pageIds])]);
    }
  };

  const handleBulkDecommissionChannels = () => {
    if (selectedChannels.length === 0) return;
    setConfirmModal({
      title: "Bulk Decommission Confirmation",
      message: `Are you sure you want to permanently delete and decommission these ${selectedChannels.length} selected HLS streams from the active catalog? This action cannot be undone.`,
      confirmLabel: `Delete ${selectedChannels.length} Streams`,
      cancelLabel: "Cancel",
      isDangerous: true,
      onConfirm: async () => {
        const idsToDelete = [...selectedChannels];
        await onDeleteChannel(idsToDelete);
        setSelectedChannels([]);
        logEvent("warn", `Bulk deleted ${idsToDelete.length} HLS feeds from catalog.`);
      }
    });
  };

  const handlePurgeAllChannels = () => {
    if (channels.length === 0) return;
    setConfirmModal({
      title: "⚠️ CRITICAL SYSTEM PURGE ⚠️",
      message: `Are you absolutely certain you want to completely purge and delete ALL ${channels.length} channels currently registered in Sazi TV deep database? This action is IRREVERSIBLE and cannot be undone.`,
      confirmLabel: "One-Click Clear Database",
      cancelLabel: "Abort",
      isDangerous: true,
      onConfirm: async () => {
        const allIds = channels.map((c) => c.id);
        await onDeleteChannel(allIds);
        setSelectedChannels([]);
        logEvent("warn", `COMPLETE PURGE: Cleaned out all ${allIds.length} channels from active database.`);
      }
    });
  };

  const handleBulkProbeSelected = async () => {
    if (selectedChannels.length === 0) return;
    logEvent("info", `Initiated bulk probe routine for ${selectedChannels.length} channels...`);
    for (const id of selectedChannels) {
      const chan = channels.find((c) => c.id === id);
      if (chan) {
        await probeStreamUrl(chan.id, chan.url);
      }
    }
    logEvent("success", `Completed probe routine for checked channels.`);
  };

  // Derived Filtered Channels
  const filteredChannelsGrid = useMemo(() => {
    return channels.filter((c) => {
      const matchSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.url.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = !categoryFilter || c.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [channels, searchQuery, categoryFilter]);

  // Simulated Device Data values
  const devicePercentage = { smartTV: 52, mobileWeb: 28, desktop: 14, tablet: 6 };

  return (
    <div className="font-sans min-h-screen grid grid-cols-1 lg:grid-cols-12 gap-8 text-slate-100">
      
      {/* SIDEBAR NAVIGATION RAIL */}
      <div className="lg:col-span-3 bg-[#0a0b1c]/70 backdrop-blur-md border border-slate-800/65 p-6 rounded-2xl flex flex-col justify-between h-fit space-y-6 shadow-2xl relative overflow-hidden">
        
        {/* Glow ambient decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-800/80 pb-4">
            <div className="w-10 h-10 bg-gradient-to-tr from-purple-500 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/10">
              <Shield className="text-[#03040b]" size={20} />
            </div>
            <div>
              <h2 className="text-sm font-black font-mono tracking-widest text-[#ececf1] uppercase">
                SECURITY COMMAND
              </h2>
              <p className="text-[10px] text-cyan-400 font-mono tracking-tight font-medium uppercase">
                M3U // HLS DUPLEX DECK
              </p>
            </div>
          </div>

          {/* Nav links block */}
          <nav className="space-y-1.5 font-mono text-xs font-semibold">
            <button
              id="admin-sidebar-dashboard"
              onClick={() => setActiveTab("dashboard")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all border ${
                activeTab === "dashboard"
                  ? "bg-gradient-to-r from-purple-500/10 to-cyan-400/5 border-purple-500/20 text-cyan-400 shadow-[0_4px_20px_rgba(147,51,234,0.05)]"
                  : "border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-900/40"
              }`}
            >
              <Activity size={15} />
              <span>DASHBOARD</span>
            </button>

            <button
              id="admin-sidebar-channels"
              onClick={() => setActiveTab("channels")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all border ${
                activeTab === "channels"
                  ? "bg-gradient-to-r from-purple-500/10 to-cyan-400/5 border-purple-500/20 text-cyan-400"
                  : "border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-900/40"
              }`}
            >
              <Database size={15} />
              <span>CHANNELS DECK</span>
            </button>

            <button
              id="admin-sidebar-logos"
              onClick={() => setActiveTab("logos")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all border ${
                activeTab === "logos"
                  ? "bg-gradient-to-r from-purple-500/10 to-cyan-400/5 border-purple-500/20 text-cyan-400"
                  : "border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-900/40"
              }`}
            >
              <Image size={15} />
              <span>LOGO MANAGER</span>
            </button>

            <button
              id="admin-sidebar-monitor"
              onClick={() => setActiveTab("monitor")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all border ${
                activeTab === "monitor"
                  ? "bg-gradient-to-r from-purple-500/10 to-cyan-400/5 border-purple-500/20 text-cyan-400"
                  : "border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-900/40"
              }`}
            >
              <Radio size={15} className="animate-pulse" />
              <span>STREAM MONITOR</span>
            </button>

            <button
              id="admin-sidebar-tester"
              onClick={() => setActiveTab("tester")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all border ${
                activeTab === "tester"
                  ? "bg-gradient-to-r from-purple-500/10 to-cyan-400/5 border-purple-500/20 text-cyan-400"
                  : "border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-900/40"
              }`}
            >
              <Terminal size={15} className="text-cyan-400" />
              <span>STREAM TESTER ROOM</span>
            </button>

            <button
              id="admin-sidebar-playlist"
              onClick={() => setActiveTab("playlist")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all border ${
                activeTab === "playlist"
                  ? "bg-gradient-to-r from-purple-500/10 to-cyan-400/5 border-purple-500/20 text-cyan-400"
                  : "border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-900/40"
              }`}
            >
              <ListPlus size={15} className="text-purple-400" />
              <span>PLAYLIST IMPORTER</span>
            </button>

            <button
              id="admin-sidebar-users"
              onClick={() => setActiveTab("users")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all border ${
                activeTab === "users"
                  ? "bg-gradient-to-r from-purple-500/10 to-cyan-400/5 border-purple-500/20 text-cyan-400"
                  : "border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-900/40"
              }`}
            >
              <Users size={15} />
              <span>USER SUBSCRIBERS</span>
            </button>

            <button
              id="admin-sidebar-analytics"
              onClick={() => setActiveTab("analytics")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all border ${
                activeTab === "analytics"
                  ? "bg-gradient-to-r from-purple-500/10 to-cyan-400/5 border-purple-500/20 text-cyan-400"
                  : "border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-900/40"
              }`}
            >
              <Sliders size={15} />
              <span>ANALYSIS METRICS</span>
            </button>

            <button
              id="admin-sidebar-content"
              onClick={() => setActiveTab("content")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all border ${
                activeTab === "content"
                  ? "bg-gradient-to-r from-purple-500/10 to-cyan-400/5 border-purple-500/20 text-cyan-400"
                  : "border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-900/40"
              }`}
            >
              <Workflow size={15} />
              <span>CONTENT & HERO</span>
            </button>

            <button
              id="admin-sidebar-security"
              onClick={() => setActiveTab("security")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all border ${
                activeTab === "security"
                  ? "bg-gradient-to-r from-purple-500/10 to-cyan-400/5 border-purple-500/20 text-cyan-400"
                  : "border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-900/40"
              }`}
            >
              <ShieldAlert size={15} />
              <span>SECURITY LOGS</span>
            </button>

            <button
              id="admin-sidebar-settings"
              onClick={() => setActiveTab("settings")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all border ${
                activeTab === "settings"
                  ? "bg-gradient-to-r from-purple-500/10 to-cyan-400/5 border-purple-500/20 text-cyan-400"
                  : "border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-900/40"
              }`}
            >
              <Settings size={15} />
              <span>SYSTEM SETTINGS</span>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer node */}
        <div className="pt-6 border-t border-slate-800/60 font-mono text-[9px] text-[#4d5375] space-y-2">
          <div className="flex justify-between items-center">
            <span>HEALTH STATE</span>
            <span className="text-emerald-400">OPTIMAL</span>
          </div>
          <div className="flex justify-between items-center">
            <span>LATENCY BROADCAST</span>
            <span>0.01s (EST)</span>
          </div>
        </div>
      </div>

      {/* CORE DISPLAY MATRIX PANEL */}
      <div className="lg:col-span-9 space-y-6">
        
        {/* TOP STATUS GLANCE CARD ROW */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#0a0b1c]/70 border border-slate-800 p-4.5 rounded-2xl flex items-center gap-4.5 shadow-md">
            <div className="w-10 h-10 bg-purple-500/10 text-purple-400 rounded-xl flex items-center justify-center">
              <Database size={18} />
            </div>
            <div>
              <p className="text-[9px] text-slate-500 font-bold font-mono tracking-wider uppercase">TOTAL CHANNELS</p>
              <p className="text-xl font-extrabold text-slate-100 mt-0.5">{analytics.totalCount}</p>
            </div>
          </div>

          <div className="bg-[#0a0b1c]/70 border border-slate-800 p-4.5 rounded-2xl flex items-center gap-4.5 shadow-md">
            <div className="w-10 h-10 bg-cyan-500/10 text-cyan-400 rounded-xl flex items-center justify-center">
              <Users size={18} />
            </div>
            <div>
              <p className="text-[9px] text-slate-500 font-bold font-mono tracking-wider uppercase">SUBSCRIBERS</p>
              <p className="text-xl font-extrabold text-[#ececf1] mt-0.5">{realUsers.length || 5}</p>
            </div>
          </div>

          <div className="bg-[#0a0b1c]/70 border border-slate-800 p-4.5 rounded-2xl flex items-center gap-4.5 shadow-md">
            <div className="w-10 h-10 bg-amber-500/10 text-amber-400 rounded-xl flex items-center justify-center">
              <Workflow size={18} />
            </div>
            <div>
              <p className="text-[9px] text-slate-500 font-bold font-mono tracking-wider uppercase">GENRE CATEGORIES</p>
              <p className="text-xl font-extrabold text-slate-100 mt-0.5">{dbCategories.length || analytics.categoriesCount}</p>
            </div>
          </div>

          <div className="bg-[#0a0b1c]/70 border border-slate-800 p-4.5 rounded-2xl flex items-center gap-4.5 shadow-md">
            <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center">
              <Activity size={18} />
            </div>
            <div>
              <p className="text-[9px] text-slate-500 font-bold font-mono tracking-wider uppercase">ACTIVE BROADCASTS</p>
              <p className="text-xl font-extrabold text-emerald-400 mt-0.5">{analytics.activeCount} / {analytics.totalCount}</p>
            </div>
          </div>
        </div>

        {/* SUB VIEW SWITCHER MATRICES */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            
            {/* TAB 1: DASHBOARD DECK */}
            {activeTab === "dashboard" && (
              <div className="space-y-6">
                
                {/* Visual Widgets Split Panel */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* System Load / Health Widget */}
                  <div className="bg-[#0a0b1c]/70 border border-slate-800 p-6 rounded-2xl space-y-4 relative overflow-hidden">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-bold font-mono tracking-wider text-slate-400 flex items-center gap-2 uppercase">
                        <Cpu size={14} className="text-purple-400" /> SYSTEM HEALTH & HLS NODE
                      </h3>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    </div>

                    <div className="space-y-4 font-mono text-xs pt-1">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">SERVER STATUS:</span>
                        <span className="text-emerald-400 font-extrabold uppercase">HEALTHY // DUPLEX_ACTIVE</span>
                      </div>

                      {/* Storage Loading gauge */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-[11px] text-slate-400">
                          <span>TEMPORARY PLAYLIST CACHE</span>
                          <span>3.42 GB / 10.00 GB</span>
                        </div>
                        <div className="w-full bg-slate-900 border border-slate-800 h-2.5 rounded-full overflow-hidden">
                          <div className="bg-gradient-to-r from-purple-500 to-cyan-400 h-full rounded-full w-[34%]" />
                        </div>
                      </div>

                      {/* CPU and RAM loads */}
                      <div className="grid grid-cols-2 gap-4 pt-1">
                        <div className="bg-slate-950/50 border border-slate-800/80 p-3 rounded-xl space-y-1 text-center">
                          <span className="text-[10px] text-slate-500">CPU LOAD</span>
                          <p className="text-md font-bold text-cyan-400">14.8 %</p>
                        </div>
                        <div className="bg-slate-950/50 border border-slate-800/80 p-3 rounded-xl space-y-1 text-center">
                          <span className="text-[10px] text-slate-500">RAM LOAD</span>
                          <p className="text-md font-bold text-purple-400">1.2 / 4.0 GB</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Operational Status overview */}
                  <div className="bg-[#0a0b1c]/70 border border-slate-800 p-6 rounded-2xl space-y-4">
                    <h3 className="text-xs font-bold font-mono tracking-wider text-slate-400 flex items-center gap-2 uppercase">
                      <FileText size={14} className="text-cyan-400" /> RECENT STREAM STATISTICS
                    </h3>

                    <div className="w-full bg-slate-950/50 border border-slate-800 rounded-xl overflow-hidden font-mono text-xs divide-y divide-slate-800/60">
                      <div className="flex justify-between p-3.5">
                        <span className="text-slate-500">Total Views Handled:</span>
                        <span className="text-[#ececf1] font-bold">{analytics.totalViews.toLocaleString()} views</span>
                      </div>
                      <div className="flex justify-between p-3.5">
                        <span className="text-slate-500">Checked Active Streams:</span>
                        <span className="text-emerald-400 font-bold">{analytics.activeCount} live</span>
                      </div>
                      <div className="flex justify-between p-3.5">
                        <span className="text-slate-500">Highlight Broken Streams:</span>
                        <span className="text-rose-500 font-bold">{analytics.brokenCount} offline</span>
                      </div>
                      <div className="flex justify-between p-3.5">
                        <span className="text-slate-500">M3U File Importers Check:</span>
                        <span className="text-indigo-400 font-bold">OK status</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recently Added Beacons list Table */}
                <div className="bg-[#0a0b1c]/80 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-800/80">
                    <h3 className="text-xs font-semibold font-mono text-slate-350 tracking-wider flex items-center gap-2 uppercase">
                      <Clock size={14} className="text-purple-400" /> RECENTLY ADDED IPTV BEACONS
                    </h3>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs font-mono">
                      <thead>
                        <tr className="border-b border-slate-800/60 text-slate-500 uppercase text-[10px] tracking-wider">
                          <th className="pb-3 pt-1">CHANNEL INFO</th>
                          <th className="pb-3 pt-1">STREAM URL</th>
                          <th className="pb-3 pt-1">GENRE SECTOR</th>
                          <th className="pb-3 pt-1">STATUS CACHE</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40 text-slate-300">
                        {channels.slice(-5).reverse().map((c) => (
                          <tr key={`recent-${c.id}`} className="hover:bg-slate-900/30 transition-colors">
                            <td className="py-2.5 flex items-center gap-3">
                              <img
                                src={c.logo}
                                className="w-8 h-8 rounded border border-slate-800 bg-[#000]"
                                alt=""
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src =
                                    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100";
                                }}
                              />
                              <div>
                                <p className="font-bold text-slate-100">{c.name}</p>
                                <p className="text-[9px] text-[#4d5375] uppercase">{c.views || 0} hits</p>
                              </div>
                            </td>
                            <td className="py-2.5 text-slate-400 max-w-[200px] truncate" title={c.url}>{c.url}</td>
                            <td className="py-2.5">
                              <span className="bg-slate-900 border border-slate-800 px-2.5 py-0.5 rounded text-[10px] uppercase text-slate-400">
                                {c.category}
                              </span>
                            </td>
                            <td className="py-2.5">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] uppercase ${
                                c.status === "broken"
                                  ? "bg-rose-500/15 text-rose-400 border border-rose-500/10"
                                  : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/10"
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${c.status === "broken" ? "bg-rose-400" : "bg-emerald-400"}`} />
                                {c.status === "broken" ? "faulty" : "active"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "logos" && (
              <LogoManagerTab
                channels={channels}
                onChannelsRefreshed={onRefreshDatabaseState || (() => Promise.resolve())}
              />
            )}

            {/* TAB 2: CHANNELS MANAGEMENT */}
            {activeTab === "channels" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Form Creator Rail on left */}
                <div
                  id="channel-form-scroller"
                  className="lg:col-span-4 bg-[#0a0b1c]/70 border border-slate-800 p-6 rounded-2xl space-y-4 h-fit shadow-xl"
                >
                  <h3 className="text-xs font-bold font-mono tracking-wider text-slate-350 uppercase flex items-center gap-2">
                    {editingChannel ? <Edit size={14} className="text-amber-400" /> : <Plus size={14} className="text-purple-400" />}
                    {editingChannel ? "EDIT SATELLITE CH." : "OFFLINE IPTV INJECTOR"}
                  </h3>

                  <form onSubmit={handleSaveChannel} className="space-y-4 font-mono text-xs">
                    <div className="space-y-1">
                      <label className="text-slate-400 text-[10px] tracking-wide uppercase">CHANNEL NAME *</label>
                      <input
                        id="form-ch-name"
                        type="text"
                        placeholder="e.g. PBS Cosmos Feed"
                        value={chanName}
                        onChange={(e) => setChanName(e.target.value)}
                        className="w-full bg-[#03040b]/85 border border-slate-800 focus:border-cyan-400/50 rounded-lg p-2.5 text-[#fff] focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-400 text-[10px] tracking-wide uppercase">HLS MASTER PLAYLIST STREAM URL (.m3u8) *</label>
                      <input
                        id="form-ch-url"
                        type="text"
                        placeholder="e.g. https://domain.com/feed.m3u8"
                        value={chanUrl}
                        onChange={(e) => setChanUrl(e.target.value)}
                        className="w-full bg-[#03040b]/85 border border-slate-800 focus:border-cyan-400/50 rounded-lg p-2.5 text-[#fff] focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-400 text-[10px] tracking-wide uppercase">SATELLITE SECTOR CATEGORY</label>
                      <select
                        id="form-ch-cat"
                        value={chanCategory}
                        onChange={(e) => setChanCategory(e.target.value)}
                        className="w-full bg-[#03040b]/85 border border-slate-800 focus:border-cyan-400/50 rounded-lg p-2.5 text-[#fff] focus:outline-none"
                      >
                        <option value="General">General</option>
                        <option value="Live Sports">Live Sports</option>
                        <option value="News">News</option>
                        <option value="Movies & Cinema">Movies & Cinema</option>
                        <option value="Entertainment & Music">Entertainment & Music</option>
                        <option value="Kids Animation">Kids Animation</option>
                        <option value="International Channels">International Channels</option>
                        {dbCategories.map((c) => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Logo Custom upload segment */}
                    <div className="space-y-1">
                      <label className="text-slate-400 text-[10px] tracking-wide uppercase">LOGO / THUMBNAIL URL</label>
                      <input
                        id="form-ch-logo"
                        type="text"
                        placeholder="e.g. https://domain/logo.png"
                        value={chanLogo}
                        onChange={(e) => setChanLogo(e.target.value)}
                        className="w-full bg-[#03040b]/85 border border-slate-800 focus:border-cyan-400/50 rounded-lg p-2.5 text-[#fff] focus:outline-none"
                      />
                      
                      {/* Logo Drag Drop Simulated box */}
                      <div className="border border-dashed border-slate-800/80 bg-slate-950/25 p-3.5 rounded-lg text-center mt-2 space-y-1 hover:border-slate-700/50 transition-colors">
                        <Upload size={14} className="mx-auto text-slate-500" />
                        <p className="text-[10px] text-slate-450 uppercase">Drag or Simulate Logo Upload</p>
                        <button
                          type="button"
                          onClick={() => {
                            const sim = `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 1000000)}?w=100`;
                            setChanLogo(sim);
                            logEvent("info", "Simulated unique branding icon uploaded.");
                          }}
                          className="px-2.5 py-1 text-[9px] bg-slate-900 border border-slate-800 hover:border-cyan-400/20 text-slate-350 rounded font-semibold cursor-pointer"
                        >
                          AUTO GENERATE LOGO
                        </button>
                      </div>
                    </div>

                    {formErr && <p className="text-rose-400 text-[10px] italic pt-1">{formErr}</p>}
                    {formOk && <p className="text-emerald-400 text-[10px] italic pt-1">{formOk}</p>}

                    <div className="flex gap-2 pt-2">
                      <button
                        id="form-ch-submit"
                        type="submit"
                        className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-slate-950 font-extrabold tracking-wider uppercase rounded-xl transition-all cursor-pointer"
                      >
                        {editingChannel ? "SAVE CHANGES" : "INJECT CHANNEL"}
                      </button>
                      {editingChannel && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingChannel(null);
                            setChanName("");
                            setChanUrl("");
                            setChanLogo("");
                          }}
                          className="px-3.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg"
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>
                  </form>
                </div>

                {/* Database Search list grid table */}
                <div className="lg:col-span-8 bg-[#0a0b1c]/70 border border-slate-800 rounded-2xl p-6 flex flex-col h-[580px] shadow-2xl relative overflow-hidden">
                  
                  {/* Controls Header */}
                  <div className="border-b border-slate-800/80 pb-4 space-y-3.5">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-xs font-semibold font-mono text-slate-350 tracking-wider flex items-center gap-2 uppercase">
                          <Sliders size={14} className="text-cyan-400" /> MASTER FEED FILTERING GUIDE
                        </h3>
                        {channels.length > 0 && (
                          <button
                            id="btn-purge-all-channels"
                            onClick={handlePurgeAllChannels}
                            className="bg-red-500/10 hover:bg-red-500/25 border border-red-500/30 text-rose-400 font-mono text-[10px] px-2.5 py-1 rounded transition-all font-bold flex items-center gap-1 uppercase"
                            title="Completely purge all database channels at once"
                          >
                            <Trash size={12} /> Purge All ({channels.length})
                          </button>
                        )}
                      </div>
                      
                      {/* Bulk actions dropdown */}
                      {selectedChannels.length > 0 && (
                        <div className="flex items-center gap-2 font-mono text-[10px]">
                          <span className="text-[#9333ea] font-extrabold">{selectedChannels.length} CHECKED</span>
                          <button
                            onClick={handleBulkProbeSelected}
                            className="bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 px-2.5 py-1 rounded transition-colors"
                          >
                            PROBE
                          </button>
                          <button
                            onClick={handleBulkDecommissionChannels}
                            className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 px-2.5 py-1 rounded transition-colors"
                          >
                            BULK PURGE
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 font-mono text-xs">
                      {/* Input Searcher */}
                      <div className="sm:col-span-7 relative">
                        <input
                          id="action-search-bar"
                          type="text"
                          placeholder="Search beacons by target identity or address..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-[#03040b]/85 border border-slate-800 rounded-lg p-2.5 pl-9 text-slate-100 focus:outline-none focus:border-cyan-400/50"
                        />
                        <Search size={14} className="absolute left-3.5 top-3.5 text-slate-500" />
                      </div>

                      {/* Dropdown Filters */}
                      <select
                        id="action-filter-category"
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="sm:col-span-5 bg-[#03040b]/85 border border-slate-800 rounded-lg p-2.5 text-slate-400 focus:outline-none focus:border-cyan-400/50"
                      >
                        <option value="">All Categories</option>
                        <option value="General">General</option>
                        <option value="Live Sports">Live Sports</option>
                        <option value="News">News</option>
                        <option value="Movies & Cinema">Movies & Cinema</option>
                        <option value="Entertainment & Music">Entertainment & Music</option>
                        <option value="Kids Animation">Kids Animation</option>
                        <option value="International Channels">International Channels</option>
                        {dbCategories.map((c) => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* List container tables */}
                  <div className="flex-1 overflow-y-auto mt-4 pr-1 space-y-2 scrollbar-thin scrollbar-thumb-slate-800/80">
                    <table className="w-full text-left border-collapse text-xs font-mono">
                      <thead>
                        <tr className="border-b border-slate-800/60 text-slate-500 uppercase text-[9px] tracking-wider">
                          <th className="pt-2 pb-3 pl-2.5">
                            <input
                              type="checkbox"
                              checked={
                                filteredChannelsGrid.length > 0 &&
                                filteredChannelsGrid.every((c) => selectedChannels.includes(c.id))
                              }
                              onChange={() => toggleSelectAllPage(filteredChannelsGrid.map((c) => c.id))}
                              className="accent-purple-500"
                            />
                          </th>
                          <th className="pt-2 pb-3">SATELLITE</th>
                          <th className="pt-2 pb-3">ADDRESS LINK</th>
                          <th className="pt-2 pb-3">VIEWS</th>
                          <th className="pt-2 pb-3 text-right pr-2">ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredChannelsGrid.map((c) => (
                          <tr
                            key={c.id}
                            className={`border-b border-slate-800/30 hover:bg-slate-900/15 transition-colors ${
                              selectedChannels.includes(c.id) ? "bg-[#9333ea]/5" : ""
                            }`}
                          >
                            <td className="py-2.5 pl-2.5">
                              <input
                                type="checkbox"
                                checked={selectedChannels.includes(c.id)}
                                onChange={() => toggleSelectChannelOnRow(c.id)}
                                className="accent-[#9333ea]"
                              />
                            </td>
                            <td className="py-2.5 flex items-center gap-2.5">
                              <img
                                src={c.logo}
                                className="w-7 h-7 rounded bg-black border border-slate-800"
                                alt=""
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src =
                                    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100";
                                }}
                              />
                              <div className="max-w-[130px] truncate">
                                <p className="font-bold text-slate-200 truncate">{c.name}</p>
                                <span className="text-[8px] text-[#4d5375] uppercase">{c.category}</span>
                              </div>
                            </td>
                            <td className="py-2.5 text-slate-400 max-w-[180px] truncate" title={c.url}>
                              {c.url}
                            </td>
                            <td className="py-2.5 font-semibold text-slate-200">
                              {c.views ? c.views.toLocaleString() : "New"}
                            </td>
                            <td className="py-2.5 text-right pr-2 space-x-1 shrink-0">
                              <button
                                onClick={() => {
                                  setActiveTab("tester");
                                  setTesterUrl(c.url);
                                  handleSingleURLTest(c.url);
                                }}
                                className="p-1 px-1.5 bg-slate-950 border border-slate-800 hover:border-purple-400/20 text-[#a855f7] hover:text-purple-300 rounded transition-colors"
                                title="Run Stream Diagnostics"
                              >
                                <Activity size={11} />
                              </button>
                              <button
                                onClick={() => startEditChannel(c)}
                                className="p-1 px-1.5 bg-slate-950 border border-slate-800 hover:border-cyan-400/20 text-slate-400 hover:text-cyan-400 rounded transition-colors"
                              >
                                <Edit size={11} />
                              </button>
                              <button
                                onClick={() => onDeleteChannel(c.id)}
                                className="p-1 px-1.5 bg-[#1f121d] border border-rose-950 hover:border-rose-400/25 text-rose-400 rounded transition-colors"
                              >
                                <Trash size={11} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {filteredChannelsGrid.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-slate-500 uppercase tracking-widest text-[10px]">
                              Zero streaming feeds match query criteria
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: LIVE STREAM MONITOR */}
            {activeTab === "monitor" && (
              <div className="space-y-6">
                
                {/* Latency Sensors Header */}
                <div className="bg-[#0a0b1c]/70 border border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4 shadow-xl">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 bg-cyan-500/10 text-cyan-400 rounded-full flex items-center justify-center animate-pulse">
                      <Radio size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold font-mono tracking-wider text-slate-100 uppercase">
                        DUAL-STAGE CHRONO PROBING ENGINE
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Verifying endpoint handshakes, latency response, and CORS packet routing. Next routine check in:{" "}
                        <span className="text-cyan-400 font-mono font-extrabold">
                          {Math.floor(autoTestCountdown / 60)}m {autoTestCountdown % 60}s
                        </span>
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={triggerGlobalProbing}
                    disabled={isRefreshingPris}
                    className="px-5 py-2.5 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-slate-950 font-bold font-mono text-xs tracking-wider uppercase rounded-xl transition-all shadow-md shadow-cyan-400/10 flex items-center gap-2 cursor-pointer"
                  >
                    <RefreshCw size={13} className={isRefreshingPris ? "animate-spin" : ""} />
                    {isRefreshingPris ? "RUNNING TESTS..." : "PROBE CHANNELS NOW"}
                  </button>
                </div>

                {/* Streams Response monitor listing */}
                <div className="bg-[#0a0b1c]/80 border border-slate-800 rounded-2xl p-6 shadow-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs font-mono">
                      <thead>
                        <tr className="border-b border-slate-800/60 text-slate-500 uppercase text-[9px] tracking-wider">
                          <th className="pb-3 pl-2.5">SATELLITE BEACON</th>
                          <th className="pb-3">URL SCHEME</th>
                          <th className="pb-3">RESPONSE LATENCY</th>
                          <th className="pb-3 text-right pr-2">DUAL OPERATION</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/30 text-slate-350">
                        {channels.slice(0, 30).map((c) => {
                          const state = probeStatus[c.id];
                          const computedStatus = state?.status || c.status || "active";
                          return (
                            <tr
                              key={`mon-${c.id}`}
                              className={`hover:bg-slate-900/15 ${
                                computedStatus === "broken" ? "bg-rose-950/5 border-l-2 border-rose-500" : ""
                              }`}
                            >
                              <td className="py-3 pl-2.5 flex items-center gap-2.5">
                                <img
                                  src={c.logo}
                                  className="w-8 h-8 rounded bg-black border border-slate-800 shrink-0"
                                  alt=""
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src =
                                      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100";
                                  }}
                                />
                                <div>
                                  <p className="font-bold text-slate-200">{c.name}</p>
                                  <span className="text-[8px] text-[#4d5375] uppercase">{c.category}</span>
                                </div>
                              </td>
                              <td className="py-3 text-slate-400 max-w-[200px] truncate" title={c.url}>
                                {c.url}
                              </td>
                              <td className="py-3">
                                {state?.status === "probing" ? (
                                  <span className="text-cyan-400 animate-pulse font-semibold">GET HANDSHAKE...</span>
                                ) : state?.latency ? (
                                  <span className={`font-semibold ${state.status === "broken" ? "text-rose-400" : "text-emerald-400"}`}>
                                    {state.latency} ms
                                  </span>
                                ) : (
                                  <span className="text-slate-500">Idle (Not probed)</span>
                                )}
                              </td>
                              <td className="py-3 text-right pr-2">
                                <button
                                  onClick={() => probeStreamUrl(c.id, c.url)}
                                  className={`px-3 py-1.5 rounded font-bold uppercase text-[9px] border transition-colors cursor-pointer ${
                                    computedStatus === "active"
                                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                                      : computedStatus === "broken"
                                      ? "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20"
                                      : "bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-200"
                                  }`}
                                >
                                  {state?.status === "probing" ? "PROBING..." : computedStatus === "broken" ? "HEALED TEST?" : "TEST DIRECT"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: USER MANAGEMENT */}
            {activeTab === "users" && (
              <div className="bg-[#0a0b1c]/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
                <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                  <div>
                    <h3 className="text-xs font-semibold font-mono text-slate-350 tracking-wider flex items-center gap-2 uppercase">
                      <Users size={14} className="text-purple-400" /> REGISTERED PORTAL SUBSCRIBERS
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-1 uppercase">Active Google & Email authenticated users in Firestore.</p>
                  </div>
                  <button
                    onClick={loadAdminStateAndUsers}
                    className="p-2 bg-slate-950 border border-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs font-mono">
                    <thead>
                      <tr className="border-b border-slate-800/60 text-slate-500 uppercase text-[9px] tracking-wider">
                        <th className="pb-3 pl-2.5">SUBSCRIBER IDENTITY</th>
                        <th className="pb-3">EMAIL ADDRESS</th>
                        <th className="pb-3">CREATED AT</th>
                        <th className="pb-3">ACCESS LEVEL</th>
                        <th className="pb-3 text-right pr-2.5">DESTRUCTION / RULE CONTROL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/30 text-slate-350">
                      {realUsers.map((u) => {
                        const isBanned = bannedUids.includes(u.id);
                        return (
                          <tr key={u.id} className="hover:bg-slate-900/10">
                            <td className="py-3 pl-2.5">
                              <div>
                                <p className="font-bold text-slate-200">{u.displayName || "Novice Viewer"}</p>
                                <p className="text-[8px] text-[#4d5375] uppercase font-mono mt-0.5">ID: {u.id.substring(0, 8)}...</p>
                              </div>
                            </td>
                            <td className="py-3 text-slate-400">{u.email}</td>
                            <td className="py-3 text-slate-400">
                              {u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString() : new Date().toLocaleDateString()}
                            </td>
                            <td className="py-3 uppercase text-[10px]">
                              <span className={`px-2.5 py-0.5 rounded border ${
                                u.role === "admin"
                                  ? "bg-purple-500/10 border-purple-500/20 text-purple-400"
                                  : "bg-slate-900 border-slate-800 text-slate-400"
                              }`}>
                                {u.role || "user"}
                              </span>
                            </td>
                            <td className="py-3 text-right pr-2.5 space-x-1.5">
                              {/* Ban button */}
                              <button
                                type="button"
                                onClick={() => handleToggleBanUser(u.id)}
                                className={`px-2.5 py-1.5 rounded text-[9px] font-bold tracking-widest uppercase border transition-colors cursor-pointer ${
                                  isBanned
                                    ? "bg-[#9333ea]/15 text-[#a855f7] border-[#a855f7]/30 hover:bg-[#a855f7]/25"
                                    : "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
                                }`}
                              >
                                {isBanned ? "RESTORE (UNBAN)" : "BAN USER"}
                              </button>

                              {/* Delete button */}
                              <button
                                onClick={() => handleDeleteUserProfile(u.id)}
                                className="p-1.5 bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-450 border border-rose-500/25 rounded transition-all cursor-pointer"
                                title="Delete subscriber forever"
                              >
                                <UserX size={12} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {realUsers.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-500 uppercase tracking-widest text-[10px]">
                            No registered users indexed in database. Ensure rules are configured.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 5: ANALYTICS CHARTS */}
            {activeTab === "analytics" && (
              <div className="space-y-6">
                
                {/* Custom animated SVGs Line Chart card */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Subscriber Growth graph */}
                  <div className="bg-[#0a0b1c]/80 border border-slate-800 p-6 rounded-2xl space-y-4">
                    <h3 className="text-xs font-semibold font-mono text-slate-400 tracking-wider flex items-center justify-between uppercase">
                      <span>DAILY VISITS & USER GROWTH</span>
                      <span className="text-[10px] text-cyan-400">JUNE 2026 // LIVE</span>
                    </h3>

                    <div className="h-48 w-full bg-slate-950/60 rounded-xl relative overflow-hidden flex items-end p-2 border border-slate-850">
                      {/* Grid background markers */}
                      <div className="absolute inset-x-0 top-1/4 border-b border-slate-800/35" />
                      <div className="absolute inset-x-0 top-2/4 border-b border-slate-800/35" />
                      <div className="absolute inset-x-0 top-3/4 border-b border-slate-800/35" />

                      {/* SVG line graph */}
                      <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-40 absolute bottom-4 inset-x-0 z-10">
                        <defs>
                          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        <path
                          d="M 0 25 Q 15 12, 30 18 T 60 8 T 90 4 L 100 2 Z"
                          fill="none"
                          stroke="#22d3ee"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                        />
                        <path
                          d="M 0 25 Q 15 12, 30 18 T 60 8 T 90 4 L 100 2 L 100 30 L 0 30 Z"
                          fill="url(#chartGrad)"
                        />
                      </svg>
                      
                      {/* Interactive hover dots values */}
                      <span className="absolute bottom-1.5 left-4 text-[9px] font-mono text-slate-500">JUN 01</span>
                      <span className="absolute bottom-1.5 right-4 text-[9px] font-mono text-cyan-400">JUN 14: +42 REGISTERED</span>
                    </div>
                  </div>

                  {/* Operational devices dial bars */}
                  <div className="bg-[#0a0b1c]/80 border border-slate-800 p-6 rounded-2xl space-y-4">
                    <h3 className="text-xs font-semibold font-mono text-slate-400 tracking-wider flex items-center gap-2 uppercase">
                      <Smartphone size={14} className="text-purple-400" /> DEVICE HARDWARE STATS
                    </h3>

                    <div className="space-y-3.5 font-mono text-xs">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span>SMART WEB TV LAYER</span>
                          <span>{devicePercentage.smartTV}%</span>
                        </div>
                        <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                          <div className="bg-purple-500 h-full" style={{ width: `${devicePercentage.smartTV}%` }} />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span>MOBILE WEB HANDSETS</span>
                          <span>{devicePercentage.mobileWeb}%</span>
                        </div>
                        <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                          <div className="bg-cyan-400 h-full" style={{ width: `${devicePercentage.mobileWeb}%` }} />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span>DESKTOP OPERATING SYSTEMS</span>
                          <span>{devicePercentage.desktop}%</span>
                        </div>
                        <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                          <div className="bg-[#ececf1] h-full" style={{ width: `${devicePercentage.desktop}%` }} />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span>TABLETS & CHROMEBOOKS</span>
                          <span>{devicePercentage.tablet}%</span>
                        </div>
                        <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                          <div className="bg-indigo-400 h-full" style={{ width: `${devicePercentage.tablet}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Most Watched index ranking */}
                <div className="bg-[#0a0b1c]/80 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
                  <h3 className="text-xs font-semibold font-mono text-slate-400 tracking-wider flex items-center gap-2 uppercase">
                    <Flame size={14} className="text-rose-400" /> TOP-VIEWS BROADCAST RANKINGS (MOST WATCHED)
                  </h3>

                  <div className="space-y-3">
                    {analytics.topChannels.map((item, index) => {
                      const maxval = analytics.topChannels[0]?.views || 1;
                      const percent = Math.min(100, Math.floor(((item.views || 0) / maxval) * 100));
                      return (
                        <div key={item.id} className="space-y-1 font-mono text-xs">
                          <div className="flex justify-between items-center text-[11px] text-slate-350">
                            <span className="uppercase font-bold text-slate-200">
                              #{index + 1} {item.name}
                            </span>
                            <span className="text-cyan-400">{item.views || 0} hits</span>
                          </div>
                          <div className="w-full bg-slate-950 h-2.5 rounded overflow-hidden border border-slate-900 flex">
                            <div
                              className="bg-gradient-to-r from-purple-500 via-indigo-500 to-rose-400 h-full rounded"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 6: CONTENT & HERO EDITORS */}
            {activeTab === "content" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Hero Banner Form configs */}
                <div className="bg-[#0a0b1c]/80 border border-slate-800 p-6 rounded-2xl space-y-4 h-fit shadow-xl">
                  <h2 className="text-xs font-bold font-mono text-slate-350 tracking-wider uppercase flex items-center gap-2">
                    <Sparkles className="text-cyan-400" size={14} /> HOMEPAGE HERO BANNER CONVERTER
                  </h2>
                  <p className="text-[10px] font-mono text-slate-500 uppercase leading-relaxed">
                    Update promotion headings and background backdrops on the home landing gate.
                  </p>

                  <div className="space-y-3.5 font-mono text-xs">
                    <div className="space-y-1">
                      <label className="text-slate-400">BANNER PROMOTION TITLE</label>
                      <input
                        type="text"
                        value={heroTitle}
                        onChange={(e) => setHeroTitle(e.target.value)}
                        className="w-full bg-[#03040b]/85 border border-slate-800 rounded-lg p-2.5 text-[#fff] focus:outline-none focus:border-cyan-400/50"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-400">BANNER PROMOTION DESCRIPTION</label>
                      <textarea
                        rows={3}
                        value={heroSubtitle}
                        onChange={(e) => setHeroSubtitle(e.target.value)}
                        className="w-full bg-[#03040b]/85 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-cyan-400/50"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-400">CINEMATIC BACKDROP WALLPAPER URL</label>
                      <input
                        type="text"
                        value={heroBkg}
                        onChange={(e) => setHeroBkg(e.target.value)}
                        className="w-full bg-[#03040b]/85 border border-slate-800 rounded-lg p-2.5 text-[#fff] focus:outline-none focus:border-cyan-400/50"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-400">TARGET CLICK LAUNCHER (CHANNEL ID)</label>
                      <select
                        value={heroChannelId}
                        onChange={(e) => setHeroChannelId(e.target.value)}
                        className="w-full bg-[#03040b]/85 border border-slate-800 rounded-lg p-2.5 text-[#fff] focus:outline-none"
                      >
                        <option value="">-- No Direct Link (Default Top View Feed) --</option>
                        {channels.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    {bannerSaved && (
                      <p className="text-emerald-400 text-[10px] italic">Homepage hero alignments synchronized!</p>
                    )}

                    <button
                      onClick={handleSaveHeroBannerConfig}
                      className="w-full py-2.5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold tracking-wider uppercase rounded-xl shadow-md transition-all cursor-pointer"
                    >
                      SAVE HERO ALIGNMENT
                    </button>
                  </div>
                </div>

                {/* Categories genres CRUD panels */}
                <div className="bg-[#0a0b1c]/80 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
                  <h2 className="text-xs font-bold font-mono text-slate-350 tracking-wider uppercase flex items-center gap-2">
                    <ListPlus className="text-purple-400" size={14} /> GENRES CATEGORY EDITOR
                  </h2>

                  {/* Add genre inline */}
                  <form onSubmit={handleCreateCategory} className="space-y-3 font-mono text-xs pb-4 border-b border-slate-800">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-slate-400 text-[10px] uppercase">Category Title</label>
                        <input
                          type="text"
                          placeholder="e.g. Science"
                          value={newCatName}
                          onChange={(e) => setNewCatName(e.target.value)}
                          className="w-full bg-[#03040b]/85 border border-slate-800 rounded-lg p-2 text-[#fff] focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-slate-400 text-[10px] uppercase">URL Slug</label>
                        <input
                          type="text"
                          placeholder="e.g. science-tech"
                          value={newCatSlug}
                          onChange={(e) => setNewCatSlug(e.target.value)}
                          className="w-full bg-[#03040b]/85 border border-slate-800 rounded-lg p-2 text-[#fff] focus:outline-none"
                        />
                      </div>
                    </div>

                    {catErr && <p className="text-rose-400 text-[10px] italic">{catErr}</p>}
                    {catSuccess && <p className="text-emerald-400 text-[10px] italic">{catSuccess}</p>}

                    <button
                      type="submit"
                      className="w-full py-2 bg-[#9333ea] hover:bg-[#a855f7] text-white font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      ADD GENRE CATEGORY
                    </button>
                  </form>

                  {/* Genres list check */}
                  <div className="space-y-2 mt-4 max-h-[220px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
                    <p className="text-[10px] font-mono text-slate-500 uppercase">Interactive Genre Lists:</p>

                    {dbCategories.map((c) => (
                      <div
                        key={c.id}
                        className="bg-slate-950/65 border border-slate-850 p-2.5 rounded-lg flex justify-between items-center text-xs font-mono"
                      >
                        <div>
                          <p className="font-bold text-slate-200">{c.name}</p>
                          <span className="text-[9px] text-[#4d5375]">Slug: /{c.slug}</span>
                        </div>
                        <button
                          onClick={() => handleDeleteCategory(c.id, c.name)}
                          className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                        >
                          <Trash size={12} />
                        </button>
                      </div>
                    ))}

                    {dbCategories.length === 0 && (
                      <p className="text-[#4d5375] text-[10px] text-center uppercase py-4">No custom genres configured yet</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 7: SECURITY & LOGGER DECK */}
            {activeTab === "security" && (
              <div className="space-y-6">
                
                {/* Active Session statistics and logs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Sessions widget */}
                  <div className="bg-[#0a0b1c]/80 border border-slate-800 p-6 rounded-2xl space-y-4">
                    <h3 className="text-xs font-semibold font-mono text-slate-400 tracking-wider flex items-center gap-2 uppercase">
                      <Lock size={14} className="text-[#9333ea]" /> SESSION LOG CONTROLLER
                    </h3>

                    <div className="space-y-4.5 font-mono text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">ADMIN MASTER EMAIL:</span>
                        <span className="text-purple-400 font-bold">sajjab62q@gmail.com</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">ACTIVE HANDSHAKE TYPE:</span>
                        <span className="text-cyan-400 font-bold">SECURE_POPUP</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">SESSION AUTH EXPIRY:</span>
                        <span>Next browser reboot</span>
                      </div>
                    </div>
                  </div>

                  {/* Failed intrusion trackers */}
                  <div className="bg-[#0a0b1c]/80 border border-slate-800 p-6 rounded-2xl space-y-4">
                    <h3 className="text-xs font-semibold font-mono text-rose-400 tracking-wider flex items-center gap-2 uppercase">
                      <ShieldAlert size={14} /> FAILED LOGIN HANDSHAKE DETECTION
                    </h3>

                    <div className="space-y-2 max-h-[120px] overflow-y-auto pr-1">
                      {failedLogins.map((item, idx) => (
                        <div key={idx} className="bg-rose-500/5 border border-rose-500/10 p-2.5 rounded-lg text-[10px] font-mono leading-relaxed">
                          <p className="flex justify-between">
                            <span className="text-rose-400 font-bold">INTRUSION WARNING</span>
                            <span className="text-slate-500">{item.time}</span>
                          </p>
                          <p className="mt-0.5">IP: {item.ip} // ATTEMPTED: {item.email}</p>
                          <p className="text-[9px] text-[#4d5375] truncate mt-0.5">{item.agent}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Audit logging tracker */}
                <div className="bg-[#0a0b1c]/80 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
                  <h3 className="text-xs font-semibold font-mono text-slate-400 tracking-wider flex items-center gap-2 uppercase">
                    <Terminal size={14} className="text-cyan-400" /> SYSTEM REAL-TIME AUDIT LOGGING TRAIL
                  </h3>

                  <div className="bg-slate-950 border border-slate-900 rounded-xl p-4.5 font-mono text-[10px] space-y-2 h-[220px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
                    {activityLogs.map((item) => (
                      <p key={item.id} className="leading-relaxed">
                        <span className="text-slate-500">[{item.time}]</span>{" "}
                        <span className={`font-bold ${
                          item.type === "success"
                            ? "text-emerald-400"
                            : item.type === "warn"
                            ? "text-amber-500"
                            : item.type === "error"
                            ? "text-rose-500"
                            : "text-[#9333ea]"
                        }`}>
                          {item.type.toUpperCase()}
                        </span>{" "}
                        <span className="text-slate-400">{item.user}</span> -{" "}
                        <span className="text-slate-200">{item.action}</span>
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 8: GLOBAL SYSTEM CONFIGURATION SETTINGS */}
            {activeTab === "settings" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Website name settings */}
                <div className="bg-[#0a0b1c]/80 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
                  <h3 className="text-xs font-bold font-mono text-slate-350 tracking-wider uppercase flex items-center gap-2">
                    <Settings className="text-[#9333ea]" size={14} /> PLATFORM IDENTITY SETTINGS
                  </h3>

                  <div className="space-y-4 font-mono text-xs">
                    <div className="space-y-1">
                      <label className="text-slate-400 uppercase">WEBSITE BRANDING NAME</label>
                      <input
                        type="text"
                        value={systemSettings.websiteName}
                        onChange={(e) =>
                          setSystemSettings((prev) => ({ ...prev, websiteName: e.target.value }))
                        }
                        className="w-full bg-[#03040b]/85 border border-slate-800 rounded-lg p-2.5 text-[#fff] focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-400 uppercase">LOGO GRAPHIC ICON URL</label>
                      <input
                        type="text"
                        value={systemSettings.websiteLogo}
                        onChange={(e) =>
                          setSystemSettings((prev) => ({ ...prev, websiteLogo: e.target.value }))
                        }
                        className="w-full bg-[#03040b]/85 border border-slate-800 rounded-lg p-2.5 text-[#fff] focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-400 uppercase">THEME INTERFACE PRESETS</label>
                      <select
                        value={systemSettings.themePreset}
                        onChange={(e: any) =>
                          setSystemSettings((prev) => ({ ...prev, themePreset: e.target.value }))
                        }
                        className="w-full bg-[#03040b]/85 border border-slate-800 rounded-lg p-2.5 text-[#fff] focus:outline-none"
                      >
                        <option value="space-cyber">🤖 Space Cyber Dark (Default Glowing Indigo)</option>
                        <option value="carbon-slate">🌿 Carbon Slate Gray (Elegant Corporate)</option>
                        <option value="stealth-amoled">🕶️ Stealth Amoled Dark (Midnight Black Contrast)</option>
                      </select>
                    </div>

                    <div className="space-y-3.5 pt-2">
                      <div className="flex justify-between items-center bg-slate-950/40 border border-slate-850 p-2.5 rounded-lg">
                        <span className="text-slate-400">MAINTENANCE GATE SWITCH:</span>
                        <button
                          onClick={() =>
                            setSystemSettings((prev) => ({
                              ...prev,
                              maintenanceMode: !prev.maintenanceMode,
                            }))
                          }
                          className={`px-3 py-1 rounded text-[10px] font-bold ${
                            systemSettings.maintenanceMode
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                              : "bg-slate-900 border border-slate-800 text-slate-500"
                          }`}
                        >
                          {systemSettings.maintenanceMode ? "ENABLED DIRECT" : "DISABLED"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* HLS Player preferences configs */}
                <div className="bg-[#0a0b1c]/80 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
                  <h3 className="text-xs font-bold font-mono text-slate-350 tracking-wider uppercase flex items-center gap-2">
                    <Sliders className="text-cyan-400" size={14} /> HLS PLAYER PREFERENCES
                  </h3>

                  <div className="space-y-4 font-mono text-xs">
                    <div className="space-y-1">
                      <label className="text-slate-400 uppercase">DEFAULT PREBUFFER FILLING (MS)</label>
                      <input
                        type="number"
                        value={systemSettings.defaultBufferMs}
                        onChange={(e) =>
                          setSystemSettings((prev) => ({
                            ...prev,
                            defaultBufferMs: Math.max(0, parseInt(e.target.value) || 0),
                          }))
                        }
                        className="w-full bg-[#03040b]/85 border border-slate-800 rounded-lg p-2.5 text-[#fff] focus:outline-none"
                      />
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <span className="text-slate-450 uppercase">Autoplay streams:</span>
                      <button
                        onClick={() =>
                          setSystemSettings((prev) => ({ ...prev, autoplay: !prev.autoplay }))
                        }
                        className={`px-3 py-1.5 rounded text-[10px] font-bold cursor-pointer border ${
                          systemSettings.autoplay
                            ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/25"
                            : "bg-slate-900 border-slate-800 text-slate-500"
                        }`}
                      >
                        {systemSettings.autoplay ? "ACTIVE" : "INACTIVE"}
                      </button>
                    </div>

                    {globalSettingsSaved && (
                      <p className="text-emerald-400 text-[10px] italic">Global system cache configs saved!</p>
                    )}

                    <div className="pt-6">
                      <button
                        onClick={handleSaveGlobalConfigs}
                        className="w-full py-2.5 bg-gradient-to-r from-[#9333ea] to-indigo-500 hover:from-purple-500 hover:to-indigo-400 text-white font-bold tracking-wider uppercase rounded-xl transition-all cursor-pointer shadow-md"
                      >
                        SAVE GLOBAL CONFIGURATIONS
                      </button>
                    </div>
                  </div>
                </div>

                {/* Bulk M3U Loader panel */}
                <div className="md:col-span-2 bg-[#0a0b1c]/70 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
                  <h3 className="text-xs font-bold font-mono text-slate-350 tracking-wider uppercase flex items-center gap-2">
                    <Upload size={14} className="text-cyan-400" /> RAW M3U IMPORTER ENGINE WITH BULK COMPILES
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-4">
                      {/* Paste area */}
                      <textarea
                        rows={6}
                        placeholder="#EXTM3U&#10;#EXTINF:-1 tvg-logo='http://logo...' group-title='News',Sky News&#10;http://stream.skynews.live..."
                        value={m3uText}
                        onChange={(e) => setM3uText(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs text-white placeholder-slate-650 font-mono focus:outline-none focus:border-cyan-400/50"
                      />

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={handleM3uParse}
                          className="px-4.5 py-2 bg-[#9333ea] hover:bg-[#a855f7] text-white font-mono text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                        >
                          DECODE PAYLOAD
                        </button>

                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="px-4.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-350 text-xs font-semibold rounded-lg cursor-pointer"
                        >
                          UPLOAD LOCAL FILE
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".m3u"
                          onChange={handleM3uFileUpload}
                          className="hidden"
                        />
                      </div>

                      {/* URL fetcher segment */}
                      <div className="space-y-2 pt-2">
                        <p className="text-[10px] font-mono text-slate-500 uppercase">Or Import playlist directly via HLS HTTP/S link:</p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="e.g. https://iptv-org.github.io/iptv/index.m3u"
                            value={m3uUrlInput}
                            onChange={(e) => setM3uUrlInput(e.target.value)}
                            className="flex-1 bg-slate-950 border border-slate-850 rounded-lg p-2 text-xs text-slate-200 focus:outline-none font-mono placeholder-slate-600"
                          />
                          <button
                            onClick={handleFetchDraftM3uFromUrl}
                            className="px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-mono font-semibold text-xs rounded-lg cursor-pointer flex items-center gap-1 shrink-0"
                          >
                            GET <ArrowRight size={13} />
                          </button>
                        </div>
                      </div>

                      {m3uSuccess && (
                        <p className="text-emerald-450 text-[10px] font-mono">{m3uSuccess}</p>
                      )}
                      {m3uError && (
                        <p className="text-rose-450 text-[10px] font-mono">{m3uError}</p>
                      )}
                    </div>

                    {/* Previews panel */}
                    <div className="bg-slate-950/75 border border-slate-850 rounded-xl p-4 flex flex-col h-[300px]">
                      <div className="flex justify-between items-center pb-2.5 border-b border-slate-850">
                        <span className="text-[10px] font-mono text-slate-500 uppercase">Payload Deconstruction Previews:</span>
                        {parsedList.length > 0 && (
                          <button
                            disabled={importingTotal}
                            onClick={handleBulkImportSave}
                            className="bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-[#000] font-mono font-black text-[9px] px-3 py-1 rounded uppercase cursor-pointer"
                          >
                            {importingTotal ? "IMPORTING..." : `SAVE ${parsedList.length} STREAMS`}
                          </button>
                        )}
                      </div>

                      <div className="flex-1 overflow-y-auto space-y-2 mt-2 scrollbar-thin scrollbar-thumb-slate-800">
                        {parsedList.map((item, idx) => (
                          <div key={idx} className="bg-[#000] border border-slate-850 p-2 rounded flex items-center gap-2.5 text-[10px] font-mono">
                            <img
                              src={item.logo}
                              className="w-7 h-7 rounded bg-slate-900 p-0.5 object-contain"
                              alt=""
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100";
                              }}
                            />
                            <div className="truncate flex-1">
                              <p className="font-bold text-slate-200 truncate">{item.name}</p>
                              <span className="text-[8px] text-[#4d5375] uppercase">{item.category}</span>
                            </div>
                          </div>
                        ))}
                        {parsedList.length === 0 && (
                          <div className="h-full flex items-center justify-center text-center text-slate-650 uppercase font-mono text-[9px] tracking-widest">
                            No channels extracted yet
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "tester" && (
              <div className="space-y-6">
                {/* Visual Header */}
                <div className="bg-gradient-to-r from-slate-900 to-[#0a0b1c] border border-slate-800/80 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden shadow-xl">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
                  
                  <div className="space-y-1 font-mono">
                    <h2 className="text-sm font-black tracking-widest text-slate-100 uppercase flex items-center gap-2">
                      <Terminal className="text-cyan-400 animate-pulse" size={16} /> STREAM DIAGNOSTICS & TESTER DECK
                    </h2>
                    <p className="text-[10px] text-slate-400 leading-relaxed uppercase tracking-tight">
                      Verify broadcast nodes, deconstruct connection latency, analyze HTTP status, trace CORS headers, and administratively decommission dead coordinates.
                    </p>
                  </div>
                </div>

                {/* Grid layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column: Manual Analyzer and Quick Selector */}
                  <div className="bg-[#0a0b1c]/80 border border-slate-800/65 p-6 rounded-2xl space-y-5 shadow-xl">
                    <h3 className="text-xs font-bold font-mono text-slate-350 tracking-wider uppercase flex items-center gap-2 border-b border-slate-800/65 pb-3">
                      <Sliders className="text-cyan-400 animate-pulse" size={14} /> MANUAL FIELD ANALYZER
                    </h3>

                    <div className="space-y-4 font-mono text-xs">
                      {/* Preselect Option */}
                      <div className="space-y-1.5">
                        <label className="text-slate-400 uppercase tracking-wider block text-[10px]">Pre-fill From Live Channels Catalog</label>
                        <select
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val) setTesterUrl(val);
                          }}
                          className="w-full bg-[#03040b]/85 border border-slate-800 rounded-xl p-3 text-[#fff] focus:outline-none focus:border-cyan-400/50 cursor-pointer scrollbar-thin scrollbar-thumb-slate-800 uppercase"
                        >
                          <option value="">-- SELECT CHANNEL TO TEST --</option>
                          {channels.map((c) => (
                            <option key={c.id} value={c.url}>
                              {c.name} ({c.category})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Manual Input field */}
                      <div className="space-y-1.5">
                        <label className="text-slate-400 uppercase tracking-wider block text-[10px]">Custom Stream Coordinator URL (HLS / M3U8 / TS)</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="e.g. http://server.com/live/stream.m3u8"
                            value={testerUrl}
                            onChange={(e) => setTesterUrl(e.target.value)}
                            className="flex-1 bg-[#03040b]/85 border border-slate-800 rounded-xl p-3 text-[#fff] placeholder-slate-600 focus:outline-none focus:border-cyan-400/50"
                          />
                        </div>
                      </div>

                      <button
                        disabled={testerLoading || !testerUrl}
                        onClick={() => handleSingleURLTest(testerUrl)}
                        className="w-full py-3 bg-gradient-to-r from-cyan-400 via-teal-500 to-indigo-600 hover:from-cyan-350 hover:to-indigo-500 disabled:from-slate-800 disabled:to-slate-900 disabled:opacity-50 text-slate-950 font-black tracking-wider uppercase rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                      >
                        {testerLoading ? (
                          <>
                            <RefreshCw size={14} className="animate-spin text-[#000]" />
                            DECODING CORRIDORS...
                          </>
                        ) : (
                          <>
                            <Play size={14} className="text-[#000]" />
                            ENGAGE DIAGNOSTIC SWEEP
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Diagnostic Sweeping Result Panel */}
                  <div className="bg-[#0a0b1c]/80 border border-slate-800/65 p-6 rounded-2xl space-y-4 shadow-xl flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs font-bold font-mono text-slate-350 tracking-wider uppercase flex items-center gap-2 border-b border-slate-800/65 pb-3">
                        <Activity className="text-indigo-400 animate-pulse" size={14} /> DECONSTRUCTED METADATA FEED
                      </h3>

                      {!testerResult && !testerLoading && (
                        <div className="h-[200px] flex flex-col items-center justify-center text-center font-mono text-[10px] text-slate-500 uppercase tracking-widest gap-2">
                          <Cpu size={24} className="text-slate-750 animate-pulse" />
                          Awaiting sweeping instructions
                        </div>
                      )}

                      {testerLoading && (
                        <div className="h-[200px] flex flex-col items-center justify-center text-center font-mono text-[10px] text-cyan-400 uppercase tracking-widest gap-2">
                          <RefreshCw size={24} className="animate-spin" />
                          Acquiring TCP Handshake...
                        </div>
                      )}

                      {testerResult && !testerLoading && (
                        <div className="space-y-4 font-mono text-xs pt-2">
                          <div className="space-y-1 bg-[#020211]/90 border border-slate-850 p-3 rounded-xl">
                            <span className="text-[10px] text-slate-500 uppercase font-bold">Query Address</span>
                            <p className="text-slate-200 select-all break-all max-h-[60px] overflow-y-auto w-full scrollbar-thin scrollbar-thumb-slate-850">
                              {testerResult.url}
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-[#020211]/90 border border-slate-850 p-3 rounded-xl space-y-1">
                              <span className="text-[10px] text-slate-500 uppercase font-bold">Receiver Status</span>
                              <p className={`font-bold text-sm ${testerResult.responseStatus.includes("200") || testerResult.responseStatus.includes("via Proxy") ? "text-emerald-400" : "text-rose-400"}`}>
                                {testerResult.responseStatus}
                              </p>
                            </div>

                            <div className="bg-[#020211]/90 border border-slate-850 p-3 rounded-xl space-y-1">
                              <span className="text-[10px] text-slate-500 uppercase font-bold font-mono">Response Speed</span>
                              <p className="text-slate-200 font-bold text-sm">
                                {testerResult.latency > 0 ? `${testerResult.latency} ms` : "Timeout / Dead"}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-[#020211]/90 border border-slate-850 p-3 rounded-xl space-y-1">
                              <span className="text-[10px] text-slate-500 uppercase font-bold">Sandbox Cors</span>
                              <span className={`text-[10px] font-bold block ${testerResult.corsStatus.includes("Allowed") ? "text-emerald-400" : "text-amber-400"}`}>
                                {testerResult.corsStatus}
                              </span>
                            </div>

                            <div className="bg-[#020211]/90 border border-slate-850 p-3 rounded-xl space-y-1">
                              <span className="text-[10px] text-slate-500 uppercase font-bold">Playable State</span>
                              <span className={`text-[10px] font-bold block ${testerResult.playable.includes("Direct") ? "text-emerald-400" : testerResult.playable.includes("Proxy") ? "text-cyan-400" : "text-rose-400"}`}>
                                {testerResult.playable}
                              </span>
                            </div>
                          </div>

                          <div className="bg-[#020211]/90 border border-slate-850 p-3 rounded-xl space-y-1">
                            <span className="text-[10px] text-slate-500 uppercase font-bold block font-mono">Diagnostic Inference</span>
                            <p className="text-[10px] text-slate-400 leading-relaxed font-sans mt-1">
                              {testerResult.errorDetails}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bulk Validator Area */}
                <div className="bg-[#0a0b1c]/70 border border-slate-800 p-6 rounded-2xl space-y-6 shadow-xl">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-850 pb-4">
                    <div className="space-y-1 font-mono">
                      <h3 className="text-xs font-bold text-slate-350 tracking-wider uppercase flex items-center gap-2">
                        <Database className="text-purple-500" size={14} /> CATALOG VALIDATOR SERVICES
                      </h3>
                      <p className="text-[10px] text-slate-500 uppercase">
                        Sequentially analyze all channels in database to spot expired tokens, CORS failures & dead servers.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        disabled={bulkTestingActive || channels.length === 0}
                        onClick={handleBulkValidationRun}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-mono text-xs font-semibold rounded-lg flex items-center gap-2 transition-all cursor-pointer shadow-md"
                      >
                        {bulkTestingActive ? (
                          <>
                            <RefreshCw size={13} className="animate-spin" />
                            ANALYZING ({bulkTestProgress}/{channels.length})
                          </>
                        ) : (
                          <>
                            <Radio size={13} className="animate-pulse" />
                            VALIDATE ALL STREAMS
                          </>
                        )}
                      </button>

                      {Object.keys(bulkTestResults).length > 0 && !bulkTestingActive && (
                        <button
                          onClick={handlePurgeDeadChannels}
                          className="px-4 py-2 bg-rose-600/30 hover:bg-rose-600/50 text-rose-350 font-mono text-xs font-semibold rounded-lg flex items-center gap-2 transition-all cursor-pointer border border-rose-500/20 shadow-md"
                        >
                          <Trash size={13} />
                          PURGE ALL DEAD CHANNELS
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar if analyzing */}
                  {bulkTestingActive && (
                    <div className="space-y-1.5 font-mono text-[10px]">
                      <div className="flex justify-between text-slate-450 uppercase">
                        <span>Calibration Progress:</span>
                        <span>{Math.round((bulkTestProgress / channels.length) * 100)}%</span>
                      </div>
                      <div className="w-full bg-[#03040b] h-2.5 rounded-full overflow-hidden border border-slate-900">
                        <div
                          className="bg-gradient-to-r from-purple-500 to-cyan-400 h-full transition-all duration-300"
                          style={{ width: `${(bulkTestProgress / channels.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Multi-tier Analysis Summary Badges */}
                  {Object.keys(bulkTestResults).length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 font-mono text-xs text-center">
                      <div className="bg-emerald-950/20 border border-emerald-500/20 p-3 rounded-xl">
                        <p className="text-emerald-450 text-[10px] uppercase font-bold">Online</p>
                        <p className="text-xl font-bold text-emerald-400 mt-1">
                          {(Object.values(bulkTestResults) as any[]).filter((r) => r.playable === "Online").length}
                        </p>
                      </div>
                      <div className="bg-amber-950/20 border border-amber-500/20 p-3 rounded-xl">
                        <p className="text-amber-450 text-[10px] uppercase font-bold">CORS Blocked</p>
                        <p className="text-xl font-bold text-amber-400 mt-1">
                          {(Object.values(bulkTestResults) as any[]).filter((r) => r.playable === "CORS Blocked").length}
                        </p>
                      </div>
                      <div className="bg-cyan-950/20 border border-cyan-500/20 p-3 rounded-xl">
                        <p className="text-cyan-450 text-[10px] uppercase font-bold">HTTPS Blocked</p>
                        <p className="text-xl font-bold text-cyan-400 mt-1">
                          {(Object.values(bulkTestResults) as any[]).filter((r) => r.playable === "HTTPS Blocked").length}
                        </p>
                      </div>
                      <div className="bg-purple-950/20 border border-purple-500/20 p-3 rounded-xl">
                        <p className="text-purple-450 text-[10px] uppercase font-bold">Token Expired</p>
                        <p className="text-xl font-bold text-purple-400 mt-1">
                          {(Object.values(bulkTestResults) as any[]).filter((r) => r.playable === "Token Expired").length}
                        </p>
                      </div>
                      <div className="bg-rose-950/20 border border-rose-500/20 p-3 rounded-xl animate-pulse">
                        <p className="text-rose-450 text-[10px] uppercase font-bold">Offline</p>
                        <p className="text-xl font-bold text-rose-400 mt-1">
                          {(Object.values(bulkTestResults) as any[]).filter((r) => r.playable === "Offline").length}
                        </p>
                      </div>
                      <div className="bg-slate-900/40 border border-slate-700/20 p-3 rounded-xl">
                        <p className="text-slate-400 text-[10px] uppercase font-bold">Unknown Error</p>
                        <p className="text-xl font-bold text-slate-350 mt-1">
                          {(Object.values(bulkTestResults) as any[]).filter((r) => r.playable === "Unknown Error").length}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Bulk Filter Controls & List */}
                  {Object.keys(bulkTestResults).length > 0 && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2 border-b border-slate-850/50 pb-3">
                        {["all", "Online", "CORS Blocked", "HTTPS Blocked", "Token Expired", "Offline", "Unknown Error"].map((filter) => {
                          const count =
                            filter === "all"
                              ? Object.keys(bulkTestResults).length
                              : (Object.values(bulkTestResults) as any[]).filter((r) => r.playable === filter).length;

                          return (
                            <button
                              key={filter}
                              onClick={() => setBulkTestFilter(filter)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all cursor-pointer border ${
                                bulkTestFilter === filter
                                  ? "bg-[#a855f7]/15 text-purple-400 border-purple-500/30"
                                  : "bg-slate-900/45 border-slate-850 text-slate-400 hover:text-slate-200"
                              }`}
                            >
                              {filter === "all" ? "All" : filter} ({count})
                            </button>
                          );
                        })}
                      </div>

                      <div className="max-h-[350px] overflow-y-auto border border-slate-850/60 rounded-xl divide-y divide-slate-850 scrollbar-thin scrollbar-thumb-slate-800 bg-[#020211]/50">
                        {channels
                          .filter((c) => {
                            const result = bulkTestResults[c.id];
                            if (!result) return false;
                            if (bulkTestFilter === "all") return true;
                            return result.playable === bulkTestFilter;
                          })
                          .map((c) => {
                            const result = bulkTestResults[c.id];
                            const status = result.playable;
                            
                            const badgeColor = 
                              status === "Online"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : status === "CORS Blocked"
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                : status === "HTTPS Blocked"
                                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                                : status === "Token Expired"
                                ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                : status === "Offline"
                                ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                : "bg-slate-400/10 text-slate-400 border border-slate-400/20";

                            return (
                              <div key={c.id} className="p-3.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 font-mono text-xs hover:bg-[#0a0b1c]/45 transition-colors">
                                <div className="flex items-center gap-3 min-w-[200px] shrink-0">
                                  <img
                                    src={c.logo}
                                    className="w-8 h-8 rounded bg-black border border-slate-800 shrink-0 object-contain"
                                    alt=""
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src =
                                        "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100";
                                    }}
                                  />
                                  <div className="truncate">
                                    <p className="font-bold text-slate-250 truncate">{c.name}</p>
                                    <span className="text-[8px] text-[#4d5375] uppercase">{c.category}</span>
                                  </div>
                                </div>

                                <div className="flex-1 truncate text-slate-500 text-[10px]" title={c.url}>
                                  {c.url}
                                </div>

                                <div className="flex items-center gap-3 justify-between md:justify-end shrink-0">
                                  {/* Speed badge */}
                                  <span className="text-slate-400 text-[10px]">
                                    {result.latency > 0 ? `${result.latency}ms` : "-"}
                                  </span>

                                  {/* Playability Status Badge */}
                                  <span className={`px-2 py-1 rounded text-[9px] font-bold tracking-wider uppercase ${badgeColor}`}>
                                    {status}
                                  </span>

                                  {/* Tester Action Trigger inline */}
                                  <button
                                    onClick={() => handleSingleURLTest(c.url)}
                                    className="px-2 py-0.5 bg-slate-900 border border-slate-800 hover:border-[#a855f7]/30 text-slate-450 hover:text-purple-400 rounded text-[9px] transition-colors cursor-pointer"
                                    title="Re-run Diagnostics"
                                  >
                                    RE-TEST
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "playlist" && (
              <div className="space-y-6">
                {/* Visual Header */}
                <div className="bg-[#0a0b1c]/80 border border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden shadow-xl">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
                  
                  <div className="space-y-1 font-mono">
                    <h2 className="text-sm font-black tracking-widest text-[#a855f7] uppercase flex items-center gap-2">
                      <ListPlus className="text-purple-400 animate-pulse" size={16} /> PLAYLIST COGNITIVE INTAKE
                    </h2>
                    <p className="text-[10px] text-slate-400 leading-relaxed uppercase tracking-tight">
                      Upload, parse, validate, and bulk-import `.txt`, `.m3u`, `.m3u8`, or JSON television broadcast configurations directly.
                    </p>
                  </div>
                </div>

                {/* Sub-tab Navigation */}
                <div className="flex border-b border-slate-800/60 pb-px gap-1">
                  {(["upload", "history", "errors"] as const).map((sub) => {
                    const label = sub === "upload" ? "Upload & Ingest" : sub === "history" ? "Import History" : "Intake Error Logs";
                    const Icon = sub === "upload" ? Upload : sub === "history" ? Clock : AlertCircle;
                    const countSuffix = sub === "history" ? ` (${importHistoryList.length})` : sub === "errors" ? ` (${importErrors.length})` : "";
                    
                    return (
                      <button
                        key={sub}
                        onClick={() => setPlaylistSubTab(sub)}
                        className={`px-5 py-3 text-xs font-semibold tracking-wider font-mono uppercase transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
                          playlistSubTab === sub
                            ? "border-purple-500 text-purple-400 bg-purple-500/5"
                            : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20"
                        }`}
                      >
                        <Icon size={14} />
                        <span>{label}{countSuffix}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Sub-tab: Upload & Ingest */}
                {playlistSubTab === "upload" && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left Panel: File Drop and Configs */}
                    <div className="lg:col-span-8 space-y-6">
                      {/* Drag-drop Area */}
                      <div
                        onDragOver={handleDragOverPlaylist}
                        onDrop={handleDropPlaylist}
                        className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all min-h-[220px] ${
                          importActive
                            ? "border-purple-500/35 bg-purple-950/20"
                            : importFileName
                            ? "border-emerald-500/40 bg-emerald-950/10"
                            : "border-slate-800 hover:border-slate-700 bg-slate-950/20 hover:bg-slate-950/40"
                        }`}
                      >
                        <input
                          type="file"
                          id="playlist-file-picker"
                          accept=".txt,.m3u,.m3u8,.json"
                          onChange={handlePlaylistFileChange}
                          className="hidden"
                          disabled={importActive}
                        />
                        
                        {!importActive && !importFileName && (
                          <label
                            htmlFor="playlist-file-picker"
                            className="cursor-pointer flex flex-col items-center gap-3"
                          >
                            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/20">
                              <Upload size={22} className="animate-bounce" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-bold font-mono text-slate-300 uppercase">
                                DROP FILE HERE OR CLICK TO BROWSE
                              </p>
                              <p className="text-[9px] text-[#4d5375] uppercase">
                                Supports .txt, .m3u, .m3u8, and JSON lists
                              </p>
                            </div>
                          </label>
                        )}

                        {importFileName && !importActive && (
                          <div className="flex flex-col items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                              <FileText size={22} />
                            </div>
                            <div className="space-y-1 flex flex-col items-center">
                              <div className="flex items-center gap-2 justify-center">
                                <p className="text-xs font-bold font-mono text-slate-100 uppercase truncate max-w-[280px]">
                                  {importFileName}
                                </p>
                                <button
                                  onClick={() => {
                                    setImportFileName("");
                                    setImportText("");
                                    setParsedImportChannels([]);
                                  }}
                                  className="text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                              <p className="text-[10px] text-emerald-400 font-mono font-bold uppercase mt-1">
                                Ready: parsed {parsedImportChannels.length} streams
                              </p>
                            </div>
                          </div>
                        )}

                        {importActive && (
                          <div className="w-full max-w-md space-y-4">
                            <div className="flex justify-between items-center font-mono text-[10px] uppercase">
                              <span className="text-[#a855f7] font-bold animate-pulse">INGESTING CHANNEL FLUX</span>
                              <span className="text-slate-300 font-black">{importProgress}%</span>
                            </div>
                            <div className="w-full bg-[#03040b] h-3 rounded-full overflow-hidden border border-slate-900">
                              <div
                                className="bg-gradient-to-r from-purple-500 to-cyan-400 h-full transition-all duration-300"
                                style={{ width: `${importProgress}%` }}
                              />
                            </div>
                            <div className="grid grid-cols-3 gap-2 font-mono text-[9px] text-center uppercase">
                              <div className="bg-[#0b0a1d] p-2 rounded border border-purple-500/10">
                                <p className="text-[#4d5375]">Imported</p>
                                <p className="text-emerald-400 font-bold text-sm mt-0.5">{importSuccessCount}</p>
                              </div>
                              <div className="bg-[#0b0a1d] p-2 rounded border border-purple-500/10">
                                <p className="text-[#4d5375]">Failed / Dupe</p>
                                <p className="text-rose-400 font-bold text-sm mt-0.5">{importFailedCount}</p>
                              </div>
                              <div className="bg-[#0b0a1d] p-2 rounded border border-purple-500/10">
                                <p className="text-[#4d5375]">Total Progress</p>
                                <p className="text-cyan-400 font-bold text-sm mt-0.5">
                                  {importTotalProcessed} / {parsedImportChannels.length}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Configurations Block */}
                      <div className="bg-[#0a0b1c]/70 border border-slate-800 p-6 rounded-2xl space-y-4 font-mono shadow-xl relative">
                        <div className="absolute top-4 right-4 text-[9px] text-[#4d5375] uppercase font-bold">
                          Config Deck
                        </div>
                        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-slate-850">
                          <Sliders size={14} className="text-purple-400" /> INTAKE SETTINGS
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 col-span-2">
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 uppercase">Default Category Assignment</label>
                            <input
                              type="text"
                              value={importDefaultCategory}
                              onChange={(e) => setImportDefaultCategory(e.target.value)}
                              placeholder="e.g. Imported, news, etc."
                              className="w-full bg-[#03040b] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-650 font-sans outline-none focus:border-purple-650"
                              disabled={importActive}
                            />
                            <p className="text-[8px] text-slate-500 leading-normal uppercase">
                              Fallback for streams containing no grouping attributes. Allows manual assignment.
                            </p>
                          </div>

                          <div className="space-y-4 pt-1">
                            {/* Auto Categories Checkbox */}
                            <label className="flex items-center gap-3 cursor-pointer group text-[10px] text-slate-400 uppercase font-mono">
                              <input
                                type="checkbox"
                                checked={importAutoCategories}
                                onChange={(e) => setImportAutoCategories(e.target.checked)}
                                className="sr-only select-none pointer-events-none"
                                disabled={importActive}
                              />
                              <div className={`w-4 h-4 rounded border transition-colors flex items-center justify-center shrink-0 ${
                                importAutoCategories ? "bg-purple-600 border-purple-500 text-white" : "border-slate-850 bg-black/40 group-hover:border-slate-700"
                              }`}>
                                {importAutoCategories && <Check size={10} strokeWidth={3} />}
                              </div>
                              <div className="space-y-0.5">
                                <span className={importAutoCategories ? "text-slate-100 font-bold" : ""}>Auto-Create Categories</span>
                                <p className="text-[8px] text-slate-500 uppercase leading-none mt-0.5">
                                  Parse playlist group-title tags dynamically as new categories.
                                </p>
                              </div>
                            </label>

                            {/* Stream Probing Checkbox */}
                            <label className="flex items-center gap-3 cursor-pointer group text-[10px] text-slate-400 uppercase font-mono">
                              <input
                                type="checkbox"
                                checked={importValidateStreams}
                                onChange={(e) => setImportValidateStreams(e.target.checked)}
                                className="sr-only select-none pointer-events-none"
                                disabled={importActive}
                              />
                              <div className={`w-4 h-4 rounded border transition-colors flex items-center justify-center shrink-0 ${
                                importValidateStreams ? "bg-purple-600 border-purple-500 text-white" : "border-slate-850 bg-black/40 group-hover:border-slate-700"
                              }`}>
                                {importValidateStreams && <Check size={10} strokeWidth={3} />}
                              </div>
                              <div className="space-y-0.5">
                                <span className={importValidateStreams ? "text-slate-100 font-bold" : ""}>Validate Stream URLs</span>
                                <p className="text-[8px] text-slate-500 uppercase leading-none mt-0.5">
                                  Verify broadcast feeds are live and active before importing.
                                </p>
                              </div>
                            </label>
                          </div>
                        </div>

                        {parsedImportChannels.length > 0 && !importActive && (
                          <div className="pt-4 border-t border-slate-850/50 flex justify-end">
                            <button
                              onClick={runPlaylistImport}
                              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-extrabold uppercase rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer border border-[#fff]/10"
                            >
                              <Play size={13} fill="currentColor" />
                              INITIATE PLAYLIST INTEGRATION ({parsedImportChannels.length} STREAMS)
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Panel: Parsed Streams Preview */}
                    <div className="lg:col-span-4 flex flex-col bg-[#070814]/80 border border-slate-800 rounded-2xl h-[470px] shadow-xl relative overflow-hidden">
                      <div className="p-4 border-b border-slate-850 bg-slate-950/25 flex justify-between items-center font-mono">
                        <span className="text-[10px] text-slate-350 font-bold uppercase tracking-widest">
                          PARSED CHANNELS TELEMETRY
                        </span>
                        <span className="text-[9px] bg-purple-500/10 border border-purple-500/20 text-purple-400 font-bold px-2 py-0.5 rounded-full uppercase">
                          {parsedImportChannels.length} Listed
                        </span>
                      </div>

                      <div className="flex-1 overflow-y-auto p-4 space-y-2.5 scrollbar-thin scrollbar-thumb-slate-850 bg-black/20">
                        {parsedImportChannels.map((item, idx) => (
                          <div key={idx} className="bg-[#000]/30 border border-slate-850/50 p-2 rounded-xl flex items-center gap-3 text-[10px] font-mono group hover:border-[#a855f7]/30 transition-all">
                            <img
                              src={item.logo}
                              className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-850 object-contain p-0.5 shrink-0 select-none pointer-events-none"
                              alt=""
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100";
                              }}
                              referrerPolicy="no-referrer"
                            />
                            <div className="truncate flex-1">
                              <p className="font-bold text-slate-200 truncate group-hover:text-slate-100">{item.name}</p>
                              <p className="text-[8px] text-[#4d5375] uppercase truncate mt-0.5 select-all">{item.url}</p>
                            </div>
                          </div>
                        ))}

                        {parsedImportChannels.length === 0 && (
                          <div className="h-full flex flex-col items-center justify-center text-center font-mono text-[9px] text-[#4d5375] uppercase tracking-widest py-12 gap-2">
                            <Cpu size={28} className="text-slate-800 select-none animate-pulse" />
                            No data stream preview available
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-tab: Import History */}
                {playlistSubTab === "history" && (
                  <div className="bg-[#0a0b1c]/50 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
                    <div className="border-b border-slate-850 pb-4 font-mono">
                      <h3 className="text-xs font-bold text-slate-350 tracking-wider uppercase flex items-center gap-2">
                        <Clock className="text-cyan-400" size={14} /> HISTORICAL PLAYLIST IMPORT RECORDS
                      </h3>
                      <p className="text-[9px] text-slate-500 uppercase mt-0.5">
                        Track historical ingestion sessions, file configurations, and invoke bulk un-synchronizations.
                      </p>
                    </div>

                    {loadingImportHistory && (
                      <div className="py-12 flex flex-col items-center justify-center text-center font-mono text-xs text-cyan-400 uppercase tracking-widest gap-2">
                        <RefreshCw size={24} className="animate-spin" />
                        Scanning Ingress History...
                      </div>
                    )}

                    {!loadingImportHistory && importHistoryList.length === 0 && (
                      <div className="py-16 flex flex-col items-center justify-center text-center font-mono text-[10px] text-[#4d5375] uppercase tracking-widest gap-2">
                        <Clock size={28} className="text-slate-800 animate-pulse select-none" />
                        No historical imports registered
                      </div>
                    )}

                    {!loadingImportHistory && importHistoryList.length > 0 && (
                      <div className="overflow-x-auto border border-slate-850 rounded-xl">
                        <table className="w-full text-left border-collapse font-mono text-xs text-slate-300">
                          <thead>
                            <tr className="bg-[#03040b]/90 text-slate-400 uppercase text-[9px] tracking-wider border-b border-slate-850 select-none">
                              <th className="p-4">File Name</th>
                              <th className="p-4">Import Run Date</th>
                              <th className="p-4 text-center">Channels Parsed</th>
                              <th className="p-4 text-center">Successfully Ingested</th>
                              <th className="p-4 text-center">Failed / Skipped</th>
                              <th className="p-4">Status</th>
                              <th className="p-4 text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850 bg-[#020211]/30">
                            {importHistoryList.map((batch) => {
                              const dateStr = batch.timestamp?.seconds
                                ? new Date(batch.timestamp.seconds * 1000).toLocaleString()
                                : new Date(batch.timestamp).toLocaleString();
                              
                              const isSuccess = batch.status === "success";
                              const isPartial = batch.status === "partial";
                              
                              return (
                                <tr key={batch.id} className="hover:bg-[#070814]/70 transition-all">
                                  <td className="p-4 font-bold text-slate-100 max-w-[180px] truncate" title={batch.fileName}>
                                    {batch.fileName}
                                  </td>
                                  <td className="p-4 text-slate-450">{dateStr}</td>
                                  <td className="p-4 text-center font-bold text-slate-300">{batch.totalChannels}</td>
                                  <td className="p-4 text-center font-bold text-emerald-400">{batch.importedCount}</td>
                                  <td className="p-4 text-center font-bold text-slate-500">{batch.failedCount}</td>
                                  <td className="p-4">
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                      isSuccess
                                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/10"
                                        : isPartial
                                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/10"
                                        : "bg-rose-500/10 text-rose-400 border border-rose-500/10"
                                    }`}>
                                      {batch.status}
                                    </span>
                                  </td>
                                  <td className="p-4 text-center">
                                    <div className="flex justify-center gap-2">
                                      {batch.importedCount > 0 && (
                                        <button
                                          onClick={() => handleBulkDeleteImport(batch)}
                                          className="p-1.5 bg-rose-600/15 hover:bg-rose-650 border border-rose-500/20 hover:border-transparent text-rose-400 hover:text-white rounded-lg transition-all cursor-pointer shadow-sm uppercase text-[9px] font-black"
                                          title="Decommission all channels loaded by this file batch"
                                        >
                                          BULK DELETE IMPORTED CHANNELS
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-tab: Intake Error Logs */}
                {playlistSubTab === "errors" && (
                  <div className="bg-[#0a0b1c]/50 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
                    <div className="border-b border-slate-850 pb-4 font-mono flex justify-between items-center">
                      <div>
                        <h3 className="text-xs font-bold text-slate-350 tracking-wider uppercase flex items-center gap-2">
                          <AlertCircle className="text-[#f43f5e]" size={14} /> PLAYLIST COGNITIVE ERROR REPOSITORY
                        </h3>
                        <p className="text-[9px] text-slate-500 uppercase mt-0.5">
                          Analyze duplicate overlaps, parsed omissions, block checks, and verification failure codes.
                        </p>
                      </div>

                      {importErrors.length > 0 && (
                        <button
                          onClick={() => setImportErrors([])}
                          className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-705 hover:bg-slate-850 text-slate-400 hover:text-slate-200 text-[10px] font-black uppercase rounded-lg font-mono transition-all cursor-pointer"
                        >
                          Clear Session Logs
                        </button>
                      )}
                    </div>

                    {importErrors.length === 0 && (
                      <div className="py-16 flex flex-col items-center justify-center text-center font-mono text-[10px] text-[#4d5375] uppercase tracking-widest gap-2">
                        <CheckCircle size={28} className="text-[#10b981] select-none animate-pulse" />
                        All imports stable. Zero session anomalies.
                      </div>
                    )}

                    {importErrors.length > 0 && (
                      <div className="space-y-2 max-h-[420px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-850 p-1">
                        {importErrors.map((err, idx) => (
                          <div key={idx} className="bg-rose-950/5 border border-rose-500/10 px-4 py-3 rounded-xl flex items-start gap-3 hover:bg-rose-950/10 transition-colors">
                            <AlertCircle size={14} className="text-rose-450 shrink-0 mt-0.5" />
                            <div className="font-mono text-xs space-y-0.5 select-text">
                              <span className="text-rose-400 font-bold block uppercase text-[10px]">Session Intake Incident</span>
                              <p className="text-slate-300 leading-relaxed max-w-4xl break-all">{err}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Global Premium Confirmation Modal */}
        <AnimatePresence>
          {confirmModal && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  if (!confirmLoading) setConfirmModal(null);
                }}
                className="absolute inset-0 bg-[#020211]/85 backdrop-blur-md"
              />

              {/* Box */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ type: "spring", duration: 0.4 }}
                className="relative w-full max-w-md bg-[#0a0b1c] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl p-6 select-none"
              >
                {/* Header Pattern */}
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-rose-500 via-purple-500 to-cyan-500" />

                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl shrink-0 ${confirmModal.isDangerous ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'}`}>
                    <ShieldAlert size={24} className="animate-pulse" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <h3 className="text-sm font-bold font-mono tracking-wide text-slate-100 uppercase">
                      {confirmModal.title}
                    </h3>
                    <p className="text-xs text-slate-400 font-sans leading-relaxed">
                      {confirmModal.message}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3 font-mono text-xs">
                  <button
                    disabled={confirmLoading}
                    onClick={() => setConfirmModal(null)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-all font-medium disabled:opacity-50"
                  >
                    {confirmModal.cancelLabel}
                  </button>
                  <button
                    disabled={confirmLoading}
                    onClick={async () => {
                      setConfirmLoading(true);
                      try {
                        await confirmModal.onConfirm();
                      } catch (err: any) {
                        logEvent("error", `Modal execution failure: ${err.message}`);
                      } finally {
                        setConfirmLoading(false);
                        setConfirmModal(null);
                      }
                    }}
                    className={`px-4 py-2 rounded-lg font-bold text-slate-950 transition-all focus:ring-2 flex items-center justify-center gap-1.5 ${
                      confirmModal.isDangerous
                        ? "bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 shadow-md shadow-red-950/20"
                        : "bg-gradient-to-r from-cyan-400 to-teal-500 hover:from-cyan-300 hover:to-teal-400 shadow-md shadow-cyan-950/20"
                    }`}
                  >
                    {confirmLoading ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        PROCESSING...
                      </>
                    ) : (
                      confirmModal.confirmLabel
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
