import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import Constants from "expo-constants";

const API_URL = "https://zaxn23y279j7wdx9qaka72k3nvvaxnpg.app.specular.dev";

export const BEARER_TOKEN_KEY = "famly_bearer_token";

// Platform-specific storage: localStorage for web, SecureStore for native
const storage = Platform.OS === "web"
  ? {
      getItem: (key: string) => localStorage.getItem(key),
      setItem: (key: string, value: string) => localStorage.setItem(key, value),
      deleteItem: (key: string) => localStorage.removeItem(key),
    }
  : SecureStore;

export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    expoClient({
      scheme: "famly",
      storagePrefix: "famly",
      storage,
    }),
  ],
  fetchOptions: {
    // Capture the JWT issued by Better Auth's jwt() plugin from the
    // `set-auth-jwt` response header on any session-returning endpoint
    // (sign-in, sign-up, getSession). The api-service verifies this JWT
    // via JWKS — `session.data.session.token` is the session ID, not a
    // JWT, and storing that as the bearer would 401 every api-service call.
    onSuccess: async (ctx: { response: Response }) => {
      console.log("[auth] onSuccess hook fired, status:", ctx.response.status, "url:", ctx.response.url);
      // Try header first (works on web/Android)
      const jwt = ctx.response.headers.get("set-auth-jwt");
      if (jwt) {
        console.log("[auth] JWT found in set-auth-jwt header, storing token");
        await setBearerToken(jwt);
        return;
      }
      // Fallback: read from response body (needed on iOS where set-* headers are stripped)
      try {
        const cloned = ctx.response.clone();
        const data = await cloned.json();
        if (data?.token) {
          console.log("[auth] JWT found in response body token field, storing token");
          await setBearerToken(data.token);
        } else {
          console.log("[auth] No JWT found in header or body token field");
        }
      } catch (_) {
        // not JSON or no token field — ignore
        console.log("[auth] Could not parse response body for token fallback");
      }
    },
    ...(Platform.OS === "web" && {
      credentials: "include",
      auth: {
        type: "Bearer" as const,
        token: () => localStorage.getItem(BEARER_TOKEN_KEY) || "",
      },
    }),
  },
});

export async function setBearerToken(token: string) {
  if (Platform.OS === "web") {
    localStorage.setItem(BEARER_TOKEN_KEY, token);
  } else {
    await SecureStore.setItemAsync(BEARER_TOKEN_KEY, token);
  }
}

export async function clearAuthTokens() {
  if (Platform.OS === "web") {
    localStorage.removeItem(BEARER_TOKEN_KEY);
  } else {
    await SecureStore.deleteItemAsync(BEARER_TOKEN_KEY);
  }
}

export { API_URL };
