/**
 * Socket Client - The Real-time Bridge
 * 
 * WebSocket client service for real-time communication with the Viber backend.
 * Handles connection management, event listeners, and automatic reconnection.
 */

import * as socketIO from 'socket.io-client';
import { getWsUrl } from '../config/api';
import { SocketEvents, AuthTokens, Message, User } from '../types';
import { apiClient } from './apiClient';

const io = (socketIO as any).default || socketIO;
type Socket = any;

type EventCallback<T = any> = (data: T) => void;
type EventName = keyof SocketEvents;

class SocketClient {
  private socket: Socket | null = null;
  private eventListeners: Map<string, EventCallback[]> = new Map();
  private isConnecting = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second

  constructor() {
    // Setup will be done after connection
  }

  // Connection Management
  public async connect(tokens: AuthTokens): Promise<void> {
    if (this.socket?.connected || this.isConnecting) {
      console.log('🔌 Socket already connected or connecting');
      return;
    }

    this.isConnecting = true;

    try {
      console.log('🔌 Connecting to WebSocket...', getWsUrl());

      this.socket = io(getWsUrl(), {
        auth: {
          token: tokens.accessToken
        },
        transports: ['polling', 'websocket'],
        timeout: 10000,
        forceNew: true,
        autoConnect: true
      });

      await this.setupSocketEvents();
      this.isConnecting = false;
      this.reconnectAttempts = 0;

    } catch (error) {
      this.isConnecting = false;
      console.error('❌ Socket connection failed:', error);
      throw error;
    }
  }

  public disconnect(): void {
    if (this.socket) {
      console.log('🔌 Disconnecting from WebSocket...');
      this.socket.disconnect();
      this.socket = null;
    }
    this.eventListeners.clear();
    this.reconnectAttempts = 0;
  }

  private async setupSocketEvents(): Promise<void> {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket?.id);
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      this.emit('socket:connected', { socketId: this.socket?.id });
    });

    this.socket.on('connected', (data: SocketEvents['connected']) => {
      console.log('🎉 Socket authenticated:', data);
      this.emit('socket:authenticated', data);
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('🔌 Socket disconnected:', reason);
      this.emit('socket:disconnected', { reason });
      
      // Auto-reconnect if not intentional
      if (reason !== 'io client disconnect' && apiClient.isAuthenticated) {
        this.scheduleReconnect();
      }
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('❌ Socket connection error:', error);
      this.emit('socket:error', { error: error.message });
      
      if (apiClient.isAuthenticated) {
        this.scheduleReconnect();
      }
    });

    // Message events
    this.socket.on('message:new', (message: Message) => {
      console.log('💬 New message received:', message);
      this.emit('message:new', message);
    });

    this.socket.on('message:sent', (data: SocketEvents['message:sent']) => {
      console.log('✅ Message sent confirmed:', data);
      this.emit('message:sent', data);
    });

    this.socket.on('message:edited', (message: Message) => {
      console.log('✏️ Message edited:', message);
      this.emit('message:edited', message);
    });

    this.socket.on('message:deleted', (data: SocketEvents['message:deleted']) => {
      console.log('🗑️ Message deleted:', data);
      this.emit('message:deleted', data);
    });

    this.socket.on('message:reaction_added', (data: SocketEvents['message:reaction_added']) => {
      console.log('👍 Reaction added:', data);
      this.emit('message:reaction_added', data);
    });

    this.socket.on('message:reaction_removed', (data: SocketEvents['message:reaction_removed']) => {
      console.log('👍 Reaction removed:', data);
      this.emit('message:reaction_removed', data);
    });

    this.socket.on('message:read_receipt', (data: SocketEvents['message:read_receipt']) => {
      console.log('👁️ Read receipt:', data);
      this.emit('message:read_receipt', data);
    });

    // Typing events
    this.socket.on('user:typing', (data: SocketEvents['user:typing']) => {
      console.log('⌨️ User typing:', data);
      this.emit('user:typing', data);
    });

    this.socket.on('user:typing_stop', (data: SocketEvents['user:typing_stop']) => {
      console.log('⌨️ User stopped typing:', data);
      this.emit('user:typing_stop', data);
    });

    // Presence events
    this.socket.on('user:presence_update', (data: SocketEvents['user:presence_update']) => {
      console.log('👤 User presence updated:', data);
      this.emit('user:presence_update', data);
    });

    // Channel events
    this.socket.on('channel:joined', (data: SocketEvents['channel:joined']) => {
      console.log('🏠 Channel joined:', data);
      this.emit('channel:joined', data);
    });

    this.socket.on('channel:left', (data: SocketEvents['channel:left']) => {
      console.log('🏠 Channel left:', data);
      this.emit('channel:left', data);
    });

    this.socket.on('user:joined_channel', (data: SocketEvents['user:joined_channel']) => {
      console.log('👋 User joined channel:', data);
      this.emit('user:joined_channel', data);
    });

    this.socket.on('user:left_channel', (data: SocketEvents['user:left_channel']) => {
      console.log('👋 User left channel:', data);
      this.emit('user:left_channel', data);
    });

    // Error events
    this.socket.on('error', (data: { message: string; error?: string }) => {
      console.error('❌ Socket error:', data);
      this.emit('socket:error', data);
    });

    this.socket.on('message:error', (data: { message: string; error?: string }) => {
      console.error('❌ Message error:', data);
      this.emit('message:error', data);
    });

    this.socket.on('channel:error', (data: { message: string; error?: string }) => {
      console.error('❌ Channel error:', data);
      this.emit('channel:error', data);
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      this.emit('socket:max_reconnect_attempts');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`🔄 Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    setTimeout(async () => {
      if (apiClient.isAuthenticated && apiClient.currentTokens) {
        try {
          await this.connect(apiClient.currentTokens);
        } catch (error) {
          console.error('❌ Reconnection failed:', error);
        }
      }
    }, delay);
  }

  // Event Management
  public on<T = any>(event: string, callback: EventCallback<T>): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  public off(event: string, callback?: EventCallback): void {
    if (!this.eventListeners.has(event)) return;

    if (callback) {
      const listeners = this.eventListeners.get(event)!;
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    } else {
      this.eventListeners.delete(event);
    }
  }

  private emit<T = any>(event: string, data?: T): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`❌ Event listener error for ${event}:`, error);
        }
      });
    }
  }

  // Message Actions
  public sendMessage(data: {
    channelId: string;
    content: { text: string };
    type?: Message['type'];
    replyTo?: string;
  }): void {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected');
    }

    console.log('📤 Sending message via socket:', data);
    this.socket.emit('message:send', data);
  }

  public editMessage(data: {
    messageId: string;
    content: { text: string };
  }): void {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected');
    }

    console.log('✏️ Editing message via socket:', data);
    this.socket.emit('message:edit', data);
  }

  public deleteMessage(data: { messageId: string }): void {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected');
    }

    console.log('🗑️ Deleting message via socket:', data);
    this.socket.emit('message:delete', data);
  }

  public addReaction(data: {
    messageId: string;
    emoji: string;
  }): void {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected');
    }

    console.log('👍 Adding reaction via socket:', data);
    this.socket.emit('message:reaction', data);
  }

  // Typing Actions
  public startTyping(channelId: string): void {
    if (!this.socket?.connected) return;

    this.socket.emit('typing:start', { channelId });
  }

  public stopTyping(channelId: string): void {
    if (!this.socket?.connected) return;

    this.socket.emit('typing:stop', { channelId });
  }

  // Channel Actions
  public joinChannel(channelId: string): void {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected');
    }

    console.log('🏠 Joining channel via socket:', channelId);
    this.socket.emit('channel:join', { channelId });
  }

  public leaveChannel(channelId: string): void {
    if (!this.socket?.connected) return;

    console.log('🏠 Leaving channel via socket:', channelId);
    this.socket.emit('channel:leave', { channelId });
  }

  // Presence Actions
  public updatePresence(status: User['presence']['status']): void {
    if (!this.socket?.connected) return;

    console.log('👤 Updating presence via socket:', status);
    this.socket.emit('presence:update', { status });
  }

  // Message Status Actions
  public markMessageRead(data: { messageId: string; channelId: string }): void {
    if (!this.socket?.connected) return;

    this.socket.emit('message:read', data);
  }

  public markMessageDelivered(data: { messageId: string; channelId: string }): void {
    if (!this.socket?.connected) return;

    this.socket.emit('message:delivered', data);
  }

  // Status Getters
  public get isConnected(): boolean {
    return this.socket?.connected || false;
  }

  public get socketId(): string | undefined {
    return this.socket?.id;
  }

  public get connectionState(): string {
    if (this.isConnecting) return 'connecting';
    if (this.socket?.connected) return 'connected';
    if (this.socket?.disconnected) return 'disconnected';
    return 'idle';
  }
}

// Export singleton instance
export const socketClient = new SocketClient();
export default socketClient;