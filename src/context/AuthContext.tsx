import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  User,
  onAuthStateChanged,
  signOut,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "../firebase";
import { UserProfile } from "../types";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfile = async (firebaseUser: User) => {
    const userDocRef = doc(db, "users", firebaseUser.uid);
    try {
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        setProfile(snap.data() as UserProfile);
      } else {
        // Create initial profile if missing
        const isDefaultAdmin = firebaseUser.email === "sajjab62q@gmail.com";
        const newProfile: UserProfile = {
          id: firebaseUser.uid,
          email: firebaseUser.email || "",
          displayName: firebaseUser.displayName || "Novice Observer",
          createdAt: new Date(),
          role: isDefaultAdmin ? "admin" : "user",
        };
        await setDoc(userDocRef, {
          ...newProfile,
          createdAt: serverTimestamp(),
        });
        setProfile(newProfile);
      }
    } catch (err) {
      console.error("Profile synchronization crash:", err);
      // Fallback local profile if offline or rules are still deploying
      setProfile({
        id: firebaseUser.uid,
        email: firebaseUser.email || "",
        displayName: firebaseUser.displayName || "Astronomy Intern",
        createdAt: new Date(),
        role: firebaseUser.email === "sajjab62q@gmail.com" ? "admin" : "user",
      });
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        setUser(firebaseUser);
        await fetchProfile(firebaseUser);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Google authentication anomaly:", error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, pass: string, name: string) => {
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(credential.user, { displayName: name });
      
      // Seed profile doc
      const isDefaultAdmin = email === "sajjab62q@gmail.com";
      const userDocRef = doc(db, "users", credential.user.uid);
      const newProfile: UserProfile = {
        id: credential.user.uid,
        email,
        displayName: name,
        createdAt: new Date(),
        role: isDefaultAdmin ? "admin" : "user",
      };
      
      try {
        await setDoc(userDocRef, {
          ...newProfile,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${credential.user.uid}`);
      }
      setProfile(newProfile);
    } catch (error) {
      console.error("Email signup anomaly:", error);
      throw error;
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
      console.error("Email credential handshake failed:", error);
      throw error;
    }
  };

  const signOutUser = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Session purge failed:", error);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error("Password reset transmission broken:", error);
      throw error;
    }
  };

  const value = {
    user,
    profile,
    loading,
    isAdmin: profile?.role === "admin" || user?.email === "sajjab62q@gmail.com",
    signInWithGoogle,
    signUpWithEmail,
    signInWithEmail,
    signOutUser,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be nested within an AuthProvider directive");
  }
  return context;
}
