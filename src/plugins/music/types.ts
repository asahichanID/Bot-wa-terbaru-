export interface NeoxrYtsItem {
  type?: string;
  videoId: string;
  url: string;
  title: string;
  description?: string;
  image?: string;
  thumbnail: string;
  seconds: number;
  timestamp: string;
  duration?: {
    seconds: number;
    timestamp: string;
  };
  ago?: string;
  views?: number;
  author: {
    name: string;
    url?: string;
  };
}

export interface NeoxrYtsResponse {
  creator?: string;
  status: boolean;
  data: NeoxrYtsItem[];
}

export interface NeoxrYoutubeMp3Data {
  filename: string;
  quality: string;
  size: string;
  extension: string;
  url: string;
}

export interface NeoxrYoutubeMp3Response {
  creator?: string;
  status: boolean;
  id: string;
  title: string;
  thumbnail: string;
  duration: string;
  duration_seconds: number;
  channel: string;
  views: string;
  data: NeoxrYoutubeMp3Data;
}
