import React from 'react';
import { Container, Typography, Box, useTheme } from '@mui/material';

const PolicyPage = ({ title, lastUpdated, contactEmail, contactAddress, sections, sidebarOpen, isMobile }) => {
  const theme = useTheme();

  const renderContent = (content) => {
    if (typeof content === 'string') {
      return <Typography variant="body1" sx={{ mb: 1.5, lineHeight: 1.8 }}>{content}</Typography>;
    }
    if (Array.isArray(content)) {
      const allStrings = content.every((item) => typeof item === 'string');
      if (allStrings) {
        return (
          <Box component="ul" sx={{ pl: 3, mb: 2 }}>
            {content.map((item, idx) => (
              <Box component="li" key={idx} sx={{ mb: 1 }}>
                <Typography variant="body1" sx={{ lineHeight: 1.8 }}>{item}</Typography>
              </Box>
            ))}
          </Box>
        );
      }
      return (
        <Box sx={{ mb: 2 }}>
          {content.map((item, idx) => (
            <Box key={idx} sx={{ mb: 1.5 }}>
              {renderContent(item)}
            </Box>
          ))}
        </Box>
      );
    }
    if (content && typeof content === 'object') {
      if (content.title && content.content) {
        return (
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5, color: 'primary.main' }}>
              {content.title}
            </Typography>
            {renderContent(content.content)}
          </Box>
        );
      }
      if (content.points) {
        return (
          <Box sx={{ mb: 2 }}>
            {content.points.map((point, idx) => (
              <Box key={idx} sx={{ mb: 1 }}>
                {renderContent(point)}
              </Box>
            ))}
          </Box>
        );
      }
    }
    return null;
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Typography variant="h3" sx={{ fontWeight: 700, mb: 3, textAlign: 'center' }}>
          {title}
        </Typography>

      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Last Updated: {lastUpdated}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Contact: {contactEmail} | {contactAddress}
        </Typography>
      </Box>

      <Box sx={{ mt: 4 }}>
        {sections.map((section, sectionIdx) => (
          <Box key={sectionIdx} sx={{ mb: 4 }}>
            {section.title && (
              <Typography variant="h5" sx={{ fontWeight: 600, mb: 2, color: 'text.primary' }}>
                {section.number && `${section.number}. `}
                {section.title}
              </Typography>
            )}
            {section.content && renderContent(section.content)}
            {section.subsections &&
              section.subsections.map((subsection, subIdx) => (
                <Box key={subIdx} sx={{ ml: 2, mb: 2.5 }}>
                  {subsection.title && (
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5, fontSize: '1.1rem' }}>
                      {subsection.number && `${subsection.number} `}
                      {subsection.title}
                    </Typography>
                  )}
                  {subsection.content && renderContent(subsection.content)}
                </Box>
              ))}
          </Box>
        ))}
      </Box>
      </Container>
    </Box>
  );
};

export default PolicyPage;

