import { useEffect } from 'react';
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { auth, googleProvider, usersDb } from '@/config/firebase';
import { useAuthStore } from '@/store/authStore';
import { User } from '@/types';
import { toast } from 'sonner';

const ALLOWED_DOMAIN = '@avivacredito.com';

export function useAuth() {
  const { firebaseUser, user, loading, setFirebaseUser, setUser, setLoading } =
    useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setFirebaseUser(firebaseUser);

      if (firebaseUser) {
        try {
          const email = firebaseUser.email || '';

          // 1. Validate domain
          if (!email.endsWith(ALLOWED_DOMAIN)) {
            await firebaseSignOut(auth);
            toast.error(`Solo se permite acceso con cuentas ${ALLOWED_DOMAIN}`);
            setUser(null);
            setLoading(false);
            return;
          }

          // 2. Check invitation
          const inviteDoc = await getDoc(doc(usersDb, 'invitations', email));
          if (!inviteDoc.exists()) {
            await firebaseSignOut(auth);
            toast.error('No tienes invitación para acceder. Contacta al administrador.');
            setUser(null);
            setLoading(false);
            return;
          }

          // 3. Get or create user document
          const userDoc = await getDoc(doc(usersDb, 'users', firebaseUser.uid));

          if (userDoc.exists()) {
            const userData = { id: userDoc.id, ...userDoc.data() } as User;
            await setDoc(
              doc(usersDb, 'users', firebaseUser.uid),
              { lastLogin: Timestamp.now() },
              { merge: true }
            );
            setUser(userData);
            toast.success('Sesión iniciada exitosamente');
          } else {
            // First login — create user with role from invitation
            const inviteData = inviteDoc.data();
            const newUser: Omit<User, 'id'> = {
              email,
              displayName: firebaseUser.displayName || email,
              photoURL: firebaseUser.photoURL || undefined,
              role: inviteData.role || 'viewer',
              createdAt: Timestamp.now(),
              lastLogin: Timestamp.now(),
            };

            await setDoc(doc(usersDb, 'users', firebaseUser.uid), newUser);
            setUser({ id: firebaseUser.uid, ...newUser });
            toast.success('Sesión iniciada exitosamente');
          }
        } catch (error: any) {
          console.error('Error al verificar acceso:', error);
          await firebaseSignOut(auth);
          toast.error('Error al verificar acceso. Revisa las reglas de Firestore.');
          setUser(null);
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
    } catch (error: any) {
      console.error('Error al iniciar sesión:', error);
      toast.error(error.message || 'Error al iniciar sesión');
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      toast.success('Sesión cerrada exitosamente');
    } catch (error: any) {
      console.error('Error al cerrar sesión:', error);
      toast.error(error.message || 'Error al cerrar sesión');
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
