import React from 'react';
import PolicyPage from './PolicyPage';
import constants from '../constants.json';
const { APP_NAME } = constants;

const PrivacyPolicy = ({ sidebarOpen, isMobile }) => {
  const lastUpdated = '21st November 2025';
  const contactEmail = 'roopesh@farmaura.co';
  const contactAddress = 'Kasavanahalli, Bangalore';

  const sections = [
    {
      title: 'Introduction',
      content: [
        `${APP_NAME} ("we", "us", "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform ("Platform"), which enables Creators and Advertisers to buy and sell social media advertising placements.`,
        `By using ${APP_NAME}, you consent to the practices described in this Privacy Policy.`,
        'Business Owned by B ROOPESH',
      ],
    },
    {
      number: 1,
      title: 'Information We Collect',
      content: 'We may collect the following categories of information:',
      subsections: [
        {
          number: '1.1',
          title: 'Information You Provide to Us',
          content: [
            {
              title: 'Account & Identity Information',
              content: ['Name', 'Email address', 'Username', 'Password (encrypted)', 'Profile details', 'Social media handles or connected accounts'],
            },
            {
              title: 'Payment & Financial Information',
              content: ['Payment method details (processed securely by third-party payment processors)', 'Billing address', 'Transaction history', 'We do not store full credit/debit card numbers.'],
            },
            {
              title: 'Content You Share',
              content: ['Listings you create', 'Ad content uploaded by Advertisers', 'Messages sent through the Platform', 'Customer support requests'],
            },
          ],
        },
        {
          number: '1.2',
          title: 'Automatically Collected Information',
          content: 'When you use the Platform, we may automatically collect:',
          points: ['IP address', 'Device type', 'Browser type', 'Operating system', 'Usage data (pages viewed, actions taken, time spent)', 'Referring URLs', 'Cookies and tracking technologies'],
        },
        {
          number: '1.3',
          title: 'Cookies and Tracking Technologies',
          content: [
            'We use:',
            ['Cookies', 'Pixels', 'Analytics tools', 'Session identifiers'],
            'These help us provide and improve the Platform, enable login, and personalize your experience.',
            'You may disable cookies in your browser settings, but the Platform may not function properly.',
          ],
        },
      ],
    },
    {
      number: 2,
      title: 'How We Use Your Information',
      content: 'We may use your information for the following purposes:',
      subsections: [
        {
          number: '2.1',
          title: 'To Operate the Platform',
          content: ['Create and manage accounts', 'Facilitate transactions between Creators and Advertisers', 'Process payments and send payouts', 'Provide advertising placement services'],
        },
        {
          number: '2.2',
          title: 'For Safety & Compliance',
          content: ['Detect and prevent fraud', 'Enforce Terms & Conditions', 'Comply with legal obligations'],
        },
        {
          number: '2.3',
          title: 'To Improve the Platform',
          content: ['Analyze usage trends', 'Fix technical issues', 'Develop new features'],
        },
        {
          number: '2.4',
          title: 'To Communicate With You',
          content: ['Send notifications about purchases, listings, or payouts', 'Respond to support inquiries', 'Send marketing or promotional messages (you may opt out)'],
        },
        {
          number: '2.5',
          title: 'For Legal & Security Purposes',
          content: ['Verify identities', 'Conduct KYC/AML checks if required', 'Protect the integrity of the platform'],
        },
      ],
    },
    {
      number: 3,
      title: 'How We Share Your Information',
      content: 'We may share your information only as described below:',
      subsections: [
        {
          number: '3.1',
          title: 'With Other Users (Creators & Advertisers)',
          content: [
            'Only limited information is shared, such as:',
            ['Username', 'Listing details', 'Ad content relevant to the transaction'],
            'Personal contact details are not shared unless you choose to share them.',
          ],
        },
        {
          number: '3.2',
          title: 'With Service Providers',
          content: [
            'We use third-party vendors for:',
            ['Payment processing', 'Cloud hosting', 'Fraud detection', 'Analytics', 'Email messaging', 'Customer support tools'],
            'These providers have access only as necessary to perform their services and are contractually obligated to safeguard your data.',
          ],
        },
        {
          number: '3.3',
          title: 'For Legal Reasons',
          content: [
            'We may disclose your information if required to:',
            ['Comply with law or legal requests', 'Respond to subpoenas or court orders', `Protect rights, safety, or security of ${APP_NAME} or its users`, 'Investigate fraud or security breaches'],
          ],
        },
        {
          number: '3.4',
          title: 'Business Transfers',
          content: `If ${APP_NAME} is acquired, merges with another company, or undergoes restructuring, your information may be transferred as part of that transaction.`,
        },
      ],
    },
    {
      number: 4,
      title: 'Your Data Rights',
      content: [
        'Depending on your location (such as EU/EEA under GDPR or California under CCPA), you may have the following rights:',
        [
          'Right to access your data',
          'Right to correct inaccuracies',
          'Right to delete your account or data',
          'Right to withdraw consent',
          'Right to restrict processing',
          'Right to data portability',
          'Right to opt out of marketing',
        ],
        'To exercise your rights, contact us at roopesh@farmaura.co.',
        'We may require verification before fulfilling requests.',
      ],
    },
    {
      number: 5,
      title: 'Data Retention',
      content: [
        'We keep your information only as long as necessary to:',
        ['Provide the Platform,', 'Comply with legal obligations (such as tax laws),', 'Resolve disputes,', 'Enforce policies.'],
        'You may request deletion of your account at any time, but some data may be retained as legally required.',
      ],
    },
    {
      number: 6,
      title: 'Security',
      content: [
        'We take reasonable administrative, technical, and physical safeguards to protect your data.',
        'However:',
        ['No platform is 100% secure,', 'We cannot guarantee absolute security,', 'You use the Platform at your own risk.'],
        'Protect your password and account credentials at all times.',
      ],
    },
    {
      number: 7,
      title: "Children's Privacy",
      content: [`${APP_NAME} is not intended for individuals under 18 years old.`, 'We do not knowingly collect information from minors.', 'If we discover such data, we will delete it promptly.'],
    },
    {
      number: 8,
      title: 'International Data Transfers',
      content: ['Your information may be stored or processed outside your country of residence.', 'By using the Platform, you consent to such transfers where permitted by law.'],
    },
    {
      number: 9,
      title: 'Third-Party Links',
      content: ['The Platform may contain links to external websites or services.', 'We are not responsible for the privacy practices, policies, or content of third parties.'],
    },
    {
      number: 10,
      title: 'Updates to This Policy',
      content: [
        'We may update this Privacy Policy periodically.',
        'When changes occur, we will update the "Last Updated" date above.',
        'Continued use of the Platform after updates constitutes acceptance of the revised policy.',
      ],
    },
    {
      number: 11,
      title: 'Contact Us',
      content: ['For questions, concerns, or data requests:', `Email: ${contactEmail}`, `Address: ${contactAddress}`],
    },
  ];

  return (
    <PolicyPage
      title={`${APP_NAME} – Privacy Policy`}
      lastUpdated={lastUpdated}
      contactEmail={contactEmail}
      contactAddress={contactAddress}
      sections={sections}
      sidebarOpen={sidebarOpen}
      isMobile={isMobile}
    />
  );
};

export default PrivacyPolicy;
