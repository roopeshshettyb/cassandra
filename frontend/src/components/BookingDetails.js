import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import request from '../helper/api';
import GuestPortal from './GuestPortal';
import { useHotelTheme } from '../context/HotelThemeContext';

function BookingDetails({ setLoading, account, navigate, alertError, alertSuccess, isMobile }) {
  const { id } = useParams();
  const { setThemeConfig } = useHotelTheme();
  const [booking, setBooking] = useState(null);

  useEffect(() => {
    if (id) {
      request({
        endpoint: `/bookings/${id}`,
        method: 'GET',
        setLoading,
        setData: (data) => {
          setBooking(data);
          setThemeConfig(data?.hotel?.themeConfig || null);
        },
        defaultData: null,
        alertError,
      });
    }
  }, [id, setThemeConfig]);

  useEffect(() => {
    return () => setThemeConfig(null);
  }, [setThemeConfig]);

  if (!booking) return null;

  return (
    <GuestPortal
      booking={booking}
      account={account}
      isMobile={isMobile}
      alertError={alertError}
      alertSuccess={alertSuccess}
      setLoading={setLoading}
      navigate={navigate}
    />
  );
}

export default BookingDetails;
