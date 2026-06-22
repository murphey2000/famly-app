import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { apiPost, getBearerToken } from "@/utils/api";

export interface SelectedMedia {
  uri: string;
  fileName?: string;
  mimeType?: string;
  mediaType: "photo" | "video";
}

interface UploadFileResponse {
  key?: string;
  url?: string;
  public_url?: string;
}

export async function uploadFile(
  media: SelectedMedia,
  backendUrl: string,
  postId: string
): Promise<string> {
  const fileName =
    media.fileName || `${media.mediaType}_${Date.now()}.${media.mediaType === "video" ? "mp4" : "jpg"}`;
  const contentType = media.mimeType || (media.mediaType === "video" ? "video/mp4" : "image/jpeg");

  // Both platforms upload through the backend (/api/upload-file). The backend
  // stores the file and returns the permanent public `url`/`public_url` and,
  // on newer deploys, the storage `key`.
  let result: UploadFileResponse;

  if (Platform.OS === "web") {
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

    result = await uploadResponse.json();
  } else {
    console.log("[Upload] Native: uploading via backend /api/upload-file (multipart)");
    const token = await getBearerToken();

    const uploadResult = await FileSystem.uploadAsync(`${backendUrl}/api/upload-file`, media.uri, {
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: "file",
      mimeType: contentType,
      parameters: { filename: fileName, content_type: contentType },
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (uploadResult.status < 200 || uploadResult.status >= 300) {
      throw new Error(`Upload failed: ${uploadResult.status} - ${uploadResult.body}`);
    }

    result = JSON.parse(uploadResult.body) as UploadFileResponse;
  }

  console.log("[Upload] Upload result:", JSON.stringify(result));
  const displayUrl = result.public_url ?? result.url;
  if (!displayUrl) {
    throw new Error("Upload response missing url: " + JSON.stringify(result));
  }

  // Persist the public URL plus the storage key when the backend provides one
  // (older backends only return the URL — that's fine, the URL is permanent).
  console.log("[Upload] Registering media — postId:", postId, "key:", result.key, "type:", media.mediaType);
  await apiPost(`/api/posts/${postId}/media`, {
    url: displayUrl,
    storage_key: result.key,
    type: media.mediaType,
    filename: fileName,
  });

  return displayUrl;
}
