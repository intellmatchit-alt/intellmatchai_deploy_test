# Web Scraping & Data Fetching Services

**IntellMatch Platform - Technical Documentation**

---

## Overview

This module contains all web scraping, data extraction, and enrichment services for the IntellMatch professional networking platform. These services enable:

- **Business Card Scanning** - OCR-based contact extraction
- **Profile Research** - AI-powered web search for professional profiles
- **Contact Enrichment** - Professional data enrichment from multiple sources
- **LinkedIn Scraping** - Profile data extraction for onboarding auto-fill
- **Face Search** - Reverse image search for social profile discovery

---

## Directory Structure

```
webscraping/
├── README.md                       # This documentation
├── docs/
│   └── TECHNICAL_SPECIFICATION.md  # Detailed technical specs
│
├── ocr/                            # OCR Services
│   ├── AzureOCRService.ts          # Azure Document Intelligence
│   ├── GoogleVisionOCRService.ts   # Google Cloud Vision
│   ├── TesseractOCRService.ts      # Local OCR (Tesseract.js)
│   ├── OCRServiceFactory.ts        # Service factory pattern
│   └── index.ts
│
├── enrichment/                     # Data Enrichment Services
│   ├── PDLEnrichmentService.ts     # People Data Labs API
│   ├── ProfileEnrichmentService.ts # LinkedIn + CV parsing
│   ├── EnrichmentOrchestrator.ts   # Multi-service orchestration
│   ├── NumVerifyService.ts         # Phone validation
│   ├── AbstractAPIService.ts       # Email/phone validation
│   ├── EnrichmentServiceFactory.ts # Service factory
│   └── index.ts
│
├── explorer/                       # Profile Research Services
│   ├── explorer-api.ts             # Main search endpoint
│   ├── explorer-scan-api.ts        # Card scan + search
│   ├── deep-search-api.ts          # Deep web research
│   └── explorer-page.tsx           # Frontend component
│
├── face-search/                    # Face Search Service
│   ├── FaceSearchService.ts        # PimEyes integration
│   ├── IFaceSearchService.ts       # Interface definition
│   └── index.ts
│
├── scan-controller.ts              # Business card scan controller
├── scan-routes.ts                  # Scan API routes
├── profile-routes.ts               # Profile enrichment routes
└── onboarding-page.tsx             # Onboarding UI component
```

---

## Services

### 1. OCR Services

Extract text from business card images.

| Service | Type | Description |
|---------|------|-------------|
| Azure Document Intelligence | Cloud | Primary OCR with structured output |
| Google Cloud Vision | Cloud | Secondary OCR service |
| Tesseract.js | Local | Browser-side fallback |

**Configuration:**
```bash
FEATURE_AZURE_OCR=true
AZURE_DOCUMENT_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_DOCUMENT_KEY=your-key

FEATURE_GOOGLE_VISION=true
GOOGLE_VISION_API_KEY=your-key
```

---

### 2. Explorer Services

AI-powered web search for professional profile research.

| Service | Purpose |
|---------|---------|
| Perplexity API | Real-time web search with citations |
| OpenAI GPT-4o | AI analysis and inference |
| Google Custom Search | LinkedIn and news search |

**Features:**
- Professional background research
- Skills and expertise extraction
- Ice breaker suggestions
- Social media profile discovery

**Configuration:**
```bash
PERPLEXITY_API_KEY=your-key
OPENAI_API_KEY=your-key
GOOGLE_CSE_KEY=your-key
GOOGLE_CSE_CX=your-search-engine-id
```

---

### 3. Enrichment Services

Professional data enrichment from multiple sources.

| Service | Data Type |
|---------|-----------|
| People Data Labs | Professional profiles, employment history |
| Coresignal | LinkedIn profile data |
| RapidAPI LinkedIn | LinkedIn backup |
| ScrapIn | GDPR-compliant LinkedIn |
| NumVerify | Phone number validation |
| AbstractAPI | Email and phone validation |

**Configuration:**
```bash
FEATURE_PDL_ENRICHMENT=true
PDL_API_KEY=your-key

CORESIGNAL_API_KEY=your-key
RAPIDAPI_KEY=your-key
SCRAPIN_API_KEY=your-key

NUMVERIFY_API_KEY=your-key
ABSTRACTAPI_API_KEY=your-key
```

---

### 4. Face Search Service

Reverse face search for social profile discovery.

| Service | Description |
|---------|-------------|
| PimEyes | Reverse face search API |

**Note:** Disabled by default. Requires explicit user consent.

**Configuration:**
```bash
FEATURE_FACE_SEARCH=true
PIMEYES_API_KEY=your-key
```

---

## API Endpoints

### Frontend (Next.js)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/explorer` | POST | Profile research |
| `/api/explorer/scan` | POST | Business card scan + research |
| `/api/scan/deep-search` | POST | Deep web search |

### Backend (Express.js)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/scan/process-card` | POST | Process business card image |
| `/api/v1/profile/enrich` | POST | Enrich profile with LinkedIn/CV |
| `/api/v1/profile/parse-cv` | POST | Parse CV file |
| `/api/v1/contacts/:id/enrich` | POST | Enrich existing contact |

---

## Environment Variables

### Required

```bash
# Database
DATABASE_URL=mysql://user:pass@localhost:3306/db
REDIS_URL=redis://localhost:6379

# AI Services
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
```

### Optional (Enable Features)

```bash
# OCR
AZURE_DOCUMENT_ENDPOINT=
AZURE_DOCUMENT_KEY=
GOOGLE_VISION_API_KEY=

# Search
PERPLEXITY_API_KEY=
GOOGLE_CSE_KEY=
GOOGLE_CSE_CX=

# Enrichment
PDL_API_KEY=
CORESIGNAL_API_KEY=
RAPIDAPI_KEY=
SCRAPIN_API_KEY=
NUMVERIFY_API_KEY=
ABSTRACTAPI_API_KEY=

# Face Search
PIMEYES_API_KEY=

# Feature Flags
FEATURE_AZURE_OCR=true
FEATURE_GOOGLE_VISION=true
FEATURE_PDL_ENRICHMENT=true
FEATURE_FACE_SEARCH=false
FEATURE_OPENAI=true
FEATURE_GROQ=true
```

---

## Usage Examples

### Business Card Scanning

```typescript
import { getOCRService } from './ocr';

const ocrService = getOCRService();
const result = await ocrService.extractText(imageBuffer);

// Result: { text: "John Doe\nCEO...", confidence: 0.95 }
```

### Profile Enrichment

```typescript
import { ProfileEnrichmentService } from './enrichment';

const service = new ProfileEnrichmentService();
const result = await service.enrichProfile({
  linkedInUrl: 'https://linkedin.com/in/johndoe',
  cvText: 'Resume content...',
});

// Result: { profile, suggestedSectors, suggestedSkills, ... }
```

### Explorer Search

```typescript
// POST /api/explorer
const response = await fetch('/api/explorer', {
  method: 'POST',
  body: JSON.stringify({
    name: 'John Doe',
    company: 'TechCorp',
    linkedInUrl: 'https://linkedin.com/in/johndoe',
  }),
});

// Result: { name, summary, skills, sectors, iceBreakers, ... }
```

---

## Architecture Patterns

### Factory Pattern
All services use factory patterns for provider selection:
- `OCRServiceFactory.create('auto')`
- `EnrichmentServiceFactory.create('pdl')`

### Fallback Chain
Services implement automatic fallbacks:
```
OCR: Azure → Google Vision → Tesseract
LinkedIn: Coresignal → RapidAPI → ScrapIn → ScrapingBee
```

### Caching
Redis caching for search results:
- TTL: 1 hour for search results
- Cache key: MD5 hash of search parameters

---

## Error Handling

All services implement:
- Automatic retries with exponential backoff
- Graceful degradation to fallback providers
- Structured error logging
- User-friendly error messages

---

## Security

- API keys stored in environment variables
- Rate limiting per endpoint
- GDPR consent tracking for enrichment
- Face search requires explicit consent
- Data retention policies enforced

---

## Testing

```bash
# Run unit tests
npm test -- --grep "ocr"
npm test -- --grep "enrichment"

# Run integration tests
npm run test:integration
```

---

## Related Documentation

- `docs/TECHNICAL_SPECIFICATION.md` - Detailed technical specifications
- `backend/src/config/index.ts` - Configuration schema
- `backend/prisma/schema.prisma` - Database models

---

*For questions or issues, contact the engineering team.*
