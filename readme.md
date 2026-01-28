Lets architect profileaura.com, dont write any code. put everythin in readme.md

This is a site where you can sell ad space on your twitter header/twitter bio

instagram bio/story/post etc

so we have accounts
name, profile pic

then we have profiles
username, name, link, platform, account_id, platform_account_id, insights

then we have ad spaces
platform_account_id, space_type, offers

requests
ad_space_id amount currency account_id offer

Now the flow is like so

User signs in with google oauth

They authenticate profiles with x oauth for twitter, insta oauth for insta etc

For connecting profiles - instagram oauth and xoauth

Once a profile is connected we fetch insights using

curl --request GET \
 --url https://social-media-marketing-analytics.p.rapidapi.com/get_social_profile \
 --header 'x-rapidapi-host: social-media-marketing-analytics.p.rapidapi.com' \
 --header 'x-rapidapi-key: 445a04b31fmsh3c8288a62653bebp1f0c69jsn0598d1e6edb8'

{
"status": "success",
"response": {
"cid": "TW:44196397",
"socialType": "TW",
"groupID": "44196397",
"url": "https://twitter.com/elonmusk",
"name": "Elon Musk",
"image": "https://6f2859a7-8667-4b05-9978-a8922e29bf1f.selstorage.ru/TW:44196397?time=1729321356",
"description": "Read @America to understand why I’m supporting Trump for President",
"screenName": "elonmusk",
"followers": 201977940,
"communityStatus": "DONE",
"isBlocked": false,
"isClosed": false,
"verified": true,
"tags": [
"australia",
"celebrities",
"english",
"influencer",
"gender-m",
"age-45_100",
"politics",
"news-and-media",
"government",
"management-and-marketing",
"business-and-careers",
"society"
],
"suggestedTags": [
"english",
"influencer",
"gender-m",
"age-45_100",
"politics",
"news-and-media",
"government",
"management-and-marketing",
"business-and-careers",
"society"
],
"avgER": 11.278117718530032,
"avgInteractions": 189186,
"avgViews": 34030482,
"ratingIndex": 201924009.83835322,
"ratingTags": [],
"qualityScore": 0.8731707317073172,
"timeStatistics": "2024-10-19T07:02:36.459Z",
"timePostsLoaded": "2024-10-18T16:48:14.661Z",
"membersGendersAges": [
{
"_api_c2_category": "0_18",
"_api_c2_m": 0.03333333333333333,
"_api_c2_f": 0.06666666666666667,
"body_raw_text": null
},
{
"_api_c2_category": "18_21",
"_api_c2_m": 0,
"_api_c2_f": 0.016666666666666666,
"body_raw_text": null
},
{
"_api_c2_category": "21_24",
"_api_c2_m": 0.03333333333333333,
"_api_c2_f": 0.03333333333333333,
"body_raw_text": null
},
{
"_api_c2_category": "24_27",
"_api_c2_m": 0.05,
"_api_c2_f": 0.05,
"body_raw_text": null
},
{
"_api_c2_category": "27_30",
"_api_c2_m": 0.05,
"_api_c2_f": 0.05,
"body_raw_text": null
},
{
"_api_c2_category": "30_35",
"_api_c2_m": 0.11666666666666667,
"_api_c2_f": 0.13333333333333333,
"body_raw_text": null
},
{
"_api_c2_category": "35_45",
"_api_c2_m": 0.2,
"_api_c2_f": 0.08333333333333333,
"body_raw_text": null
},
{
"_api_c2_category": "45_100",
"_api_c2_m": 0.06666666666666667,
"_api_c2_f": 0.016666666666666666,
"body_raw_text": null
}
],
"membersCities": [
{
"_api_c2_category": "washington-dc",
"_api_c2_name": "Washington, D.C.",
"_api_c2_value": 0.3333333333333333,
"body_raw_text": null
},
{
"_api_c2_category": "accra",
"_api_c2_name": "Accra",
"_api_c2_value": 0.3333333333333333,
"body_raw_text": null
},
{
"_api_c2_category": "sao-paulo",
"_api_c2_name": "Sao Paulo",
"_api_c2_value": 0.3333333333333333,
"body_raw_text": null
}
],
"membersCountries": [
{
"_api_c2_category": "united-states",
"_api_c2_name": "United States",
"_api_c2_value": 0.6,
"body_raw_text": null
},
{
"_api_c2_category": "ghana",
"_api_c2_name": "Гана",
"_api_c2_value": 0.2,
"body_raw_text": null
},
{
"_api_c2_category": "brazil",
"_api_c2_name": "Бразилия",
"_api_c2_value": 0.2,
"body_raw_text": null
}
],
"avgLikes": 159420,
"avgComments": 6006,
"country": "australia",
"countryCode": "AU",
"type": "influencer",
"gender": "m",
"age": "45_100",
"categories": [
"business-and-careers",
"management-and-marketing",
"news-and-media"
],
"lastFromMentions": [
{
"_api_c2_cid": "TW:1319287761048723458",
"_api_c2_image": null,
"_api_c2_url": "https://twitter.com/MarioNawfal",
"_api_c2_name": "Mario Nawfal",
"body_raw_text": null
},
{
"_api_c2_cid": "TW:1389913567671975937",
"_api_c2_image": null,
"_api_c2_url": "https://twitter.com/cb_doge",
"_api_c2_name": "DogeDesigner",
"body_raw_text": null
},
{
"_api_c2_cid": "TW:534023",
"_api_c2_image": "https://6f2859a7-8667-4b05-9978-a8922e29bf1f.selstorage.ru/TW:534023?time=1725887316",
"_api_c2_url": "https://twitter.com/alx",
"_api_c2_name": "ALX 🇺🇸",
"body_raw_text": null
},
{
"_api_c2_cid": "TW:25073877",
"_api_c2_image": "https://6f2859a7-8667-4b05-9978-a8922e29bf1f.selstorage.ru/TW:25073877?time=1729322855",
"_api_c2_url": "https://twitter.com/realDonaldTrump",
"_api_c2_name": "Donald J. Trump",
"body_raw_text": null
},
{
"_api_c2_cid": "TW:1366565625401909249",
"_api_c2_image": "https://6f2859a7-8667-4b05-9978-a8922e29bf1f.selstorage.ru/TW:1366565625401909249?time=1726535345",
"_api_c2_url": "https://twitter.com/WallStreetSilv",
"_api_c2_name": "Wall Street Silver",
"body_raw_text": null
},
{
"_api_c2_cid": "TW:13298072",
"_api_c2_image": null,
"_api_c2_url": "https://twitter.com/Tesla",
"_api_c2_name": "Tesla",
"body_raw_text": null
},
{
"_api_c2_cid": "TW:1552795969959636992",
"_api_c2_image": "https://6f2859a7-8667-4b05-9978-a8922e29bf1f.selstorage.ru/TW:1552795969959636992?time=1720575623",
"_api_c2_url": "https://twitter.com/EndWokeness",
"_api_c2_name": "End Wokeness",
"body_raw_text": null
},
{
"_api_c2_cid": "TW:34743251",
"_api_c2_image": "https://6f2859a7-8667-4b05-9978-a8922e29bf1f.selstorage.ru/TW:34743251?time=1729104415",
"_api_c2_url": "https://twitter.com/SpaceX",
"_api_c2_name": "SpaceX",
"body_raw_text": null
},
{
"_api_c2_cid": "TW:1330170106501079041",
"_api_c2_image": null,
"_api_c2_url": "https://twitter.com/Starlink",
"_api_c2_name": "Starlink",
"body_raw_text": null
},
{
"_api_c2_cid": "TW:30354991",
"_api_c2_image": "https://6f2859a7-8667-4b05-9978-a8922e29bf1f.selstorage.ru/TW:30354991?time=1728905239",
"_api_c2_url": "https://twitter.com/KamalaHarris",
"_api_c2_name": "Kamala Harris",
"body_raw_text": null
}
],
"membersTypes": [
{
"_api_c2_name": "real",
"_api_c2_percent": 0,
"body_raw_text": null
},
{
"_api_c2_name": "influencer",
"_api_c2_percent": 0,
"body_raw_text": null
},
{
"_api_c2_name": "massfollowers",
"_api_c2_percent": 0,
"body_raw_text": null
},
{
"_api_c2_name": "suspicious",
"_api_c2_percent": 0,
"body_raw_text": null
}
],
"membersReachability": [
{
"_api_c2_name": "r0_500",
"_api_c2_percent": 0,
"body_raw_text": null
},
{
"_api_c2_name": "r500_1000",
"_api_c2_percent": 0,
"body_raw_text": null
},
{
"_api_c2_name": "r1000_1500",
"_api_c2_percent": 0,
"body_raw_text": null
},
{
"_api_c2_name": "r1500_plus",
"_api_c2_percent": 0,
"body_raw_text": null
}
],
"countries": [
{
"_api_c2_name": "united-states",
"_api_c2_percent": 0.6,
"body_raw_text": null
},
{
"_api_c2_name": "ghana",
"_api_c2_percent": 0.2,
"body_raw_text": null
},
{
"_api_c2_name": "brazil",
"_api_c2_percent": 0.2,
"body_raw_text": null
}
],
"cities": [
{
"_api_c2_name": "washington-dc",
"_api_c2_percent": 0.3333333333333333,
"body_raw_text": null
},
{
"_api_c2_name": "accra",
"_api_c2_percent": 0.3333333333333333,
"body_raw_text": null
},
{
"_api_c2_name": "sao-paulo",
"_api_c2_percent": 0.3333333333333333,
"body_raw_text": null
}
],
"genders": [
{
"_api_c2_name": "m",
"_api_c2_percent": 0.55,
"body_raw_text": null
},
{
"_api_c2_name": "f",
"_api_c2_percent": 0.45,
"body_raw_text": null
}
],
"ages": [
{
"_api_c2_name": "35_45",
"_api_c2_percent": 0.2833333333333333,
"body_raw_text": null
},
{
"_api_c2_name": "30_35",
"_api_c2_percent": 0.25,
"body_raw_text": null
},
{
"_api_c2_name": "0_18",
"_api_c2_percent": 0.1,
"body_raw_text": null
},
{
"_api_c2_name": "24_27",
"_api_c2_percent": 0.1,
"body_raw_text": null
},
{
"_api_c2_name": "27_30",
"_api_c2_percent": 0.1,
"body_raw_text": null
},
{
"_api_c2_name": "45_100",
"_api_c2_percent": 0.08333333333333333,
"body_raw_text": null
},
{
"_api_c2_name": "21_24",
"_api_c2_percent": 0.06666666666666667,
"body_raw_text": null
},
{
"_api_c2_name": "18_21",
"_api_c2_percent": 0.016666666666666666,
"body_raw_text": null
}
],
"toMentions180d": 3045,
"toMentionsCommunities180d": 903,
"toMentionsViews180d": 1297424311,
"fromMentions180d": 633,
"fromMentionsCommunities180d": 89,
"fromMentionsViews180d": 3459473557,
"pctUsersCount180d": 0.11411315818044104,
"pctFakeFollowers": 0
}
}

We serialize this into a more understandable format and store in db.

Now in ad spaces users can add the spaces they want offer for advertising

For every ad space they add

they can put duration (day/week/month) and price (optional) (amount & currency)

now any user can put a request to buy ad space on a profile this would go in requests
now the user witht he profile can either accept / counter the request, this can be maintained with status

Once a request is accepted by a user the vendor would be requested to make payment with PhonePe

the user will be notified that once the ad goes live they will be settled in 6 hours

notifications model is also needed

we will also give an aura score to every profile based on the insight info we have

---

# Architecture Plan for ProfileAura.com

## 1. System Overview

ProfileAura is a marketplace platform connecting social media influencers with advertisers. Users can monetize their social media profiles by selling ad space (headers, bios, stories, posts) to brands and advertisers.

### Core Value Proposition

- **For Creators**: Monetize social media presence by selling ad space
- **For Advertisers**: Access authentic influencer marketing opportunities
- **Platform**: Facilitates discovery, negotiation, payment, and fulfillment

---

## 2. Database Schema

### 2.1 Accounts Table

Primary user account (authenticated via Google OAuth)

```
accounts
├── id (UUID, PK)
├── email (string, unique, indexed)
├── name (string)
├── profile_pic_url (string, nullable)
├── google_id (string, unique, indexed)
├── created_at (timestamp)
├── updated_at (timestamp)
└── is_active (boolean, default: true)
```

### 2.2 Profiles Table

Social media profiles connected to accounts

```
profiles
├── id (UUID, PK)
├── account_id (UUID, FK → accounts.id)
├── platform (enum: 'twitter', 'instagram', 'linkedin', 'tiktok', etc.)
├── platform_account_id (string, indexed) // e.g., Twitter user ID
├── username (string, indexed)
├── name (string)
├── profile_url (string)
├── profile_image_url (string, nullable)
├── description (text, nullable)
├── status (enum, default: VERIFIED/INACTIVE)
├── insights_fetched_at (timestamp, nullable)
├── insights_data (JSONB) // Serialized insights from RapidAPI
├── aura_score (decimal, nullable) // Calculated score

Indexes:
- (account_id, platform)
- (platform, platform_account_id)
- (aura_score DESC) // For discovery/sorting
```

### 2.3 Ad Spaces Table

Available ad spaces on profiles

```
ad_spaces
├── id (UUID, PK)
├── profile_id (UUID, FK → profiles.id)
├── space_type (enum: 'header', 'bio', 'story', 'post', 'reel', 'video')
├── duration_type (enum: 'day', 'week', 'month')
├── base_price_amount (decimal, nullable) // Optional base price
├── base_price_currency (string, default: 'USD')
├── is_available (boolean, default: true)
├── description (text, nullable) // Additional details
├── created_at (timestamp)
└── updated_at (timestamp)

Indexes:
- (profile_id, space_type)
- (is_available, space_type)
```

### 2.4 Requests Table

Ad space purchase requests and negotiations

```
requests
├── id (UUID, PK)
├── ad_space_id (UUID, FK → ad_spaces.id)
├── buyer_account_id (UUID, FK → accounts.id)
├── seller_account_id (UUID, FK → accounts.id) // Denormalized for quick access
├── status (enum: 'pending', 'accepted', 'countered', 'rejected', 'expired', 'cancelled')
├── requested_amount (decimal)
├── requested_currency (string)
├── requested_duration (integer) // Number of duration_type units
├── counter_amount (decimal, nullable) // If seller counters
├── counter_currency (string, nullable)
├── counter_duration (integer, nullable)
├── final_amount (decimal, nullable) // Agreed amount
├── final_currency (string, nullable)
├── final_duration (integer, nullable)
├── offer_message (text, nullable) // Buyer's message
├── counter_message (text, nullable) // Seller's counter message
├── expires_at (timestamp, nullable) // Request expiry
├── created_at (timestamp)
└── updated_at (timestamp)

Indexes:
- (buyer_account_id, status)
- (seller_account_id, status)
- (ad_space_id, status)
- (status, created_at DESC)
```

### 2.5 Orders Table

Completed/accepted requests that proceed to payment

```
orders
├── id (UUID, PK)
├── request_id (UUID, FK → requests.id, unique)
├── buyer_account_id (UUID, FK → accounts.id)
├── seller_account_id (UUID, FK → accounts.id)
├── ad_space_id (UUID, FK → ad_spaces.id)
├── amount (decimal)
├── currency (string)
├── duration (integer)
├── duration_type (enum: 'day', 'week', 'month')
├── status (enum: 'payment_pending', 'paid', 'ad_live', 'completed', 'cancelled', 'refunded')
├── payment_meta (jsonb, nullable) # Contains gateway-specific payment data
├── payment_status (enum: 'pending', 'success', 'failed', 'refunded')
├── payment_completed_at (timestamp, nullable)
├── ad_goes_live_at (timestamp, nullable)
├── ad_goes_live_until (timestamp, nullable)
├── settlement_status (enum: 'pending', 'processing', 'completed', 'failed')
├── settlement_scheduled_at (timestamp, nullable) // 6 hours after ad goes live
├── settlement_completed_at (timestamp, nullable)
├── created_at (timestamp)
└── updated_at (timestamp)

Indexes:
- (buyer_account_id, status)
- (seller_account_id, status)
- (payment_status, settlement_status)
- (settlement_scheduled_at) // For settlement job
```

### 2.6 Notifications Table

User notifications

```
notifications
├── id (UUID, PK)
├── account_id (UUID, FK → accounts.id)
├── type (enum: 'request_received', 'request_accepted', 'request_rejected', 'request_countered', 'payment_received', 'ad_live', 'settlement_completed', 'system')
├── title (string)
├── message (text)
├── related_entity_type (enum: 'request', 'order', 'profile', null)
├── related_entity_id (UUID, nullable)
├── is_read (boolean, default: false)
├── read_at (timestamp, nullable)
├── created_at (timestamp)
└── updated_at (timestamp)

Indexes:
- (account_id, is_read, created_at DESC)
- (account_id, type)
```

### 2.7 Insights Data Structure (JSONB in profiles.insights_data)

Normalized structure from RapidAPI response:

```
{
  "platform": "TW",
  "platform_account_id": "44196397",
  "basic": {
    "name": "Elon Musk",
    "username": "elonmusk",
    "url": "https://twitter.com/elonmusk",
    "image": "https://...",
    "description": "...",
    "verified": true,
    "followers": 201977940,
    "country": "australia",
    "country_code": "AU"
  },
  "engagement": {
    "avg_er": 11.28, // Average engagement rate
    "avg_interactions": 189186,
    "avg_views": 34030482,
    "avg_likes": 159420,
    "avg_comments": 6006,
    "quality_score": 0.87
  },
  "demographics": {
    "genders": [{"name": "m", "percent": 0.55}, {"name": "f", "percent": 0.45}],
    "ages": [
      {"category": "35_45", "percent": 0.28},
      {"category": "30_35", "percent": 0.25}
      // ... more age groups
    ],
    "countries": [
      {"name": "united-states", "percent": 0.6}
      // ... more countries
    ],
    "cities": [
      {"name": "washington-dc", "percent": 0.33}
      // ... more cities
    ]
  },
  "audience_quality": {
    "pct_fake_followers": 0,
    "members_types": [
      {"name": "real", "percent": 0},
      {"name": "influencer", "percent": 0}
    ]
  },
  "reach": {
    "to_mentions_180d": 3045,
    "to_mentions_views_180d": 1297424311,
    "from_mentions_180d": 633,
    "from_mentions_views_180d": 3459473557
  },
  "tags": ["influencer", "business-and-careers", "news-and-media"],
  "fetched_at": "2024-10-19T07:02:36.459Z"
}
```

---

## 3. Authentication & Authorization

### 3.1 Primary Authentication (Google OAuth)

- **Flow**: OAuth 2.0 with Google
- **Endpoints**:
  - `GET /auth/google` - Initiate OAuth
  - `GET /auth/google/callback` - Handle callback
  - `POST /auth/logout` - Logout
- **Session Management**: JWT tokens or session cookies
- **User Creation**: Auto-create account on first Google login

### 3.2 Platform-Specific OAuth (Profile Connection)

#### Twitter/X OAuth

- **Flow**: OAuth 1.0a or OAuth 2.0 (depending on API version)
- **Endpoints**:
  - `GET /auth/twitter/connect` - Initiate Twitter OAuth
  - `GET /auth/twitter/callback` - Handle callback, create/update profile
- **Token Storage**: Encrypt and store `oauth_token`, `oauth_token_secret` (OAuth 1.0) or `access_token`, `refresh_token` (OAuth 2.0)

#### Instagram OAuth

- **Flow**: OAuth 2.0
- **Endpoints**:
  - `GET /auth/instagram/connect` - Initiate Instagram OAuth
  - `GET /auth/instagram/callback` - Handle callback, create/update profile
- **Token Storage**: Encrypt and store `access_token`, `refresh_token`

#### Other Platforms

- Similar pattern for LinkedIn, TikTok, YouTube, etc.

### 3.3 Authorization Rules

- Users can only manage their own accounts and profiles
- Users can only accept/reject requests for their own ad spaces
- Users can only view their own notifications
- Public profiles and ad spaces are discoverable by all authenticated users

---

## 4. API Endpoints

### 4.1 Authentication

```
POST   /api/auth/google/callback
POST   /api/auth/logout
GET    /api/auth/me
```

### 4.2 Profiles

```
GET    /api/profiles                    # List user's profiles
POST   /api/profiles                    # Create profile (via OAuth)
GET    /api/profiles/:id                # Get profile details
PUT    /api/profiles/:id                # Update profile
DELETE /api/profiles/:id                # Disconnect profile
GET    /api/profiles/:id/insights       # Get insights (refresh)
GET    /api/profiles/public             # Public profile discovery
GET    /api/profiles/public/:id         # Public profile view
```

### 4.3 Ad Spaces

```
GET    /api/ad-spaces                   # List user's ad spaces
POST   /api/ad-spaces                   # Create ad space
GET    /api/ad-spaces/:id               # Get ad space details
PUT    /api/ad-spaces/:id               # Update ad space
DELETE /api/ad-spaces/:id               # Delete ad space
GET    /api/ad-spaces/public            # Public ad space discovery (marketplace)
GET    /api/ad-spaces/public/:id        # Public ad space view
```

### 4.4 Requests

```
GET    /api/requests                    # List user's requests (as buyer/seller)
POST   /api/requests                    # Create request (buy ad space)
GET    /api/requests/:id                # Get request details
PUT    /api/requests/:id/accept         # Accept request
PUT    /api/requests/:id/counter        # Counter offer
PUT    /api/requests/:id/reject         # Reject request
PUT    /api/requests/:id/cancel         # Cancel request (buyer)
```

### 4.5 Orders

```
GET    /api/orders                      # List user's orders
GET    /api/orders/:id                  # Get order details
POST   /api/deals/:id/create-payment-order  # Initiate payment (requires gateway parameter)
GET    /api/deals/:id/payment-callback      # Payment callback from gateway
POST   /api/deals/:id/complete-payment      # Complete payment verification (requires gateway parameter)
PUT    /api/orders/:id/mark-live        # Mark ad as live (seller)
```

### 4.6 Notifications

```
GET    /api/notifications               # List user's notifications
GET    /api/notifications/unread-count  # Get unread count
PUT    /api/notifications/:id/read      # Mark as read
PUT    /api/notifications/read-all      # Mark all as read
```

---

## 5. Business Logic Flows

### 5.1 Profile Connection Flow

1. User clicks "Connect Twitter/Instagram"
2. Redirect to platform OAuth
3. User authorizes
4. Callback received with tokens
5. Fetch basic profile info from platform API
6. Create/update `profiles` record
7. Notify user: "Profile connected successfully"

### 5.2 Insights Fetching Flow

1. Run a cron every 5 mins
2. This checks profiles table where insights_fetched_at is null
3. Call RapidAPI: `GET /get_social_profile` with platform username/ID
4. Parse and normalize response
5. Store in `profiles.insights_data` (JSONB)
6. Recalculate `aura_score`
7. Update `profiles.insights_fetched_at`

### 5.3 Ad Space Creation Flow

1. User selects profile
2. User selects space type (header, bio, story, etc.)
3. User optionally sets base price (amount + currency)
4. User sets duration type (day/week/month)
5. Create `ad_spaces` record
6. Ad space becomes discoverable in marketplace
7. User can select multiple duration for one ad space and each duration can have separate amount + currency

### 5.4 Request Flow

1. Buyer browses marketplace, finds ad space
2. Buyer creates request with:
   - Amount and currency
   - Duration (number of units)
   - Optional message
3. Create `requests` record with status='pending'
4. Notify seller: "New request for your ad space"
5. Seller can:
   - Accept → Create order, proceed to payment
   - Counter → Update request with counter_amount, status='countered'
   - Reject → Update status='rejected'
6. If countered, buyer can accept /reject counter or create new request

### 5.5 Payment Flow (PhonePe)

1. Request accepted → Create `deals` record, status='BUYER_PAYMENT_COMPLETED'
2. Generate payment order:
   - Call backend: `POST /api/deals/:id/create-payment-order` with `gateway: 'phonepe'`
   - Backend creates PhonePe payment order via PhonePe API
   - Store payment order details in `payment_meta` field
3. Frontend redirects to PhonePe payment page (redirectUrl from order response)
4. User completes payment on PhonePe
5. PhonePe redirects to callback: `GET /api/deals/:id/payment-callback`
6. Backend verifies payment with PhonePe API
7. Update deal:
   - `payment_meta.payment` = payment details
   - `status` = 'AD_PENDING'
8. Redirect to frontend with success/failure status
9. Notify seller: "Payment received, ad can go live"
10. Notify buyer: "Payment successful"

### 5.6 Ad Fulfillment Flow

1. After payment, seller marks ad as live
2. Update order:
   - `status` = 'ad_live'
   - `ad_goes_live_at` = now
   - `ad_goes_live_until` = now + duration
3. Schedule settlement job for `ad_goes_live_at + 6 hours`
4. Notify buyer: "Ad is now live"
5. After duration expires, mark order as 'completed'

## 6. Aura Score Calculation

Aura Score is a composite metric (0-100) indicating profile quality and value.

### 6.1 Components

**Base Score (40 points)**

- Follower count (logarithmic scale): 0-20 points
- Verification status: +5 points if verified
- Account age/established: 0-15 points

**Engagement Score (30 points)**

- Average engagement rate (avgER): 0-15 points
- Quality score: 0-10 points
- Average interactions: 0-5 points

**Audience Quality (20 points)**

- Fake followers percentage (inverse): 0-10 points
- Real followers percentage: 0-10 points

**Reach Score (10 points)**

- Mentions and reach metrics: 0-10 points

### 6.2 Calculation Formula (Pseudocode)

```
aura_score = 0

// Base Score (40)
if followers > 0:
    aura_score += min(20, log10(followers) * 2)
if verified:
    aura_score += 5
aura_score += min(15, account_age_score)

// Engagement Score (30)
aura_score += min(15, avgER * 1.5)
aura_score += min(10, qualityScore * 10)
aura_score += min(5, normalize(avgInteractions))

// Audience Quality (20)
aura_score += min(10, (1 - pctFakeFollowers) * 10)
aura_score += min(10, realFollowersPercent * 10)

// Reach Score (10)
aura_score += min(10, normalize(reachMetrics))

// Cap at 100
aura_score = min(100, aura_score)
```

### 6.3 Recalculation Triggers

- After insights fetch/refresh
- Daily cron job (recalculate all profiles)
- Manual trigger via API

---

## 7. Notification System

### 7.1 Notification Types

- `request_received`: New request for your ad space
- `request_accepted`: Your request was accepted
- `request_rejected`: Your request was rejected
- `request_countered`: Seller countered your request
- `payment_received`: Payment received for your ad space
- `ad_live`: Ad is now live
- `system`: General system notifications

### 7.2 Delivery Channels

- None: Just stored in notifications table and shown to user on refresh of page

### 7.3 Notification Triggers

- Request created → Notify seller
- Request accepted → Notify buyer
- Request rejected → Notify buyer
- Request countered → Notify buyer
- Payment completed → Notify seller
- Ad marked live → Notify buyer

---

## 9. Security Considerations

### 9.1 Data Protection

- Encrypt OAuth tokens at rest (AES-256)
- Use environment variables for API keys
- Never log sensitive data
- HTTPS everywhere

### 9.2 Authentication Security

- JWT tokens with short expiration
- Refresh token rotation
- CSRF protection
- Rate limiting on auth endpoints

### 9.3 Payment Security

- Verify payment gateway signatures (PhonePe, etc.)
- Never trust client-side payment data
- Idempotency keys for payment processing
- Audit logs for all financial transactions

### 9.4 API Security

- Rate limiting per user/IP
- Input validation and sanitization
- SQL injection prevention (use ORM)
- XSS prevention (sanitize user inputs)

---

## 10. Background Jobs

### 10.1 Scheduled Jobs

- **Daily**: Clean up expired requests (status='pending', expired)

---

## 11. Frontend Pages/Views

### 11.1 Public Pages

- `/` - Landing page
- `/marketplace` - Browse ad spaces
- `/marketplace/:id` - Ad space details
- `/profiles/:id` - Public profile view

### 11.2 Authenticated Pages

- `/dashboard` - User dashboard
- `/profiles` - Manage profiles
- `/profiles/connect` - Connect new profile
- `/profiles/:id` - Profile details
- `/ad-spaces` - Manage ad spaces
- `/ad-spaces/new` - Create ad space
- `/ad-spaces/:id` - Ad space details
- `/requests` - View requests (buyer/seller)
- `/requests/:id` - Request details
- `/orders` - View orders
- `/orders/:id` - Order details
- `/notifications` - Notifications center
- `/settings` - Account settings

---

---

## 18. Logging & Monitoring

### 18.1 Log Levels

- **ERROR**: Payment failures, OAuth errors, critical system errors
- **WARN**: Rate limit hits, expired tokens, stale insights
- **INFO**: User actions (profile connected, request created, payment received)
- **DEBUG**: API calls, database queries (development only)

  This architecture plan provides a comprehensive foundation for building ProfileAura.com. Each section can be expanded with detailed implementation notes as development progresses.

Implement a logger service like /Users/roopesh/Projects/Me/twin/backend/src/common/logger.service.ts. Enhance it to also support traces. Traces will be array of objects. and rendering would be [servicename:actionname] [tracekey:tracevalue::tracekey:tracevalue::..]

Coding ->

Reusability should be at the core, no code should be repeated.
Make .env.sample for both front and backend

Backend ->

Nestjs
Postgres with sequelize for db

Implement a logger service like /Users/roopesh/Projects/Me/twin/backend/src/common/logger.service.ts. Enhance it to also support traces. Traces will be array of objects. and rendering would be [servicename:actionname] [tracekey:tracevalue::tracekey:tracevalue::..]

Frontend ->
React with material ui
Responsive for mobile & desktop
apiservice which has all api calls
React main app.js shoudl have all code to fetch notifs, auth user etc and this should be passed down to all components
Ui Should be amazing with lots of animations
Dark/light theme support
Useeffects should be very conservatively used.
