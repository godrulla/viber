/**
 * Message Routes - The Channels of Communication
 * 
 * RESTful endpoints for message management, threading, reactions,
 * and real-time messaging functionality.
 */

const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const mongoose = require('mongoose');

const { Message, Channel, User } = require('../models');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');
const { ErrorTransformer } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * Validation Rules
 */
const sendMessageValidation = [
  body('channelId')
    .isMongoId()
    .withMessage('Valid channel ID is required'),
  
  body('content.text')
    .optional()
    .isLength({ min: 1, max: 4000 })
    .withMessage('Message text must be 1-4000 characters'),
  
  body('type')
    .optional()
    .isIn(['text', 'media', 'system', 'call', 'location', 'contact', 'poll'])
    .withMessage('Invalid message type'),
  
  body('replyTo')
    .optional()
    .isMongoId()
    .withMessage('Reply message ID must be valid'),
  
  body('scheduledFor')
    .optional()
    .isISO8601()
    .withMessage('Scheduled time must be valid ISO date'),
  
  body('priority')
    .optional()
    .isIn(['low', 'normal', 'high', 'urgent'])
    .withMessage('Invalid priority level')
];

const getMessagesValidation = [
  param('channelId')
    .isMongoId()
    .withMessage('Valid channel ID is required'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('before')
    .optional()
    .isISO8601()
    .withMessage('Before timestamp must be valid ISO date'),
  
  query('after')
    .optional()
    .isISO8601()
    .withMessage('After timestamp must be valid ISO date')
];

const searchMessagesValidation = [
  param('channelId')
    .isMongoId()
    .withMessage('Valid channel ID is required'),
  
  query('q')
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be 1-100 characters'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
];

/**
 * Helper Functions
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation Failed',
      message: 'Please check your input data',
      details: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      })),
      timestamp: new Date().toISOString()
    });
  }
  next();
};

const checkChannelAccess = async (req, res, next) => {
  try {
    const channelId = req.params.channelId || req.body.channelId;
    const userId = req.user._id;

    const channel = await Channel.findOne({
      _id: channelId,
      status: 'active',
      deletedAt: { $exists: false }
    });

    if (!channel) {
      return res.status(404).json({
        error: 'Channel Not Found',
        message: 'The requested channel does not exist',
        timestamp: new Date().toISOString()
      });
    }

    // Check if user is a member of the channel
    const member = channel.members.find(
      m => m.user.toString() === userId.toString() && m.status === 'active'
    );

    if (!member) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You are not a member of this channel',
        timestamp: new Date().toISOString()
      });
    }

    // Attach channel and member info to request
    req.channel = channel;
    req.member = member;
    
    next();
  } catch (error) {
    logger.error('Channel access check failed', { 
      error: error.message,
      channelId: req.params.channelId || req.body.channelId,
      userId: req.user?._id
    });
    next(error);
  }
};

const checkMessagePermissions = (action) => {
  return (req, res, next) => {
    const member = req.member;
    
    // Define permission requirements
    const permissionMap = {
      'send': ['send_messages'],
      'send_media': ['send_messages', 'send_media'],
      'manage': ['manage_messages'],
      'delete': ['manage_messages']
    };

    const requiredPermissions = permissionMap[action] || [];
    
    // Check role-based permissions
    const rolePermissions = {
      'owner': ['read_messages', 'send_messages', 'send_media', 'manage_messages', 'manage_members'],
      'admin': ['read_messages', 'send_messages', 'send_media', 'manage_messages'],
      'moderator': ['read_messages', 'send_messages', 'send_media', 'manage_messages'],
      'member': ['read_messages', 'send_messages', 'send_media'],
      'restricted': ['read_messages']
    };

    const userPermissions = rolePermissions[member.role] || [];
    const hasPermission = requiredPermissions.every(perm => 
      userPermissions.includes(perm) || member.permissions?.includes(perm)
    );

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Insufficient Permissions',
        message: `You don't have permission to ${action} messages in this channel`,
        required: requiredPermissions,
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
};

/**
 * @route   POST /messages
 * @desc    Send a new message
 * @access  Private
 */
router.post('/', 
  authMiddleware.verify,
  sendMessageValidation,
  handleValidationErrors,
  checkChannelAccess,
  checkMessagePermissions('send'),
  async (req, res, next) => {
    try {
      const {
        channelId,
        content,
        type = 'text',
        replyTo,
        scheduledFor,
        priority = 'normal',
        media = { hasMedia: false, attachments: [] }
      } = req.body;

      logger.info('Sending message', {
        userId: req.user._id,
        username: req.user.username,
        channelId,
        type,
        hasReply: !!replyTo,
        scheduled: !!scheduledFor
      });

      // Validate content based on type
      if (type === 'text' && !content?.text && !media.hasMedia) {
        return res.status(400).json({
          error: 'Invalid Content',
          message: 'Text messages must have content or media attachments',
          timestamp: new Date().toISOString()
        });
      }

      // Check if replying to a valid message
      let replyToMessage = null;
      if (replyTo) {
        replyToMessage = await Message.findOne({
          _id: replyTo,
          channel: channelId,
          'state.isDeleted': { $ne: true }
        });

        if (!replyToMessage) {
          return res.status(400).json({
            error: 'Invalid Reply',
            message: 'Cannot reply to non-existent or deleted message',
            timestamp: new Date().toISOString()
          });
        }
      }

      // Create message
      const message = new Message({
        sender: req.user._id,
        channel: channelId,
        content: {
          text: content?.text,
          formatting: content?.formatting || [],
          entities: content?.entities || { mentions: [], links: [], hashtags: [] }
        },
        media,
        type,
        replyTo,
        threadRoot: replyToMessage?.threadRoot || replyTo,
        priority,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
        encryption: {
          enabled: req.channel.settings.encryption.enabled,
          algorithm: req.channel.settings.encryption.algorithm
        }
      });

      // Process mentions and extract entities
      if (content?.text) {
        await message.processMentions(content.text);
        await message.extractEntities(content.text);
      }

      await message.save();

      // Update channel statistics
      req.channel.stats.messageCount += 1;
      req.channel.stats.lastActivity = new Date();
      req.channel.stats.lastMessage = {
        messageId: message._id,
        content: content?.text || '[Media]',
        sender: req.user._id,
        timestamp: message.createdAt
      };
      await req.channel.save();

      // Populate message for response
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

      logger.info('Message sent successfully', {
        messageId: message._id,
        userId: req.user._id,
        channelId,
        type: message.type
      });

      // TODO: Emit real-time event to channel members
      // req.io.to(channelId).emit('message:new', message);

      // TODO: Send push notifications
      // await notificationService.sendMessageNotification(message, req.channel);

      res.status(201).json({
        message: 'Message sent successfully',
        data: message,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Send message error', {
        error: error.message,
        stack: error.stack,
        userId: req.user?._id,
        channelId: req.body.channelId
      });
      next(error);
    }
  }
);

/**
 * @route   GET /messages/:channelId
 * @desc    Get messages from a channel
 * @access  Private
 */
router.get('/:channelId',
  authMiddleware.verify,
  getMessagesValidation,
  handleValidationErrors,
  checkChannelAccess,
  async (req, res, next) => {
    try {
      const { channelId } = req.params;
      const { 
        limit = 50, 
        before, 
        after, 
        type 
      } = req.query;

      logger.debug('Fetching messages', {
        userId: req.user._id,
        channelId,
        limit: parseInt(limit),
        before,
        after
      });

      // Build query
      const query = {
        channel: channelId,
        'state.isDeleted': { $ne: true }
      };

      if (before) {
        query.createdAt = { ...query.createdAt, $lt: new Date(before) };
      }

      if (after) {
        query.createdAt = { ...query.createdAt, $gt: new Date(after) };
      }

      if (type) {
        query.type = type;
      }

      // Get messages with pagination
      const messages = await Message.find(query)
        .populate('sender', 'username profile.displayName profile.avatar presence.status')
        .populate({
          path: 'replyTo',
          select: 'content.text sender createdAt type',
          populate: {
            path: 'sender',
            select: 'username profile.displayName'
          }
        })
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .lean();

      // Mark messages as read for this user
      const unreadMessageIds = messages
        .filter(msg => !msg.delivery.readBy?.some(
          read => read.user.toString() === req.user._id.toString()
        ))
        .map(msg => msg._id);

      if (unreadMessageIds.length > 0) {
        await Message.updateMany(
          { _id: { $in: unreadMessageIds } },
          { 
            $push: { 
              'delivery.readBy': {
                user: req.user._id,
                readAt: new Date()
              }
            }
          }
        );
      }

      // Update member's last read timestamp
      req.member.lastReadAt = new Date();
      await req.channel.save();

      res.json({
        messages: messages.reverse(), // Return in chronological order
        pagination: {
          limit: parseInt(limit),
          hasMore: messages.length === parseInt(limit),
          before: messages.length > 0 ? messages[0].createdAt : null,
          after: messages.length > 0 ? messages[messages.length - 1].createdAt : null
        },
        channel: {
          id: req.channel._id,
          name: req.channel.name,
          type: req.channel.type
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Get messages error', {
        error: error.message,
        userId: req.user?._id,
        channelId: req.params.channelId
      });
      next(error);
    }
  }
);

/**
 * @route   GET /messages/:channelId/search
 * @desc    Search messages in a channel
 * @access  Private
 */
router.get('/:channelId/search',
  authMiddleware.verify,
  searchMessagesValidation,
  handleValidationErrors,
  checkChannelAccess,
  async (req, res, next) => {
    try {
      const { channelId } = req.params;
      const { q, limit = 20 } = req.query;

      logger.debug('Searching messages', {
        userId: req.user._id,
        channelId,
        query: q,
        limit: parseInt(limit)
      });

      const messages = await Message.search(channelId, q, parseInt(limit));

      res.json({
        messages,
        query: q,
        resultCount: messages.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Search messages error', {
        error: error.message,
        userId: req.user?._id,
        channelId: req.params.channelId,
        query: req.query.q
      });
      next(error);
    }
  }
);

/**
 * @route   GET /messages/:messageId/thread
 * @desc    Get thread messages for a message
 * @access  Private
 */
router.get('/:messageId/thread',
  authMiddleware.verify,
  [param('messageId').isMongoId().withMessage('Valid message ID is required')],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { messageId } = req.params;

      // Find the root message first
      const rootMessage = await Message.findById(messageId)
        .populate('channel', '_id name type members');

      if (!rootMessage) {
        return res.status(404).json({
          error: 'Message Not Found',
          message: 'The requested message does not exist',
          timestamp: new Date().toISOString()
        });
      }

      // Check channel access
      const channel = rootMessage.channel;
      const isMember = channel.members.some(
        m => m.user.toString() === req.user._id.toString() && m.status === 'active'
      );

      if (!isMember) {
        return res.status(403).json({
          error: 'Access Denied',
          message: 'You are not a member of this channel',
          timestamp: new Date().toISOString()
        });
      }

      // Get thread messages
      const threadMessages = await Message.findThread(messageId);

      res.json({
        thread: threadMessages,
        rootMessage: rootMessage,
        threadCount: threadMessages.length - 1, // Exclude root message
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Get thread error', {
        error: error.message,
        userId: req.user?._id,
        messageId: req.params.messageId
      });
      next(error);
    }
  }
);

/**
 * @route   PUT /messages/:messageId
 * @desc    Edit a message
 * @access  Private
 */
router.put('/:messageId',
  authMiddleware.verify,
  [
    param('messageId').isMongoId().withMessage('Valid message ID is required'),
    body('content.text').isLength({ min: 1, max: 4000 }).withMessage('Message text must be 1-4000 characters')
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { messageId } = req.params;
      const { content } = req.body;

      const message = await Message.findOne({
        _id: messageId,
        'state.isDeleted': { $ne: true }
      }).populate('channel', 'members settings');

      if (!message) {
        return res.status(404).json({
          error: 'Message Not Found',
          message: 'The requested message does not exist or has been deleted',
          timestamp: new Date().toISOString()
        });
      }

      // Check if user can edit this message
      const isOwner = message.sender.toString() === req.user._id.toString();
      const channel = message.channel;
      const member = channel.members.find(
        m => m.user.toString() === req.user._id.toString()
      );

      const canManageMessages = member && 
        ['owner', 'admin', 'moderator'].includes(member.role);

      if (!isOwner && !canManageMessages) {
        return res.status(403).json({
          error: 'Access Denied',
          message: 'You can only edit your own messages',
          timestamp: new Date().toISOString()
        });
      }

      // Check if editing is allowed in channel
      if (!channel.settings.allowEditing && !canManageMessages) {
        return res.status(403).json({
          error: 'Editing Disabled',
          message: 'Message editing is not allowed in this channel',
          timestamp: new Date().toISOString()
        });
      }

      // Check edit time limit (e.g., 5 minutes for regular users)
      const editTimeLimit = 5 * 60 * 1000; // 5 minutes
      const messageAge = Date.now() - message.createdAt.getTime();
      
      if (!canManageMessages && messageAge > editTimeLimit) {
        return res.status(403).json({
          error: 'Edit Time Expired',
          message: 'Messages can only be edited within 5 minutes of posting',
          timestamp: new Date().toISOString()
        });
      }

      // Update message
      await message.edit(content.text, req.user._id);
      
      await message.populate('sender', 'username profile.displayName profile.avatar');

      logger.info('Message edited successfully', {
        messageId: message._id,
        editorId: req.user._id,
        originalSender: message.sender._id,
        channelId: message.channel._id
      });

      // TODO: Emit real-time event
      // req.io.to(message.channel._id).emit('message:edited', message);

      res.json({
        message: 'Message edited successfully',
        data: message,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Edit message error', {
        error: error.message,
        userId: req.user?._id,
        messageId: req.params.messageId
      });
      next(error);
    }
  }
);

/**
 * @route   DELETE /messages/:messageId
 * @desc    Delete a message
 * @access  Private
 */
router.delete('/:messageId',
  authMiddleware.verify,
  [param('messageId').isMongoId().withMessage('Valid message ID is required')],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { messageId } = req.params;

      const message = await Message.findOne({
        _id: messageId,
        'state.isDeleted': { $ne: true }
      }).populate('channel', 'members settings');

      if (!message) {
        return res.status(404).json({
          error: 'Message Not Found',
          message: 'The requested message does not exist or has been deleted',
          timestamp: new Date().toISOString()
        });
      }

      // Check if user can delete this message
      const isOwner = message.sender.toString() === req.user._id.toString();
      const channel = message.channel;
      const member = channel.members.find(
        m => m.user.toString() === req.user._id.toString()
      );

      const canManageMessages = member && 
        ['owner', 'admin', 'moderator'].includes(member.role);

      if (!isOwner && !canManageMessages) {
        return res.status(403).json({
          error: 'Access Denied',
          message: 'You can only delete your own messages',
          timestamp: new Date().toISOString()
        });
      }

      // Check if deletion is allowed in channel
      if (!channel.settings.allowDeletion && !canManageMessages) {
        return res.status(403).json({
          error: 'Deletion Disabled',
          message: 'Message deletion is not allowed in this channel',
          timestamp: new Date().toISOString()
        });
      }

      // Soft delete the message
      await message.softDelete(req.user._id);

      // Update channel stats
      channel.stats.messageCount = Math.max(0, channel.stats.messageCount - 1);
      await channel.save();

      logger.info('Message deleted successfully', {
        messageId: message._id,
        deleterId: req.user._id,
        originalSender: message.sender,
        channelId: message.channel._id
      });

      // TODO: Emit real-time event
      // req.io.to(message.channel._id).emit('message:deleted', { messageId });

      res.json({
        message: 'Message deleted successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Delete message error', {
        error: error.message,
        userId: req.user?._id,
        messageId: req.params.messageId
      });
      next(error);
    }
  }
);

/**
 * @route   POST /messages/:messageId/reactions
 * @desc    Add reaction to a message
 * @access  Private
 */
router.post('/:messageId/reactions',
  authMiddleware.verify,
  [
    param('messageId').isMongoId().withMessage('Valid message ID is required'),
    body('emoji').isLength({ min: 1, max: 10 }).withMessage('Emoji is required and must be 1-10 characters')
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { messageId } = req.params;
      const { emoji } = req.body;

      const message = await Message.findOne({
        _id: messageId,
        'state.isDeleted': { $ne: true }
      }).populate('channel', 'members settings');

      if (!message) {
        return res.status(404).json({
          error: 'Message Not Found',
          message: 'The requested message does not exist',
          timestamp: new Date().toISOString()
        });
      }

      // Check channel access
      const channel = message.channel;
      const isMember = channel.members.some(
        m => m.user.toString() === req.user._id.toString() && m.status === 'active'
      );

      if (!isMember) {
        return res.status(403).json({
          error: 'Access Denied',
          message: 'You are not a member of this channel',
          timestamp: new Date().toISOString()
        });
      }

      // Check if reactions are enabled
      if (!channel.settings.reactions) {
        return res.status(403).json({
          error: 'Reactions Disabled',
          message: 'Reactions are not enabled in this channel',
          timestamp: new Date().toISOString()
        });
      }

      await message.addReaction(emoji, req.user._id);

      logger.debug('Reaction added', {
        messageId,
        userId: req.user._id,
        emoji
      });

      // TODO: Emit real-time event
      // req.io.to(message.channel._id).emit('message:reaction_added', {
      //   messageId,
      //   emoji,
      //   userId: req.user._id
      // });

      res.json({
        message: 'Reaction added successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Add reaction error', {
        error: error.message,
        userId: req.user?._id,
        messageId: req.params.messageId
      });
      next(error);
    }
  }
);

/**
 * @route   DELETE /messages/:messageId/reactions/:emoji
 * @desc    Remove reaction from a message
 * @access  Private
 */
router.delete('/:messageId/reactions/:emoji',
  authMiddleware.verify,
  [
    param('messageId').isMongoId().withMessage('Valid message ID is required'),
    param('emoji').isLength({ min: 1, max: 10 }).withMessage('Valid emoji is required')
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { messageId, emoji } = req.params;

      const message = await Message.findById(messageId)
        .populate('channel', 'members');

      if (!message) {
        return res.status(404).json({
          error: 'Message Not Found',
          message: 'The requested message does not exist',
          timestamp: new Date().toISOString()
        });
      }

      // Check channel access
      const channel = message.channel;
      const isMember = channel.members.some(
        m => m.user.toString() === req.user._id.toString() && m.status === 'active'
      );

      if (!isMember) {
        return res.status(403).json({
          error: 'Access Denied',
          message: 'You are not a member of this channel',
          timestamp: new Date().toISOString()
        });
      }

      await message.removeReaction(emoji, req.user._id);

      logger.debug('Reaction removed', {
        messageId,
        userId: req.user._id,
        emoji
      });

      // TODO: Emit real-time event
      // req.io.to(message.channel._id).emit('message:reaction_removed', {
      //   messageId,
      //   emoji,
      //   userId: req.user._id
      // });

      res.json({
        message: 'Reaction removed successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Remove reaction error', {
        error: error.message,
        userId: req.user?._id,
        messageId: req.params.messageId
      });
      next(error);
    }
  }
);

module.exports = router;