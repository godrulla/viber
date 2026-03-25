/**
 * Message Model - The Heart of Communication
 * 
 * Represents message entities with encryption, delivery tracking, and 
 * rich media support. Designed for performance and security.
 */

const mongoose = require('mongoose');
const crypto = require('crypto');

const messageSchema = new mongoose.Schema({
  // Core Message Identity
  messageId: {
    type: String,
    required: true,
    unique: true,
    default: () => crypto.randomUUID()
  },

  // Message Relationships
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Message sender is required'],
    index: true
  },

  channel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Channel',
    required: [true, 'Message channel is required'],
    index: true
  },

  // Reply/Thread Support
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },

  threadRoot: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },

  // Message Content
  content: {
    // Encrypted content for E2E encryption
    encrypted: {
      type: String,
      required: function() { return this.encryption.enabled; }
    },

    // Plain text for non-encrypted messages
    text: {
      type: String,
      maxlength: [4000, 'Message cannot exceed 4000 characters'],
      required: function() { return !this.encryption.enabled && !this.media.hasMedia; }
    },

    // Rich text formatting metadata
    formatting: [{
      type: {
        type: String,
        enum: ['bold', 'italic', 'underline', 'strikethrough', 'code', 'link', 'mention', 'emoji']
      },
      start: Number,
      end: Number,
      data: mongoose.Schema.Types.Mixed // Additional data for links, mentions, etc.
    }],

    // Parsed entities (mentions, links, hashtags)
    entities: {
      mentions: [{
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        username: String,
        start: Number,
        end: Number
      }],

      links: [{
        url: String,
        title: String,
        description: String,
        image: String,
        start: Number,
        end: Number
      }],

      hashtags: [{
        tag: String,
        start: Number,
        end: Number
      }]
    }
  },

  // Media Attachments
  media: {
    hasMedia: {
      type: Boolean,
      default: false
    },

    attachments: [{
      type: {
        type: String,
        enum: ['image', 'video', 'audio', 'document', 'voice_note'],
        required: true
      },

      filename: String,
      originalName: String,
      mimeType: String,
      size: Number, // Size in bytes

      // Storage information
      url: String,
      key: String, // S3 key or storage identifier
      bucket: String,

      // Media metadata
      metadata: {
        width: Number,
        height: Number,
        duration: Number, // For audio/video in seconds
        thumbnail: String, // Thumbnail URL for videos/documents
        waveform: [Number] // For voice notes
      },

      // Security
      scanStatus: {
        type: String,
        enum: ['pending', 'safe', 'malicious', 'quarantined'],
        default: 'pending'
      },

      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }]
  },

  // Message Type & Special Properties
  type: {
    type: String,
    enum: [
      'text',           // Regular text message
      'media',          // Media message
      'system',         // System notification
      'call',           // Call invitation
      'location',       // Location sharing
      'contact',        // Contact sharing
      'poll',           // Poll message
      'event',          // Event/calendar
      'payment',        // Payment request/confirmation
      'bot_response'    // Bot/AI response
    ],
    default: 'text'
  },

  // System Message Data
  systemData: {
    action: {
      type: String,
      enum: [
        'user_joined', 'user_left', 'user_added', 'user_removed',
        'channel_created', 'channel_renamed', 'channel_archived',
        'admin_promoted', 'admin_demoted', 'permissions_changed'
      ]
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    target: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    metadata: mongoose.Schema.Types.Mixed
  },

  // Encryption & Security
  encryption: {
    enabled: {
      type: Boolean,
      default: true
    },

    algorithm: {
      type: String,
      enum: ['aes-256-gcm', 'chacha20-poly1305'],
      default: 'aes-256-gcm'
    },

    keyId: String, // Reference to encryption key
    iv: String,    // Initialization vector
    authTag: String, // Authentication tag for GCM
    
    // Perfect Forward Secrecy support
    ephemeralKeyId: String,
    ratchetStep: Number
  },

  // Delivery & Status
  delivery: {
    status: {
      type: String,
      enum: ['sending', 'sent', 'delivered', 'read', 'failed'],
      default: 'sending',
      index: true
    },

    sentAt: {
      type: Date,
      default: Date.now
    },

    deliveredAt: Date,
    
    // Read receipts per user
    readBy: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      readAt: {
        type: Date,
        default: Date.now
      }
    }],

    // Delivery attempts and errors
    attempts: [{
      timestamp: Date,
      status: String,
      error: String
    }],

    // Push notification status
    pushStatus: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
      delivered: { type: Boolean, default: false },
      deliveredAt: Date,
      error: String
    }
  },

  // Message Reactions
  reactions: [{
    emoji: {
      type: String,
      required: true,
      maxlength: 10
    },
    users: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    count: {
      type: Number,
      default: 0
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Message Priority & Scheduling
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },

  scheduledFor: Date, // For scheduled messages
  expiresAt: Date,    // For disappearing messages

  // AI & ML Features
  ai: {
    sentimentScore: {
      type: Number,
      min: -1,
      max: 1
    },

    language: String,
    
    toxicityScore: {
      type: Number,
      min: 0,
      max: 1
    },

    categories: [String], // AI-detected categories
    
    autoTranslated: {
      from: String,
      to: String,
      confidence: Number
    }
  },

  // Message State & Moderation
  state: {
    isEdited: {
      type: Boolean,
      default: false
    },

    editHistory: [{
      content: String,
      editedAt: Date,
      editedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }],

    isDeleted: {
      type: Boolean,
      default: false
    },

    deletedAt: Date,
    
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },

    // Moderation
    flagged: {
      type: Boolean,
      default: false
    },

    flagReason: String,
    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },

    moderatedAt: Date
  },

  // Search & Indexing
  searchText: String, // Processed text for search indexing

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      // Remove sensitive encryption data from JSON output
      if (ret.encryption && ret.encryption.keyId) {
        delete ret.encryption.keyId;
        delete ret.encryption.iv;
        delete ret.encryption.authTag;
      }
      delete ret.__v;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Indexes for performance optimization
messageSchema.index({ channel: 1, createdAt: -1 }); // Channel timeline
messageSchema.index({ sender: 1, createdAt: -1 });   // User messages
messageSchema.index({ messageId: 1 }, { unique: true });
messageSchema.index({ 'delivery.status': 1, createdAt: -1 });
messageSchema.index({ threadRoot: 1, createdAt: 1 }); // Thread messages
messageSchema.index({ scheduledFor: 1 }, { sparse: true }); // Scheduled messages
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Text search index
messageSchema.index({ 
  searchText: 'text',
  'content.text': 'text'
}, {
  weights: {
    searchText: 10,
    'content.text': 5
  },
  name: 'message_text_search'
});

// Compound indexes for complex queries
messageSchema.index({ channel: 1, type: 1, createdAt: -1 });
messageSchema.index({ sender: 1, channel: 1, createdAt: -1 });
messageSchema.index({ 'content.entities.mentions.user': 1, createdAt: -1 });

// Virtual fields
messageSchema.virtual('isRead').get(function() {
  return this.delivery.status === 'read';
});

messageSchema.virtual('readCount').get(function() {
  return this.delivery.readBy ? this.delivery.readBy.length : 0;
});

messageSchema.virtual('reactionCount').get(function() {
  return this.reactions.reduce((total, reaction) => total + reaction.count, 0);
});

messageSchema.virtual('hasAttachments').get(function() {
  return this.media.hasMedia && this.media.attachments.length > 0;
});

// Pre-save middleware
messageSchema.pre('save', function(next) {
  // Update search text for indexing
  if (this.content.text && !this.encryption.enabled) {
    this.searchText = this.content.text.toLowerCase();
  }

  // Set media flag
  this.media.hasMedia = this.media.attachments && this.media.attachments.length > 0;

  // Update timestamp
  this.updatedAt = new Date();
  
  next();
});

// Instance Methods
messageSchema.methods.encrypt = function(plainText, encryptionKey) {
  if (!this.encryption.enabled) return plainText;

  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.encryption.algorithm, encryptionKey);
    cipher.setAuthenticationData(this._id.toString());
    
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthenticationTag();
    
    this.encryption.iv = iv.toString('hex');
    this.encryption.authTag = authTag.toString('hex');
    this.content.encrypted = encrypted;
    
    return encrypted;
  } catch (error) {
    throw new Error('Encryption failed: ' + error.message);
  }
};

messageSchema.methods.decrypt = function(encryptionKey) {
  if (!this.encryption.enabled || !this.content.encrypted) {
    return this.content.text;
  }

  try {
    const iv = Buffer.from(this.encryption.iv, 'hex');
    const authTag = Buffer.from(this.encryption.authTag, 'hex');
    
    const decipher = crypto.createDecipher(this.encryption.algorithm, encryptionKey);
    decipher.setAuthenticationData(this._id.toString());
    decipher.setAuthenticationTag(authTag);
    
    let decrypted = decipher.update(this.content.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error('Decryption failed: ' + error.message);
  }
};

messageSchema.methods.markAsRead = function(userId) {
  // Check if already marked as read by this user
  const existingRead = this.delivery.readBy.find(
    read => read.user.toString() === userId.toString()
  );

  if (!existingRead) {
    this.delivery.readBy.push({
      user: userId,
      readAt: new Date()
    });

    // Update overall status if this is the first read
    if (this.delivery.status === 'delivered') {
      this.delivery.status = 'read';
    }
  }

  return this.save();
};

messageSchema.methods.addReaction = function(emoji, userId) {
  let reaction = this.reactions.find(r => r.emoji === emoji);
  
  if (!reaction) {
    reaction = {
      emoji: emoji,
      users: [userId],
      count: 1,
      createdAt: new Date()
    };
    this.reactions.push(reaction);
  } else {
    // Check if user already reacted with this emoji
    if (!reaction.users.includes(userId)) {
      reaction.users.push(userId);
      reaction.count = reaction.users.length;
    }
  }

  return this.save();
};

messageSchema.methods.removeReaction = function(emoji, userId) {
  const reaction = this.reactions.find(r => r.emoji === emoji);
  
  if (reaction) {
    reaction.users = reaction.users.filter(
      user => user.toString() !== userId.toString()
    );
    reaction.count = reaction.users.length;

    // Remove reaction if no users left
    if (reaction.count === 0) {
      this.reactions = this.reactions.filter(r => r.emoji !== emoji);
    }
  }

  return this.save();
};

messageSchema.methods.edit = function(newContent, editorId) {
  // Save to edit history
  this.state.editHistory.push({
    content: this.content.text || this.content.encrypted,
    editedAt: new Date(),
    editedBy: editorId
  });

  // Update content
  if (this.encryption.enabled) {
    // Re-encrypt with new content
    this.encrypt(newContent, /* encryption key needed */);
  } else {
    this.content.text = newContent;
  }

  this.state.isEdited = true;
  this.updatedAt = new Date();

  return this.save();
};

messageSchema.methods.softDelete = function(deleterId) {
  this.state.isDeleted = true;
  this.state.deletedAt = new Date();
  this.state.deletedBy = deleterId;
  
  // Clear sensitive content but keep metadata for audit
  this.content.text = '[Message deleted]';
  this.content.encrypted = null;
  
  return this.save();
};

// Static Methods
messageSchema.statics.findByChannel = function(channelId, limit = 50, before = null) {
  const query = { 
    channel: channelId,
    'state.isDeleted': { $ne: true }
  };

  if (before) {
    query.createdAt = { $lt: before };
  }

  return this.find(query)
    .populate('sender', 'username profile.displayName profile.avatar')
    .populate('replyTo', 'content.text sender')
    .sort({ createdAt: -1 })
    .limit(limit);
};

messageSchema.statics.findThread = function(threadRootId) {
  return this.find({
    $or: [
      { _id: threadRootId },
      { threadRoot: threadRootId }
    ],
    'state.isDeleted': { $ne: true }
  })
  .populate('sender', 'username profile.displayName profile.avatar')
  .sort({ createdAt: 1 });
};

messageSchema.statics.findUndelivered = function() {
  return this.find({
    'delivery.status': { $in: ['sending', 'sent'] },
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
  });
};

messageSchema.statics.search = function(channelId, query, limit = 20) {
  return this.find({
    $text: { $search: query },
    channel: channelId,
    'state.isDeleted': { $ne: true }
  })
  .populate('sender', 'username profile.displayName profile.avatar')
  .sort({ score: { $meta: 'textScore' }, createdAt: -1 })
  .limit(limit);
};

messageSchema.statics.getAnalytics = function(channelId, timeframe = 7) {
  const startDate = new Date(Date.now() - timeframe * 24 * 60 * 60 * 1000);
  
  return this.aggregate([
    {
      $match: {
        channel: mongoose.Types.ObjectId(channelId),
        createdAt: { $gte: startDate },
        'state.isDeleted': { $ne: true }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        messageCount: { $sum: 1 },
        userCount: { $addToSet: '$sender' },
        avgReactions: { $avg: { $size: '$reactions' } },
        mediaMessages: {
          $sum: { $cond: ['$media.hasMedia', 1, 0] }
        }
      }
    },
    {
      $project: {
        date: {
          $dateFromParts: {
            year: '$_id.year',
            month: '$_id.month',
            day: '$_id.day'
          }
        },
        messageCount: 1,
        uniqueUsers: { $size: '$userCount' },
        avgReactions: { $round: ['$avgReactions', 2] },
        mediaMessages: 1
      }
    },
    { $sort: { date: 1 } }
  ]);
};

module.exports = mongoose.model('Message', messageSchema);