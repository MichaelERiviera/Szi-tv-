export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  createdAt: any; // Firestore Timestamp
  role: "user" | "admin";
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
  progress?: number;
  duration?: number;
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
