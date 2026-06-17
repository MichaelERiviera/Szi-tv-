import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage, db } from "../firebase";
import { doc, updateDoc } from "firebase/firestore";
import { Channel } from "../types";

export const LOGO_TEMPLATES = {
  sports: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=150&auto=format&fit=crop&q=60",
  news: "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=150&auto=format&fit=crop&q=60",
  movies: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=150&auto=format&fit=crop&q=60",
  kids: "https://images.unsplash.com/photo-1515488042361-404e9250afef?w=150&auto=format&fit=crop&q=60",
  music: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150&auto=format&fit=crop&q=60",
  science: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=150&auto=format&fit=crop&q=60",
  space: "https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?w=150&auto=format&fit=crop&q=60",
  general: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=60"
};

/**
 * Searches and maps a channel name & category to pre-curated thematic high-quality fallback logos.
 */
export function getThemedFallbackLogo(name: string, category: string): { url: string; type: string } {
  const combined = `${name.toLowerCase()} ${category.toLowerCase()}`;
  if (
    combined.includes("sport") ||
    combined.includes("football") ||
    combined.includes("soccer") ||
    combined.includes("espn") ||
    combined.includes("cricket") ||
    combined.includes("liga") ||
    combined.includes("wwe") ||
    combined.includes("ufc") ||
    combined.includes("bein") ||
    combined.includes("atlet") ||
    combined.includes("chelsea") ||
    combined.includes("liverpool")
  ) {
    return { url: LOGO_TEMPLATES.sports, type: "Sports" };
  }
  if (
    combined.includes("news") ||
    combined.includes("bbc") ||
    combined.includes("cnn") ||
    combined.includes("jazeera") ||
    combined.includes("bloomberg") ||
    combined.includes("times") ||
    combined.includes("nbc") ||
    combined.includes("reuters") ||
    combined.includes("al-") ||
    combined.includes("france")
  ) {
    return { url: LOGO_TEMPLATES.news, type: "News" };
  }
  if (
    combined.includes("movie") ||
    combined.includes("cinema") ||
    combined.includes("hbo") ||
    combined.includes("action") ||
    combined.includes("film") ||
    combined.includes("box") ||
    combined.includes("thriller") ||
    combined.includes("premium") ||
    combined.includes("showtime") ||
    combined.includes("sintel")
  ) {
    return { url: LOGO_TEMPLATES.movies, type: "Movies" };
  }
  if (
    combined.includes("kid") ||
    combined.includes("cartoon") ||
    combined.includes("disney") ||
    combined.includes("nick") ||
    combined.includes("anime") ||
    combined.includes("child") ||
    combined.includes("animation") ||
    combined.includes("bunny")
  ) {
    return { url: LOGO_TEMPLATES.kids, type: "Kids" };
  }
  if (
    combined.includes("music") ||
    combined.includes("lofi") ||
    combined.includes("sound") ||
    combined.includes("audio") ||
    combined.includes("mtv") ||
    combined.includes("radio") ||
    combined.includes("beat") ||
    combined.includes("ambient")
  ) {
    return { url: LOGO_TEMPLATES.music, type: "Music" };
  }
  if (
    combined.includes("nasa") ||
    combined.includes("space") ||
    combined.includes("galaxy") ||
    combined.includes("cosmic") ||
    combined.includes("star") ||
    combined.includes("observatory") ||
    combined.includes("satellite") ||
    combined.includes("astronomy") ||
    combined.includes("nebula")
  ) {
    return { url: LOGO_TEMPLATES.space, type: "Space/Cosmic" };
  }
  if (
    combined.includes("science") ||
    combined.includes("tech") ||
    combined.includes("discovery") ||
    combined.includes("nature") ||
    combined.includes("earth") ||
    combined.includes("wild") ||
    combined.includes("geographic")
  ) {
    return { url: LOGO_TEMPLATES.science, type: "Science/Nature" };
  }
  return { url: LOGO_TEMPLATES.general, type: "General" };
}

/**
 * Resolves a potentially relative Logo path based on the M3U base playlist URL.
 */
export function resolveRelativeLogoUrl(logoPath: string, playlistUrl?: string): string {
  if (!logoPath) return "";
  if (logoPath.startsWith("http://") || logoPath.startsWith("https://") || logoPath.startsWith("data:")) {
    return logoPath;
  }
  if (playlistUrl && (playlistUrl.startsWith("http://") || playlistUrl.startsWith("https://"))) {
    try {
      const base = new URL(playlistUrl);
      const output = new URL(logoPath, base.href).toString();
      return output;
    } catch (e) {
      console.warn("[Relative Resolve Error] Invalid playlist url combo:", logoPath, playlistUrl);
    }
  }
  return logoPath;
}

/**
 * Tests whether a logo loads correctly in the browser without 404s, CORS failures, or timeouts.
 * Uses the proxy dynamically to guarantee bypass.
 */
export function checkImageOk(url: string, useProxy: boolean = true): Promise<boolean> {
  return new Promise((resolve) => {
    if (!url) {
      resolve(false);
      return;
    }

    const testUrl = (useProxy && !url.startsWith("data:"))
      ? `/api/proxy?url=${encodeURIComponent(url)}`
      : url;

    const img = new Image();
    
    // 5-second timeout guard
    const timer = setTimeout(() => {
      img.src = "";
      resolve(false);
    }, 5000);

    img.onload = () => {
      clearTimeout(timer);
      resolve(img.width > 0 && img.height > 0);
    };

    img.onerror = () => {
      clearTimeout(timer);
      resolve(false);
    };

    img.src = testUrl;
  });
}

/**
 * Loads an external image, performs canvas scaling, compresses to WebP,
 * and uploads to Firebase Storage under static namespace.
 */
export async function compressAndCacheLogo(channelId: string, logoUrl: string): Promise<string> {
  if (!logoUrl) {
    throw new Error("Logo URL is undefined or empty");
  }

  // Defeat CORS block using server proxy
  const proxyUrl = logoUrl.startsWith("data:")
    ? logoUrl
    : `/api/proxy?url=${encodeURIComponent(logoUrl)}`;

  // Load into image element
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.src = proxyUrl;

    const timeout = setTimeout(() => {
      i.src = "";
      reject(new Error("Timeout loading image for scaling"));
    }, 10000);

    i.onload = () => {
      clearTimeout(timeout);
      resolve(i);
    };
    i.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("Failed to load logo stream on canvas"));
    };
  });

  // Calculate scaled dimensions (bounded safe 120px bounding box for low network weight)
  const canvas = document.createElement("canvas");
  const maxBoundary = 120;
  let w = img.width;
  let h = img.height;

  if (w > maxBoundary || h > maxBoundary) {
    if (w > h) {
      h = Math.round((h * maxBoundary) / w);
      w = maxBoundary;
    } else {
      w = Math.round((w * maxBoundary) / h);
      h = maxBoundary;
    }
  }

  // Fallback safe minimums
  w = Math.max(w, 16);
  h = Math.max(h, 16);

  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not construct 2D render context");
  }

  // Draw scaled image onto canvas
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  // Compress to lightweight WebP binary Blob
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/webp", 0.80);
  });

  if (!blob) {
    throw new Error("Canvas extraction yielded empty blob");
  }

  // Upload optimized asset to Firebase Storage catalog
  const storageRef = ref(storage, `channel_logos/${channelId}.webp`);
  const snapshot = await uploadBytes(storageRef, blob, {
    contentType: "image/webp",
    customMetadata: {
      channelId,
      originalUrl: logoUrl,
      cachedAt: new Date().toISOString()
    }
  });

  // Acquire public Cloud CDN Download Link
  const cachedUrl = await getDownloadURL(snapshot.ref);
  return cachedUrl;
}

/**
 * Automated logo validation and processing pipeline for a single channel record.
 */
export async function optimizeAndStoreChannelLogo(channel: Channel): Promise<Partial<Channel>> {
  const patch: Partial<Channel> = {
    logoLastChecked: new Date().toISOString()
  };

  try {
    let logoToProcess = channel.logo || "";
    let logoSrc: Channel["logoSource"] = channel.logoSource || "m3u";

    // 1. Check if the channel is missing a logo or has a blank string
    if (!logoToProcess || logoToProcess.includes("photo-1618005182384-a83a8bd57fbe")) {
      // Missing logo -> Trigger Automatic Logo Recovery
      const recovered = getThemedFallbackLogo(channel.name, channel.category);
      logoToProcess = recovered.url;
      logoSrc = "recovered";
    }

    // 2. Validate current image URL
    const isWorking = await checkImageOk(logoToProcess, true);

    if (!isWorking) {
      // Broken logo detected -> Trigger Fallback recovery
      const recoveredFall = getThemedFallbackLogo(channel.name, channel.category);
      logoToProcess = recoveredFall.url;
      logoSrc = "fallback";
      
      // Re-verify fallback logo is working (Unsplash images should always be green)
      const fallbackWorking = await checkImageOk(logoToProcess, true);
      if (!fallbackWorking) {
        // Absolute fail safety
        logoToProcess = LOGO_TEMPLATES.general;
      }
    }

    patch.logo = logoToProcess;
    patch.logoSource = logoSrc;

    // 3. Perform image caching in Firebase Storage
    try {
      const cachedUrl = await compressAndCacheLogo(channel.id, logoToProcess);
      patch.cachedLogoUrl = cachedUrl;
      patch.logoStatus = "cached";
    } catch (cacheErr) {
      console.warn(`[Logo Caching Non-Blocking Alert] Failed caching for channel ${channel.id}:`, cacheErr);
      // Fallback: Logo is functional but we serve original proxied/un-cached link
      patch.logoStatus = isWorking ? "active" : "broken";
    }

    // Update firestore document
    const chRef = doc(db, "channels", channel.id);
    await updateDoc(chRef, patch);

  } catch (err) {
    console.error(`[Logo Optimization Pipeline Failed] Channel: ${channel.id}:`, err);
    patch.logoStatus = "broken";
    
    try {
      const chRef = doc(db, "channels", channel.id);
      await updateDoc(chRef, patch);
    } catch (e) {
      // Ignored
    }
  }

  return patch;
}
