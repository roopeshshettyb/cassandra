import React, { useState, useEffect } from 'react';
import { Box, Button, Badge, TextField, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { GoogleLogin } from '@react-oauth/google';
import request from '../helper/api';
import MapComponent from './MapComponent';
import logger from '../services/logger.service';
import constants from '../constants.json';

const MotionBox = motion(Box);

const RESEND_COOLDOWN_SECONDS = 60;

const LoginPopup = ({ showLoginPopup, closeLoginPopup, account, alertError, navigate, setAccount }) => {
  const [emailFlowStep, setEmailFlowStep] = useState(null);
  const [emailValue, setEmailValue] = useState('');
  const [otpValue, setOtpValue] = useState('');
  const [sendOtpLoading, setSendOtpLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  if (!showLoginPopup) return null;

  const handleGoogleLoginSuccess = async (credentialResponse) => {
    const id_token = credentialResponse.credential || credentialResponse.access_token;
    navigate(`/oauth/callback?authType=google&id_token=${id_token}`);
  };

  const handleSendOtp = async () => {
    const email = emailValue?.trim();
    if (!email) {
      alertError?.('Please enter your email');
      return;
    }
    setSendOtpLoading(true);
    try {
      await request({
        endpoint: '/oauth/email/send-otp',
        method: 'POST',
        data: { email },
        alertError,
        throw: true,
      });
      setEmailFlowStep('otp');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      logger.error({
        error: err,
        traces: [{ provider: 'email' }],
        serviceName: 'LoginPopup',
        actionName: 'handleSendOtp',
      });
    } finally {
      setSendOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    await handleSendOtp();
  };

  const handleVerifyOtp = async () => {
    const email = emailValue?.trim();
    const otp = otpValue?.trim();
    if (!email || !otp) {
      alertError?.('Please enter the code from your email');
      return;
    }
    setVerifyLoading(true);
    try {
      const response = await request({
        endpoint: '/oauth/callback',
        method: 'POST',
        data: { authType: 'email', email, otp },
        alertError,
        throw: true,
      });
      sessionStorage.setItem('token', response.token);
      setAccount?.(response.account);
      closeLoginPopup?.();
      navigate?.('/dashboard');
    } catch (err) {
      logger.error({
        error: err,
        traces: [{ provider: 'email' }],
        serviceName: 'LoginPopup',
        actionName: 'handleVerifyOtp',
      });
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleEmailFlowBack = () => {
    setEmailFlowStep(null);
    setEmailValue('');
    setOtpValue('');
  };

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

  const LoginButton = ({ data, onError, onEmailSignInClick }) => {
    const signInPrefix = 'Sign in with';
    const buttonLabel = `${signInPrefix} ${data.label}`;

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

    if (data.provider === 'email') {
      return (
        <Button {...buttonStyle} onClick={onEmailSignInClick}>
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

  const renderEmailForm = () => {
    if (emailFlowStep === 'email') {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left' }}>
          <Typography variant="body2" color="text.secondary">
            Enter your email and we&apos;ll send you a one-time code.
          </Typography>
          <TextField fullWidth label="Email" type="email" value={emailValue} onChange={(e) => setEmailValue(e.target.value)} placeholder="you@example.com" disabled={sendOtpLoading} />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" onClick={handleEmailFlowBack} disabled={sendOtpLoading} sx={{ textTransform: 'none' }}>
              Back
            </Button>
            <Button variant="contained" onClick={handleSendOtp} disabled={sendOtpLoading} sx={{ textTransform: 'none', flex: 1 }}>
              {sendOtpLoading ? 'Sending…' : 'Send code'}
            </Button>
          </Box>
        </Box>
      );
    }
    if (emailFlowStep === 'otp') {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left' }}>
          <Typography variant="body2" color="text.secondary">
            We sent a code to <strong>{emailValue}</strong>. Enter it below.
          </Typography>
          <TextField
            fullWidth
            label="Verification code"
            value={otpValue}
            onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            inputProps={{ maxLength: 6, inputMode: 'numeric' }}
            disabled={verifyLoading}
          />
          <Button variant="contained" fullWidth onClick={handleVerifyOtp} disabled={verifyLoading} sx={{ textTransform: 'none' }}>
            {verifyLoading ? 'Verifying…' : 'Verify'}
          </Button>
          <Button variant="text" fullWidth onClick={handleResendOtp} disabled={resendCooldown > 0 || sendOtpLoading} sx={{ textTransform: 'none' }}>
            {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
          </Button>
          <Button variant="text" fullWidth onClick={handleEmailFlowBack} sx={{ textTransform: 'none' }}>
            Back to sign-in options
          </Button>
        </Box>
      );
    }
    return null;
  };

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
          width: { xs: '90%', sm: '400px' },
          maxWidth: '500px',
          boxSizing: 'border-box',
        }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 0 }}>
          {emailFlowStep ? (
            renderEmailForm()
          ) : (
            <MapComponent Component={LoginButton} data={loginOptions} onError={handleError} profiles={[]} onEmailSignInClick={() => setEmailFlowStep('email')} isLoading={false} />
          )}
        </Box>
      </MotionBox>
    </MotionBox>
  );
};

export default LoginPopup;
