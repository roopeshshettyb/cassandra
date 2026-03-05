import React, { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import request from '../helper/api';
import logger from '../services/logger.service';
import constants from '../constants.json';

const ACCOUNT_ROLES = constants?.ACCOUNT_ROLES;

const OAuthCallback = ({ setAccount, fetchProfiles, navigate, alertError }) => {
  const preProcessForX = (code, state) => {
    if (!code) {
      navigate('/');
      return null;
    }

    const storedState = localStorage.getItem('oauth_state');
    const codeVerifier = localStorage.getItem('oauth_code_verifier');

    if (state !== storedState) {
      throw new Error('Invalid state parameter');
    }

    return {
      authType: 'x',
      code,
      codeVerifier,
      redirectUri: `${process.env.REACT_APP_FRONTEND_URL}/oauth/callback?authType=x`,
    };
  };

  const preProcessForGoogle = (id_token) => {
    if (!id_token) {
      navigate('/');
      return null;
    }

    return {
      authType: 'google',
      id_token,
    };
  };

  const postProcessForX = () => {
    localStorage.removeItem('oauth_state');
    localStorage.removeItem('oauth_code_verifier');
    localStorage.removeItem('oauth_account_type');
  };

  const [searchParams] = useSearchParams();

  const handleCallback = async () => {
    const code = searchParams.get('code');
    const authType = searchParams.get('authType');
    const state = searchParams.get('state');
    const id_token = searchParams.get('id_token');

    if (!authType) {
      navigate('/');
      return;
    }

    let payload;
    const accountType = localStorage.getItem('accountType') || localStorage.getItem('oauth_account_type');

    switch (authType) {
      case 'x':
        payload = preProcessForX(code, state);
        if (!payload) return;
        break;
      case 'google':
        payload = preProcessForGoogle(id_token);
        if (!payload) return;
        break;
      default:
        navigate('/');
        return;
    }

    if (accountType) {
      payload.accountType = accountType;
    }

    try {
      const response = await request({
        alertError,
        endpoint: `/oauth/callback`,
        method: 'POST',
        data: payload,
        throw: true,
      });

      localStorage.setItem('token', response.token);

      switch (authType) {
        case 'x':
          postProcessForX();
          break;
      }

      const loggedInAccount = response.account;
      setAccount(loggedInAccount);

      const role = loggedInAccount?.role;
      if (role === ACCOUNT_ROLES.ADMIN || role === ACCOUNT_ROLES.HOTEL_OWNER || role === ACCOUNT_ROLES.HOTEL_STAFF) {
        window.location.href = '/hotels';
      } else if (role === ACCOUNT_ROLES.GUEST) {
        const active = await request({ endpoint: '/bookings/active', method: 'GET', defaultData: null });
        window.location.href = active?.data?.id ? `/bookings/${active.data.id}` : '/bookings';
      } else {
        window.location.href = '/';
      }
    } catch (error) {
      logger.error({
        error,
        traces: [{ authType }],
        serviceName: 'OAuthCallback',
        actionName: 'handleCallback',
      });

      switch (authType) {
        case 'x':
          postProcessForX();
          break;
      }
      navigate('/');
    }
  };
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;
    handleCallback();
  }, []);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 2,
      }}
    >
      <CircularProgress />
      <Typography variant="body1">Completing login...</Typography>
    </Box>
  );
};

export default OAuthCallback;
