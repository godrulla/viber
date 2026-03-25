/**
 * Chat Store - The Heart of Communication
 * 
 * Global state management for chat functionality including channels,
 * messages, typing indicators, and real-time updates.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Channel, Message, User } from '../types';
import { apiClient } from '../services/apiClient';
import { socketClient } from '../services/socketClient';

interface ChatState {
  // State
  channels: Channel[];
  activeChannelId: string | null;
  messages: Record<string, Message[]>;
  typingUsers: Record<string, string[]>; // channelId -> userIds
  unreadCounts: Record<string, number>;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Pagination
  messagesPagination: Record<string, {
    hasMore: boolean;
    loading: boolean;
    before?: string;
  }>;

  // Actions - Channels
  loadChannels: () => Promise<void>;
  setActiveChannel: (channelId: string | null) => void;
  createChannel: (channelData: {
    name: string;
    description?: string;
    type: Channel['type'];
    isPublic?: boolean;
    members?: string[];
  }) => Promise<Channel>;
  joinChannel: (channelId: string) => Promise<void>;
  leaveChannel: (channelId: string) => Promise<void>;

  // Actions - Messages
  loadMessages: (channelId: string, before?: string) => Promise<void>;
  sendMessage: (channelId: string, content: string, replyTo?: string) => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  addReaction: (messageId: string, emoji: string) => Promise<void>;
  removeReaction: (messageId: string, emoji: string) => Promise<void>;
  markMessagesRead: (channelId: string, messageIds: string[]) => void;

  // Actions - Real-time
  handleNewMessage: (message: Message) => void;
  handleMessageEdited: (message: Message) => void;
  handleMessageDeleted: (messageId: string) => void;
  handleReactionAdded: (messageId: string, emoji: string, userId: string) => void;
  handleReactionRemoved: (messageId: string, emoji: string, userId: string) => void;
  handleUserTyping: (channelId: string, userId: string, username: string) => void;
  handleUserStoppedTyping: (channelId: string, userId: string) => void;

  // Actions - Typing
  startTyping: (channelId: string) => void;
  stopTyping: (channelId: string) => void;

  // Actions - Utility
  clearError: () => void;
  setError: (error: string) => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>()(
  devtools(
    (set, get) => ({
      // Initial State
      channels: [],
      activeChannelId: null,
      messages: {},
      typingUsers: {},
      unreadCounts: {},
      isConnected: false,
      isLoading: false,
      error: null,
      messagesPagination: {},

      // Load Channels
      loadChannels: async () => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiClient.getChannels();
          
          set({
            channels: response.channels,
            isLoading: false,
            error: null
          });

          // Join all channels via socket for real-time updates
          response.channels.forEach(channel => {
            try {
              socketClient.joinChannel(channel._id);
            } catch (error) {
              console.warn('Failed to join channel via socket:', channel._id);
            }
          });

          console.log('✅ Channels loaded:', response.channels.length);
        } catch (error: any) {
          const errorMessage = error.message || 'Failed to load channels';
          set({
            isLoading: false,
            error: errorMessage
          });
          throw error;
        }
      },

      // Set Active Channel
      setActiveChannel: (channelId: string | null) => {
        const { activeChannelId } = get();

        // Leave previous channel
        if (activeChannelId && activeChannelId !== channelId) {
          try {
            socketClient.leaveChannel(activeChannelId);
          } catch (error) {
            console.warn('Failed to leave previous channel:', activeChannelId);
          }
        }

        // Join new channel
        if (channelId) {
          try {
            socketClient.joinChannel(channelId);
            
            // Clear unread count for this channel
            set(state => ({
              activeChannelId: channelId,
              unreadCounts: {
                ...state.unreadCounts,
                [channelId]: 0
              }
            }));

            // Load messages if not already loaded
            if (!get().messages[channelId]) {
              get().loadMessages(channelId);
            }
          } catch (error) {
            console.warn('Failed to join new channel:', channelId);
          }
        } else {
          set({ activeChannelId: null });
        }
      },

      // Create Channel
      createChannel: async (channelData) => {
        set({ isLoading: true, error: null });

        try {
          const channel = await apiClient.createChannel(channelData);
          
          set(state => ({
            channels: [channel, ...state.channels],
            isLoading: false,
            error: null
          }));

          // Join the new channel
          socketClient.joinChannel(channel._id);

          console.log('✅ Channel created:', channel.name);
          return channel;
        } catch (error: any) {
          const errorMessage = error.message || 'Failed to create channel';
          set({
            isLoading: false,
            error: errorMessage
          });
          throw error;
        }
      },

      // Join Channel
      joinChannel: async (channelId: string) => {
        try {
          // API call to join channel (if needed for permissions)
          // const channel = await apiClient.getChannel(channelId);
          
          // Join via socket for real-time updates
          socketClient.joinChannel(channelId);
          
          console.log('✅ Joined channel:', channelId);
        } catch (error: any) {
          console.error('❌ Failed to join channel:', error);
          throw error;
        }
      },

      // Leave Channel
      leaveChannel: async (channelId: string) => {
        try {
          // Leave via socket
          socketClient.leaveChannel(channelId);
          
          // Remove from local state if user actually left the channel
          // (for now, just leaving the socket room)
          
          console.log('✅ Left channel:', channelId);
        } catch (error: any) {
          console.error('❌ Failed to leave channel:', error);
          throw error;
        }
      },

      // Load Messages
      loadMessages: async (channelId: string, before?: string) => {
        const pagination = get().messagesPagination[channelId];
        
        if (pagination?.loading) return;

        set(state => ({
          messagesPagination: {
            ...state.messagesPagination,
            [channelId]: {
              ...pagination,
              loading: true
            }
          }
        }));

        try {
          const response = await apiClient.getMessages(channelId, {
            limit: 50,
            before
          });

          set(state => {
            const existingMessages = state.messages[channelId] || [];
            const newMessages = before 
              ? [...response.messages, ...existingMessages]
              : response.messages;

            return {
              messages: {
                ...state.messages,
                [channelId]: newMessages
              },
              messagesPagination: {
                ...state.messagesPagination,
                [channelId]: {
                  loading: false,
                  hasMore: response.pagination.hasMore,
                  before: response.pagination.before
                }
              }
            };
          });

          // Mark messages as read
          const messageIds = response.messages.map(msg => msg._id);
          get().markMessagesRead(channelId, messageIds);

          console.log('✅ Messages loaded:', response.messages.length, 'for channel:', channelId);
        } catch (error: any) {
          set(state => ({
            messagesPagination: {
              ...state.messagesPagination,
              [channelId]: {
                ...pagination,
                loading: false
              }
            },
            error: error.message || 'Failed to load messages'
          }));
          throw error;
        }
      },

      // Send Message
      sendMessage: async (channelId: string, content: string, replyTo?: string) => {
        try {
          // Send via socket for immediate feedback
          socketClient.sendMessage({
            channelId,
            content: { text: content },
            replyTo
          });

          console.log('📤 Message sent via socket');
        } catch (error: any) {
          // Fallback to HTTP API
          try {
            const message = await apiClient.sendMessage({
              channelId,
              content: { text: content },
              replyTo
            });
            
            // Add to local state
            get().handleNewMessage(message);
          } catch (apiError: any) {
            throw apiError;
          }
        }
      },

      // Edit Message
      editMessage: async (messageId: string, content: string) => {
        try {
          // Try socket first
          socketClient.editMessage({
            messageId,
            content: { text: content }
          });
        } catch (error) {
          // Fallback to HTTP API
          const message = await apiClient.editMessage(messageId, { text: content });
          get().handleMessageEdited(message);
        }
      },

      // Delete Message
      deleteMessage: async (messageId: string) => {
        try {
          // Try socket first
          socketClient.deleteMessage({ messageId });
        } catch (error) {
          // Fallback to HTTP API
          await apiClient.deleteMessage(messageId);
          get().handleMessageDeleted(messageId);
        }
      },

      // Add Reaction
      addReaction: async (messageId: string, emoji: string) => {
        try {
          // Try socket first
          socketClient.addReaction({ messageId, emoji });
        } catch (error) {
          // Fallback to HTTP API
          await apiClient.addReaction(messageId, emoji);
        }
      },

      // Remove Reaction
      removeReaction: async (messageId: string, emoji: string) => {
        try {
          await apiClient.removeReaction(messageId, emoji);
        } catch (error: any) {
          console.error('❌ Failed to remove reaction:', error);
          throw error;
        }
      },

      // Mark Messages Read
      markMessagesRead: (channelId: string, messageIds: string[]) => {
        messageIds.forEach(messageId => {
          try {
            socketClient.markMessageRead({ messageId, channelId });
          } catch (error) {
            console.warn('Failed to mark message read:', messageId);
          }
        });
      },

      // Handle New Message
      handleNewMessage: (message: Message) => {
        set(state => {
          const channelId = message.channel;
          const existingMessages = state.messages[channelId] || [];
          
          // Avoid duplicates
          const messageExists = existingMessages.some(msg => msg._id === message._id);
          if (messageExists) return state;

          // Add to messages
          const newMessages = [...existingMessages, message];
          
          // Update unread count if not active channel
          const isActiveChannel = state.activeChannelId === channelId;
          const newUnreadCount = isActiveChannel 
            ? 0 
            : (state.unreadCounts[channelId] || 0) + 1;

          return {
            messages: {
              ...state.messages,
              [channelId]: newMessages
            },
            unreadCounts: {
              ...state.unreadCounts,
              [channelId]: newUnreadCount
            }
          };
        });
      },

      // Handle Message Edited
      handleMessageEdited: (message: Message) => {
        set(state => {
          const channelId = message.channel;
          const existingMessages = state.messages[channelId] || [];
          
          const updatedMessages = existingMessages.map(msg => 
            msg._id === message._id ? message : msg
          );

          return {
            messages: {
              ...state.messages,
              [channelId]: updatedMessages
            }
          };
        });
      },

      // Handle Message Deleted
      handleMessageDeleted: (messageId: string) => {
        set(state => {
          const newMessages: Record<string, Message[]> = {};
          
          Object.keys(state.messages).forEach(channelId => {
            newMessages[channelId] = state.messages[channelId].filter(
              msg => msg._id !== messageId
            );
          });

          return { messages: newMessages };
        });
      },

      // Handle Reaction Added
      handleReactionAdded: (messageId: string, emoji: string, userId: string) => {
        set(state => {
          const newMessages: Record<string, Message[]> = {};
          
          Object.keys(state.messages).forEach(channelId => {
            newMessages[channelId] = state.messages[channelId].map(msg => {
              if (msg._id !== messageId) return msg;
              
              const existingReaction = msg.reactions.find(r => r.emoji === emoji);
              
              if (existingReaction) {
                // Add user to existing reaction
                if (!existingReaction.users.includes(userId)) {
                  existingReaction.users.push(userId);
                  existingReaction.count = existingReaction.users.length;
                }
              } else {
                // Create new reaction
                msg.reactions.push({
                  emoji,
                  users: [userId],
                  count: 1,
                  createdAt: new Date().toISOString()
                });
              }
              
              return msg;
            });
          });

          return { messages: newMessages };
        });
      },

      // Handle Reaction Removed
      handleReactionRemoved: (messageId: string, emoji: string, userId: string) => {
        set(state => {
          const newMessages: Record<string, Message[]> = {};
          
          Object.keys(state.messages).forEach(channelId => {
            newMessages[channelId] = state.messages[channelId].map(msg => {
              if (msg._id !== messageId) return msg;
              
              msg.reactions = msg.reactions
                .map(reaction => {
                  if (reaction.emoji === emoji) {
                    reaction.users = reaction.users.filter(id => id !== userId);
                    reaction.count = reaction.users.length;
                  }
                  return reaction;
                })
                .filter(reaction => reaction.count > 0);
              
              return msg;
            });
          });

          return { messages: newMessages };
        });
      },

      // Handle User Typing
      handleUserTyping: (channelId: string, userId: string, username: string) => {
        set(state => {
          const currentTyping = state.typingUsers[channelId] || [];
          if (currentTyping.includes(userId)) return state;

          return {
            typingUsers: {
              ...state.typingUsers,
              [channelId]: [...currentTyping, userId]
            }
          };
        });

        // Auto-remove after 5 seconds
        setTimeout(() => {
          get().handleUserStoppedTyping(channelId, userId);
        }, 5000);
      },

      // Handle User Stopped Typing
      handleUserStoppedTyping: (channelId: string, userId: string) => {
        set(state => ({
          typingUsers: {
            ...state.typingUsers,
            [channelId]: (state.typingUsers[channelId] || []).filter(id => id !== userId)
          }
        }));
      },

      // Start Typing
      startTyping: (channelId: string) => {
        try {
          socketClient.startTyping(channelId);
        } catch (error) {
          console.warn('Failed to send typing indicator:', error);
        }
      },

      // Stop Typing
      stopTyping: (channelId: string) => {
        try {
          socketClient.stopTyping(channelId);
        } catch (error) {
          console.warn('Failed to stop typing indicator:', error);
        }
      },

      // Clear Error
      clearError: () => {
        set({ error: null });
      },

      // Set Error
      setError: (error: string) => {
        set({ error });
      },

      // Reset State
      reset: () => {
        set({
          channels: [],
          activeChannelId: null,
          messages: {},
          typingUsers: {},
          unreadCounts: {},
          isConnected: false,
          isLoading: false,
          error: null,
          messagesPagination: {}
        });
      }
    }),
    {
      name: 'chat-store',
    }
  )
);

// Selectors
export const selectChannels = (state: ChatState) => state.channels;
export const selectActiveChannel = (state: ChatState) => 
  state.channels.find(c => c._id === state.activeChannelId);
export const selectActiveChannelMessages = (state: ChatState) => 
  state.activeChannelId ? state.messages[state.activeChannelId] || [] : [];
export const selectChannelTypingUsers = (state: ChatState, channelId: string) => 
  state.typingUsers[channelId] || [];
export const selectUnreadCount = (state: ChatState, channelId: string) => 
  state.unreadCounts[channelId] || 0;