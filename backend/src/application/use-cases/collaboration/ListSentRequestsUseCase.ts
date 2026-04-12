/**
 * Use Case: List Sent Collaboration Requests
 * Lists requests sent by the owner (privacy enforced - no contact data)
 */

import { ICollaborationRequestRepository } from '../../../domain/repositories/ICollaborationRepository';
import { CollaborationRequestStatus, CollaborationSourceType } from '../../../domain/entities/Collaboration';

export interface ListSentRequestsInput {
  status?: CollaborationRequestStatus;
  sourceType?: CollaborationSourceType;
  sourceId?: string;
  page?: number;
  limit?: number;
}

export interface IntroductionsSummaryOutput {
  total: number;
  pending: number;
  sent: number;
  accepted: number;
  completed: number;
  declined: number;
}

export interface SentRequestListItem {
  id: string;
  sourceType: CollaborationSourceType;
  sourceId: string;
  sourceTitle: string | null;
  status: string;
  message: string | null;
  createdAt: string;
  respondedAt: string | null;
  toUser: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
  } | null;
  toContact?: {
    id: string;
    fullName: string;
    company: string | null;
    jobTitle: string | null;
    avatarUrl: string | null;
  } | null;
  session?: {
    id: string;
    status: string;
    matchCount: number;
    progress: number;
  } | null;
  completedIntroductionsCount: number;
  introductionsSummary: IntroductionsSummaryOutput;
}

export interface ListSentRequestsOutput {
  requests: SentRequestListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class ListSentRequestsUseCase {
  constructor(private readonly requestRepository: ICollaborationRequestRepository) {}

  async execute(userId: string, input: ListSentRequestsInput): Promise<ListSentRequestsOutput> {
    const page = input.page || 1;
    const limit = Math.min(input.limit || 20, 100);

    const { requests, total } = await this.requestRepository.findSentByUserId({
      userId,
      role: 'sender',
      status: input.status,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      page,
      limit,
    });

    return {
      requests: requests.map((r) => ({
        id: r.id,
        sourceType: r.sourceType,
        sourceId: r.sourceId,
        sourceTitle: r.sourceTitle || null,
        status: r.status,
        message: r.message,
        createdAt: r.createdAt.toISOString(),
        respondedAt: r.respondedAt?.toISOString() || null,
        toUser: r.toUser,
        toContact: r.toContact || null,
        session: r.session || null,
        completedIntroductionsCount: r.completedIntroductionsCount,
        introductionsSummary: r.introductionsSummary,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
