import React, { useState, useEffect } from 'react';
import { Container, Grid, Typography, Box, Button, Card, Accordion, AccordionSummary, AccordionDetails, useTheme } from '@mui/material';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { useRef } from 'react';
import { ExpandMore, Security, VerifiedUser, TrendingUp, Payment, CheckCircle, Search } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import MapComponent from './MapComponent';

const MotionBox = motion(Box);
const MotionCard = motion(Card);
const MotionTypography = motion(Typography);
const MotionButton = motion(Button);

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 },
};

const staggerContainer = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const scaleIn = {
  initial: { opacity: 0, scale: 0.8 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.5 },
};

const StepCard = ({ data }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <MotionCard ref={ref} initial="initial" animate={isInView ? 'animate' : 'initial'} variants={scaleIn} sx={{ p: 3, height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mr: 2,
            fontWeight: 'bold',
          }}
        >
          {data.number}
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {data.title}
        </Typography>
      </Box>
      <Typography variant="body1" color="text.secondary">
        {data.description}
      </Typography>
    </MotionCard>
  );
};

const BenefitCard = ({ data }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const theme = useTheme();

  return (
    <MotionCard
      ref={ref}
      initial="initial"
      animate={isInView ? 'animate' : 'initial'}
      variants={scaleIn}
      sx={{
        p: 4,
        height: '100%',
        background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.mode === 'dark' ? 'rgba(212, 175, 55, 0.1)' : 'rgba(212, 175, 55, 0.05)'} 100%)`,
        border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(212, 175, 55, 0.3)' : 'rgba(212, 175, 55, 0.2)'}`,
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: theme.palette.mode === 'dark' ? '0 8px 24px rgba(212, 175, 55, 0.3)' : '0 8px 24px rgba(212, 175, 55, 0.2)',
          borderColor: theme.palette.primary.main,
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 0 }}>
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: 2,
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mr: 2,
            flexShrink: 0,
          }}
        >
          {data.icon}
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {data.title}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.7 }}>
            {data.description}
          </Typography>
        </Box>
      </Box>
    </MotionCard>
  );
};

const FAQItem = ({ data, index = 0 }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  return (
    <MotionBox ref={ref} initial={{ opacity: 0, y: 20 }} animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }} transition={{ delay: index * 0.1 }} sx={{ mb: 2 }}>
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {data.question}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body1" color="text.secondary">
            {data.answer}
          </Typography>
        </AccordionDetails>
      </Accordion>
    </MotionBox>
  );
};

const HeroPopup = ({ open, onSelectInfluencer, onSelectAdvertiser }) => {
  if (!open) return null;

  return (
    <MotionBox
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onSelectInfluencer}
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backdropFilter: 'blur(10px)',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 1300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      <MotionBox
        onClick={(e) => e.stopPropagation()}
        sx={{
          textAlign: 'center',
          cursor: 'default',
        }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <MotionTypography
          variant="h2"
          component="h1"
          sx={{
            fontSize: { xs: '2.5rem', sm: '3.5rem', md: '5rem' },
            fontWeight: 700,
            mb: 2,
            lineHeight: 1.2,
            '& em': {
              fontStyle: 'italic',
              color: 'primary.main',
            },
          }}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          Turn Your Influence into Aura
        </MotionTypography>
        <MotionTypography variant="h6" color="text.secondary" sx={{ mb: 4 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.2 }}>
          Do you want to
        </MotionTypography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 0 }}>
          <MotionButton
            variant="contained"
            size="large"
            onClick={onSelectInfluencer}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            sx={{ px: 4, py: 2, fontSize: '1.2rem', fontWeight: 600 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            {/* Earn Money (creator)
             */}
            Find Advertisers (creator)
          </MotionButton>
          <MotionButton
            variant="outlined"
            size="large"
            onClick={onSelectAdvertiser}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            sx={{ px: 4, py: 2, fontSize: '1.2rem', fontWeight: 600 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            Find Creators (advertiser)
          </MotionButton>
        </Box>
      </MotionBox>
    </MotionBox>
  );
};

const ContentSection = ({ data, type, selectedType, setSelectedType, onStartClick }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const content = data[type];
  const theme = useTheme();

  if (!content) return null;

  const ctaButtonText = type === 'influencer' ? 'Signup Now' : 'Find Creators';

  return (
    <MotionBox ref={ref} variants={staggerContainer} initial="initial" animate={isInView ? 'animate' : 'initial'} sx={{ mb: 12 }}>
      <Typography
        variant="h2"
        align="center"
        gutterBottom
        sx={{
          mb: 3,
          fontWeight: 600,
          '& em': {
            fontStyle: 'italic',
            color: 'primary.main',
          },
        }}
      >
        {type === 'influencer' ? (
          <>
            <Box
              component="span"
              onClick={() => setSelectedType(selectedType === 'influencer' ? 'advertiser' : 'influencer')}
              sx={{
                cursor: 'pointer',
                fontStyle: 'italic',
                position: 'relative',
                display: 'inline-block',
                color: 'primary.main',
                textShadow: `0 0 10px ${theme.palette.primary.main}50, 0 0 20px ${theme.palette.primary.main}30`,
                transition: 'all 0.3s ease',
                '&:hover': {
                  textShadow: `0 0 15px ${theme.palette.primary.main}70, 0 0 30px ${theme.palette.primary.main}50`,
                },
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  width: '50%',
                  height: '3px',
                  background: `linear-gradient(90deg, ${theme.palette.primary.main}, transparent)`,
                  borderRadius: '2px',
                },
              }}
            >
              Monetize
            </Box>
            {' Your Aura'}
          </>
        ) : (
          <>
            <Box
              component="span"
              onClick={() => setSelectedType(selectedType === 'advertiser' ? 'influencer' : 'advertiser')}
              sx={{
                cursor: 'pointer',
                fontStyle: 'italic',
                position: 'relative',
                display: 'inline-block',
                color: 'primary.main',
                textShadow: `0 0 10px ${theme.palette.primary.main}50, 0 0 20px ${theme.palette.primary.main}30`,
                transition: 'all 0.3s ease',
                '&:hover': {
                  textShadow: `0 0 15px ${theme.palette.primary.main}70, 0 0 30px ${theme.palette.primary.main}50`,
                },
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  width: '50%',
                  height: '3px',
                  background: `linear-gradient(90deg, ${theme.palette.primary.main}, transparent)`,
                  borderRadius: '2px',
                },
              }}
            >
              Capture
            </Box>
            {' Insane Aura'}
          </>
        )}
      </Typography>
      <Typography variant="h6" align="center" color="text.secondary" sx={{ mb: 4 }}>
        {content.subtitle}
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 8 }}>
        <MotionButton
          variant="contained"
          size="large"
          onClick={onStartClick}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          sx={{ px: 6, py: 2, fontSize: '1.2rem', fontWeight: 600 }}
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          {ctaButtonText}
        </MotionButton>
      </Box>

      {content.steps && (
        <Grid container spacing={3} sx={{ mb: 8 }}>
          {content.steps.map((step, index) => (
            <Grid item xs={12} md={4} key={index}>
              <StepCard data={step} />
            </Grid>
          ))}
        </Grid>
      )}
    </MotionBox>
  );
};

const WhyFarmAuraSection = ({ type }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const benefits = {
    influencer: [
      {
        title: 'Secure Payments with PhonePe',
        description: "Get paid safely and securely through PhonePe's trusted payment gateway. All transactions are protected and processed seamlessly.",
        icon: <Security sx={{ fontSize: 28 }} />,
      },
      {
        title: 'Verified Advertisers Only',
        description: 'Work exclusively with verified brands and advertisers.',
        icon: <VerifiedUser sx={{ fontSize: 28 }} />,
      },
      {
        title: 'Visibility to Top Brands',
        description: 'Get discovered by leading brands and unlock premium deals. Show your profile to advertisers looking for real influence.',
        icon: <TrendingUp sx={{ fontSize: 28 }} />,
      },
    ],
    advertiser: [
      {
        title: 'Secure Payments with PhonePe',
        description: "Make payments safely and securely through PhonePe's trusted payment gateway. All transactions are protected and processed seamlessly.",
        icon: <Payment sx={{ fontSize: 28 }} />,
      },
      {
        title: 'Verified Creators',
        description: 'Connect exclusively with verified creators and influencers. Every profile is checked to ensure real reach and engagement.',
        icon: <CheckCircle sx={{ fontSize: 28 }} />,
      },
      {
        title: 'Find Top-Performing Creators',
        description: 'Discover the best creators who drive maximum sales and engagement. Use data to find creators that match your brand.',
        icon: <Search sx={{ fontSize: 28 }} />,
      },
    ],
  };

  const benefitList = benefits[type] || benefits.influencer;

  return (
    <MotionBox ref={ref} variants={staggerContainer} initial="initial" animate={isInView ? 'animate' : 'initial'} sx={{ mb: 8 }}>
      <Typography variant="h2" align="center" gutterBottom sx={{ mb: 6, fontWeight: 600 }}>
        Why Choose Us?
      </Typography>
      <Grid container spacing={3}>
        {benefitList.map((benefit, index) => (
          <Grid item xs={12} md={4} key={index}>
            <BenefitCard data={benefit} />
          </Grid>
        ))}
      </Grid>
    </MotionBox>
  );
};

const CTASection = ({ type, onStartClick, setLoading, account, navigate, smoothScrollToTop }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const ctaText = {
    influencer: {
      title: 'Ready to start earning?',
      subtitle: 'Join creators who are sharing space from their social media profiles',
      button: 'Signup Now',
    },
    advertiser: {
      title: 'Ready to find creators?',
      subtitle: "Stand out on top creator's header, bio, pinned post for driving sales",
      button: 'Find Creators',
    },
  };

  const text = ctaText[type] || ctaText.influencer;

  return (
    <MotionBox ref={ref} initial={{ opacity: 0 }} animate={isInView ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 1 }} sx={{ py: 0 }}>
      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="h3" gutterBottom sx={{ mb: 4, fontWeight: 600 }}>
          {text.title}
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 0 }}>
          {text.subtitle}
        </Typography>
        <Box sx={{ mt: 0 }}>
          <MotionButton variant="contained" size="large" onClick={onStartClick} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} sx={{ px: 6, py: 2, fontSize: '1.2rem', fontWeight: 600 }}>
            {text.button}
          </MotionButton>
        </Box>
      </Box>
    </MotionBox>
  );
};

function LandingPage({ isMobile, sidebarOpen, openLoginPopup, setLoading, account }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState(() => {
    return localStorage.getItem('accountType') || null;
  });
  const [showPopup, setShowPopup] = useState(() => {
    return !localStorage.getItem('accountType');
  });

  const smoothScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (selectedType) {
      localStorage.setItem('accountType', selectedType);
    }
  }, [selectedType]);

  const data = {
    influencer: {
      title: 'Share Your Aura',
      subtitle: 'Share space on your headers, bio, pinned post.',
      steps: [
        // {
        //   number: 1,
        //   title: 'Connect Your Profiles',
        //   description: 'Link your social media accounts and set up your profile to start earning money',
        // },
        {
          number: 1,
          title: 'Set Your Rates',
          description: 'Set your prices based on your follower count and engagement rate',
        },
        {
          number: 2,
          title: 'Share space',
          description: 'Accept brand deals and get paid when your ads go live on your profiles',
        },
      ],
      faqs: [
        // {
        //   question: 'How do I start earning money?',
        //   answer: 'Connect your social media profiles and set your rates. Brands will find you and request to work with you for their ads.',
        // },
        {
          question: 'Can I choose which brands I work with?',
          answer: 'Yes. Every brand request needs your approval. You decide which ads you want to accept.',
        },
        // {
        //   question: 'How is my rate calculated?',
        //   answer: 'Your rate is based on your engagement rate, follower count, and how well your audience responds to your content.',
        // },
        {
          question: 'Do I have control over my content?',
          answer: 'Yes. You approve every brand deal. You can pause accepting new deals anytime.',
        },
      ],
    },
    advertiser: {
      title: 'Capture the Insane Aura',
      subtitle: "Stand out on top creator's header, bio, pinned post for driving sales",
      steps: [
        {
          number: 1,
          title: 'Find Creators',
          description: 'Browse and find creators that match your brand',
        },
        {
          number: 2,
          title: 'Send a Request',
          description: 'Send an ad request to the creator',
        },
        {
          number: 3,
          title: 'Track Results',
          description: 'See how your ads perform and drive sales',
        },
      ],
      faqs: [
        {
          question: 'How do I find creators?',
          answer: 'Browse our marketplace of verified creators. Filter by niche, follower count, and engagement rates to find creators that match your brand.',
        },
        {
          question: 'How do I work with a creator?',
          answer: 'Send an ad request directly to the creator. They review your brand and ad details, then approve or decline.',
        },
        {
          question: 'How do ads drive sales?',
          answer: "Once approved, your ad goes live on the creator's profile. Their engaged audience sees your ad and converts into customers.",
        },
      ],
    },
  };

  const handleSelectInfluencer = () => {
    setSelectedType('influencer');
    setShowPopup(false);
  };

  const handleSelectAdvertiser = () => {
    setSelectedType('advertiser');
    setShowPopup(false);
  };

  const handleStartClick = () => {
    openLoginPopup();
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <AnimatePresence>
          <HeroPopup open={showPopup} onSelectInfluencer={handleSelectInfluencer} onSelectAdvertiser={handleSelectAdvertiser} />
        </AnimatePresence>

        {selectedType && (
          <>
            <ContentSection data={data} type={selectedType} selectedType={selectedType} setSelectedType={setSelectedType} onStartClick={handleStartClick} />
            <WhyFarmAuraSection type={selectedType} />
            <CTASection type={selectedType} onStartClick={handleStartClick} setLoading={setLoading} account={account} navigate={navigate} smoothScrollToTop={smoothScrollToTop} />
            {data[selectedType]?.faqs && (
              <Box sx={{ mt: 8 }}>
                <Typography variant="h2" align="center" gutterBottom sx={{ mb: 2, fontWeight: 600 }}>
                  Frequently Asked Questions
                </Typography>
                <Typography variant="body1" align="center" color="text.secondary" sx={{ mb: 6 }}>
                  Answers to help you understand how it works
                </Typography>
                <Box sx={{ maxWidth: 800, mx: 'auto' }}>
                  <MapComponent Component={FAQItem} data={data[selectedType].faqs} />
                </Box>
              </Box>
            )}
          </>
        )}
      </Container>
    </Box>
  );
}

export default LandingPage;
