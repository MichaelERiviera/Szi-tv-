import { Channel } from "../types";
import { getThemedFallbackLogo, resolveRelativeLogoUrl } from "./logoResolver";

export function parseM3U(content: string, playlistUrl?: string): Channel[] {
  const lines = content.split(/\r?\n/);
  const channels: Channel[] = [];
  let currentInfo: { name: string; logo?: string; category: string } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith("#EXTINF:")) {
      // tvg-logo or logo extract
      const logoMatch = line.match(/tvg-logo="([^"]+)"/) || line.match(/logo="([^"]+)"/);
      const logo = logoMatch ? logoMatch[1] : undefined;

      // group-title or category extract
      const groupMatch = line.match(/group-title="([^"]+)"/) || line.match(/category="([^"]+)"/);
      const category = groupMatch ? groupMatch[1] : "General";

      // channel name search after last comma
      const commaIndex = line.lastIndexOf(",");
      let name = "Unknown Channel";
      if (commaIndex !== -1) {
        name = line.substring(commaIndex + 1).trim();
      } else {
        const tvgNameMatch = line.match(/tvg-name="([^"]+)"/);
        name = tvgNameMatch ? tvgNameMatch[1] : `Channel ${channels.length + 1}`;
      }

      currentInfo = { name, logo, category };
    } else if (line.startsWith("#")) {
      // Ignored tags
    } else {
      if (currentInfo) {
        // Safe string-safe ID generator
        const rawId = line.split("?")[0].split("/").pop() || "channel";
        const cleanedPart = rawId.replace(/[^a-zA-Z0-9]/g, "").substring(0, 16);
        const salt = Math.random().toString(36).substring(2, 6);
        const id = `${cleanedPart}-${salt}` || `ch-${channels.length + 1}`;

        let detectedLogo = currentInfo.logo ? currentInfo.logo.trim() : "";
        let logoSource: Channel["logoSource"] = "m3u";
        let logoStatus: Channel["logoStatus"] = "active";

        if (detectedLogo) {
          detectedLogo = resolveRelativeLogoUrl(detectedLogo, playlistUrl);
        } else {
          // Automatic recovery on load if missing in M3U
          const recovered = getThemedFallbackLogo(currentInfo.name, currentInfo.category);
          detectedLogo = recovered.url;
          logoSource = "recovered";
          logoStatus = "missing";
        }

        channels.push({
          id,
          name: currentInfo.name,
          url: line,
          logo: detectedLogo,
          category: currentInfo.category,
          addedAt: new Date(),
          views: 0,
          status: "active",
          logoStatus,
          logoSource,
          logoLastChecked: new Date().toISOString(),
        });
        currentInfo = null;
      }
    }
  }

  return channels;
}

// Premium seed channels (Open-source / Free To Air HLS streams)
export const DEFAULT_CHANNELS: Channel[] = [
  {
    id: "tears-of-steel",
    name: "Sazi Sci-Fi Cinema Feed",
    url: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.m3u8",
    logo: "https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?w=150&auto=format&fit=crop&q=60",
    category: "Space Observatory",
    addedAt: new Date(),
    views: 3120,
    status: "active",
    logoStatus: "active",
    logoSource: "m3u",
    logoLastChecked: new Date().toISOString(),
  },
  {
    id: "sintel-movie",
    name: "Sazi Cinematic Test Feed",
    url: "https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8",
    logo: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=150&auto=format&fit=crop&q=60",
    category: "Ambient Audio",
    addedAt: new Date(),
    views: 1840,
    status: "active",
    logoStatus: "active",
    logoSource: "m3u",
    logoLastChecked: new Date().toISOString(),
  },
  {
    id: "big-buck-bunny",
    name: "Sazi Kids Animation Feed",
    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    logo: "https://images.unsplash.com/photo-1515488042361-404e9250afef?w=150&auto=format&fit=crop&q=60",
    category: "Ambient Audio",
    addedAt: new Date(),
    views: 2950,
    status: "active",
    logoStatus: "active",
    logoSource: "m3u",
    logoLastChecked: new Date().toISOString(),
  },
  {
    id: "nasa-tv-uhd",
    name: "NASA TV UHD",
    url: "https://ntv-respring.akamaized.net/hls/live/2019040/NASA-NTV1-HLS/master.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/NASA_logo.svg/1200px-NASA_logo.svg.png",
    category: "Space Observatory",
    addedAt: new Date(),
    views: 1240,
    status: "active",
    logoStatus: "active",
    logoSource: "m3u",
    logoLastChecked: new Date().toISOString(),
  },
  {
    id: "france24-en",
    name: "France 24 English",
    url: "https://static.france24.com/live/F24_EN_LO_HLS/live_web.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/2/23/France_24_logo.svg",
    category: "Global News",
    addedAt: new Date(),
    views: 450,
    status: "active",
    logoStatus: "active",
    logoSource: "m3u",
    logoLastChecked: new Date().toISOString(),
  },
  {
    id: "lofi-stream",
    name: "Lofi Space Observatory Ambient Beat",
    url: "https://bitdash-a.akamaihd.net/content/MI201109210084_1/m3u8s/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8",
    logo: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150&auto=format&fit=crop&q=60",
    category: "Ambient Audio",
    addedAt: new Date(),
    views: 1450,
    status: "active",
    logoStatus: "active",
    logoSource: "m3u",
    logoLastChecked: new Date().toISOString(),
  },
];
