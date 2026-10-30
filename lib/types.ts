export type Profile = {
  id: string;
  full_name: string;
  city: string | null;
  bio: string | null;
  avatar_url: string | null;
  role: 'user' | 'admin';
  status: 'active' | 'suspended';
  suspended_reason: string | null;
  created_at: string;
};

export type Store = {
  id: number;
  created_by: string | null;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  latitude: number;
  longitude: number;
  verified: boolean;
  created_at: string;
};

export type Conversation = {
  id: number;
  equipment_id: number | null;
  renter_id: string;
  owner_id: string;
  last_message: string | null;
  last_message_at: string;
  equipment?: { name: string; emoji: string; color: string } | null;
};

export type ChatMessage = {
  id: number;
  conversation_id: number;
  sender_id: string;
  kind: 'text' | 'system';
  body: string;
  created_at: string;
};

export type LiveShare = {
  conversation_id: number;
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  active: boolean;
  started_at: string;
  updated_at: string;
};
