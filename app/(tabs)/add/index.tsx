import { useEffect } from "react";
import { useRouter } from "expo-router";

// This tab redirects to the new post modal
export default function AddTab() {
  const router = useRouter();

  useEffect(() => {
    console.log("[Add Tab] Redirecting to /(tabs)/(home)");
    router.replace("/(tabs)/(home)");
  }, [router]);

  return null;
}
