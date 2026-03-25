/**
 * TypeScript Type Definitions - The Language of Structure
 * 
 * Complete type definitions for the Viber messaging platform,
 * ensuring type safety and developer experience.
 */

// User Types
export interface User {
  _id: string;
  id: string;
  username: string;
  email: string;
  profile: {
    displayName?: string;
    firstName?: string;
    lastName?: string;
    avatar?: {
      url: string;
      key: string;
      uploadedAt: string;
    };
    bio?: string;
    timezone: string;
    language: string;
  };
  privacy: {
    profileVisibility: 'public' | 'contacts' | 'private';
    lastSeenVisibility: 'everyone' | 'contacts' | 'nobody';
    readReceiptEnabled: boolean;
  };
  presence: {
    status: 'online' | 'away' | 'busy' | 'invisible' | 'offline';
    lastSeen: string;
    isTyping?: {
      channelId: string;
      since: string;
    };
  };
  status: 'active' | 'suspended' | 'deactivated' | 'pending_verification';
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

// Message Types
export interface Message {
  _id: string;
  messageId: string;
  sender: User;
  channel: string;
  content: {
    text?: string;
    encrypted?: string;
    formatting: MessageFormatting[];
    entities: MessageEntities;
  };
  media: {
    hasMedia: boolean;
    attachments: MediaAttachment[];
  };
  type: 'text' | 'media' | 'system' | 'call' | 'location' | 'contact' | 'poll';
  replyTo?: Message;
  threadRoot?: string;
  reactions: MessageReaction[];
  delivery: {
    status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
    sentAt: string;
    deliveredAt?: string;
    readBy: ReadReceipt[];
  };
  state: {
    isEdited: boolean;
    editHistory: MessageEdit[];
    isDeleted: boolean;
    deletedAt?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface MessageFormatting {
  type: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'code' | 'link' | 'mention' | 'emoji';
  start: number;
  end: number;
  data?: any;
}

export interface MessageEntities {
  mentions: MessageMention[];
  links: MessageLink[];
  hashtags: MessageHashtag[];
}

export interface MessageMention {
  user: string;
  username: string;
  start: number;
  end: number;
}

export interface MessageLink {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  start: number;
  end: number;
}

export interface MessageHashtag {
  tag: string;
  start: number;
  end: number;
}

export interface MediaAttachment {
  type: 'image' | 'video' | 'audio' | 'document' | 'voice_note';
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  key: string;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    thumbnail?: string;
    waveform?: number[];
  };
  scanStatus: 'pending' | 'safe' | 'malicious' | 'quarantined';
  uploadedAt: string;
}

export interface MessageReaction {
  emoji: string;
  users: string[];
  count: number;
  createdAt: string;
}

export interface ReadReceipt {
  user: string;
  readAt: string;
}

export interface MessageEdit {
  content: string;
  editedAt: string;
  editedBy: string;
}

// Channel Types
export interface Channel {
  _id: string;
  name: string;
  slug?: string;
  description?: string;
  type: 'direct' | 'group' | 'public' | 'private' | 'broadcast';
  privacy: {
    isPublic: boolean;
    requiresApproval: boolean;
    allowInvites: boolean;
    searchable: boolean;
    inviteLink?: {
      token: string;
      expiresAt?: string;
      maxUses?: number;
      currentUses: number;
    };
  };
  appearance: {
    avatar?: {
      url: string;
      key: string;
    };
    cover?: {
      url: string;
      key: string;
    };
    color: string;
    theme: 'default' | 'dark' | 'light' | 'custom';
  };
  members: ChannelMember[];
  settings: ChannelSettings;
  stats: {
    messageCount: number;
    memberCount: number;
    lastActivity: string;
    lastMessage?: {
      messageId: string;
      content: string;
      sender: string;
      timestamp: string;
    };
    onlineMembers?: number;
  };
  status: 'active' | 'archived' | 'deleted' | 'suspended';
  createdAt: string;
  updatedAt: string;
  unreadCount?: number;
  lastReadAt?: string;
}

export interface ChannelMember {
  user: User;
  role: 'owner' | 'admin' | 'moderator' | 'member' | 'restricted';
  permissions: string[];
  joinedAt: string;
  invitedBy?: string;
  status: 'active' | 'muted' | 'restricted' | 'banned';
  mutedUntil?: string;
  notifications: {
    enabled: boolean;
    mentions: boolean;
    all: boolean;
  };
  lastReadAt: string;
  nickname?: string;
}

export interface ChannelSettings {
  allowEditing: boolean;
  allowDeletion: boolean;
  allowMedia: boolean;
  allowVoice: boolean;
  allowFiles: boolean;
  maxFileSize: number;
  threading: boolean;
  reactions: boolean;
  polls: boolean;
  encryption: {
    enabled: boolean;
    algorithm: 'aes-256-gcm' | 'chacha20-poly1305';
  };
}

// Authentication Types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface LoginRequest {
  identifier: string; // username or email
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface LoginResponse {
  message: string;
  user: User;
  tokens: AuthTokens;
  warnings?: string[];
  timestamp: string;
}

export interface RegisterResponse {
  message: string;
  user: User;
  tokens: AuthTokens;
  nextSteps: {
    verifyEmail: boolean;
    emailSent: boolean;
  };
  timestamp: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  message?: string;
  data?: T;
  error?: string;
  details?: any[];
  timestamp: string;
}

export interface PaginationResponse<T> {
  data: T[];
  pagination: {
    limit: number;
    total: number;
    hasMore: boolean;
    before?: string;
    after?: string;
  };
  timestamp: string;
}

// WebSocket Event Types
export interface SocketEvents {
  // Connection events
  'connected': { message: string; user: User; timestamp: string };
  'error': { message: string; error?: string };
  
  // Message events
  'message:new': Message;
  'message:sent': { messageId: string; timestamp: string };
  'message:edited': Message;
  'message:deleted': { messageId: string };
  'message:reaction_added': { messageId: string; emoji: string; userId: string };
  'message:reaction_removed': { messageId: string; emoji: string; userId: string };
  'message:read_receipt': { messageId: string; readBy: string; readAt: string };
  
  // Typing events
  'user:typing': { userId: string; username: string; channelId: string; timestamp: string };
  'user:typing_stop': { userId: string; channelId: string; timestamp: string };
  
  // Presence events
  'user:presence_update': { userId: string; status: string; timestamp: string };
  
  // Channel events
  'channel:joined': { channelId: string; channelName: string; memberCount: number; timestamp: string };
  'channel:left': { channelId: string; timestamp: string };
  'user:joined_channel': { userId: string; username: string; channelId: string; timestamp: string };
  'user:left_channel': { userId: string; username: string; channelId: string; timestamp: string };
}

// UI State Types
export interface AppState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  tokens: AuthTokens | null;
}

export interface ChatState {
  channels: Channel[];
  activeChannelId: string | null;
  messages: Record<string, Message[]>;
  typingUsers: Record<string, string[]>;
  unreadCounts: Record<string, number>;
  isConnected: boolean;
}

// Form Types
export interface MessageFormData {
  content: string;
  replyTo?: string;
  type?: Message['type'];
}

export interface ChannelFormData {
  name: string;
  description?: string;
  type: Channel['type'];
  isPublic?: boolean;
  members?: string[];
}

export interface UserProfileFormData {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  timezone?: string;
  language?: string;
}

// Error Types
export interface ApiError {
  error: string;
  message: string;
  details?: any[];
  timestamp: string;
  field?: string;
}