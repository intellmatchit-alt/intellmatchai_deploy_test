# P2P Relationship Intelligence App

A Progressive Web App (PWA) for professional networking and relationship management with AI-powered features.

## Features

- **Smart Profile Management**: Multi-dimensional user profiles with sectors, skills, interests, and goals
- **Business Card Scanning**: OCR-powered instant extraction with AI refinement
- **Intelligent Matching**: AI-powered relationship scoring and recommendations
- **Intersection Analysis**: Discover common ground and collaboration opportunities
- **Relationship Mapping**: Visual network graph with connection insights
- **Explainable AI**: Human-friendly reasons for every recommendation

## Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + Shadcn/ui
- **State**: Zustand + React Query
- **i18n**: next-intl (English + Arabic with RTL support)

### Backend
- **Runtime**: Node.js 20
- **Framework**: Express.js + TypeScript
- **ORM**: Prisma
- **Architecture**: Clean Architecture with SOLID principles

### Databases
- **Primary**: MySQL 8.0
- **Graph**: Neo4j (for relationship mapping)
- **Cache**: Redis

### AI Services (with fallbacks)
- OCR: Tesseract.js → Azure Document Intelligence
- Matching: Deterministic → Recombee
- Explanations: Templates → OpenAI

## Project Structure

```
p2p-app/
├── frontend/           # Next.js 14 PWA
│   ├── src/
│   │   ├── app/        # App Router pages
│   │   ├── components/ # UI components
│   │   ├── hooks/      # Custom hooks
│   │   ├── lib/        # Utilities, API, i18n
│   │   ├── stores/     # Zustand stores
│   │   ├── styles/     # Themes & tokens
│   │   └── locales/    # Translation files
│   └── ...
├── backend/            # Express.js API
│   ├── src/
│   │   ├── application/    # Use cases & DTOs
│   │   ├── domain/         # Entities & business logic
│   │   ├── infrastructure/ # Database & services
│   │   └── presentation/   # Controllers & routes
│   └── prisma/         # Database schema
├── docker/             # Docker configuration
└── docs/               # Documentation
```

## Getting Started

### Prerequisites

- Node.js 20+
- Docker Desktop
- Git

### 1. Clone the Repository

```bash
git clone <repository-url>
cd p2p-app
```

### 2. Start Docker Services

```bash
cd docker
docker-compose up -d
```

This starts:
- MySQL on port 3306
- Redis on port 6379
- Neo4j on ports 7474 (HTTP) and 7687 (Bolt)
- MinIO on ports 9000 (API) and 9001 (Console)

### 3. Setup Backend

```bash
cd backend

# Install dependencies
npm install

# Copy environment file
cp ../.env.example .env

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed database
npm run prisma:seed

# Start development server
npm run dev
```

Backend runs on http://localhost:3001

### 4. Setup Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend runs on http://localhost:3000

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Database
DATABASE_URL="mysql://p2p_user:p2p_password@localhost:3306/p2p_db"

# Redis
REDIS_URL="redis://localhost:6379"

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=neo4jpassword

# JWT (generate with: openssl rand -base64 64)
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret

# AI Services (optional - set when available)
OPENAI_API_KEY=
AZURE_DOCUMENT_KEY=
```

## Customization

### Changing Colors

Edit `frontend/src/styles/themes/tokens.ts`:

```typescript
export const colors = {
  primary: {
    500: '#7C3AED', // Change this to your brand color
    // ...
  },
};
```

### Adding a New Language

1. Create folder: `frontend/src/locales/[lang]/`
2. Copy all JSON files from `en/`
3. Translate the values
4. Add to `frontend/src/lib/i18n/config.ts`:

```typescript
export const locales = ['en', 'ar', 'fr'] as const; // Add new locale
```

### Modifying UI Components

Each component in `frontend/src/components/ui/` has:
- `Component.tsx` - Component logic
- `Component.variants.ts` - Style variants (easy to edit)
- `index.ts` - Exports

Edit the `.variants.ts` file to change component appearance.

## API Documentation

API is available at `/api/v1/`. Key endpoints:

| Endpoint | Description |
|----------|-------------|
| `POST /auth/register` | User registration |
| `POST /auth/login` | Authentication |
| `GET /contacts` | List contacts |
| `POST /scan/card` | Scan business card |
| `GET /matches` | Get recommendations |
| `GET /graph/network` | Network data |

## Design Patterns

- **Repository Pattern**: Data access abstraction
- **Factory Pattern**: Object creation
- **Strategy Pattern**: Swappable algorithms (OCR, matching)
- **Observer Pattern**: Event-driven updates
- **Decorator Pattern**: Caching, logging

## SOLID Principles

- **S**: Each use case has single responsibility
- **O**: Strategy pattern for extensibility
- **L**: All repositories are interchangeable
- **I**: Small, focused interfaces
- **D**: Dependencies on abstractions

## Deployment

### Docker Production

```bash
cd docker
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Manual Deployment

1. Build frontend: `cd frontend && npm run build`
2. Build backend: `cd backend && npm run build`
3. Start with: `npm start`

## License

UNLICENSED - Proprietary

## Support

For issues or questions, contact the development team.
