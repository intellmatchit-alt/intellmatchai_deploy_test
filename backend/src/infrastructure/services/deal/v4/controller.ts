/**
 * Deal Matching Controller
 * v4.0.0 — strict final production
 */

import { Request, Response, NextFunction } from 'express';
import {
  BuyRequest, SellOffering, FindDealMatchesRequest,
  CreateBuyRequestDTO, CreateSellOfferingDTO, UpdateBuyRequestDTO, UpdateSellOfferingDTO,
  SolutionCategory, ProviderType, CompanySize, BudgetRange, NeededTimeline, BuyingStage,
  DeliveryMode, DeliveryModel, TargetCompanySize, BuyerType, SalesTimeline, BuyerRole,
  calculateBuyRequestDataQuality, calculateSellOfferingDataQuality,
} from './types';
import { DealMatchingService, dealMatchingService } from './matching.service';
import { DealExtractionService, dealExtractionService } from './extraction.service';
import { BuyRequestRepository, SellOfferingRepository, defaultBuyRequestRepository, defaultSellOfferingRepository } from './repository';
import { ApiResponse, ValidationError, mergeTags, AuthContext } from './common';

export class DealMatchingController {
  private matchingService: DealMatchingService;
  private extractionService: DealExtractionService;
  private buyRequestRepo: BuyRequestRepository;
  private sellOfferingRepo: SellOfferingRepository;

  constructor(
    matchingService?: DealMatchingService, extractionService?: DealExtractionService,
    buyRequestRepo?: BuyRequestRepository, sellOfferingRepo?: SellOfferingRepository,
  ) {
    this.matchingService = matchingService || dealMatchingService;
    this.extractionService = extractionService || dealExtractionService;
    this.buyRequestRepo = buyRequestRepo || defaultBuyRequestRepository;
    this.sellOfferingRepo = sellOfferingRepo || defaultSellOfferingRepository;
  }

  private getAuth(req: Request): AuthContext | null {
    const userId = (req as any).user?.id;
    if (!userId) return null;
    return { userId, organizationId: (req as any).user?.organizationId };
  }

  // ==========================================================================
  // MATCHING
  // ==========================================================================

  async findMatches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = this.getAuth(req);
      if (!auth) { res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }); return; }

      const { buyRequestId, limit, offset, filters, includeExplanations } = req.body;
      if (!buyRequestId) { res.status(400).json({ success: false, error: { code: 'MISSING_BUY_REQUEST_ID', message: 'buyRequestId required' } }); return; }

      const buyRequest = await this.buyRequestRepo.getByIdForOwner(buyRequestId, auth.userId, auth.organizationId);
      if (!buyRequest) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Buy request not found or access denied' } }); return; }

      const sellOfferings = await this.sellOfferingRepo.findActive();
      if (!sellOfferings?.length) { res.status(200).json({ success: true, data: { matches: [], total: 0 } }); return; }

      const request: FindDealMatchesRequest = { buyRequestId, limit: limit || 50, offset: offset || 0, filters: filters || {}, includeExplanations: includeExplanations !== false };
      const result = await this.matchingService.findMatches(buyRequest, sellOfferings, request);
      res.json({ success: true, data: result, meta: { timestamp: new Date().toISOString(), processingTimeMs: result.processingTimeMs } });
    } catch (error) { next(error); }
  }

  async findBuyers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = this.getAuth(req);
      if (!auth) { res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }); return; }

      const { sellOfferingId, limit } = req.body;
      if (!sellOfferingId) { res.status(400).json({ success: false, error: { code: 'MISSING_SELL_OFFERING_ID', message: 'sellOfferingId required' } }); return; }

      const sellOffering = await this.sellOfferingRepo.getByIdForOwner(sellOfferingId, auth.userId, auth.organizationId);
      if (!sellOffering) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Sell offering not found or access denied' } }); return; }

      const buyRequests = await this.buyRequestRepo.findActive();
      if (!buyRequests?.length) { res.status(200).json({ success: true, data: { matches: [], total: 0 } }); return; }

      const result = await this.matchingService.findBuyersForSeller(sellOffering, buyRequests, limit || 50);
      res.json({ success: true, data: result, meta: { timestamp: new Date().toISOString(), processingTimeMs: result.processingTimeMs } });
    } catch (error) { next(error); }
  }

  async calculateMatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = this.getAuth(req);
      if (!auth) { res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }); return; }

      const { buyRequest, sellOffering, includeExplanation } = req.body;
      if (!buyRequest || !sellOffering) { res.status(400).json({ success: false, error: { code: 'MISSING_DATA', message: 'buyRequest and sellOffering required' } }); return; }

      const result = await this.matchingService.calculateSingleMatch(buyRequest, sellOffering, includeExplanation !== false);
      if (!result) { res.json({ success: true, data: null, message: 'No match — failed hard filters or below thresholds' }); return; }
      res.json({ success: true, data: result });
    } catch (error) { next(error); }
  }

  // ==========================================================================
  // EXTRACTION
  // ==========================================================================

  async extractBuyRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { documentContent, existingData } = req.body;
      if (!documentContent) { res.status(400).json({ success: false, error: { code: 'MISSING_CONTENT', message: 'documentContent required' } }); return; }
      res.json({ success: true, data: await this.extractionService.extractBuyRequest(documentContent, existingData) });
    } catch (error) { next(error); }
  }

  async extractSellOffering(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { documentContent, existingData } = req.body;
      if (!documentContent) { res.status(400).json({ success: false, error: { code: 'MISSING_CONTENT', message: 'documentContent required' } }); return; }
      res.json({ success: true, data: await this.extractionService.extractSellOffering(documentContent, existingData) });
    } catch (error) { next(error); }
  }

  async detectDocumentType(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { documentContent } = req.body;
      if (!documentContent) { res.status(400).json({ success: false, error: { code: 'MISSING_CONTENT', message: 'documentContent required' } }); return; }
      res.json({ success: true, data: { type: await this.extractionService.detectDocumentType(documentContent) } });
    } catch (error) { next(error); }
  }

  // ==========================================================================
  // BUY REQUEST MANAGEMENT
  // ==========================================================================

  async createBuyRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = this.getAuth(req);
      if (!auth) { res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }); return; }
      const dto = req.body as CreateBuyRequestDTO;
      const errors = this.validateCreateBuyRequestDTO(dto);
      if (errors.length) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: errors } }); return; }
      const newReq: BuyRequest = {
        id: this.generateId('buy'), ownerId: auth.userId, organizationId: auth.organizationId,
        whatYouNeed: dto.whatYouNeed, solutionCategory: dto.solutionCategory, relevantIndustry: dto.relevantIndustry,
        providerType: dto.providerType, preferredProviderSize: dto.preferredProviderSize,
        mustHaveRequirements: dto.mustHaveRequirements, budgetRange: dto.budgetRange,
        neededTimeline: dto.neededTimeline, buyingStage: dto.buyingStage,
        targetMarketLocation: dto.targetMarketLocation, deliveryMode: dto.deliveryMode,
        idealProviderProfile: dto.idealProviderProfile, requestName: dto.requestName,
        buyerRole: dto.buyerRole,
        aiGeneratedTags: [], userTags: dto.userTags || [], tags: mergeTags([], dto.userTags || [], []),
        dataQualityScore: 0, isActive: true, isDeleted: false, source: 'MANUAL', createdAt: new Date(), updatedAt: new Date(),
      };
      newReq.dataQualityScore = calculateBuyRequestDataQuality(newReq);
      res.status(201).json({ success: true, data: await this.buyRequestRepo.create(newReq) });
    } catch (error) { next(error); }
  }

  async updateBuyRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = this.getAuth(req);
      if (!auth) { res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }); return; }
      const { id } = req.params;
      const existing = await this.buyRequestRepo.getByIdForOwner(id, auth.userId, auth.organizationId);
      if (!existing) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Buy request not found or access denied' } }); return; }
      const dto = req.body as UpdateBuyRequestDTO;
      const updated: BuyRequest = { ...existing, ...dto, updatedAt: new Date() };
      if (dto.userTags) { updated.tags = mergeTags(updated.aiGeneratedTags || [], dto.userTags, []); updated.userTags = dto.userTags; }
      updated.dataQualityScore = calculateBuyRequestDataQuality(updated);
      res.json({ success: true, data: await this.buyRequestRepo.update(id, updated) });
    } catch (error) { next(error); }
  }

  // ==========================================================================
  // SELL OFFERING MANAGEMENT
  // ==========================================================================

  async createSellOffering(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = this.getAuth(req);
      if (!auth) { res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }); return; }
      const dto = req.body as CreateSellOfferingDTO;
      const errors = this.validateCreateSellOfferingDTO(dto);
      if (errors.length) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: errors } }); return; }
      const offering: SellOffering = {
        id: this.generateId('sell'), ownerId: auth.userId, organizationId: auth.organizationId,
        productServiceName: dto.productServiceName, offeringSummary: dto.offeringSummary,
        solutionCategory: dto.solutionCategory, industryFocus: dto.industryFocus,
        deliveryModel: dto.deliveryModel, targetCompanySize: dto.targetCompanySize,
        idealBuyerType: dto.idealBuyerType, idealCustomerProfile: dto.idealCustomerProfile,
        targetMarketLocation: dto.targetMarketLocation, priceRange: dto.priceRange,
        salesTimeline: dto.salesTimeline, dealName: dto.dealName,
        capabilities: dto.capabilities || [], providerType: dto.providerType,
        companySize: dto.companySize, deliveryModeCapability: dto.deliveryModeCapability,
        aiGeneratedTags: [], userTags: dto.userTags || [], tags: mergeTags([], dto.userTags || [], []),
        dataQualityScore: 0, isActive: true, isDeleted: false, source: 'MANUAL', createdAt: new Date(), updatedAt: new Date(),
      };
      offering.dataQualityScore = calculateSellOfferingDataQuality(offering);
      res.status(201).json({ success: true, data: await this.sellOfferingRepo.create(offering) });
    } catch (error) { next(error); }
  }

  async updateSellOffering(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = this.getAuth(req);
      if (!auth) { res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }); return; }
      const { id } = req.params;
      const existing = await this.sellOfferingRepo.getByIdForOwner(id, auth.userId, auth.organizationId);
      if (!existing) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Sell offering not found or access denied' } }); return; }
      const dto = req.body as UpdateSellOfferingDTO;
      const updated: SellOffering = { ...existing, ...dto, updatedAt: new Date() };
      if (dto.userTags) { updated.tags = mergeTags(updated.aiGeneratedTags || [], dto.userTags, []); updated.userTags = dto.userTags; }
      updated.dataQualityScore = calculateSellOfferingDataQuality(updated);
      res.json({ success: true, data: await this.sellOfferingRepo.update(id, updated) });
    } catch (error) { next(error); }
  }

  // ==========================================================================
  // UTILITY
  // ==========================================================================

  async getEnums(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json({ success: true, data: {
        solutionCategories: Object.values(SolutionCategory), providerTypes: Object.values(ProviderType),
        companySizes: Object.values(CompanySize), budgetRanges: Object.values(BudgetRange),
        neededTimelines: Object.values(NeededTimeline), buyingStages: Object.values(BuyingStage),
        deliveryModes: Object.values(DeliveryMode), deliveryModels: Object.values(DeliveryModel),
        targetCompanySizes: Object.values(TargetCompanySize), buyerTypes: Object.values(BuyerType),
        salesTimelines: Object.values(SalesTimeline), buyerRoles: Object.values(BuyerRole),
      }});
    } catch (error) { next(error); }
  }

  async healthCheck(_req: Request, res: Response): Promise<void> {
    res.json({ success: true, data: { status: 'healthy', service: 'deal-matching', version: '4.0.0', timestamp: new Date().toISOString() } });
  }

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  private validateCreateBuyRequestDTO(dto: CreateBuyRequestDTO): ValidationError[] {
    const e: ValidationError[] = [];
    if (!dto.whatYouNeed?.trim()) e.push({ field: 'whatYouNeed', message: 'Required', code: 'REQUIRED' });
    if (!dto.solutionCategory || !Object.values(SolutionCategory).includes(dto.solutionCategory)) e.push({ field: 'solutionCategory', message: 'Invalid', code: 'INVALID_ENUM' });
    if (!dto.relevantIndustry?.length) e.push({ field: 'relevantIndustry', message: 'At least one required', code: 'REQUIRED' });
    if (!dto.providerType || !Object.values(ProviderType).includes(dto.providerType)) e.push({ field: 'providerType', message: 'Invalid', code: 'INVALID_ENUM' });
    if (!dto.mustHaveRequirements?.length) e.push({ field: 'mustHaveRequirements', message: 'At least one required', code: 'REQUIRED' });
    if (!dto.budgetRange || !Object.values(BudgetRange).includes(dto.budgetRange)) e.push({ field: 'budgetRange', message: 'Invalid', code: 'INVALID_ENUM' });
    if (!dto.neededTimeline || !Object.values(NeededTimeline).includes(dto.neededTimeline)) e.push({ field: 'neededTimeline', message: 'Invalid', code: 'INVALID_ENUM' });
    if (!dto.buyingStage || !Object.values(BuyingStage).includes(dto.buyingStage)) e.push({ field: 'buyingStage', message: 'Invalid', code: 'INVALID_ENUM' });
    if (dto.buyerRole && !Object.values(BuyerRole).includes(dto.buyerRole)) e.push({ field: 'buyerRole', message: 'Invalid', code: 'INVALID_ENUM' });
    return e;
  }

  private validateCreateSellOfferingDTO(dto: CreateSellOfferingDTO): ValidationError[] {
    const e: ValidationError[] = [];
    if (!dto.productServiceName?.trim()) e.push({ field: 'productServiceName', message: 'Required', code: 'REQUIRED' });
    if (!dto.solutionCategory || !Object.values(SolutionCategory).includes(dto.solutionCategory)) e.push({ field: 'solutionCategory', message: 'Invalid', code: 'INVALID_ENUM' });
    if (!dto.industryFocus?.length) e.push({ field: 'industryFocus', message: 'At least one required', code: 'REQUIRED' });
    if (!dto.targetCompanySize || !Object.values(TargetCompanySize).includes(dto.targetCompanySize)) e.push({ field: 'targetCompanySize', message: 'Invalid', code: 'INVALID_ENUM' });
    if (!dto.providerType || !Object.values(ProviderType).includes(dto.providerType)) e.push({ field: 'providerType', message: 'Invalid', code: 'INVALID_ENUM' });
    if (!dto.idealBuyerType?.length) e.push({ field: 'idealBuyerType', message: 'At least one required', code: 'REQUIRED' });
    if (!dto.idealCustomerProfile?.trim()) e.push({ field: 'idealCustomerProfile', message: 'Required', code: 'REQUIRED' });
    if (!dto.priceRange || !Object.values(BudgetRange).includes(dto.priceRange)) e.push({ field: 'priceRange', message: 'Invalid', code: 'INVALID_ENUM' });
    if (!dto.salesTimeline || !Object.values(SalesTimeline).includes(dto.salesTimeline)) e.push({ field: 'salesTimeline', message: 'Invalid', code: 'INVALID_ENUM' });
    if (!dto.capabilities?.length) e.push({ field: 'capabilities', message: 'At least one required', code: 'REQUIRED' });
    return e;
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 10)}`;
  }
}

export const dealMatchingController = new DealMatchingController();
