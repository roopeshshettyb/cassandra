import React, { useEffect } from 'react';
import { Box, IconButton, Button, Badge, Typography, Divider } from '@mui/material';
import { Home, Menu, Login as LoginIcon, Logout, Dashboard, People, ShoppingCart, Notifications as NotificationsIcon, ArrowBack, Business, AttachMoney, Layers, ChevronLeft, ChevronRight } from '@mui/icons-material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import MapComponent from './MapComponent';

import { BORDER, NAV_BG, BACKDROP_BG, BRAND_GRADIENT, PRIMARY_CONTRAST } from '../theme/index';

const MotionBox = motion(Box);

// --- Navigation Configuration ---
const COMMON_NAV_ITEMS = [
  {
    key: 'Home',
    icon: Home,
    text: 'Home',
    link: '/',
    variant: null,
    protectedNavItem: false,
  },
  {
    key: 'Login',
    icon: LoginIcon,
    text: 'Login',
    link: null,
    action: 'login', // Special action identifier
    variant: 'outlined',
    protectedNavItem: false,
  },
  {
    key: 'Notifications',
    icon: NotificationsIcon,
    text: 'Notifications',
    link: '/notifications',
    variant: null,
    protectedNavItem: true,
    showBadge: true,
  },
  {
    key: 'Logout',
    icon: Logout,
    text: 'Logout',
    link: null,
    action: 'logout', // Special action identifier
    variant: 'outlined',
    protectedNavItem: true,
  },
];

const ROLE_SPECIFIC_ITEMS = {
  admin: [
    { key: 'Dashboard', icon: Dashboard, text: 'Dashboard', link: '/dashboard', protectedNavItem: true },
    { key: 'Manage Hotels', icon: Business, text: 'Manage Hotels', link: '/hotels', protectedNavItem: true },
    { key: 'Manage Brands', icon: Layers, text: 'Manage Brands', link: '/brands', protectedNavItem: true },
    { key: 'Manage Bookings', icon: People, text: 'Manage Bookings', link: '/bookings', protectedNavItem: true },
    { key: 'Manage Requests', icon: ShoppingCart, text: 'Manage Requests', link: '/requests', protectedNavItem: true },
    { key: 'Manage Costs', icon: AttachMoney, text: 'Manage Costs', link: '/costs', protectedNavItem: true },
  ],
  hotel_owner: [
    { key: 'Dashboard', icon: Dashboard, text: 'Dashboard', link: '/dashboard', protectedNavItem: true },
    { key: 'Manage Hotels', icon: Business, text: 'Manage Hotels', link: '/hotels', protectedNavItem: true },
    { key: 'Manage Bookings', icon: People, text: 'Manage Bookings', link: '/bookings', protectedNavItem: true },
    { key: 'Manage Requests', icon: ShoppingCart, text: 'Manage Requests', link: '/requests', protectedNavItem: true },
  ],
  hotel_staff: [
    { key: 'Dashboard', icon: Dashboard, text: 'Dashboard', link: '/dashboard', protectedNavItem: true },
    { key: 'Manage Hotels', icon: Business, text: 'Manage Hotels', link: '/hotels', protectedNavItem: true },
    { key: 'Manage Bookings', icon: People, text: 'Manage Bookings', link: '/bookings', protectedNavItem: true },
    { key: 'Manage Requests', icon: ShoppingCart, text: 'Manage Requests', link: '/requests', protectedNavItem: true },
  ],
  guest: [
    { key: 'Dashboard', icon: Dashboard, text: 'Dashboard', link: '/dashboard', protectedNavItem: true },
    { key: 'Manage Bookings', icon: People, text: 'Manage Bookings', link: '/bookings', protectedNavItem: true },
  ],
};

const Sidebar = ({ toggleColorMode, mode, sidebarOpen, setSidebarOpen, isMobile, account, handleLogout, openLoginPopup, navigate, currentNav, setCurrentNav, smoothScrollToTop, loading, unreadCount, assistantOpen, onAssistantToggle, sidebarCollapsed, onToggleCollapsed }) => {
  const location = useLocation();
  const sidebarWidth = isMobile ? '100vw' : '20vw';
  const sidebarOffset = isMobile ? '-100vw' : '-20vw';

  // Merge items based on role
  const navItems = [...(account && account.role && ROLE_SPECIFIC_ITEMS[account.role] ? ROLE_SPECIFIC_ITEMS[account.role] : []), ...COMMON_NAV_ITEMS];

  useEffect(() => {
    const pathname = location.pathname;

    // Find the item that matches the current path.
    // We iterate through all items to find the best match.
    // Prioritize exact matches or detailed sub-paths if necessary,
    // but here referencing the original logic which was simple first-found or specific logic.

    // Simple logic: Check exact path first, then startsWith for non-root
    const activeItem = navItems.find((item) => {
      if (item.link === '/') return pathname === '/';
      return item.link && pathname.startsWith(item.link);
    });

    if (activeItem) {
      setCurrentNav(activeItem.key || activeItem.text);
    }
  }, [location.pathname, account, setCurrentNav]); // navItems is now derived from account/constant, so safe to omit or include if memoized. relying on account change.

  const NavButton = ({ data }) => {
    const Icon = data.icon;
    let shouldShow = data.protectedNavItem === true ? account && account?.id : true;
    if (data.text === 'Login') {
      shouldShow = !account;
    }

    const handleClick = () => {
      if (data.action === 'login') {
        if (isMobile) setSidebarOpen(false);
        openLoginPopup();
      } else if (data.action === 'logout') {
        handleLogout();
      } else if (data.link) {
        navigate(data.link);
        smoothScrollToTop();
        setSidebarOpen(false);
      }
    };

    const showBadge = data.showBadge && unreadCount > 0;
    const isActive = currentNav === data.text;

    if (!shouldShow) return null;

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
        <Button
          startIcon={
            showBadge ? (
              <Badge badgeContent={unreadCount} color="error">
                <Icon />
              </Badge>
            ) : (
              <Icon />
            )
          }
          onClick={handleClick}
          sx={{
            color: isActive ? 'primary.main' : 'text.primary',
            textTransform: 'none',
            justifyContent: 'flex-start',
            minWidth: 'auto',
            px: 2,
            flex: 1,
            ...(data.variant && { variant: data.variant }),
          }}
        >
          {data.text}
        </Button>
      </Box>
    );
  };

  const translucentBg = NAV_BG;

  return (
    <>
      {isMobile && !sidebarOpen && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: 64,
            zIndex: 1400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            background: translucentBg,
            backdropFilter: 'blur(10px)',
            borderBottom: `1px solid ${BORDER}`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton
              onClick={() => setSidebarOpen(true)}
              sx={{ color: 'text.primary', p: 0 }}
            >
              <Menu />
            </IconButton>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                fontSize: '1rem',
                color: 'text.primary',
              }}
            >
              {currentNav || 'Menu'}
            </Typography>
          </Box>
          <IconButton
            onClick={() => navigate(-1)}
            sx={{ color: 'text.primary', p: 0 }}
          >
            <ArrowBack />
          </IconButton>
        </Box>
      )}

      {/* Desktop Navigation Helper for back action if needed, or if mobile sidebar is open */}
      {!isMobile && (
        <IconButton
          onClick={() => navigate(-1)}
          sx={{
            position: 'fixed',
            top: 16,
            right: 16,
            zIndex: 1001,
            color: 'text.primary',
            '&:hover': { bgcolor: 'transparent' },
          }}
        >
          <ArrowBack />
        </IconButton>
      )}

      <AnimatePresence>
        {(sidebarOpen || !isMobile) && (
          <>
            {isMobile && sidebarOpen && (
              <Box
                onClick={() => setSidebarOpen(false)}
                sx={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  bgcolor: BACKDROP_BG,
                  zIndex: 1499,
                }}
              />
            )}
            <MotionBox
              initial={{ x: isMobile ? sidebarOffset : (sidebarCollapsed ? sidebarOffset : 0) }}
              animate={{ x: isMobile ? 0 : (sidebarCollapsed ? sidebarOffset : 0) }}
              exit={{ x: sidebarOffset }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              sx={{
                position: 'fixed',
                left: 0,
                top: 0,
                bottom: 0,
                width: sidebarWidth,
                bgcolor: 'background.paper',
                borderRight: `1px solid ${BORDER}`,
                display: 'flex',
                flexDirection: 'column',
                py: 2,
                gap: 2,
                zIndex: 1500,
                overflowY: 'auto',
                maxHeight: '100vh',
              }}
            >
              {isMobile && (
                <IconButton
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  sx={{ position: 'absolute', top: 16, right: 16, zIndex: 1003, color: 'text.primary', padding: 0, minWidth: 'auto', '&:hover': { bgcolor: 'transparent' } }}
                >
                  <Menu />
                </IconButton>
              )}
              {!isMobile && onToggleCollapsed && (
                <IconButton
                  onClick={onToggleCollapsed}
                  size="small"
                  sx={{ position: 'absolute', top: 12, right: 12, zIndex: 1003, color: 'text.secondary', '&:hover': { color: 'text.primary', bgcolor: 'action.hover' } }}
                >
                  <ChevronLeft fontSize="small" />
                </IconButton>
              )}

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 'auto', px: 2, pb: 2 }}>
                <MapComponent
                  Component={NavButton}
                  data={navItems}
                  // account, navigate, etc are used inside NavButton or logic above,
                  // but MapComponent might pass them as props if it maps 'data' to 'Component'.
                  // Standard MapComponent usually iterates data and renders Component with item as 'data' prop.
                />
                {account && account.role !== 'guest' && onAssistantToggle && (
                  <>
                    <Divider />
                    <Box
                      component={motion.div}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => { onAssistantToggle(); if (isMobile) setSidebarOpen(false); }}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        px: 1.5,
                        py: 1.25,
                        borderRadius: 2,
                        cursor: 'pointer',
                        background: assistantOpen ? BRAND_GRADIENT : 'transparent',
                        border: `1.5px solid ${assistantOpen ? 'transparent' : BORDER}`,
                        transition: 'all 0.2s',
                        '&:hover': { background: assistantOpen ? BRAND_GRADIENT : 'action.hover', opacity: assistantOpen ? 0.9 : 1 },
                      }}
                    >
                      <SmartToyIcon sx={{ fontSize: 18, color: assistantOpen ? PRIMARY_CONTRAST : 'text.secondary', flexShrink: 0 }} />
                      <Typography sx={{ fontSize: 14, fontWeight: 600, color: assistantOpen ? PRIMARY_CONTRAST : 'text.primary' }}>
                        AI Assistant
                      </Typography>
                    </Box>
                  </>
                )}
              </Box>
            </MotionBox>
          </>
        )}
      </AnimatePresence>

      {/* Desktop expand tab — visible only when collapsed */}
      <AnimatePresence>
        {!isMobile && sidebarCollapsed && onToggleCollapsed && (
          <motion.div
            key="expand-tab"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            style={{ position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 1499, display: 'flex', alignItems: 'center' }}
          >
            <Box
              onClick={onToggleCollapsed}
              sx={{
                width: 20,
                height: 56,
                bgcolor: 'background.paper',
                border: `1px solid ${BORDER}`,
                borderLeft: 'none',
                borderRadius: '0 8px 8px 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '2px 0 8px rgba(0,0,0,0.08)',
                '&:hover': { bgcolor: 'action.hover' },
                transition: 'background 0.15s',
              }}
            >
              <ChevronRight sx={{ fontSize: 14, color: 'text.secondary' }} />
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;