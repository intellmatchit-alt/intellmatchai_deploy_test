/**
 * Use Case: List Received Collaboration Requests
 * Lists requests received by the collaborator (inbox view)
 */

import { ICollaborationRequestRepository } from '../../../domain/repositories/ICollaborationRepository';
import {
  CollaborationRequestStatus,
  CollaborationSourceType,
  CollaborationCriteria,
  getSourceId,
} from '../../../domain/entities/Collaboration';

export interface ListReceivedRequestsInput {
  status?: CollaborationRequestStatus;
  sourceType?: CollaborationSourceType;
  page?: number;
  limit?: number;
}

export interface ReceivedRequestListItem {
  id: string;
  sourceType: CollaborationSourceType;
  sourceId: string;
  status: string;
  message: string | null;
  createdAt: string;
  respondedAt: string | null;
  sourceFeature: {
    id: string;
    type: CollaborationSourceType;
    title: string;
    description: string | null;
    criteria: CollaborationCriteria | null;
  };
  fromUser: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
  };
  session: {
    id: string;
    status: string;
    progress: number;
    matchCount: number;
  } | null;
  previousCollaborationsCount: number;
}

export interface ListReceivedRequestsOutput {
  requests: ReceivedRequestListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class ListReceivedRequestsUseCase {
  constructor(private readonly requestRepository: ICollaborationRequestRepository) {}

  async execute(
    userId: string,
    input: ListReceivedRequestsInput
  ): Promise<ListReceivedRequestsOutput> {
    const page = input.page || 1;
    const limit = Math.min(input.limit || 20, 100);

    const { requests, total } = await this.requestRepository.findReceivedByUserId({
      userId,
      role: 'receiver',
      status: input.status,
      sourceType: input.sourceType,
      page,
      limit,
    });

    return {
      requests: requests.map((r) => ({
        id: r.id,
        sourceType: r.sourceType,
        sourceId: getSourceId(r),
        status: r.status,
        message: r.message,
        createdAt: r.createdAt.toISOString(),
        respondedAt: r.respondedAt?.toISOString() || null,
        sourceFeature: {
          id: r.sourceFeature.id,
          type: r.sourceFeature.type,
          title: r.sourceFeature.title,
          description: r.sourceFeature.description,
          criteria: r.sourceFeature.criteria,
        },
        fromUser: r.fromUser,
        session: r.session
          ? {
              id: r.session.id,
              status: r.session.status,
              progress: r.session.progress,
              matchCount: r.session.matchCount,
            }
          : null,
        previousCollaborationsCount: r.previousCollaborationsCount,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
