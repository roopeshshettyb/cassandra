import React from 'react';
import PolicyPage from './PolicyPage';
import constants from '../constants.json';
const { APP_NAME } = constants;

const ShippingDeliveryPolicy = ({ sidebarOpen, isMobile }) => {
  const lastUpdated = '21st November 2025';
  const contactEmail = 'roopesh@farmaura.co';
  const contactAddress = 'Kasavanahalli, Bangalore';

  const sections = [
    {
      title: 'Introduction',
      content: `${APP_NAME} ("we", "us", "our") provides digital services only. No physical products are shipped through our platform. This Shipping & Delivery Policy explains how advertising placements ("Ads") are scheduled, delivered, and confirmed between Advertisers and Creators.`,
    },
    {
      number: 1,
      title: 'Nature of Delivery',
      content: [
        `${APP_NAME} facilitates the delivery of digital advertising placements performed by independent Creators on their social media accounts.`,
        'No physical shipping, mail, or tangible goods are involved.',
        'All "deliveries" refer to:',
        ["Posting the purchased Ad on the Creator's social media account, and", 'Confirming the Ad is live as described in the Listing.'],
      ],
    },
    {
      number: 2,
      title: 'Delivery Timeline',
      subsections: [
        {
          number: '2.1',
          title: "Creator's Posting Timeline",
          content: [
            'When an Advertiser purchases an Ad placement:',
            'The Creator is responsible for posting the Ad according to the schedule in their Listing (e.g., within X hours/days or on a specific agreed date).',
            'If no timeline is specified, the Creator must post the Ad within a reasonable time, typically 1–5 days.',
          ],
        },
        {
          number: '2.2',
          title: 'Advertiser Content Submission',
          content: [
            'Advertisers must provide all required Ad content and materials before the Creator can deliver the service.',
            'Failure to provide timely content may delay delivery and does not qualify for a refund (see Refund Policy).',
          ],
        },
        {
          number: '2.3',
          title: 'Delays',
          content: [
            `${APP_NAME} is not responsible for delays caused by:`,
            ['Advertisers submitting content late', 'Social media platform outages or restrictions', 'Creator schedule changes', 'Technical issues beyond our control'],
            'Creators are solely responsible for meeting the delivery commitments in their Listings.',
          ],
        },
      ],
    },
    {
      number: 3,
      title: 'Delivery Confirmation',
      content: [
        'A delivery is considered complete when:',
        'The Creator posts the Ad according to the agreed format (post/story/reel/link/etc.), and',
        `${APP_NAME} receives confirmation or evidence that the Ad is live, which may include:`,
        ['A link', 'A screenshot', 'API verification (if available)', 'Creator confirmation, subject to review'],
        `Once the ad is verified as live, ${APP_NAME} marks the service as Delivered and schedules the Creator payout.`,
      ],
    },
    {
      number: 4,
      title: 'Creator Payout Timeline',
      content: [
        'After confirmation that the Ad is live:',
        'Payouts are released to Creators 3–5 business days later.',
        'Additional delays may occur for fraud checks, disputes, or compliance reviews.',
      ],
    },
    {
      number: 5,
      title: 'Failed Delivery',
      content: [
        'A delivery is considered failed if:',
        'The Creator does not post the Ad by the agreed deadline, and',
        'The Advertiser did not cause the delay (e.g., late content).',
        'In this case:',
        'The Advertiser receives a refund, and',
        'The Creator does not receive payment.',
        'Repeated non-delivery may lead to Creator suspension.',
      ],
    },
    {
      number: 6,
      title: 'Platform Delivery Not Guaranteed',
      content: [
        `${APP_NAME} does not guarantee:`,
        [
          'The timing or visibility of social media platforms (Instagram, TikTok, YouTube, etc.)',
          'Engagement, reach, impressions, or performance',
          'That posts will remain online indefinitely',
          "Delivery if the Creator's social media account is banned, restricted, or suspended",
        ],
        `These risks are part of using third-party platforms and outside ${APP_NAME}'s control.`,
      ],
    },
    {
      number: 7,
      title: 'No Physical Shipping',
      content: [
        `Since ${APP_NAME} provides digital services only:`,
        ['No shipping charges apply', 'No tracking numbers are issued', 'No physical delivery times exist'],
        'Any mention of "delivery" refers strictly to the posting of digital Ads.',
      ],
    },
    {
      number: 8,
      title: 'Contact Us',
      content: ['If you have questions about a delivery:', `Email: ${contactEmail}`, `Address: ${contactAddress}`],
    },
  ];

  return (
    <PolicyPage
      title="Shipping & Delivery Policy"
      lastUpdated={lastUpdated}
      contactEmail={contactEmail}
      contactAddress={contactAddress}
      sections={sections}
      sidebarOpen={sidebarOpen}
      isMobile={isMobile}
    />
  );
};

export default ShippingDeliveryPolicy;
