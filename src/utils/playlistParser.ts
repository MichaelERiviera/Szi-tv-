import { Channel } from "../types";
import { getThemedFallbackLogo, resolveRelativeLogoUrl } from "./logoResolver";
import { parseM3U } from "./m3uParser";

export interface ParsedChannel {
  name: string;
  url: string;
  category: string;
  logo: string;
  country: string;
  status: "active" | "broken";
  logoSource?: Channel["logoSource"];
  logoStatus?: Channel["logoStatus"];
}

/**
 * Identify, deconstruct, and assemble streaming playlists (.txt, .m3u, .m3u8, JSON)
 */
export function parsePlaylist(
  text: string,
  fileName: string,
  defaultCategory = "Imported"
): ParsedChannel[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // 1. JSON List detection
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      const channels: ParsedChannel[] = [];

      for (const item of items) {
        if (!item) continue;
        
        // Match common variations of name/url keys
        const name = (
          item.name ||
          item.ChannelName ||
          item.channelName ||
          item.title ||
          item.display_name ||
          item.label ||
          "Imported Channel"
        ).toString().trim();

        const url = (
          item.url ||
          item.ChannelURL ||
          item.streamUrl ||
          item.link ||
          item.uri ||
          item.source ||
          ""
        ).toString().trim();

        if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
          continue;
        }

        const category = (item.category || item.group || item.groupTitle || item.genre || defaultCategory).toString().trim();
        let logo = (item.logo || item.logoUrl || item.icon || item.tvgLogo || item.image || "").toString().trim();
        const country = (item.country || item.locale || item.lang || "Unknown").toString().trim();
        const status = item.status === "broken" ? "broken" : "active";

        let logoSource: Channel["logoSource"] = "m3u";
        let logoStatus: Channel["logoStatus"] = "active";

        if (!logo) {
          const recovered = getThemedFallbackLogo(name, category);
          logo = recovered.url;
          logoSource = "recovered";
          logoStatus = "missing";
        }

        channels.push({
          name,
          url,
          category,
          logo,
          country,
          status,
          logoSource,
          logoStatus,
        });
      }
      return channels;
    } catch (e) {
      // Fallback if JSON parse failed
      console.warn("JSON Playlist parsing failed, falling back to TXT/M3U parse:", e);
    }
  }

  // 2. M3U / M3U8 Playlist detection
  if (trimmed.toUpperCase().includes("#EXTM3U") || trimmed.toUpperCase().includes("#EXTINF")) {
    try {
      // Reuse our robust m3uParser
      const m3uChannels = parseM3U(text);
      return m3uChannels.map((c) => ({
        name: c.name,
        url: c.url,
        category: c.category || defaultCategory,
        logo: c.logo || "",
        country: "Unknown",
        status: c.status || "active",
        logoSource: c.logoSource,
        logoStatus: c.logoStatus,
      }));
    } catch (e) {
      console.warn("M3U Playlist parsing failed, falling back to TXT parse:", e);
    }
  }

  // 3. TXT format parser (Channel Name|URL or Channel Name,URL)
  const lines = text.split(/\r?\n/);
  const channels: ParsedChannel[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Skip comment lines
    if (line.startsWith("#") || line.startsWith("//") || line.startsWith(";")) {
      continue;
    }

    let name = "";
    let url = "";

    if (line.includes("|")) {
      const parts = line.split("|");
      name = parts[0].trim();
      url = parts.slice(1).join("|").trim();
    } else if (line.includes(",")) {
      // Split on the first comma as a fallback if it looks like a URL after it
      const firstComma = line.indexOf(",");
      name = line.substring(0, firstComma).trim();
      url = line.substring(firstComma + 1).trim();
    } else {
      // Look for a URL inside the line
      const urlIndex = line.search(/https?:\/\//i);
      if (urlIndex !== -1) {
        name = line.substring(0, urlIndex).replace(/[,|]/g, "").trim();
        url = line.substring(urlIndex).trim();
      }
    }

    // Clean up carriage returns/spaces
    name = name || `Line ${i + 1}`;
    url = url.trim();

    // Verify it is a valid scheme
    if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
      continue;
    }

    let logo = "";
    let logoSource: Channel["logoSource"] = "manual";
    let logoStatus: Channel["logoStatus"] = "missing";

    const recovered = getThemedFallbackLogo(name, defaultCategory);
    logo = recovered.url;
    logoSource = "recovered";
    logoStatus = "missing";

    channels.push({
      name,
      url,
      category: defaultCategory,
      logo,
      country: "Unknown",
      status: "active",
      logoSource,
      logoStatus,
    });
  }

  return channels;
}
