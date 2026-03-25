/**
 * API Client - The Gateway to the Backend
 * 
 * Centralized HTTP client with authentication, error handling,
 * and request/response interceptors.
 */

import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { API_CONFIG, getApiUrl } from '../config/api';
import { 
  ApiResponse, 
  ApiError, 
  AuthTokens,
  LoginRequest, 
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  User,
  Channel,
  Message,
  PaginationResponse
} from '../types';

class ApiClient {
  private client: AxiosInstance;
  private tokens: AuthTokens | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: API_CONFIG.TIMEOUTS.REQUEST,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
    this.loadStoredTokens();
  }

  private setupInterceptors() {
    // Request interceptor - Add auth token to requests
    this.client.interceptors.request.use(
      (config) => {
        // Add auth token if available
        if (this.tokens?.accessToken) {
          config.headers.Authorization = `Bearer ${this.tokens.accessToken}`;
        }

        // Add request ID for tracking (optional)
        // config.headers['X-Request-ID'] = this.generateRequestId();

        // Add device info (optional)
        // config.headers['X-Device-Type'] = 'web';
        // config.headers['X-User-Agent'] = navigator.userAgent;

        console.log(`🔄 API Request: ${config.method?.toUpperCase()} ${config.url}`, {
          headers: config.headers,
          data: config.data
        });

        return config;
      },
      (error) => {
        console.error('❌ Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor - Handle responses and errors
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        console.log(`✅ API Response: ${response.status}`, {
          url: response.config.url,
          status: response.status,
          data: response.data
        });
        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config as any;

        console.error(`❌ API Error: ${error.response?.status}`, {
          url: error.config?.url,
          status: error.response?.status,
          data: error.response?.data
        });

        // Handle 401 errors - Token expired
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            await this.refreshAccessToken();
            // Retry original request with new token
            return this.client(originalRequest);
          } catch (refreshError) {
            // Refresh failed, redirect to login
            this.clearTokens();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(this.transformError(error));
      }
    );
  }

  private generateRequestId(): string {
    return 'req_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  private transformError(error: AxiosError): ApiError {
    const response = error.response?.data as any;
    
    return {
      error: response?.error || 'Request Failed',
      message: response?.message || error.message || 'An error occurred',
      details: response?.details || [],
      timestamp: response?.timestamp || new Date().toISOString(),
      field: response?.field
    };
  }

  // Token Management
  public setTokens(tokens: AuthTokens) {
    this.tokens = tokens;
    localStorage.setItem('viber_tokens', JSON.stringify(tokens));
  }

  public clearTokens() {
    this.tokens = null;
    localStorage.removeItem('viber_tokens');
  }

  private loadStoredTokens() {
    try {
      const stored = localStorage.getItem('viber_tokens');
      if (stored) {
        this.tokens = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load stored tokens:', error);
      this.clearTokens();
    }
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.tokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await axios.post(
        getApiUrl('/api/v1/auth/refresh'),
        { refreshToken: this.tokens.refreshToken }
      );

      const { tokens } = response.data;
      this.setTokens({
        ...this.tokens,
        accessToken: tokens.accessToken,
        expiresIn: tokens.expiresIn
      });
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    }
  }

  // Authentication API
  public async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await this.client.post<LoginResponse>('/api/v1/auth/login', credentials);
    this.setTokens(response.data.tokens);
    return response.data;
  }

  public async register(userData: RegisterRequest): Promise<RegisterResponse> {
    const response = await this.client.post<RegisterResponse>('/api/v1/auth/register', userData);
    this.setTokens(response.data.tokens);
    return response.data;
  }

  public async logout(): Promise<void> {
    try {
      await this.client.post('/api/v1/auth/logout', {
        refreshToken: this.tokens?.refreshToken
      });
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      this.clearTokens();
    }
  }

  public async getCurrentUser(): Promise<User> {
    const response = await this.client.get<any>('/api/v1/auth/me');
    return response.data.user || response.data;
  }

  public async updateProfile(profileData: Partial<User>): Promise<User> {
    const response = await this.client.put<any>('/api/v1/auth/me', profileData);
    return response.data.user || response.data;
  }

  // Channel API
  public async getChannels(params?: {
    type?: string;
    limit?: number;
    search?: string;
  }): Promise<{ channels: Channel[]; pagination: any }> {
    const response = await this.client.get<{ channels: Channel[]; pagination: any }>('/api/v1/channels', {
      params
    });
    return response.data;
  }

  public async getPublicChannels(limit = 20): Promise<{ channels: Channel[]; pagination: any }> {
    const response = await this.client.get<{ channels: Channel[]; pagination: any }>('/api/v1/channels/public', {
      params: { limit }
    });
    return response.data;
  }

  public async getChannel(channelId: string): Promise<Channel> {
    const response = await this.client.get<any>(`/api/v1/channels/${channelId}`);
    return response.data.channel || response.data;
  }

  public async createChannel(channelData: {
    name: string;
    description?: string;
    type: Channel['type'];
    privacy?: any;
    members?: string[];
    settings?: any;
  }): Promise<Channel> {
    const response = await this.client.post<any>('/api/v1/channels', channelData);
    return response.data.channel || response.data;
  }

  public async updateChannel(channelId: string, updates: Partial<Channel>): Promise<Channel> {
    const response = await this.client.put<any>(`/api/v1/channels/${channelId}`, updates);
    return response.data.channel || response.data;
  }

  public async inviteMember(channelId: string, memberData: {
    userId?: string;
    email?: string;
    role?: string;
  }): Promise<void> {
    await this.client.post(`/api/v1/channels/${channelId}/members`, memberData);
  }

  public async removeMember(channelId: string, memberId: string): Promise<void> {
    await this.client.delete(`/api/v1/channels/${channelId}/members/${memberId}`);
  }

  public async generateInviteLink(channelId: string, params?: {
    expiresIn?: number;
    maxUses?: number;
  }): Promise<{ inviteLink: string; token: string }> {
    const response = await this.client.get<{ inviteLink: string; token: string }>(
      `/api/v1/channels/${channelId}/invite-link`,
      { params }
    );
    return response.data;
  }

  // Message API
  public async getMessages(channelId: string, params?: {
    limit?: number;
    before?: string;
    after?: string;
    type?: string;
  }): Promise<{ messages: Message[]; pagination: any; channel: any }> {
    const response = await this.client.get<{ messages: Message[]; pagination: any; channel: any }>(
      `/api/v1/messages/${channelId}`,
      { params }
    );
    return response.data;
  }

  public async sendMessage(messageData: {
    channelId: string;
    content: { text: string };
    type?: Message['type'];
    replyTo?: string;
    priority?: string;
  }): Promise<Message> {
    const response = await this.client.post<ApiResponse<Message>>('/api/v1/messages', messageData);
    return response.data.data!;
  }

  public async editMessage(messageId: string, content: { text: string }): Promise<Message> {
    const response = await this.client.put<ApiResponse<Message>>(`/api/v1/messages/${messageId}`, {
      content
    });
    return response.data.data!;
  }

  public async deleteMessage(messageId: string): Promise<void> {
    await this.client.delete(`/api/v1/messages/${messageId}`);
  }

  public async addReaction(messageId: string, emoji: string): Promise<void> {
    await this.client.post(`/api/v1/messages/${messageId}/reactions`, { emoji });
  }

  public async removeReaction(messageId: string, emoji: string): Promise<void> {
    await this.client.delete(`/api/v1/messages/${messageId}/reactions/${emoji}`);
  }

  public async searchMessages(channelId: string, query: string, limit = 20): Promise<{ messages: Message[] }> {
    const response = await this.client.get<{ messages: Message[] }>(
      `/api/v1/messages/${channelId}/search`,
      { params: { q: query, limit } }
    );
    return response.data;
  }

  public async getThread(messageId: string): Promise<{ thread: Message[]; rootMessage: Message }> {
    const response = await this.client.get<{ thread: Message[]; rootMessage: Message }>(
      `/api/v1/messages/${messageId}/thread`
    );
    return response.data;
  }

  // Health & System API
  public async getHealth(): Promise<any> {
    const response = await this.client.get('/health');
    return response.data;
  }

  public async getApiInfo(): Promise<any> {
    const response = await this.client.get('/api');
    return response.data;
  }

  // Getters
  public get isAuthenticated(): boolean {
    return !!this.tokens?.accessToken;
  }

  public get currentTokens(): AuthTokens | null {
    return this.tokens;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
export default apiClient;