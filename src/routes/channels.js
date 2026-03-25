/**
 * Channel Routes - The Builders of Communities
 * 
 * RESTful endpoints for channel creation, management, member administration,
 * and community features with comprehensive access control.
 */

const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const mongoose = require('mongoose');

const { Channel, User, Message } = require('../models');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');
const { ErrorTransformer } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * Validation Rules
 */
const createChannelValidation = [
  body('name')
    .isLength({ min: 1, max: 100 })
    .withMessage('Channel name must be 1-100 characters'),
  
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  
  body('type')
    .isIn(['direct', 'group', 'public', 'private', 'broadcast'])
    .withMessage('Invalid channel type'),
  
  body('privacy.isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be boolean'),
  
  body('members')
    .optional()
    .isArray()
    .withMessage('Members must be an array')
];

const updateChannelValidation = [
  body('name')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Channel name must be 1-100 characters'),
  
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  
  body('privacy')
    .optional()
    .isObject()
    .withMessage('Privacy must be an object')
];

const inviteMemberValidation = [
  body('userId')
    .optional()
    .isMongoId()
    .withMessage('Valid user ID is required'),
  
  body('email')
    .optional()
    .isEmail()
    .withMessage('Valid email is required'),
  
  body('role')
    .optional()
    .isIn(['member', 'moderator', 'admin'])
    .withMessage('Invalid role')
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
    const channelId = req.params.channelId || req.params.id;
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

    // Check if user is a member or channel is public
    const member = channel.members.find(
      m => m.user.toString() === userId.toString() && m.status === 'active'
    );

    if (!member && !channel.privacy.isPublic) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You are not a member of this channel',
        timestamp: new Date().toISOString()
      });
    }

    req.channel = channel;
    req.member = member;
    
    next();
  } catch (error) {
    logger.error('Channel access check failed', { 
      error: error.message,
      channelId: req.params.channelId || req.params.id,
      userId: req.user?._id
    });
    next(error);
  }
};

const requireChannelRole = (roles) => {
  const requiredRoles = Array.isArray(roles) ? roles : [roles];
  
  return (req, res, next) => {
    if (!req.member) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'You are not a member of this channel',
        timestamp: new Date().toISOString()
      });
    }

    if (!requiredRoles.includes(req.member.role)) {
      return res.status(403).json({
        error: 'Insufficient Permissions',
        message: `Required role: ${requiredRoles.join(' or ')}`,
        userRole: req.member.role,
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
};

/**
 * @route   POST /channels
 * @desc    Create a new channel
 * @access  Private
 */
router.post('/',
  authMiddleware.verify,
  createChannelValidation,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const {
        name,
        description,
        type,
        privacy = {},
        members = [],
        settings = {}
      } = req.body;

      logger.info('Creating new channel', {
        userId: req.user._id,
        username: req.user.username,
        channelName: name,
        type
      });

      // For direct messages, validate exactly 2 members
      if (type === 'direct') {
        if (members.length !== 1) {
          return res.status(400).json({
            error: 'Invalid Members',
            message: 'Direct messages must have exactly one other member',
            timestamp: new Date().toISOString()
          });
        }

        // Check if direct message already exists
        const existingDM = await Channel.getDirectMessage(
          req.user._id, 
          members[0]
        );

        if (existingDM) {
          return res.status(409).json({
            error: 'Channel Exists',
            message: 'Direct message already exists with this user',
            existingChannel: existingDM,
            timestamp: new Date().toISOString()
          });
        }
      }

      // Create channel
      const channel = new Channel({
        name: type === 'direct' ? `DM-${req.user._id}-${members[0]}` : name,
        description,
        type,
        privacy: {
          isPublic: privacy.isPublic || false,
          requiresApproval: privacy.requiresApproval || false,
          allowInvites: privacy.allowInvites !== false,
          searchable: privacy.searchable !== false
        },
        settings: {
          allowEditing: settings.allowEditing !== false,
          allowDeletion: settings.allowDeletion !== false,
          allowMedia: settings.allowMedia !== false,
          allowVoice: settings.allowVoice !== false,
          threading: settings.threading !== false,
          reactions: settings.reactions !== false,
          encryption: {
            enabled: settings.encryption?.enabled !== false,
            algorithm: settings.encryption?.algorithm || 'aes-256-gcm'
          }
        }
      });

      // Add creator as owner
      channel.members.push({
        user: req.user._id,
        role: 'owner',
        joinedAt: new Date(),
        status: 'active'
      });

      // Add other members
      for (const memberId of members) {
        // Validate member exists
        const memberUser = await User.findById(memberId);
        if (!memberUser) {
          return res.status(400).json({
            error: 'Invalid Member',
            message: `User ${memberId} not found`,
            timestamp: new Date().toISOString()
          });
        }

        channel.members.push({
          user: memberId,
          role: type === 'direct' ? 'member' : 'member',
          joinedAt: new Date(),
          invitedBy: req.user._id,
          status: 'active'
        });
      }

      await channel.save();

      // Populate for response
      await channel.populate('members.user', 'username profile.displayName profile.avatar presence.status');

      logger.info('Channel created successfully', {
        channelId: channel._id,
        creatorId: req.user._id,
        memberCount: channel.members.length,
        type: channel.type
      });

      res.status(201).json({
        message: 'Channel created successfully',
        channel: channel,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Create channel error', {
        error: error.message,
        stack: error.stack,
        userId: req.user?._id,
        channelData: req.body
      });
      next(error);
    }
  }
);

/**
 * @route   GET /channels
 * @desc    Get user's channels
 * @access  Private
 */
router.get('/',
  authMiddleware.verify,
  [
    query('type')
      .optional()
      .isIn(['direct', 'group', 'public', 'private', 'broadcast'])
      .withMessage('Invalid channel type'),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    
    query('search')
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage('Search query must be 1-100 characters')
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { type, limit = 50, search } = req.query;

      logger.debug('Fetching user channels', {
        userId: req.user._id,
        type,
        limit: parseInt(limit),
        search
      });

      let channels;

      if (search) {
        // Search channels
        channels = await Channel.search(search, req.user._id, parseInt(limit));
      } else {
        // Get user's channels
        let query = {
          'members.user': req.user._id,
          'members.status': 'active',
          status: { $in: ['active', 'archived'] },
          deletedAt: { $exists: false }
        };

        if (type) {
          query.type = type;
        }

        channels = await Channel.find(query)
          .populate('members.user', 'username profile.displayName profile.avatar presence.status')
          .populate('stats.lastMessage.sender', 'username profile.displayName')
          .sort({ 'stats.lastActivity': -1 })
          .limit(parseInt(limit));
      }

      // Add unread message counts
      const channelsWithUnread = await Promise.all(
        channels.map(async (channel) => {
          const member = channel.members.find(
            m => m.user._id.toString() === req.user._id.toString()
          );

          if (!member) return channel.toObject();

          // Count unread messages
          const unreadCount = await Message.countDocuments({
            channel: channel._id,
            createdAt: { $gt: member.lastReadAt || new Date(0) },
            'state.isDeleted': { $ne: true }
          });

          return {
            ...channel.toObject(),
            unreadCount,
            lastReadAt: member.lastReadAt
          };
        })
      );

      res.json({
        channels: channelsWithUnread,
        pagination: {
          limit: parseInt(limit),
          total: channelsWithUnread.length,
          hasMore: channelsWithUnread.length === parseInt(limit)
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Get channels error', {
        error: error.message,
        userId: req.user?._id
      });
      next(error);
    }
  }
);

/**
 * @route   GET /channels/public
 * @desc    Get public channels
 * @access  Private
 */
router.get('/public',
  authMiddleware.verify,
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50')
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { limit = 20 } = req.query;

      const channels = await Channel.findPublicChannels(parseInt(limit));

      res.json({
        channels,
        pagination: {
          limit: parseInt(limit),
          total: channels.length
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Get public channels error', {
        error: error.message,
        userId: req.user?._id
      });
      next(error);
    }
  }
);

/**
 * @route   GET /channels/:channelId
 * @desc    Get channel details
 * @access  Private
 */
router.get('/:channelId',
  authMiddleware.verify,
  [param('channelId').isMongoId().withMessage('Valid channel ID is required')],
  handleValidationErrors,
  checkChannelAccess,
  async (req, res, next) => {
    try {
      const channel = req.channel;

      // Populate members with full details
      await channel.populate('members.user', 'username profile.displayName profile.avatar presence.status');

      // Get channel statistics
      const stats = {
        ...channel.stats,
        onlineMembers: channel.members.filter(
          m => m.user.presence?.status === 'online'
        ).length
      };

      res.json({
        channel: {
          ...channel.toObject(),
          stats
        },
        userRole: req.member?.role || null,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Get channel details error', {
        error: error.message,
        channelId: req.params.channelId,
        userId: req.user?._id
      });
      next(error);
    }
  }
);

/**
 * @route   PUT /channels/:channelId
 * @desc    Update channel
 * @access  Private
 */
router.put('/:channelId',
  authMiddleware.verify,
  updateChannelValidation,
  handleValidationErrors,
  checkChannelAccess,
  requireChannelRole(['owner', 'admin']),
  async (req, res, next) => {
    try {
      const allowedUpdates = [
        'name', 'description', 'privacy', 'settings', 'appearance'
      ];

      const updates = {};
      Object.keys(req.body).forEach(key => {
        if (allowedUpdates.includes(key)) {
          updates[key] = req.body[key];
        }
      });

      const channel = await Channel.findByIdAndUpdate(
        req.params.channelId,
        { $set: updates },
        { new: true, runValidators: true }
      ).populate('members.user', 'username profile.displayName profile.avatar');

      logger.info('Channel updated', {
        channelId: channel._id,
        updatedBy: req.user._id,
        updatedFields: Object.keys(updates)
      });

      res.json({
        message: 'Channel updated successfully',
        channel: channel,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Update channel error', {
        error: error.message,
        channelId: req.params.channelId,
        userId: req.user?._id
      });
      next(error);
    }
  }
);

/**
 * @route   POST /channels/:channelId/members
 * @desc    Invite member to channel
 * @access  Private
 */
router.post('/:channelId/members',
  authMiddleware.verify,
  inviteMemberValidation,
  handleValidationErrors,
  checkChannelAccess,
  requireChannelRole(['owner', 'admin', 'moderator']),
  async (req, res, next) => {
    try {
      const { userId, email, role = 'member' } = req.body;
      const channel = req.channel;

      // Find user by ID or email
      let targetUser;
      if (userId) {
        targetUser = await User.findById(userId);
      } else if (email) {
        targetUser = await User.findOne({ email: email.toLowerCase() });
      } else {
        return res.status(400).json({
          error: 'Invalid Request',
          message: 'Either userId or email is required',
          timestamp: new Date().toISOString()
        });
      }

      if (!targetUser) {
        return res.status(404).json({
          error: 'User Not Found',
          message: 'The specified user does not exist',
          timestamp: new Date().toISOString()
        });
      }

      // Check if already a member
      const existingMember = channel.members.find(
        m => m.user.toString() === targetUser._id.toString()
      );

      if (existingMember && existingMember.status === 'active') {
        return res.status(409).json({
          error: 'Already Member',
          message: 'User is already a member of this channel',
          timestamp: new Date().toISOString()
        });
      }

      // Add member
      await channel.addMember(targetUser._id, role, req.user._id);

      logger.info('Member invited to channel', {
        channelId: channel._id,
        newMemberId: targetUser._id,
        invitedBy: req.user._id,
        role
      });

      // Populate for response
      await channel.populate('members.user', 'username profile.displayName profile.avatar');

      res.status(201).json({
        message: 'Member invited successfully',
        member: {
          user: targetUser,
          role: role,
          joinedAt: new Date(),
          invitedBy: req.user._id
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Invite member error', {
        error: error.message,
        channelId: req.params.channelId,
        userId: req.user?._id
      });
      next(error);
    }
  }
);

/**
 * @route   PUT /channels/:channelId/members/:memberId
 * @desc    Update member role
 * @access  Private
 */
router.put('/:channelId/members/:memberId',
  authMiddleware.verify,
  [
    param('channelId').isMongoId().withMessage('Valid channel ID is required'),
    param('memberId').isMongoId().withMessage('Valid member ID is required'),
    body('role').isIn(['member', 'moderator', 'admin']).withMessage('Invalid role')
  ],
  handleValidationErrors,
  checkChannelAccess,
  requireChannelRole(['owner', 'admin']),
  async (req, res, next) => {
    try {
      const { memberId } = req.params;
      const { role } = req.body;
      const channel = req.channel;

      // Check if member exists
      const targetMember = channel.members.find(
        m => m.user.toString() === memberId
      );

      if (!targetMember) {
        return res.status(404).json({
          error: 'Member Not Found',
          message: 'User is not a member of this channel',
          timestamp: new Date().toISOString()
        });
      }

      // Cannot change owner role
      if (targetMember.role === 'owner') {
        return res.status(403).json({
          error: 'Permission Denied',
          message: 'Cannot change owner role',
          timestamp: new Date().toISOString()
        });
      }

      // Only owner can make admins
      if (role === 'admin' && req.member.role !== 'owner') {
        return res.status(403).json({
          error: 'Permission Denied',
          message: 'Only channel owner can assign admin role',
          timestamp: new Date().toISOString()
        });
      }

      await channel.updateMemberRole(memberId, role, req.user._id);

      logger.info('Member role updated', {
        channelId: channel._id,
        memberId: memberId,
        newRole: role,
        updatedBy: req.user._id
      });

      res.json({
        message: 'Member role updated successfully',
        member: {
          userId: memberId,
          role: role
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Update member role error', {
        error: error.message,
        channelId: req.params.channelId,
        memberId: req.params.memberId,
        userId: req.user?._id
      });
      next(error);
    }
  }
);

/**
 * @route   DELETE /channels/:channelId/members/:memberId
 * @desc    Remove member from channel
 * @access  Private
 */
router.delete('/:channelId/members/:memberId',
  authMiddleware.verify,
  [
    param('channelId').isMongoId().withMessage('Valid channel ID is required'),
    param('memberId').isMongoId().withMessage('Valid member ID is required')
  ],
  handleValidationErrors,
  checkChannelAccess,
  async (req, res, next) => {
    try {
      const { memberId } = req.params;
      const channel = req.channel;
      const isRemovingSelf = memberId === req.user._id.toString();

      // Check permissions
      if (!isRemovingSelf && !['owner', 'admin', 'moderator'].includes(req.member.role)) {
        return res.status(403).json({
          error: 'Permission Denied',
          message: 'You do not have permission to remove members',
          timestamp: new Date().toISOString()
        });
      }

      // Find target member
      const targetMember = channel.members.find(
        m => m.user.toString() === memberId
      );

      if (!targetMember) {
        return res.status(404).json({
          error: 'Member Not Found',
          message: 'User is not a member of this channel',
          timestamp: new Date().toISOString()
        });
      }

      // Cannot remove owner
      if (targetMember.role === 'owner') {
        return res.status(403).json({
          error: 'Permission Denied',
          message: 'Cannot remove channel owner',
          timestamp: new Date().toISOString()
        });
      }

      // Remove member
      await channel.removeMember(memberId, req.user._id, 
        isRemovingSelf ? 'Left channel' : 'Removed by admin');

      logger.info('Member removed from channel', {
        channelId: channel._id,
        removedMemberId: memberId,
        removedBy: req.user._id,
        isLeaving: isRemovingSelf
      });

      res.json({
        message: isRemovingSelf ? 'Left channel successfully' : 'Member removed successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Remove member error', {
        error: error.message,
        channelId: req.params.channelId,
        memberId: req.params.memberId,
        userId: req.user?._id
      });
      next(error);
    }
  }
);

/**
 * @route   POST /channels/:channelId/archive
 * @desc    Archive channel
 * @access  Private
 */
router.post('/:channelId/archive',
  authMiddleware.verify,
  checkChannelAccess,
  requireChannelRole(['owner', 'admin']),
  async (req, res, next) => {
    try {
      const { reason } = req.body;
      const channel = req.channel;

      await channel.archive(req.user._id, reason);

      logger.info('Channel archived', {
        channelId: channel._id,
        archivedBy: req.user._id,
        reason
      });

      res.json({
        message: 'Channel archived successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Archive channel error', {
        error: error.message,
        channelId: req.params.channelId,
        userId: req.user?._id
      });
      next(error);
    }
  }
);

/**
 * @route   POST /channels/:channelId/restore
 * @desc    Restore archived channel
 * @access  Private
 */
router.post('/:channelId/restore',
  authMiddleware.verify,
  checkChannelAccess,
  requireChannelRole(['owner', 'admin']),
  async (req, res, next) => {
    try {
      const channel = req.channel;

      if (channel.status !== 'archived') {
        return res.status(400).json({
          error: 'Invalid Operation',
          message: 'Channel is not archived',
          timestamp: new Date().toISOString()
        });
      }

      await channel.restore();

      logger.info('Channel restored', {
        channelId: channel._id,
        restoredBy: req.user._id
      });

      res.json({
        message: 'Channel restored successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Restore channel error', {
        error: error.message,
        channelId: req.params.channelId,
        userId: req.user?._id
      });
      next(error);
    }
  }
);

/**
 * @route   GET /channels/:channelId/invite-link
 * @desc    Generate invite link for channel
 * @access  Private
 */
router.get('/:channelId/invite-link',
  authMiddleware.verify,
  checkChannelAccess,
  requireChannelRole(['owner', 'admin', 'moderator']),
  async (req, res, next) => {
    try {
      const { expiresIn, maxUses } = req.query;
      const channel = req.channel;

      if (!channel.privacy.allowInvites) {
        return res.status(403).json({
          error: 'Invites Disabled',
          message: 'Invites are not allowed for this channel',
          timestamp: new Date().toISOString()
        });
      }

      const inviteToken = await channel.generateInviteLink(
        req.user._id,
        maxUses ? parseInt(maxUses) : null,
        expiresIn ? parseInt(expiresIn) : null
      );

      res.json({
        inviteLink: `${req.protocol}://${req.get('host')}/invite/${inviteToken}`,
        token: inviteToken,
        expiresAt: channel.privacy.inviteLink.expiresAt,
        maxUses: channel.privacy.inviteLink.maxUses,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Generate invite link error', {
        error: error.message,
        channelId: req.params.channelId,
        userId: req.user?._id
      });
      next(error);
    }
  }
);

module.exports = router;