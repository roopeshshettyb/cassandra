import React from 'react';
import { Box, Grid, Typography, Button, Card, CardContent, Stack, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HotelIcon from '@mui/icons-material/Hotel';
import HeadsetMicIcon from '@mui/icons-material/HeadsetMic';
import ScheduleIcon from '@mui/icons-material/Schedule';
import MapComponent from './MapComponent';
import constants from '../constants.json';

const HomePointer = ({ data }) => {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          mt: 1,
          bgcolor: 'primary.main',
        }}
      />
      <Typography variant="body1" color="text.secondary">
        {data.text}
      </Typography>
    </Box>
  );
};

const HomeLogoCard = ({ data }) => {
  return (
    <Grid item xs={12} md={4}>
      <Card
        variant="outlined"
        sx={{
          height: '100%',
          bgcolor: 'background.paper',
        }}
      >
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'primary.main',
            }}
          >
            {data.icon}
          </Box>
          <Typography variant="h6" color="text.primary">
            {data.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {data.subtitle}
          </Typography>
        </CardContent>
      </Card>
    </Grid>
  );
};

const FaqItem = ({ data, index }) => {
  return (
    <Accordion defaultExpanded={index === 0} sx={{ mb: 1 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle1" color="text.primary">
          {data.question}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Typography variant="body2" color="text.secondary">
          {data.answer}
        </Typography>
      </AccordionDetails>
    </Accordion>
  );
};

const Home = ({ openLoginPopup, navigate, isMobile }) => {
  const pointerData = [
    {
      text: 'Instant answers to common guest questions.',
    },
    {
      text: 'Understands your rooms, policies, and services.',
    },
    {
      text: 'Always on, even when your team is not.',
    },
  ];

  const cardData = [
    {
      title: 'Support guests in-stay',
      subtitle: 'Handle requests about Wi‑Fi, amenities, room service, and more while guests are already checked in.',
      icon: <HotelIcon sx={{ color: 'text.primary' }} />,
    },
    {
      title: 'Lighten front desk workload',
      subtitle: `Let ${constants.APP_NAME} handle repetitive questions so your team can focus on high-touch service.`,
      icon: <HeadsetMicIcon sx={{ color: 'text.primary' }} />,
    },
    {
      title: 'Delight guests at every step',
      subtitle: `From pre-stay questions to late checkout, ${constants.APP_NAME} keeps guests informed and cared for.`,
      icon: <ScheduleIcon sx={{ color: 'text.primary' }} />,
    },
  ];

  const faqData = [
    {
      question: `Where does ${constants.APP_NAME} live in my hotel journey?`,
      answer: `${constants.APP_NAME} sits on your website and guest-facing touchpoints, helping guests discover rooms, ask questions, and move seamlessly into a booking.`,
    },
    {
      question: `Does ${constants.APP_NAME} replace my staff?`,
      answer: `No. ${constants.APP_NAME} takes care of repetitive conversations so your team can focus on high-value, human interactions with guests.`,
    },
    {
      question: 'How quickly can we get started?',
      answer: 'You can start with your existing website and channels. Once you log in, we guide you through a short setup tailored to your property.',
    },
  ];

  const handleGetStarted = () => {
    openLoginPopup?.();
  };

  const handleTalkToUs = () => {
    navigate('/contact');
  };

  return (
    <Box
      sx={{
        minHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        px: { xs: 2, sm: 4, md: 6 },
        py: { xs: 3, sm: 5 },
        gap: 8,
      }}
    >
      {/* Section 1: Hero with 3 pointers and hero image */}
      <Box component="section">
        <Grid container spacing={isMobile ? 4 : 6} alignItems="center">
          <Grid item xs={12} md={6}>
            <Stack spacing={3}>
              <Typography variant="h3" color="text.primary">
                Meet {constants.APP_NAME}, your AI hotel receptionist.
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {constants.DESCRIPTION}
              </Typography>
              <Stack spacing={2}>
                <MapComponent Component={HomePointer} data={pointerData} isLoading={false} />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button variant="contained" color="primary" onClick={handleGetStarted}>
                  {`Get started with ${constants.APP_NAME}`}
                </Button>
                <Button variant="outlined" color="primary" onClick={handleTalkToUs}>
                  Talk to us
                </Button>
              </Stack>
            </Stack>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box
              component="img"
              src={constants.HERO}
              alt={`${constants.APP_NAME} AI hotel assistant`}
              sx={{
                width: '100%',
                maxHeight: 420,
                objectFit: 'cover',
                borderRadius: 3,
                boxShadow: 3,
              }}
            />
          </Grid>
        </Grid>
      </Box>

      {/* Section 2: Three cards in one row */}
      <Box component="section">
        <Typography variant="h5" color="text.primary" gutterBottom>
          What {constants.APP_NAME} does for your hotel
        </Typography>
        <Grid container spacing={3}>
          <MapComponent Component={HomeLogoCard} data={cardData} isLoading={false} />
        </Grid>
      </Box>

      {/* Section 3: FAQs */}
      <Box component="section">
        <Typography variant="h5" color="text.primary" gutterBottom>
          Frequently asked questions
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {`A quick overview of how ${constants.APP_NAME} fits into your guest journey.`}
        </Typography>
        <MapComponent Component={FaqItem} data={faqData} isLoading={false} />
      </Box>

      {/* Section 4: Final CTA */}
      <Box
        component="section"
        sx={{
          textAlign: 'center',
          py: 4,
        }}
      >
        <Typography variant="h4" color="text.primary" gutterBottom>
          Ready to let {constants.APP_NAME} welcome your next guest?
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Log in to connect your property and see how {constants.APP_NAME} transforms your guest conversations.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
          <Button variant="contained" color="primary" onClick={handleGetStarted}>
            Get started
          </Button>
          <Button variant="outlined" color="primary" onClick={handleTalkToUs}>
            Book a quick walkthrough
          </Button>
        </Stack>
      </Box>
    </Box>
  );
};

export default Home;

