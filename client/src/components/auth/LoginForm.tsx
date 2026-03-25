/**
 * Login Form Component - The Gateway to Connection
 * 
 * Elegant login form with validation, error handling,
 * and smooth user experience.
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
  CircularProgress,
  Divider
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Email,
  Lock,
  Login as LoginIcon
} from '@mui/icons-material';
import { useAuthStore } from '../../store/authStore';
import { LoginRequest } from '../../types';

// Validation schema
const loginSchema = yup.object({
  identifier: yup
    .string()
    .required('Username or email is required')
    .min(3, 'Must be at least 3 characters'),
  password: yup
    .string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters')
});

interface LoginFormProps {
  onSuccess?: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    reset
  } = useForm<LoginRequest>({
    resolver: yupResolver(loginSchema),
    mode: 'onChange'
  });

  const onSubmit = async (data: LoginRequest) => {
    try {
      clearError();
      await login(data);
      reset();
      onSuccess?.();
      navigate('/chat');
    } catch (error) {
      // Error is handled by the store
      console.error('Login failed:', error);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Paper
      elevation={6}
      sx={{
        p: 4,
        maxWidth: 400,
        width: '100%',
        borderRadius: 2,
        background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)'
      }}
    >
      {/* Header */}
      <Box textAlign="center" mb={3}>
        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          sx={{
            fontWeight: 700,
            background: 'linear-gradient(45deg, #667eea 30%, #764ba2 90%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}
        >
          Welcome Back
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Sign in to continue your conversations
        </Typography>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert
          severity="error"
          onClose={clearError}
          sx={{ mb: 3 }}
        >
          {error}
        </Alert>
      )}

      {/* Login Form */}
      <Box component="form" onSubmit={handleSubmit(onSubmit)}>
        <TextField
          {...register('identifier')}
          fullWidth
          label="Username or Email"
          placeholder="Enter your username or email"
          error={!!errors.identifier}
          helperText={errors.identifier?.message}
          disabled={isLoading}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Email color="action" />
              </InputAdornment>
            )
          }}
          sx={{ mb: 2 }}
        />

        <TextField
          {...register('password')}
          fullWidth
          type={showPassword ? 'text' : 'password'}
          label="Password"
          placeholder="Enter your password"
          error={!!errors.password}
          helperText={errors.password?.message}
          disabled={isLoading}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Lock color="action" />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={togglePasswordVisibility}
                  edge="end"
                  disabled={isLoading}
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            )
          }}
          sx={{ mb: 3 }}
        />

        <Button
          type="submit"
          fullWidth
          variant="contained"
          size="large"
          disabled={!isValid || isLoading}
          startIcon={isLoading ? <CircularProgress size={20} /> : <LoginIcon />}
          sx={{
            py: 1.5,
            mb: 3,
            background: 'linear-gradient(45deg, #667eea 30%, #764ba2 90%)',
            boxShadow: '0 3px 5px 2px rgba(102, 126, 234, .3)',
            '&:hover': {
              background: 'linear-gradient(45deg, #5a67d8 30%, #6b46c1 90%)',
              boxShadow: '0 4px 8px 3px rgba(102, 126, 234, .4)'
            }
          }}
        >
          {isLoading ? 'Signing In...' : 'Sign In'}
        </Button>

        <Divider sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            or
          </Typography>
        </Divider>

        {/* Links */}
        <Box textAlign="center">
          <Typography variant="body2" color="text.secondary">
            Don't have an account?{' '}
            <Link
              to="/register"
              style={{
                color: '#667eea',
                textDecoration: 'none',
                fontWeight: 500
              }}
            >
              Sign up here
            </Link>
          </Typography>
        </Box>

        <Box textAlign="center" mt={2}>
          <Link
            to="/forgot-password"
            style={{
              color: '#9ca3af',
              textDecoration: 'none',
              fontSize: '0.875rem'
            }}
          >
            Forgot your password?
          </Link>
        </Box>
      </Box>

      {/* Footer */}
      <Box textAlign="center" mt={4}>
        <Typography variant="caption" color="text.secondary">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </Typography>
      </Box>
    </Paper>
  );
};

export default LoginForm;