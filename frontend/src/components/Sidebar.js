import React, { useState, useEffect } from 'react';
import { Box, IconButton, Button, Badge, Typography } from '@mui/material';
import { Brightness4, Brightness7, Home, Menu, Login as LoginIcon, Logout, Dashboard, People, ShoppingCart, Notifications as NotificationsIcon, ArrowBack } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import MapComponent from './MapComponent';
import request from '../helper/api';

const MotionBox = motion(Box);

const Sidebar = ({ toggleColorMode, mode, sidebarOpen, setSidebarOpen, isMobile, account, handleLogout, openLoginPopup, navigate, currentNav, setCurrentNav, smoothScrollToTop, loading }) => {
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

  const NavButton = ({ data, account, navigate, setSidebarOpen, unreadCount, smoothScrollToTop, currentNav }) => {
    const Icon = data.icon;
    let shouldShow = data.protectedNavItem === true ? account && account?.id : true;
    if (data.text === 'Login') {
      shouldShow = !account;
    }
    if (data.link) {
      data.action = () => {
        navigate(data.link);
        smoothScrollToTop();
        setSidebarOpen(false);
      };
    }
    const showBadge = data.showBadge && unreadCount > 0;
    const isActive = currentNav === data.text;
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
        onClick={data.action}
        sx={{
          color: isActive ? 'primary.main' : 'text.primary',
          textTransform: 'none',
          justifyContent: 'flex-start',
          minWidth: 'auto',
          px: 2,
          display: shouldShow ? 'flex' : 'none',
          ...(data.variant && { variant: data.variant }),
        }}
      >
        {data.text}
      </Button>
    );
  };

  const commonNavItems = [
    {
      key: 'Login',
      icon: LoginIcon,
      text: 'Login',
      link: null,
      action: () => {
        openLoginPopup();
      },
      variant: 'outlined',
      protectedNavItem: false,
    },
    {
      key: 'Logout',
      icon: Logout,
      text: 'Logout',
      link: null,
      action: () => {
        handleLogout();
      },
      variant: 'outlined',
      protectedNavItem: true,
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
  ];

  const roleSpecificNavItems = {
    admin: [
      {
        key: 'Manage Hotels',
        icon: Dashboard,
        text: 'Manage Hotels',
        link: '/hotels',
        protectedNavItem: true,
      },
    ],
    hotel_owner: [
      {
        key: 'Manage Hotels',
        icon: Dashboard,
        text: 'Manage Hotels',
        link: '/hotels',
        protectedNavItem: true,
      },
    ],
    hotel_staff: [
      {
        key: 'Manage Hotels',
        icon: Dashboard,
        text: 'Manage Hotels',
        link: '/hotels',
        protectedNavItem: true,
      },
    ],
  };

  const navItems = [];

  if (account && account.role && roleSpecificNavItems[account.role]) {
    navItems.push(...roleSpecificNavItems[account.role]);
  }

  navItems.push(...commonNavItems);

  useEffect(() => {
    const pathname = location.pathname;
    const allNavItems = [...navItems];

    for (const item of allNavItems) {
      if (item.link) {
        if (item.link === '/') {
          if (pathname === '/') {
            setCurrentNav(item.key || item.text);
            return;
          }
        } else if (pathname.startsWith(item.link)) {
          setCurrentNav(item.key || item.text);
          return;
        }
      }
    }
  }, [location.pathname, account, navItems, setCurrentNav]);

  return (
    <>
      {(!sidebarOpen || !isMobile) && (
        <IconButton
          onClick={() => navigate(-1)}
          sx={{
            position: 'fixed',
            top: 16,
            right: 16,
            zIndex: sidebarOpen ? 998 : 1001,
            color: 'text.primary',
            padding: 0,
            minWidth: 'auto',
            '&:hover': {
              bgcolor: 'transparent',
            },
          }}
        >
          <ArrowBack />
        </IconButton>
      )}
      {isMobile && !sidebarOpen && (
        <Box
          sx={{
            position: 'fixed',
            top: 16,
            left: 16,
            zIndex: 1001,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <IconButton
            onClick={() => setSidebarOpen(!sidebarOpen)}
            sx={{
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
          {currentNav && (
            <Typography
              sx={{
                color: 'text.primary',
                fontWeight: 600,
                fontSize: '1rem',
              }}
            >
              {currentNav}
            </Typography>
          )}
        </Box>
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
                  zIndex: 999,
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
                borderRight: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                flexDirection: 'column',
                py: 2,
                gap: 2,
                zIndex: 1002,
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
                {/* <IconButton onClick={toggleColorMode} sx={{ color: 'primary.main' }}>
                  {mode === 'dark' ? <Brightness7 /> : <Brightness4 />}
                </IconButton> */}
                <MapComponent
                  Component={NavButton}
                  data={navItems}
                  account={account}
                  navigate={navigate}
                  setSidebarOpen={setSidebarOpen}
                  unreadCount={unreadCount}
                  smoothScrollToTop={smoothScrollToTop}
                  currentNav={currentNav}
                  isLoading={loading}
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
