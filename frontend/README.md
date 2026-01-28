# Profile Aura Frontend

## Setup

1. Install dependencies:
```bash
npm install
```

2. Fetch constants from backend (make sure backend is running):
```bash
npm run fetch-constants
```

Or set BACKEND_URL environment variable:
```bash
BACKEND_URL=http://localhost:6767 npm run fetch-constants
```

## Development

The `fetch-constants` script runs automatically before `start` and `build` via npm lifecycle hooks (`prestart` and `prebuild`).

```bash
npm start
```

## Using Constants

Import constants from `src/constants.json`:
```javascript
import constants from './constants.json';
console.log(constants.APP_NAME);
```

## Using API Helper

Import the API helper from `src/helper/api.js`:
```javascript
import api from './helper/api';

// GET request
const data = await api.get('/accounts/me');

// POST request
const result = await api.post('/accounts', { name: 'John' });

// PATCH request
await api.patch('/accounts/123', { name: 'Jane' });

// DELETE request
await api.delete('/accounts/123');
```

