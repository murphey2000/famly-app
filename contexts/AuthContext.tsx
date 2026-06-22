import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import { authClient, setBearerToken, clearAuthTokens } from "@/lib/auth";
import { getBearerToken } from "@/utils/api";
import { registerForPushNotifications, savePushToken } from "@/services/notifications";

interface User {
  id: string;
  email: string;
  name?: string;
  image?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name?: string) => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  fetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function openOAuthPopup(provider: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const popupUrl = `${window.location.origin}/auth-popup?provider=${provider}`;
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      popupUrl,
      "oauth-popup",
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
    );

    if (!popup) {
      reject(new Error("Failed to open popup. Please allow popups."));
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "oauth-success" && event.data?.token) {
        window.removeEventListener("message", handleMessage);
        clearInterval(checkClosed);
        resolve(event.data.token);
      } else if (event.data?.type === "oauth-error") {
        window.removeEventListener("message", handleMessage);
        clearInterval(checkClosed);
        reject(new Error(event.data.error || "OAuth failed"));
      }
    };

    window.addEventListener("message", handleMessage);

    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        window.removeEventListener("message", handleMessage);
        reject(new Error("Authentication cancelled"));
      }
    }, 500);
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser();

    const subscription = Linking.addEventListener("url", (event) => {
      console.log("Deep link received, refreshing user session");
      fetchUser();
    });

    const intervalId = setInterval(() => {
      fetchUser();
    }, 5 * 60 * 1000);

    return () => {
      subscription.remove();
      clearInterval(intervalId);
    };
  }, []);

  const fetchUser = async () => {
    try {
      setLoading(true);
      const session = await authClient.getSession();
      if (session?.data?.user) {
        setUser(session.data.user as User);
        // Self-heal: if we have a live session but no stored bearer token
        // (e.g. user logged in before token-saving was added), recover the
        // session token so authenticated API calls work without re-login.
        const existing = await getBearerToken();
        const sessionToken = (session.data as any)?.session?.token;
        if (!existing && sessionToken) {
          await setBearerToken(sessionToken);
          console.log("[AuthContext] Recovered bearer token from session");
        }

        registerForPushNotifications()
          .then((token) => (token ? savePushToken(token) : undefined))
          .catch((error) => {
            console.error("[AuthContext] Push notification registration failed:", error);
          });
      } else {
        setUser(null);
        await clearAuthTokens();
      }
    } catch (error) {
      console.error("Failed to fetch user:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    console.log("[AuthContext] signInWithEmail called for:", email);
    const { data, error } = await authClient.signIn.email({ email, password });
    if (error) {
      console.error("[AuthContext] signInWithEmail error:", error);
      throw new Error(error.message || "Anmeldung fehlgeschlagen");
    }
    const token = (data as any)?.token;
    if (token) {
      await setBearerToken(token);
      console.log("[AuthContext] Bearer token saved from signIn response");
    } else {
      console.warn("[AuthContext] No token in signIn response — auth may fail");
    }
    await fetchUser();
  };

  const signUpWithEmail = async (email: string, password: string, name?: string) => {
    console.log("[AuthContext] signUpWithEmail called for:", email, "name:", name);
    const { data, error } = await authClient.signUp.email({ email, password, name: name ?? "" });
    if (error) {
      console.error("[AuthContext] signUpWithEmail error:", error);
      throw new Error(error.message || "Registrierung fehlgeschlagen");
    }
    const token = (data as any)?.token;
    if (token) {
      await setBearerToken(token);
      console.log("[AuthContext] Bearer token saved from signUp response");
    } else {
      console.warn("[AuthContext] No token in signUp response — auth may fail");
    }
    await fetchUser();
  };

  const signInWithSocial = async (provider: "apple" | "google") => {
    if (Platform.OS === "web") {
      const token = await openOAuthPopup(provider);
      await setBearerToken(token);
      await fetchUser();
    } else {
      console.log("[AuthContext] signInWithSocial called for provider:", provider);
      const { data, error } = await authClient.signIn.social({
        provider,
        callbackURL: "famly://auth-callback",
      });
      if (error) {
        throw new Error(error.message || "Social sign in failed");
      }
      const token = (data as any)?.token;
      if (token) await setBearerToken(token);
      await fetchUser();
    }
  };

  const signInWithGoogle = () => signInWithSocial("google");

  const signInWithApple = async () => {
    if (Platform.OS === "ios") {
      const AppleAuthentication = require("expo-apple-authentication");
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        throw new Error("No identity token received from Apple");
      }
      const { data, error } = await authClient.signIn.social({
        provider: "apple",
        idToken: credential.identityToken,
      });
      if (error) {
        throw new Error(error.message || "Apple sign in failed");
      }
      const token = (data as any)?.token;
      if (token) await setBearerToken(token);
      await fetchUser();
    } else {
      await signInWithSocial("apple");
    }
  };

  const signOut = async () => {
    try {
      await authClient.signOut();
    } catch (error) {
      console.error("Sign out failed (API):", error);
    } finally {
      setUser(null);
      await clearAuthTokens();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithEmail,
        signUpWithEmail,
        signInWithApple,
        signInWithGoogle,
        signOut,
        fetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
