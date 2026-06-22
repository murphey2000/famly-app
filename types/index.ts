export interface Media {
  id: string;
  url: string;
  type: string;
  thumbnail_url?: string | null;
  filename?: string;
}

export interface Post {
  id: string;
  text: string;
  ai_title?: string;
  ai_story?: string;
  ai_status: "pending" | "processing" | "done" | "failed";
  tags: string[];
  created_at: string;
  date?: string;
  author: {
    id: string;
    name: string;
    image?: string;
  };
  media: Media[];
}

export interface FamilyMember {
  id: string;
  name: string;
  image?: string;
  email?: string;
}

export interface Family {
  id: string;
  name: string;
  members?: FamilyMember[];
}

export interface FamilyStats {
  photos: number;
  videos: number;
  memories: number;
}

export interface TodayMemory {
  id: string;
  year: number;
  post: Post;
}
