/**
 * Deal Controller
 * Handles HTTP requests for Deal Matching operations
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../../shared/logger';
import { prisma } from '../../infrastructure/database/prisma/client';
import { Prisma } from '@prisma/client';

// Import repositories
import {
  PrismaDealRequestRepository,
  PrismaDealMatchResultRepository,
  PrismaDealJobRepository,
} from '../../infrastructure/repositories/PrismaDealRepository';
import { PrismaContactRepository } from '../../infrastructure/repositories/PrismaContactRepository';

// Import services
import { DealMatchingService } from '../../infrastructure/services/deal/DealMatchingService';

// Import use cases
import {
  CreateDealUseCase,
  CalculateDealMatchesUseCase,
  GetDealResultsUseCase,
  UpdateDealMatchStatusUseCase,
  ListDealsUseCase,
} from '../../application/use-cases/deal';

import {
  DealMode,
  DealStatus,
  DealCompanySize,
  DealTargetEntityType,
  DealMatchStatus,
} from '../../domain/entities/Deal';

// Initialize repositories
const dealRequestRepository = new PrismaDealRequestRepository();
const dealMatchResultRepository = new PrismaDealMatchResultRepository();
const dealJobRepository = new PrismaDealJobRepository();
const contactRepository = new PrismaContactRepository();

// Initialize services
const dealMatchingService = new DealMatchingService();

// Initialize use cases
const createDealUseCase = new CreateDealUseCase(dealRequestRepository);
const calculateDealMatchesUseCase = new CalculateDealMatchesUseCase(
  dealRequestRepository,
  dealMatchResultRepository,
  dealJobRepository,
  contactRepository,
  dealMatchingService,
);
const getDealResultsUseCase = new GetDealResultsUseCase(
  dealRequestRepository,
  dealMatchResultRepository,
  contactRepository,
);
const updateDealMatchStatusUseCase = new UpdateDealMatchStatusUseCase(
  dealMatchResultRepository,
  dealRequestRepository,
);
const listDealsUseCase = new ListDealsUseCase(dealRequestRepository);

/**
 * Create a new deal request
 * POST /api/v1/deals
 */
export async function createDeal(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;

    const input = {
      mode: req.body.mode as DealMode,
      title: req.body.title,
      domain: req.body.domain,
      solutionType: req.body.solutionType,
      companySize: req.body.companySize as DealCompanySize | undefined,
      problemStatement: req.body.problemStatement,
      targetEntityType: req.body.targetEntityType as DealTargetEntityType | undefined,
      productName: req.body.productName,
      targetDescription: req.body.targetDescription,
      metadata: req.body.metadata,
    };

    const result = await createDealUseCase.execute(userId, input);

    // If in org mode, set the organizationId on the deal
    if (req.orgContext?.organizationId) {
      await prisma.dealRequest.update({
        where: { id: result.id },
        data: { organizationId: req.orgContext.organizationId },
      });
    }

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * List user's deals
 * GET /api/v1/deals
 */
export async function listDeals(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;

    const mode = req.query.mode as DealMode | undefined;
    const status = req.query.status as DealStatus | undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    // Scope by organization context
    const orgId = req.orgContext?.organizationId || null;
    const where: Prisma.DealRequestWhereInput = orgId
      ? { organizationId: orgId }
      : { userId, organizationId: null };

    if (mode) (where as any).mode = mode;
    if (status) (where as any).status = status;

    const skip = (page - 1) * limit;

    const [deals, total] = await Promise.all([
      prisma.dealRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.dealRequest.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        deals: deals.map(deal => ({
          id: deal.id,
          userId: deal.userId,
          mode: deal.mode,
          title: deal.title,
          domain: deal.domain,
          solutionType: deal.solutionType,
          companySize: deal.companySize,
          problemStatement: deal.problemStatement,
          targetEntityType: deal.targetEntityType,
          productName: deal.productName,
          targetDescription: deal.targetDescription,
          status: deal.status,
          matchCount: deal.matchCount,
          avgScore: deal.avgScore,
          isActive: deal.isActive,
          createdAt: deal.createdAt.toISOString(),
        })),
        total,
        page,
        limit,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get deal by ID
 * GET /api/v1/deals/:id
 */
export async function getDeal(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const dealId = req.params.id;

    // Scope by organization context
    const orgId = req.orgContext?.organizationId || null;

    const deal = await dealRequestRepository.findById(dealId);

    if (!deal) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Deal not found' } });
      return;
    }

    // Verify ownership based on org context
    if (orgId) {
      const rawDeal = await prisma.dealRequest.findUnique({ where: { id: dealId }, select: { organizationId: true } });
      if (rawDeal?.organizationId !== orgId) {
        res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
        return;
      }
    } else if (deal.userId !== userId) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    // Get job status if processing
    let progress = null;
    if (deal.status === 'PROCESSING') {
      const jobs = await dealJobRepository.findByDealRequestId(dealId);
      const currentJob = jobs.find(j => j.status === 'PROCESSING');
      const completedJobs = jobs.filter(j => j.status === 'COMPLETED').length;
      const totalJobs = jobs.length;

      progress = {
        overall: Math.round((completedJobs / totalJobs) * 100),
        currentStep: currentJob?.step || null,
        steps: jobs.map(j => ({
          step: j.step,
          status: j.status,
          progress: j.progress,
          error: j.error,
        })),
      };
    }

    res.json({
      success: true,
      data: {
        id: deal.id,
        mode: deal.mode,
        title: deal.title,
        domain: deal.domain,
        solutionType: deal.solutionType,
        companySize: deal.companySize,
        problemStatement: deal.problemStatement,
        targetEntityType: deal.targetEntityType,
        productName: deal.productName,
        targetDescription: deal.targetDescription,
        status: deal.status,
        matchCount: deal.matchCount,
        avgScore: deal.avgScore,
        createdAt: deal.createdAt.toISOString(),
        progress,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update deal
 * PUT /api/v1/deals/:id
 */
export async function updateDeal(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const dealId = req.params.id;

    // Scope by organization context
    const orgId = req.orgContext?.organizationId || null;

    const deal = await dealRequestRepository.findById(dealId);

    if (!deal) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Deal not found' } });
      return;
    }

    // Verify ownership based on org context
    if (orgId) {
      const rawDeal = await prisma.dealRequest.findUnique({ where: { id: dealId }, select: { organizationId: true } });
      if (rawDeal?.organizationId !== orgId) {
        res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
        return;
      }
    } else if (deal.userId !== userId) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    const updateData = {
      title: req.body.title,
      domain: req.body.domain,
      solutionType: req.body.solutionType,
      companySize: req.body.companySize,
      problemStatement: req.body.problemStatement,
      targetEntityType: req.body.targetEntityType,
      productName: req.body.productName,
      targetDescription: req.body.targetDescription,
      metadata: req.body.metadata,
    };

    const updated = await dealRequestRepository.update(dealId, updateData);

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete deal
 * DELETE /api/v1/deals/:id
 */
export async function deleteDeal(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const dealId = req.params.id;

    // Scope by organization context
    const orgId = req.orgContext?.organizationId || null;

    const deal = await dealRequestRepository.findById(dealId);

    if (!deal) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Deal not found' } });
      return;
    }

    // Verify ownership based on org context
    if (orgId) {
      const rawDeal = await prisma.dealRequest.findUnique({ where: { id: dealId }, select: { organizationId: true } });
      if (rawDeal?.organizationId !== orgId) {
        res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
        return;
      }
    } else if (deal.userId !== userId) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    await dealRequestRepository.delete(dealId);

    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
}

/**
 * Calculate matches for a deal
 * POST /api/v1/deals/:id/calculate
 */
export async function calculateMatches(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const dealId = req.params.id;

    // Scope by organization context
    const orgId = req.orgContext?.organizationId || null;
    if (orgId) {
      const rawDeal = await prisma.dealRequest.findUnique({ where: { id: dealId }, select: { organizationId: true } });
      if (rawDeal?.organizationId !== orgId) {
        res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
        return;
      }
    }

    // Pass organization context to scope contact queries
    const matchOrgId = orgId || undefined;
    const result = await calculateDealMatchesUseCase.execute(userId, dealId, matchOrgId);

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * Get deal results (matches)
 * GET /api/v1/deals/:id/results
 */
export async function getDealResults(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const dealId = req.params.id;

    // Scope by organization context
    const orgId = req.orgContext?.organizationId || null;
    if (orgId) {
      const rawDeal = await prisma.dealRequest.findUnique({ where: { id: dealId }, select: { organizationId: true } });
      if (rawDeal?.organizationId !== orgId) {
        res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
        return;
      }
    }

    const query = {
      minScore: req.query.minScore ? parseInt(req.query.minScore as string, 10) : undefined,
      status: req.query.status as DealMatchStatus | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
    };

    const result = await getDealResultsUseCase.execute(userId, dealId, query);

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * Update match status
 * PATCH /api/v1/deal-results/:resultId
 */
export async function updateMatchStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const resultId = req.params.resultId;

    // Scope by organization context
    const orgId = req.orgContext?.organizationId || null;
    if (orgId) {
      const matchResult = await prisma.dealMatchResult.findUnique({
        where: { id: resultId },
        include: { dealRequest: { select: { organizationId: true } } },
      });
      if (matchResult?.dealRequest?.organizationId !== orgId) {
        res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
        return;
      }
    }

    const input = {
      status: req.body.status as DealMatchStatus,
      openerEdited: req.body.openerEdited,
    };

    const result = await updateDealMatchStatusUseCase.execute(userId, resultId, input);

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * Regenerate opener message
 * POST /api/v1/deal-results/:resultId/regenerate-message
 */
export async function regenerateMessage(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const resultId = req.params.resultId;

    logger.info('Regenerate message requested', { userId, resultId });

    // Get the match result
    const matchResult = await dealMatchResultRepository.findById(resultId);
    if (!matchResult) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Match result not found' } });
      return;
    }

    // Get the deal request
    const dealRequest = await dealRequestRepository.findById(matchResult.dealRequestId);
    if (!dealRequest) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Deal request not found' } });
      return;
    }

    // Verify ownership based on org context
    const orgId = req.orgContext?.organizationId || null;
    if (orgId) {
      const rawDeal = await prisma.dealRequest.findUnique({ where: { id: dealRequest.id }, select: { organizationId: true } });
      if (rawDeal?.organizationId !== orgId) {
        res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
        return;
      }
    } else if (dealRequest.userId !== userId) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    // Get contact info for message generation
    const contact = await contactRepository.findById(matchResult.contactId);
    if (!contact) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Contact not found' } });
      return;
    }

    // Get real interaction count for this contact
    const interactionAgg = await prisma.interaction.aggregate({
      where: { contactId: contact.id },
      _count: { id: true },
    });

    // Build contact profile for opener generation
    const contactProfile: import('../../infrastructure/services/deal/DealMatchingService').ContactProfile = {
      id: contact.id,
      fullName: contact.name,
      company: contact.company,
      jobTitle: contact.jobTitle,
      email: contact.email,
      sectors: [],
      skills: [],
      interests: [],
      bio: null,
      enrichmentData: null,
      relationshipStrength: 0,
      lastInteractionDays: null,
      interactionCount: interactionAgg._count.id,
    };

    // Regenerate opener message
    const openerMessage = dealMatchingService.generateOpenerMessage(
      dealRequest,
      contactProfile,
      matchResult.category as any,
    );

    // Update the match result with new opener
    await dealMatchResultRepository.update(resultId, { openerMessage });

    res.json({ success: true, data: { openerMessage } });
  } catch (error) {
    next(error);
  }
}

/**
 * Archive/unarchive a deal
 * PATCH /api/v1/deals/:id/archive
 */
export async function archiveDeal(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const dealId = req.params.id;
    const { isActive } = req.body;

    const updated = await prisma.dealRequest.update({
      where: { id: dealId, userId },
      data: { isActive },
    });

    res.json({ success: true, data: { id: updated.id, isActive: updated.isActive } });
  } catch (error) {
    next(error);
  }
}

/**
 * Clean extracted text from documents
 */
function cleanExtractedText(text: string): string {
  let cleaned = text;
  const lines = cleaned.split('\n');
  const processedLines: string[] = [];
  let charBuffer = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length <= 2 && line.length > 0 && !/[\u0600-\u06FF]/.test(line)) {
      let isPartOfSequence = false;
      if (i > 0 && i < lines.length - 1) {
        const prevLine = lines[i - 1].trim();
        const nextLine = lines[i + 1].trim();
        if ((prevLine.length <= 2 && prevLine.length > 0) || (nextLine.length <= 2 && nextLine.length > 0)) {
          isPartOfSequence = true;
        }
      }
      if (isPartOfSequence) { charBuffer += line; continue; }
    }
    if (charBuffer) { processedLines.push(charBuffer); charBuffer = ''; }
    if (line) processedLines.push(line);
  }
  if (charBuffer) processedLines.push(charBuffer);

  cleaned = processedLines.join('\n');
  cleaned = cleaned.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return cleaned;
}

/**
 * Extract deal data from uploaded document
 * POST /api/v1/deals/extract-document
 */
export async function extractDealFromDocument(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const file = req.file;

    if (!file) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'Document file is required' } });
      return;
    }

    logger.info('Extracting deal data from document', {
      userId,
      fileName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    });

    // Extract text from document
    let textContent = '';

    if (file.mimetype === 'application/pdf') {
      const pdfParse = require('pdf-parse');
      const pdfData = await pdfParse(file.buffer);
      textContent = cleanExtractedText(pdfData.text);
    } else if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.mimetype === 'application/msword'
    ) {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      textContent = cleanExtractedText(result.value);
    } else if (file.mimetype === 'text/plain') {
      textContent = file.buffer.toString('utf-8');
    } else {
      res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'Unsupported file format. Please upload PDF, DOCX, DOC, or TXT files.' } });
      return;
    }

    if (!textContent || textContent.trim().length < 30) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION', message: 'Could not extract sufficient text from document.' } });
      return;
    }

    logger.info('Text extracted from deal document', { textLength: textContent.length });

    const openaiApiKey = process.env.OPENAI_API_KEY;
    const groqApiKey = process.env.GROQ_API_KEY;
    const useOpenAI = !!openaiApiKey;
    const aiApiKey = useOpenAI ? openaiApiKey : groqApiKey;
    const aiEndpoint = useOpenAI ? 'https://api.openai.com/v1/chat/completions' : 'https://api.groq.com/openai/v1/chat/completions';
    const aiModel = useOpenAI ? 'gpt-4o' : 'llama-3.3-70b-versatile';

    if (!aiApiKey) {
      res.status(500).json({ success: false, error: { code: 'CONFIG', message: 'AI extraction service not configured' } });
      return;
    }

    const maxDocLength = 4000;
    const truncatedContent = textContent.substring(0, maxDocLength);

    const prompt = `Analyze this business document and extract deal/sales/procurement information. ALL OUTPUT IN ENGLISH (translate if needed).

DOCUMENT:
${truncatedContent}

Return JSON with these fields:
{
  "mode": "SELL or BUY - SELL if the document is about selling a product/service/solution, BUY if looking to purchase/procure something",
  "title": "Short deal title (English)",
  "solutionType": "Type of solution/service (e.g., CRM Software, Marketing Services, Cloud Infrastructure)",
  "domain": "Industry or domain (e.g., Technology, Healthcare, Finance, Education)",
  "companySize": "SMALL or MEDIUM or ENTERPRISE - target company size if mentioned",
  "productName": "Product or service name if selling",
  "targetDescription": "Description of ideal customer/target if selling",
  "problemStatement": "Problem being solved if buying",
  "targetEntityType": "COMPANY or INDIVIDUAL or CONSULTANT or PARTNER - what type of entity is needed if buying",
  "priceRange": "Budget or price range if mentioned (e.g., '< $1K', '$1K - $10K', '$10K - $50K', '$50K - $100K', '$100K+')",
  "timeline": "Timeline or urgency if mentioned (e.g., 'Urgent (this week)', 'Soon (this month)', 'Planning (this quarter)', 'Exploring (no rush)', 'Actively selling now', 'Exploring the market')",
  "requirements": "Comma-separated list of key requirements if mentioned (e.g., 'ISO Certified, API Integration, 24/7 Support')",
  "buyerRole": "If BUY mode only: EXACTLY one of DECISION_MAKER, TECHNICAL_EVALUATOR, END_USER, PROCUREMENT, BUDGET_HOLDER, CONSULTANT. The buyer's role in the decision. Empty string if SELL mode.",
  "providerType": "If SELL mode only: EXACTLY one of COMPANY, INDIVIDUAL, CONSULTANT, PARTNER. The type of entity selling. Empty string if BUY mode.",
  "capabilities": ["If SELL mode: list key capabilities offered, e.g., 'Custom Development', 'API Integration', '24/7 Support', 'Training & Onboarding', 'SLA Guarantee', 'Compliance (SOC2/ISO)', 'Managed Services'. Empty array if BUY mode."],
  "deliveryModeCapability": ["If SELL mode: list ALL supported delivery modes from: On-premise, Cloud/SaaS, Hybrid, Managed Service, Self-service. Empty array if BUY mode."]
}

Rules:
- Determine mode based on document intent (offering = SELL, seeking = BUY)
- solutionType should be concise (2-5 words)
- domain should be a single industry/sector
- companySize: SMALL (1-50), MEDIUM (51-500), ENTERPRISE (500+)
- priceRange: use closest match from the options listed above
- timeline: use closest match from the options listed above
- Fill ALL fields that can be reasonably inferred from the document
- Return ONLY valid JSON, no markdown`;

    // AI API call with retry (OpenAI primary, Groq fallback)
    const callAIWithRetry = async (maxRetries = 3): Promise<globalThis.Response> => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const response = await fetch(aiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${aiApiKey}`,
          },
          body: JSON.stringify({
            model: aiModel,
            messages: [
              { role: 'system', content: 'Extract structured business deal info from documents. Output ONLY valid JSON in English.' },
              { role: 'user', content: prompt },
            ],
            temperature: 0.1,
            max_tokens: 1500,
            ...(useOpenAI ? {} : { response_format: { type: 'json_object' } }),
          }),
        });

        if (response.ok) return response;

        if (response.status === 429 && attempt < maxRetries) {
          const errorText = await response.text();
          logger.warn('Groq API rate limit hit for deal extraction, retrying...', { attempt, error: errorText });
          let waitTime = Math.pow(2, attempt) * 5000;
          try {
            const errorData = JSON.parse(errorText);
            const retryMatch = errorData.error?.message?.match(/try again in ([\d.]+)s/);
            if (retryMatch) waitTime = Math.ceil(parseFloat(retryMatch[1]) * 1000) + 1000;
          } catch (e) {}
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        return response;
      }
      throw new Error('Max retries exceeded');
    };

    const aiResponse = await callAIWithRetry();

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      logger.error('AI API error during deal extraction', { status: aiResponse.status, error: errorText, provider: useOpenAI ? 'OpenAI' : 'Groq' });
      if (aiResponse.status === 429 || aiResponse.status === 413) {
        res.status(429).json({ success: false, error: { code: 'RATE_LIMIT', message: 'AI service is busy. Please wait a moment and try again.' } });
        return;
      }
      res.status(500).json({ success: false, error: { code: 'AI_ERROR', message: 'AI extraction failed. Please try again.' } });
      return;
    }

    const aiData = await aiResponse.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      res.status(500).json({ success: false, error: { code: 'AI_ERROR', message: 'AI extraction returned no content' } });
      return;
    }

    let extractedData: any;
    try {
      let cleanContent = content.trim();
      const jsonCodeBlockMatch = cleanContent.match(/```json\s*([\s\S]*?)```/);
      const genericCodeBlockMatch = cleanContent.match(/```\s*([\s\S]*?)```/);
      if (jsonCodeBlockMatch && jsonCodeBlockMatch[1]) {
        cleanContent = jsonCodeBlockMatch[1].trim();
      } else if (genericCodeBlockMatch && genericCodeBlockMatch[1]) {
        cleanContent = genericCodeBlockMatch[1].trim();
      } else {
        const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) cleanContent = jsonMatch[0];
      }
      extractedData = JSON.parse(cleanContent.trim());
    } catch (e) {
      logger.error('Failed to parse Groq deal extraction response', { content, error: e });
      res.status(500).json({ success: false, error: { code: 'PARSE_ERROR', message: 'Failed to parse extracted data' } });
      return;
    }

    // Validate mode
    const mode = (extractedData.mode || '').toUpperCase();
    const validMode = mode === 'SELL' || mode === 'BUY' ? mode : 'SELL';

    // Validate company size
    const validSizes = ['SMALL', 'MEDIUM', 'ENTERPRISE'];
    const companySize = validSizes.includes((extractedData.companySize || '').toUpperCase())
      ? (extractedData.companySize || '').toUpperCase()
      : '';

    // Validate target entity type
    const validEntityTypes = ['COMPANY', 'INDIVIDUAL', 'CONSULTANT', 'PARTNER'];
    const targetEntityType = validEntityTypes.includes((extractedData.targetEntityType || '').toUpperCase())
      ? (extractedData.targetEntityType || '').toUpperCase()
      : '';

    // Extract additional context fields
    const priceRange = extractedData.priceRange || '';
    const timeline = extractedData.timeline || '';
    const requirements = extractedData.requirements || '';

    logger.info('Deal data extracted from document', {
      userId,
      mode: validMode,
      title: extractedData.title,
    });

    // Validate new fields
    const VALID_BUYER_ROLES = ['DECISION_MAKER', 'TECHNICAL_EVALUATOR', 'END_USER', 'PROCUREMENT', 'BUDGET_HOLDER', 'CONSULTANT'];
    const VALID_DELIVERY_CAPS = ['On-premise', 'Cloud/SaaS', 'Hybrid', 'Managed Service', 'Self-service'];

    const buyerRole = VALID_BUYER_ROLES.includes((extractedData.buyerRole || '').toUpperCase())
      ? (extractedData.buyerRole || '').toUpperCase() : '';
    const providerType = validEntityTypes.includes((extractedData.providerType || '').toUpperCase())
      ? (extractedData.providerType || '').toUpperCase() : '';
    const extractedCapabilities = Array.isArray(extractedData.capabilities)
      ? extractedData.capabilities.filter((v: string) => typeof v === 'string' && v.trim()) : [];
    const extractedDeliveryCaps = Array.isArray(extractedData.deliveryModeCapability)
      ? extractedData.deliveryModeCapability.filter((v: string) => VALID_DELIVERY_CAPS.includes(v)) : [];

    // Build metadata from extracted fields
    const extractedMetadata: Record<string, any> = {};
    if (buyerRole) extractedMetadata.buyerRole = buyerRole;
    if (providerType) extractedMetadata.providerType = providerType;
    if (extractedCapabilities.length) extractedMetadata.capabilities = extractedCapabilities;
    if (extractedDeliveryCaps.length) extractedMetadata.deliveryModeCapability = extractedDeliveryCaps;

    res.status(200).json({
      success: true,
      data: {
        mode: validMode,
        title: extractedData.title || '',
        solutionType: extractedData.solutionType || '',
        domain: extractedData.domain || '',
        companySize,
        productName: extractedData.productName || '',
        targetDescription: extractedData.targetDescription || '',
        problemStatement: extractedData.problemStatement || '',
        targetEntityType,
        priceRange,
        timeline,
        requirements,
        metadata: Object.keys(extractedMetadata).length > 0 ? extractedMetadata : undefined,
      },
    });
  } catch (error) {
    next(error);
  }
}
