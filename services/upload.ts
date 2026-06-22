import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { apiPost, getBearerToken } from "@/utils/api";

export interface SelectedImage {
  uri: string;
  fileName?: string;
  mimeType?: string;
}

export async function uploadFile(image: SelectedImage, backendUrl: string): Promise<string> {
  const fileName = image.fileName || `photo_${Date.now()}.jpg`;
  const contentType = image.mimeType || "image/jpeg";

  if (Platform.OS === "web") {
    // On web, upload directly to our backend to avoid CORS issues with storage proxy
    console.log("[Upload] Web: uploading via backend /api/upload-file");
    const token = await getBearerToken();
    const imageResponse = await fetch(image.uri);
    const blob = await imageResponse.blob();
    const formData = new FormData();
    formData.append("file", new Blob([blob], { type: contentType }), fileName);
    formData.append("filename", fileName);
    formData.append("content_type", contentType);

    const uploadResponse = await fetch(`${backendUrl}/api/upload-file`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (!uploadResponse.ok) {
      const text = await uploadResponse.text();
      throw new Error(`Upload failed: ${uploadResponse.status} - ${text}`);
    }

    const result = await uploadResponse.json();
    console.log("[Upload] Web upload result:", JSON.stringify(result));
    const publicUrl = result.public_url ?? result.url;
    if (!publicUrl) {
      throw new Error("Upload response missing URL: " + JSON.stringify(result));
    }
    return publicUrl;
  }

  // On native, use signed URL + FileSystem.uploadAsync
  console.log("[Upload] Native: uploading via signed URL");
  const { upload_url, public_url } = await apiPost<{ upload_url: string; public_url: string }>(
    "/api/upload-url",
    { filename: fileName, content_type: contentType }
  );
  console.log("[Upload] Native upload-url response — upload_url:", upload_url, "public_url:", public_url);

  const uploadResult = await FileSystem.uploadAsync(upload_url, image.uri, {
    httpMethod: "PUT",
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { "Content-Type": contentType },
  });
  if (uploadResult.status < 200 || uploadResult.status >= 300) {
    throw new Error(`Upload failed: ${uploadResult.status}`);
  }
  return public_url;
}
