# Viber

Real-time communication platform with messaging, WebSocket channels, and AI-powered intelligence.

## Features

- Real-time messaging via Socket.IO
- User authentication with JWT
- Rate limiting and security hardening (Helmet, CORS)
- Redis-backed session and caching layer
- MongoDB data persistence
- Input validation with Joi and express-validator
- Structured logging with Winston
- React client with modern UI

## Tech Stack

- **Backend:** Node.js, Express, Socket.IO
- **Database:** MongoDB (Mongoose), Redis
- **Auth:** JWT, bcrypt
- **Client:** React (Create React App)
- **Testing:** Jest, Supertest

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB
- Redis

### Install

```bash
# Backend
npm install

# Client
cd client && npm install
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description |
|----------|-------------|
| `PORT` | Server port |
| `MONGODB_URI` | MongoDB connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | JWT signing secret |
| `AWS_ACCESS_KEY_ID` | AWS access key (optional) |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key (optional) |

### Run

```bash
# Development
npm run dev

# Client
cd client && npm start
```

## Project Structure

```
viber/
├── index.js              # Entry point
├── src/
│   ├── app.js            # Express app setup
│   ├── config/           # Configuration
│   ├── controllers/      # Route controllers
│   ├── middleware/        # Auth, rate limiting, validation
│   ├── models/           # Mongoose models
│   ├── routes/           # API routes
│   ├── services/         # Business logic
│   └── utils/            # Helpers
├── client/               # React frontend
├── tests/                # Test suites
└── docs/                 # Documentation
```

## Contributing

PRs welcome.

## License

MIT

## Credits

Built by Armando Diaz Silverio
