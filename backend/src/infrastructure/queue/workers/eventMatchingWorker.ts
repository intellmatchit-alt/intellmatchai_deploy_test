/**
 * Event Matching Worker
 *
 * Background worker for event attendee matching.
 * Processes matching asynchronously so attendee join doesn't block.
 *
 * @module infrastructure/queue/workers/eventMatchingWorker
 */

import { Job } from 'bullmq';
import { logger } from '../../../shared/logger/index.js';
import { queueService, QueueName, EventMatchingJobData } from '../QueueService.js';
import { eventMatchingService } from '../../services/event/EventMatchingService.js';
import { prisma } from '../../database/prisma/client.js';

const MIN_EVENT_MATCH_SCORE = 10;

interface EventMatchingWorkerResult {
  eventId: string;
  attendeeId: string;
  matchCount: number;
  status: 'completed' | 'failed';
  error?: string;
}

/**
 * Build an EventAttendeeProfile from guest attendee form data
 */
function buildGuestProfile(guest: {
  id: string;
  name: string;
  bio: string | null;
  lookingFor: string | null;
  company: string | null;
  role: string | null;
}): import('../../services/event/EventMatchingService.js').EventAttendeeProfile {
  // Infer goals from lookingFor text
  const goals: Array<{ goalType: string }> = [];
  if (guest.lookingFor) {
    const lf = guest.lookingFor.toLowerCase();
    if (lf.includes('hire') || lf.includes('recruit') || lf.includes('talent')) goals.push({ goalType: 'HIRING' });
    if (lf.includes('job') || lf.includes('career') || lf.includes('position') || lf.includes('opportunity')) goals.push({ goalType: 'JOB_SEEKING' });
    if (lf.includes('invest') || lf.includes('fund')) goals.push({ goalType: 'INVESTMENT' });
    if (lf.includes('partner') || lf.includes('collaborat')) goals.push({ goalType: 'PARTNERSHIP' });
    if (lf.includes('mentor') || lf.includes('advis')) goals.push({ goalType: 'MENTORSHIP' });
    if (lf.includes('learn') || lf.includes('training')) goals.push({ goalType: 'LEARNING' });
    if (lf.includes('sell') || lf.includes('client') || lf.includes('customer')) goals.push({ goalType: 'SALES' });
    if (goals.length === 0) goals.push({ goalType: 'COLLABORATION' });
  }

  return {
    id: guest.id,
    jobTitle: guest.role || undefined,
    userGoals: goals,
    userSectors: [],
    userSkills: [],
    userInterests: [],
    userHobbies: [],
  };
}

/**
 * Process event matching job
 */
async function processEventMatchingJob(
  job: Job<EventMatchingJobData>
): Promise<EventMatchingWorkerResult> {
  const { eventId, attendeeId, userId } = job.data;

  logger.info('Processing event matching job', {
    jobId: job.id,
    eventId,
    attendeeId,
    userId,
  });

  try {
    // Get all other attendees in this event (both users and guests)
    const otherAttendees = await prisma.eventAttendee.findMany({
      where: {
        eventId,
        id: { not: attendeeId },
      },
      select: { id: true, userId: true, name: true, bio: true, lookingFor: true, company: true, role: true },
    });

    if (otherAttendees.length === 0) {
      logger.info('No other attendees to match against', { eventId, attendeeId });
      return { eventId, attendeeId, matchCount: 0, status: 'completed' };
    }

    // Separate user-based and guest attendees among "other" attendees
    const userAttendees = otherAttendees.filter(a => a.userId);
    const guestAttendees = otherAttendees.filter(a => !a.userId);

    // Fetch user profiles for user-based attendees (and the new attendee if they have a userId)
    const allUserIds = [...(userId ? [userId] : []), ...userAttendees.map(a => a.userId!).filter(Boolean)];
    const userProfiles = allUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: allUserIds } },
          include: {
            userGoals: true,
            userSectors: { include: { sector: true } },
            userSkills: { include: { skill: true } },
            userInterests: { include: { interest: true } },
            userHobbies: { include: { hobby: true } },
          },
        })
      : [];

    const profileMap = new Map(userProfiles.map(u => [u.id, u]));

    // Build the new attendee's profile - either from user data or guest form data
    let newAttendeeProfile: import('../../services/event/EventMatchingService.js').EventAttendeeProfile | null = null;
    if (userId) {
      newAttendeeProfile = profileMap.get(userId) || null;
      if (!newAttendeeProfile) {
        logger.warn('User profile not found for matching', { userId });
        return { eventId, attendeeId, matchCount: 0, status: 'completed' };
      }
    } else {
      // New attendee is a guest - fetch their form data
      const guestData = await prisma.eventAttendee.findUnique({
        where: { id: attendeeId },
        select: { id: true, name: true, bio: true, lookingFor: true, company: true, role: true },
      });
      if (guestData) {
        newAttendeeProfile = buildGuestProfile(guestData);
      }
    }

    if (!newAttendeeProfile) {
      logger.warn('Could not build profile for attendee', { attendeeId, userId });
      return { eventId, attendeeId, matchCount: 0, status: 'completed' };
    }

    const matchesToCreate: any[] = [];

    // Match against user-based attendees
    for (const other of userAttendees) {
      if (!other.userId) continue;
      const otherProfile = profileMap.get(other.userId);
      if (!otherProfile) continue;

      const { score, level, reasons } = eventMatchingService.calculateMatchScore(
        newAttendeeProfile,
        otherProfile
      );

      if (score < MIN_EVENT_MATCH_SCORE) continue;

      matchesToCreate.push({
        attendeeId,
        matchedAttendeeId: other.id,
        matchLevel: level,
        score,
        reasons: JSON.stringify(reasons),
      });

      matchesToCreate.push({
        attendeeId: other.id,
        matchedAttendeeId: attendeeId,
        matchLevel: level,
        score,
        reasons: JSON.stringify(reasons),
      });
    }

    // Match against guest attendees (adapt form data to profile format)
    for (const guest of guestAttendees) {
      const guestProfile = buildGuestProfile(guest);

      const { score, level, reasons } = eventMatchingService.calculateMatchScore(
        newAttendeeProfile,
        guestProfile
      );

      if (score < MIN_EVENT_MATCH_SCORE) continue;

      matchesToCreate.push({
        attendeeId,
        matchedAttendeeId: guest.id,
        matchLevel: level,
        score,
        reasons: JSON.stringify(reasons),
      });

      matchesToCreate.push({
        attendeeId: guest.id,
        matchedAttendeeId: attendeeId,
        matchLevel: level,
        score,
        reasons: JSON.stringify(reasons),
      });
    }

    if (matchesToCreate.length > 0) {
      await prisma.eventAttendeeMatch.createMany({
        data: matchesToCreate,
        skipDuplicates: true,
      });
    }

    const matchCount = matchesToCreate.length;

    logger.info('Event matching job completed', {
      jobId: job.id,
      eventId,
      attendeeId,
      matchCount,
    });

    return { eventId, attendeeId, matchCount, status: 'completed' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Event matching job failed', {
      jobId: job.id,
      eventId,
      attendeeId,
      error: errorMessage,
    });

    throw error;
  }
}

/**
 * Start event matching worker
 */
export function startEventMatchingWorker(): void {
  queueService.registerWorker<EventMatchingJobData, EventMatchingWorkerResult>(
    QueueName.EVENT_MATCHING,
    processEventMatchingJob,
    {
      concurrency: 5,
      limiter: {
        max: 20,
        duration: 60000,
      },
    }
  );

  logger.info('Event matching worker started');
}

export default startEventMatchingWorker;
