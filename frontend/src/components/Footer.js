import React from 'react';
import { Box, Typography, Link, Container, Grid } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import constants from '../constants.json';
const { APP_NAME } = constants;

const Footer = ({ mode, smoothScrollToTop }) => {
  const navigate = useNavigate();

  const handleLinkClick = (path) => {
    navigate(path);
    if (smoothScrollToTop) {
      smoothScrollToTop();
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }
  };

  return (
    <Box
      component="footer"
      sx={{
        bgcolor: mode === 'dark' ? '#1a1a1a' : '#f5f5f5',
        borderTop: `1px solid ${mode === 'dark' ? '#333' : '#e0e0e0'}`,
        py: 4,
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              {APP_NAME}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Connecting creators and advertisers for authentic social media placements.
            </Typography>
          </Grid>
          <Grid item xs={12} md={4}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              Legal
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Link
                component="button"
                variant="body2"
                onClick={() => handleLinkClick('/privacy-policy')}
                sx={{
                  color: 'text.secondary',
                  textDecoration: 'none',
                  cursor: 'pointer',
                  '&:hover': {
                    color: 'primary.main',
                    textDecoration: 'underline',
                  },
                  textAlign: 'left',
                }}
              >
                Privacy Policy
              </Link>
              <Link
                component="button"
                variant="body2"
                onClick={() => handleLinkClick('/fees-refund-policy')}
                sx={{
                  color: 'text.secondary',
                  textDecoration: 'none',
                  cursor: 'pointer',
                  '&:hover': {
                    color: 'primary.main',
                    textDecoration: 'underline',
                  },
                  textAlign: 'left',
                }}
              >
                Fees and Refund Policy
              </Link>
              <Link
                component="button"
                variant="body2"
                onClick={() => handleLinkClick('/terms-conditions')}
                sx={{
                  color: 'text.secondary',
                  textDecoration: 'none',
                  cursor: 'pointer',
                  '&:hover': {
                    color: 'primary.main',
                    textDecoration: 'underline',
                  },
                  textAlign: 'left',
                }}
              >
                Terms and Conditions
              </Link>
              {/* <Link
                component="button"
                variant="body2"
                onClick={() => handleLinkClick('/shipping-delivery-policy')}
                sx={{
                  color: 'text.secondary',
                  textDecoration: 'none',
                  cursor: 'pointer',
                  '&:hover': {
                    color: 'primary.main',
                    textDecoration: 'underline',
                  },
                  textAlign: 'left',
                }}
              >
                Shipping & Delivery Policy
              </Link> */}
              <Link
                component="button"
                variant="body2"
                onClick={() => handleLinkClick('/contact')}
                sx={{
                  color: 'text.secondary',
                  textDecoration: 'none',
                  cursor: 'pointer',
                  '&:hover': {
                    color: 'primary.main',
                    textDecoration: 'underline',
                  },
                  textAlign: 'left',
                }}
              >
                Contact Us
              </Link>
            </Box>
          </Grid>
        </Grid>
        <Box sx={{ mt: 4, pt: 3, borderTop: `1px solid ${mode === 'dark' ? '#333' : '#e0e0e0'}` }}>
          <Typography variant="body2" color="text.secondary" align="center">
            © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;
