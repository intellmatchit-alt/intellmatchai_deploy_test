/**
 * Product Matching Service (Sell Smarter Feature)
 * Core scoring algorithm for matching contacts against a product profile
 *
 * Scoring Weights:
 * - Decision Power: 40% (seniority + role match)
 * - Company Fit: 30% (industry + size match)
 * - Role Context: 20% (department + skills)
 * - Additional: 10% (relationship + recency)
 *
 * Badge Thresholds:
 * - SUITABLE: >= 70
 * - INFLUENCER: 40-69
 * - NOT_SUITABLE: < 40
 */

import {
  ProductProfileEntity,
  ProductMatchBadge,
  ProductMatchScoringResult,
  ProductMatchBreakdown,
  ExplanationBullet,
  ExplanationType,
  ComponentScore,
  ContactForMatching,
  PRODUCT_MATCH_WEIGHTS,
  BADGE_THRESHOLDS,
  COMPANY_SIZE_MAP,
} from '../../../domain/entities/ProductMatch';
import { logger } from '../../../shared/logger';
import {
  SeniorityLevel,
  SENIORITY_SCORES,
  SENIORITY_KEYWORDS,
  detectSeniorityLevel as sharedDetectSeniorityLevel,
} from '../../../shared/matching';

// ============================================================================
// Service Class
// ============================================================================

export class ProductMatchingService {
  /**
   * Score all contacts against a product profile
   */
  async matchContacts(
    profile: ProductProfileEntity,
    contacts: ContactForMatching[]
  ): Promise<ProductMatchScoringResult[]> {
    logger.info('Starting product matching', {
      profileId: profile.id,
      contactCount: contacts.length,
    });

    const results: ProductMatchScoringResult[] = [];

    for (const contact of contacts) {
      const result = this.scoreContact(profile, contact);
      results.push(result);
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    logger.info('Product matching complete', {
      profileId: profile.id,
      totalContacts: contacts.length,
      suitableCount: results.filter(r => r.badge === ProductMatchBadge.SUITABLE).length,
      influencerCount: results.filter(r => r.badge === ProductMatchBadge.INFLUENCER).length,
    });

    return results;
  }

  /**
   * Score a single contact against the product profile
   */
  scoreContact(profile: ProductProfileEntity, contact: ContactForMatching): ProductMatchScoringResult {
    // Calculate component scores
    const decisionPower = this.calculateDecisionPowerScore(profile, contact);
    const companyFit = this.calculateCompanyFitScore(profile, contact);
    const roleContext = this.calculateRoleContextScore(profile, contact);
    const additional = this.calculateAdditionalScore(contact);

    // Calculate weighted total
    const totalScore = Math.round(
      decisionPower.score * PRODUCT_MATCH_WEIGHTS.decisionPower +
      companyFit.score * PRODUCT_MATCH_WEIGHTS.companyFit +
      roleContext.score * PRODUCT_MATCH_WEIGHTS.roleContext +
      additional.score * PRODUCT_MATCH_WEIGHTS.additional
    );

    // Clamp score to 0-100
    const finalScore = Math.min(100, Math.max(0, totalScore));

    // Determine badge
    const badge = this.classifyBadge(finalScore);

    // Generate explanations
    const explanations = this.generateExplanations(profile, contact, decisionPower, companyFit, roleContext, additional);

    // Generate talk angle and opener
    const talkAngle = this.generateTalkAngle(profile, contact, badge);
    const openerMessage = this.generateOpenerMessage(profile, contact, badge);

    // Build breakdown
    const breakdown: ProductMatchBreakdown = {
      decisionPower: {
        ...decisionPower,
        weight: PRODUCT_MATCH_WEIGHTS.decisionPower,
        weighted: decisionPower.score * PRODUCT_MATCH_WEIGHTS.decisionPower,
      },
      companyFit: {
        ...companyFit,
        weight: PRODUCT_MATCH_WEIGHTS.companyFit,
        weighted: companyFit.score * PRODUCT_MATCH_WEIGHTS.companyFit,
      },
      roleContext: {
        ...roleContext,
        weight: PRODUCT_MATCH_WEIGHTS.roleContext,
        weighted: roleContext.score * PRODUCT_MATCH_WEIGHTS.roleContext,
      },
      additional: {
        ...additional,
        weight: PRODUCT_MATCH_WEIGHTS.additional,
        weighted: additional.score * PRODUCT_MATCH_WEIGHTS.additional,
      },
    };

    return {
      contactId: contact.id,
      score: finalScore,
      badge,
      explanations,
      talkAngle,
      openerMessage,
      breakdown,
    };
  }

  // ============================================================================
  // Component Score Calculations
  // ============================================================================

  /**
   * Calculate Decision Power score (40% weight)
   * - Seniority Level: 60% of component
   * - Role Match: 40% of component
   */
  private calculateDecisionPowerScore(profile: ProductProfileEntity, contact: ContactForMatching): ComponentScore {
    const details: Record<string, number> = {};
    const title = contact.jobTitle?.toLowerCase() || '';

    // Detect seniority level (60% of this component = max 60 pts)
    const seniorityLevel = sharedDetectSeniorityLevel(title);
    const seniorityScore = SENIORITY_SCORES[seniorityLevel];
    const seniorityContribution = Math.round(seniorityScore * 0.6);
    details.seniority = seniorityContribution;

    // Role match against decision maker roles (40% of this component = max 40 pts)
    let roleMatchScore = 0;
    const decisionMakerRoles = profile.decisionMakerRole.toLowerCase().split(/[,;|]+/).map(r => r.trim());

    for (const role of decisionMakerRoles) {
      if (role && title.includes(role)) {
        roleMatchScore = 40;
        break;
      }
    }

    // Also check for common decision maker keywords
    const commonDecisionKeywords = ['head', 'director', 'chief', 'vp', 'vice president', 'owner', 'founder'];
    if (roleMatchScore === 0) {
      for (const keyword of commonDecisionKeywords) {
        if (decisionMakerRoles.some(r => r.includes(keyword)) && title.includes(keyword)) {
          roleMatchScore = 30; // Partial match
          break;
        }
      }
    }

    details.roleMatch = roleMatchScore;

    const totalScore = Math.min(100, seniorityContribution + roleMatchScore);

    return { score: totalScore, weight: 0, weighted: 0, details };
  }

  /**
   * Calculate Company Fit score (30% weight)
   * - Industry Match: 50% of component
   * - Size Match: 50% of component
   */
  private calculateCompanyFitScore(profile: ProductProfileEntity, contact: ContactForMatching): ComponentScore {
    const details: Record<string, number> = {};

    // Industry matching (max 50 pts)
    let industryScore = 0;
    const targetIndustries = profile.targetIndustry.toLowerCase().split(/[,;|]+/).map(i => i.trim());

    // Check contact sectors
    for (const sector of contact.sectors) {
      const sectorLower = sector.toLowerCase();
      if (targetIndustries.some(ind => sectorLower.includes(ind) || ind.includes(sectorLower))) {
        industryScore = 50;
        break;
      }
    }

    // Check enrichment data industry
    if (industryScore === 0 && contact.enrichmentData?.industry) {
      const contactIndustry = contact.enrichmentData.industry.toLowerCase();
      if (targetIndustries.some(ind => contactIndustry.includes(ind) || ind.includes(contactIndustry))) {
        industryScore = 50;
      }
    }

    details.industry = industryScore;

    // Company size matching (max 50 pts)
    let sizeScore = 0;
    const targetSize = profile.targetCompanySize.toUpperCase();

    if (targetSize === 'ANY') {
      sizeScore = 25; // Partial score for "any"
    } else if (contact.enrichmentData?.companySize) {
      const contactSize = contact.enrichmentData.companySize.toLowerCase();
      const targetKeywords = COMPANY_SIZE_MAP[targetSize] || [];

      if (targetKeywords.some(kw => contactSize.includes(kw))) {
        sizeScore = 50;
      }
    }

    details.size = sizeScore;

    const totalScore = Math.min(100, industryScore + sizeScore);

    return { score: totalScore, weight: 0, weighted: 0, details };
  }

  /**
   * Calculate Role Context score (20% weight)
   * - Department Alignment: 70% of component
   * - Skills Match: 30% of component
   */
  private calculateRoleContextScore(profile: ProductProfileEntity, contact: ContactForMatching): ComponentScore {
    const details: Record<string, number> = {};
    const title = contact.jobTitle?.toLowerCase() || '';
    const department = contact.enrichmentData?.department?.toLowerCase() || '';

    // Department alignment (max 70 pts)
    let departmentScore = 0;
    const decisionMakerRoles = profile.decisionMakerRole.toLowerCase().split(/[,;|]+/).map(r => r.trim());

    // Extract department keywords from decision maker roles
    const departmentKeywords = this.extractDepartmentKeywords(decisionMakerRoles);

    // Check department match
    const searchText = `${title} ${department}`;
    for (const keyword of departmentKeywords) {
      if (searchText.includes(keyword)) {
        departmentScore = 70;
        break;
      }
    }

    // Partial match if there's some overlap
    if (departmentScore === 0 && department) {
      for (const keyword of departmentKeywords) {
        if (department.includes(keyword.substring(0, 4))) {
          departmentScore = 30;
          break;
        }
      }
    }

    details.department = departmentScore;

    // Skills match related to problem solved (max 30 pts)
    let skillsScore = 0;
    const problemKeywords = this.extractKeywords(profile.problemSolved);

    for (const skill of contact.skills) {
      const skillLower = skill.toLowerCase();
      if (problemKeywords.some(kw => skillLower.includes(kw) || kw.includes(skillLower))) {
        skillsScore += 15;
        if (skillsScore >= 30) {
          skillsScore = 30;
          break;
        }
      }
    }

    details.skills = skillsScore;

    const totalScore = Math.min(100, departmentScore + skillsScore);

    return { score: totalScore, weight: 0, weighted: 0, details };
  }

  /**
   * Calculate Additional Factors score (10% weight)
   * - Relationship Strength: 40% of component
   * - Recent Interaction: 30% of component
   * - Interaction Frequency: 30% of component
   */
  private calculateAdditionalScore(contact: ContactForMatching): ComponentScore {
    const details: Record<string, number> = {};

    // Relationship strength from matchScore (max 40 pts)
    let relationshipScore = 0;
    if (contact.matchScore !== null && contact.matchScore > 0) {
      relationshipScore = Math.round(contact.matchScore * 0.4);
    }
    details.relationship = Math.min(40, relationshipScore);

    // Recent interaction (max 30 pts)
    let recencyScore = 0;
    if (contact.lastInteractionAt) {
      const daysSince = this.daysSince(contact.lastInteractionAt);
      if (daysSince <= 7) {
        recencyScore = 30;
      } else if (daysSince <= 30) {
        recencyScore = 20;
      } else if (daysSince <= 90) {
        recencyScore = 10;
      }
    }
    details.recency = recencyScore;

    // Interaction frequency (max 30 pts)
    const frequencyScore = Math.min(30, contact.interactionCount * 5);
    details.frequency = frequencyScore;

    const totalScore = Math.min(100, details.relationship + recencyScore + frequencyScore);

    return { score: totalScore, weight: 0, weighted: 0, details };
  }

  // ============================================================================
  // Badge Classification
  // ============================================================================

  private classifyBadge(score: number): ProductMatchBadge {
    if (score >= BADGE_THRESHOLDS.suitable) {
      return ProductMatchBadge.SUITABLE;
    } else if (score >= BADGE_THRESHOLDS.influencer) {
      return ProductMatchBadge.INFLUENCER;
    } else {
      return ProductMatchBadge.NOT_SUITABLE;
    }
  }

  // ============================================================================
  // Explanation Generation
  // ============================================================================

  private generateExplanations(
    profile: ProductProfileEntity,
    contact: ContactForMatching,
    decisionPower: ComponentScore,
    companyFit: ComponentScore,
    roleContext: ComponentScore,
    additional: ComponentScore
  ): ExplanationBullet[] {
    const explanations: ExplanationBullet[] = [];

    // Decision Power explanations
    if (decisionPower.details.seniority >= 50) {
      explanations.push({
        type: ExplanationType.DECISION_POWER,
        text: 'Senior-level position with decision-making authority',
      });
    } else if (decisionPower.details.seniority >= 30) {
      explanations.push({
        type: ExplanationType.DECISION_POWER,
        text: 'Management-level position',
      });
    }

    if (decisionPower.details.roleMatch >= 30) {
      explanations.push({
        type: ExplanationType.DECISION_POWER,
        text: `Role matches target: ${profile.decisionMakerRole}`,
      });
    }

    // Company Fit explanations
    if (companyFit.details.industry >= 40) {
      explanations.push({
        type: ExplanationType.COMPANY_FIT,
        text: `Works in your target industry: ${profile.targetIndustry}`,
      });
    }

    if (companyFit.details.size >= 40) {
      explanations.push({
        type: ExplanationType.COMPANY_FIT,
        text: `Company size aligns with your target: ${profile.targetCompanySize}`,
      });
    }

    // Role Context explanations
    if (roleContext.details.department >= 50) {
      explanations.push({
        type: ExplanationType.ROLE_CONTEXT,
        text: 'Department aligns with target decision maker',
      });
    }

    if (roleContext.details.skills >= 15) {
      explanations.push({
        type: ExplanationType.ROLE_CONTEXT,
        text: 'Has skills related to the problem you solve',
      });
    }

    // Additional explanations
    if (additional.details.relationship >= 30) {
      explanations.push({
        type: ExplanationType.RELATIONSHIP,
        text: 'Strong existing relationship in your network',
      });
    }

    if (additional.details.recency >= 20) {
      explanations.push({
        type: ExplanationType.RELATIONSHIP,
        text: 'Recent interaction - relationship is active',
      });
    }

    // Return top 4 explanations, sorted by score contribution
    return explanations.slice(0, 4);
  }

  // ============================================================================
  // Talk Angle Generation
  // ============================================================================

  private generateTalkAngle(
    profile: ProductProfileEntity,
    contact: ContactForMatching,
    badge: ProductMatchBadge
  ): string {
    const firstName = contact.fullName.split(' ')[0];
    const productName = profile.productName || 'your solution';
    const problemSolved = profile.problemSolved;

    switch (badge) {
      case ProductMatchBadge.SUITABLE:
        return `${firstName} is likely evaluating solutions for ${problemSolved}. Lead with how ${productName} addresses this directly and ask about their current approach.`;

      case ProductMatchBadge.INFLUENCER:
        return `${firstName} can influence the decision. Focus on benefits to their team and ask who handles vendor evaluation or purchasing decisions.`;

      case ProductMatchBadge.NOT_SUITABLE:
        return `${firstName} may not be the primary decision maker. Consider asking for a referral to the right person or use this as a networking opportunity.`;

      default:
        return `Consider how ${productName} could benefit ${firstName}'s organization.`;
    }
  }

  // ============================================================================
  // Opener Message Generation
  // ============================================================================

  private generateOpenerMessage(
    profile: ProductProfileEntity,
    contact: ContactForMatching,
    badge: ProductMatchBadge
  ): string {
    const firstName = contact.fullName.split(' ')[0];
    const productName = profile.productName || 'our solution';
    const targetIndustry = profile.targetIndustry;
    const problemSolved = profile.problemSolved;
    const jobTitle = contact.jobTitle || 'professional';
    const company = contact.company || 'your organization';

    switch (badge) {
      case ProductMatchBadge.SUITABLE:
        return `Hi ${firstName},

I noticed you're the ${jobTitle} at ${company}. I wanted to reach out because we've been helping similar organizations solve ${problemSolved}.

${productName} is designed specifically for ${targetIndustry} companies like yours, and I'd love to share how it might benefit your team.

Would you have 15 minutes this week for a quick conversation?`;

      case ProductMatchBadge.INFLUENCER:
        return `Hi ${firstName},

Given your role at ${company}, I thought you might find this relevant. We help ${targetIndustry} companies with ${problemSolved}.

I'd be curious to hear if this is something your team is currently thinking about, and if so, who would be the best person to connect with?

Would you be open to a brief chat?`;

      case ProductMatchBadge.NOT_SUITABLE:
        return `Hi ${firstName},

I came across your profile and wanted to reach out. We work with ${targetIndustry} companies on ${problemSolved}.

I'm not sure if this is relevant to your role, but would you know who in your organization might be handling these decisions?

Either way, I'd love to connect and learn more about what ${company} is working on.`;

      default:
        return `Hi ${firstName},

I wanted to reach out about ${productName}, which helps with ${problemSolved}.

Would you be interested in learning more?`;
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Detect seniority level from job title (delegates to shared Arabic-aware implementation)
   */
  detectSeniorityLevel(title: string): SeniorityLevel {
    return sharedDetectSeniorityLevel(title);
  }

  /**
   * Extract department keywords from decision maker roles
   */
  private extractDepartmentKeywords(roles: string[]): string[] {
    const departments = new Set<string>();

    const departmentMap: Record<string, string[]> = {
      sales: ['sales', 'revenue', 'commercial', 'business development'],
      marketing: ['marketing', 'brand', 'growth', 'demand'],
      engineering: ['engineering', 'technical', 'technology', 'development', 'r&d'],
      product: ['product', 'ux', 'design'],
      operations: ['operations', 'ops', 'supply', 'logistics'],
      finance: ['finance', 'accounting', 'treasury', 'controller'],
      hr: ['hr', 'human resources', 'people', 'talent'],
      it: ['it', 'information technology', 'infrastructure', 'security'],
    };

    for (const role of roles) {
      for (const [dept, keywords] of Object.entries(departmentMap)) {
        if (keywords.some(kw => role.includes(kw))) {
          departments.add(dept);
          keywords.forEach(kw => departments.add(kw));
        }
      }
    }

    return Array.from(departments);
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[\s,;.]+/)
      .filter(w => w.length > 3)
      .filter(w => !['and', 'the', 'for', 'with', 'that', 'this', 'from', 'have', 'are', 'been'].includes(w));
  }

  /**
   * Calculate days since a date
   */
  private daysSince(date: Date): number {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }
}

// Export singleton instance
export const productMatchingService = new ProductMatchingService();
