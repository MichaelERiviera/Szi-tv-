import {
  collection,
  getDocs,
  setDoc,
  doc,
  getDoc,
  query,
  where,
  deleteDoc,
  updateDoc,
  increment,
  limit,
  orderBy,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { Channel, Category, Favorite, WatchHistory } from "../types";
import { DEFAULT_CHANNELS } from "./m3uParser";

// --- SEED CONTROL ACCESSORS ---

export async function setSeedStatus(disabled: boolean): Promise<void> {
  try {
    await setDoc(
      doc(db, "system", "settings"),
      { autoSeedDisabled: disabled },
      { merge: true }
    );
  } catch (err) {
    // Suppress config write errors
  }
}

export async function isSeedDisabledCheck(): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, "system", "settings"));
    if (snap.exists()) {
      return snap.data()?.autoSeedDisabled === true;
    }
  } catch (err) {
    // Suppress config retrieval errors
  }
  return false;
}

// --- CHANNELS & CATEGORIES ---

export async function fetchChannels(): Promise<Channel[]> {
  try {
    const q = query(collection(db, "channels"), limit(1200));
    const snap = await getDocs(q);
    const list: Channel[] = [];
    snap.forEach((d) => {
      list.push(d.data() as Channel);
    });
    return list;
  } catch (err) {
    console.warn("Using offline channel cache:", err);
    return [];
  }
}

export async function saveChannel(chan: Channel): Promise<void> {
  try {
    await setDoc(doc(db, "channels", chan.id), {
      ...chan,
      addedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `channels/${chan.id}`);
  }
}

export async function deleteChannel(channelId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "channels", channelId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `channels/${channelId}`);
  }
}

export async function deleteChannelsBatch(channelIds: string[]): Promise<void> {
  try {
    const limitNum = 500;
    for (let i = 0; i < channelIds.length; i += limitNum) {
      const chunk = channelIds.slice(i, i + limitNum);
      const batch = writeBatch(db);
      chunk.forEach((id) => {
        batch.delete(doc(db, "channels", id));
      });
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, "channels/batch-delete");
  }
}

export async function incrementChannelViews(channelId: string): Promise<void> {
  try {
    const dRef = doc(db, "channels", channelId);
    await updateDoc(dRef, { views: increment(1) });
  } catch (err) {
    // Ignored in public views increment to not block loading
  }
}

export async function seedChannels(channels: Channel[]): Promise<void> {
  try {
    for (const chan of channels) {
      await setDoc(doc(db, "channels", chan.id), {
        ...chan,
        addedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, "channels/seed");
  }
}

// --- FAVORITES ---

export async function fetchUserFavorites(userId: string): Promise<Favorite[]> {
  try {
    const q = query(
      collection(db, `users/${userId}/favorites`),
      orderBy("addedAt", "desc")
    );
    const snap = await getDocs(q);
    const list: Favorite[] = [];
    snap.forEach((d) => {
      list.push(d.data() as Favorite);
    });
    return list;
  } catch (err) {
    console.error("Failed to query favorites:", err);
    return [];
  }
}

export async function toggleFavorite(
  userId: string,
  channelId: string
): Promise<boolean> {
  const favId = `${userId}-${channelId}`.replace(/[^a-zA-Z0-9-]/g, "");
  const docRef = doc(db, `users/${userId}/favorites`, favId);
  try {
    const stateFav = query(
      collection(db, `users/${userId}/favorites`),
      where("channelId", "==", channelId)
    );
    const snap = await getDocs(stateFav);
    if (!snap.empty) {
      // Already exists, delete
      await deleteDoc(docRef);
      return false; // Removed
    } else {
      // Add favorite
      const payload: Favorite = {
        id: favId,
        userId,
        channelId,
        addedAt: new Date(),
      };
      await setDoc(docRef, {
        ...payload,
        addedAt: serverTimestamp(),
      });
      return true; // Added
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${userId}/favorites/${favId}`);
  }
}

// --- WATCH HISTORY ---

export async function fetchWatchHistory(userId: string): Promise<WatchHistory[]> {
  try {
    const q = query(
      collection(db, `users/${userId}/watchHistory`),
      orderBy("watchedAt", "desc"),
      limit(20)
    );
    const snap = await getDocs(q);
    const list: WatchHistory[] = [];
    snap.forEach((d) => {
      list.push(d.data() as WatchHistory);
    });
    return list;
  } catch (err) {
    console.error("Watch history retrieval error:", err);
    return [];
  }
}

export async function logWatchSession(
  userId: string,
  channelId: string,
  progress = 0,
  duration = 0
): Promise<void> {
  const historyId = `${userId}-${channelId}`.replace(/[^a-zA-Z0-9-]/g, "");
  const dRef = doc(db, `users/${userId}/watchHistory`, historyId);
  try {
    const payload: WatchHistory = {
      id: historyId,
      userId,
      channelId,
      watchedAt: new Date(),
      progress,
      duration,
    };
    await setDoc(dRef, {
      ...payload,
      watchedAt: serverTimestamp(),
    });
  } catch (err) {
    // Fail silently so stream is uninterrupted
  }
}
