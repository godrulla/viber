/**
 * User Model - The Digital Identity Foundation
 * 
 * Represents user entities with authentication, security, and relationship
 * management capabilities. Built for scale and security.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('../config/environment');

const userSchema = new mongoose.Schema({
  // Core Identity
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    lowercase: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
  },

  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address']
  },

  // Authentication & Security
  passwordHash: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters']
  },

  // Profile Information
  profile: {
    displayName: {
      type: String,
      trim: true,
      maxlength: [50, 'Display name cannot exceed 50 characters']
    },
    
    firstName: {
      type: String,
      trim: true,
      maxlength: [30, 'First name cannot exceed 30 characters']
    },

    lastName: {
      type: String,
      trim: true,
      maxlength: [30, 'Last name cannot exceed 30 characters']
    },

    avatar: {
      url: String,
      key: String, // S3 key for deletion
      uploadedAt: Date
    },

    bio: {
      type: String,
      maxlength: [500, 'Bio cannot exceed 500 characters'],
      trim: true
    },

    timezone: {
      type: String,
      default: 'UTC'
    },

    language: {
      type: String,
      enum: ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'ar'],
      default: 'en'
    }
  },

  // Privacy & Security Settings
  privacy: {
    profileVisibility: {
      type: String,
      enum: ['public', 'contacts', 'private'],
      default: 'contacts'
    },

    lastSeenVisibility: {
      type: String,
      enum: ['everyone', 'contacts', 'nobody'],
      default: 'contacts'
    },

    readReceiptEnabled: {
      type: Boolean,
      default: true
    },

    twoFactorEnabled: {
      type: Boolean,
      default: false
    },

    encryptionEnabled: {
      type: Boolean,
      default: true
    }
  },

  // Authentication Tokens & Security
  refreshTokens: [{
    token: String,
    createdAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: Date,
    deviceInfo: {
      userAgent: String,
      ip: String,
      deviceId: String
    }
  }],

  // Account Status & Verification
  status: {
    type: String,
    enum: ['active', 'suspended', 'deactivated', 'pending_verification'],
    default: 'pending_verification'
  },

  emailVerified: {
    type: Boolean,
    default: false
  },

  emailVerificationToken: String,
  
  passwordResetToken: String,
  passwordResetExpires: Date,

  // Relationships & Social
  contacts: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    nickname: String,
    isFavorite: {
      type: Boolean,
      default: false
    }
  }],

  blocked: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    blockedAt: {
      type: Date,
      default: Date.now
    },
    reason: String
  }],

  // Activity & Presence
  presence: {
    status: {
      type: String,
      enum: ['online', 'away', 'busy', 'invisible', 'offline'],
      default: 'offline'
    },
    
    lastSeen: {
      type: Date,
      default: Date.now
    },

    isTyping: {
      channelId: mongoose.Schema.Types.ObjectId,
      since: Date
    }
  },

  // Notification Preferences
  notifications: {
    email: {
      enabled: { type: Boolean, default: true },
      frequency: {
        type: String,
        enum: ['immediate', 'hourly', 'daily', 'never'],
        default: 'immediate'
      }
    },

    push: {
      enabled: { type: Boolean, default: true },
      sound: { type: Boolean, default: true },
      vibrate: { type: Boolean, default: true },
      badge: { type: Boolean, default: true }
    },

    desktop: {
      enabled: { type: Boolean, default: true },
      sound: { type: Boolean, default: true }
    }
  },

  // Device Management
  devices: [{
    deviceId: String,
    name: String,
    type: {
      type: String,
      enum: ['web', 'mobile', 'desktop', 'tablet']
    },
    platform: String, // iOS, Android, Windows, macOS, Linux
    pushToken: String,
    lastActive: Date,
    isActive: {
      type: Boolean,
      default: true
    }
  }],

  // Analytics & Metrics (Privacy compliant)
  analytics: {
    messagesCount: { type: Number, default: 0 },
    channelsCount: { type: Number, default: 0 },
    joinedAt: { type: Date, default: Date.now },
    lastLoginAt: Date,
    loginCount: { type: Number, default: 0 }
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },

  deletedAt: Date // Soft delete support
}, {
  timestamps: true, // Automatically manage createdAt and updatedAt
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      // Remove sensitive fields from JSON output
      delete ret.passwordHash;
      delete ret.refreshTokens;
      delete ret.emailVerificationToken;
      delete ret.passwordResetToken;
      delete ret.__v;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Indexes for performance optimization
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ 'contacts.user': 1 });
userSchema.index({ 'presence.lastSeen': 1 });
userSchema.index({ status: 1, deletedAt: 1 });
userSchema.index({ createdAt: -1 });

// Compound indexes for complex queries
userSchema.index({ status: 1, emailVerified: 1 });
userSchema.index({ 'presence.status': 1, 'presence.lastSeen': -1 });

// Virtual fields
userSchema.virtual('fullName').get(function() {
  if (this.profile.firstName && this.profile.lastName) {
    return `${this.profile.firstName} ${this.profile.lastName}`;
  }
  return this.profile.displayName || this.username;
});

userSchema.virtual('isOnline').get(function() {
  return this.presence.status === 'online';
});

userSchema.virtual('contactsCount').get(function() {
  return this.contacts.length;
});

// Password hashing middleware
userSchema.pre('save', async function(next) {
  // Only hash password if it's been modified (or is new)
  if (!this.isModified('passwordHash')) return next();

  try {
    // Hash password with cost factor from config
    const salt = await bcrypt.genSalt(config.security.bcryptRounds);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Update timestamps on save
userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Instance Methods
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.passwordHash);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

userSchema.methods.generatePasswordResetToken = function() {
  const crypto = require('crypto');
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  // Hash and store token
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  // Set expiration (1 hour)
  this.passwordResetExpires = Date.now() + 60 * 60 * 1000;
  
  return resetToken;
};

userSchema.methods.generateEmailVerificationToken = function() {
  const crypto = require('crypto');
  const verificationToken = crypto.randomBytes(32).toString('hex');
  
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');
  
  return verificationToken;
};

userSchema.methods.addContact = function(contactId, nickname = null) {
  // Check if already a contact
  const existingContact = this.contacts.find(
    contact => contact.user.toString() === contactId.toString()
  );
  
  if (!existingContact) {
    this.contacts.push({
      user: contactId,
      nickname: nickname,
      addedAt: new Date()
    });
  }
  
  return this.save();
};

userSchema.methods.removeContact = function(contactId) {
  this.contacts = this.contacts.filter(
    contact => contact.user.toString() !== contactId.toString()
  );
  
  return this.save();
};

userSchema.methods.blockUser = function(userId, reason = null) {
  // Remove from contacts if exists
  this.removeContact(userId);
  
  // Add to blocked list
  const existingBlock = this.blocked.find(
    block => block.user.toString() === userId.toString()
  );
  
  if (!existingBlock) {
    this.blocked.push({
      user: userId,
      reason: reason,
      blockedAt: new Date()
    });
  }
  
  return this.save();
};

userSchema.methods.unblockUser = function(userId) {
  this.blocked = this.blocked.filter(
    block => block.user.toString() !== userId.toString()
  );
  
  return this.save();
};

userSchema.methods.updatePresence = function(status, channelId = null) {
  this.presence.status = status;
  this.presence.lastSeen = new Date();
  
  if (channelId) {
    this.presence.isTyping = {
      channelId: channelId,
      since: new Date()
    };
  } else {
    this.presence.isTyping = undefined;
  }
  
  return this.save();
};

userSchema.methods.addDevice = function(deviceInfo) {
  // Remove existing device with same deviceId
  this.devices = this.devices.filter(device => device.deviceId !== deviceInfo.deviceId);
  
  // Add new device
  this.devices.push({
    ...deviceInfo,
    lastActive: new Date(),
    isActive: true
  });
  
  return this.save();
};

userSchema.methods.removeDevice = function(deviceId) {
  this.devices = this.devices.filter(device => device.deviceId !== deviceId);
  return this.save();
};

// Static Methods
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ 
    email: email.toLowerCase(),
    deletedAt: { $exists: false }
  });
};

userSchema.statics.findByUsername = function(username) {
  return this.findOne({ 
    username: username.toLowerCase(),
    deletedAt: { $exists: false }
  });
};

userSchema.statics.findActive = function() {
  return this.find({
    status: 'active',
    deletedAt: { $exists: false }
  });
};

userSchema.statics.findOnline = function() {
  return this.find({
    'presence.status': { $in: ['online', 'away', 'busy'] },
    status: 'active',
    deletedAt: { $exists: false }
  });
};

userSchema.statics.search = function(query, limit = 10) {
  const searchRegex = new RegExp(query, 'i');
  
  return this.find({
    $or: [
      { username: searchRegex },
      { email: searchRegex },
      { 'profile.displayName': searchRegex },
      { 'profile.firstName': searchRegex },
      { 'profile.lastName': searchRegex }
    ],
    status: 'active',
    deletedAt: { $exists: false }
  }).limit(limit);
};

module.exports = mongoose.model('User', userSchema);