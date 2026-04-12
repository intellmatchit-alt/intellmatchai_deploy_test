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
} from '@fluentui/react-icons';

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
}

interface ArchivedSearch {
  id: string;
  timestamp: number;
  query: {
    name: string;
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
  const [name, setName] = useState('');
  const [linkedIn, setLinkedIn] = useState('');
  const [twitter, setTwitter] = useState('');
  const [website, setWebsite] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');

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
      title: 'Saved to Archive',
      description: 'Search result has been archived',
      variant: 'success',
    });
  };

  const removeFromArchive = (id: string) => {
    const updated = archive.filter(a => a.id !== id);
    setArchive(updated);
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(updated));
    toast({
      title: 'Removed',
      description: 'Search removed from archive',
      variant: 'info',
    });
  };

  const loadFromArchive = (entry: ArchivedSearch) => {
    setProfileData(entry.profileData);
    setName(entry.query.name);
    setLinkedIn(entry.query.linkedIn || '');
    setTwitter(entry.query.twitter || '');
    setWebsite(entry.query.website || '');
    setAdditionalInfo(entry.query.additionalInfo || '');
    setSearchEngine(entry.searchEngine);
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

        // Set form fields for archive purposes
        setName(extracted.name);
        if (extracted.company) setAdditionalInfo(`Company: ${extracted.company}`);
        if (extracted.linkedInUrl) setLinkedIn(extracted.linkedInUrl);
        if (extracted.twitterUrl) setTwitter(extracted.twitterUrl);
        if (extracted.website) setWebsite(extracted.website);
      }

      setScanProgress(90);

      // Show profile data if search was successful
      if (data.profileData) {
        setProfileData(data.profileData);
        setSearchEngine(data.searchEngine || 'perplexity');
        setWarning(data.warning || null);
        setIsLoading(false);
      } else if (extracted?.name) {
        // If no profile data but we have a name, do a manual search
        setIsLoading(true);
        setProfileData(null);
        setSearchEngine(null);
        setWarning(null);

        const context = [
          extracted.company ? `Company: ${extracted.company}` : '',
          extracted.jobTitle ? `Job: ${extracted.jobTitle}` : '',
          extracted.location ? `Location: ${extracted.location}` : '',
        ].filter(Boolean).join('. ');

        const searchResponse = await fetch('/api/explorer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: extracted.name,
            linkedIn: extracted.linkedInUrl || undefined,
            twitter: extracted.twitterUrl || undefined,
            website: extracted.website || undefined,
            additionalInfo: context || undefined,
          }),
        });

        if (searchResponse.ok) {
          const searchData: SearchResponse = await searchResponse.json();
          setProfileData(searchData.profileData);
          setSearchEngine(searchData.searchEngine || null);
          setWarning(searchData.warning || null);
        } else {
          toast({
            title: 'Search Failed',
            description: 'Card scanned but could not search online.',
            variant: 'warning'
          });
        }
        setIsLoading(false);
      } else {
        toast({
          title: 'No Name Found',
          description: 'Could not extract name from images. Please enter manually.',
          variant: 'warning'
        });
      }

      setScanProgress(100);
    } catch (error: any) {
      console.error('Scan error:', error);
      toast({ title: 'Scan Failed', description: error.message || 'Failed to scan images', variant: 'error' });
    } finally {
      setIsScanning(false);
      setScanProgress(0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({
        title: t.common?.error || 'Error',
        description: 'Please enter a name',
        variant: 'error',
      });
      return;
    }

    setIsLoading(true);
    setProfileData(null);
    setSearchEngine(null);
    setWarning(null);

    try {
      const response = await fetch('/api/explorer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          linkedIn: linkedIn.trim() || undefined,
          twitter: twitter.trim() || undefined,
          website: website.trim() || undefined,
          additionalInfo: additionalInfo.trim() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze profile');
      }

      const data: SearchResponse = await response.json();
      setProfileData(data.profileData);
      setSearchEngine(data.searchEngine || null);
      setWarning(data.warning || null);
    } catch (error: any) {
      console.error('Explorer error:', error);
      toast({
        title: t.common?.error || 'Error',
        description: error.message || 'Failed to analyze profile',
        variant: 'error',
      });
    } finally {
      setIsLoading(false);
    }
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
    setName('');
    setLinkedIn('');
    setTwitter('');
    setWebsite('');
    setAdditionalInfo('');
    setShowAdvanced(false);
    setSearchEngine(null);
    setWarning(null);
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
    if (p.includes('twitter') || p.includes('x')) return 'bg-neutral-500/10 text-neutral-300 border-neutral-500/20 hover:bg-neutral-500/20';
    if (p.includes('youtube')) return 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20';
    if (p.includes('instagram')) return 'bg-pink-500/10 text-pink-400 border-pink-500/20 hover:bg-pink-500/20';
    if (p.includes('facebook')) return 'bg-blue-600/10 text-blue-400 border-blue-600/20 hover:bg-blue-600/20';
    if (p.includes('tiktok')) return 'bg-neutral-500/10 text-neutral-300 border-neutral-500/20 hover:bg-neutral-500/20';
    return 'bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20';
  };

  // Archive View
  if (showArchive) {
    return (
      <div className="max-w-4xl mx-auto pb-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => setShowArchive(false)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ArrowLeft24Regular className="w-5 h-5 text-neutral-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Archived Searches</h1>
            <p className="text-neutral-400 text-sm">{archive.length} saved searches</p>
          </div>
        </div>

        {archive.length === 0 ? (
          <div className="text-center py-16 bg-white/5 border border-white/10 rounded-2xl">
            <Archive24Regular className="w-12 h-12 text-neutral-500 mx-auto mb-4" />
            <p className="text-neutral-400">No archived searches yet</p>
            <p className="text-neutral-500 text-sm mt-1">Your saved searches will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {archive.map((entry) => (
              <div
                key={entry.id}
                className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/[0.07] transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <button
                    onClick={() => loadFromArchive(entry)}
                    className="flex-1 text-start"
                  >
                    <h3 className="font-semibold text-white">{entry.profileData.name}</h3>
                    {entry.profileData.jobTitle && entry.profileData.company && (
                      <p className="text-sm text-neutral-400">
                        {entry.profileData.jobTitle} at {entry.profileData.company}
                      </p>
                    )}
                    <p className="text-xs text-neutral-500 mt-1">
                      {new Date(entry.timestamp).toLocaleDateString()} • {entry.searchEngine}
                    </p>
                  </button>
                  <button
                    onClick={() => removeFromArchive(entry.id)}
                    className="p-2 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 rounded-lg transition-colors flex-shrink-0"
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
          <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/20">
            <Sparkle24Regular className="w-8 h-8 text-purple-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            {t.bottomNav?.explorer || 'Profile Explorer'}
          </h1>
          <p className="text-neutral-400">
            {t.explorer?.subtitle || 'Get AI-powered insights about anyone before you connect'}
          </p>
        </div>
        <button
          onClick={() => setShowArchive(true)}
          className="absolute top-4 end-4 p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all flex items-center gap-2"
          title="View Archive"
        >
          <Archive24Regular className="w-5 h-5 text-neutral-400" />
          {archive.length > 0 && (
            <span className="text-xs text-neutral-400">{archive.length}</span>
          )}
        </button>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          {/* Image Upload Section */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Camera24Regular className="w-5 h-5 text-purple-400" />
              <span className="text-sm font-medium text-white">Scan Business Cards</span>
              <span className="text-xs text-neutral-500">(Optional)</span>
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
              capture="environment"
              onChange={handleImageSelect}
              className="hidden"
            />

            {/* Upload buttons */}
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={isScanning || isLoading}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl text-purple-300 hover:bg-purple-500/30 transition-all disabled:opacity-50"
              >
                <Camera24Regular className="w-5 h-5" />
                <span>Camera</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanning || isLoading}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-white/5 border border-white/10 rounded-xl text-neutral-300 hover:bg-white/10 transition-all disabled:opacity-50"
              >
                <Image24Regular className="w-5 h-5" />
                <span>Upload Images</span>
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
                          <Checkmark24Regular className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute -top-2 -end-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Dismiss24Regular className="w-4 h-4 text-white" />
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
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
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
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-neutral-500">OR ENTER MANUALLY</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Main Input */}
          <div className="relative mb-4">
            <Person24Regular className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter person's name..."
              className="w-full ps-12 pe-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white text-lg placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
              disabled={isLoading || isScanning}
              autoFocus
            />
          </div>

          {/* Toggle Advanced Options */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors mb-4"
          >
            {showAdvanced ? (
              <ChevronUp24Regular className="w-4 h-4" />
            ) : (
              <ChevronDown24Regular className="w-4 h-4" />
            )}
            {showAdvanced ? 'Hide' : 'Add'} social links & context (optional)
          </button>

          {/* Advanced Options */}
          {showAdvanced && (
            <div className="space-y-3 mb-4 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* LinkedIn */}
                <div className="relative">
                  <LinkedInIcon className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <input
                    type="url"
                    value={linkedIn}
                    onChange={(e) => setLinkedIn(e.target.value)}
                    placeholder="LinkedIn URL"
                    className="w-full ps-10 pe-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    disabled={isLoading}
                  />
                </div>

                {/* Twitter */}
                <div className="relative">
                  <XIcon className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <input
                    type="text"
                    value={twitter}
                    onChange={(e) => setTwitter(e.target.value)}
                    placeholder="Twitter/X handle"
                    className="w-full ps-10 pe-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    disabled={isLoading}
                  />
                </div>

                {/* Website */}
                <div className="relative">
                  <Globe24Regular className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="Website URL"
                    className="w-full ps-10 pe-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Additional Context */}
              <textarea
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
                placeholder="Additional context (company, how you met, industry, etc.)"
                rows={2}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                disabled={isLoading}
              />
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !name.trim()}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-purple-500/25 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isLoading ? (
              <>
                <ArrowClockwise24Regular className="w-5 h-5 animate-spin" />
                Searching the web...
              </>
            ) : (
              <>
                <Search24Regular className="w-5 h-5" />
                Research Profile
              </>
            )}
          </button>
        </div>
      </form>

      {/* Results */}
      {profileData && (
        <div className="space-y-4 animate-fade-in">
          {/* Warning Banner (if using fallback) */}
          {warning && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
              <Lightbulb24Regular className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-300 text-sm">{warning}</p>
              </div>
            </div>
          )}

          {/* Profile Header Card */}
          <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl p-5 sm:p-6">
            {/* Header row with name and buttons */}
            <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                  <Person24Regular className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold text-white truncate">{profileData.name}</h2>
                  {profileData.jobTitle && profileData.company ? (
                    <p className="text-sm text-purple-300">{profileData.jobTitle} at {profileData.company}</p>
                  ) : (
                    <p className="text-sm text-purple-300 flex items-center gap-1.5">
                      {searchEngine === 'perplexity' ? (
                        <>
                          <Globe24Regular className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>Web Search Results</span>
                        </>
                      ) : (
                        'AI-Generated Profile'
                      )}
                    </p>
                  )}
                  {profileData.location && (
                    <p className="text-xs text-neutral-400">{profileData.location}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => saveToArchive(profileData, { name, linkedIn, twitter, website, additionalInfo }, searchEngine || 'unknown')}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-all flex-1 sm:flex-initial"
                >
                  <Archive24Regular className="w-4 h-4 flex-shrink-0" />
                  <span>Save</span>
                </button>
                <button
                  onClick={resetSearch}
                  className="p-2 bg-white/10 hover:bg-white/20 text-neutral-300 rounded-lg transition-all flex-shrink-0"
                  title="New Search"
                >
                  <Search24Regular className="w-4 h-4" />
                </button>
              </div>
            </div>
            {/* Summary */}
            <p className="text-neutral-300 leading-relaxed">{profileData.summary}</p>
          </div>

          {/* Social Media Accounts */}
          {profileData.socialMedia && profileData.socialMedia.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Link24Regular className="w-5 h-5 text-purple-400" />
                <h3 className="font-semibold text-white">Social Media Profiles</h3>
                <span className="text-xs text-neutral-500">({profileData.socialMedia.length} found)</span>
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
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Briefcase24Regular className="w-5 h-5 text-blue-400" />
                <h3 className="font-semibold text-white">Professional Background</h3>
              </div>
              <p className="text-neutral-300 leading-relaxed">{profileData.professionalBackground}</p>
            </div>
          )}

          {/* Sectors & Skills Row */}
          {((profileData.sectors && profileData.sectors.length > 0) || (profileData.skills && profileData.skills.length > 0)) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Sectors */}
              {profileData.sectors && profileData.sectors.length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Briefcase24Regular className="w-5 h-5 text-purple-400" />
                    <h3 className="font-semibold text-white">Industry Sectors</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {profileData.sectors.map((sector, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 bg-purple-500/10 text-purple-300 border border-purple-500/20 rounded-full text-sm"
                      >
                        {sector}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Skills */}
              {profileData.skills && profileData.skills.length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkle24Regular className="w-5 h-5 text-pink-400" />
                    <h3 className="font-semibold text-white">Skills & Expertise</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {profileData.skills.map((skill, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 bg-pink-500/10 text-pink-300 border border-pink-500/20 rounded-full text-sm"
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
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb24Regular className="w-5 h-5 text-amber-400" />
                  <h3 className="font-semibold text-white">Interests</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {profileData.interests.map((interest, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded-full text-sm"
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Common Ground */}
            {profileData.commonGround && profileData.commonGround.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <People24Regular className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-semibold text-white">Potential Common Ground</h3>
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
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Chat24Regular className="w-5 h-5 text-green-400 flex-shrink-0" />
                <h3 className="font-semibold text-white">Ice Breakers</h3>
                <span className="text-xs text-neutral-500 ms-auto hidden sm:block">Click to copy</span>
              </div>
              <div className="space-y-2">
                {profileData.iceBreakers.map((starter, i) => (
                  <button
                    key={i}
                    onClick={() => copyToClipboard(starter, `starter-${i}`)}
                    className="w-full flex items-start gap-3 p-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-green-500/30 rounded-lg text-start transition-all group"
                  >
                    <span className="flex-1 text-neutral-300 group-hover:text-white transition-colors text-sm sm:text-base break-words">
                      &ldquo;{starter}&rdquo;
                    </span>
                    <span className="flex-shrink-0 p-1.5 bg-white/5 rounded-md group-hover:bg-green-500/20 transition-colors mt-0.5">
                      {copiedId === `starter-${i}` ? (
                        <Checkmark24Regular className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy24Regular className="w-4 h-4 text-neutral-500 group-hover:text-green-400" />
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Approach Tips */}
          {profileData.approachTips && (
            <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkle24Regular className="w-5 h-5 text-purple-400 flex-shrink-0" />
                <h3 className="font-semibold text-white flex-1">Approach Tips</h3>
                <button
                  onClick={() => copyToClipboard(profileData.approachTips, 'tips')}
                  className="p-1.5 hover:bg-white/10 rounded-md transition-colors flex-shrink-0"
                  title="Copy tips"
                >
                  {copiedId === 'tips' ? (
                    <Checkmark24Regular className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy24Regular className="w-4 h-4 text-neutral-500" />
                  )}
                </button>
              </div>
              <p className="text-neutral-300 leading-relaxed text-sm sm:text-base">{profileData.approachTips}</p>
            </div>
          )}

          {/* Sources */}
          {profileData.sources && profileData.sources.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Globe24Regular className="w-5 h-5 text-neutral-400" />
                <h3 className="font-semibold text-white">Sources</h3>
                <span className="text-xs text-neutral-500">({profileData.sources.length} found)</span>
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
                  <p className="text-xs text-neutral-500">
                    +{profileData.sources.length - 5} more sources
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex items-center justify-center gap-3 pt-4">
            <button
              onClick={resetSearch}
              className="flex items-center gap-2 px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white rounded-lg transition-all"
            >
              <Search24Regular className="w-4 h-4" />
              New Search
            </button>
            <button
              onClick={() => saveToArchive(profileData, { name, linkedIn, twitter, website, additionalInfo }, searchEngine || 'unknown')}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-lg hover:shadow-lg hover:shadow-purple-500/25 transition-all"
            >
              <Archive24Regular className="w-4 h-4" />
              Save to Archive
            </button>
          </div>
        </div>
      )}

      {/* Empty State - Only when no search yet */}
      {!profileData && !isLoading && (
        <div className="text-center py-8">
          <p className="text-neutral-500 mb-6">Enter a name above to get started</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
            <div className="flex flex-col items-center gap-2 p-4 bg-white/5 rounded-xl">
              <Person24Regular className="w-6 h-6 text-purple-400" />
              <span className="text-xs text-neutral-400">Profile Summary</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-4 bg-white/5 rounded-xl">
              <Link24Regular className="w-6 h-6 text-blue-400" />
              <span className="text-xs text-neutral-400">Social Accounts</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-4 bg-white/5 rounded-xl">
              <Chat24Regular className="w-6 h-6 text-green-400" />
              <span className="text-xs text-neutral-400">Conversation Ideas</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-4 bg-white/5 rounded-xl">
              <Archive24Regular className="w-6 h-6 text-amber-400" />
              <span className="text-xs text-neutral-400">Save to Archive</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
