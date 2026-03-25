/**
 * Chat Page - The Communication Hub
 * 
 * Main chat interface with channels sidebar, message area,
 * and real-time features.
 */

import React, { useEffect } from 'react';
import { Box, Paper, Typography, useTheme, useMediaQuery } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';

const ChatPage: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const { channelId } = useParams<{ channelId?: string }>();
  
  const { user } = useAuthStore();
  const {
    channels,
    activeChannelId,
    setActiveChannel,
    loadChannels,
    isLoading,
    error
  } = useChatStore();

  // Load channels on mount
  useEffect(() => {
    loadChannels().catch(error => {
      console.error('Failed to load channels:', error);
    });
  }, [loadChannels]);

  // Set active channel from URL
  useEffect(() => {
    if (channelId) {
      setActiveChannel(channelId);
    }
  }, [channelId, setActiveChannel]);

  // Navigate to first channel if none selected
  useEffect(() => {
    if (channels.length > 0 && !activeChannelId && !channelId) {
      navigate(`/chat/${channels[0]._id}`, { replace: true });
    }
  }, [channels, activeChannelId, channelId, navigate]);

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      }}
    >
      {/* Header */}
      <Paper
        elevation={2}
        sx={{
          p: 2,
          borderRadius: 0,
          background: 'linear-gradient(45deg, #667eea 30%, #764ba2 90%)',
          color: 'white',
        }}
      >
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h5" fontWeight="bold">
            Viber
          </Typography>
          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="body1">
              Welcome back, {user?.profile?.displayName || user?.username}!
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Main Chat Area */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', width: '100%', height: '100%' }}>
          {/* Channels Sidebar */}
          <Box
            sx={{
              width: { xs: '100%', md: '25%' },
              borderRight: '1px solid',
              borderColor: 'divider',
              display: { xs: 'none', md: 'block' }
            }}
          >
            <Paper
              sx={{
                height: '100%',
                borderRadius: 0,
                p: 2,
                backgroundColor: '#f8f9fa'
              }}
            >
              <Typography variant="h6" gutterBottom color="primary">
                Channels
              </Typography>
              
              {isLoading && (
                <Typography variant="body2" color="text.secondary">
                  Loading channels...
                </Typography>
              )}
              
              {error && (
                <Typography variant="body2" color="error">
                  {error}
                </Typography>
              )}
              
              {channels.map((channel) => (
                <Box
                  key={channel._id}
                  onClick={() => navigate(`/chat/${channel._id}`)}
                  sx={{
                    p: 2,
                    mb: 1,
                    borderRadius: 1,
                    cursor: 'pointer',
                    backgroundColor: activeChannelId === channel._id ? 'primary.main' : 'transparent',
                    color: activeChannelId === channel._id ? 'white' : 'text.primary',
                    '&:hover': {
                      backgroundColor: activeChannelId === channel._id ? 'primary.dark' : 'action.hover',
                    },
                  }}
                >
                  <Typography variant="body1" fontWeight="medium">
                    # {channel.name}
                  </Typography>
                  {channel.description && (
                    <Typography variant="caption" sx={{ opacity: 0.8 }}>
                      {channel.description}
                    </Typography>
                  )}
                </Box>
              ))}
            </Paper>
          </Box>

          {/* Messages Area */}
          <Box sx={{ flex: 1 }}>
            <Box
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {activeChannelId ? (
                <>
                  {/* Channel Header */}
                  <Paper
                    sx={{
                      p: 2,
                      borderRadius: 0,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography variant="h6">
                      # {channels.find(c => c._id === activeChannelId)?.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {channels.find(c => c._id === activeChannelId)?.description}
                    </Typography>
                  </Paper>

                  {/* Messages Container */}
                  <Box
                    sx={{
                      flex: 1,
                      p: 2,
                      overflow: 'auto',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Box textAlign="center">
                      <Typography variant="h6" color="text.secondary" gutterBottom>
                        🚀 Chat Interface Coming Soon!
                      </Typography>
                      <Typography variant="body1" color="text.secondary">
                        We're building an amazing chat experience for you.
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                        Features in development:
                      </Typography>
                      <Box component="ul" sx={{ textAlign: 'left', maxWidth: 300, mx: 'auto' }}>
                        <Typography component="li" variant="body2" color="text.secondary">
                          Real-time messaging
                        </Typography>
                        <Typography component="li" variant="body2" color="text.secondary">
                          Message reactions & editing
                        </Typography>
                        <Typography component="li" variant="body2" color="text.secondary">
                          File sharing & media
                        </Typography>
                        <Typography component="li" variant="body2" color="text.secondary">
                          Typing indicators
                        </Typography>
                        <Typography component="li" variant="body2" color="text.secondary">
                          User presence
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  {/* Message Input Area */}
                  <Paper
                    sx={{
                      p: 2,
                      borderRadius: 0,
                      borderTop: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: 60,
                        backgroundColor: 'action.hover',
                        borderRadius: 1,
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        Message input will be here...
                      </Typography>
                    </Box>
                  </Paper>
                </>
              ) : (
                <Box
                  sx={{
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Box textAlign="center">
                    <Typography variant="h5" color="text.secondary" gutterBottom>
                      Welcome to Viber! 👋
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      {channels.length > 0
                        ? 'Select a channel from the sidebar to start chatting'
                        : 'No channels available. Create one to get started!'}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default ChatPage;