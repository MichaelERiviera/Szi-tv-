import { Channel } from "../types";

export function parseM3U(content: string): Channel[] {
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

        channels.push({
          id,
          name: currentInfo.name,
          url: line,
          logo: currentInfo.logo || `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=60`,
          category: currentInfo.category,
          addedAt: new Date(),
          views: 0,
          status: "active",
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
    logo: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=150&auto=format&fit=crop&q=60",
    category: "Space Observatory",
    addedAt: new Date(),
    views: 3120,
    status: "active"
  },
  {
    id: "sintel-movie",
    name: "Sazi Cinematic Test Feed",
    url: "https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8",
    logo: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=150&auto=format&fit=crop&q=60",
    category: "Ambient Audio",
    addedAt: new Date(),
    views: 1840,
    status: "active"
  },
  {
    id: "big-buck-bunny",
    name: "Sazi Kids Animation Feed",
    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    logo: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=150&auto=format&fit=crop&q=60",
    category: "Ambient Audio",
    addedAt: new Date(),
    views: 2950,
    status: "active"
  },
  {
    id: "nasa-tv-uhd",
    name: "NASA TV UHD",
    url: "https://ntv-respring.akamaized.net/hls/live/2019040/NASA-NTV1-HLS/master.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/NASA_logo.svg/1200px-NASA_logo.svg.png",
    category: "Space Observatory",
    addedAt: new Date(),
    views: 1240,
    status: "active"
  },
  {
    id: "france24-en",
    name: "France 24 English",
    url: "https://static.france24.com/live/F24_EN_LO_HLS/live_web.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/2/23/France_24_logo.svg",
    category: "Global News",
    addedAt: new Date(),
    views: 450,
    status: "active"
  },
  {
    id: "lofi-stream",
    name: "Lofi Space Observatory Ambient Beat",
    url: "https://bitdash-a.akamaihd.net/content/MI201109210084_1/m3u8s/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8", // High quality HLS test
    logo: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=150&auto=format&fit=crop&q=60",
    category: "Ambient Audio",
    addedAt: new Date(),
    views: 1450,
    status: "active"
  }
];
