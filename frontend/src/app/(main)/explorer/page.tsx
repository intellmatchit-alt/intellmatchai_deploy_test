/**
 * Explorer Page
 *
 * AI-powered profile research tool with clean, modern UI.
 * Users can input a person's name and social links to get
 * profile information, conversation starters, and more.
 * Includes archive functionality to save and view past searches.
 * Supports image upload for business card scanning.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useI18n } from '@/lib/i18n';
import { toast } from '@/components/ui/Toast';
import {
  Search24Regular,
  Person24Regular,
  Sparkle24Regular,
  Copy24Regular,
  Checkmark24Regular,
  ArrowClockwise24Regular,
  ChevronDown24Regular,
  ChevronUp24Regular,
  Chat24Regular,
  Lightbulb24Regular,
  People24Regular,
  Globe24Regular,
  Briefcase24Regular,
  Archive24Regular,
  Delete24Regular,
  ArrowLeft24Regular,
  Link24Regular,
  Video24Regular,
  Camera24Regular,
  Image24Regular,
  Dismiss24Regular,
  DocumentSearch24Regular,
  Location24Regular,
} from '@fluentui/react-icons';
import type { DiscoveredProfile } from '@/app/api/explorer/discover/route';

// Social media platform icons
const LinkedInIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

const XIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const YouTubeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

const FacebookIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
  </svg>
);

interface SocialMediaAccount {
  platform: string;
  url: string;
  username?: string;
  followers?: string;
}

interface ProfilePosition {
  title?: string;
  company?: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  description?: string;
  companyLogo?: string;
  location?: string;
}

interface LinkedInPost {
  text?: string;
  reactionsCount?: number;
  commentsCount?: number;
  activityDate?: string;
  activityUrl?: string;
}

interface ProfileData {
  name: string;
  summary: string;
  professionalBackground: string;
  sectors: string[];
  skills: string[];
  interests: string[];
  iceBreakers: string[];
  commonGround: string[];
  approachTips: string;
  sources?: string[];
  socialMedia?: SocialMediaAccount[];
  company?: string;
  jobTitle?: string;
  location?: string;
  photoUrl?: string;
  positions?: ProfilePosition[];
  latestActivity?: string;
  latestPostDate?: string;
  posts?: LinkedInPost[];
}

interface ArchivedSearch {
  id: string;
  timestamp: number;
  query: {
    name?: string; // legacy
    firstName?: string;
    lastName?: string;
    company?: string;
    linkedIn?: string;
    twitter?: string;
    website?: string;
    additionalInfo?: string;
  };
  profileData: ProfileData;
  searchEngine: string;
}

interface SearchResponse {
  profileData: ProfileData | null;
  searchEngine?: string;
  warning?: string;
}

interface MatchBreakdown {
  sectorScore: number;
  skillScore: number;
  goalAlignmentScore: number;
  complementarySkillsScore: number;
  locationScore: number;
  experienceScore: number;
}

interface MatchIntersection {
  type: string;
  label: string;
}

interface MatchData {
  score: number;
  breakdown: MatchBreakdown;
  intersections: MatchIntersection[];
  reasons: string[];
}

const ARCHIVE_KEY = 'explorer_archive';

export default function ExplorerPage() {
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [searchEngine, setSearchEngine] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [archive, setArchive] = useState<ArchivedSearch[]>([]);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [company, setCompany] = useState('');
  const [locationFilter, setLocationFilter] = useState(''); // Country/city to narrow search
  const [keywordTags, setKeywordTags] = useState<string[]>([]); // Credentials/qualifications as tags
  const [keywordInput, setKeywordInput] = useState(''); // Current input for adding new tag
  const [linkedIn, setLinkedIn] = useState('');
  const [twitter, setTwitter] = useState('');
  const [website, setWebsite] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');

  // Discovery state
  const [discoveredProfiles, setDiscoveredProfiles] = useState<DiscoveredProfile[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<DiscoveredProfile | null>(null);
  const [flowStep, setFlowStep] = useState<'form' | 'selecting' | 'researching' | 'results'>('form');
  const [manualLinkedInUrl, setManualLinkedInUrl] = useState('');

  // Match state
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [isCalculatingMatch, setIsCalculatingMatch] = useState(false);

  // Image upload state
  const [uploadedImages, setUploadedImages] = useState<{ file: File; preview: string; extractedData?: any }[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Load archive from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(ARCHIVE_KEY);
    if (stored) {
      try {
        setArchive(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse archive:', e);
      }
    }
  }, []);

  // Save archive to localStorage
  const saveToArchive = (data: ProfileData, query: any, engine: string) => {
    const newEntry: ArchivedSearch = {
      id: `search_${Date.now()}`,
      timestamp: Date.now(),
      query,
      profileData: data,
      searchEngine: engine,
    };
    const updated = [newEntry, ...archive].slice(0, 50); // Keep last 50
    setArchive(updated);
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(updated));
    toast({
      title: t.explorer?.savedToArchive || 'Saved to Archive',
      description: t.explorer?.searchArchived || 'Search result has been archived',
      variant: 'success',
    });
  };

  const removeFromArchive = (id: string) => {
    const updated = archive.filter(a => a.id !== id);
    setArchive(updated);
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(updated));
    toast({
      title: t.explorer?.removed || 'Removed',
      description: t.explorer?.searchRemoved || 'Search removed from archive',
      variant: 'info',
    });
  };

  const loadFromArchive = (entry: ArchivedSearch) => {
    setProfileData(entry.profileData);
    // Support old archive format (single 'name') and new format (firstName/lastName)
    if (entry.query.firstName) {
      setFirstName(entry.query.firstName);
      setLastName(entry.query.lastName || '');
    } else {
      const parts = (entry.query.name || '').split(' ');
      setFirstName(parts[0] || '');
      setLastName(parts.slice(1).join(' ') || '');
    }
    setCompany(entry.query.company || '');
    setLinkedIn(entry.query.linkedIn || '');
    setTwitter(entry.query.twitter || '');
    setWebsite(entry.query.website || '');
    setAdditionalInfo(entry.query.additionalInfo || '');
    setSearchEngine(entry.searchEngine);
    setFlowStep('results');
    setShowArchive(false);
  };

  // Image upload handlers
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newImages: { file: File; preview: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) {
        toast({ title: 'Error', description: `${file.name} is not an image`, variant: 'error' });
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: 'Error', description: `${file.name} is too large (max 10MB)`, variant: 'error' });
        continue;
      }
      const preview = URL.createObjectURL(file);
      newImages.push({ file, preview });
    }

    if (newImages.length > 0) {
      setUploadedImages(prev => [...prev, ...newImages]);
      toast({ title: 'Images Added', description: `${newImages.length} image(s) ready to scan`, variant: 'success' });
    }

    // Reset input
    if (e.target) e.target.value = '';
  };

  const removeImage = (index: number) => {
    setUploadedImages(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  const scanAndSearch = async () => {
    if (uploadedImages.length === 0) {
      toast({ title: 'Error', description: 'Please upload at least one image', variant: 'error' });
      return;
    }

    setIsScanning(true);
    setScanProgress(0);

    try {
      // Convert all images to base64
      setScanProgress(10);
      const imageData: { base64: string; mimeType: string }[] = [];

      for (const img of uploadedImages) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]); // Remove data:image/...;base64, prefix
          };
          reader.readAsDataURL(img.file);
        });
        imageData.push({ base64, mimeType: img.file.type });
      }

      setScanProgress(30);

      // Call the GPT-4o vision scan API
      const response = await fetch('/api/explorer/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: imageData }),
      });

      setScanProgress(70);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Scan failed');
      }

      const data = await response.json();

      if (!data.success) {
        toast({
          title: 'Scan Failed',
          description: data.error || 'Could not extract data from images',
          variant: 'error'
        });
        return;
      }

      const extracted = data.extractedData;
      console.log('GPT-4o extracted:', extracted);

      // Update images with extracted data
      setUploadedImages(prev => prev.map(img => ({ ...img, extractedData: extracted })));

      setScanProgress(80);

      if (extracted?.name) {
        toast({
          title: 'Scan Complete',
          description: `Found: ${extracted.name}${extracted.company ? ` at ${extracted.company}` : ''}`,
          variant: 'success'
        });

        // Set form fields from OCR
        const nameParts = (extracted.name || '').trim().split(/\s+/);
        setFirstName(nameParts[0] || '');
        setLastName(nameParts.slice(1).join(' ') || '');
        if (extracted.company) setCompany(extracted.company);
        if (extracted.linkedInUrl) setLinkedIn(extracted.linkedInUrl);
        if (extracted.twitterUrl) setTwitter(extracted.twitterUrl);
        if (extracted.website) setWebsite(extracted.website);
      }

      setScanProgress(90);

      if (extracted?.name) {
        setScanProgress(95);
        const extractedName = extracted.name;
        const scanNameParts = extractedName.trim().split(/\s+/);

        // If LinkedIn URL found on card, use it directly — skip online search
        if (extracted.linkedInUrl) {
          toast({
            title: 'LinkedIn Found',
            description: 'LinkedIn URL detected on card, loading profile directly...',
            variant: 'info'
          });
          try {
            const discoverResponse = await fetch('/api/explorer/discover', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ linkedInUrl: extracted.linkedInUrl }),
            });

            const discoverData = await discoverResponse.json();

            if (discoverData.profiles && discoverData.profiles.length > 0) {
              setIsScanning(false);
              setScanProgress(0);
              setSelectedProfile(discoverData.profiles[0]);
              runFullResearch(discoverData.profiles[0], extractedName);
              return;
            }
          } catch (err) {
            console.error('[Explorer] Direct LinkedIn scrape failed:', err);
          }
          // LinkedIn scrape failed — fall back to AI-only with extracted info
          setIsScanning(false);
          setScanProgress(0);
          runFullResearch(null, extractedName);
          return;
        }

        // No LinkedIn URL on card — search by name/company
        try {
          const discoverResponse = await fetch('/api/explorer/discover', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              firstName: scanNameParts[0] || '',
              lastName: scanNameParts.slice(1).join(' ') || undefined,
              company: extracted.company || undefined,
            }),
          });

          const discoverData = await discoverResponse.json();

          if (discoverData.profiles && discoverData.profiles.length > 0) {
            if (discoverData.profiles.length === 1) {
              setIsScanning(false);
              setScanProgress(0);
              setSelectedProfile(discoverData.profiles[0]);
              runFullResearch(discoverData.profiles[0], extractedName);
              return;
            }
            setDiscoveredProfiles(discoverData.profiles);
            setFlowStep('selecting');
            setIsScanning(false);
            setScanProgress(0);
            return;
          }
        } catch (err) {
          console.error('[Explorer] Discovery after scan failed:', err);
        }

        // No LinkedIn profiles found — fall back to AI-only
        setIsScanning(false);
        setScanProgress(0);
        runFullResearch(null, extractedName);
      } else {
        toast({
          title: 'No Name Found',
          description: 'Could not extract name from images. Please enter manually.',
          variant: 'warning'
        });
      }
    } catch (error: any) {
      console.error('Scan error:', error);
      toast({ title: 'Scan Failed', description: error.message || 'Failed to scan images', variant: 'error' });
    } finally {
      setIsScanning(false);
      setScanProgress(0);
    }
  };

  // Calculate compatibility match between user and discovered profile
  const calculateCompatibility = async (selected: DiscoveredProfile | null, resultData: ProfileData | null) => {
    if (!selected && !resultData) return;

    setIsCalculatingMatch(true);
    try {
      const accessToken = typeof window !== 'undefined' ? localStorage.getItem('p2p_access_token') : null;
      if (!accessToken) return;

      const matchPayload = {
        firstName: selected?.firstName || resultData?.name?.split(' ')[0],
        lastName: selected?.lastName || resultData?.name?.split(' ').slice(1).join(' '),
        headline: selected?.headline || resultData?.summary,
        currentCompany: selected?.currentCompany || resultData?.company,
        currentTitle: selected?.currentTitle || resultData?.jobTitle,
        location: selected?.location || resultData?.location,
        skills: selected?.skills || resultData?.skills || [],
        summary: selected?.summary || resultData?.summary,
        sectors: resultData?.sectors || [],
        positions: selected?.positions || resultData?.positions || [],
        education: selected?.education || [],
      };

      const response = await fetch('/api/explorer/match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(matchPayload),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.match) {
          setMatchData(data.match);
        }
      }
    } catch (err) {
      console.error('[Explorer] Match calculation failed:', err);
    } finally {
      setIsCalculatingMatch(false);
    }
  };

  const runFullResearch = async (selected?: DiscoveredProfile | null, nameOverride?: string) => {
    setIsLoading(true);
    setProfileData(null);
    setSearchEngine(null);
    setWarning(null);
    setMatchData(null);
    setFlowStep('researching');

    const researchName = nameOverride || `${firstName.trim()} ${lastName.trim()}`.trim();

    try {
      const scrapInData = selected ? {
        photoUrl: selected.photoUrl,
        company: selected.currentCompany,
        jobTitle: selected.currentTitle,
        location: selected.location,
        headline: selected.headline,
        linkedInUrl: selected.linkedInUrl,
        summary: selected.summary,
        positions: selected.positions,
        skills: selected.skills,
        education: selected.education,
      } : undefined;

      const response = await fetch('/api/explorer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: researchName,
          linkedIn: selected?.linkedInUrl || linkedIn.trim() || undefined,
          twitter: twitter.trim() || undefined,
          website: website.trim() || undefined,
          additionalInfo: company.trim() ? `Company: ${company.trim()}` : (additionalInfo.trim() || undefined),
          scrapInData,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze profile');
      }

      const data: SearchResponse = await response.json();
      setProfileData(data.profileData);
      setSearchEngine(data.searchEngine || null);
      setWarning(data.warning || null);
      setFlowStep('results');

      // Calculate compatibility in background
      calculateCompatibility(selected || null, data.profileData);
    } catch (error: any) {
      console.error('Explorer error:', error);
      toast({
        title: t.common?.error || 'Error',
        description: error.message || 'Failed to analyze profile',
        variant: 'error',
      });
      setFlowStep('form');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfileSelect = async (profile: DiscoveredProfile) => {
    setSelectedProfile(profile);

    // If this is a lightweight profile (from person search), scrape full data first
    if (!profile.positions && !profile.skills && profile.linkedInUrl) {
      setIsLoading(true);
      setFlowStep('researching');
      try {
        const scrapeResponse = await fetch('/api/explorer/discover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ linkedInUrl: profile.linkedInUrl }),
        });
        const scrapeData = await scrapeResponse.json();
        if (scrapeData.profiles && scrapeData.profiles.length > 0) {
          const fullProfile = scrapeData.profiles[0];
          setSelectedProfile(fullProfile);
          runFullResearch(fullProfile);
          return;
        }
      } catch (err) {
        console.error('[Explorer] Full scrape failed, using lightweight profile:', err);
      }
      setIsLoading(false);
    }

    runFullResearch(profile);
  };

  const handleSkipDiscovery = () => {
    setSelectedProfile(null);
    runFullResearch(null);
  };

  const handleManualLinkedInUrl = async () => {
    const url = manualLinkedInUrl.trim();
    if (!url || !url.includes('linkedin.com/in/')) {
      toast({ title: 'Invalid URL', description: 'Please enter a valid LinkedIn profile URL', variant: 'error' });
      return;
    }
    setIsLoading(true);
    setFlowStep('researching');
    try {
      const scrapeResponse = await fetch('/api/explorer/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkedInUrl: url }),
      });
      const scrapeData = await scrapeResponse.json();
      if (scrapeData.profiles && scrapeData.profiles.length > 0) {
        const fullProfile = scrapeData.profiles[0];
        setSelectedProfile(fullProfile);
        setManualLinkedInUrl('');
        runFullResearch(fullProfile);
        return;
      }
      toast({ title: 'Scrape Failed', description: 'Could not fetch profile from that URL', variant: 'error' });
      setFlowStep('selecting');
    } catch (err) {
      console.error('[Explorer] Manual URL scrape failed:', err);
      toast({ title: 'Error', description: 'Failed to fetch LinkedIn profile', variant: 'error' });
      setFlowStep('selecting');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName.trim()) {
      toast({
        title: t.common?.error || 'Error',
        description: t.explorer?.firstNameRequired || 'Please enter a first name',
        variant: 'error',
      });
      return;
    }

    // Try discovery — works with or without LinkedIn URL
    setIsDiscovering(true);
    setDiscoveredProfiles([]);
    setSelectedProfile(null);
    setProfileData(null);

    try {
      const response = await fetch('/api/explorer/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim() || undefined,
          company: company.trim() || undefined,
          location: locationFilter.trim() || undefined,
          keywords: keywordTags.length > 0 ? keywordTags.join(' ') : undefined,
          linkedInUrl: linkedIn.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (data.profiles && data.profiles.length > 0) {
        // If only 1 profile (e.g. direct URL scrape), auto-select it
        if (data.profiles.length === 1) {
          setIsDiscovering(false);
          setSelectedProfile(data.profiles[0]);
          runFullResearch(data.profiles[0]);
          return;
        }
        setDiscoveredProfiles(data.profiles);
        setFlowStep('selecting');
        setIsDiscovering(false);
        return;
      }

      if (data.error && data.error !== 'no_profiles_found') {
        console.log('[Explorer] Discovery issue:', data.error);
      }
    } catch (error) {
      console.error('[Explorer] Discovery failed:', error);
    }

    // Fall back to AI-only research
    setIsDiscovering(false);
    toast({
      title: t.explorer?.discoveryFailed || 'No LinkedIn profiles found',
      description: 'Searching with AI...',
      variant: 'info',
    });
    runFullResearch(null);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast({
      title: 'Copied!',
      description: 'Text copied to clipboard',
      variant: 'success',
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const resetSearch = () => {
    setProfileData(null);
    setFirstName('');
    setLastName('');
    setCompany('');
    setLocationFilter('');
    setKeywordTags([]);
    setKeywordInput('');
    setLinkedIn('');
    setTwitter('');
    setWebsite('');
    setAdditionalInfo('');
    setShowAdvanced(false);
    setSearchEngine(null);
    setWarning(null);
    setDiscoveredProfiles([]);
    setSelectedProfile(null);
    setFlowStep('form');
    setIsDiscovering(false);
    setManualLinkedInUrl('');
    setMatchData(null);
    // Clear uploaded images
    uploadedImages.forEach(img => URL.revokeObjectURL(img.preview));
    setUploadedImages([]);
  };

  const getPlatformIcon = (platform: string) => {
    const p = platform.toLowerCase();
    if (p.includes('linkedin')) return <LinkedInIcon className="w-4 h-4" />;
    if (p.includes('twitter') || p.includes('x')) return <XIcon className="w-4 h-4" />;
    if (p.includes('youtube')) return <YouTubeIcon className="w-4 h-4" />;
    if (p.includes('instagram')) return <InstagramIcon className="w-4 h-4" />;
    if (p.includes('facebook')) return <FacebookIcon className="w-4 h-4" />;
    if (p.includes('tiktok')) return <TikTokIcon className="w-4 h-4" />;
    if (p.includes('website')) return <Globe24Regular className="w-4 h-4" />;
    return <Link24Regular className="w-4 h-4" />;
  };

  const getPlatformColor = (platform: string) => {
    const p = platform.toLowerCase();
    if (p.includes('linkedin')) return 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20';
    if (p.includes('twitter') || p.includes('x')) return 'bg-white/[0.03]0/10 text-th-text-s border-neutral-500/20 hover:bg-white/[0.03]0/20';
    if (p.includes('youtube')) return 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20';
    if (p.includes('instagram')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20';
    if (p.includes('facebook')) return 'bg-blue-600/10 text-blue-400 border-blue-600/20 hover:bg-blue-600/20';
    if (p.includes('tiktok')) return 'bg-white/[0.03]0/10 text-th-text-s border-neutral-500/20 hover:bg-white/[0.03]0/20';
    return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20';
  };

  // Archive View
  if (showArchive) {
    return (
      <div className="max-w-4xl mx-auto pb-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => setShowArchive(false)}
            className="p-2 hover:bg-th-surface-h rounded-lg transition-colors"
          >
            <ArrowLeft24Regular className="w-5 h-5 text-th-text-t" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-th-text">{t.explorer?.archivedSearches || 'Archived Searches'}</h1>
            <p className="text-th-text-t text-sm">{archive.length} {t.explorer?.savedSearches || 'saved searches'}</p>
          </div>
        </div>

        {archive.length === 0 ? (
          <div className="text-center py-16 bg-th-surface border border-th-border rounded-2xl">
            <Archive24Regular className="w-12 h-12 text-th-text-m mx-auto mb-4" />
            <p className="text-th-text-t">{t.explorer?.noArchivedSearches || 'No archived searches yet'}</p>
            <p className="text-th-text-m text-sm mt-1">{t.explorer?.savedSearchesAppear || 'Your saved searches will appear here'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {archive.map((entry) => (
              <div
                key={entry.id}
                className="bg-th-surface border border-th-border rounded-xl p-4 hover:bg-th-surface-h transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <button
                    onClick={() => loadFromArchive(entry)}
                    className="flex-1 text-start"
                  >
                    <h3 className="font-semibold text-th-text">{entry.profileData.name}</h3>
                    {entry.profileData.jobTitle && entry.profileData.company && (
                      <p className="text-sm text-th-text-t">
                        {entry.profileData.jobTitle} at {entry.profileData.company}
                      </p>
                    )}
                    <p className="text-xs text-th-text-m mt-1">
                      {new Date(entry.timestamp).toLocaleDateString()} • {entry.searchEngine}
                    </p>
                  </button>
                  <button
                    onClick={() => removeFromArchive(entry.id)}
                    className="p-2 hover:bg-red-500/20 text-th-text-t hover:text-red-400 rounded-lg transition-colors flex-shrink-0"
                  >
                    <Delete24Regular className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="text-center flex-1">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/20 border border-emerald-500/20">
            <Sparkle24Regular className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-th-text mb-2">
            {t.bottomNav?.explorer || 'Profile Explorer'}
          </h1>
          <p className="text-th-text-t">
            {t.explorer?.subtitle || 'Get AI-powered insights about anyone before you connect'}
          </p>
        </div>
        <button
          onClick={() => setShowArchive(true)}
          className="absolute top-4 end-4 p-2.5 bg-th-surface hover:bg-th-surface-h border border-th-border rounded-xl transition-all flex items-center gap-2"
          title="View Archive"
        >
          <Archive24Regular className="w-5 h-5 text-th-text-t" />
          {archive.length > 0 && (
            <span className="text-xs text-th-text-t">{archive.length}</span>
          )}
        </button>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-2xl p-6">
          {/* Image Upload Section */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Camera24Regular className="w-5 h-5 text-emerald-400" />
              <span className="text-sm font-medium text-th-text">{t.explorer?.scanBusinessCards || 'Scan Business Cards'}</span>
              <span className="text-xs text-th-text-m">{t.explorer?.optional || '(Optional)'}</span>
            </div>

            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageSelect}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture
              onChange={handleImageSelect}
              className="hidden"
            />

            {/* Upload buttons */}
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={isScanning || isLoading}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-emerald-500/20 to-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-300 hover:bg-emerald-500/30 transition-all disabled:opacity-50"
              >
                <Camera24Regular className="w-5 h-5" />
                <span>{t.explorer?.camera || 'Camera'}</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanning || isLoading}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-th-surface border border-th-border rounded-xl text-th-text-s hover:bg-th-surface-h transition-all disabled:opacity-50"
              >
                <Image24Regular className="w-5 h-5" />
                <span>{t.explorer?.uploadImages || 'Upload Images'}</span>
              </button>
            </div>

            {/* Uploaded images preview */}
            {uploadedImages.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {uploadedImages.map((img, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={img.preview}
                        alt={`Card ${index + 1}`}
                        className="w-20 h-20 object-cover rounded-lg border border-white/20"
                      />
                      {img.extractedData && (
                        <div className="absolute -top-1 -end-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                          <Checkmark24Regular className="w-3 h-3 text-th-text" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute -top-2 -end-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Dismiss24Regular className="w-4 h-4 text-th-text" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Scan button */}
                <button
                  type="button"
                  onClick={scanAndSearch}
                  disabled={isScanning || isLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-green-500/25 transition-all disabled:opacity-50"
                >
                  {isScanning ? (
                    <>
                      <ArrowClockwise24Regular className="w-5 h-5 animate-spin" />
                      <span>Scanning... {scanProgress}%</span>
                    </>
                  ) : (
                    <>
                      <DocumentSearch24Regular className="w-5 h-5" />
                      <span>Scan & Search ({uploadedImages.length} image{uploadedImages.length > 1 ? 's' : ''})</span>
                    </>
                  )}
                </button>

                {/* Progress bar */}
                {isScanning && (
                  <div className="w-full h-2 bg-th-surface-h rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-300"
                      style={{ width: `${scanProgress}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-th-surface-h" />
            <span className="text-xs text-th-text-m">{t.explorer?.orEnterManually || 'OR ENTER MANUALLY'}</span>
            <div className="flex-1 h-px bg-th-surface-h" />
          </div>

          {/* Name & Company Fields */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="relative">
              <Person24Regular className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-th-text-t" />
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder={t.explorer?.firstNamePlaceholder || 'First Name'}
                className="w-full ps-11 pe-3 py-3.5 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                disabled={isLoading || isScanning}
                autoFocus
              />
            </div>
            <div className="relative">
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder={t.explorer?.lastNamePlaceholder || 'Last Name'}
                className="w-full px-4 py-3.5 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                disabled={isLoading || isScanning}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="relative">
              <Briefcase24Regular className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-th-text-t" />
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder={t.explorer?.companyPlaceholder || 'Company (optional)'}
                className="w-full ps-11 pe-3 py-3.5 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                disabled={isLoading || isScanning}
              />
            </div>
            <div className="relative">
              <Location24Regular className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-th-text-t" />
              <input
                type="text"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                placeholder={t.explorer?.locationPlaceholder || 'Country/City (optional)'}
                className="w-full ps-11 pe-3 py-3.5 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                disabled={isLoading || isScanning}
              />
            </div>
          </div>
          {/* Keywords/Credentials Tags */}
          <div className="mb-4">
            <div className="flex flex-wrap gap-2 p-3 bg-th-surface border border-th-border rounded-xl min-h-[52px]">
              <Sparkle24Regular className="w-5 h-5 text-th-text-t flex-shrink-0 mt-0.5" />
              {keywordTags.map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-full text-sm"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => setKeywordTags(keywordTags.filter((_, i) => i !== index))}
                    className="hover:text-th-text transition-colors"
                    disabled={isLoading || isScanning}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    const tag = keywordInput.trim().replace(/,/g, '');
                    if (tag && !keywordTags.includes(tag)) {
                      setKeywordTags([...keywordTags, tag]);
                      setKeywordInput('');
                    }
                  } else if (e.key === 'Backspace' && !keywordInput && keywordTags.length > 0) {
                    setKeywordTags(keywordTags.slice(0, -1));
                  }
                }}
                placeholder={keywordTags.length === 0 ? (t.explorer?.keywordsPlaceholder || 'Add credentials (PhD, Professor...)') : t.explorer?.addMore || 'Add more...'}
                className="flex-1 min-w-[120px] bg-transparent text-th-text placeholder-th-text-m focus:outline-none text-sm"
                disabled={isLoading || isScanning}
              />
            </div>
            <p className="text-xs text-th-text-m mt-1.5 ms-1">
              {t.explorer?.keywordsHint || 'Press Enter to add. Helps find profiles with credentials in their name.'}
            </p>
          </div>

          {/* Toggle Advanced Options */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-th-text-t hover:text-th-text transition-colors mb-4"
          >
            {showAdvanced ? (
              <ChevronUp24Regular className="w-4 h-4" />
            ) : (
              <ChevronDown24Regular className="w-4 h-4" />
            )}
            {showAdvanced ? (t.explorer?.hideSocialLinks || 'Hide social links & context (optional)') : (t.explorer?.addSocialLinks || 'Add social links & context (optional)')}
          </button>

          {/* Advanced Options */}
          {showAdvanced && (
            <div className="space-y-3 mb-4 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* LinkedIn */}
                <div className="relative">
                  <LinkedInIcon className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-th-text-m" />
                  <input
                    type="url"
                    value={linkedIn}
                    onChange={(e) => setLinkedIn(e.target.value)}
                    placeholder={t.explorer?.linkedInPlaceholder || "LinkedIn URL"}
                    className="w-full ps-10 pe-3 py-2.5 bg-th-surface border border-th-border rounded-lg text-th-text text-sm placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    disabled={isLoading}
                  />
                </div>

                {/* Twitter */}
                <div className="relative">
                  <XIcon className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-th-text-m" />
                  <input
                    type="text"
                    value={twitter}
                    onChange={(e) => setTwitter(e.target.value)}
                    placeholder={t.explorer?.twitterPlaceholder || "Twitter/X handle"}
                    className="w-full ps-10 pe-3 py-2.5 bg-th-surface border border-th-border rounded-lg text-th-text text-sm placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    disabled={isLoading}
                  />
                </div>

                {/* Website */}
                <div className="relative">
                  <Globe24Regular className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-th-text-m" />
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder={t.explorer?.websitePlaceholder || "Website URL"}
                    className="w-full ps-10 pe-3 py-2.5 bg-th-surface border border-th-border rounded-lg text-th-text text-sm placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Additional Context */}
              <textarea
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
                placeholder={t.explorer?.additionalPlaceholder || "Additional context (company, how you met, industry, etc.)"}
                rows={2}
                className="w-full px-4 py-2.5 bg-th-surface border border-th-border rounded-lg text-th-text text-sm placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
                disabled={isLoading}
              />
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || isDiscovering || !firstName.trim()}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isDiscovering ? (
              <>
                <ArrowClockwise24Regular className="w-5 h-5 animate-spin" />
                {t.explorer?.discoveringProfiles || 'Discovering LinkedIn profiles...'}
              </>
            ) : isLoading ? (
              <>
                <ArrowClockwise24Regular className="w-5 h-5 animate-spin" />
                {t.explorer?.researching || 'Searching the web...'}
              </>
            ) : (
              <>
                <Search24Regular className="w-5 h-5" />
                {t.explorer?.research || 'Research Profile'}
              </>
            )}
          </button>
        </div>
      </form>

      {/* Profile Selection */}
      {flowStep === 'selecting' && discoveredProfiles.length > 0 && (
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center gap-3 mb-4">
            <LinkedInIcon className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-th-text">{t.explorer?.selectProfile || 'Select the right profile'}</h2>
            <span className="text-sm text-th-text-t">
              {discoveredProfiles.length} {t.explorer?.foundProfiles || 'LinkedIn profiles found'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {discoveredProfiles.map((profile, index) => (
              <button
                key={index}
                onClick={() => handleProfileSelect(profile)}
                className="flex items-start gap-3 p-4 bg-th-surface border border-th-border rounded-xl hover:bg-th-surface-h hover:border-blue-500/30 transition-all text-start group"
              >
                {/* Photo or initials */}
                {profile.photoUrl ? (
                  <img
                    src={profile.photoUrl}
                    alt={`${profile.firstName} ${profile.lastName}`}
                    className="w-12 h-12 rounded-full object-cover flex-shrink-0 border border-white/20"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center flex-shrink-0 text-white font-semibold">
                    {(profile.firstName?.[0] || '').toUpperCase()}{(profile.lastName?.[0] || '').toUpperCase()}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-th-text truncate group-hover:text-blue-300 transition-colors">
                      {profile.firstName} {profile.lastName}
                    </h3>
                    {profile.openToWork && (
                      <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] font-medium rounded-full flex-shrink-0">
                        {t.explorer?.openToWork || 'Open to Work'}
                      </span>
                    )}
                  </div>
                  {/* Title & Company */}
                  {profile.currentTitle && profile.currentCompany && (
                    <p className="text-sm text-th-text-s truncate">
                      {profile.currentTitle} at {profile.currentCompany}
                    </p>
                  )}
                  {/* Headline - show if different from title/company combo or if no title */}
                  {profile.headline && (
                    (!profile.currentTitle || !profile.headline.includes(profile.currentTitle)) && (
                      <p className="text-xs text-th-text-t truncate">{profile.headline}</p>
                    )
                  )}
                  {/* Location, connections, and LinkedIn slug for identification */}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {profile.location && (
                      <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Location24Regular className="w-3 h-3" />
                        {profile.location}
                      </span>
                    )}
                    {profile.connectionsCount && (
                      <span className="text-xs text-th-text-m">
                        {profile.connectionsCount}+ {t.explorer?.connections || 'connections'}
                      </span>
                    )}
                    {/* Show LinkedIn URL slug for identification */}
                    {profile.linkedInUrl && (
                      <span className="text-[10px] text-th-text-m truncate max-w-[180px]">
                        {profile.linkedInUrl.match(/linkedin\.com\/in\/([^/?]+)/)?.[1] || ''}
                      </span>
                    )}
                  </div>
                  {profile.summary && (
                    <p className="text-xs text-th-text-m mt-1 line-clamp-2">{profile.summary}</p>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Not found section — paste LinkedIn URL or skip */}
          <div className="mt-4 bg-th-surface border border-th-border rounded-xl p-4">
            <p className="text-sm text-th-text-t mb-3">
              {t.explorer?.cantFindThem || "Can't find the right person? Paste their LinkedIn URL:"}
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <LinkedInIcon className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-th-text-m" />
                <input
                  type="url"
                  value={manualLinkedInUrl}
                  onChange={(e) => setManualLinkedInUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/..."
                  className="w-full ps-10 pe-3 py-2.5 bg-th-surface border border-th-border rounded-lg text-th-text text-sm placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleManualLinkedInUrl(); } }}
                  disabled={isLoading}
                />
              </div>
              <button
                onClick={handleManualLinkedInUrl}
                disabled={isLoading || !manualLinkedInUrl.trim()}
                className="px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50 flex-shrink-0"
              >
                {isLoading ? (
                  <ArrowClockwise24Regular className="w-4 h-4 animate-spin" />
                ) : (
                  t.explorer?.go || 'Go'
                )}
              </button>
            </div>
            <button
              onClick={handleSkipDiscovery}
              className="w-full mt-3 py-2 text-th-text-m hover:text-th-text-s transition-colors text-xs"
            >
              {t.explorer?.noneOfThese || 'None of these — search with AI only'}
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {profileData && flowStep === 'results' && (
        <div className="space-y-4 animate-fade-in">
          {/* Warning Banner (if using fallback) */}
          {warning && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-start gap-3">
              <Lightbulb24Regular className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-yellow-300 text-sm">{warning}</p>
              </div>
            </div>
          )}

          {/* Compatibility Match Card — First thing shown */}
          {(matchData || isCalculatingMatch) && (
            <div className="bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-emerald-500/10 border border-cyan-500/20 rounded-2xl p-5 sm:p-6">
              {isCalculatingMatch ? (
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-th-surface-h flex items-center justify-center flex-shrink-0 animate-pulse">
                    <People24Regular className="w-7 h-7 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-th-text font-semibold">{t.explorer?.calculatingMatch || 'Calculating compatibility...'}</p>
                    <p className="text-th-text-t text-sm">{t.explorer?.analyzingProfile || 'Analyzing profile match with yours'}</p>
                  </div>
                </div>
              ) : matchData && (
                <>
                  <div className="flex items-start gap-4">
                    {/* Score circle */}
                    <div className="relative flex-shrink-0">
                      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                        <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
                        <circle
                          cx="40" cy="40" r="34" fill="none"
                          stroke={matchData.score >= 60 ? '#22d3ee' : matchData.score >= 30 ? '#facc15' : '#f87171'}
                          strokeWidth="6"
                          strokeLinecap="round"
                          strokeDasharray={`${(matchData.score / 100) * 213.6} 213.6`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className={`text-xl font-bold ${matchData.score >= 60 ? 'text-cyan-400' : matchData.score >= 30 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {matchData.score}
                        </span>
                      </div>
                    </div>

                    {/* Match info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <People24Regular className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                        <h3 className="font-semibold text-th-text">{t.explorer?.compatibilityMatch || 'Compatibility Match'}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          matchData.score >= 70 ? 'bg-cyan-500/20 text-cyan-300' :
                          matchData.score >= 50 ? 'bg-green-500/20 text-green-300' :
                          matchData.score >= 30 ? 'bg-yellow-500/20 text-yellow-300' :
                          'bg-white/[0.03]0/20 text-th-text-t'
                        }`}>
                          {matchData.score >= 70 ? (t.explorer?.highMatch || 'High')
                            : matchData.score >= 50 ? (t.explorer?.goodMatch || 'Good')
                            : matchData.score >= 30 ? (t.explorer?.moderateMatch || 'Moderate')
                            : (t.explorer?.lowMatch || 'Low')}
                        </span>
                      </div>

                      {/* Reasons */}
                      <div className="space-y-1 mb-3">
                        {matchData.reasons.slice(0, 3).map((reason, i) => (
                          <p key={i} className="text-sm text-th-text-s flex items-start gap-2">
                            <Checkmark24Regular className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                            {reason}
                          </p>
                        ))}
                      </div>

                      {/* Intersections */}
                      {matchData.intersections.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {matchData.intersections.slice(0, 6).map((item, i) => (
                            <span
                              key={i}
                              className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                                item.type === 'sector' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
                                item.type === 'skill' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
                                item.type === 'goal' ? 'bg-green-500/10 text-green-300 border-green-500/20' :
                                item.type === 'complementary' ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' :
                                item.type === 'location' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
                                'bg-cyan-500/10 text-cyan-300 border-cyan-500/20'
                              }`}
                            >
                              {item.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Score breakdown bar */}
                  <div className="mt-4 grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {[
                      { label: t.explorer?.sectors || 'Sectors', value: matchData.breakdown.sectorScore, color: 'bg-emerald-400' },
                      { label: t.explorer?.skillsLabel || 'Skills', value: matchData.breakdown.skillScore, color: 'bg-emerald-400' },
                      { label: t.explorer?.goals || 'Goals', value: matchData.breakdown.goalAlignmentScore, color: 'bg-green-400' },
                      { label: t.explorer?.complementary || 'Synergy', value: matchData.breakdown.complementarySkillsScore, color: 'bg-blue-400' },
                      { label: t.explorer?.locationLabel || 'Location', value: matchData.breakdown.locationScore, color: 'bg-amber-400' },
                      { label: t.explorer?.experience || 'Experience', value: matchData.breakdown.experienceScore, color: 'bg-cyan-400' },
                    ].map((item, i) => (
                      <div key={i} className="text-center">
                        <div className="h-1.5 bg-th-surface-h rounded-full overflow-hidden mb-1">
                          <div className={`h-full ${item.color} rounded-full transition-all duration-500`} style={{ width: `${item.value}%` }} />
                        </div>
                        <p className="text-[10px] text-th-text-m">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Profile Header Card */}
          <div className="bg-gradient-to-r from-emerald-500/10 to-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 sm:p-6">
            {/* Header row with name and buttons */}
            <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {(profileData.photoUrl || selectedProfile?.photoUrl) ? (
                  <img
                    src={profileData.photoUrl || selectedProfile?.photoUrl}
                    alt={profileData.name}
                    className="w-14 h-14 rounded-full object-cover flex-shrink-0 border-2 border-emerald-500/30"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0">
                    <Person24Regular className="w-7 h-7 text-th-text" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold text-th-text truncate">{profileData.name}</h2>
                  {profileData.jobTitle && profileData.company ? (
                    <p className="text-sm text-emerald-300">{profileData.jobTitle} at {profileData.company}</p>
                  ) : (
                    <p className="text-sm text-emerald-300 flex items-center gap-1.5">
                      {searchEngine === 'perplexity' ? (
                        <>
                          <Globe24Regular className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{t.explorer?.webSearchResults || 'Web Search Results'}</span>
                        </>
                      ) : (
                        t.explorer?.aiGeneratedProfile || 'AI-Generated Profile'
                      )}
                    </p>
                  )}
                  {profileData.location && (
                    <p className="text-xs text-th-text-t">{profileData.location}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => saveToArchive(profileData, { firstName, lastName, company, name: `${firstName} ${lastName}`.trim(), linkedIn, twitter, website, additionalInfo }, searchEngine || 'unknown')}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-th-surface-h hover:bg-th-surface-h text-th-text text-sm font-medium rounded-lg transition-all flex-1 sm:flex-initial"
                >
                  <Archive24Regular className="w-4 h-4 flex-shrink-0" />
                  <span>{t.explorer?.save || 'Save'}</span>
                </button>
                <button
                  onClick={resetSearch}
                  className="p-2 bg-th-surface-h hover:bg-th-surface-h text-th-text-s rounded-lg transition-all flex-shrink-0"
                  title="New Search"
                >
                  <Search24Regular className="w-4 h-4" />
                </button>
              </div>
            </div>
            {/* Summary */}
            <p className="text-th-text-s leading-relaxed">{profileData.summary}</p>
          </div>

          {/* Social Media Accounts */}
          {profileData.socialMedia && profileData.socialMedia.length > 0 && (
            <div className="bg-th-surface border border-th-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Link24Regular className="w-5 h-5 text-emerald-400" />
                <h3 className="font-semibold text-th-text">{t.explorer?.socialMediaProfiles || 'Social Media Profiles'}</h3>
                <span className="text-xs text-th-text-m">({profileData.socialMedia.length} {t.explorer?.found || 'found'})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {profileData.socialMedia.map((account, i) => (
                  <a
                    key={i}
                    href={account.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${getPlatformColor(account.platform)}`}
                  >
                    {getPlatformIcon(account.platform)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{account.platform}</p>
                      {account.username && (
                        <p className="text-xs opacity-70 truncate">{account.username}</p>
                      )}
                    </div>
                    {account.followers && (
                      <span className="text-xs opacity-70">{account.followers}</span>
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Professional Background */}
          {profileData.professionalBackground && (
            <div className="bg-th-surface border border-th-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Briefcase24Regular className="w-5 h-5 text-blue-400" />
                <h3 className="font-semibold text-th-text">{t.explorer?.professionalBackground || 'Professional Background'}</h3>
              </div>
              <p className="text-th-text-s leading-relaxed">{profileData.professionalBackground}</p>
            </div>
          )}

          {/* Latest Activity */}
          {profileData.latestActivity && (
            <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkle24Regular className="w-5 h-5 text-green-400" />
                <h3 className="font-semibold text-th-text">{t.explorer?.latestActivity || 'Latest Activity'}</h3>
              </div>
              <p className="text-th-text-s leading-relaxed text-sm">{profileData.latestActivity}</p>
            </div>
          )}

          {/* Recent LinkedIn Posts */}
          {profileData.posts && profileData.posts.length > 0 && (
            <div className="bg-th-surface border border-th-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <LinkedInIcon className="w-5 h-5 text-blue-400" />
                  <h3 className="font-semibold text-th-text">{t.explorer?.recentPosts || 'Recent LinkedIn Posts'}</h3>
                  <span className="text-xs text-th-text-m">({profileData.posts.length})</span>
                </div>
                {profileData.latestPostDate && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-xs text-green-400 font-medium">
                      {t.explorer?.lastPost || 'Last post'}: {new Date(profileData.latestPostDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                {profileData.posts.map((post, i) => (
                  <div key={i} className="p-3 bg-th-surface border border-th-border rounded-lg">
                    {post.text && (
                      <p className="text-sm text-th-text-s leading-relaxed line-clamp-4 whitespace-pre-line">
                        {post.text.length > 400 ? post.text.slice(0, 400) + '...' : post.text}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-th-text-m">
                      {post.activityDate && (
                        <span>{new Date(post.activityDate).toLocaleDateString()}</span>
                      )}
                      {post.reactionsCount != null && post.reactionsCount > 0 && (
                        <span>{post.reactionsCount} {t.explorer?.reactions || 'reactions'}</span>
                      )}
                      {post.commentsCount != null && post.commentsCount > 0 && (
                        <span>{post.commentsCount} {t.explorer?.comments || 'comments'}</span>
                      )}
                      {post.activityUrl && (
                        <a
                          href={post.activityUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 transition-colors ms-auto"
                        >
                          {t.explorer?.viewOnLinkedIn || 'View on LinkedIn'}
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Work History / Positions */}
          {profileData.positions && profileData.positions.length > 0 && (
            <div className="bg-th-surface border border-th-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Briefcase24Regular className="w-5 h-5 text-blue-400" />
                <h3 className="font-semibold text-th-text">{t.explorer?.workHistory || 'Work History'}</h3>
                <span className="text-xs text-th-text-m">({profileData.positions.length} {t.explorer?.positions || 'positions'})</span>
              </div>
              <div className="space-y-3">
                {profileData.positions.map((pos, i) => (
                  <div key={i} className="flex gap-3">
                    {/* Timeline dot */}
                    <div className="flex flex-col items-center flex-shrink-0 pt-1">
                      <div className={`w-2.5 h-2.5 rounded-full ${pos.isCurrent ? 'bg-green-400' : 'bg-neutral-600'}`} />
                      {i < profileData.positions!.length - 1 && (
                        <div className="w-px flex-1 bg-th-surface-h mt-1" />
                      )}
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0 pb-3">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-th-text text-sm">{pos.title || 'Unknown Role'}</h4>
                        {pos.isCurrent && (
                          <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] font-medium rounded-full">
                            {t.explorer?.current || 'Current'}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-th-text-t">{pos.company || 'Unknown Company'}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {(pos.startDate || pos.endDate) && (
                          <span className="text-xs text-th-text-m">
                            {pos.startDate || '?'} — {pos.isCurrent ? (t.explorer?.present || 'Present') : (pos.endDate || '?')}
                          </span>
                        )}
                        {pos.location && (
                          <span className="text-xs text-th-text-m flex items-center gap-1">
                            <Location24Regular className="w-3 h-3" />
                            {pos.location}
                          </span>
                        )}
                      </div>
                      {pos.description && (
                        <p className="text-xs text-th-text-m mt-1 line-clamp-2">{pos.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sectors & Skills Row */}
          {((profileData.sectors && profileData.sectors.length > 0) || (profileData.skills && profileData.skills.length > 0)) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Sectors */}
              {profileData.sectors && profileData.sectors.length > 0 && (
                <div className="bg-th-surface border border-th-border rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Briefcase24Regular className="w-5 h-5 text-emerald-400" />
                    <h3 className="font-semibold text-th-text">{t.explorer?.industrySectors || 'Industry Sectors'}</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {profileData.sectors.map((sector, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-full text-sm"
                      >
                        {sector}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Skills */}
              {profileData.skills && profileData.skills.length > 0 && (
                <div className="bg-th-surface border border-th-border rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkle24Regular className="w-5 h-5 text-emerald-400" />
                    <h3 className="font-semibold text-th-text">{t.explorer?.skillsExpertise || 'Skills & Expertise'}</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {profileData.skills.map((skill, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-full text-sm"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Two Column Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Interests */}
            {profileData.interests && profileData.interests.length > 0 && (
              <div className="bg-th-surface border border-th-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb24Regular className="w-5 h-5 text-yellow-400" />
                  <h3 className="font-semibold text-th-text">{t.explorer?.interests || 'Interests'}</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {profileData.interests.map((interest, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 bg-yellow-500/10 text-yellow-300 border border-yellow-500/20 rounded-full text-sm"
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Common Ground */}
            {profileData.commonGround && profileData.commonGround.length > 0 && (
              <div className="bg-th-surface border border-th-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <People24Regular className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-semibold text-th-text">{t.explorer?.potentialCommonGround || 'Potential Common Ground'}</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {profileData.commonGround.map((item, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 rounded-full text-sm"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Ice Breakers */}
          {profileData.iceBreakers && profileData.iceBreakers.length > 0 && (
            <div className="bg-th-surface border border-th-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Chat24Regular className="w-5 h-5 text-green-400 flex-shrink-0" />
                <h3 className="font-semibold text-th-text">{t.explorer?.iceBreakers || 'Ice Breakers'}</h3>
                <span className="text-xs text-th-text-m ms-auto hidden sm:block">{t.explorer?.clickToCopy || 'Click to copy'}</span>
              </div>
              <div className="space-y-2">
                {profileData.iceBreakers.map((starter, i) => (
                  <button
                    key={i}
                    onClick={() => copyToClipboard(starter, `starter-${i}`)}
                    className="w-full flex items-start gap-3 p-3 bg-th-surface hover:bg-th-surface-h border border-th-border hover:border-green-500/30 rounded-lg text-start transition-all group"
                  >
                    <span className="flex-1 text-th-text-s group-hover:text-th-text transition-colors text-sm sm:text-base break-words">
                      &ldquo;{starter}&rdquo;
                    </span>
                    <span className="flex-shrink-0 p-1.5 bg-th-surface rounded-md group-hover:bg-green-500/20 transition-colors mt-0.5">
                      {copiedId === `starter-${i}` ? (
                        <Checkmark24Regular className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy24Regular className="w-4 h-4 text-th-text-m group-hover:text-green-400" />
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Approach Tips */}
          {profileData.approachTips && (
            <div className="bg-gradient-to-r from-emerald-500/10 to-emerald-500/10 border border-emerald-500/20 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkle24Regular className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <h3 className="font-semibold text-th-text flex-1">{t.explorer?.approachTips || 'Approach Tips'}</h3>
                <button
                  onClick={() => copyToClipboard(profileData.approachTips, 'tips')}
                  className="p-1.5 hover:bg-th-surface-h rounded-md transition-colors flex-shrink-0"
                  title="Copy tips"
                >
                  {copiedId === 'tips' ? (
                    <Checkmark24Regular className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy24Regular className="w-4 h-4 text-th-text-m" />
                  )}
                </button>
              </div>
              <p className="text-th-text-s leading-relaxed text-sm sm:text-base">{profileData.approachTips}</p>
            </div>
          )}

          {/* Sources */}
          {profileData.sources && profileData.sources.length > 0 && (
            <div className="bg-th-surface border border-th-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Globe24Regular className="w-5 h-5 text-th-text-t" />
                <h3 className="font-semibold text-th-text">{t.explorer?.sources || 'Sources'}</h3>
                <span className="text-xs text-th-text-m">({profileData.sources.length} {t.explorer?.found || 'found'})</span>
              </div>
              <div className="space-y-2">
                {profileData.sources.slice(0, 5).map((source, i) => (
                  <a
                    key={i}
                    href={source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm text-blue-400 hover:text-blue-300 truncate hover:underline transition-colors"
                  >
                    {source}
                  </a>
                ))}
                {profileData.sources.length > 5 && (
                  <p className="text-xs text-th-text-m">
                    +{profileData.sources.length - 5} {t.explorer?.moreSources || 'more sources'}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex items-center justify-center gap-3 pt-4">
            <button
              onClick={resetSearch}
              className="flex items-center gap-2 px-6 py-2.5 bg-th-surface hover:bg-th-surface-h border border-th-border text-th-text-s hover:text-th-text rounded-lg transition-all"
            >
              <Search24Regular className="w-4 h-4" />
              {t.explorer?.newSearch || 'New Search'}
            </button>
            <button
              onClick={() => saveToArchive(profileData, { firstName, lastName, company, name: `${firstName} ${lastName}`.trim(), linkedIn, twitter, website, additionalInfo }, searchEngine || 'unknown')}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium rounded-lg hover:shadow-lg hover:shadow-emerald-500/25 transition-all"
            >
              <Archive24Regular className="w-4 h-4" />
              {t.explorer?.saveToArchive || 'Save to Archive'}
            </button>
          </div>
        </div>
      )}

      {/* Empty State - Only when no search yet */}
      {!profileData && !isLoading && !isDiscovering && flowStep === 'form' && (
        <div className="text-center py-8">
          <p className="text-th-text-m mb-6">{t.explorer?.enterNameToStart || 'Enter a name above to get started'}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
            <div className="flex flex-col items-center gap-2 p-4 bg-th-surface rounded-xl">
              <Person24Regular className="w-6 h-6 text-emerald-400" />
              <span className="text-xs text-th-text-t">{t.explorer?.profileSummary || 'Profile Summary'}</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-4 bg-th-surface rounded-xl">
              <Link24Regular className="w-6 h-6 text-blue-400" />
              <span className="text-xs text-th-text-t">{t.explorer?.socialAccounts || 'Social Accounts'}</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-4 bg-th-surface rounded-xl">
              <Chat24Regular className="w-6 h-6 text-green-400" />
              <span className="text-xs text-th-text-t">{t.explorer?.conversationIdeas || 'Conversation Ideas'}</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-4 bg-th-surface rounded-xl">
              <Archive24Regular className="w-6 h-6 text-yellow-400" />
              <span className="text-xs text-th-text-t">{t.explorer?.saveToArchive || 'Save to Archive'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
