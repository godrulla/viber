/**
 * Landing Page - The First Impression
 * 
 * Beautiful hero page showcasing Viber's features and
 * encouraging users to join the platform.
 */

import React from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  Chip,
  Stack,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Chat,
  Groups,
  Notifications,
  Security,
  Speed,
  Public,
  ArrowForward,
  Login as LoginIcon,
  PersonAdd,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const LandingPage: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();

  const features = [
    {
      icon: <Chat sx={{ fontSize: 40 }} />,
      title: 'Real-time Messaging',
      description: 'Instant communication with lightning-fast message delivery and real-time updates.',
    },
    {
      icon: <Groups sx={{ fontSize: 40 }} />,
      title: 'Channel Management',
      description: 'Create public or private channels to organize conversations and communities.',
    },
    {
      icon: <Notifications sx={{ fontSize: 40 }} />,
      title: 'Smart Notifications',
      description: 'Stay informed with intelligent notifications and typing indicators.',
    },
    {
      icon: <Security sx={{ fontSize: 40 }} />,
      title: 'Secure & Private',
      description: 'End-to-end encryption and robust security to protect your conversations.',
    },
    {
      icon: <Speed sx={{ fontSize: 40 }} />,
      title: 'Lightning Fast',
      description: 'Optimized performance with instant message reactions and seamless experience.',
    },
    {
      icon: <Public sx={{ fontSize: 40 }} />,
      title: 'Global Reach',
      description: 'Connect with people worldwide with multi-language support and accessibility.',
    },
  ];

  return (
    <Box>
      {/* Hero Section */}
      <Box
        sx={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `
              radial-gradient(circle at 20% 80%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
              radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.08) 0%, transparent 50%),
              radial-gradient(circle at 40% 40%, rgba(255, 255, 255, 0.05) 0%, transparent 50%)
            `,
            animation: 'pulse 10s ease-in-out infinite',
          },
          '@keyframes pulse': {
            '0%, 100%': { opacity: 1, transform: 'scale(1)' },
            '50%': { opacity: 0.8, transform: 'scale(1.05)' },
          },
        }}
      >
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} alignItems="center" gap={4}>
            <Box flex={1}>
              <Stack spacing={4}>
                <Box>
                  <Chip
                    label="🚀 Now in Beta"
                    sx={{
                      backgroundColor: 'rgba(255, 255, 255, 0.2)',
                      color: 'white',
                      mb: 2,
                    }}
                  />
                  <Typography
                    variant="h2"
                    component="h1"
                    sx={{
                      color: 'white',
                      fontWeight: 700,
                      mb: 2,
                      fontSize: { xs: '2.5rem', md: '3.5rem' },
                      lineHeight: 1.2,
                    }}
                  >
                    Connect.
                    <br />
                    Collaborate.
                    <br />
                    <Box
                      component="span"
                      sx={{
                        background: 'linear-gradient(45deg, #FFD700 30%, #FFA500 90%)',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                      }}
                    >
                      Communicate.
                    </Box>
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{
                      color: 'rgba(255, 255, 255, 0.9)',
                      mb: 4,
                      fontWeight: 300,
                      lineHeight: 1.6,
                    }}
                  >
                    Experience the future of messaging with Viber. Real-time conversations,
                    powerful channels, and seamless collaboration in one beautiful platform.
                  </Typography>
                </Box>

                <Stack direction="row" spacing={2} flexWrap="wrap">
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<PersonAdd />}
                    endIcon={<ArrowForward />}
                    onClick={() => navigate('/register')}
                    sx={{
                      py: 1.5,
                      px: 3,
                      backgroundColor: 'white',
                      color: 'primary.main',
                      fontWeight: 600,
                      borderRadius: 2,
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        transform: 'translateY(-2px)',
                      },
                      transition: 'all 0.3s ease',
                    }}
                  >
                    Get Started Free
                  </Button>
                  <Button
                    variant="outlined"
                    size="large"
                    startIcon={<LoginIcon />}
                    onClick={() => navigate('/login')}
                    sx={{
                      py: 1.5,
                      px: 3,
                      color: 'white',
                      borderColor: 'rgba(255, 255, 255, 0.5)',
                      fontWeight: 500,
                      borderRadius: 2,
                      '&:hover': {
                        borderColor: 'white',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        transform: 'translateY(-2px)',
                      },
                      transition: 'all 0.3s ease',
                    }}
                  >
                    Sign In
                  </Button>
                </Stack>

                {/* Stats */}
                <Stack
                  direction="row"
                  spacing={4}
                  sx={{ pt: 2, color: 'rgba(255, 255, 255, 0.8)' }}
                >
                  <Box textAlign="center">
                    <Typography variant="h4" fontWeight="bold">
                      10K+
                    </Typography>
                    <Typography variant="body2">Active Users</Typography>
                  </Box>
                  <Box textAlign="center">
                    <Typography variant="h4" fontWeight="bold">
                      500+
                    </Typography>
                    <Typography variant="body2">Channels</Typography>
                  </Box>
                  <Box textAlign="center">
                    <Typography variant="h4" fontWeight="bold">
                      1M+
                    </Typography>
                    <Typography variant="body2">Messages Sent</Typography>
                  </Box>
                </Stack>
              </Stack>
            </Box>

            <Box flex={1}>
              <Box
                sx={{
                  display: { xs: 'none', md: 'block' },
                  textAlign: 'center',
                }}
              >
                {/* Placeholder for app preview/illustration */}
                <Paper
                  elevation={8}
                  sx={{
                    p: 4,
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: 3,
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                  }}
                >
                  <Typography
                    variant="h3"
                    sx={{ color: 'white', mb: 2 }}
                  >
                    💬
                  </Typography>
                  <Typography variant="h6" sx={{ color: 'white', mb: 2 }}>
                    Beautiful Chat Interface
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                    Clean, modern design with powerful features
                    that make communication a joy.
                  </Typography>
                </Paper>
              </Box>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Features Section */}
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Box textAlign="center" mb={6}>
          <Typography variant="h3" component="h2" gutterBottom>
            Why Choose Viber?
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto' }}>
            Discover the features that make Viber the perfect platform
            for modern communication and collaboration.
          </Typography>
        </Box>

        <Box display="flex" flexWrap="wrap" gap={4}>
          {features.map((feature, index) => (
            <Box key={index} sx={{ width: { xs: '100%', md: 'calc(50% - 16px)', lg: 'calc(33.333% - 16px)' } }}>
              <Paper
                elevation={2}
                sx={{
                  p: 3,
                  height: '100%',
                  borderRadius: 2,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: theme.shadows[8],
                  },
                }}
              >
                <Box
                  sx={{
                    color: 'primary.main',
                    mb: 2,
                  }}
                >
                  {feature.icon}
                </Box>
                <Typography variant="h6" component="h3" gutterBottom>
                  {feature.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {feature.description}
                </Typography>
              </Paper>
            </Box>
          ))}
        </Box>
      </Container>

      {/* CTA Section */}
      <Box
        sx={{
          py: 8,
          background: 'linear-gradient(45deg, #f8f9fa 0%, #e9ecef 100%)',
        }}
      >
        <Container maxWidth="md">
          <Box textAlign="center">
            <Typography variant="h3" component="h2" gutterBottom>
              Ready to Start Connecting?
            </Typography>
            <Typography
              variant="h6"
              color="text.secondary"
              sx={{ mb: 4, maxWidth: 500, mx: 'auto' }}
            >
              Join thousands of users already communicating better with Viber.
              It's free to get started!
            </Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              justifyContent="center"
            >
              <Button
                variant="contained"
                size="large"
                startIcon={<PersonAdd />}
                onClick={() => navigate('/register')}
                sx={{
                  py: 1.5,
                  px: 4,
                  background: 'linear-gradient(45deg, #667eea 30%, #764ba2 90%)',
                  fontWeight: 600,
                  borderRadius: 2,
                  '&:hover': {
                    background: 'linear-gradient(45deg, #5a67d8 30%, #6b46c1 90%)',
                    transform: 'translateY(-2px)',
                  },
                  transition: 'all 0.3s ease',
                }}
              >
                Create Free Account
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<LoginIcon />}
                onClick={() => navigate('/login')}
                sx={{
                  py: 1.5,
                  px: 4,
                  fontWeight: 500,
                  borderRadius: 2,
                  '&:hover': {
                    transform: 'translateY(-2px)',
                  },
                  transition: 'all 0.3s ease',
                }}
              >
                Sign In
              </Button>
            </Stack>
          </Box>
        </Container>
      </Box>

      {/* Footer */}
      <Box
        sx={{
          py: 4,
          backgroundColor: 'primary.main',
          color: 'white',
        }}
      >
        <Container maxWidth="lg">
          <Box textAlign="center">
            <Typography variant="h5" fontWeight="bold" gutterBottom>
              Viber
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              © 2024 Viber. Built with ❤️ for better communication.
            </Typography>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default LandingPage;