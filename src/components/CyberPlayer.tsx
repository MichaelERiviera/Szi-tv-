import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Tv,
  Workflow,
  RotateCw,
  Activity,
  Award,
  Zap,
} from "lucide-react";
import { PlaybackStats, Channel } from "../types";

interface CyberPlayerProps {
  channel: Channel;
  onWatchedProgress?: (seconds: number) => void;
}

export default function CyberPlayer({ channel, onWatchedProgress }: CyberPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [streamLevel, setStreamLevel] = useState<string>("Auto");
  const [availableLevels, setAvailableLevels] = useState<string[]>([]);
  const [streamStatus, setStreamStatus] = useState<string>("Initializing...");
  const [showTelemetry, setShowTelemetry] = useState<boolean>(true);
  const [showControls, setShowControls] = useState<boolean>(true);
  const controlsTimeoutRef = useRef<number | null>(null);
  
  const [reloadNonce, setReloadNonce] = useState<number>(0);
  const retryCountRef = useRef<number>(0);
  const retryTimeoutRef = useRef<number | null>(null);

  // Playback statistics
  const [stats, setStats] = useState<PlaybackStats>({
    resolution: "0 x 0",
    fps: 0,
    bufferLength: 0,
    bandwidth: "0 Mbps",
    latency: 0,
  });

  // Synchronize volume and muted state to the HTMLVideoElement
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.volume = volume;
      video.muted = isMuted;
    }
  }, [volume, isMuted]);

  // Load stream
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Reset state & retry logs
    retryCountRef.current = 0;
    if (retryTimeoutRef.current) {
      window.clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    setStats({
      resolution: "0 x 0",
      fps: 0,
      bufferLength: 0,
      bandwidth: "0 Mbps",
      latency: 0,
    });
    setStreamStatus("Connecting...");

    // Destroy existing HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        maxMaxBufferLength: 20,
        enableWorker: true,
        lowLatencyMode: true,
      });
      hlsRef.current = hls;

      hls.loadSource(channel.url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        setStreamStatus("Securing Link...");
      });

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        setStreamStatus("Stream Locked");
        const levels = ["Auto", ...data.levels.map((l, index) => `${l.height}p`)];
        setAvailableLevels(levels);
        video.play().catch(() => {
          setIsPlaying(false);
          setStreamStatus("Awaiting Activation");
        });
      });

      // Track level changes and statistics
      hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        const levelIndex = hls.currentLevel;
        if (levelIndex === -1) {
          setStreamLevel("Auto");
        } else {
          const l = hls.levels[levelIndex];
          setStreamLevel(`${l.height}p`);
        }
      });

      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        if (video) {
          const buffer = video.buffered;
          const currentTime = video.currentTime;
          let bufferLength = 0;
          for (let i = 0; i < buffer.length; i++) {
            if (currentTime >= buffer.start(i) && currentTime <= buffer.end(i)) {
              bufferLength = buffer.end(i) - currentTime;
              break;
            }
          }

          // Estimate speed safely
          const rawBandwidth = hls.bandwidthEstimate; // bits / second
          const mbps = (rawBandwidth / 1000000).toFixed(2);

          const videoWidth = video.videoWidth || 1920;
          const videoHeight = video.videoHeight || 1080;

          setStats((prev) => ({
            ...prev,
            resolution: `${videoWidth} x ${videoHeight}`,
            bufferLength: Number(bufferLength.toFixed(1)),
            bandwidth: `${mbps} Mbps`,
          }));
        }
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        setStreamStatus(`Signal Distorted: ${data.details}`);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (retryCountRef.current < 5) {
                const delay = Math.min(2000 * Math.pow(2, retryCountRef.current), 10000);
                retryCountRef.current += 1;
                setStreamStatus(`Connection Lost. Retrying in ${(delay / 1000).toFixed(0)}s... (${retryCountRef.current}/5)`);
                
                if (retryTimeoutRef.current) {
                  window.clearTimeout(retryTimeoutRef.current);
                }
                retryTimeoutRef.current = window.setTimeout(() => {
                  if (hlsRef.current && hlsRef.current === hls) {
                    hlsRef.current.startLoad();
                  }
                }, delay);
              } else {
                setStreamStatus("Signal offline (CORS/Geo-blocked). Try 'Open in new tab'.");
                hls.stopLoad();
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              setStreamStatus("Media decoding distorted. Recovering...");
              break;
            default:
              setStreamStatus("Stream Offline. Connection interrupted.");
              hls.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // For Safari native playback
      video.src = channel.url;
      video.addEventListener("loadedmetadata", () => {
        setStreamStatus("Locked Native HLS");
        setAvailableLevels(["Native Channel"]);
        setStreamLevel("Native");
        video.play().catch(() => {});
      });
    } else {
      setStreamStatus("Decoder Missing. Upgrade Browser");
    }

    return () => {
      if (retryTimeoutRef.current) {
        window.clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [channel.url, reloadNonce]);

  // Periodic FPS / Watch progress calculations
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const interval = setInterval(() => {
      if (!video) return;

      // Extract custom stats
      if (isPlaying) {
        // Calculate dynamic latency
        const latency = Math.random() * 0.4 + 0.1; // Simulated overlay latency
        const quality = video.getVideoPlaybackQuality ? video.getVideoPlaybackQuality() : null;
        const fps = quality ? quality.totalVideoFrames - quality.droppedVideoFrames : 60;

        setStats((prev) => ({
          ...prev,
          fps: isPlaying ? Math.min(60, Math.floor((quality ? Number(fps / (video.currentTime || 1)) : 60)) || 60) : 0,
          latency: Number(latency.toFixed(2)),
        }));

        // Report watch state to parent
        if (onWatchedProgress) {
          onWatchedProgress(Math.floor(video.currentTime));
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isPlaying, onWatchedProgress]);

  // Play/Pause handler
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
      setStreamStatus("Observation Suspended");
    } else {
      video.play().then(() => {
        setIsPlaying(true);
        setStreamStatus("Live Feed Active");
      }).catch((e) => {
        setStreamStatus(`Startup Failed: ${e.message}`);
      });
    }
  };

  // Mute / Volume handlers
  const handleVolumeChange = (value: number) => {
    const video = videoRef.current;
    if (!video) return;

    const newVolume = Math.max(0, Math.min(1, value));
    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    const targetMute = !isMuted;
    video.muted = targetMute;
    setIsMuted(targetMute);
  };

  // Switch Stream quality
  const handleLevelChange = (levelStr: string) => {
    const hls = hlsRef.current;
    if (!hls) return;

    if (levelStr === "Auto") {
      hls.currentLevel = -1;
      setStreamLevel("Auto");
    } else {
      const idx = availableLevels.indexOf(levelStr) - 1; // Subtract 1 for Auto
      if (idx >= 0) {
        hls.currentLevel = idx;
        setStreamLevel(levelStr);
      }
    }
  };

  // Fullscreen state toggling
  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!isFullscreen) {
      if (container.requestFullscreen) {
        container.requestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  // Pip API
  const togglePictureInPicture = async () => {
    const video = videoRef.current;
    if (!video) return;

    const hasStandardPip = typeof document !== "undefined" && document.pictureInPictureEnabled && typeof video.requestPictureInPicture === "function";
    const hasWebkitPip = typeof (video as any).webkitSetPresentationMode === "function";

    if (!hasStandardPip && !hasWebkitPip) {
      setStreamStatus("PIP NOT COMPATIBLE WITH BROWSER");
      return;
    }

    if (video.readyState < 1) {
      setStreamStatus("Awaiting video metadata load...");
      return;
    }

    try {
      if (hasStandardPip) {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
          setStreamStatus("Exited Picture-in-Picture");
        } else {
          await video.requestPictureInPicture();
          setStreamStatus("Entered Picture-in-Picture");
        }
      } else if (hasWebkitPip) {
        const nextMode = (video as any).webkitPresentationMode === "picture-in-picture" ? "inline" : "picture-in-picture";
        (video as any).webkitSetPresentationMode(nextMode);
        setStreamStatus(`Toggle Webkit PiP: ${nextMode}`);
      }
    } catch (e: any) {
      console.warn("PIP not supported or blocked", e);
      if (e.name === "SecurityError" || e.name === "NotAllowedError" || e.message?.includes("permission") || e.message?.includes("disallowed")) {
        setStreamStatus("PIP BLOCKED. OPEN IN NEW TAB");
      } else if (e.message?.includes("Metadata") || e.name === "InvalidStateError") {
        setStreamStatus("PIP ERROR: Metadata not loaded yet");
      } else {
        setStreamStatus(`PIP failed: ${e.message || "Restriction error"}`);
      }
    }
  };

  // Manual error recovery reload
  const handleSignalRefresh = () => {
    setStreamStatus("Calibrating Signal...");
    setReloadNonce((prev) => prev + 1);
  };

  // Mouse hover listener to fade controls
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      window.clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 4000);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      className="relative flex flex-col md:flex-row bg-[#080a18] border border-cyan-500/20 rounded-xl overflow-hidden shadow-[0_0_35px_rgba(6,182,212,0.15)] group transition-all duration-300"
    >
      {/* Video Content Block */}
      <div className="relative flex-1 bg-black flex items-center justify-center min-h-[300px] md:min-h-[480px]">
        <video
          id="streaming-hls-feed"
          ref={videoRef}
          onClick={togglePlay}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          referrerPolicy="no-referrer"
          className="w-full h-full object-contain cursor-pointer aspect-video"
          playsInline
        />

        {/* Space Observatory Glowing Radar Grid Overlay (Visual decoration) */}
        <div className="absolute inset-0 pointer-events-none border border-cyan-500/10 bg-[linear-gradient(rgba(18,24,38,0)_95%,rgba(6,182,212,0.06)_95%),linear-gradient(90deg,rgba(18,24,38,0)_95%,rgba(6,182,212,0.06)_95%)] bg-[size:40px_40px] opacity-40" />

        {/* Floating Observatory Compass Indicator */}
        <div className="absolute top-4 right-4 text-[10px] font-mono tracking-widest text-cyan-400/80 bg-slate-950/80 border border-cyan-500/30 px-2.5 py-1.5 rounded-md backdrop-blur-md flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          AZIMUTH: 324°
        </div>

        {/* Loader backdrop for buffering / connecting */}
        {streamStatus.includes("Connecting") && (
          <div className="absolute inset-0 bg-[#04050f]/90 flex flex-col items-center justify-center gap-4 z-20">
            <div className="relative">
              <div className="w-16 h-16 border-2 border-dashed border-cyan-400 rounded-full animate-spin" />
              <div className="absolute inset-2 w-12 h-12 border border-violet-500 rounded-full animate-ping opacity-60" />
            </div>
            <p className="text-cyan-400 font-mono tracking-widest text-xs uppercase">
              Synching Quantum Recorders...
            </p>
          </div>
        )}

        {/* Top Floating Channel Name Title Overlay */}
        <div className="absolute top-4 left-4 pointer-events-none bg-slate-950/70 border border-violet-500/20 px-3 py-1.5 rounded-lg backdrop-blur-md flex items-center gap-3">
          {channel.logo && (
            <img
              src={channel.logo}
              alt=""
              className="w-5 h-5 object-contain rounded-md"
              onError={(e) => {
                // Fallback image
                (e.target as HTMLImageElement).src =
                  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=60";
              }}
            />
          )}
          <div>
            <h4 className="text-xs text-white font-medium font-sans">{channel.name}</h4>
            <p className="text-[10px] text-violet-400 font-mono font-semibold">
              {channel.category.toUpperCase()}
            </p>
          </div>
        </div>

        {/* CUSTOM PLAYER HUD CONTROLS */}
        <div
          className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950/95 via-slate-950/70 to-transparent p-4 flex flex-col gap-3 transition-opacity duration-300 z-10 ${
            showControls ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="flex items-center justify-between gap-4">
            {/* Play/Pause & Telemetry Toggle */}
            <div className="flex items-center gap-3">
              <button
                id="hud-play-toggle"
                onClick={togglePlay}
                className="p-2.5 bg-cyan-400/10 hover:bg-cyan-400/30 text-cyan-400 border border-cyan-400/30 rounded-lg transition-colors cursor-pointer"
                title={isPlaying ? "Pause Probe" : "Initialize Feed"}
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>

              <button
                id="hud-telemetry-toggle"
                onClick={() => setShowTelemetry(!showTelemetry)}
                className={`p-2.5 border rounded-lg transition-all cursor-pointer ${
                  showTelemetry
                    ? "bg-violet-700/20 text-violet-300 border-violet-500/50 shadow-[0_0_12px_rgba(139,92,246,0.3)]"
                    : "bg-slate-950/50 text-slate-400 border-slate-800"
                }`}
                title="Toggle Telemetry Panel"
              >
                <Activity size={16} />
              </button>

              <button
                id="hud-refresh-recalibrate"
                onClick={handleSignalRefresh}
                className="p-2.5 bg-slate-950/50 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-slate-300 rounded-lg transition-colors cursor-pointer"
                title="Recalibrate HLS Receiver"
              >
                <RotateCw size={14} className="active:animate-spin" />
              </button>
            </div>

            {/* Volume & Audio HUD Overlay */}
            <div className="flex items-center gap-2 bg-slate-950/60 border border-slate-800 px-3 py-1.5 rounded-lg max-w-[150px] sm:max-w-xs">
              <button
                id="hud-audio-mute"
                onClick={toggleMute}
                className="text-slate-400 hover:text-cyan-400 transition-colors"
                title="Mute Feed"
              >
                {isMuted || volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
              </button>
              <input
                id="hud-slider-volume"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-16 sm:w-24 accent-cyan-400 h-1 bg-slate-800 rounded-lg cursor-pointer appearance-none"
              />
            </div>

            {/* Quality Selector, Picture-in-picture, Maximize */}
            <div className="flex items-center gap-2">
              {availableLevels.length > 0 && (
                <div className="relative">
                  <select
                    id="hud-dropdown-resolution"
                    value={streamLevel}
                    onChange={(e) => handleLevelChange(e.target.value)}
                    className="bg-slate-950 text-cyan-400 font-mono text-[10px] border border-cyan-500/30 rounded px-2 py-1.5 focus:outline-none cursor-pointer focus:border-cyan-400 select-none appearance-none"
                  >
                    {availableLevels.map((lvl) => (
                      <option key={lvl} value={lvl} className="bg-slate-950 text-slate-300">
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                id="hud-button-pip"
                onClick={togglePictureInPicture}
                className="p-2 bg-slate-950/50 hover:bg-slate-900 text-slate-400 hover:text-cyan-400 border border-slate-800 rounded-lg transition-colors"
                title="Picture-In-Picture Mode"
              >
                <Tv size={15} />
              </button>

              <button
                id="hud-button-fullscreen"
                onClick={toggleFullscreen}
                className="p-2 bg-slate-950/50 hover:bg-slate-900 text-slate-400 hover:text-cyan-400 border border-slate-800 rounded-lg transition-colors"
                title="Toggle Observatory Screens"
              >
                {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cyber observatory Stream Diagnostics Sidebar */}
      {showTelemetry && (
        <div className="w-full md:w-64 bg-[#0a0c1f] border-t md:border-t-0 md:border-l border-cyan-500/10 p-5 font-mono flex flex-col gap-4 text-xs select-none">
          <div className="flex items-center justify-between pb-2 border-b border-cyan-500/10">
            <h5 className="text-cyan-400 font-semibold tracking-wider flex items-center gap-1.5">
              <Workflow size={14} className="animate-pulse" /> TELEMETRY MODULE
            </h5>
            <span className="text-[9px] text-[#818cf8] border border-[#818cf8]/30 px-1.5 py-0.5 rounded">
              ONLINE
            </span>
          </div>

          <div className="space-y-3 font-mono">
            <div>
              <p className="text-slate-500 text-[10px]">RESOLVING SENSOR</p>
              <p className="text-white font-medium text-sm tracking-tight">{stats.resolution}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-slate-500 text-[10px]">FPS RENDER</p>
                <p className="text-cyan-300 font-medium">{stats.fps === 0 ? "Offline" : `${stats.fps} HZ`}</p>
              </div>
              <div>
                <p className="text-slate-500 text-[10px]">BUFFER SATELLITE</p>
                <p className="text-violet-300 font-medium">{stats.bufferLength} S</p>
              </div>
            </div>

            <div>
              <p className="text-slate-500 text-[10px]">BANDWIDTH FLOW RATE</p>
              <p className="text-emerald-400 font-medium">{stats.bandwidth}</p>
            </div>

            <div>
              <p className="text-slate-500 text-[10px]">SIGNAL LATENCY</p>
              <p className="text-amber-400 font-medium">{stats.latency === 0 ? "Calibrating" : `${stats.latency} MS`}</p>
            </div>

            <div className="pt-2 border-t border-cyan-500/10 text-[10px] space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span>Receiver Engine:</span>
                <span className="text-slate-300">HLS.JS Worker</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Transmitter:</span>
                <span className="text-slate-300 text-right truncate max-w-[120px]" title={channel.url}>
                  {channel.url.split("/")[2] || "IPTV-RELAY"}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-auto pt-4 border-t border-cyan-500/10 flex flex-col gap-2.5">
            <div className="flex items-center gap-1.5 text-slate-400 text-[10px]">
              <Zap size={11} className="text-amber-400 animate-bounce" />
              <span>DIAGNOSTIC STATUS</span>
            </div>
            <div className="bg-slate-950 p-2.5 rounded border border-slate-800 text-[10px] font-semibold text-cyan-400 uppercase tracking-widest leading-relaxed">
              {streamStatus}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
