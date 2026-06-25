import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import { authClient, setBearerToken, clearAuthTokens, API_URL } from "@/lib/auth";
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

async function fetchAndStoreJwt(sessionToken?: string) {
  try {
    const headers: Record<string, string> = {};

    // On iOS, no cookie session exists — use the Better Auth session token as Bearer
    let tokenToUse = sessionToken;
    if (!tokenToUse && Platform.OS !== "web") {
      tokenToUse = (await SecureStore.getItemAsync("famly.session_token")) ?? undefined;
    }
    if (tokenToUse) {
      headers["Authorization"] = `Bearer ${tokenToUse}`;
    }

    const res = await fetch(`${API_URL}/api/auth/token`, {
      method: "GET",
      credentials: "include",
      headers,
    });
    if (res.ok) {
      const data = await res.json();
      if (data.token) {
        await setBearerToken(data.token);
        console.log("[AuthContext] JWT fetched and stored from /api/auth/token");
      }
    } else {
      console.warn("[AuthContext] /api/auth/token returned", res.status);
    }
  } catch (e) {
    console.warn("[AuthContext] Failed to fetch JWT from /api/auth/token", e);
  }
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
        // Recovery: if we have a valid session but no bearer token (e.g. iOS stripped set-auth-jwt header), fetch it now
        const existingToken = await getBearerToken();
        if (!existingToken) {
          console.log("[AuthContext] Session valid but no bearer token — fetching from /api/auth/token");
          // Pass the session token directly so the backend can validate it
          const sessionToken = (session.data.session as any)?.token;
          await fetchAndStoreJwt(sessionToken);
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
      console.warn("[AuthContext] No token in signIn response — fetching from /api/auth/token");
      await fetchAndStoreJwt();
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
      console.warn("[AuthContext] No token in signUp response — fetching from /api/auth/token");
      await fetchAndStoreJwt();
    }
    await fetchUser();
  };

  const signInWithSocial = async (provider: "apple" | "google") => {
    if (Platform.OS === "web") {
      const token = await openOAuthPopup(provider);
      await setBearerToken(token);
      console.log("[AuthContext] Bearer token saved from web OAuth popup for:", provider);
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
      if (token) {
        await setBearerToken(token);
        console.log("[AuthContext] Bearer token saved from social signIn response for:", provider);
      } else {
        console.warn("[AuthContext] No token in social signIn response — fetching from /api/auth/token");
        await fetchAndStoreJwt();
      }
      await fetchUser();
    }
  };

  const signInWithGoogle = () => signInWithSocial("google");

  const signInWithApple = async () => {
    if (Platform.OS === "ios") {
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
        idToken: credential.identityToken as any,
      });
      if (error) {
        throw new Error(error.message || "Apple sign in failed");
      }
      const token = (data as any)?.token;
      if (token) {
        await setBearerToken(token);
        console.log("[AuthContext] Bearer token saved from native Apple signIn response");
      } else {
        console.warn("[AuthContext] No token in native Apple signIn response — fetching from /api/auth/token");
        await fetchAndStoreJwt();
      }
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
