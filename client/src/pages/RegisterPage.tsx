/**
 * Register Page - Where New Connections Begin
 * 
 * Beautiful registration page with animated background and comprehensive form.
 */

import React from 'react';
import { Box, Container } from '@mui/material';
import RegisterForm from '../components/auth/RegisterForm';

const RegisterPage: React.FC = () => {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
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
            radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 20% 80%, rgba(118, 75, 162, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 60% 60%, rgba(102, 126, 234, 0.2) 0%, transparent 50%)
          `,
          animation: 'drift 8s ease-in-out infinite',
        },
        '@keyframes drift': {
          '0%, 100%': { transform: 'translate(0, 0) rotate(0deg)' },
          '25%': { transform: 'translate(-30px, 20px) rotate(90deg)' },
          '50%': { transform: 'translate(20px, -20px) rotate(180deg)' },
          '75%': { transform: 'translate(30px, 30px) rotate(270deg)' },
        },
      }}
    >
      <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="100vh"
          py={4}
        >
          <RegisterForm />
        </Box>
      </Container>
    </Box>
  );
};

export default RegisterPage;