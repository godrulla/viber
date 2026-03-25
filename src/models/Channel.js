/**
 * Channel Model - The Digital Gathering Space
 * 
 * Represents communication channels (rooms, groups, direct messages) with
 * comprehensive permission system, moderation tools, and scalable architecture.
 */

const mongoose = require('mongoose');

const channelSchema = new mongoose.Schema({
  // Core Channel Identity
  name: {
    type: String,
    required: [true, 'Channel name is required'],
    trim: true,
    maxlength: [100, 'Channel name cannot exceed 100 characters'],
    minlength: [1, 'Channel name must be at least 1 character']
  },

  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[a-z0-9-_]+$/, 'Slug can only contain lowercase letters, numbers, hyphens, and underscores']
  },

  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Channel description cannot exceed 500 characters']
  },

  // Channel Type & Configuration
  type: {
    type: String,
    enum: ['direct', 'group', 'public', 'private', 'broadcast', 'support'],
    required: true,
    index: true
  },

  // Privacy & Access Control
  privacy: {
    isPublic: {
      type: Boolean,
      default: false
    },

    requiresApproval: {
      type: Boolean,
      default: false
    },

    allowInvites: {
      type: Boolean,
      default: true
    },

    searchable: {
      type: Boolean,
      default: true
    },

    // Join methods
    joinMethods: [{
      type: String,
      enum: ['invite', 'link', 'request', 'public', 'approval']
    }],

    inviteLink: {
      token: String,
      expiresAt: Date,
      maxUses: Number,
      currentUses: { type: Number, default: 0 },
      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }
  },

  // Channel Appearance
  appearance: {
    avatar: {
      url: String,
      key: String, // S3 key
      uploadedAt: Date,
      uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    },

    cover: {
      url: String,
      key: String,
      uploadedAt: Date,
      uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    },

    color: {
      type: String,
      match: [/^#[0-9A-F]{6}$/i, 'Color must be a valid hex color'],
      default: '#4A90E2'
    },

    theme: {
      type: String,
      enum: ['default', 'dark', 'light', 'custom'],
      default: 'default'
    }
  },

  // Members & Roles
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    role: {
      type: String,
      enum: ['owner', 'admin', 'moderator', 'member', 'restricted'],
      default: 'member'
    },

    permissions: [{
      type: String,
      enum: [
        'read_messages', 'send_messages', 'send_media', 'send_voice',
        'manage_messages', 'manage_members', 'manage_channel',
        'create_invite', 'kick_members', 'ban_members', 'manage_roles',
        'mention_everyone', 'pin_messages', 'use_external_emojis'
      ]
    }],

    // Member metadata
    joinedAt: {
      type: Date,
      default: Date.now
    },

    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },

    // Member status
    status: {
      type: String,
      enum: ['active', 'muted', 'restricted', 'banned'],
      default: 'active'
    },

    mutedUntil: Date,
    
    // Notifications for this member
    notifications: {
      enabled: { type: Boolean, default: true },
      mentions: { type: Boolean, default: true },
      all: { type: Boolean, default: false }
    },

    // Last activity tracking
    lastReadAt: {
      type: Date,
      default: Date.now
    },

    lastMessageAt: Date,

    // Custom nickname in this channel
    nickname: String
  }],

  // Channel Settings & Features
  settings: {
    // Message settings
    allowEditing: { type: Boolean, default: true },
    allowDeletion: { type: Boolean, default: true },
    messageRetentionDays: { type: Number, default: 0 }, // 0 = forever
    
    // Media settings
    allowMedia: { type: Boolean, default: true },
    allowVoice: { type: Boolean, default: true },
    allowFiles: { type: Boolean, default: true },
    maxFileSize: { type: Number, default: 25 * 1024 * 1024 }, // 25MB
    allowedFileTypes: [String],

    // Moderation
    autoModeration: {
      enabled: { type: Boolean, default: false },
      toxicityThreshold: { type: Number, default: 0.7, min: 0, max: 1 },
      spamDetection: { type: Boolean, default: true },
      linkPreview: { type: Boolean, default: true }
    },

    // Advanced features
    threading: { type: Boolean, default: true },
    reactions: { type: Boolean, default: true },
    polls: { type: Boolean, default: true },
    scheduling: { type: Boolean, default: false },

    // AI features
    aiEnabled: { type: Boolean, default: false },
    aiFeatures: [{
      type: String,
      enum: ['translation', 'sentiment', 'summarization', 'smart_reply', 'content_moderation']
    }],

    // Encryption
    encryption: {
      enabled: { type: Boolean, default: true },
      algorithm: {
        type: String,
        enum: ['aes-256-gcm', 'chacha20-poly1305'],
        default: 'aes-256-gcm'
      }
    }
  },

  // Channel Statistics
  stats: {
    messageCount: { type: Number, default: 0, index: true },
    memberCount: { type: Number, default: 0, index: true },
    activeMembers24h: { type: Number, default: 0 },
    activeMembers7d: { type: Number, default: 0 },
    
    lastActivity: {
      type: Date,
      default: Date.now,
      index: true
    },

    lastMessage: {
      messageId: mongoose.Schema.Types.ObjectId,
      content: String,
      sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      timestamp: Date
    },

    // Growth metrics
    peakConcurrentUsers: { type: Number, default: 0 },
    dailyActiveUsers: { type: Number, default: 0 },
    weeklyActiveUsers: { type: Number, default: 0 },
    monthlyActiveUsers: { type: Number, default: 0 }
  },

  // Moderation & Safety
  moderation: {
    // Banned users
    banned: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      bannedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      reason: String,
      bannedAt: {
        type: Date,
        default: Date.now
      },
      expiresAt: Date, // Temporary ban
      permanent: { type: Boolean, default: false }
    }],

    // Moderation log
    moderationLog: [{
      action: {
        type: String,
        enum: [
          'message_deleted', 'message_edited', 'user_muted', 'user_unmuted',
          'user_banned', 'user_unbanned', 'user_kicked', 'role_changed',
          'permissions_changed', 'channel_settings_changed'
        ]
      },
      moderator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      target: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      reason: String,
      details: mongoose.Schema.Types.Mixed,
      timestamp: {
        type: Date,
        default: Date.now
      }
    }],

    // Auto-moderation rules
    rules: [{
      name: String,
      description: String,
      enabled: { type: Boolean, default: true },
      trigger: {
        type: String,
        enum: ['keyword', 'regex', 'toxicity', 'spam', 'link', 'mention']
      },
      pattern: String,
      action: {
        type: String,
        enum: ['warn', 'mute', 'kick', 'ban', 'delete_message']
      },
      duration: Number, // In minutes for temporary actions
      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }]
  },

  // Integration & Webhooks
  integrations: [{
    name: String,
    type: {
      type: String,
      enum: ['webhook', 'bot', 'external_service']
    },
    url: String,
    token: String,
    enabled: { type: Boolean, default: true },
    events: [String], // Which events to send
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],

  // Pinned Messages
  pinnedMessages: [{
    message: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    },
    pinnedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    pinnedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Channel Status
  status: {
    type: String,
    enum: ['active', 'archived', 'deleted', 'suspended'],
    default: 'active',
    index: true
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  updatedAt: {
    type: Date,
    default: Date.now
  },

  // Soft delete
  deletedAt: Date,
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Archive information
  archivedAt: Date,
  archivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  archiveReason: String
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      // Remove sensitive integration data
      if (ret.integrations) {
        ret.integrations.forEach(integration => {
          delete integration.token;
        });
      }
      delete ret.__v;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Indexes for performance optimization
channelSchema.index({ slug: 1 }, { unique: true, sparse: true });
channelSchema.index({ type: 1, status: 1 });
channelSchema.index({ 'members.user': 1 });
channelSchema.index({ 'privacy.isPublic': 1, status: 1 });
channelSchema.index({ 'stats.lastActivity': -1 });
channelSchema.index({ 'stats.memberCount': -1 });
channelSchema.index({ createdAt: -1 });

// Compound indexes
channelSchema.index({ type: 1, 'privacy.isPublic': 1, status: 1 });
channelSchema.index({ 'members.user': 1, 'members.status': 1 });
channelSchema.index({ status: 1, 'stats.lastActivity': -1 });

// Text search index
channelSchema.index({
  name: 'text',
  description: 'text'
}, {
  weights: {
    name: 10,
    description: 5
  },
  name: 'channel_text_search'
});

// Virtual fields
channelSchema.virtual('isArchived').get(function() {
  return this.status === 'archived';
});

channelSchema.virtual('isDeleted').get(function() {
  return this.status === 'deleted' || this.deletedAt != null;
});

channelSchema.virtual('activeMembers').get(function() {
  return this.members.filter(member => member.status === 'active');
});

channelSchema.virtual('owners').get(function() {
  return this.members.filter(member => member.role === 'owner');
});

channelSchema.virtual('admins').get(function() {
  return this.members.filter(member => ['owner', 'admin'].includes(member.role));
});

// Pre-save middleware
channelSchema.pre('save', function(next) {
  // Generate slug if not provided
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');
  }

  // Update member count
  this.stats.memberCount = this.members.filter(m => m.status === 'active').length;

  // Update timestamp
  this.updatedAt = new Date();
  
  next();
});

// Post-save middleware to update related collections
channelSchema.post('save', function(doc) {
  // Update user analytics (could be moved to async job)
  // This would typically be handled by a message queue in production
});

// Instance Methods
channelSchema.methods.addMember = function(userId, role = 'member', invitedBy = null) {
  // Check if user is already a member
  const existingMember = this.members.find(
    member => member.user.toString() === userId.toString()
  );

  if (existingMember) {
    if (existingMember.status === 'active') {
      throw new Error('User is already a member of this channel');
    } else {
      // Reactivate member
      existingMember.status = 'active';
      existingMember.joinedAt = new Date();
    }
  } else {
    // Add new member
    this.members.push({
      user: userId,
      role: role,
      invitedBy: invitedBy,
      joinedAt: new Date(),
      status: 'active'
    });
  }

  this.stats.lastActivity = new Date();
  return this.save();
};

channelSchema.methods.removeMember = function(userId, removedBy = null, reason = null) {
  const memberIndex = this.members.findIndex(
    member => member.user.toString() === userId.toString()
  );

  if (memberIndex === -1) {
    throw new Error('User is not a member of this channel');
  }

  // Log the removal
  this.moderation.moderationLog.push({
    action: 'user_kicked',
    moderator: removedBy,
    target: userId,
    reason: reason,
    timestamp: new Date()
  });

  // Remove member
  this.members.splice(memberIndex, 1);
  this.stats.lastActivity = new Date();

  return this.save();
};

channelSchema.methods.banMember = function(userId, bannedBy, reason = null, duration = null) {
  // Remove from active members
  this.removeMember(userId, bannedBy, reason);

  // Add to banned list
  const ban = {
    user: userId,
    bannedBy: bannedBy,
    reason: reason,
    bannedAt: new Date(),
    permanent: !duration
  };

  if (duration) {
    ban.expiresAt = new Date(Date.now() + duration * 60 * 1000); // duration in minutes
  }

  this.moderation.banned.push(ban);

  // Log the ban
  this.moderation.moderationLog.push({
    action: 'user_banned',
    moderator: bannedBy,
    target: userId,
    reason: reason,
    details: { duration: duration, permanent: !duration },
    timestamp: new Date()
  });

  return this.save();
};

channelSchema.methods.unbanMember = function(userId, unbannedBy) {
  this.moderation.banned = this.moderation.banned.filter(
    ban => ban.user.toString() !== userId.toString()
  );

  // Log the unban
  this.moderation.moderationLog.push({
    action: 'user_unbanned',
    moderator: unbannedBy,
    target: userId,
    timestamp: new Date()
  });

  return this.save();
};

channelSchema.methods.updateMemberRole = function(userId, newRole, updatedBy) {
  const member = this.members.find(
    m => m.user.toString() === userId.toString()
  );

  if (!member) {
    throw new Error('User is not a member of this channel');
  }

  const oldRole = member.role;
  member.role = newRole;

  // Log the role change
  this.moderation.moderationLog.push({
    action: 'role_changed',
    moderator: updatedBy,
    target: userId,
    details: { oldRole: oldRole, newRole: newRole },
    timestamp: new Date()
  });

  return this.save();
};

channelSchema.methods.pinMessage = function(messageId, pinnedBy) {
  // Check if message is already pinned
  const existingPin = this.pinnedMessages.find(
    pin => pin.message.toString() === messageId.toString()
  );

  if (existingPin) {
    throw new Error('Message is already pinned');
  }

  // Limit pinned messages (e.g., max 10)
  if (this.pinnedMessages.length >= 10) {
    throw new Error('Maximum number of pinned messages reached');
  }

  this.pinnedMessages.push({
    message: messageId,
    pinnedBy: pinnedBy,
    pinnedAt: new Date()
  });

  return this.save();
};

channelSchema.methods.unpinMessage = function(messageId) {
  this.pinnedMessages = this.pinnedMessages.filter(
    pin => pin.message.toString() !== messageId.toString()
  );

  return this.save();
};

channelSchema.methods.generateInviteLink = function(createdBy, maxUses = null, expiresIn = null) {
  const crypto = require('crypto');
  const token = crypto.randomBytes(16).toString('hex');
  
  this.privacy.inviteLink = {
    token: token,
    createdBy: createdBy,
    maxUses: maxUses,
    currentUses: 0
  };

  if (expiresIn) {
    this.privacy.inviteLink.expiresAt = new Date(Date.now() + expiresIn);
  }

  return this.save().then(() => token);
};

channelSchema.methods.archive = function(archivedBy, reason = null) {
  this.status = 'archived';
  this.archivedAt = new Date();
  this.archivedBy = archivedBy;
  this.archiveReason = reason;

  return this.save();
};

channelSchema.methods.restore = function() {
  this.status = 'active';
  this.archivedAt = undefined;
  this.archivedBy = undefined;
  this.archiveReason = undefined;

  return this.save();
};

// Static Methods
channelSchema.statics.findPublicChannels = function(limit = 20) {
  return this.find({
    'privacy.isPublic': true,
    status: 'active',
    deletedAt: { $exists: false }
  })
  .populate('members.user', 'username profile.displayName profile.avatar')
  .sort({ 'stats.memberCount': -1 })
  .limit(limit);
};

channelSchema.statics.findUserChannels = function(userId) {
  return this.find({
    'members.user': userId,
    'members.status': 'active',
    status: { $in: ['active', 'archived'] },
    deletedAt: { $exists: false }
  })
  .populate('members.user', 'username profile.displayName profile.avatar presence.status')
  .sort({ 'stats.lastActivity': -1 });
};

channelSchema.statics.findBySlug = function(slug) {
  return this.findOne({
    slug: slug,
    status: 'active',
    deletedAt: { $exists: false }
  })
  .populate('members.user', 'username profile.displayName profile.avatar presence.status');
};

channelSchema.statics.search = function(query, userId = null, limit = 10) {
  const searchQuery = {
    $text: { $search: query },
    status: 'active',
    deletedAt: { $exists: false }
  };

  // If user provided, include their private channels
  if (userId) {
    searchQuery.$or = [
      { 'privacy.isPublic': true },
      { 'members.user': userId }
    ];
  } else {
    searchQuery['privacy.isPublic'] = true;
  }

  return this.find(searchQuery)
    .populate('members.user', 'username profile.displayName profile.avatar')
    .sort({ score: { $meta: 'textScore' }, 'stats.memberCount': -1 })
    .limit(limit);
};

channelSchema.statics.getDirectMessage = function(user1Id, user2Id) {
  return this.findOne({
    type: 'direct',
    'members.user': { $all: [user1Id, user2Id] },
    'members.2': { $exists: false }, // Exactly 2 members
    status: 'active',
    deletedAt: { $exists: false }
  });
};

channelSchema.statics.createDirectMessage = function(user1Id, user2Id) {
  return this.create({
    name: `DM-${user1Id}-${user2Id}`,
    type: 'direct',
    privacy: {
      isPublic: false,
      searchable: false,
      allowInvites: false
    },
    members: [
      { user: user1Id, role: 'member' },
      { user: user2Id, role: 'member' }
    ]
  });
};

module.exports = mongoose.model('Channel', channelSchema);