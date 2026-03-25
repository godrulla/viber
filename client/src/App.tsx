/**
 * App Component - The Foundation of Connection
 * 
 * Main application component with routing, theme provider,
 * authentication handling, and global state management.
 */

import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { Box, CircularProgress, Typography } from '@mui/material';

import { useAuthStore } from './store/authStore';
import { useChatStore } from './store/chatStore';
import { socketClient } from './services/socketClient';

// Components
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ChatPage from './pages/ChatPage';
import LandingPage from './pages/LandingPage';

// Theme configuration
const theme = createTheme({
  palette: {
    primary: {
      main: '#667eea',
      light: '#8b9df2',
      dark: '#4c63d2',
    },
    secondary: {
      main: '#764ba2',
      light: '#9575b3',
      dark: '#5a3473',
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
    text: {
      primary: '#1a202c',
      secondary: '#718096',
    },
  },
  typography: {
    fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 600,
    },
    h4: {
      fontSize: '1.25rem',
      fontWeight: 600,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.6,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
          fontWeight: 500,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
  },
});

// Loading component
const LoadingScreen: React.FC = () => (
  <Box
    display="flex"
    flexDirection="column"
    alignItems="center"
    justifyContent="center"
    minHeight="100vh"
    bgcolor="background.default"
  >
    <CircularProgress size={60} sx={{ mb: 3 }} />
    <Typography variant="h6" color="text.secondary">
      Loading Viber...
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
      Connecting you to the world
    </Typography>
  </Box>
);

// Protected Route component
interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  redirectTo = '/login' 
}) => {
  const { isAuthenticated, isInitialized } = useAuthStore();

  if (!isInitialized) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};

// Public Route component (redirect to chat if authenticated)
interface PublicRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

const PublicRoute: React.FC<PublicRouteProps> = ({ 
  children, 
  redirectTo = '/chat' 
}) => {
  const { isAuthenticated, isInitialized } = useAuthStore();

  if (!isInitialized) {
    return <LoadingScreen />;
  }

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};

// Main App component
const App: React.FC = () => {
  const { initialize, isInitialized, isAuthenticated } = useAuthStore();
  const { reset: resetChat } = useChatStore();

  // Initialize auth on app start
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Setup socket event listeners
  useEffect(() => {
    // Connection events
    socketClient.on('socket:connected', () => {
      console.log('🔌 Socket connected to app');
    });

    socketClient.on('socket:disconnected', ({ reason }) => {
      console.log('🔌 Socket disconnected from app:', reason);
    });

    socketClient.on('socket:error', ({ error }) => {
      console.error('🔌 Socket error in app:', error);
    });

    // Cleanup on unmount
    return () => {
      socketClient.off('socket:connected');
      socketClient.off('socket:disconnected');
      socketClient.off('socket:error');
    };
  }, []);

  // Reset chat state on logout
  useEffect(() => {
    if (!isAuthenticated) {
      resetChat();
    }
  }, [isAuthenticated, resetChat]);

  if (!isInitialized) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <LoadingScreen />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
          <Routes>
            {/* Public Routes */}
            <Route 
              path="/" 
              element={
                <PublicRoute>
                  <LandingPage />
                </PublicRoute>
              } 
            />
            <Route 
              path="/login" 
              element={
                <PublicRoute>
                  <LoginPage />
                </PublicRoute>
              } 
            />
            <Route 
              path="/register" 
              element={
                <PublicRoute>
                  <RegisterPage />
                </PublicRoute>
              } 
            />

            {/* Protected Routes */}
            <Route 
              path="/chat" 
              element={
                <ProtectedRoute>
                  <ChatPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/chat/:channelId" 
              element={
                <ProtectedRoute>
                  <ChatPage />
                </ProtectedRoute>
              } 
            />

            {/* Catch all - redirect to appropriate page */}
            <Route 
              path="*" 
              element={
                <Navigate 
                  to={isAuthenticated ? '/chat' : '/'} 
                  replace 
                />
              } 
            />
          </Routes>
        </Router>
    </ThemeProvider>
  );
};

export default App;
