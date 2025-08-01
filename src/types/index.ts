export interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: any;
  likes: string[];
  dislikes: string[];
  comments: Comment[];
}

export interface Comment {
  id?: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: any;
  likes: string[];
  dislikes: string[];
}

export interface Community {
  id: string;
  name: string;
  description: string;
  info?: string;
  createdAt: any;
}

export interface Member {
  uid: string;
  profile: any;
  memberships: string[];
  role: string;
} 