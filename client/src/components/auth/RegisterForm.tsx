/**
 * Register Form Component - The Beginning of Journey
 * 
 * Comprehensive registration form with validation, real-time feedback,
 * and beautiful user experience.
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
  Divider,
  LinearProgress,
  Chip
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Email,
  Lock,
  Person,
  AccountCircle,
  PersonAdd
} from '@mui/icons-material';
import { useAuthStore } from '../../store/authStore';
import { RegisterRequest } from '../../types';

// Password strength checker
const checkPasswordStrength = (password: string): {
  score: number;
  label: string;
  color: 'error' | 'warning' | 'success';
} => {
  if (!password) return { score: 0, label: 'No password', color: 'error' };
  
  let score = 0;
  if (password.length >= 8) score += 25;
  if (password.length >= 12) score += 25;
  if (/[A-Z]/.test(password)) score += 15;
  if (/[a-z]/.test(password)) score += 15;
  if (/\d/.test(password)) score += 10;
  if (/[^A-Za-z0-9]/.test(password)) score += 10;

  if (score <= 40) return { score, label: 'Weak', color: 'error' };
  if (score <= 70) return { score, label: 'Fair', color: 'warning' };
  return { score, label: 'Strong', color: 'success' };
};

// Validation schema
const registerSchema = yup.object({
  username: yup
    .string()
    .required('Username is required')
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username cannot exceed 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  email: yup
    .string()
    .required('Email is required')
    .email('Please enter a valid email address'),
  password: yup
    .string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain uppercase, lowercase, number, and special character'
    ),
  firstName: yup
    .string()
    .max(30, 'First name cannot exceed 30 characters')
    .optional(),
  lastName: yup
    .string()
    .max(30, 'Last name cannot exceed 30 characters')
    .optional()
});

interface RegisterFormProps {
  onSuccess?: () => void;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ onSuccess }) => {
  const navigate = useNavigate();
  const { register: registerUser, isLoading, error, clearError } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
    reset
  } = useForm<RegisterRequest>({
    resolver: yupResolver(registerSchema) as any,
    mode: 'onChange'
  });

  const watchedPassword = watch('password', '');
  const passwordStrength = checkPasswordStrength(watchedPassword);

  const onSubmit = async (data: RegisterRequest) => {
    try {
      clearError();
      await registerUser(data);
      reset();
      onSuccess?.();
      navigate('/chat');
    } catch (error) {
      // Error is handled by the store
      console.error('Registration failed:', error);
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
        maxWidth: 500,
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
          Join Viber
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Create your account to start connecting
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

      {/* Registration Form */}
      <Box component="form" onSubmit={handleSubmit(onSubmit as any)}>
        {/* Name Fields */}
        <Box display="flex" gap={2} sx={{ mb: 2 }}>
          <TextField
            {...register('firstName')}
            fullWidth
            label="First Name"
            placeholder="Your first name"
            error={!!errors.firstName}
            helperText={errors.firstName?.message}
            disabled={isLoading}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Person color="action" />
                </InputAdornment>
              )
            }}
          />
          <TextField
            {...register('lastName')}
            fullWidth
            label="Last Name"
            placeholder="Your last name"
            error={!!errors.lastName}
            helperText={errors.lastName?.message}
            disabled={isLoading}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Person color="action" />
                </InputAdornment>
              )
            }}
          />
        </Box>

        {/* Username */}
        <TextField
          {...register('username')}
          fullWidth
          label="Username"
          placeholder="Choose a unique username"
          error={!!errors.username}
          helperText={errors.username?.message || 'This will be your unique identifier'}
          disabled={isLoading}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <AccountCircle color="action" />
              </InputAdornment>
            )
          }}
          sx={{ mb: 2 }}
        />

        {/* Email */}
        <TextField
          {...register('email')}
          fullWidth
          type="email"
          label="Email Address"
          placeholder="your.email@example.com"
          error={!!errors.email}
          helperText={errors.email?.message || 'We\'ll use this for account verification'}
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

        {/* Password */}
        <TextField
          {...register('password')}
          fullWidth
          type={showPassword ? 'text' : 'password'}
          label="Password"
          placeholder="Create a strong password"
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
          sx={{ mb: 1 }}
        />

        {/* Password Strength Indicator */}
        {watchedPassword && (
          <Box sx={{ mb: 2 }}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
              <Typography variant="caption" color="text.secondary">
                Password Strength
              </Typography>
              <Chip
                size="small"
                label={passwordStrength.label}
                color={passwordStrength.color}
                variant="outlined"
              />
            </Box>
            <LinearProgress
              variant="determinate"
              value={passwordStrength.score}
              color={passwordStrength.color}
              sx={{
                height: 6,
                borderRadius: 3,
                backgroundColor: 'rgba(0, 0, 0, 0.1)',
              }}
            />
          </Box>
        )}

        {/* Submit Button */}
        <Button
          type="submit"
          fullWidth
          variant="contained"
          size="large"
          disabled={!isValid || isLoading}
          startIcon={isLoading ? <CircularProgress size={20} /> : <PersonAdd />}
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
          {isLoading ? 'Creating Account...' : 'Create Account'}
        </Button>

        <Divider sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            or
          </Typography>
        </Divider>

        {/* Links */}
        <Box textAlign="center">
          <Typography variant="body2" color="text.secondary">
            Already have an account?{' '}
            <Link
              to="/login"
              style={{
                color: '#667eea',
                textDecoration: 'none',
                fontWeight: 500
              }}
            >
              Sign in here
            </Link>
          </Typography>
        </Box>
      </Box>

      {/* Footer */}
      <Box textAlign="center" mt={4}>
        <Typography variant="caption" color="text.secondary">
          By creating an account, you agree to our{' '}
          <Link to="/terms" style={{ color: '#667eea', textDecoration: 'none' }}>
            Terms of Service
          </Link>
          {' '}and{' '}
          <Link to="/privacy" style={{ color: '#667eea', textDecoration: 'none' }}>
            Privacy Policy
          </Link>
        </Typography>
      </Box>
    </Paper>
  );
};

export default RegisterForm;