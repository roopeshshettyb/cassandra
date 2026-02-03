import React from 'react';
import { Box, Button, Badge } from '@mui/material';
import { motion } from 'framer-motion';
import { GoogleLogin } from '@react-oauth/google';
import request from '../helper/api';
import MapComponent from './MapComponent';
import logger from '../services/logger.service';
import constants from '../constants.json';

const MotionBox = motion(Box);

const LoginPopup = ({ showLoginPopup, closeLoginPopup, account, alertError, navigate }) => {
  if (!showLoginPopup) return null;

  // Add this function in AppContent
  const handleGoogleLoginSuccess = async (credentialResponse) => {
    const id_token = credentialResponse.credential || credentialResponse.access_token;
    navigate(`/oauth/callback?authType=google&id_token=${id_token}`);
  };

  const LoginButton = ({ data, onError, profiles }) => {
    const signInPrefix = 'Sign in with';
    const buttonLabel = `${signInPrefix} ${data.label}`;
    const buttonStyle = {
      variant: 'outlined',
      fullWidth: true,
      sx: {
        textTransform: 'none',
        py: 1.5,
        justifyContent: 'center',
        px: 2,
        bgcolor: 'background.paper',
        color: 'text.primary',
        borderColor: 'divider',
        '&:hover': {
          bgcolor: 'action.hover',
          borderColor: 'primary.main',
        },
      },
    };

    if (data.provider === 'google') {
      return (
        <GoogleLogin
          onSuccess={handleGoogleLoginSuccess}
          onError={onError || (() => {})}
          useOneTap={false}
          render={({ onClick }) => (
            <Button {...buttonStyle} onClick={onClick}>
              {buttonLabel}
            </Button>
          )}
        />
      );
    }

    if (data.provider === 'x') {
      const handleXLogin = async () => {
        try {
          const clientId = process.env.REACT_APP_X_CLIENT_ID;
          const accountType = localStorage.getItem('accountType');
          const redirectUri = `${process.env.REACT_APP_FRONTEND_URL}/oauth/callback?authType=x`;
          const scope = 'tweet.read users.read offline.access';
          const state = Math.random().toString(36).substring(7);
          const codeChallenge = Math.random().toString(36).substring(7);
          const codeChallengeMethod = 'plain';

          localStorage.setItem('oauth_state', state);
          localStorage.setItem('oauth_code_verifier', codeChallenge);
          if (accountType) {
            localStorage.setItem('oauth_account_type', accountType);
          }

          const authUrl = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(
            scope,
          )}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=${codeChallengeMethod}`;

          window.location.href = authUrl;
        } catch (err) {
          logger.error({
            error: err,
            traces: [{ provider: 'x' }],
            serviceName: 'LoginButton',
            actionName: 'handleXLogin',
          });
          if (onError) {
            onError(err);
          }
        }
      };

      return (
        <Button {...buttonStyle} onClick={handleXLogin}>
          {buttonLabel}
        </Button>
      );
    }

    return (
      <Badge badgeContent="Soon" color="primary" sx={{ width: '100%' }}>
        <Button
          {...buttonStyle}
          onClick={(e) => e.preventDefault()}
          sx={{
            ...buttonStyle.sx,
            pointerEvents: 'none',
          }}
        >
          {buttonLabel}
        </Button>
      </Badge>
    );
  };

  const handleError = (error) => {
    logger.error({
      error,
      serviceName: 'LoginPopup',
      actionName: 'handleError',
    });
  };

  const loginOptions = constants.PLATFORM_DATA_MAPPING?.general?.LOGIN_OPTIONS || [];

  return (
    <MotionBox
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={closeLoginPopup}
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backdropFilter: 'blur(10px)',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 1300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      <MotionBox
        onClick={(e) => e.stopPropagation()}
        sx={{
          textAlign: 'center',
          cursor: 'default',
          bgcolor: 'background.paper',
          borderRadius: 2,
          p: 4,
          minWidth: { xs: '90%', sm: '400px' },
          maxWidth: '500px',
        }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 0 }}>
          <MapComponent Component={LoginButton} data={loginOptions} onError={handleError} profiles={[]} />
        </Box>
      </MotionBox>
    </MotionBox>
  );
};

export default LoginPopup;
