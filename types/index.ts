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
  birthday?: string;
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

export interface FeedItemPost { kind: 'post'; post: Post }
export interface FeedItemMemory { kind: 'memory'; year: number; post: Post }
export interface FeedItemBirthday {
  kind: 'birthday';
  member: { id: string; name: string; image?: string; birthday: string };
  daysUntil: number;
  age: number | null;
}
export type FeedItem = FeedItemPost | FeedItemMemory | FeedItemBirthday;
