import React, { useState, useEffect } from 'react';
import { Box, IconButton, Button, Badge, Typography, useTheme } from '@mui/material';
import { Home, Menu, Login as LoginIcon, Logout, Dashboard, People, ShoppingCart, Notifications as NotificationsIcon, ArrowBack, Business, AttachMoney } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import MapComponent from './MapComponent';
import request from '../helper/api';

import { BORDER, NAV_BG } from '../theme/index';

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

const Sidebar = ({ toggleColorMode, mode, sidebarOpen, setSidebarOpen, isMobile, account, handleLogout, openLoginPopup, navigate, currentNav, setCurrentNav, smoothScrollToTop, loading }) => {
  const theme = useTheme();
  const location = useLocation();
  const sidebarWidth = isMobile ? '100vw' : '20vw';
  const sidebarOffset = isMobile ? '-100vw' : '-20vw';
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      if (account) {
        const notifications = await request({
          endpoint: '/notifications',
          method: 'GET',
          defaultData: [],
        });
        if (notifications) {
          const unread = notifications.filter((n) => !n.read).length;
          setUnreadCount(unread);
        }
      } else {
        setUnreadCount(0);
      }
    };
    fetchUnreadCount();
  }, [account, sidebarOpen]);

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
          display: 'flex',
          ...(data.variant && { variant: data.variant }),
        }}
      >
        {data.text}
      </Button>
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
                  bgcolor: 'rgba(0, 0, 0, 0.5)',
                  zIndex: 1499,
                }}
              />
            )}
            <MotionBox
              initial={{ x: isMobile ? sidebarOffset : 0 }}
              animate={{ x: 0 }}
              exit={{ x: sidebarOffset }}
              transition={{ duration: 0.3 }}
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
                  sx={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    zIndex: 1003,
                    color: 'text.primary',
                    padding: 0,
                    minWidth: 'auto',
                    '&:hover': {
                      bgcolor: 'transparent',
                    },
                  }}
                >
                  <Menu />
                </IconButton>
              )}

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start', mt: 'auto', px: 2, pb: 2 }}>
                <MapComponent
                  Component={NavButton}
                  data={navItems}
                  // account, navigate, etc are used inside NavButton or logic above,
                  // but MapComponent might pass them as props if it maps 'data' to 'Component'.
                  // Standard MapComponent usually iterates data and renders Component with item as 'data' prop.
                />
              </Box>
            </MotionBox>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;
