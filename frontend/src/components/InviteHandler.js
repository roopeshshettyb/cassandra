import React, { useEffect, useRef } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import request from '../helper/api';

const InviteHandler = ({ alertError, alertSuccess, setAccount, setLoading }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    const searchParams = new URLSearchParams(location.search || '');
    const token = searchParams.get('token');

    if (!token) {
      alertError?.('Invalid invite link');
      navigate('/');
      return;
    }

    const handleInvite = async () => {
      const response = await request({
        endpoint: '/invite',
        method: 'POST',
        data: { token },
        setLoading,
        alertError,
        throw: false,
      });

      if (!response || !response.success || !response.token) {
        alertError?.('This invite link is invalid or has expired. Please request a new one.');
        navigate('/');
        return;
      }

      const standardToken = response.token;
      const account = response.account;

      localStorage.setItem('token', standardToken);
      if (account) {
        setAccount?.(account);
      }
      alertSuccess?.('You are now logged in.');
      navigate('/');
    };

    handleInvite();
  }, []);

  return (
    <Box
      sx={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        textAlign: 'center',
      }}
    >
      <Typography variant="h5" color="text.primary" gutterBottom>
        Verifying your invite…
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Please wait while we confirm your access.
      </Typography>
      <Button variant="text" onClick={() => navigate('/')}>
        Go to home
      </Button>
    </Box>
  );
};

export default InviteHandler;
