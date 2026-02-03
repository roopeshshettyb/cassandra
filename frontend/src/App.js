import React, { useMemo, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Grid, useMediaQuery, Box, Typography } from '@mui/material';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Sidebar from './components/Sidebar';
import OAuthCallback from './components/OAuthCallback';
import Notifications from './components/Notifications';
import PrivacyPolicy from './components/PrivacyPolicy';
import FeesAndRefundPolicy from './components/FeesAndRefundPolicy';
import TermsAndConditions from './components/TermsAndConditions';
import ShippingDeliveryPolicy from './components/ShippingDeliveryPolicy';
import ContactUs from './components/ContactUs';
import Footer from './components/Footer';
import ManageHotels from './components/ManageHotels';
import HotelDetails from './components/HotelDetails';
import Rooms from './components/Rooms';
import constants from './constants.json';
import request from './helper/api';
import logger from './services/logger.service';
import LoginPopup from './components/LoginPopup';
import Loader from './components/Loader';
import { Analytics } from '@vercel/analytics/react';

const ACCOUNT_ROLES = constants && constants.ACCOUNT_ROLES;

const RoleBasedHome = ({ account }) => {
  if (!account) {
    return <Navigate to="/rooms" replace />;
  }

  const role = account.role;

  if (role === ACCOUNT_ROLES.ADMIN || role === ACCOUNT_ROLES.HOTEL_OWNER || role === ACCOUNT_ROLES.HOTEL_STAFF) {
    return <Navigate to="/hotels" replace />;
  }

  return <Navigate to="/rooms" replace />;
};

const AppContent = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState('light');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [account, setAccount] = useState(null);
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentNav, setCurrentNav] = useState('404');

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    setAccount(null);
    window.location.href = '/';
  };

  const openLoginPopup = () => {
    setShowLoginPopup(true);
  };

  const closeLoginPopup = () => {
    setShowLoginPopup(false);
  };

  const fetchProfiles = async () => {
    return request({
      endpoint: '/profiles',
      method: 'GET',
      setLoading,
      defaultData: [],
    });
  };

  const alertSuccess = (message) => {
    toast.success(message);
  };

  const alertError = (message) => {
    toast.error(message);
  };

  useEffect(() => {
    const fetchAccount = async () => {
      const token = sessionStorage.getItem('token');
      if (token) {
        try {
          await request({
            endpoint: '/accounts/me',
            method: 'GET',
            throw: true,
            setData: setAccount,
            alertError,
          });
        } catch (error) {
          logger.error({
            message: 'Failed to fetch account',
            serviceName: 'App',
            actionName: 'fetchAccount',
            error,
          });
          handleLogout();
        }
      }
    };
    fetchAccount();
  }, []);

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: {
            main: '#D4AF37', // Gold
          },
          secondary: {
            main: '#C5A022', // Slightly different gold for secondary
          },
          background: {
            default: mode === 'dark' ? '#000000' : '#F5F5F5',
            paper: mode === 'dark' ? '#121212' : '#FFFFFF',
          },
          text: {
            primary: mode === 'dark' ? '#D4AF37' : '#333333',
            secondary: mode === 'dark' ? '#B8860B' : '#666666',
          },
        },
        typography: {
          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
          h1: {
            fontWeight: 700,
            letterSpacing: '-0.02em',
          },
          h2: {
            fontWeight: 700,
            letterSpacing: '-0.01em',
          },
          h3: {
            fontWeight: 600,
          },
          h4: {
            fontWeight: 600,
          },
          h5: {
            fontWeight: 500,
          },
          h6: {
            fontWeight: 600,
          },
          body1: {
            fontSize: '1.1rem',
            lineHeight: 1.7,
          },
          body2: {
            lineHeight: 1.6,
          },
        },
        components: {
          MuiCard: {
            styleOverrides: {
              root: {
                borderRadius: 12,
                boxShadow: mode === 'dark' ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)',
              },
            },
          },
          MuiButton: {
            styleOverrides: {
              root: {
                textTransform: 'none',
                borderRadius: 8,
                fontWeight: 600,
              },
              containedPrimary: {
                color: '#000000',
                '&:hover': {
                  backgroundColor: '#B8860B',
                },
              },
            },
          },
          MuiAccordion: {
            styleOverrides: {
              root: {
                borderRadius: 8,
                '&:before': {
                  display: 'none',
                },
              },
            },
          },
        },
      }),
    [mode],
  );

  const toggleColorMode = () => {
    setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
  };

  const isMobile = useMediaQuery('(max-width:768px)');

  const routes = [
    {
      path: '/oauth/callback',
      component: OAuthCallback,
      isProtected: false,
    },
    {
      path: '/notifications',
      component: Notifications,
      isProtected: true,
    },
    {
      path: '/privacy-policy',
      component: PrivacyPolicy,
      isProtected: false,
    },
    {
      path: '/fees-refund-policy',
      component: FeesAndRefundPolicy,
      isProtected: false,
    },
    {
      path: '/terms-conditions',
      component: TermsAndConditions,
      isProtected: false,
    },
    {
      path: '/shipping-delivery-policy',
      component: ShippingDeliveryPolicy,
      isProtected: false,
    },
    {
      path: '/contact',
      component: ContactUs,
      isProtected: false,
    },
    {
      path: '/rooms',
      component: Rooms,
      isProtected: false,
    },
    {
      path: '/hotels',
      component: ManageHotels,
      isProtected: true,
    },
    {
      path: '/hotels/:id',
      component: HotelDetails,
      isProtected: true,
    },
  ];

  const smoothScrollToTop = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  };

  const commonProps = {
    isMobile,
    sidebarOpen,
    account,
    openLoginPopup,
    closeLoginPopup,
    loading,
    setLoading,
    fetchProfiles,
    navigate,
    setAccount,
    alertSuccess,
    alertError,
    showLoginPopup,
    toggleColorMode,
    setSidebarOpen,
    handleLogout,
    mode,
    currentNav,
    setCurrentNav,
    smoothScrollToTop,
  };

  const token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
  const isAuthenticated = !!(account || token);

  return (
    <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Sidebar {...commonProps} />
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: '130vh',
            ml: isMobile ? 0 : '20vw',
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Grid style={{ paddingTop: '20px' }}>
              <Routes>
                <Route path="/" element={<RoleBasedHome account={account} />} />
                {routes.map((route) => {
                  const Component = route.component;
                  const element = <Component {...commonProps} />;

                  const guardedElement = route.isProtected && !isAuthenticated ? <Navigate to="/404" replace /> : element;

                  return <Route key={route.path} path={route.path} element={guardedElement} />;
                })}
                <Route
                  path="*"
                  element={
                    <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', p: 2, gap: 2 }}>
                      <img src="/404.gif" alt="Page not found" style={{ maxWidth: '100%', height: 'auto', mixBlendMode: 'multiply' }} />
                      <Typography variant="body1" color="text.secondary">
                        You seem to be lost. There&apos;s nothing here.
                      </Typography>
                    </Box>
                  }
                />
              </Routes>
            </Grid>
          </Box>
          <LoginPopup {...commonProps} />
          {loading && <Loader isMobile={isMobile} />}
          <Grid style={{ padding: '10px' }}>
            {' '}
            <ToastContainer position="top-right" autoClose={2000} hideProgressBar={true} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme={mode} />
          </Grid>
          <Footer mode={mode} smoothScrollToTop={smoothScrollToTop} />
        </Box>
        <Analytics />
      </ThemeProvider>
    </GoogleOAuthProvider>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
