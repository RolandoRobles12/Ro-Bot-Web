import { useEffect } from 'react';
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { auth, googleProvider, db } from '@/config/firebase';
import { useAuthStore } from '@/store/authStore';
import { User } from '@/types';
import { toast } from 'sonner';

export function useAuth() {
  const { firebaseUser, user, loading, setFirebaseUser, setUser, setLoading } =
    useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setFirebaseUser(firebaseUser);

      if (firebaseUser) {
        // Get or create user document
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));

        if (userDoc.exists()) {
          // Update last login
          const userData = { id: userDoc.id, ...userDoc.data() } as User;
          await setDoc(
            doc(db, 'users', firebaseUser.uid),
            { lastLogin: Timestamp.now() },
            { merge: true }
          );
          setUser(userData);
        } else {
          // Create new user with default viewer role
          const newUser: Omit<User, 'id'> = {
            email: firebaseUser.email!,
            displayName: firebaseUser.displayName || firebaseUser.email!,
            photoURL: firebaseUser.photoURL || undefined,
            role: 'viewer', // Default role, admin must upgrade
            createdAt: Timestamp.now(),
            lastLogin: Timestamp.now(),
          };

          await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
          setUser({ id: firebaseUser.uid, ...newUser });
        }
      } else {
        setUser(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [setFirebaseUser, setUser, setLoading]);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success('Signed in successfully!');
    } catch (error: any) {
      console.error('Sign in error:', error);
      toast.error(error.message || 'Failed to sign in');
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      toast.success('Signed out successfully!');
    } catch (error: any) {
      console.error('Sign out error:', error);
      toast.error(error.message || 'Failed to sign out');
      throw error;
    }
  };

  return {
    user,
    firebaseUser,
    loading,
    signInWithGoogle,
    signOut,
  };
}
