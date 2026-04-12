/**
 * Profile Routes
 *
 * Routes for user profile management.
 *
 * @module presentation/routes/profile
 */

import { Router } from 'express';
import multer from 'multer';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');
import mammoth from 'mammoth';

/**
 * Clean up extracted PDF text
 * Handles common PDF extraction issues like character-per-line, bad spacing, etc.
 */
function cleanExtractedText(text: string): string {
  // Step 1: Fix character-per-line issue (common in PDFs from presentations)
  // Pattern: single characters separated by newlines (like "C\no\nm\nm\nu\nn\ni\nc\na\nt\ni\no\nn")
  let cleaned = text;

  // Detect and fix single-character lines pattern
  // Match sequences where we have many lines with just 1-2 characters
  const lines = cleaned.split('\n');
  const processedLines: string[] = [];
  let charBuffer = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // If line is very short (1-2 chars) and not Arabic (which has short valid words)
    // and next lines are also short, likely character-per-line issue
    if (line.length <= 2 && line.length > 0 && !/[\u0600-\u06FF]/.test(line)) {
      // Check if this is part of a sequence of single chars
      let isPartOfSequence = false;
      if (i > 0 && i < lines.length - 1) {
        const prevLine = lines[i - 1].trim();
        const nextLine = lines[i + 1].trim();
        if ((prevLine.length <= 2 && prevLine.length > 0) ||
            (nextLine.length <= 2 && nextLine.length > 0)) {
          isPartOfSequence = true;
        }
      }

      if (isPartOfSequence) {
        charBuffer += line;
        continue;
      }
    }

    // Flush char buffer if we have one
    if (charBuffer) {
      processedLines.push(charBuffer);
      charBuffer = '';
    }

    if (line) {
      processedLines.push(line);
    }
  }

  // Flush remaining buffer
  if (charBuffer) {
    processedLines.push(charBuffer);
  }

  cleaned = processedLines.join('\n');

  // Step 2: Clean up excessive whitespace
  cleaned = cleaned
    .replace(/[ \t]+/g, ' ')           // Multiple spaces/tabs to single space
    .replace(/\n{3,}/g, '\n\n')        // Multiple newlines to double newline
    .replace(/(\S)\n(\S)/g, '$1 $2')   // Single newline between words -> space
    .trim();

  // Step 3: Fix common OCR/extraction issues
  cleaned = cleaned
    .replace(/\s+([.,;:!?])/g, '$1')   // Remove space before punctuation
    .replace(/([.,;:!?])(\w)/g, '$1 $2'); // Add space after punctuation if missing

  return cleaned;
}

// Helper function to extract text from PDF using pdfjs-dist directly (dynamic import for ESM)
async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    // Dynamic import for ESM module
    const pdfjsLib = await import('pdfjs-dist');
    const data = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({
      data,
      useSystemFonts: true,
    });
    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        // Smart text joining based on position
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const items = textContent.items.filter((item: any) => 'str' in item) as any[];

        let pageText = '';
        let lastY: number | null = null;
        let lastX: number | null = null;

        for (const item of items) {
          const str = item.str || '';
          if (!str) continue;

          // Get position info
          const transform = item.transform || [1, 0, 0, 1, 0, 0];
          const x = transform[4];
          const y = transform[5];
          const width = item.width || 0;

          // Determine if we need a newline or space
          if (lastY !== null) {
            const yDiff = Math.abs(y - lastY);
            const xDiff = lastX !== null ? x - lastX : 0;

            // New line if Y position changed significantly
            if (yDiff > 10) {
              pageText += '\n';
            } else if (xDiff > width * 1.5 && xDiff > 5) {
              // Add space if there's a gap between text items
              pageText += ' ';
            }
          }

          pageText += str;
          lastY = y;
          lastX = x + width;
        }

        fullText += pageText + '\n\n';
      } catch (pageError) {
        // Skip pages that fail to parse
        continue;
      }
    }

    // Clean up the extracted text
    return cleanExtractedText(fullText);
  } catch (error) {
    throw error;
  }
}
import { authenticate } from '../middleware/auth.middleware.js';
import { profileController } from '../controllers/ProfileController.js';
import { logger } from '../../shared/logger/index.js';
import { ProfileEnrichmentService } from '../../infrastructure/external/enrichment/ProfileEnrichmentService.js';

// Initialize profile enrichment service
const profileEnrichmentService = new ProfileEnrichmentService();

// Configure multer for file uploads
const fileUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Avatar allowed types
    const avatarMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    // CV allowed types
    const cvMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    const allowedMimes = [...avatarMimes, ...cvMimes];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

export const profileRoutes = Router();

// All routes require authentication
profileRoutes.use(authenticate);

/**
 * GET /api/v1/profile
 * Get current user's profile
 *
 * Returns complete user profile including sectors, skills, interests, and goals.
 *
 * Response:
 * - id: User ID
 * - email: User email
 * - fullName: Full name
 * - jobTitle: Job title
 * - company: Company name
 * - bio: Biography
 * - avatarUrl: Avatar image URL
 * - linkedinUrl: LinkedIn profile URL
 * - websiteUrl: Personal website URL
 * - phone: Phone number
 * - location: Location
 * - timezone: Timezone
 * - emailVerified: Whether email is verified
 * - consent: { enrichment, contacts, analytics }
 * - sectors: Array of user sectors
 * - skills: Array of user skills
 * - interests: Array of user interests
 * - goals: Array of networking goals
 */
profileRoutes.get('/', profileController.getProfile.bind(profileController));

/**
 * PUT /api/v1/profile
 * Update user profile
 *
 * Body:
 * - fullName?: string
 * - jobTitle?: string
 * - company?: string
 * - bio?: string
 * - linkedinUrl?: string
 * - websiteUrl?: string
 * - phone?: string
 * - location?: string
 * - timezone?: string
 */
profileRoutes.put('/', profileController.updateProfile.bind(profileController));

/**
 * DELETE /api/v1/profile
 * Delete (deactivate) user account
 *
 * This soft-deletes the account by deactivating it.
 * All refresh tokens are revoked.
 */
profileRoutes.delete('/', profileController.deleteAccount.bind(profileController));

/**
 * PUT /api/v1/profile/sectors
 * Update user sectors
 *
 * Body:
 * - sectors: Array of { sectorId: string, isPrimary?: boolean, experienceYears?: number }
 */
profileRoutes.put('/sectors', profileController.updateSectors.bind(profileController));

/**
 * PUT /api/v1/profile/skills
 * Update user skills
 *
 * Body:
 * - skills: Array of { skillId: string, proficiencyLevel?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT' }
 */
profileRoutes.put('/skills', profileController.updateSkills.bind(profileController));

/**
 * PUT /api/v1/profile/interests
 * Update user interests
 *
 * Body:
 * - interests: Array of { interestId: string, intensity?: 'CASUAL' | 'MODERATE' | 'PASSIONATE' }
 */
profileRoutes.put('/interests', profileController.updateInterests.bind(profileController));

/**
 * PUT /api/v1/profile/hobbies
 * Update user hobbies
 *
 * Body:
 * - hobbies: Array of { hobbyId: string }
 */
profileRoutes.put('/hobbies', profileController.updateHobbies.bind(profileController));

/**
 * PUT /api/v1/profile/goals
 * Update networking goals
 *
 * Body:
 * - goals: Array of { type: GoalType, description?: string, priority?: number }
 *
 * GoalType: 'MENTORSHIP' | 'INVESTMENT' | 'PARTNERSHIP' | 'HIRING' | 'JOB_SEEKING' | 'COLLABORATION' | 'LEARNING' | 'SALES' | 'OTHER'
 */
profileRoutes.put('/goals', profileController.updateGoals.bind(profileController));

/**
 * PUT /api/v1/profile/consent
 * Update consent settings
 *
 * Body:
 * - enrichment?: boolean - Allow AI enrichment of contacts
 * - contacts?: boolean - Allow contact data usage
 * - analytics?: boolean - Allow analytics tracking
 *
 * All consent changes are logged for GDPR compliance.
 */
profileRoutes.put('/consent', profileController.updateConsent.bind(profileController));

/**
 * POST /api/v1/profile/avatar
 * Upload avatar image
 *
 * Accepts multipart/form-data with 'avatar' field.
 * Supported formats: JPEG, PNG, GIF, WebP
 * Max size: 5MB
 */
profileRoutes.post('/avatar', fileUpload.single('avatar'), profileController.uploadAvatar.bind(profileController));

/**
 * POST /api/v1/profile/parse-cv
 * Upload and parse CV to extract profile information
 *
 * Accepts multipart/form-data with 'cv' field.
 * Supported formats: PDF, DOC, DOCX
 * Max size: 5MB
 */
profileRoutes.post('/parse-cv', fileUpload.single('cv'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: { code: 'NO_FILE', message: 'No CV file uploaded' },
      });
      return;
    }

    const file = req.file;
    let extractedText = '';

    // Parse CV based on file type
    if (file.mimetype === 'application/pdf') {
      try {
        const pdfData = await pdfParse(file.buffer);
        extractedText = cleanExtractedText(pdfData.text);
      } catch (pdfError) {
        logger.warn('pdf-parse failed, trying pdfjs-dist', pdfError);
        try {
          extractedText = await extractPdfText(file.buffer);
        } catch (fallbackError) {
          logger.error('PDF parsing failed completely', fallbackError);
          extractedText = '';
        }
      }
    } else if (file.mimetype.includes('openxmlformats') || file.mimetype.includes('msword')) {
      try {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        extractedText = cleanExtractedText(result.value);
      } catch (docError) {
        logger.warn('DOC parsing failed, using fallback', docError);
        extractedText = file.buffer.toString('utf8').replace(/[^\x20-\x7E\n]/g, ' ');
      }
    } else {
      extractedText = file.buffer.toString('utf8').replace(/[^\x20-\x7E\n]/g, ' ');
    }

    // Extract profile information from text
    const extractedData = extractProfileFromText(extractedText);

    logger.info('CV parsed successfully', {
      filename: file.originalname,
      size: file.size,
      extractedFields: Object.keys(extractedData).filter(k => extractedData[k as keyof typeof extractedData])
    });

    res.status(200).json({
      success: true,
      data: extractedData,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/profile/enrich
 * Enrich profile using LinkedIn, CV, and AI
 *
 * Accepts multipart/form-data with optional fields:
 * - cv: CV file (PDF, DOC, DOCX)
 * - linkedInUrl: LinkedIn profile URL
 * - twitterUrl: Twitter/X profile URL
 * - bio: User-provided bio text
 *
 * Returns:
 * - profile: Extracted profile data (name, company, job title, etc.)
 * - generatedBio: AI-generated professional bio
 * - suggestedSectors: Matched sectors from database + custom suggestions
 * - suggestedSkills: Matched skills from database + custom suggestions
 * - suggestedInterests: Matched interests from database + custom suggestions
 * - suggestedHobbies: Matched hobbies from database + custom suggestions
 */
profileRoutes.post('/enrich', fileUpload.single('cv'), async (req, res, next) => {
  try {
    const { linkedInUrl, twitterUrl, bio, locale, enhanceWithWebSearch } = req.body;
    const enableWebSearch = enhanceWithWebSearch === 'true' || enhanceWithWebSearch === true;
    let cvText = '';

    // Parse CV if uploaded
    if (req.file) {
      const file = req.file;

      if (file.mimetype === 'application/pdf') {
        try {
          logger.info('Parsing PDF file', { filename: file.originalname, size: file.size });
          // Try pdf-parse first
          const pdfData = await pdfParse(file.buffer);
          cvText = cleanExtractedText(pdfData.text);
          logger.info('PDF parsed successfully with pdf-parse', { textLength: cvText.length, preview: cvText.substring(0, 200) });
        } catch (pdfError) {
          logger.warn('pdf-parse failed, trying pdfjs-dist directly', { error: pdfError });
          // Fallback to pdfjs-dist which can handle corrupted PDFs better
          try {
            cvText = await extractPdfText(file.buffer);
            logger.info('PDF parsed with pdfjs-dist fallback', { textLength: cvText.length, preview: cvText.substring(0, 200) });
          } catch (fallbackError) {
            logger.error('PDF parsing failed completely', { error: fallbackError });
            cvText = '';
          }
        }
      } else if (file.mimetype.includes('openxmlformats') || file.mimetype.includes('msword')) {
        try {
          logger.info('Parsing DOC/DOCX file', { filename: file.originalname, mimeType: file.mimetype });
          const result = await mammoth.extractRawText({ buffer: file.buffer });
          cvText = result.value;
          logger.info('DOC parsed successfully', { textLength: cvText.length, preview: cvText.substring(0, 200) });
        } catch (docError) {
          logger.warn('DOC parsing failed, trying fallback extraction', { error: docError });
          cvText = file.buffer.toString('utf8').replace(/[^\x20-\x7E\n]/g, ' ').replace(/\s+/g, ' ').trim();
          logger.info('Fallback extraction result', { textLength: cvText.length, preview: cvText.substring(0, 200) });
        }
      } else {
        logger.warn('Unknown file type, trying as text', { mimeType: file.mimetype });
        cvText = file.buffer.toString('utf8').replace(/[^\x20-\x7E\n]/g, ' ');
      }
    }

    // Log CV text extraction result
    if (req.file) {
      logger.info('CV text extracted', {
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        textLength: cvText?.length || 0,
        textPreview: cvText?.substring(0, 200) || '',
      });
    }

    // Enrich profile using all available data
    const result = await profileEnrichmentService.enrichProfile({
      linkedInUrl,
      twitterUrl,
      cvText: cvText || undefined,
      bio,
      locale: locale || 'en',
      enhanceWithWebSearch: enableWebSearch,
    });

    logger.info('Profile enrichment completed', {
      userId: req.user?.userId,
      hasLinkedIn: !!linkedInUrl,
      hasCV: !!cvText,
      webSearchEnabled: enableWebSearch,
      sectorsFound: result.suggestedSectors.length,
      skillsFound: result.suggestedSkills.length,
      interestsFound: result.suggestedInterests.length,
      hobbiesFound: result.suggestedHobbies.length,
      processingTimeMs: result.processingTimeMs,
    });

    res.status(200).json({
      success: result.success,
      data: {
        profile: result.profile,
        generatedBio: result.generatedBio,
        generatedBioSummary: result.generatedBioSummary,
        generatedBioFull: result.generatedBioFull,
        bioDirection: result.bioDirection || 'ltr',
        detectedLanguage: result.detectedLanguage,
        suggestedSectors: result.suggestedSectors,
        suggestedSkills: result.suggestedSkills,
        suggestedInterests: result.suggestedInterests,
        suggestedHobbies: result.suggestedHobbies,
      },
      error: result.error,
    });
  } catch (error) {
    logger.error('Profile enrichment failed', { error });
    next(error);
  }
});

/**
 * POST /api/v1/profile/onboarding
 * Complete onboarding with all profile data
 *
 * Body:
 * - profile?: { fullName, jobTitle, company, phone, location }
 * - sectors?: string[] - Array of sector IDs
 * - customSectors?: string[] - Array of custom sector names
 * - skills?: string[] - Array of skill IDs
 * - customSkills?: string[] - Array of custom skill names
 * - interests?: string[] - Array of interest IDs
 * - customInterests?: string[] - Array of custom interest names
 * - goals?: GoalType[] - Array of goal types
 * - customGoals?: string[] - Array of custom goal descriptions
 * - bio?: string - User biography
 */
profileRoutes.post('/onboarding', profileController.completeOnboarding.bind(profileController));

/**
 * Get onboarding progress
 *
 * GET /api/v1/profile/onboarding-progress
 *
 * Returns current onboarding step, saved data, and completion percentage
 */
profileRoutes.get('/onboarding-progress', profileController.getOnboardingProgress.bind(profileController));

/**
 * Save onboarding progress (partial save)
 *
 * POST /api/v1/profile/onboarding-progress
 *
 * Saves partial data when user clicks "Skip for now"
 * Body:
 * - currentStep: number - Current step (0-5)
 * - socialData?: object - Step 0 data
 * - profile?: object - Step 1 data
 * - bio?: string
 * - enrichmentData?: object - AI suggestions
 * - selectedSectors/Skills/Interests/Hobbies/Goals?: string[]
 * - customSectors/Skills/Interests/Hobbies/Goals?: object[]
 * - projects?: object[]
 */
profileRoutes.post('/onboarding-progress', profileController.saveOnboardingProgress.bind(profileController));

/**
 * Extract profile information from CV text
 */
function extractProfileFromText(text: string): {
  company?: string;
  jobTitle?: string;
  location?: string;
  bio?: string;
  skills?: string[];
  email?: string;
  phone?: string;
} {
  const result: {
    company?: string;
    jobTitle?: string;
    location?: string;
    bio?: string;
    skills?: string[];
    email?: string;
    phone?: string;
  } = {};

  // Extract email
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
  if (emailMatch) {
    result.email = emailMatch[0];
  }

  // Extract phone number
  const phoneMatch = text.match(/[\+]?[(]?[0-9]{1,3}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}/);
  if (phoneMatch) {
    result.phone = phoneMatch[0];
  }

  // Look for common job title patterns
  const jobTitlePatterns = [
    /(?:position|title|role|job title)[:\s]+([^\n]+)/i,
    /(?:senior|junior|lead|head|chief|director|manager|engineer|developer|analyst|consultant|specialist|coordinator|associate|executive)[^\n]*(?:at|@)?/i,
  ];

  for (const pattern of jobTitlePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.jobTitle = match[1] || match[0];
      break;
    }
  }

  // Look for company patterns
  const companyPatterns = [
    /(?:company|employer|organization|work at|working at|employed at)[:\s]+([^\n]+)/i,
    /(?:at|@)\s+([A-Z][A-Za-z0-9\s&]+(?:Inc|LLC|Ltd|Corp|Company|Co\.?)?)/,
  ];

  for (const pattern of companyPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      result.company = match[1].trim();
      break;
    }
  }

  // Look for location patterns
  const locationPatterns = [
    /(?:location|address|city|based in|located in)[:\s]+([^\n]+)/i,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2,})/,
  ];

  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      result.location = match[1].trim();
      break;
    }
  }

  // Extract skills - look for skills section
  const skillsSection = text.match(/(?:skills|expertise|technologies|technical skills)[:\s]*([^\n]+(?:\n[^\n]+)*)/i);
  if (skillsSection) {
    const skillsText = skillsSection[1];
    const skills = skillsText
      .split(/[,\n•\-|]/)
      .map(s => s.trim())
      .filter(s => s.length > 1 && s.length < 50)
      .slice(0, 20);
    if (skills.length > 0) {
      result.skills = skills;
    }
  }

  // Extract summary/bio section
  const summaryPatterns = [
    /(?:summary|profile|about|objective|professional summary)[:\s]*([^\n]+(?:\n[^\n]+){0,3})/i,
  ];

  for (const pattern of summaryPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      result.bio = match[1].trim().substring(0, 500);
      break;
    }
  }

  return result;
}

export default profileRoutes;
