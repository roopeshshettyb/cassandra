import { useMemo, useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Grid, useMediaQuery, Box, Typography } from '@mui/material';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './utils/dayjsConfig';
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
import ManageBrands from './components/ManageBrands';
import BrandDetails from './components/BrandDetails';
import ManageBookings from './components/ManageBookings';
import BookingDetails from './components/BookingDetails';
import ManageRequests from './components/ManageRequests';
import RequestDetails from './components/RequestDetails';
import ManageCosts from './components/ManageCosts';
import Rooms from './components/Rooms';
import request from './helper/api';
import logger from './services/logger.service';
import LoginPopup from './components/LoginPopup';
import Loader from './components/Loader';
import { Analytics } from '@vercel/analytics/react';
import Home from './components/Home';
import constants from './constants.json';
import Dashboard from './components/Dashboard';
import InviteHandler from './components/InviteHandler';
import AllRounderWidget, { PANEL_WIDTH } from './components/AllRounder/AllRounderWidget';
import { HotelThemeProvider, useHotelTheme } from './context/HotelThemeContext';
import { BRAND_GRADIENT } from './theme/index';
import { useNotifications } from './notifications/hooks/useNotifications';

// Default theme if not in constants
const DEFAULT_THEME_DEFAULTS = {
  PRIMARY_COLOR: '#D4AF37',
  SECONDARY_COLOR: '#C5A022',
  NAVY_COLOR: '#1B2340',
  NAVY_LIGHT_COLOR: '#263462',
  PRIMARY_HOVER_COLOR: '#B8860B',
  BACKGROUND_DEFAULT_LIGHT: '#F8F7F4',
  BACKGROUND_DEFAULT_DARK: '#000000',
  BACKGROUND_PAPER_LIGHT: '#FFFFFF',
  BACKGROUND_PAPER_DARK: '#121212',
  FONT_FAMILY: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
};

// Ensure constants has THEME_DEFAULTS
if (!constants.THEME_DEFAULTS) {
  constants.THEME_DEFAULTS = DEFAULT_THEME_DEFAULTS;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}

const getContrastText = (hexcolor) => {
  if (!hexcolor || typeof hexcolor !== 'string') return '#000000';
  const hex = hexcolor.replace('#', '');
  if (hex.length !== 6) return '#000000';
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#000000' : '#FFFFFF';
};

const AppContent = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { themeConfig } = useHotelTheme();
  const [mode, setMode] = useState('light');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [account, setAccount] = useState(null);
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentNav, setCurrentNav] = useState('404');
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
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

  const token = localStorage.getItem('token');

  const {
    unreadCount,
    notifications,
    loading: notificationsLoading,
    markAsRead,
  } = useNotifications({
    enabled: !!account,
    token: token || undefined,
  });

  const notificationsInitialized = useRef(false);

  // Show toast only for NEW real-time notifications, not on initial fetch
  useEffect(() => {
    if (notifications.length === 0) return;
    if (!notificationsInitialized.current) {
      notificationsInitialized.current = true;
      return;
    }
    const latestNotification = notifications[0];
    if (!latestNotification.read) {
      toast.info(latestNotification.message, {
        position: 'top-right',
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    }
  }, [notifications.length]);

  useEffect(() => {
    const fetchAccount = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const result = await request({
            endpoint: '/accounts/me',
            method: 'GET',
            throw: true,
            alertError,
          });
          const accountData = result?.data;
          setAccount(accountData);

          // Guests: redirect to their active booking on login
          if (accountData?.role === constants.ACCOUNT_ROLES.GUEST && !pathname.startsWith('/bookings/')) {
            const bookingResult = await request({ endpoint: '/bookings/active', method: 'GET' });
            if (bookingResult?.data?.id) {
              navigate(`/bookings/${bookingResult.data.id}?tab=concierge`);
            }
          }
        } catch (error) {
          logger.error({
            message: 'Failed to fetch account',
            serviceName: 'App',
            actionName: 'fetchAccount',
            error,
          });
          if (error.code !== 'ERR_NETWORK') handleLogout();
        }
      }
      setLoading(false);
    };
    fetchAccount();
  }, []);

  // BRAND_GRADIENT / NAVY / NAVY_GRADIENT constants update automatically.
  useEffect(() => {
    const primary = themeConfig?.primaryColor || constants.THEME_DEFAULTS.PRIMARY_COLOR;
    const secondary = themeConfig?.secondaryColor || constants.THEME_DEFAULTS.SECONDARY_COLOR;
    const navy = themeConfig?.navyColor || constants.THEME_DEFAULTS.NAVY_COLOR;
    const navyLight = themeConfig?.navyLightColor || constants.THEME_DEFAULTS.NAVY_LIGHT_COLOR;
    const contrastText = getContrastText(primary);

    const r = document.documentElement.style;
    r.setProperty('--app-header-height', '64px');
    r.setProperty('--app-brand-gradient', `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`);
    r.setProperty('--app-navy-gradient', `linear-gradient(135deg, ${navy} 0%, ${navyLight} 100%)`);
    r.setProperty('--app-navy', navy);
    r.setProperty('--app-primary', primary);
    r.setProperty('--app-secondary', secondary);
    r.setProperty('--app-primary-contrast', contrastText);
    r.setProperty('--app-border', mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)');
    r.setProperty('--app-nav-bg', mode === 'dark' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.8)');
  }, [themeConfig, mode]);

  const theme = useMemo(() => {
    const primaryMain = themeConfig?.primaryColor || constants.THEME_DEFAULTS.PRIMARY_COLOR;
    const secondaryMain = themeConfig?.secondaryColor || constants.THEME_DEFAULTS.SECONDARY_COLOR;
    const darkTextSecondary = themeConfig?.secondaryColor || constants.THEME_DEFAULTS.PRIMARY_HOVER_COLOR;
    const bgDefault = themeConfig?.backgroundDefault || (mode === 'dark' ? constants.THEME_DEFAULTS.BACKGROUND_DEFAULT_DARK : constants.THEME_DEFAULTS.BACKGROUND_DEFAULT_LIGHT);
    const bgPaper = themeConfig?.backgroundPaper || (mode === 'dark' ? constants.THEME_DEFAULTS.BACKGROUND_PAPER_DARK : constants.THEME_DEFAULTS.BACKGROUND_PAPER_LIGHT);
    const fontFamily = themeConfig?.fontFamily || constants.THEME_DEFAULTS.FONT_FAMILY;

    // Use a temporary theme to access MUI's contrast calculation logic
    const baseTheme = createTheme();
    const contrastText = baseTheme.palette.getContrastText(primaryMain);

    return createTheme({
      palette: {
        mode,
        primary: {
          main: primaryMain,
          contrastText: contrastText,
        },
        secondary: { main: secondaryMain },
        background: {
          default: bgDefault,
          paper: bgPaper,
        },
        text: {
          primary: mode === 'dark' ? primaryMain : '#333333',
          secondary: mode === 'dark' ? darkTextSecondary : '#666666',
        },
      },
      typography: {
        fontFamily,
        h1: { fontWeight: 700, letterSpacing: '-0.02em' },
        h2: { fontWeight: 700, letterSpacing: '-0.01em' },
        h3: { fontWeight: 600 },
        h4: { fontWeight: 600 },
        h5: { fontWeight: 500 },
        h6: { fontWeight: 600 },
        body1: { fontSize: '1.1rem', lineHeight: 1.7 },
        body2: { lineHeight: 1.6 },
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
              color: contrastText,
              '&:hover': {
                backgroundColor: themeConfig?.primaryHoverColor || constants.THEME_DEFAULTS.PRIMARY_HOVER_COLOR,
              },
            },
          },
        },
        MuiAccordion: {
          styleOverrides: {
            root: {
              borderRadius: 8,
              '&:before': { display: 'none' },
            },
          },
        },
      },
    });
  }, [mode, themeConfig]);

  const toggleColorMode = () => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const isMobile = useMediaQuery('(max-width:768px)');

  useEffect(() => {
    if (!isMobile) setSidebarCollapsed(assistantOpen);
    const pw = !isMobile && typeof window !== 'undefined' && window.innerWidth <= 1024 ? Math.min(PANEL_WIDTH, Math.floor(window.innerWidth * 0.42)) : PANEL_WIDTH;
    document.documentElement.style.setProperty('--assistant-panel-right', !isMobile && assistantOpen ? `${pw}px` : '0px');
  }, [assistantOpen, isMobile]);

  // Close assistant + restore sidebar only on guest portal (bookings detail)
  useEffect(() => {
    if (pathname.startsWith('/bookings/') && pathname !== '/bookings') {
      setSidebarCollapsed(false);
    }
  }, [pathname]);

  const isLandingPage = pathname === '/';
  const isGuestPortal = pathname.startsWith('/bookings/') && pathname !== '/bookings';
  const isFullScreenMobile = isMobile && (
    pathname.startsWith('/requests/') ||
    pathname.startsWith('/bookings/')
  );
  // Also suppress footer/padding for request detail on desktop
  const isRequestDetail = pathname.startsWith('/requests/') && pathname !== '/requests';

  const routes = [
    { path: '/invite', component: InviteHandler, isProtected: false },
    { path: '/oauth/callback', component: OAuthCallback, isProtected: false },
    { path: '/dashboard', component: Dashboard, isProtected: true },
    { path: '/notifications', component: Notifications, isProtected: true },
    { path: '/privacy-policy', component: PrivacyPolicy, isProtected: false },
    { path: '/fees-refund-policy', component: FeesAndRefundPolicy, isProtected: false },
    { path: '/terms-conditions', component: TermsAndConditions, isProtected: false },
    { path: '/shipping-delivery-policy', component: ShippingDeliveryPolicy, isProtected: false },
    { path: '/contact', component: ContactUs, isProtected: false },
    { path: '/rooms', component: Rooms, isProtected: true },
    { path: '/hotels', component: ManageHotels, isProtected: true },
    { path: '/hotels/:id', component: HotelDetails, isProtected: true },
    { path: '/brands', component: ManageBrands, isProtected: true },
    { path: '/brands/:id', component: BrandDetails, isProtected: true },
    { path: '/bookings', component: ManageBookings, isProtected: true },
    { path: '/bookings/:id', component: BookingDetails, isProtected: true },
    { path: '/requests', component: ManageRequests, isProtected: true },
    { path: '/requests/:id', component: RequestDetails, isProtected: true },
    { path: '/costs', component: ManageCosts, isProtected: true },
  ];

  const smoothScrollToTop = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  };

  const commonProps = {
    isMobile,
    sidebarOpen,
    account,
    BRAND_GRADIENT,
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
    unreadCount,
    notifications,
    notificationsLoading: notificationsLoading,
    markNotificationAsRead: markAsRead,
  };

  const isAuthenticated = !!(account || token);

  return (
    <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Sidebar {...commonProps} assistantOpen={assistantOpen} onAssistantToggle={() => setAssistantOpen((p) => !p)} sidebarCollapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed((p) => !p)} />
        {account && (
          <AllRounderWidget
            account={account}
            navigate={navigate}
            alertError={alertError}
            isMobile={isMobile}
            open={assistantOpen}
            onOpenChange={setAssistantOpen}
          />
        )}
        <Box
          sx={{
            display: isMobile && sidebarOpen ? 'none' : 'flex',
            flexDirection: 'column',
            minHeight: '100dvh',
            ml: isMobile ? 0 : (sidebarCollapsed ? 0 : '20vw'),
            mr: !isMobile && assistantOpen ? 'var(--assistant-panel-right, 0px)' : 0,
            transition: 'margin-left 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), margin-right 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Grid sx={{ paddingTop: (isGuestPortal || isFullScreenMobile || isRequestDetail) ? 0 : { xs: 'calc(var(--app-header-height) + 2svh)', md: '3svh' } }}>
              <ScrollToTop />
              <Routes>
                <Route path="/" element={<Home openLoginPopup={openLoginPopup} navigate={navigate} isMobile={isMobile} account={account} />} />
                {routes.map((route) => {
                  const Component = route.component;
                  const element = <Component {...commonProps} />;
                  const guardedElement = route.isProtected && !isAuthenticated ? <Navigate to="/404" replace /> : element;
                  return <Route key={route.path} path={route.path} element={guardedElement} />;
                })}
                <Route
                  path="*"
                  element={
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        minHeight: '60vh',
                        p: 2,
                        gap: 2,
                      }}
                    >
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
            <ToastContainer position="top-right" autoClose={2000} hideProgressBar newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme={mode} />
          </Grid>
          {!isLandingPage && !isFullScreenMobile && !isRequestDetail && !isGuestPortal && <Footer mode={mode} smoothScrollToTop={smoothScrollToTop} />}
        </Box>
        <Analytics />
      </ThemeProvider>
    </GoogleOAuthProvider>
  );
};

function App() {
  return (
    <BrowserRouter>
      <HotelThemeProvider>
        <AppContent />
      </HotelThemeProvider>
    </BrowserRouter>
  );
}

export default App;
