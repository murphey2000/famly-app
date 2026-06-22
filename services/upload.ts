import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { apiPost, getBearerToken } from "@/utils/api";

export interface SelectedMedia {
  uri: string;
  fileName?: string;
  mimeType?: string;
  mediaType: "photo" | "video";
}

export async function uploadFile(
  media: SelectedMedia,
  backendUrl: string,
  postId: string
): Promise<string> {
  const fileName =
    media.fileName || `${media.mediaType}_${Date.now()}.${media.mediaType === "video" ? "mp4" : "jpg"}`;
  const contentType = media.mimeType || (media.mediaType === "video" ? "video/mp4" : "image/jpeg");

  let publicUrl: string;

  if (Platform.OS === "web") {
    // On web, upload directly to our backend to avoid CORS issues with storage proxy
    console.log("[Upload] Web: uploading via backend /api/upload-file");
    const token = await getBearerToken();
    const fileResponse = await fetch(media.uri);
    const blob = await fileResponse.blob();
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
    const url = result.public_url ?? result.url;
    if (!url) {
      throw new Error("Upload response missing URL: " + JSON.stringify(result));
    }
    publicUrl = url;
  } else {
    // On native, use signed URL + FileSystem.uploadAsync
    console.log("[Upload] Native: uploading via signed URL");
    const { upload_url, public_url } = await apiPost<{ upload_url: string; public_url: string }>(
      "/api/upload-url",
      { filename: fileName, content_type: contentType }
    );
    console.log("[Upload] Native upload-url response — upload_url:", upload_url, "public_url:", public_url);

    const uploadResult = await FileSystem.uploadAsync(upload_url, media.uri, {
      httpMethod: "PUT",
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: { "Content-Type": contentType },
    });
    if (uploadResult.status < 200 || uploadResult.status >= 300) {
      throw new Error(`Upload failed: ${uploadResult.status}`);
    }
    publicUrl = public_url;
  }

  console.log("[Upload] Registering media — postId:", postId, "url:", publicUrl, "type:", media.mediaType);
  await apiPost(`/api/posts/${postId}/media`, {
    url: publicUrl,
    type: media.mediaType,
    filename: fileName,
  });

  return publicUrl;
}
