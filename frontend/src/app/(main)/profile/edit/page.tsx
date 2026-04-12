/**
 * Edit Profile Page
 *
 * Edit user profile information.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/hooks/useAuth';
import { Avatar } from '@/components/ui/Avatar';
import { toast } from '@/components/ui/Toast';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { useDetectedCountry } from '@/hooks/useDetectedCountry';
import { getProfile, updateProfile, uploadAvatar, Profile, getSectors, getSkills, getHobbies, updateSectors, updateSkills, updateInterests, updateGoals, updateHobbies, Sector, Skill, Hobby } from '@/lib/api/profile';
import {
  ArrowLeft24Regular,
  Person24Regular,
  Mail24Regular,
  Building24Regular,
  Briefcase24Regular,
  Location24Regular,
  Globe24Regular,
  Link24Regular,
  Save24Regular,
  Edit24Regular,
  DocumentText24Regular,
  FullScreenMaximize24Regular,
  Dismiss24Regular,
  Star24Regular,
  Heart24Regular,
  Target24Regular,
  Sparkle24Regular,
  ChevronDown24Regular,
  ChevronUp24Regular,
} from '@fluentui/react-icons';

// Objective options
const OBJECTIVE_OPTIONS = [
  { id: 'FIND_MENTOR', name: 'Find a Mentor', description: 'Connect with experienced professionals' },
  { id: 'FIND_PARTNER', name: 'Find Business Partners', description: 'Collaborate on projects or ventures' },
  { id: 'FIND_INVESTOR', name: 'Find Investors', description: 'Secure funding for your projects' },
  { id: 'FIND_TALENT', name: 'Find Talent', description: 'Recruit skilled professionals' },
  { id: 'FIND_CLIENTS', name: 'Find Clients', description: 'Acquire new business opportunities' },
  { id: 'EXPAND_NETWORK', name: 'Expand Network', description: 'Grow your professional connections' },
  { id: 'LEARN_SKILL', name: 'Learn New Skills', description: 'Develop new competencies' },
];

/**
 * Bio Preview Dialog - Full screen bio editor with tabs
 */
function BioPreviewDialog({
  isOpen,
  onClose,
  bioSummary,
  bioFull,
  activeBioTab,
  onBioSummaryChange,
  onBioFullChange,
  onBioTabChange,
  t,
  lang,
}: {
  isOpen: boolean;
  onClose: () => void;
  bioSummary: string;
  bioFull: string;
  activeBioTab: 'summary' | 'full';
  onBioSummaryChange: (bio: string) => void;
  onBioFullChange: (bio: string) => void;
  onBioTabChange: (tab: 'summary' | 'full') => void;
  t: any;
  lang: string;
}) {
  const [localSummary, setLocalSummary] = useState(bioSummary);
  const [localFull, setLocalFull] = useState(bioFull);
  const [localTab, setLocalTab] = useState(activeBioTab);

  // Detect RTL content
  const isRtl = lang === 'ar' || /[\u0600-\u06FF]/.test((bioFull || bioSummary).slice(0, 50));

  useEffect(() => {
    setLocalSummary(bioSummary);
    setLocalFull(bioFull);
    setLocalTab(activeBioTab);
  }, [bioSummary, bioFull, activeBioTab]);

  const handleSave = () => {
    onBioSummaryChange(localSummary);
    onBioFullChange(localFull);
    onBioTabChange(localTab);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-th-bg-s border border-th-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-th-border">
          <div>
            <h3 className="text-lg font-semibold text-th-text">{t.profile?.form?.bio || 'Bio'}</h3>
            <p className="text-sm text-th-text-t mt-0.5">{t.onboarding?.bioPreview?.subtitle || 'Write a compelling summary of your professional background'}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-th-text-t hover:text-th-text hover:bg-th-surface-h rounded-lg transition-colors">
            <Dismiss24Regular className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          {/* Bio Tabs */}
          <div className={`flex gap-1 mb-4 p-1 bg-th-surface rounded-lg ${isRtl ? 'flex-row-reverse' : ''}`}>
            <button
              type="button"
              onClick={() => setLocalTab('summary')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                localTab === 'summary'
                  ? 'bg-emerald-500 text-white'
                  : 'text-th-text-t hover:text-th-text hover:bg-th-surface'
              }`}
            >
              {t.onboarding?.cvBio?.summarized || 'Summary'}
            </button>
            <button
              type="button"
              onClick={() => setLocalTab('full')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                localTab === 'full'
                  ? 'bg-emerald-500 text-white'
                  : 'text-th-text-t hover:text-th-text hover:bg-th-surface'
              }`}
            >
              {t.onboarding?.cvBio?.fullBio || 'Full Bio'}
            </button>
          </div>

          {localTab === 'summary' ? (
            <>
              <textarea
                value={localSummary}
                onChange={(e) => setLocalSummary(e.target.value)}
                placeholder={t.onboarding?.cvBio?.summaryPlaceholder || 'Key highlights of your professional background...'}
                rows={6}
                maxLength={300}
                dir={isRtl ? 'rtl' : 'ltr'}
                style={{ textAlign: isRtl ? 'right' : 'left' }}
                className="w-full px-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none text-base leading-relaxed"
                autoFocus
              />
              <div className={`flex items-center justify-between mt-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <p className="text-xs text-th-text-m">{t.onboarding?.cvBio?.summaryTipLong || 'Tip: Focus on key achievements and unique value proposition'}</p>
                <p className={`text-xs ${localSummary.length > 270 ? 'text-yellow-400' : 'text-th-text-m'}`}>
                  {localSummary.length}/300 {t.onboarding?.bioPreview?.characters || 'characters'}
                </p>
              </div>
            </>
          ) : (
            <>
              <textarea
                value={localFull}
                onChange={(e) => setLocalFull(e.target.value)}
                placeholder={t.onboarding?.cvBio?.fullPlaceholder || 'Detailed professional background, experience, and achievements...'}
                rows={12}
                maxLength={2000}
                dir={isRtl ? 'rtl' : 'ltr'}
                style={{ textAlign: isRtl ? 'right' : 'left' }}
                className="w-full px-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none text-base leading-relaxed"
                autoFocus
              />
              <div className={`flex items-center justify-between mt-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <p className="text-xs text-th-text-m">{t.onboarding?.cvBio?.fullTipLong || 'Tip: Include detailed experience, education, and career highlights'}</p>
                <p className={`text-xs ${localFull.length > 1800 ? 'text-yellow-400' : 'text-th-text-m'}`}>
                  {localFull.length}/2000 {t.onboarding?.bioPreview?.characters || 'characters'}
                </p>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-th-border bg-th-surface">
          <button type="button" onClick={onClose} className="px-4 py-2 text-th-text-s hover:text-th-text hover:bg-th-surface-h rounded-lg transition-colors">
            {t.common?.cancel || 'Cancel'}
          </button>
          <button type="button" onClick={handleSave} className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium rounded-lg hover:shadow-lg hover:shadow-emerald-500/25 transition-all">
            {t.common?.save || 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EditProfilePage() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const { refreshUser } = useAuth();
  const detectedCountry = useDetectedCountry();

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isBioDialogOpen, setIsBioDialogOpen] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    phoneCountryCode: '',
    company: '',
    jobTitle: '',
    location: '',
    linkedinUrl: '',
    websiteUrl: '',
  });

  // Dual bio state
  const [bioSummary, setBioSummary] = useState('');
  const [bioFull, setBioFull] = useState('');
  const [activeBioTab, setActiveBioTab] = useState<'summary' | 'full'>('summary');

  // Lookup data
  const [allSectors, setAllSectors] = useState<Sector[]>([]);
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [allInterests, setAllInterests] = useState<Array<{ id: string; name: string }>>([]);
  const [allHobbies, setAllHobbies] = useState<Hobby[]>([]);

  // Selected items
  const [selectedSectorIds, setSelectedSectorIds] = useState<string[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [selectedInterestIds, setSelectedInterestIds] = useState<string[]>([]);
  const [selectedObjectiveTypes, setSelectedObjectiveTypes] = useState<string[]>([]);
  const [selectedHobbyIds, setSelectedHobbyIds] = useState<string[]>([]);

  // Expand states
  const [sectorsExpanded, setSectorsExpanded] = useState(false);
  const [skillsExpanded, setSkillsExpanded] = useState(false);
  const [interestsExpanded, setInterestsExpanded] = useState(false);
  const [objectivesExpanded, setObjectivesExpanded] = useState(false);
  const [hobbiesExpanded, setHobbiesExpanded] = useState(false);

  // Fetch profile and lookup data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsFetching(true);

        // Fetch profile and lookup data in parallel
        const [profileData, sectorsData, skillsData, hobbiesData] = await Promise.all([
          getProfile(),
          getSectors().catch(() => []),
          getSkills().catch(() => []),
          getHobbies().catch(() => []),
        ]);

        // Also fetch interests
        const interestsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/interests`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('p2p_access_token')}` },
        }).catch(() => null);
        const interestsData = interestsRes ? await interestsRes.json().catch(() => ({ data: [] })) : { data: [] };

        setProfile(profileData);
        setAllSectors(sectorsData);
        setAllSkills(skillsData);
        setAllInterests(interestsData.data || []);
        setAllHobbies(hobbiesData);

        setFormData({
          fullName: profileData.fullName || '',
          email: profileData.email || '',
          phone: profileData.phone || '',
          phoneCountryCode: profileData.phoneCountryCode || '',
          company: profileData.company || '',
          jobTitle: profileData.jobTitle || '',
          location: profileData.location || '',
          linkedinUrl: profileData.linkedinUrl || '',
          websiteUrl: profileData.websiteUrl || '',
        });

        // Set bio states - if existing bio is long, use it as full and generate summary
        const existingBio = profileData.bio || '';
        setBioFull(existingBio);
        if (existingBio.length > 300) {
          let summary = existingBio.slice(0, 300);
          const lastPeriod = summary.lastIndexOf('.');
          if (lastPeriod > 150) {
            summary = summary.slice(0, lastPeriod + 1);
          } else {
            summary = summary.trim() + '...';
          }
          setBioSummary(summary);
        } else {
          setBioSummary(existingBio);
        }

        // Set selected items from profile
        setSelectedSectorIds(profileData.sectors?.map(s => s.id) || []);
        setSelectedSkillIds(profileData.skills?.map(s => s.id) || []);
        setSelectedInterestIds(profileData.interests?.map(i => i.id) || []);
        setSelectedObjectiveTypes(profileData.goals?.map(g => g.type) || []);
        setSelectedHobbyIds(profileData.hobbies?.map(h => h.id) || []);
      } catch (error: any) {
        console.error('Error fetching profile:', error);
        toast({
          title: t.common?.error || 'Error',
          description: 'Failed to load profile',
          variant: 'error',
        });
      } finally {
        setIsFetching(false);
      }
    };

    fetchData();
  }, [t]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: t.common?.error || 'Error',
        description: 'Please select an image file',
        variant: 'error',
      });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: t.common?.error || 'Error',
        description: 'File size must be less than 5MB',
        variant: 'error',
      });
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const result = await uploadAvatar(file);
      setProfile(prev => prev ? { ...prev, avatarUrl: result.avatarUrl } : null);
      toast({
        title: t.profile?.avatarUpdated || 'Avatar Updated',
        variant: 'success',
      });
      // Refresh user data
      refreshUser?.();
    } catch (error: any) {
      toast({
        title: t.common?.error || 'Error',
        description: error.message || 'Failed to upload avatar',
        variant: 'error',
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.fullName.trim()) {
      toast({
        title: t.common?.error || 'Error',
        description: 'Name is required',
        variant: 'error',
      });
      return;
    }

    setIsLoading(true);
    try {
      // Update basic profile (use full bio for storage, fall back to summary)
      await updateProfile({
        fullName: formData.fullName,
        phone: formData.phone || undefined,
        phoneCountryCode: formData.phoneCountryCode || undefined,
        company: formData.company || undefined,
        jobTitle: formData.jobTitle || undefined,
        bio: bioFull || bioSummary || undefined,
        location: formData.location || undefined,
        linkedinUrl: formData.linkedinUrl || undefined,
        websiteUrl: formData.websiteUrl || undefined,
      });

      // Update sectors, skills, interests, objectives, hobbies in parallel
      await Promise.all([
        updateSectors(selectedSectorIds.map(id => ({ sectorId: id }))),
        updateSkills(selectedSkillIds.map(id => ({ skillId: id }))),
        updateInterests(selectedInterestIds.map(id => ({ interestId: id }))),
        updateGoals(selectedObjectiveTypes.map((type, index) => ({ type, priority: index + 1 }))),
        updateHobbies(selectedHobbyIds.map(id => ({ hobbyId: id }))),
      ]);

      toast({
        title: t.profile?.profileUpdated || 'Profile Updated',
        variant: 'success',
      });

      // Refresh user data
      refreshUser?.();
      router.push('/profile');
    } catch (error: any) {
      toast({
        title: t.common?.error || 'Error',
        description: error.message || 'Failed to update profile',
        variant: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle functions
  const toggleSector = (id: string) => {
    setSelectedSectorIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSkill = (id: string) => {
    setSelectedSkillIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleInterest = (id: string) => {
    setSelectedInterestIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleObjective = (type: string) => {
    setSelectedObjectiveTypes(prev => prev.includes(type) ? prev.filter(x => x !== type) : [...prev, type]);
  };

  const toggleHobby = (id: string) => {
    setSelectedHobbyIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const inputClass = "w-full ps-12 pe-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50";

  if (isFetching) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin h-10 w-10 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-20">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 hover:bg-th-surface-h rounded-lg transition-colors">
          <ArrowLeft24Regular className="w-5 h-5 text-th-text-t rtl:rotate-180" />
        </button>
        <h1 className="text-2xl font-bold text-th-text">{t.profile?.editProfile || 'Edit Profile'}</h1>
      </div>

      {/* Avatar Section */}
      <div className="flex justify-center mb-8">
        <div className="relative">
          <div className="p-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full">
            <Avatar
              src={profile?.avatarUrl}
              name={formData.fullName || 'User'}
              size="2xl"
            />
          </div>
          <label className="absolute bottom-0 right-0 p-2 bg-emerald-500 rounded-full cursor-pointer hover:bg-emerald-600 transition-colors">
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
              disabled={isUploadingAvatar}
            />
            {isUploadingAvatar ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Edit24Regular className="w-5 h-5 text-th-text" />
            )}
          </label>
        </div>
      </div>

      <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-2xl p-6 space-y-5">
        {/* Full Name */}
        <div>
          <label className="block text-sm font-medium text-th-text-s mb-2">
            {t.profile?.form?.name || 'Full Name'} *
          </label>
          <div className="relative">
            <Person24Regular className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-th-text-m" />
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleInputChange}
              placeholder="John Doe"
              className={inputClass}
            />
          </div>
        </div>

        {/* Email (read-only) */}
        <div>
          <label className="block text-sm font-medium text-th-text-s mb-2">
            {t.profile?.form?.email || 'Email'}
          </label>
          <div className="relative">
            <Mail24Regular className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-th-text-m" />
            <input
              type="email"
              name="email"
              value={formData.email}
              disabled
              className={`${inputClass} opacity-50 cursor-not-allowed`}
            />
          </div>
          <p className="text-xs text-th-text-m mt-1">{t.profile?.emailReadOnly || 'Email cannot be changed'}</p>
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-th-text-s mb-2">
            {t.profile?.form?.phone || 'Phone'}
          </label>
          <PhoneInput
            value={formData.phone}
            onChange={(phone) => setFormData(prev => ({ ...prev, phone }))}
            onCountryChange={(countryCode) => setFormData(prev => ({ ...prev, phoneCountryCode: countryCode }))}
            placeholder="50 123 4567"
            defaultCountry={formData.phoneCountryCode || detectedCountry}
          />
        </div>

        {/* Company & Job Title */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-th-text-s mb-2">
              {t.profile?.form?.company || 'Company'}
            </label>
            <div className="relative">
              <Building24Regular className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-th-text-m" />
              <input
                type="text"
                name="company"
                value={formData.company}
                onChange={handleInputChange}
                placeholder="Company Inc."
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-th-text-s mb-2">
              {t.profile?.form?.jobTitle || 'Job Title'}
            </label>
            <div className="relative">
              <Briefcase24Regular className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-th-text-m" />
              <input
                type="text"
                name="jobTitle"
                value={formData.jobTitle}
                onChange={handleInputChange}
                placeholder="CEO"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-th-text-s mb-2">
            {t.profile?.form?.location || 'Location'}
          </label>
          <div className="relative">
            <Location24Regular className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-th-text-m" />
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              placeholder="New York, USA"
              className={inputClass}
            />
          </div>
        </div>

        {/* Links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-th-text-s mb-2">LinkedIn</label>
            <div className="relative">
              <Link24Regular className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-th-text-m" />
              <input
                type="url"
                name="linkedinUrl"
                value={formData.linkedinUrl}
                onChange={handleInputChange}
                placeholder="linkedin.com/in/..."
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-th-text-s mb-2">
              {t.profile?.form?.website || 'Website'}
            </label>
            <div className="relative">
              <Globe24Regular className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-th-text-m" />
              <input
                type="url"
                name="websiteUrl"
                value={formData.websiteUrl}
                onChange={handleInputChange}
                placeholder="example.com"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Bio with Tabs */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center gap-2 text-sm font-medium text-th-text-s">
              <DocumentText24Regular className="w-4 h-4" />
              {t.profile?.form?.bio || 'Bio'}
            </label>
            <button
              type="button"
              onClick={() => setIsBioDialogOpen(true)}
              className="flex items-center gap-1.5 px-2 py-1 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-colors"
            >
              <FullScreenMaximize24Regular className="w-4 h-4" />
              {t.onboarding?.bioPreview?.expand || 'Expand'}
            </button>
          </div>

          {/* Bio Tabs */}
          {(() => {
            const isRtl = lang === 'ar' || /[\u0600-\u06FF]/.test((bioFull || bioSummary).slice(0, 50));
            return (
              <>
                <div className={`flex gap-1 mb-3 p-1 bg-th-surface rounded-lg ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <button
                    type="button"
                    onClick={() => setActiveBioTab('summary')}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeBioTab === 'summary'
                        ? 'bg-emerald-500 text-white'
                        : 'text-th-text-t hover:text-th-text hover:bg-th-surface'
                    }`}
                  >
                    {t.onboarding?.cvBio?.summarized || 'Summary'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveBioTab('full')}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeBioTab === 'full'
                        ? 'bg-emerald-500 text-white'
                        : 'text-th-text-t hover:text-th-text hover:bg-th-surface'
                    }`}
                  >
                    {t.onboarding?.cvBio?.fullBio || 'Full Bio'}
                  </button>
                </div>

                {activeBioTab === 'summary' ? (
                  <>
                    <textarea
                      value={bioSummary}
                      onChange={(e) => setBioSummary(e.target.value)}
                      placeholder={t.onboarding?.cvBio?.summaryPlaceholder || 'Key highlights of your professional background...'}
                      rows={4}
                      maxLength={300}
                      dir={isRtl ? 'rtl' : 'ltr'}
                      style={{ textAlign: isRtl ? 'right' : 'left' }}
                      className="w-full px-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
                    />
                    <div className={`flex justify-between mt-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <span className="text-xs text-th-text-m">{t.onboarding?.cvBio?.summaryTip || 'Key points only'}</span>
                      <span className={`text-xs ${bioSummary.length > 270 ? 'text-yellow-400' : 'text-th-text-m'}`}>
                        {bioSummary.length}/300
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <textarea
                      value={bioFull}
                      onChange={(e) => setBioFull(e.target.value)}
                      placeholder={t.onboarding?.cvBio?.fullPlaceholder || 'Detailed professional background, experience, and achievements...'}
                      rows={8}
                      maxLength={2000}
                      dir={isRtl ? 'rtl' : 'ltr'}
                      style={{ textAlign: isRtl ? 'right' : 'left' }}
                      className="w-full px-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder-th-text-m focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
                    />
                    <div className={`flex justify-between mt-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <span className="text-xs text-th-text-m">{t.onboarding?.cvBio?.fullTip || 'Complete details'}</span>
                      <span className={`text-xs ${bioFull.length > 1800 ? 'text-yellow-400' : 'text-th-text-m'}`}>
                        {bioFull.length}/2000
                      </span>
                    </div>
                  </>
                )}
              </>
            );
          })()}
        </div>

        {/* Bio Preview Dialog */}
        <BioPreviewDialog
          isOpen={isBioDialogOpen}
          onClose={() => setIsBioDialogOpen(false)}
          bioSummary={bioSummary}
          bioFull={bioFull}
          activeBioTab={activeBioTab}
          onBioSummaryChange={setBioSummary}
          onBioFullChange={setBioFull}
          onBioTabChange={setActiveBioTab}
          t={t}
          lang={lang}
        />

        {/* Sectors */}
        <div className="pt-4 border-t border-th-border">
          <div className="flex items-center justify-between mb-3">
            <label className="flex items-center gap-2 text-sm font-medium text-th-text-s">
              <Briefcase24Regular className="w-4 h-4 text-emerald-400" />
              {t.profile?.sectors || 'Industry Sectors'}
              {selectedSectorIds.length > 0 && <span className="text-xs text-emerald-400">({selectedSectorIds.length})</span>}
            </label>
            <button type="button" onClick={() => setSectorsExpanded(!sectorsExpanded)} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
              {sectorsExpanded ? <><ChevronUp24Regular className="w-4 h-4" />Less</> : <><ChevronDown24Regular className="w-4 h-4" />More</>}
            </button>
          </div>
          <div className={`flex flex-wrap gap-2 overflow-y-auto scrollbar-purple transition-all ${sectorsExpanded ? 'max-h-64' : 'max-h-24'}`}>
            {allSectors.map((sector) => (
              <button key={sector.id} type="button" onClick={() => toggleSector(sector.id)}
                className={`px-3 py-1.5 rounded-full text-sm transition-all ${selectedSectorIds.includes(sector.id) ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white' : 'bg-th-surface border border-th-border text-th-text-t hover:bg-th-surface-h'}`}>
                {sector.name}
              </button>
            ))}
          </div>
        </div>

        {/* Skills */}
        <div className="pt-4 border-t border-th-border">
          <div className="flex items-center justify-between mb-3">
            <label className="flex items-center gap-2 text-sm font-medium text-th-text-s">
              <Star24Regular className="w-4 h-4 text-cyan-400" />
              {t.profile?.skills || 'Skills'}
              {selectedSkillIds.length > 0 && <span className="text-xs text-cyan-400">({selectedSkillIds.length})</span>}
            </label>
            <button type="button" onClick={() => setSkillsExpanded(!skillsExpanded)} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
              {skillsExpanded ? <><ChevronUp24Regular className="w-4 h-4" />Less</> : <><ChevronDown24Regular className="w-4 h-4" />More</>}
            </button>
          </div>
          <div className={`flex flex-wrap gap-2 overflow-y-auto scrollbar-purple transition-all ${skillsExpanded ? 'max-h-64' : 'max-h-24'}`}>
            {allSkills.map((skill) => (
              <button key={skill.id} type="button" onClick={() => toggleSkill(skill.id)}
                className={`px-3 py-1.5 rounded-full text-sm transition-all ${selectedSkillIds.includes(skill.id) ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white' : 'bg-th-surface border border-th-border text-th-text-t hover:bg-th-surface-h'}`}>
                {skill.name}
              </button>
            ))}
          </div>
        </div>

        {/* Interests */}
        <div className="pt-4 border-t border-th-border">
          <div className="flex items-center justify-between mb-3">
            <label className="flex items-center gap-2 text-sm font-medium text-th-text-s">
              <Heart24Regular className="w-4 h-4 text-emerald-400" />
              {t.profile?.interestsLabel || 'Interests'}
              {selectedInterestIds.length > 0 && <span className="text-xs text-emerald-400">({selectedInterestIds.length})</span>}
            </label>
            <button type="button" onClick={() => setInterestsExpanded(!interestsExpanded)} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
              {interestsExpanded ? <><ChevronUp24Regular className="w-4 h-4" />Less</> : <><ChevronDown24Regular className="w-4 h-4" />More</>}
            </button>
          </div>
          <div className={`flex flex-wrap gap-2 overflow-y-auto scrollbar-purple transition-all ${interestsExpanded ? 'max-h-64' : 'max-h-24'}`}>
            {allInterests.map((interest) => (
              <button key={interest.id} type="button" onClick={() => toggleInterest(interest.id)}
                className={`px-3 py-1.5 rounded-full text-sm transition-all ${selectedInterestIds.includes(interest.id) ? 'bg-gradient-to-r from-emerald-500 to-red-500 text-white' : 'bg-th-surface border border-th-border text-th-text-t hover:bg-th-surface-h'}`}>
                {interest.name}
              </button>
            ))}
          </div>
        </div>

        {/* Objectives */}
        <div className="pt-4 border-t border-th-border">
          <div className="flex items-center justify-between mb-3">
            <label className="flex items-center gap-2 text-sm font-medium text-th-text-s">
              <Target24Regular className="w-4 h-4 text-green-400" />
              {t.profile?.objectives || 'Networking Objectives'}
              {selectedObjectiveTypes.length > 0 && <span className="text-xs text-green-400">({selectedObjectiveTypes.length})</span>}
            </label>
            <button type="button" onClick={() => setObjectivesExpanded(!objectivesExpanded)} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
              {objectivesExpanded ? <><ChevronUp24Regular className="w-4 h-4" />Less</> : <><ChevronDown24Regular className="w-4 h-4" />More</>}
            </button>
          </div>
          <div className={`flex flex-wrap gap-2 overflow-y-auto scrollbar-purple transition-all ${objectivesExpanded ? 'max-h-64' : 'max-h-24'}`}>
            {OBJECTIVE_OPTIONS.map((objective) => (
              <button key={objective.id} type="button" onClick={() => toggleObjective(objective.id)}
                className={`px-3 py-1.5 rounded-full text-sm transition-all ${selectedObjectiveTypes.includes(objective.id) ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white' : 'bg-th-surface border border-th-border text-th-text-t hover:bg-th-surface-h'}`}>
                {objective.name}
              </button>
            ))}
          </div>
        </div>

        {/* Hobbies */}
        <div className="pt-4 border-t border-th-border">
          <div className="flex items-center justify-between mb-3">
            <label className="flex items-center gap-2 text-sm font-medium text-th-text-s">
              <Sparkle24Regular className="w-4 h-4 text-yellow-400" />
              {t.profile?.hobbies || 'Hobbies'}
              {selectedHobbyIds.length > 0 && <span className="text-xs text-yellow-400">({selectedHobbyIds.length})</span>}
            </label>
            <button type="button" onClick={() => setHobbiesExpanded(!hobbiesExpanded)} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
              {hobbiesExpanded ? <><ChevronUp24Regular className="w-4 h-4" />Less</> : <><ChevronDown24Regular className="w-4 h-4" />More</>}
            </button>
          </div>
          <div className={`flex flex-wrap gap-2 overflow-y-auto scrollbar-purple transition-all ${hobbiesExpanded ? 'max-h-64' : 'max-h-24'}`}>
            {allHobbies.map((hobby) => (
              <button key={hobby.id} type="button" onClick={() => toggleHobby(hobby.id)}
                className={`px-3 py-1.5 rounded-full text-sm transition-all ${selectedHobbyIds.includes(hobby.id) ? 'bg-gradient-to-r from-yellow-500 to-cyan-500 text-white' : 'bg-th-surface border border-th-border text-th-text-t hover:bg-th-surface-h'}`}>
                {hobby.name}
              </button>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSubmit}
          disabled={isLoading || !formData.fullName.trim()}
          className="relative w-full group mt-4"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl blur-lg opacity-50 group-hover:opacity-80 transition-opacity" />
          <span className="relative flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50">
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t.common?.saving || 'Saving...'}
              </>
            ) : (
              <>
                <Save24Regular className="w-5 h-5" />
                {t.profile?.saveChanges || 'Save Changes'}
              </>
            )}
          </span>
        </button>

        {/* Cancel Button */}
        <div className="flex justify-center">
          <button
            onClick={() => router.back()}
            className="px-8 py-3 rounded-xl border border-th-border text-th-text-s hover:bg-th-surface transition-all"
          >
            {t.common?.cancel || 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}
