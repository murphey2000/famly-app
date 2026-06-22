import { useEffect } from "react";
import { useRouter } from "expo-router";

// This tab redirects to the new post modal
export default function AddTab() {
  const router = useRouter();

  useEffect(() => {
    console.log("[Add Tab] Redirecting to /post/new");
    router.push("/post/new");
  }, []);

  return null;
}
