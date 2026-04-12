/**
 * Skill Taxonomy Integration
 *
 * Enhanced skill matching with:
 * - Synonyms and aliases
 * - Skill hierarchy (parent/child)
 * - Related skills
 * - Required vs Preferred skill handling
 *
 * @module utils/skill-taxonomy-integration
 */

import { SkillRequirementType, SkillMatchResult } from '../types/opportunity-matching.types';

// ============================================================================
// Types
// ============================================================================

export interface SkillMatch {
  targetSkill: string;
  matchedSkill: string;
  matchType: SkillMatchType;
  score: number;
}

export type SkillMatchType =
  | 'EXACT'
  | 'SYNONYM'
  | 'CHILD'
  | 'IMPLIED'
  | 'RELATED'
  | 'PARENT'
  | 'SEMANTIC_FALLBACK';

export interface SkillScoreResult {
  score: number;
  matches: SkillMatch[];
  unmatchedTarget: string[];
  unmatchedCandidate: string[];
  requiredSkillsCoverage: number;
  preferredSkillsCoverage: number;
}

// ============================================================================
// Match Type Scores
// ============================================================================

const MATCH_TYPE_SCORES: Record<SkillMatchType, number> = {
  EXACT: 100,
  SYNONYM: 95,
  CHILD: 90,
  IMPLIED: 80,
  RELATED: 75,
  PARENT: 70,
  SEMANTIC_FALLBACK: 50,
};

// ============================================================================
// Comprehensive Skill Synonyms Database
// ============================================================================

const SKILL_SYNONYMS: Record<string, string[]> = {
  // Programming Languages
  'javascript': ['js', 'ecmascript', 'es6', 'es2015', 'es2020', 'vanilla js'],
  'typescript': ['ts', 'typed javascript'],
  'python': ['py', 'python3', 'python 3'],
  'golang': ['go', 'go lang'],
  'c++': ['cpp', 'cplusplus', 'c plus plus'],
  'c#': ['csharp', 'c-sharp', 'c sharp', 'dotnet'],
  'ruby': ['rb', 'ruby on rails'],
  'java': ['j2ee', 'jvm'],
  'rust': ['rustlang'],
  'kotlin': ['kt'],
  'swift': ['ios development'],
  'php': ['php8', 'laravel', 'symfony'],
  'scala': ['scala lang'],
  'r': ['r language', 'r programming', 'rstats'],

  // Frontend Frameworks
  'react': ['reactjs', 'react.js', 'react js'],
  'angular': ['angularjs', 'angular.js', 'angular 2+'],
  'vue': ['vuejs', 'vue.js', 'vue 3'],
  'svelte': ['sveltejs', 'sveltekit'],
  'next.js': ['nextjs', 'next', 'next js'],
  'nuxt': ['nuxtjs', 'nuxt.js'],
  'gatsby': ['gatsbyjs'],

  // Backend Frameworks
  'node.js': ['nodejs', 'node', 'node js'],
  'express': ['expressjs', 'express.js'],
  'nestjs': ['nest.js', 'nest'],
  'django': ['django framework', 'django python'],
  'flask': ['flask python'],
  'fastapi': ['fast api'],
  'spring': ['spring boot', 'spring framework', 'springboot'],
  'rails': ['ruby on rails', 'ror'],
  'asp.net': ['aspnet', 'asp net', '.net core'],

  // Cloud Platforms
  'aws': ['amazon web services', 'amazon aws', 'amazon cloud'],
  'gcp': ['google cloud', 'google cloud platform', 'gcloud'],
  'azure': ['microsoft azure', 'ms azure', 'azure cloud'],
  'heroku': ['heroku cloud'],
  'vercel': ['vercel hosting'],
  'netlify': ['netlify hosting'],
  'digitalocean': ['digital ocean', 'do'],

  // DevOps & Infrastructure
  'kubernetes': ['k8s', 'kube'],
  'docker': ['containerization', 'docker containers'],
  'ci/cd': ['continuous integration', 'continuous deployment', 'cicd', 'ci cd'],
  'terraform': ['tf', 'infrastructure as code', 'iac'],
  'ansible': ['ansible automation'],
  'jenkins': ['jenkins ci'],
  'github actions': ['gh actions', 'gha'],
  'gitlab ci': ['gitlab cicd'],
  'circleci': ['circle ci'],

  // Databases
  'sql': ['structured query language', 'relational database'],
  'mysql': ['my sql'],
  'postgresql': ['postgres', 'psql', 'pg'],
  'mongodb': ['mongo', 'mongo db'],
  'redis': ['redis cache'],
  'elasticsearch': ['elastic', 'es', 'elk'],
  'dynamodb': ['dynamo db', 'aws dynamodb'],
  'cassandra': ['apache cassandra'],
  'neo4j': ['neo 4j', 'graph database'],

  // Data & ML
  'machine learning': ['ml', 'statistical learning'],
  'deep learning': ['dl', 'neural networks'],
  'artificial intelligence': ['ai'],
  'data science': ['data analysis', 'data analytics'],
  'natural language processing': ['nlp', 'text analytics'],
  'computer vision': ['cv', 'image recognition'],
  'tensorflow': ['tf', 'tensor flow'],
  'pytorch': ['torch', 'py torch'],
  'pandas': ['pandas python'],
  'numpy': ['np', 'numerical python'],
  'scikit-learn': ['sklearn', 'scikit learn'],

  // API & Integration
  'rest': ['rest api', 'restful', 'restful api'],
  'graphql': ['graph ql', 'gql'],
  'grpc': ['g rpc', 'google rpc'],
  'websocket': ['websockets', 'ws'],
  'api design': ['api development', 'api architecture'],

  // Testing
  'unit testing': ['unit tests'],
  'integration testing': ['integration tests'],
  'e2e testing': ['end to end testing', 'e2e tests'],
  'jest': ['jest testing'],
  'cypress': ['cypress testing'],
  'selenium': ['selenium webdriver'],
  'pytest': ['py test', 'python testing'],

  // Mobile
  'react native': ['rn', 'react-native'],
  'flutter': ['flutter mobile'],
  'ios': ['ios development', 'iphone development'],
  'android': ['android development'],

  // Soft Skills
  'leadership': ['team leadership', 'people management', 'people leader'],
  'communication': ['verbal communication', 'written communication'],
  'project management': ['pm', 'program management', 'project mgmt'],
  'agile': ['scrum', 'kanban', 'agile methodology', 'agile development'],
  'product management': ['product owner', 'product leadership'],
  'mentoring': ['coaching', 'team mentoring'],
  'stakeholder management': ['stakeholder communication'],
};

// ============================================================================
// Skill Hierarchy
// ============================================================================

const SKILL_HIERARCHY: Record<string, string[]> = {
  // Frontend Development
  'frontend development': ['react', 'angular', 'vue', 'svelte', 'html', 'css', 'javascript', 'typescript'],
  'react': ['react hooks', 'redux', 'react router', 'next.js', 'react query', 'zustand'],
  'angular': ['rxjs', 'ngrx', 'angular material', 'typescript'],
  'vue': ['vuex', 'pinia', 'nuxt', 'vue router'],
  'css': ['sass', 'scss', 'less', 'tailwind', 'css modules', 'styled-components'],

  // Backend Development
  'backend development': ['node.js', 'python', 'java', 'golang', 'ruby', 'c#', 'php'],
  'node.js': ['express', 'nestjs', 'fastify', 'koa', 'hapi'],
  'python': ['django', 'flask', 'fastapi', 'celery', 'asyncio'],
  'java': ['spring', 'spring boot', 'hibernate', 'maven', 'gradle'],
  'golang': ['gin', 'echo', 'fiber', 'goroutines'],

  // Cloud Computing
  'cloud computing': ['aws', 'gcp', 'azure', 'cloud architecture'],
  'aws': ['ec2', 's3', 'lambda', 'rds', 'dynamodb', 'cloudformation', 'eks', 'ecs'],
  'gcp': ['compute engine', 'cloud storage', 'cloud functions', 'bigquery', 'gke'],
  'azure': ['azure functions', 'azure devops', 'cosmos db', 'aks'],

  // DevOps
  'devops': ['ci/cd', 'docker', 'kubernetes', 'terraform', 'ansible', 'monitoring'],
  'kubernetes': ['helm', 'istio', 'prometheus', 'grafana', 'argocd'],
  'monitoring': ['prometheus', 'grafana', 'datadog', 'new relic', 'splunk'],

  // Data Engineering
  'data engineering': ['sql', 'spark', 'kafka', 'airflow', 'etl'],
  'big data': ['hadoop', 'spark', 'hive', 'presto', 'databricks'],

  // Machine Learning
  'machine learning': ['tensorflow', 'pytorch', 'scikit-learn', 'deep learning', 'mlops'],
  'data science': ['python', 'r', 'statistics', 'machine learning', 'data visualization'],
  'deep learning': ['tensorflow', 'pytorch', 'keras', 'transformers', 'llm'],

  // Security
  'security': ['penetration testing', 'sast', 'dast', 'owasp', 'encryption'],
  'cybersecurity': ['network security', 'application security', 'incident response'],

  // Databases
  'databases': ['sql', 'nosql', 'postgresql', 'mongodb', 'redis'],
  'sql databases': ['postgresql', 'mysql', 'mssql', 'oracle'],
  'nosql databases': ['mongodb', 'cassandra', 'dynamodb', 'couchdb'],
};

// ============================================================================
// Related Skills
// ============================================================================

const RELATED_SKILLS: Record<string, string[]> = {
  'react': ['redux', 'graphql', 'webpack', 'jest', 'typescript', 'next.js'],
  'node.js': ['express', 'mongodb', 'redis', 'graphql', 'typescript'],
  'python': ['pandas', 'numpy', 'jupyter', 'flask', 'django', 'fastapi'],
  'aws': ['terraform', 'cloudformation', 'serverless', 'docker'],
  'docker': ['kubernetes', 'ci/cd', 'linux', 'microservices'],
  'kubernetes': ['docker', 'helm', 'istio', 'prometheus', 'aws', 'gcp'],
  'machine learning': ['deep learning', 'nlp', 'computer vision', 'python', 'tensorflow'],
  'data science': ['statistics', 'visualization', 'sql', 'python', 'machine learning'],
  'project management': ['agile', 'jira', 'stakeholder management', 'risk management'],
  'leadership': ['mentoring', 'strategic planning', 'team building', 'communication'],
  'devops': ['ci/cd', 'docker', 'kubernetes', 'monitoring', 'automation'],
  'typescript': ['javascript', 'node.js', 'react', 'angular'],
  'postgresql': ['sql', 'database design', 'performance tuning'],
  'microservices': ['docker', 'kubernetes', 'api design', 'event-driven'],
  'api design': ['rest', 'graphql', 'openapi', 'authentication'],
};

// ============================================================================
// Skill Taxonomy Service
// ============================================================================

class SkillTaxonomyService {
  private synonymIndex: Map<string, string> = new Map();
  private initialized: boolean = false;

  constructor() {
    this.buildSynonymIndex();
    this.initialized = true;
  }

  /**
   * Build reverse index for synonym lookup
   */
  private buildSynonymIndex(): void {
    for (const [canonical, synonyms] of Object.entries(SKILL_SYNONYMS)) {
      const canonicalLower = canonical.toLowerCase();
      this.synonymIndex.set(canonicalLower, canonicalLower);

      for (const synonym of synonyms) {
        this.synonymIndex.set(synonym.toLowerCase(), canonicalLower);
      }
    }
  }

  /**
   * Check if service is available
   */
  isAvailable(): boolean {
    return this.initialized;
  }

  /**
   * Normalize skill name to canonical form
   */
  normalizeSkill(skill: string): string {
    const lower = skill.toLowerCase().trim();
    return this.synonymIndex.get(lower) || lower;
  }

  /**
   * Calculate skill match score between target skills and candidate skills
   */
  calculateSkillScore(
    targetSkills: string[],
    candidateSkills: string[],
    requiredSkills?: string[]
  ): SkillScoreResult {
    if (targetSkills.length === 0) {
      return {
        score: 50,
        matches: [],
        unmatchedTarget: [],
        unmatchedCandidate: candidateSkills,
        requiredSkillsCoverage: 1,
        preferredSkillsCoverage: 1,
      };
    }

    const matches: SkillMatch[] = [];
    const matchedTargets = new Set<string>();
    const matchedCandidates = new Set<string>();

    // Normalize all skills
    const normalizedTargets = targetSkills.map(s => ({
      original: s,
      normalized: this.normalizeSkill(s),
    }));
    const normalizedCandidates = candidateSkills.map(s => ({
      original: s,
      normalized: this.normalizeSkill(s),
    }));

    // Pass 1: Exact matches
    for (const target of normalizedTargets) {
      for (const candidate of normalizedCandidates) {
        if (target.normalized === candidate.normalized && !matchedCandidates.has(candidate.original)) {
          matches.push({
            targetSkill: target.original,
            matchedSkill: candidate.original,
            matchType: 'EXACT',
            score: MATCH_TYPE_SCORES.EXACT,
          });
          matchedTargets.add(target.original);
          matchedCandidates.add(candidate.original);
          break;
        }
      }
    }

    // Pass 2: Synonym matches
    for (const target of normalizedTargets) {
      if (matchedTargets.has(target.original)) continue;

      const targetSynonyms = this.getSynonyms(target.normalized);

      for (const candidate of normalizedCandidates) {
        if (matchedCandidates.has(candidate.original)) continue;

        if (targetSynonyms.includes(candidate.normalized)) {
          matches.push({
            targetSkill: target.original,
            matchedSkill: candidate.original,
            matchType: 'SYNONYM',
            score: MATCH_TYPE_SCORES.SYNONYM,
          });
          matchedTargets.add(target.original);
          matchedCandidates.add(candidate.original);
          break;
        }
      }
    }

    // Pass 3: Hierarchy matches (child skills)
    for (const target of normalizedTargets) {
      if (matchedTargets.has(target.original)) continue;

      const children = this.getChildSkills(target.normalized);

      for (const candidate of normalizedCandidates) {
        if (matchedCandidates.has(candidate.original)) continue;

        if (children.includes(candidate.normalized)) {
          matches.push({
            targetSkill: target.original,
            matchedSkill: candidate.original,
            matchType: 'CHILD',
            score: MATCH_TYPE_SCORES.CHILD,
          });
          matchedTargets.add(target.original);
          matchedCandidates.add(candidate.original);
          break;
        }
      }
    }

    // Pass 4: Related skill matches
    for (const target of normalizedTargets) {
      if (matchedTargets.has(target.original)) continue;

      const related = this.getRelatedSkills(target.normalized);

      for (const candidate of normalizedCandidates) {
        if (matchedCandidates.has(candidate.original)) continue;

        if (related.includes(candidate.normalized)) {
          matches.push({
            targetSkill: target.original,
            matchedSkill: candidate.original,
            matchType: 'RELATED',
            score: MATCH_TYPE_SCORES.RELATED,
          });
          matchedTargets.add(target.original);
          matchedCandidates.add(candidate.original);
          break;
        }
      }
    }

    // Pass 5: Parent skill matches
    for (const target of normalizedTargets) {
      if (matchedTargets.has(target.original)) continue;

      const parent = this.getParentSkill(target.normalized);
      if (!parent) continue;

      for (const candidate of normalizedCandidates) {
        if (matchedCandidates.has(candidate.original)) continue;

        if (candidate.normalized === parent) {
          matches.push({
            targetSkill: target.original,
            matchedSkill: candidate.original,
            matchType: 'PARENT',
            score: MATCH_TYPE_SCORES.PARENT,
          });
          matchedTargets.add(target.original);
          matchedCandidates.add(candidate.original);
          break;
        }
      }
    }

    // Calculate final score
    const unmatchedTarget = targetSkills.filter(s => !matchedTargets.has(s));
    const unmatchedCandidate = candidateSkills.filter(s => !matchedCandidates.has(s));

    let totalScore = 0;
    for (const match of matches) {
      totalScore += match.score;
    }

    // Penalize unmatched target skills
    const maxPossibleScore = targetSkills.length * 100;
    const score = maxPossibleScore > 0
      ? Math.round((totalScore / maxPossibleScore) * 100)
      : 50;

    // Calculate required skills coverage
    let requiredSkillsCoverage = 1;
    let preferredSkillsCoverage = 1;

    if (requiredSkills && requiredSkills.length > 0) {
      const requiredLower = requiredSkills.map(s => s.toLowerCase());
      const matchedRequired = requiredLower.filter(r =>
        matches.some(m => m.targetSkill.toLowerCase() === r)
      );
      requiredSkillsCoverage = matchedRequired.length / requiredSkills.length;

      const preferredSkills = targetSkills.filter(s =>
        !requiredLower.includes(s.toLowerCase())
      );
      if (preferredSkills.length > 0) {
        const matchedPreferred = preferredSkills.filter(p =>
          matches.some(m => m.targetSkill.toLowerCase() === p.toLowerCase())
        );
        preferredSkillsCoverage = matchedPreferred.length / preferredSkills.length;
      }
    }

    return {
      score: Math.min(100, score),
      matches,
      unmatchedTarget,
      unmatchedCandidate,
      requiredSkillsCoverage,
      preferredSkillsCoverage,
    };
  }

  /**
   * Get synonyms for a skill
   */
  private getSynonyms(skill: string): string[] {
    const normalized = this.normalizeSkill(skill);

    // Check if this skill has synonyms defined
    const synonyms = SKILL_SYNONYMS[normalized];
    if (synonyms) {
      return [normalized, ...synonyms.map(s => s.toLowerCase())];
    }

    // Check if this is a synonym of another skill
    for (const [canonical, syns] of Object.entries(SKILL_SYNONYMS)) {
      if (syns.map(s => s.toLowerCase()).includes(normalized)) {
        return [canonical.toLowerCase(), ...syns.map(s => s.toLowerCase())];
      }
    }

    return [normalized];
  }

  /**
   * Get child skills in hierarchy
   */
  private getChildSkills(skill: string): string[] {
    const normalized = this.normalizeSkill(skill);
    const children = SKILL_HIERARCHY[normalized];
    return children ? children.map(s => s.toLowerCase()) : [];
  }

  /**
   * Get parent skill in hierarchy
   */
  private getParentSkill(skill: string): string | null {
    const normalized = this.normalizeSkill(skill);

    for (const [parent, children] of Object.entries(SKILL_HIERARCHY)) {
      if (children.map(s => s.toLowerCase()).includes(normalized)) {
        return parent.toLowerCase();
      }
    }

    return null;
  }

  /**
   * Get related skills
   */
  private getRelatedSkills(skill: string): string[] {
    const normalized = this.normalizeSkill(skill);
    const related = RELATED_SKILLS[normalized];
    return related ? related.map(s => s.toLowerCase()) : [];
  }

  /**
   * Find best matches for a single skill
   */
  findBestMatches(
    targetSkill: string,
    candidateSkills: string[],
    limit: number = 3
  ): SkillMatch[] {
    const result = this.calculateSkillScore([targetSkill], candidateSkills);
    return result.matches.slice(0, limit);
  }

  /**
   * Check if two skills are related
   */
  areSkillsRelated(skill1: string, skill2: string): boolean {
    const norm1 = this.normalizeSkill(skill1);
    const norm2 = this.normalizeSkill(skill2);

    // Same skill
    if (norm1 === norm2) return true;

    // Synonyms
    if (this.getSynonyms(norm1).includes(norm2)) return true;

    // Hierarchy
    if (this.getChildSkills(norm1).includes(norm2)) return true;
    if (this.getChildSkills(norm2).includes(norm1)) return true;

    // Related
    if (this.getRelatedSkills(norm1).includes(norm2)) return true;

    return false;
  }

  /**
   * Get skill category
   */
  getSkillCategory(skill: string): string | null {
    const normalized = this.normalizeSkill(skill);

    // Check if this skill is a category itself
    if (SKILL_HIERARCHY[normalized]) {
      return normalized;
    }

    // Find parent category
    return this.getParentSkill(normalized);
  }
}

// Export singleton instance
export const skillTaxonomyService = new SkillTaxonomyService();
