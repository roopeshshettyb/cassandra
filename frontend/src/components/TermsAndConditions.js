import React from 'react';
import PolicyPage from './PolicyPage';
import constants from '../constants.json';
const { APP_NAME } = constants;

const TermsAndConditions = ({ sidebarOpen, isMobile }) => {
  const lastUpdated = '21st November 2025';
  const contactEmail = 'roopesh@farmaura.co';
  const contactAddress = 'Kasavanahalli, Bangalore';

  const sections = [
    {
      title: 'Introduction',
      content: `Welcome to ${APP_NAME} ("we", "us", "our"). ${APP_NAME} provides a marketplace platform where creators/influencers ("Creators") can list available advertising placements on their social media accounts, and advertisers ("Advertisers") can purchase these placements. By accessing or using ${APP_NAME}, you ("User") agree to these Terms & Conditions ("Terms"). If you do not agree, you may not use the platform.`,
    },
    {
      number: 1,
      title: 'Definitions',
      content: [
        `Platform: The ${APP_NAME} website, web app, mobile app, and related services.`,
        'Creator: A user who lists advertising placements (e.g., banner, link in bio, post, story, reel) for sale.',
        'Advertiser: A user who purchases advertising placements.',
        'Listing: Any advertising opportunity posted by a Creator.',
        'Ad: The actual creative content provided by an Advertiser to be posted by a Creator.',
        `Service Fee: Any fees or charges applied by ${APP_NAME}.`,
      ],
    },
    {
      number: 2,
      title: 'Nature of the Platform',
      content: [
        `${APP_NAME} is a marketplace facilitator only.`,
        'We do not:',
        [
          'Create, monitor, or control Listings.',
          'Review, approve, or endorse any Creator, Advertiser, Ad content, or social media accounts.',
          'Guarantee performance, results, or engagement metrics.',
          'Enter into the advertising contract on behalf of any User.',
        ],
        'All transactions, agreements, and disputes between Creators and Advertisers are solely between those parties.',
      ],
    },
    {
      number: 3,
      title: 'User Eligibility',
      content: [
        'Users must:',
        ['Be at least 18 years old,', 'Have full legal capacity,', 'Provide accurate and truthful information,', 'Not use the platform for illegal activities.'],
        'We may suspend or terminate accounts at any time for violations of these Terms.',
      ],
    },
    {
      number: 4,
      title: 'Listings & Creator Responsibilities',
      content: [
        'Creators agree that:',
        [
          'They have full rights and authority to sell advertising space on their social media accounts.',
          'Listings must be accurate, truthful, and not misleading.',
          'They will deliver the purchased Ad placement exactly as described (format, duration, dates, visibility).',
          'They will post the Ad in accordance with the timeline agreed upon in the purchase.',
          'They are solely responsible for complying with the rules, policies, and advertising guidelines of the social media platforms they use.',
          'They will not post illegal, harmful, or prohibited Ads.',
        ],
        `${APP_NAME} is not responsible for any social media platform actions, suspensions, takedowns, or penalties resulting from any Ad.`,
      ],
    },
    {
      number: 5,
      title: 'Advertiser Responsibilities',
      content: [
        'Advertisers agree that:',
        [
          'They have the rights and legal authority to use all Ad content they provide.',
          'Ads must not violate copyright, trademark, privacy, or any applicable law.',
          'Ads must not include harmful, illegal, defamatory, pornographic, hateful, or misleading content.',
          "They are responsible for ensuring their Ad complies with the Creator's social platform requirements.",
        ],
        `${APP_NAME} reserves the right (but has no obligation) to reject Ads at its discretion.`,
      ],
    },
    {
      number: 6,
      title: 'Payments',
      content: [
        `Payments are processed through ${APP_NAME}.`,
        'Advertisers are charged at the time of purchase.',
        `${APP_NAME} will hold funds until the Ad goes live.`,
        `Creators will be paid 3–5 business days after ${APP_NAME} confirms the Ad went live as agreed.`,
        `${APP_NAME} may charge service fees to either party; fees will be displayed before purchase.`,
      ],
    },
    {
      number: 7,
      title: 'Refunds & Cancellations',
      subsections: [
        {
          number: '7.1',
          title: 'Advertiser Refunds',
          content: [
            'Advertisers may request a refund only before the Ad goes live.',
            'No refunds will be issued:',
            [
              'After the Creator publishes the Ad,',
              'If the Advertiser provided content late or failed to provide required assets,',
              'Due to performance dissatisfaction (e.g., low engagement),',
              'If the Ad was removed by the social media platform for content violations.',
            ],
            'Refunds, if approved, will be processed back to the original payment method.',
          ],
        },
        {
          number: '7.2',
          title: 'Creator Cancellations',
          content: ['If a Creator fails to publish the Ad as agreed:', 'The Advertiser will be refunded,', 'The Creator will not be paid,', 'Repeated failures may result in account suspension.'],
        },
      ],
    },
    {
      number: 8,
      title: 'Platform Fees & Withholding Rights',
      content: [
        `${APP_NAME} may withhold or delay payouts if:`,
        ['There is suspicion of fraud, illegal activity, or Terms violation.', 'A dispute is open.', 'Payment verification or Know-Your-Customer (KYC) checks are required.'],
      ],
    },
    {
      number: 9,
      title: 'Dispute Resolution Between Users',
      content: [
        `${APP_NAME} may, but is not obligated to, assist in resolving disputes.`,
        'Users agree that:',
        ['All transactions are ultimately between the Creator and Advertiser.', `${APP_NAME} is not responsible for outcomes or damages arising from disputes.`],
      ],
    },
    {
      number: 10,
      title: 'Prohibited Activities',
      content: [
        'Users must not:',
        [
          'Use the platform for unlawful purposes.',
          `Circumvent ${APP_NAME} to avoid platform fees.`,
          'Post or purchase fraudulent or misleading Listings.',
          'Harass, threaten, or defraud other users.',
          'Use bots, scrapers, or automated systems.',
        ],
      ],
    },
    {
      number: 11,
      title: 'Intellectual Property',
      content: [
        `Users retain rights to their own content but grant ${APP_NAME} a non-exclusive license to:`,
        ['Display Listings,', 'Showcase content for platform features,', 'Use anonymized examples for marketing purposes.'],
        `${APP_NAME} retains all rights to the platform's software, branding, and design.`,
      ],
    },
    {
      number: 12,
      title: 'Disclaimers & Liability Limitations',
      subsections: [
        {
          number: '12.1',
          title: 'No Guarantees',
          content: [
            `${APP_NAME} provides the platform "as-is" and "as-available" without warranties regarding:`,
            ['Creator performance,', 'Engagement or results from Ads,', 'Continuous availability,', 'Accuracy of Listings,', 'Security or error-free operation.'],
          ],
        },
        {
          number: '12.2',
          title: 'No Liability',
          content: [
            `${APP_NAME} is not liable for any:`,
            [
              'Loss of profits, sales, or business,',
              'Reputational damage,',
              'Content takedowns by social platforms,',
              'Fraud by Users,',
              'Data loss or security breaches originating outside our control,',
              'User disputes,',
              'Illegal or harmful Ads.',
            ],
          ],
        },
        {
          number: '12.3',
          title: 'Maximum Liability',
          content: `In any case, ${APP_NAME}'s total liability will not exceed the amount paid to us in service fees for the transaction in question.`,
        },
      ],
    },
    {
      number: 13,
      title: 'Indemnification',
      content: [
        `Users agree to indemnify and hold ${APP_NAME} harmless against any claims, damages, losses, liabilities, or expenses arising from:`,
        ['Their use of the platform,', 'Their Ads or content,', 'Violations of law, social media platform rules, or third-party rights,', 'Fraud or breach of these Terms.'],
      ],
    },
    {
      number: 14,
      title: 'Termination',
      content: [
        'We may suspend or terminate any account at any time for:',
        ['Violating these Terms,', 'Engaging in fraudulent or harmful activities,', 'Failing to complete transactions.'],
        'Users may also delete their accounts at any time.',
      ],
    },
    {
      number: 15,
      title: 'Changes to Terms',
      content: [`${APP_NAME} may modify these Terms at any time.`, 'Continued use of the platform constitutes acceptance of updated Terms.'],
    },
    {
      number: 16,
      title: 'Governing Law',
      content: ['These Terms are governed by the laws of India.', 'Any disputes will be resolved exclusively in the courts of Indian Jurisdiction.'],
    },
    {
      number: 17,
      title: 'Contact',
      content: ['For questions, support, or legal concerns:', `Email: ${contactEmail}`, `Address: ${contactAddress}`],
    },
  ];

  return (
    <PolicyPage title="Terms & Conditions" lastUpdated={lastUpdated} contactEmail={contactEmail} contactAddress={contactAddress} sections={sections} sidebarOpen={sidebarOpen} isMobile={isMobile} />
  );
};

export default TermsAndConditions;
