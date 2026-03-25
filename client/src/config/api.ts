/**
 * API Configuration - The Bridge to the Backend
 * 
 * Centralized API configuration with environment-aware endpoints
 * and authentication handling.
 */

export const API_CONFIG = {
  BASE_URL: process.env.REACT_APP_API_URL || 'http://localhost:3001',
  WS_URL: process.env.REACT_APP_WS_URL || 'http://localhost:3001',
  API_VERSION: 'v1',
  ENDPOINTS: {
    AUTH: '/api/v1/auth',
    CHANNELS: '/api/v1/channels',
    MESSAGES: '/api/v1/messages',
    WEBSOCKET: '/socket.io'
  },
  TIMEOUTS: {
    REQUEST: 10000, // 10 seconds
    UPLOAD: 60000,  // 60 seconds for file uploads
  }
};

export const getApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

export const getWsUrl = (): string => {
  return API_CONFIG.WS_URL;
};