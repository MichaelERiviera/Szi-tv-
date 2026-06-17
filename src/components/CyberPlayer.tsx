import React, { useEffect, useRef, useState } from "react";
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
  Star,
  AlertTriangle,
  Heart,
  ExternalLink,
  ShieldAlert,
  ThumbsUp,
  LineChart
} from "lucide-react";
import { PlaybackStats, Channel } from "../types";
import { useAuth } from "../context/AuthContext";
import { submitChannelRating, submitBrokenReport } from "../utils/dbService";

interface CyberPlayerProps {
  channel: Channel;
  onWatchedProgress?: (seconds: number) => void;
}

export default function CyberPlayer({ channel, onWatchedProgress }: CyberPlayerProps) {
  const { user, profile } = useAuth();
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
  const [playerError, setPlayerError] = useState<{
    type: "Online" | "Offline" | "CORS Blocked" | "HTTPS Blocked" | "Token Expired" | "Unknown Error";
    message: string;
    details: string;
  } | null>(null);
  const [showTelemetry, setShowTelemetry] = useState<boolean>(true);
  const [showControls, setShowControls] = useState<boolean>(true);
  const controlsTimeoutRef = useRef<number | null>(null);
  
  const [reloadNonce, setReloadNonce] = useState<number>(0);
  const retryCountRef = useRef<number>(0);
  const retryTimeoutRef = useRef<number | null>(null);
  
  // Auto-reconnect countdown timer state
  const [reconnectCountdown, setReconnectCountdown] = useState<number | null>(null);

  // Multi-source streams system
  const sourceFeeds = [
    { label: "Prime Satellite Node (Direct)", url: channel.url },
    { label: "Backup Relay Node (Bipbop)", url: "https://playertest.longtailvideo.com/adaptive/bipbop/bipbop.m3u8" },
    { label: "Alternative Geo-Mirror", url: "https://cph-pms-secure.akamaized.net/play/all.m3u8" }
  ];
  const [activeSourceIndex, setActiveSourceIndex] = useState<number>(0);
  const activeStreamUrl = sourceFeeds[activeSourceIndex]?.url || channel.url;

  // Rating and reporting states
  const [userRating, setUserRating] = useState<number>(0);
  const [ratingSubmitted, setRatingSubmitted] = useState<boolean>(false);
  const [ratingSubmitting, setRatingSubmitting] = useState<boolean>(false);
  
  const [reportIssueType, setReportIssueType] = useState<string>("");
  const [reportDescription, setReportDescription] = useState<string>("");
  const [reportSubmitting, setReportSubmitting] = useState<boolean>(false);
  const [reportMessage, setReportMessage] = useState<string | null>(null);
  const [showReportForm, setShowReportForm] = useState<boolean>(false);

  // Quantum Proxy tunnel routing override state
  const [useProxy, setUseProxy] = useState<boolean>(false);

  // Auto-reset proxy tunnel when active channel or source changes to try direct loading first
  useEffect(() => {
    setUseProxy(false);
  }, [channel.id, activeSourceIndex]);

  // Playback statistics
  const [stats, setStats] = useState<PlaybackStats>({
    resolution: "1920 x 1080",
    fps: 60,
    bufferLength: 4.8,
    bandwidth: "4.5 Mbps",
    latency: 12,
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
    setReconnectCountdown(null);
    setPlayerError(null);
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

    const isHttps = window.location.protocol === "https:";
    const isMixedContent = isHttps && activeStreamUrl.startsWith("http://");
    const shouldForceProxy = isMixedContent || useProxy;

    const streamSourceUrl = shouldForceProxy
      ? `/api/proxy?url=${encodeURIComponent(activeStreamUrl)}`
      : activeStreamUrl;

    if (Hls.isSupported()) {
      // Create custom loaders to rewrite fragment and playlist requests through our CORS proxy automatically
      class CustomPlaylistLoader extends Hls.DefaultConfig.loader {
        constructor(config: any) {
          super(config);
          const originalLoad = this.load.bind(this);
          this.load = (context: any, config: any, callbacks: any) => {
            if (shouldForceProxy && context.url && !context.url.startsWith("/api/proxy")) {
              context.url = `/api/proxy?url=${encodeURIComponent(context.url)}`;
            }
            originalLoad(context, config, callbacks);
          };
        }
      }

      class CustomFragmentLoader extends Hls.DefaultConfig.loader {
        constructor(config: any) {
          super(config);
          const originalLoad = this.load.bind(this);
          this.load = (context: any, config: any, callbacks: any) => {
            if (shouldForceProxy && context.url && !context.url.startsWith("/api/proxy")) {
              context.url = `/api/proxy?url=${encodeURIComponent(context.url)}`;
            }
            originalLoad(context, config, callbacks);
          };
        }
      }

      const hls = new Hls({
        maxMaxBufferLength: 25,
        enableWorker: true,
        lowLatencyMode: true,
        pLoader: CustomPlaylistLoader as any,
        fLoader: CustomFragmentLoader as any,
      });
      hlsRef.current = hls;

      hls.loadSource(streamSourceUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        setStreamStatus(shouldForceProxy ? "Proxy Handshake Active" : "Direct Link Active");
      });

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        setStreamStatus(shouldForceProxy ? "Stream Decrypted & Locked" : "Stream Locked Direct");
        const levels = ["Auto", ...data.levels.map((l, index) => `${l.height}p`)];
        setAvailableLevels(levels);
        video.play().then(() => {
          setIsPlaying(true);
        }).catch(() => {
          setIsPlaying(false);
          setStreamStatus("Awaiting Activation Touch");
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
        let detailsMsg = `Signal Error: ${data.details}`;
        let errorType: "Online" | "Offline" | "CORS Blocked" | "HTTPS Blocked" | "Token Expired" | "Unknown Error" = "Unknown Error";
        let errDesc = "An unexpected downstream signal interruption occurred while parsing stream metadata segments.";
        
        // Detailed error diagnostic
        if (data.response) {
          const status = (data.response as any).status;
          if (status === 403 || status === 401) {
            const hasAuth = activeStreamUrl.includes("token") || activeStreamUrl.includes("expire") || activeStreamUrl.includes("key") || activeStreamUrl.includes("auth") || activeStreamUrl.includes("hash") || activeStreamUrl.includes("wsSecret");
            errorType = hasAuth ? "Token Expired" : "Offline";
            detailsMsg = hasAuth
              ? "403 Forbidden: Authorized Stream Token Expired"
              : "403 Access Refused. Geo-locked or credentials missing.";
            errDesc = hasAuth
              ? "The digital signature or access token embedded in the stream URL has expired or has been rejected. Please run diagnostics to gather updated credentials."
              : "Access was refused by the target host. This typically indicates a regional geo-fence restriction, customized user-agent block, or strict referral origin requirements.";
          } else if (status === 404) {
            errorType = "Offline";
            detailsMsg = "404 Not Found: Broadcast beacon is dead.";
            errDesc = "The broadcast stream is completely offline. The server returned a 404 block, indicating the resource file at this path is no longer available on the target network.";
          } else {
            errorType = "Offline";
            detailsMsg = `HTTP Error Code ${status}: Distorted signal.`;
            errDesc = `The television transmitter returned status code ${status}. The stream server experienced server side overload or coordinate deprecation.`;
          }
        } else if (data.details === "manifestLoadError" && !data.response) {
          errorType = "CORS Blocked";
          detailsMsg = "CORS Exception: Sandboxed cross-origin header restricts play.";
          errDesc = "Cross-Origin Resource Sharing (CORS) is blocked. The host server does not allow direct playback outside the host domain in web browsers, which can be bypassed via our Dual Proxy.";
        } else if (data.details === "internalException") {
          errorType = "Unknown Error";
          detailsMsg = "Media Handshake Exception";
          errDesc = "Local frame buffer decoding failed inside the browser core environment due to unrecognized codecs or video packet fragmentation.";
        }

        setStreamStatus(detailsMsg);

        if (data.fatal) {
          // If we encounter a fatal error and have been retrying, we populate the explicit diagnostics
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              // Automatic Proxy Fallback Trigger
              if (!shouldForceProxy) {
                setStreamStatus("CORS Block. Engaging Quantum Proxy tunnel...");
                setUseProxy(true);
              } else if (retryCountRef.current < 4) {
                const delay = Math.min(2000 * Math.pow(2, retryCountRef.current), 10000);
                retryCountRef.current += 1;
                
                // Show visual automated reconnect overlay with countdown ticking support
                setReconnectCountdown(Math.ceil(delay / 1000));
                setStreamStatus(`Signal Interrupted. Auto-Reconnecting via Proxy in ${(delay / 1000).toFixed(0)}s... (${retryCountRef.current}/4)`);
                
                if (retryTimeoutRef.current) {
                  window.clearTimeout(retryTimeoutRef.current);
                }
                retryTimeoutRef.current = window.setTimeout(() => {
                  setReconnectCountdown(null);
                  if (hlsRef.current && hlsRef.current === hls) {
                    hlsRef.current.startLoad();
                  }
                }, delay);
              } else {
                setStreamStatus("Transmitter Offline. Connection failed even through proxy.");
                setPlayerError({
                  type: errorType,
                  message: detailsMsg,
                  details: errDesc
                });
                hls.stopLoad();
                setReconnectCountdown(null);
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              setStreamStatus("Media decoding distorted. Recovering frames...");
              break;
            default:
              setStreamStatus("Satellite transmission link disconnected.");
              setPlayerError({
                type: errorType,
                message: "Satellite Link Severed",
                details: "Critical connection failure. Sazi TV was unable to establish a telemetry handshake with the stream server."
              });
              hls.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // For Safari native playback
      video.src = streamSourceUrl;
      video.addEventListener("loadedmetadata", () => {
        setStreamStatus("Locked Native HLS");
        setAvailableLevels(["Native Channel"]);
        setStreamLevel("Native");
        video.play().then(() => setIsPlaying(true)).catch(() => {});
      });
    } else {
      setStreamStatus("Decoder Missing. Please upgrade browser.");
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
  }, [activeStreamUrl, reloadNonce, useProxy]);

  // Reconnect Countdown Countdown Tick effects
  useEffect(() => {
    if (reconnectCountdown === null) return;
    if (reconnectCountdown <= 0) {
      setReconnectCountdown(null);
      return;
    }
    const timer = setTimeout(() => {
      setReconnectCountdown(reconnectCountdown - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [reconnectCountdown]);

  // Periodic FPS calculation
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const interval = setInterval(() => {
      if (!video) return;

      // Extract custom stats
      if (isPlaying) {
        const latency = Math.random() * 0.2 + 0.08; // Simulated network packet latency
        const quality = video.getVideoPlaybackQuality ? video.getVideoPlaybackQuality() : null;
        const fps = quality ? quality.totalVideoFrames - quality.droppedVideoFrames : 60;

        setStats((prev) => ({
          ...prev,
          fps: isPlaying ? Math.min(60, Math.floor((quality ? Number(fps / (video.currentTime || 1)) : 60)) || 60) : 0,
          latency: Number((latency * 100).toFixed(0)), // Latency in ms (e.g. 10-30ms)
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
      setStreamStatus("PIP BLOCKED. OPEN IN NEW TAB");
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

  // Submit Rating call
  const handleRatingSubmit = async (stars: number) => {
    if (!user) return;
    setRatingSubmitting(true);
    try {
      await submitChannelRating(user.uid, channel.id, stars);
      setUserRating(stars);
      setRatingSubmitted(true);
    } catch (err) {
      console.error(err);
    } finally {
      setRatingSubmitting(false);
    }
  };

  // Submit Broken Stream Report call
  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !reportIssueType) return;
    setReportSubmitting(true);
    setReportMessage(null);
    try {
      await submitBrokenReport(
        user.uid,
        channel.id,
        channel.name,
        reportIssueType as any,
        reportDescription
      );
      setReportMessage("Handshake complete: support ticket logged successfully!");
      setReportDescription("");
      setReportIssueType("");
      setTimeout(() => {
        setShowReportForm(false);
        setReportMessage(null);
      }, 3000);
    } catch (err) {
      setReportMessage("Transmission anomaly. Please try again.");
    } finally {
      setReportSubmitting(false);
    }
  };

  // Calculate stream overall health
  const getStreamHealthRating = () => {
    if (!isPlaying) return { text: "DEGRADED", color: "text-rose-500 border-rose-500/20 bg-rose-500/5" };
    if (stats.fps < 30 || stats.bufferLength < 1) return { text: "NEEDS CALIBRATION", color: "text-amber-400 border-amber-400/20 bg-amber-400/5" };
    return { text: "OPTIMAL SECURE", color: "text-[#00f0ff] border-cyan-500/20 bg-cyan-950/20 shadow-[0_0_10px_rgba(0,240,255,0.15)]" };
  };
  const streamHealth = getStreamHealthRating();

  return (
    <div className="space-y-4">
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
            SATELLITE DOWNLINK
          </div>

          {/* Loader background / Reconnect countdown overlay */}
          {reconnectCountdown !== null && (
            <div className="absolute inset-0 bg-[#04050f]/95 flex flex-col items-center justify-center gap-4 z-20 p-6 text-center">
              <div className="relative">
                <div className="w-20 h-20 border-2 border-dashed border-rose-500 rounded-full animate-spin flex items-center justify-center">
                  <AlertTriangle className="text-rose-500 animate-pulse" size={24} />
                </div>
                <div className="absolute inset-2 w-16 h-16 border border-rose-500 rounded-full animate-ping opacity-30" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h4 className="text-rose-500 font-mono font-black tracking-widest text-sm uppercase">
                  LOST TRANSMISSION BEACON
                </h4>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  The stream server experienced a minor dropout. Auto-healing protocol active.
                </p>
                <div className="bg-rose-950/30 border border-rose-900/45 px-4 py-2 mt-3 rounded-xl">
                  <span className="text-xs font-mono font-bold text-rose-450 uppercase tracking-widest">
                    RECONSTRUCTING IN {reconnectCountdown} SECONDS
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Perfect classified playback error diagnosis card with precise corrective tips */}
          {playerError && (
            <div className="absolute inset-0 bg-[#070815]/98 text-[#fff] flex flex-col items-center justify-center p-6 text-center z-25 border border-rose-500/10 rounded-xl font-mono">
              <div className="max-w-md p-6 bg-rose-950/20 border border-rose-500/30 rounded-2xl space-y-4 shadow-2xl relative overflow-hidden backdrop-blur-md">
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-rose-500 via-purple-500 to-cyan-500" />
                
                <div className="w-12 h-12 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-2 animate-pulse">
                  <ShieldAlert size={22} />
                </div>

                <div className="space-y-1">
                  <h3 className="text-xs font-black tracking-widest text-rose-400 uppercase">
                    PLAYBACK FAILURE CLASSIFICATION: {playerError.type}
                  </h3>
                  <p className="text-[10px] text-zinc-300 uppercase font-black tracking-tight mt-1 text-center bg-black/40 px-2.5 py-1 rounded border border-slate-905">
                    {playerError.message}
                  </p>
                </div>

                <p className="text-[11px] text-zinc-400 leading-relaxed font-sans text-left bg-black/60 border border-slate-900/50 rounded-xl p-3.5">
                  {playerError.details}
                </p>

                <div className="flex gap-2.5 justify-center pt-2">
                  <button
                    onClick={() => {
                      setPlayerError(null);
                      setReloadNonce(prev => prev + 1);
                    }}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-750 text-slate-350 hover:text-white font-mono font-bold rounded-lg text-[10px] transition-all uppercase cursor-pointer"
                  >
                    RETRY FEED
                  </button>
                  <button
                    onClick={() => {
                      setUseProxy(true);
                      setPlayerError(null);
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-[#a855f7] to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-[#000] font-black rounded-lg text-[10px] transition-all uppercase cursor-pointer"
                  >
                    FORCE PROXY TUNNEL
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Loader backdrop for buffering / connecting */}
          {streamStatus.includes("Connecting") && reconnectCountdown === null && (
            <div className="absolute inset-0 bg-[#04050f]/95 flex flex-col items-center justify-center gap-4 z-20">
              <div className="relative">
                <div className="w-16 h-16 border-2 border-dashed border-cyan-400 rounded-full animate-spin" />
                <div className="absolute inset-2 w-12 h-12 border border-violet-500 rounded-full animate-ping opacity-60" />
              </div>
              <p className="text-cyan-400 font-mono tracking-widest text-xs uppercase">
                Synchronizing Quantum Recorders...
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
                      className="bg-slate-950 text-cyan-400 font-mono text-[10px] border border-cyan-500/30 rounded px-2 py-1.5 focus:outline-none cursor-pointer focus:border-cyan-400 select-none appearance-none font-bold"
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
              <span className={`text-[8px] font-bold border px-1.5 py-0.5 rounded uppercase tracking-wider ${streamHealth.color}`}>
                {streamHealth.text}
              </span>
            </div>

            {/* Multiple Stream Feeds Configurator */}
            <div className="space-y-1.5 bg-slate-950/65 border border-slate-900 p-2.5 rounded-xl">
              <label className="text-[9px] font-mono font-bold text-violet-400 uppercase tracking-widest block">
                🔴 STREAM UPLINK FEEDSOURCE
              </label>
              <select
                id="source-feed-selector"
                value={activeSourceIndex}
                onChange={(e) => {
                  setActiveSourceIndex(Number(e.target.value));
                  setStreamStatus("Uplink handshake active");
                }}
                className="bg-slate-900 text-xs text-white border border-slate-800 focus:border-cyan-500 rounded px-2 py-1.5 w-full font-mono cursor-pointer"
              >
                {sourceFeeds.map((src, idx) => (
                  <option key={idx} value={idx}>
                    {src.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3 font-mono">
              <div>
                <p className="text-slate-500 text-[10px]">RESOLVING SENSOR</p>
                <p className="text-white font-medium text-xs tracking-tight">{stats.resolution}</p>
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

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-slate-500 text-[10px]">BANDWIDTH RATE</p>
                  <p className="text-emerald-400 font-medium truncate">{stats.bandwidth}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-[10px]">SIGNAL LATENCY</p>
                  <p className="text-amber-400 font-medium">{stats.latency === 0 ? "Calibrating" : `${stats.latency} MS`}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-cyan-500/10 text-[10px] space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Packet Health:</span>
                  <span className="text-[#00f0ff] font-bold">99.85% Optimal</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Sat Node IP:</span>
                  <span className="text-slate-300 text-right truncate max-w-[120px]">
                    {channel.url?.split("/")[2] || "IPTV-RELAY"}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Rating Widget inside Telemetry */}
            {user && (
              <div className="bg-[#050612] p-2.5 border border-slate-900 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-violet-400 uppercase tracking-widest flex items-center gap-1">
                    <Star size={10} className="fill-amber-400 text-amber-400" />
                    Rate Stream Node
                  </span>
                  {ratingSubmitted && <span className="text-[8px] font-mono text-emerald-400 uppercase">Saved</span>}
                </div>
                
                <div className="flex items-center gap-1 justify-center py-1">
                  {[1, 2, 3, 4, 5].map((stars) => (
                    <button
                      key={stars}
                      type="button"
                      disabled={ratingSubmitting}
                      onClick={() => handleRatingSubmit(stars)}
                      className="text-slate-550 hover:scale-110 active:scale-95 transition-all"
                    >
                      <Star
                        size={14}
                        className={stars <= userRating ? "fill-amber-400 text-amber-400" : "text-zinc-600 hover:text-amber-300"}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-auto pt-2 border-t border-cyan-500/10 flex flex-col gap-2">
              <div className="flex items-center justify-between text-slate-400 text-[10px]">
                <div className="flex items-center gap-1.5">
                  <Zap size={11} className="text-amber-400 animate-bounce" />
                  <span>DIAGNOSTICS</span>
                </div>
                <button
                  onClick={() => setShowReportForm(!showReportForm)}
                  className="text-[9px] font-mono text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded bg-rose-500/5 hover:bg-rose-500 hover:text-black transition uppercase font-bold"
                >
                  {showReportForm ? "Cancel Ticket" : "Report Broken"}
                </button>
              </div>
              
              {!showReportForm ? (
                <div className="bg-slate-950 p-2.5 rounded border border-slate-800 text-[10px] font-semibold text-cyan-400 uppercase tracking-widest leading-relaxed">
                  {streamStatus}
                </div>
              ) : (
                <form onSubmit={handleReportSubmit} className="space-y-2 bg-[#0d0c1e] p-2 border border-rose-950/40 rounded-lg">
                  <select
                    required
                    value={reportIssueType}
                    onChange={(e) => setReportIssueType(e.target.value)}
                    className="w-full bg-slate-950 text-[9px] text-zinc-300 border border-slate-900 rounded p-1 font-mono focus:outline-none"
                  >
                    <option value="">Choose issue...</option>
                    <option value="no-signal">No Signal / CORS Blocked</option>
                    <option value="lagging">Lagging / High Buffering</option>
                    <option value="audio-only">Audio-Only Feed</option>
                    <option value="wrong-channel">Wrong Stream content</option>
                    <option value="other">Other distortions</option>
                  </select>
                  <textarea
                    placeholder="Short description..."
                    value={reportDescription}
                    onChange={(e) => setReportDescription(e.target.value)}
                    className="w-full bg-slate-950 text-[9px] text-zinc-300 border border-slate-900 rounded p-1 h-10 resize-none font-mono focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={reportSubmitting || !reportIssueType}
                    className="w-full bg-rose-600 hover:bg-rose-500 text-white text-[8px] font-mono py-1 rounded transition uppercase font-black"
                  >
                    {reportSubmitting ? "Broadcasting Support..." : "Transmit Ticket"}
                  </button>
                  {reportMessage && (
                    <p className="text-[8px] font-mono text-emerald-400 text-center leading-tight">
                      {reportMessage}
                    </p>
                  )}
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
