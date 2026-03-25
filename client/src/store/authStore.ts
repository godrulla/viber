/**
 * Authentication Store - The Guardian of Identity
 * 
 * Global state management for user authentication, profile data,
 * and session management using Zustand.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { User, AuthTokens, LoginRequest, RegisterRequest, ApiError } from '../types';
import { apiClient } from '../services/apiClient';
import { socketClient } from '../services/socketClient';

interface AuthState {
  // State
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Actions
  login: (credentials: LoginRequest) => Promise<void>;
  register: (userData: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  clearError: () => void;
  setError: (error: string) => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial State
        user: null,
        tokens: null,
        isAuthenticated: false,
        isLoading: false,
        isInitialized: false,
        error: null,

        // Initialize - Check for stored tokens and validate
        initialize: async () => {
          const { tokens } = get();
          
          if (!tokens?.accessToken) {
            set({ isInitialized: true });
            return;
          }

          set({ isLoading: true });

          try {
            // Validate stored tokens by fetching user
            const user = await apiClient.getCurrentUser();
            
            // Connect socket with valid tokens
            await socketClient.connect(tokens);
            
            set({
              user,
              isAuthenticated: true,
              isLoading: false,
              isInitialized: true,
              error: null
            });

            console.log('✅ Auth initialized successfully:', user.username);
          } catch (error: any) {
            console.error('❌ Auth initialization failed:', error);
            
            // Clear invalid tokens
            apiClient.clearTokens();
            
            set({
              user: null,
              tokens: null,
              isAuthenticated: false,
              isLoading: false,
              isInitialized: true,
              error: null // Don't show error for expired tokens
            });
          }
        },

        // Login
        login: async (credentials: LoginRequest) => {
          set({ isLoading: true, error: null });

          try {
            const response = await apiClient.login(credentials);
            
            // Connect to socket
            await socketClient.connect(response.tokens);

            set({
              user: response.user,
              tokens: response.tokens,
              isAuthenticated: true,
              isLoading: false,
              error: null
            });

            console.log('✅ Login successful:', response.user.username);
          } catch (error: any) {
            const errorMessage = error.message || 'Login failed';
            set({
              isLoading: false,
              error: errorMessage
            });
            throw error;
          }
        },

        // Register
        register: async (userData: RegisterRequest) => {
          set({ isLoading: true, error: null });

          try {
            const response = await apiClient.register(userData);
            
            // Connect to socket
            await socketClient.connect(response.tokens);

            set({
              user: response.user,
              tokens: response.tokens,
              isAuthenticated: true,
              isLoading: false,
              error: null
            });

            console.log('✅ Registration successful:', response.user.username);
          } catch (error: any) {
            const errorMessage = error.message || 'Registration failed';
            set({
              isLoading: false,
              error: errorMessage
            });
            throw error;
          }
        },

        // Logout
        logout: async () => {
          set({ isLoading: true });

          try {
            // Disconnect socket first
            socketClient.disconnect();
            
            // Call logout API
            await apiClient.logout();

            set({
              user: null,
              tokens: null,
              isAuthenticated: false,
              isLoading: false,
              error: null
            });

            console.log('✅ Logout successful');
          } catch (error: any) {
            // Even if API call fails, clear local state
            socketClient.disconnect();
            apiClient.clearTokens();
            
            set({
              user: null,
              tokens: null,
              isAuthenticated: false,
              isLoading: false,
              error: null
            });

            console.warn('⚠️ Logout API call failed, but local state cleared');
          }
        },

        // Refresh User Data
        refreshUser: async () => {
          if (!get().isAuthenticated) return;

          try {
            const user = await apiClient.getCurrentUser();
            set({ user });
          } catch (error: any) {
            console.error('❌ Failed to refresh user:', error);
            // Don't logout automatically - user might be offline
          }
        },

        // Update Profile
        updateProfile: async (updates: Partial<User>) => {
          const { user } = get();
          if (!user) return;

          set({ isLoading: true, error: null });

          try {
            const updatedUser = await apiClient.updateProfile(updates);
            
            set({
              user: updatedUser,
              isLoading: false,
              error: null
            });

            console.log('✅ Profile updated successfully');
          } catch (error: any) {
            const errorMessage = error.message || 'Profile update failed';
            set({
              isLoading: false,
              error: errorMessage
            });
            throw error;
          }
        },

        // Clear Error
        clearError: () => {
          set({ error: null });
        },

        // Set Error
        setError: (error: string) => {
          set({ error });
        }
      }),
      {
        name: 'viber-auth',
        partialize: (state) => ({
          tokens: state.tokens,
          // Don't persist user data - refresh from server
        }),
      }
    ),
    {
      name: 'auth-store',
    }
  )
);

// Selectors for common use cases
export const selectUser = (state: AuthState) => state.user;
export const selectIsAuthenticated = (state: AuthState) => state.isAuthenticated;
export const selectIsLoading = (state: AuthState) => state.isLoading;
export const selectError = (state: AuthState) => state.error;