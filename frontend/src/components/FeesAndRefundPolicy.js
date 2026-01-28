import React from 'react';
import PolicyPage from './PolicyPage';
import constants from '../constants.json';
const { APP_NAME } = constants;

const FeesAndRefundPolicy = ({ sidebarOpen, isMobile }) => {
  const lastUpdated = '21st November 2025';
  const contactEmail = 'roopesh@farmaura.co';
  const contactAddress = 'Kasavanahalli, Bangalore';

  const sections = [
    {
      title: 'Fees Policy',
      content: `This Fees Policy explains how ${APP_NAME} ("we", "us", "our") charges fees to Creators and Advertisers. By using the ${APP_NAME} platform ("Platform"), you agree to the terms below.`,
    },
    {
      number: 1,
      title: 'Overview',
      content: [
        `${APP_NAME} is a marketplace that facilitates transactions between Creators and Advertisers.`,
        'We charge fees for providing the platform, handling payments, and offering customer support.',
        'Fees may change at any time with notice posted on the platform.',
      ],
    },
    {
      number: 2,
      title: 'Fees for Advertisers',
      content: 'Advertisers may be charged the following fees:',
      subsections: [
        {
          number: '2.1',
          title: 'Platform Service Fee',
          content: 'A percentage fee or flat fee added at checkout for each purchase of an advertising placement.',
        },
        {
          number: '2.2',
          title: 'Payment Processing Fee',
          content: 'This fee covers third-party payment processors. It is included in the checkout total.',
        },
        {
          number: '2.3',
          title: 'Optional Add-On Fees',
          content: 'If Advertisers choose optional services (e.g., priority review, special listing promotion), additional fees may apply.',
        },
      ],
      points: ['Advertisers will always see the total amount before completing a purchase.'],
    },
    {
      number: 3,
      title: 'Fees for Creators',
      content: 'Creators may be subject to:',
      subsections: [
        {
          number: '3.1',
          title: 'Commission Fee',
          content: 'A commission deducted from the payout for each completed advertising placement.',
        },
        {
          number: '3.2',
          title: 'Withdrawal Fees',
          content: 'Depending on the withdrawal method (e.g., bank transfer, PayPal), third-party or bank fees may apply.',
        },
        {
          number: '3.3',
          title: 'Failure-to-Deliver Fee (If Implemented)',
          content: `If a Creator repeatedly fails to deliver ads as agreed, ${APP_NAME} reserves the right to charge penalties or suspend the account.`,
        },
      ],
    },
    {
      number: 4,
      title: 'Holding & Payout Timeline',
      content: [
        'By selling an ad placement:',
        `Creators understand that ${APP_NAME} holds funds in escrow-like custody until the ad goes live.`,
        `Payouts are released 3–5 business days after ${APP_NAME} confirms the ad is live and delivered as agreed.`,
        `${APP_NAME} may delay payouts if fraud, disputes, policy violations, or irregular activity is suspected.`,
      ],
    },
    {
      number: 5,
      title: 'Fee Changes',
      content: [`${APP_NAME} may update fees at any time. Updated fees will apply to future transactions only.`, 'Continued use of the platform constitutes acceptance of the new fee structure.'],
    },
    {
      number: 6,
      title: 'Taxes',
      content: [
        'Users are responsible for:',
        ['Filing their own taxes,', 'Reporting income earned,', 'Complying with tax laws in their jurisdiction.'],
        `${APP_NAME} does not provide tax advice and is not liable for any tax obligations of Creators or Advertisers.`,
      ],
    },
    {
      title: 'Refund Policy',
      content: `This Refund Policy explains when Advertisers are eligible for refunds and under what conditions funds may be withheld. By using ${APP_NAME}, you agree to the policy below.`,
    },
    {
      number: 1,
      title: 'Eligibility for Refunds',
      content: [
        'Advertisers can request a refund only before the ad goes live.',
        'A refund is eligible if:',
        ['The Creator has not yet posted the agreed-upon ad, AND', 'The Advertiser submits a refund request through the platform or support.'],
        'Once the ad is published or marked as "live," no refunds will be issued.',
      ],
    },
    {
      number: 2,
      title: 'Non-Refundable Situations',
      content: 'Refunds will not be issued in any of the following cases:',
      subsections: [
        {
          number: '2.1',
          title: 'Ad Already Posted',
          content: 'If the Creator has posted the ad, regardless of visibility or engagement.',
        },
        {
          number: '2.2',
          title: 'Dissatisfaction With Performance',
          content: ['No refunds based on:', ['Low clicks or views,', 'Low engagement,', 'Weak conversion rates,', 'Unexpected audience reaction.'], `${APP_NAME} does not guarantee performance.`],
        },
        {
          number: '2.3',
          title: 'Advertiser Delay or Non-Delivery of Content',
          content: ['No refund if:', ['Advertiser fails to provide the ad materials on time,', 'Advertiser provides incomplete or non-compliant content.']],
        },
        {
          number: '2.4',
          title: 'Social Platform Removal or Algorithm Impact',
          content: [
            'No refund if the ad is:',
            ['Removed by Instagram, TikTok, YouTube, or other platforms,', 'Shadowbanned,', 'Given reduced reach,', 'Flagged by platform policies.'],
            `${APP_NAME} is not responsible for social media platform actions.`,
          ],
        },
        {
          number: '2.5',
          title: 'Misuse, Fraud, or Policy Violations',
          content: `If suspicious activity or policy violations occur, ${APP_NAME} may refuse refunds and suspend accounts.`,
        },
      ],
    },
    {
      number: 3,
      title: 'Creator Non-Delivery',
      content: [
        'If the Creator fails to publish the ad by the agreed timeline:',
        'The Advertiser will receive a full refund.',
        'The Creator will not receive payment.',
        'Repeated violations may result in Creator suspension.',
      ],
    },
    {
      number: 4,
      title: 'Refund Processing Time',
      content: [
        'Approved refunds:',
        'Are returned to the original payment method,',
        'Typically complete within 5–10 business days, depending on the payment provider.',
        `${APP_NAME} is not responsible for banking delays.`,
      ],
    },
    {
      number: 5,
      title: 'Disputes',
      content: [
        'If a disagreement occurs:',
        `${APP_NAME} may review evidence and timelines,`,
        `But ${APP_NAME} is not obligated to mediate or resolve disputes,`,
        'And is not liable for losses, damages, or outcomes of any dispute.',
      ],
    },
    {
      number: 6,
      title: 'Finality',
      content: `Once a refund decision is made by ${APP_NAME}, it is considered final.`,
    },
  ];

  return (
    <PolicyPage
      title="Fees and Refund Policy"
      lastUpdated={lastUpdated}
      contactEmail={contactEmail}
      contactAddress={contactAddress}
      sections={sections}
      sidebarOpen={sidebarOpen}
      isMobile={isMobile}
    />
  );
};

export default FeesAndRefundPolicy;
