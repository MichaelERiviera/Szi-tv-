export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  createdAt: any; // Firestore Timestamp
  role: "user" | "admin";
  avatarId?: string; // Selected cyberpunk pilot icon ID
}

export interface Channel {
  id: string;
  name: string;
  url: string;
  logo?: string;
  category: string;
  addedAt: any; // Firestore Timestamp
  views?: number;
  status?: "active" | "broken";
  avgRating?: number;
  ratingCount?: number;
  logoStatus?: "missing" | "active" | "broken" | "cached";
  logoSource?: "m3u" | "recovered" | "fallback" | "manual";
  logoLastChecked?: string;
  cachedLogoUrl?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
}

export interface Favorite {
  id: string;
  userId: string;
  channelId: string;
  addedAt: any; // Firestore Timestamp
}

export interface WatchHistory {
  id: string;
  userId: string;
  channelId: string;
  watchedAt: any; // Firestore Timestamp
  progress?: number; // percentage completed e.g. 0 to 100
  duration?: number; // total seconds watched
  completed?: boolean;
}

export interface ChannelRating {
  id: string;
  userId: string;
  channelId: string;
  rating: number; // 1 to 5
  comment?: string;
  timestamp: any;
}

export interface ChannelRequest {
  id: string;
  userId: string;
  userName: string;
  channelName: string;
  category: string;
  streamUrl?: string;
  status: "pending" | "investigating" | "approved" | "rejected";
  timestamp: any;
}

export interface BrokenReport {
  id: string;
  userId: string;
  channelId: string;
  channelName: string;
  issueType: "no-signal" | "lagging" | "audio-only" | "wrong-channel" | "other";
  description?: string;
  status: "open" | "investigating" | "aligned";
  timestamp: any;
}

export interface SystemSettings {
  activeM3uUrl: string;
  autoValidateStreams: boolean;
  lastValidatedAt?: string;
}

export interface PlaybackStats {
  resolution: string;
  fps: number;
  bufferLength: number;
  bandwidth: string;
  latency: number;
}
