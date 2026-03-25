/**
 * Socket Service - The Real-time Conductor
 * 
 * Orchestrates real-time communication with elegant WebSocket management,
 * presence tracking, and event-driven messaging architecture.
 */

const jwt = require('jsonwebtoken');
const { User, Message, Channel } = require('../models');
const config = require('../config/environment');
const logger = require('../utils/logger');

class SocketService {
  constructor(io) {
    this.io = io;
    this.connectedUsers = new Map(); // userId -> Set of socketIds
    this.socketUsers = new Map();    // socketId -> userId
    this.userRooms = new Map();      // userId -> Set of channelIds
    this.typingUsers = new Map();    // channelId -> Set of userIds
    
    this.setupMiddleware();
    this.setupEventHandlers();
    this.startCleanupInterval();
  }

  /**
   * Setup authentication and middleware
   */
  setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth?.token || 
                     socket.handshake.query?.token;

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // Verify JWT token
        const decoded = jwt.verify(token, config.security.jwtSecret);
        
        // Fetch user from database
        const user = await User.findById(decoded.userId)
          .select('-passwordHash -refreshTokens -emailVerificationToken -passwordResetToken')
          .lean();

        if (!user || user.status !== 'active') {
          return next(new Error('Invalid user or account not active'));
        }

        // Attach user to socket
        socket.user = user;
        socket.userId = user._id.toString();
        
        logger.debug('Socket authenticated', {
          socketId: socket.id,
          userId: socket.userId,
          username: user.username
        });

        next();
      } catch (error) {
        logger.error('Socket authentication failed', {
          error: error.message,
          socketId: socket.id,
          ip: socket.handshake.address
        });
        next(new Error('Authentication failed'));
      }
    });

    // Rate limiting middleware
    this.io.use((socket, next) => {
      socket.rateLimit = {
        messages: { count: 0, resetTime: Date.now() + 60000 }, // 60 messages per minute
        joins: { count: 0, resetTime: Date.now() + 60000 },    // 60 joins per minute
        typing: { count: 0, resetTime: Date.now() + 10000 }     // 100 typing events per 10 seconds
      };
      next();
    });
  }

  /**
   * Setup main event handlers
   */
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });
  }

  /**
   * Handle new socket connection
   */
  async handleConnection(socket) {
    const userId = socket.userId;
    const user = socket.user;

    try {
      logger.info('User connected', {
        socketId: socket.id,
        userId: userId,
        username: user.username,
        ip: socket.handshake.address
      });

      // Track connection
      if (!this.connectedUsers.has(userId)) {
        this.connectedUsers.set(userId, new Set());
      }
      this.connectedUsers.get(userId).add(socket.id);
      this.socketUsers.set(socket.id, userId);

      // Update user presence
      await this.updateUserPresence(userId, 'online');

      // Join user's channels
      await this.joinUserChannels(socket);

      // Setup event listeners
      this.setupSocketEvents(socket);

      // Send connection confirmation
      socket.emit('connected', {
        message: 'Successfully connected to Viber',
        user: {
          id: user._id,
          username: user.username,
          profile: user.profile
        },
        timestamp: new Date().toISOString()
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        this.handleDisconnection(socket, reason);
      });

    } catch (error) {
      logger.error('Connection setup failed', {
        error: error.message,
        socketId: socket.id,
        userId: userId
      });
      socket.emit('error', {
        message: 'Connection setup failed',
        error: error.message
      });
    }
  }

  /**
   * Setup socket event listeners
   */
  setupSocketEvents(socket) {
    const userId = socket.userId;

    // Message events
    socket.on('message:send', (data) => this.handleSendMessage(socket, data));
    socket.on('message:edit', (data) => this.handleEditMessage(socket, data));
    socket.on('message:delete', (data) => this.handleDeleteMessage(socket, data));
    socket.on('message:reaction', (data) => this.handleMessageReaction(socket, data));

    // Typing events
    socket.on('typing:start', (data) => this.handleTypingStart(socket, data));
    socket.on('typing:stop', (data) => this.handleTypingStop(socket, data));

    // Channel events
    socket.on('channel:join', (data) => this.handleChannelJoin(socket, data));
    socket.on('channel:leave', (data) => this.handleChannelLeave(socket, data));

    // Presence events
    socket.on('presence:update', (data) => this.handlePresenceUpdate(socket, data));

    // Message status events
    socket.on('message:read', (data) => this.handleMessageRead(socket, data));
    socket.on('message:delivered', (data) => this.handleMessageDelivered(socket, data));

    // Call events (future implementation)
    socket.on('call:initiate', (data) => this.handleCallInitiate(socket, data));
    socket.on('call:accept', (data) => this.handleCallAccept(socket, data));
    socket.on('call:reject', (data) => this.handleCallReject(socket, data));
    socket.on('call:end', (data) => this.handleCallEnd(socket, data));

    // Error handling
    socket.on('error', (error) => {
      logger.error('Socket error', {
        error: error.message,
        socketId: socket.id,
        userId: userId
      });
    });
  }

  /**
   * Handle message sending
   */
  async handleSendMessage(socket, data) {
    try {
      if (!this.checkRateLimit(socket, 'messages')) {
        socket.emit('error', { message: 'Rate limit exceeded' });
        return;
      }

      const { channelId, content, type = 'text', replyTo } = data;

      // Validate required fields
      if (!channelId || (!content?.text && type === 'text')) {
        socket.emit('message:error', { message: 'Invalid message data' });
        return;
      }

      // Check channel access
      const channel = await this.checkChannelAccess(socket.userId, channelId);
      if (!channel) {
        socket.emit('message:error', { message: 'Channel access denied' });
        return;
      }

      // Create and save message
      const message = new Message({
        sender: socket.userId,
        channel: channelId,
        content: {
          text: content.text,
          formatting: content.formatting || [],
          entities: content.entities || { mentions: [], links: [], hashtags: [] }
        },
        type,
        replyTo,
        encryption: {
          enabled: channel.settings.encryption.enabled,
          algorithm: channel.settings.encryption.algorithm
        }
      });

      await message.save();

      // Populate for broadcasting
      await message.populate([
        {
          path: 'sender',
          select: 'username profile.displayName profile.avatar presence.status'
        },
        {
          path: 'replyTo',
          select: 'content.text sender createdAt',
          populate: {
            path: 'sender',
            select: 'username profile.displayName'
          }
        }
      ]);

      // Update channel stats
      channel.stats.messageCount += 1;
      channel.stats.lastActivity = new Date();
      channel.stats.lastMessage = {
        messageId: message._id,
        content: content.text || '[Media]',
        sender: socket.userId,
        timestamp: message.createdAt
      };
      await channel.save();

      // Broadcast to channel members
      socket.to(channelId).emit('message:new', message);
      socket.emit('message:sent', { 
        messageId: message._id, 
        timestamp: message.createdAt 
      });

      // Stop typing indicator for sender
      this.handleTypingStop(socket, { channelId });

      // Send push notifications (async)
      setImmediate(() => this.sendPushNotifications(message, channel));

      logger.debug('Message sent via socket', {
        messageId: message._id,
        userId: socket.userId,
        channelId,
        type: message.type
      });

    } catch (error) {
      logger.error('Socket send message error', {
        error: error.message,
        userId: socket.userId,
        data
      });
      socket.emit('message:error', { 
        message: 'Failed to send message',
        error: error.message 
      });
    }
  }

  /**
   * Handle typing indicators
   */
  async handleTypingStart(socket, data) {
    try {
      if (!this.checkRateLimit(socket, 'typing')) {
        return; // Silently ignore rate limit for typing
      }

      const { channelId } = data;
      
      if (!channelId) return;

      // Check channel access
      const hasAccess = await this.checkChannelAccess(socket.userId, channelId);
      if (!hasAccess) return;

      // Track typing user
      if (!this.typingUsers.has(channelId)) {
        this.typingUsers.set(channelId, new Set());
      }
      this.typingUsers.get(channelId).add(socket.userId);

      // Broadcast typing indicator
      socket.to(channelId).emit('user:typing', {
        userId: socket.userId,
        username: socket.user.username,
        channelId,
        timestamp: new Date().toISOString()
      });

      // Auto-stop typing after 5 seconds
      setTimeout(() => {
        this.handleTypingStop(socket, { channelId }, false);
      }, 5000);

    } catch (error) {
      logger.error('Typing start error', {
        error: error.message,
        userId: socket.userId,
        channelId: data.channelId
      });
    }
  }

  /**
   * Handle typing stop
   */
  async handleTypingStop(socket, data, broadcast = true) {
    try {
      const { channelId } = data;
      
      if (!channelId) return;

      // Remove from typing users
      if (this.typingUsers.has(channelId)) {
        this.typingUsers.get(channelId).delete(socket.userId);
        
        // Clean up empty sets
        if (this.typingUsers.get(channelId).size === 0) {
          this.typingUsers.delete(channelId);
        }
      }

      // Broadcast stop typing if needed
      if (broadcast) {
        socket.to(channelId).emit('user:typing_stop', {
          userId: socket.userId,
          channelId,
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      logger.error('Typing stop error', {
        error: error.message,
        userId: socket.userId,
        channelId: data.channelId
      });
    }
  }

  /**
   * Handle channel join
   */
  async handleChannelJoin(socket, data) {
    try {
      if (!this.checkRateLimit(socket, 'joins')) {
        socket.emit('error', { message: 'Rate limit exceeded' });
        return;
      }

      const { channelId } = data;
      
      if (!channelId) {
        socket.emit('channel:error', { message: 'Channel ID required' });
        return;
      }

      // Check channel access
      const channel = await this.checkChannelAccess(socket.userId, channelId);
      if (!channel) {
        socket.emit('channel:error', { message: 'Channel access denied' });
        return;
      }

      // Join socket room
      socket.join(channelId);

      // Track user rooms
      if (!this.userRooms.has(socket.userId)) {
        this.userRooms.set(socket.userId, new Set());
      }
      this.userRooms.get(socket.userId).add(channelId);

      socket.emit('channel:joined', {
        channelId,
        channelName: channel.name,
        memberCount: channel.members.length,
        timestamp: new Date().toISOString()
      });

      // Notify other channel members
      socket.to(channelId).emit('user:joined_channel', {
        userId: socket.userId,
        username: socket.user.username,
        channelId,
        timestamp: new Date().toISOString()
      });

      logger.debug('User joined channel', {
        userId: socket.userId,
        channelId,
        channelName: channel.name
      });

    } catch (error) {
      logger.error('Channel join error', {
        error: error.message,
        userId: socket.userId,
        channelId: data.channelId
      });
      socket.emit('channel:error', { 
        message: 'Failed to join channel',
        error: error.message 
      });
    }
  }

  /**
   * Handle channel leave
   */
  async handleChannelLeave(socket, data) {
    try {
      const { channelId } = data;
      
      if (!channelId) return;

      // Leave socket room
      socket.leave(channelId);

      // Remove from user rooms
      if (this.userRooms.has(socket.userId)) {
        this.userRooms.get(socket.userId).delete(channelId);
      }

      // Stop typing in this channel
      this.handleTypingStop(socket, { channelId }, true);

      socket.emit('channel:left', {
        channelId,
        timestamp: new Date().toISOString()
      });

      // Notify other channel members
      socket.to(channelId).emit('user:left_channel', {
        userId: socket.userId,
        username: socket.user.username,
        channelId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Channel leave error', {
        error: error.message,
        userId: socket.userId,
        channelId: data.channelId
      });
    }
  }

  /**
   * Handle message read receipts
   */
  async handleMessageRead(socket, data) {
    try {
      const { messageId, channelId } = data;
      
      if (!messageId || !channelId) return;

      // Update message read status
      const message = await Message.findByIdAndUpdate(
        messageId,
        {
          $addToSet: {
            'delivery.readBy': {
              user: socket.userId,
              readAt: new Date()
            }
          }
        },
        { new: true }
      );

      if (message) {
        // Update channel member last read
        await Channel.updateOne(
          { 
            _id: channelId,
            'members.user': socket.userId 
          },
          { 
            $set: { 'members.$.lastReadAt': new Date() }
          }
        );

        // Notify message sender about read receipt
        const senderSockets = this.connectedUsers.get(message.sender.toString());
        if (senderSockets) {
          senderSockets.forEach(socketId => {
            this.io.to(socketId).emit('message:read_receipt', {
              messageId,
              readBy: socket.userId,
              readAt: new Date().toISOString()
            });
          });
        }
      }

    } catch (error) {
      logger.error('Message read error', {
        error: error.message,
        userId: socket.userId,
        messageId: data.messageId
      });
    }
  }

  /**
   * Handle presence updates
   */
  async handlePresenceUpdate(socket, data) {
    try {
      const { status } = data;
      
      if (!['online', 'away', 'busy', 'invisible'].includes(status)) {
        socket.emit('error', { message: 'Invalid presence status' });
        return;
      }

      await this.updateUserPresence(socket.userId, status);

      // Broadcast presence update to user's contacts
      const user = await User.findById(socket.userId)
        .populate('contacts.user', '_id')
        .lean();

      if (user) {
        user.contacts.forEach(contact => {
          const contactSockets = this.connectedUsers.get(contact.user._id.toString());
          if (contactSockets) {
            contactSockets.forEach(socketId => {
              this.io.to(socketId).emit('user:presence_update', {
                userId: socket.userId,
                status,
                timestamp: new Date().toISOString()
              });
            });
          }
        });
      }

    } catch (error) {
      logger.error('Presence update error', {
        error: error.message,
        userId: socket.userId,
        status: data.status
      });
    }
  }

  /**
   * Handle disconnection
   */
  async handleDisconnection(socket, reason) {
    const userId = socket.userId;
    
    try {
      logger.info('User disconnected', {
        socketId: socket.id,
        userId: userId,
        reason
      });

      // Remove from tracking maps
      if (this.connectedUsers.has(userId)) {
        this.connectedUsers.get(userId).delete(socket.id);
        if (this.connectedUsers.get(userId).size === 0) {
          this.connectedUsers.delete(userId);
          
          // Update presence to offline if no more connections
          await this.updateUserPresence(userId, 'offline');
        }
      }
      this.socketUsers.delete(socket.id);

      // Clean up typing indicators
      this.typingUsers.forEach((users, channelId) => {
        if (users.has(userId)) {
          users.delete(userId);
          socket.to(channelId).emit('user:typing_stop', {
            userId: userId,
            channelId,
            timestamp: new Date().toISOString()
          });
        }
      });

      // Clean up user rooms
      this.userRooms.delete(userId);

    } catch (error) {
      logger.error('Disconnection cleanup error', {
        error: error.message,
        socketId: socket.id,
        userId: userId
      });
    }
  }

  /**
   * Helper Methods
   */

  async joinUserChannels(socket) {
    try {
      const channels = await Channel.find({
        'members.user': socket.userId,
        'members.status': 'active',
        status: 'active'
      }).select('_id name');

      const channelIds = channels.map(c => c._id.toString());
      
      // Join all channels
      channelIds.forEach(channelId => {
        socket.join(channelId);
      });

      // Track user rooms
      this.userRooms.set(socket.userId, new Set(channelIds));

      logger.debug('User joined channels', {
        userId: socket.userId,
        channelCount: channelIds.length
      });

    } catch (error) {
      logger.error('Join user channels error', {
        error: error.message,
        userId: socket.userId
      });
    }
  }

  async checkChannelAccess(userId, channelId) {
    try {
      const channel = await Channel.findOne({
        _id: channelId,
        'members.user': userId,
        'members.status': 'active',
        status: 'active'
      });
      return channel;
    } catch (error) {
      logger.error('Channel access check error', {
        error: error.message,
        userId,
        channelId
      });
      return null;
    }
  }

  async updateUserPresence(userId, status) {
    try {
      await User.findByIdAndUpdate(userId, {
        'presence.status': status,
        'presence.lastSeen': new Date()
      });
    } catch (error) {
      logger.error('Update presence error', {
        error: error.message,
        userId,
        status
      });
    }
  }

  checkRateLimit(socket, type) {
    const limit = socket.rateLimit[type];
    const now = Date.now();

    if (now > limit.resetTime) {
      limit.count = 0;
      limit.resetTime = now + (type === 'typing' ? 10000 : 60000);
    }

    const maxLimits = {
      messages: 60,
      joins: 60,
      typing: 100
    };

    if (limit.count >= maxLimits[type]) {
      return false;
    }

    limit.count++;
    return true;
  }

  async sendPushNotifications(message, channel) {
    // TODO: Implement push notification service
    // This would send notifications to offline users
    logger.debug('Push notification triggered', {
      messageId: message._id,
      channelId: channel._id
    });
  }

  startCleanupInterval() {
    // Clean up every 5 minutes
    setInterval(() => {
      this.cleanupDisconnectedUsers();
    }, 5 * 60 * 1000);
  }

  cleanupDisconnectedUsers() {
    // Remove empty typing user sets
    this.typingUsers.forEach((users, channelId) => {
      if (users.size === 0) {
        this.typingUsers.delete(channelId);
      }
    });

    logger.debug('Socket cleanup completed', {
      connectedUsers: this.connectedUsers.size,
      typingChannels: this.typingUsers.size
    });
  }

  // Public methods for external use
  
  getUserSocketIds(userId) {
    return Array.from(this.connectedUsers.get(userId) || []);
  }

  isUserOnline(userId) {
    return this.connectedUsers.has(userId);
  }

  getChannelMemberCount(channelId) {
    const room = this.io.sockets.adapter.rooms.get(channelId);
    return room ? room.size : 0;
  }

  broadcastToChannel(channelId, event, data) {
    this.io.to(channelId).emit(event, data);
  }

  sendToUser(userId, event, data) {
    const socketIds = this.getUserSocketIds(userId);
    socketIds.forEach(socketId => {
      this.io.to(socketId).emit(event, data);
    });
  }
}

module.exports = SocketService;