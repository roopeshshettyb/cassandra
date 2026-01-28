import React, { useMemo, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Grid, useMediaQuery, Box } from '@mui/material';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import LandingPage from './components/LandingPage';
import Sidebar from './components/Sidebar';
import OAuthCallback from './components/OAuthCallback';
import Dashboard from './components/Dashboard';
import Notifications from './components/Notifications';
import PrivacyPolicy from './components/PrivacyPolicy';
import FeesAndRefundPolicy from './components/FeesAndRefundPolicy';
import TermsAndConditions from './components/TermsAndConditions';
import ShippingDeliveryPolicy from './components/ShippingDeliveryPolicy';
import ContactUs from './components/ContactUs';
import Footer from './components/Footer';
import request from './helper/api';
import logger from './services/logger.service';
import LoginPopup from './components/LoginPopup';
import Loader from './components/Loader';
import { Analytics } from '@vercel/analytics/react';

const AppContent = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState('dark');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [account, setAccount] = useState(null);
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentNav, setCurrentNav] = useState('Home');

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
            main: '#6366f1',
          },
          secondary: {
            main: '#8b5cf6',
          },
          background: {
            default: mode === 'dark' ? '#0a0a0a' : '#ffffff',
            paper: mode === 'dark' ? '#1a1a1a' : '#ffffff',
          },
          text: {
            primary: mode === 'dark' ? '#ffffff' : '#1a1a1a',
            secondary: mode === 'dark' ? '#a0a0a0' : '#6b7280',
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
      path: '/',
      component: LandingPage,
      isProtected: false,
    },
    {
      path: '/oauth/callback',
      component: OAuthCallback,
      isProtected: false,
    },
    {
      path: '/dashboard',
      component: Dashboard,
      isProtected: true,
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
                {routes.map((route) => {
                  const Component = route.component;
                  const element = <Component {...commonProps} />;
                  return <Route key={route.path} path={route.path} element={element} />;
                })}
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
