# Web Scraping Services - Technical Specification

**Document Version:** 1.0
**Last Updated:** January 2025
**Author:** Engineering Team
**Status:** Production

---

## 1. Executive Summary

This document provides technical specifications for all web scraping, data extraction, and enrichment services implemented in the IntellMatch platform. These services enable automated contact data extraction from business cards, profile research, and professional data enrichment.

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  /scan      │  │  /explorer  │  │ /onboarding │  │  /contacts  │        │
│  │  (Camera)   │  │  (Research) │  │ (Auto-fill) │  │  (Enrich)   │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
└─────────┼────────────────┼────────────────┼────────────────┼────────────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API LAYER                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Next.js API Routes (Frontend)                     │   │
│  │  /api/scan/deep-search  │  /api/explorer  │  /api/explorer/scan     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Express.js Routes (Backend)                       │   │
│  │  /api/v1/scan/*  │  /api/v1/profile/enrich  │  /api/v1/contacts/*   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SERVICE LAYER                                         │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌──────────────┐ │
│  │  OCR Services │  │   Explorer    │  │  Enrichment   │  │ Face Search  │ │
│  │               │  │   Services    │  │   Services    │  │  Service     │ │
│  │ - Azure       │  │ - Perplexity  │  │ - PDL         │  │ - PimEyes    │ │
│  │ - Google      │  │ - OpenAI      │  │ - Coresignal  │  │              │ │
│  │ - Tesseract   │  │ - Google CSE  │  │ - NumVerify   │  │              │ │
│  │ - GPT Parser  │  │               │  │ - AbstractAPI │  │              │ │
│  └───────────────┘  └───────────────┘  └───────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Service Dependencies

```
OCR Services
├── Azure Document Intelligence (Primary)
├── Google Cloud Vision (Secondary)
├── Tesseract.js (Fallback)
└── OpenAI GPT-4o-mini (Field Extraction)

Explorer Services
├── Perplexity API (Primary Web Search)
├── OpenAI GPT-4o (Fallback/Analysis)
└── Google Custom Search Engine

Enrichment Services
├── People Data Labs (Professional Data)
├── Coresignal (LinkedIn Data)
├── RapidAPI LinkedIn (Backup)
├── ScrapIn (GDPR Compliant)
├── ScrapingBee (General Scraping)
├── NumVerify (Phone Validation)
└── AbstractAPI (Email/Phone Validation)

Face Search Services
└── PimEyes API (Reverse Face Search)
```

---

## 3. Service Specifications

### 3.1 OCR Services

#### 3.1.1 Azure Document Intelligence

| Property | Value |
|----------|-------|
| **Service Type** | Cloud API |
| **Endpoint** | `https://{resource}.cognitiveservices.azure.com/` |
| **Model** | prebuilt-businessCard |
| **Input** | Base64 image or URL |
| **Output** | Structured JSON with extracted fields |
| **Accuracy** | ~95% for standard business cards |
| **Latency** | 1-3 seconds |
| **Cost** | ~$1.50 per 1,000 pages |

**Supported Fields:**
- ContactNames, CompanyNames, JobTitles
- Emails, PhoneNumbers, Faxes
- Addresses, Websites, SocialMedia

#### 3.1.2 Google Cloud Vision

| Property | Value |
|----------|-------|
| **Service Type** | Cloud API |
| **Endpoint** | `https://vision.googleapis.com/v1/images:annotate` |
| **Feature** | TEXT_DETECTION |
| **Input** | Base64 image |
| **Output** | Raw text with bounding boxes |
| **Accuracy** | ~90% for printed text |
| **Latency** | 0.5-2 seconds |
| **Cost** | ~$1.50 per 1,000 images |

#### 3.1.3 Tesseract.js

| Property | Value |
|----------|-------|
| **Service Type** | Local/Browser |
| **Language** | eng (default) |
| **Input** | Image buffer or URL |
| **Output** | Raw text |
| **Accuracy** | ~70-85% depending on image quality |
| **Latency** | 2-5 seconds |
| **Cost** | Free |

#### 3.1.4 GPT Field Extraction

| Property | Value |
|----------|-------|
| **Service Type** | Cloud API |
| **Model** | gpt-4o-mini |
| **Purpose** | Parse raw OCR text into structured fields |
| **Input** | Raw OCR text |
| **Output** | JSON with name, email, phone, company, etc. |
| **Advantages** | Handles OCR errors, bullet point misreads |
| **Latency** | 1-2 seconds |
| **Cost** | ~$0.0001 per request |

---

### 3.2 Explorer Services

#### 3.2.1 Perplexity API

| Property | Value |
|----------|-------|
| **Service Type** | AI-Powered Web Search |
| **Model** | sonar-pro |
| **Endpoint** | `https://api.perplexity.ai/chat/completions` |
| **Features** | Real-time web search, citations |
| **Input** | Search query with context |
| **Output** | Structured profile data with sources |
| **Latency** | 3-8 seconds |
| **Cost** | ~$5 per 1,000 requests |

**Output Schema:**
```typescript
interface ExplorerResult {
  name: string;
  company?: string;
  jobTitle?: string;
  summary: string;
  professionalBackground: string;
  sectors: string[];
  skills: string[];
  interests: string[];
  iceBreakers: string[];
  commonGround: string[];
  approachTips: string;
  socialMedia: SocialProfile[];
  sources: string[];
}
```

#### 3.2.2 Google Custom Search Engine

| Property | Value |
|----------|-------|
| **Service Type** | Web Search API |
| **Endpoint** | `https://www.googleapis.com/customsearch/v1` |
| **Results per query** | Up to 10 |
| **Query strategies** | LinkedIn-focused, Wikipedia, Company sites |
| **Cost** | $5 per 1,000 queries |

---

### 3.3 Enrichment Services

#### 3.3.1 People Data Labs (PDL)

| Property | Value |
|----------|-------|
| **Service Type** | Data Enrichment API |
| **Endpoint** | `https://api.peopledatalabs.com/v5/person/enrich` |
| **Input** | Email, phone, LinkedIn URL, or name+company |
| **Output** | Full professional profile |
| **Data Points** | 200+ fields per record |
| **Accuracy** | 85-95% match rate |
| **Cost** | ~$0.10 per successful enrichment |

**Output Fields:**
- Personal: full_name, first_name, last_name, gender
- Professional: job_title, job_company_name, industry
- Social: linkedin_url, twitter_url, github_username
- Contact: work_email, personal_emails, phone_numbers
- Education: schools, degrees, majors
- Skills: skills[], interests[]

#### 3.3.2 Coresignal (LinkedIn Scraping)

| Property | Value |
|----------|-------|
| **Service Type** | LinkedIn Data API |
| **Endpoint** | `https://api.coresignal.com/cdapi/v2/employee_clean/collect/{username}` |
| **Input** | LinkedIn username |
| **Output** | Full LinkedIn profile data |
| **Data Points** | Experiences, education, skills, connections |
| **GDPR** | Compliant (public data only) |
| **Cost** | ~$0.05 per profile |

---

### 3.4 Face Search Service

#### 3.4.1 PimEyes API

| Property | Value |
|----------|-------|
| **Service Type** | Reverse Face Search |
| **Input** | Base64 face image |
| **Output** | Matching URLs with confidence scores |
| **Accuracy** | 90%+ for clear images |
| **Privacy** | Requires explicit user consent |
| **Status** | **DISABLED BY DEFAULT** |

---

## 4. Data Flow Specifications

### 4.1 Business Card Scanning Flow

```
Input: Business Card Image (JPEG/PNG, max 10MB)
│
├─► Image Preprocessing (Sharp.js)
│   ├── Resize to optimal dimensions
│   ├── Adjust contrast/brightness
│   └── Convert to supported format
│
├─► OCR Extraction
│   ├── Try Azure Document Intelligence
│   ├── Fallback: Google Cloud Vision
│   └── Fallback: Tesseract.js
│
├─► GPT Field Extraction
│   ├── Parse raw OCR text
│   ├── Fix common OCR errors
│   └── Extract structured fields
│
├─► Web Search Enrichment (Optional)
│   ├── Google CSE for LinkedIn/Wikipedia
│   └── GPT analysis of search results
│
└─► Output: ContactData
    ├── name, email, phone
    ├── company, jobTitle, website
    ├── linkedInUrl, location
    ├── bio, skills[], sectors[]
    └── sources[], confidence
```

### 4.2 Profile Enrichment Flow

```
Input: LinkedIn URL and/or CV File
│
├─► LinkedIn Data Extraction
│   ├── Try Coresignal API
│   ├── Fallback: RapidAPI LinkedIn
│   ├── Fallback: ScrapIn
│   ├── Fallback: ScrapingBee + GPT parsing
│   └── Extract: name, company, skills, experience
│
├─► CV Parsing (if provided)
│   ├── PDF: pdf-parse or pdfjs-dist
│   ├── DOCX: mammoth
│   └── AI Analysis: OpenAI GPT-4o
│
├─► Data Merging
│   ├── Combine LinkedIn + CV data
│   ├── Deduplicate skills/sectors
│   └── Generate confidence scores
│
├─► Database Matching
│   ├── Match sectors with DB records
│   ├── Match skills with DB records
│   ├── Match interests with DB records
│   └── Create custom entries if needed
│
├─► Bio Generation (AI)
│   ├── Generate summary (150 chars)
│   ├── Generate full bio (500 chars)
│   └── Detect language direction (RTL/LTR)
│
└─► Output: EnrichmentResult
    ├── profile: { fullName, company, jobTitle, ... }
    ├── generatedBio, generatedBioSummary
    ├── suggestedSectors: [{ id, name, confidence }]
    ├── suggestedSkills: [{ id, name, confidence }]
    ├── suggestedInterests, suggestedHobbies
    └── suggestedGoals
```

---

## 5. Error Handling

### 5.1 Retry Strategy

| Service | Max Retries | Backoff | Timeout |
|---------|-------------|---------|---------|
| Azure OCR | 3 | Exponential | 30s |
| Google Vision | 2 | Linear | 20s |
| Perplexity | 2 | Exponential | 60s |
| PDL | 2 | Linear | 15s |
| Coresignal | 2 | Linear | 15s |

### 5.2 Fallback Chain

```
OCR: Azure → Google Vision → Tesseract
LinkedIn: Coresignal → RapidAPI → ScrapIn → ScrapingBee → Direct Fetch
Search: Perplexity → OpenAI with web_search → Google CSE + GPT
Enrichment: PDL → Manual (no enrichment)
```

---

## 6. Security Considerations

### 6.1 API Key Management

- All API keys stored in environment variables
- Keys rotated quarterly
- Rate limiting per service
- Request signing where supported

### 6.2 Data Privacy

- GDPR consent required for enrichment
- Face search disabled by default
- Data retention policies enforced
- User can request data deletion

### 6.3 Rate Limiting

| Service | Limit | Window |
|---------|-------|--------|
| OCR | 100 | 1 minute |
| Explorer | 50 | 1 minute |
| Enrichment | 30 | 1 minute |
| Face Search | 10 | 1 minute |

---

## 7. Monitoring & Logging

### 7.1 Metrics Tracked

- Request count per service
- Latency percentiles (p50, p95, p99)
- Error rates by type
- Cost per service
- Cache hit rates

### 7.2 Log Format

```typescript
logger.info('Service request', {
  service: 'ocr',
  provider: 'azure',
  duration: 1500,
  success: true,
  inputSize: 1024000,
  outputFields: ['name', 'email', 'phone'],
});
```

---

## 8. Configuration Reference

### 8.1 Feature Flags

| Flag | Default | Description |
|------|---------|-------------|
| `FEATURE_AZURE_OCR` | `false` | Enable Azure OCR |
| `FEATURE_GOOGLE_VISION` | `false` | Enable Google Vision OCR |
| `FEATURE_PDL_ENRICHMENT` | `false` | Enable PDL enrichment |
| `FEATURE_FACE_SEARCH` | `false` | Enable face search |
| `FEATURE_OPENAI` | `false` | Enable OpenAI services |
| `FEATURE_GROQ` | `true` | Enable Groq AI |
| `FEATURE_GEMINI` | `false` | Enable Gemini AI |

### 8.2 Required Environment Variables

```bash
# OCR
AZURE_DOCUMENT_ENDPOINT=
AZURE_DOCUMENT_KEY=
GOOGLE_VISION_API_KEY=

# Search
PERPLEXITY_API_KEY=
OPENAI_API_KEY=
GOOGLE_CSE_KEY=
GOOGLE_CSE_CX=

# Enrichment
PDL_API_KEY=
CORESIGNAL_API_KEY=

# AI
GROQ_API_KEY=
GEMINI_API_KEY=
```

---

## 9. Testing

### 9.1 Unit Tests

Each service has dedicated unit tests:
- `ocr/*.test.ts`
- `enrichment/*.test.ts`
- `explorer/*.test.ts`

### 9.2 Integration Tests

- End-to-end scanning flow
- Enrichment pipeline
- Fallback chain verification

### 9.3 Test Data

- Sample business card images in `/tests/fixtures/`
- Mock API responses in `/tests/mocks/`

---

## 10. Appendix

### 10.1 File Index

| File | Purpose |
|------|---------|
| `ocr/TesseractOCRService.ts` | Local OCR implementation |
| `ocr/AzureOCRService.ts` | Azure OCR integration |
| `ocr/GoogleVisionOCRService.ts` | Google Vision integration |
| `ocr/OCRServiceFactory.ts` | Service factory |
| `enrichment/PDLEnrichmentService.ts` | PDL API integration |
| `enrichment/ProfileEnrichmentService.ts` | LinkedIn scraping + CV parsing |
| `enrichment/EnrichmentOrchestrator.ts` | Multi-service orchestration |
| `explorer/explorer-api.ts` | Main explorer endpoint |
| `explorer/explorer-scan-api.ts` | Scan + search endpoint |
| `face-search/FaceSearchService.ts` | PimEyes integration |
| `scan-controller.ts` | HTTP handlers for scanning |
| `profile-routes.ts` | Profile enrichment routes |

### 10.2 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Jan 2025 | Initial specification |

---

*End of Technical Specification*
