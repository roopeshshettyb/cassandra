import React, { useEffect, useState } from 'react';
import { Box, Container, Grid, Typography, Card, CardContent, Divider, Stack } from '@mui/material';
import { motion } from 'framer-motion';
import request from '../helper/api';
import ChatBox from './ChatBox';
import RequestCard from './cards/RequestCard';
import BookingCard from './cards/BookingCard';
import { findMostRelevantBooking } from '../utils/bookingUtils';

const MotionBox = motion(Box);

const Dashboard = ({ setLoading, account, navigate, alertError, isMobile }) => {
  const [bookings, setBookings] = useState([]);
  const [requests, setRequests] = useState([]);
  const [latestBooking, setLatestBooking] = useState(null);

  const fetchBookings = async () => {
    await request({
      endpoint: '/bookings',
      method: 'GET',
      setLoading,
      setData: (data) => {
        setBookings(data);
        if (data && data.length > 0) {
          if (data && data.length > 0) {
            const activeOrUpcoming = findMostRelevantBooking(data);
            setLatestBooking(activeOrUpcoming);
          }
        }
      },
      defaultData: [],
      alertError,
    });
  };

  const fetchRequests = async () => {
    await request({
      endpoint: '/requests',
      method: 'GET',
      setLoading,
      setData: setRequests,
      defaultData: [],
      alertError,
    });
  };

  useEffect(() => {
    fetchBookings();
    fetchRequests();
  }, []);

  const isGuest = account?.role === 'guest';
  const recentBookings = bookings.slice(0, 3);
  const recentRequests = requests.slice(0, 3);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <MotionBox initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        {isGuest && latestBooking && (
          <Box sx={{ mb: 6 }}>
            <Typography variant="h5" sx={{ mb: 2, fontWeight: 'medium' }}>
              {latestBooking.isWithinStay ? 'Current Stay' : 'Upcoming / Recent Stay'}
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={8}>
                <Card sx={{ height: '100%', borderRadius: 3, boxShadow: 3 }}>
                  <CardContent sx={{ height: '100%', p: 0, '&:last-child': { pb: 0 } }}>
                    {/* ChatBox embedded directly */}
                    <ChatBox
                      bookingId={latestBooking.id}
                      alertError={alertError}
                      isWithinStay={latestBooking.isWithinStay}
                      avatarConfig={latestBooking.hotel?.avatarConfig}
                      isMobile={isMobile}
                      setLoading={setLoading}
                      dataset={null} // Pass null or minimal data if needed
                      isDashboard={true}
                    />
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <BookingCard
                  data={latestBooking}
                  navigate={navigate}
                  pendingRequestsCount={requests.filter((r) => r.bookingId === latestBooking.id && r.status !== 'completed' && r.status !== 'cancelled').length}
                />
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Recent Requests Section */}
        <Box sx={{ mb: 6 }}>
          <Typography variant="h5" sx={{ mb: 2, fontWeight: 'medium' }}>
            Recent Requests
          </Typography>
          {recentRequests.length > 0 ? (
            <Grid container spacing={3}>
              {recentRequests.map((req) => (
                <Grid item xs={12} sm={6} md={4} key={req.id}>
                  <RequestCard data={req} navigate={navigate} account={account} />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Typography variant="body1" color="text.secondary">
              No recent requests found.
            </Typography>
          )}
        </Box>

        {/* Recent Bookings Section */}
        <Box sx={{ mb: 6 }}>
          <Typography variant="h5" sx={{ mb: 2, fontWeight: 'medium' }}>
            Recent Bookings
          </Typography>
          {recentBookings.length > 0 ? (
            <Grid container spacing={3}>
              {recentBookings.map((booking) => (
                <Grid item xs={12} sm={6} md={4} key={booking.id}>
                  <BookingCard data={booking} navigate={navigate} />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Typography variant="body1" color="text.secondary">
              No recent bookings found.
            </Typography>
          )}
        </Box>
      </MotionBox>
    </Container>
  );
};

export default Dashboard;
