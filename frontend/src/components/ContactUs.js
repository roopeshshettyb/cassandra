import React from 'react';
import { Container, Typography, Box, Grid, Card, CardContent } from '@mui/material';
import { Email, LocationOn } from '@mui/icons-material';

const ContactUs = ({ isMobile }) => {
  const contactInfo = [
    {
      icon: <Email />,
      title: 'Email',
      content: 'roopesh@farmaura.co',
      link: 'mailto:roopesh@farmaura.co',
    },
    {
      icon: <Email />,
      title: 'Support',
      content: 'support@farmaura.co',
      link: 'mailto:support@farmaura.co',
    },
    {
      icon: <LocationOn />,
      title: 'Location',
      content: 'Kasavanahalli, Bangalore',
      link: null,
    },
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 6 }}>
      <Container maxWidth="md">
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography variant="h3" sx={{ fontWeight: 700, mb: 2 }}>
            Contact Us
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto' }}>
            Have a question or need help? Reach out to us using the contact information below.
          </Typography>
        </Box>

        <Grid container spacing={3} justifyContent="center">
          {contactInfo.map((info, idx) => (
            <Grid item xs={12} sm={6} md={4} key={idx}>
              <Card>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    <Box
                      sx={{
                        color: 'primary.main',
                        display: 'flex',
                        alignItems: 'center',
                        mt: 0.5,
                      }}
                    >
                      {info.icon}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                        {info.title}
                      </Typography>
                      {info.link ? (
                        <Typography
                          component="a"
                          href={info.link}
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            textDecoration: 'none',
                            '&:hover': {
                              color: 'primary.main',
                              textDecoration: 'underline',
                            },
                          }}
                        >
                          {info.content}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          {info.content}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};

export default ContactUs;
