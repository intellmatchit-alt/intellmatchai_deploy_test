/**
 * Autocomplete Input Component
 *
 * Provides Google-like word suggestions as user types.
 * Shows suggestions after 2+ characters are typed.
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

// Common professional words dictionary
const COMMON_WORDS = {
  // Job Titles
  jobTitles: [
    'CEO', 'CTO', 'CFO', 'COO', 'CMO', 'CIO', 'CHRO',
    'Founder', 'Co-Founder', 'Co-founder',
    'President', 'Vice President', 'VP',
    'Director', 'Senior Director', 'Managing Director',
    'Manager', 'Senior Manager', 'Project Manager', 'Product Manager', 'General Manager',
    'Head', 'Head of', 'Team Lead', 'Tech Lead',
    'Engineer', 'Software Engineer', 'Senior Software Engineer', 'Staff Engineer', 'Principal Engineer',
    'Developer', 'Software Developer', 'Web Developer', 'Mobile Developer', 'Full Stack Developer', 'Frontend Developer', 'Backend Developer',
    'Programmer', 'Senior Programmer',
    'Architect', 'Software Architect', 'Solutions Architect', 'Enterprise Architect',
    'Designer', 'UI Designer', 'UX Designer', 'Product Designer', 'Graphic Designer', 'Creative Director',
    'Analyst', 'Business Analyst', 'Data Analyst', 'Financial Analyst', 'Systems Analyst',
    'Consultant', 'Senior Consultant', 'Management Consultant', 'Strategy Consultant',
    'Specialist', 'Marketing Specialist', 'HR Specialist', 'IT Specialist',
    'Coordinator', 'Project Coordinator', 'Marketing Coordinator',
    'Administrator', 'System Administrator', 'Database Administrator', 'Office Administrator',
    'Executive', 'Account Executive', 'Sales Executive',
    'Representative', 'Sales Representative', 'Customer Service Representative',
    'Assistant', 'Executive Assistant', 'Administrative Assistant',
    'Intern', 'Associate', 'Junior', 'Senior', 'Lead', 'Principal', 'Staff',
    'Accountant', 'Lawyer', 'Attorney', 'Doctor', 'Physician', 'Nurse',
    'Teacher', 'Professor', 'Instructor', 'Trainer',
    'Scientist', 'Data Scientist', 'Research Scientist',
    'Writer', 'Content Writer', 'Technical Writer', 'Copywriter',
    'Editor', 'Marketing', 'Sales', 'Operations', 'Finance', 'Human Resources', 'HR',
  ],

  // Company/Industry terms
  business: [
    'Technology', 'Software', 'Hardware', 'IT', 'Information Technology',
    'Finance', 'Financial', 'Banking', 'Investment', 'Insurance', 'Fintech',
    'Healthcare', 'Medical', 'Pharmaceutical', 'Biotech', 'Health',
    'Education', 'EdTech', 'E-learning', 'Training',
    'Marketing', 'Advertising', 'Digital Marketing', 'Media', 'Communications',
    'Consulting', 'Advisory', 'Professional Services',
    'Manufacturing', 'Production', 'Industrial',
    'Retail', 'E-commerce', 'Commerce', 'Consumer',
    'Real Estate', 'Property', 'Construction',
    'Transportation', 'Logistics', 'Supply Chain', 'Shipping',
    'Hospitality', 'Tourism', 'Travel', 'Hotel',
    'Energy', 'Oil', 'Gas', 'Renewable', 'Utilities',
    'Telecommunications', 'Telecom', 'Networking',
    'Entertainment', 'Gaming', 'Sports', 'Music', 'Film',
    'Food', 'Beverage', 'Restaurant', 'Agriculture',
    'Government', 'Public Sector', 'Non-profit', 'NGO',
    'Startup', 'Venture', 'Capital', 'Private Equity',
    'Legal', 'Law', 'Compliance', 'Regulatory',
    'Research', 'Development', 'R&D', 'Innovation',
    'Security', 'Cybersecurity', 'Defense',
    'Artificial Intelligence', 'AI', 'Machine Learning', 'ML', 'Deep Learning',
    'Cloud', 'SaaS', 'PaaS', 'IaaS', 'Infrastructure',
    'Blockchain', 'Crypto', 'Web3', 'DeFi',
    'Data', 'Analytics', 'Big Data', 'Business Intelligence',
    'Automation', 'Robotics', 'IoT', 'Internet of Things',
    'Solutions', 'Services', 'Products', 'Platform',
    'International', 'Global', 'Regional', 'Local',
    'Corporate', 'Enterprise', 'SMB', 'Small Business',
    'Agency', 'Studio', 'Labs', 'Works', 'Group', 'Holdings',
    'Limited', 'Ltd', 'LLC', 'Inc', 'Corp', 'Corporation',
  ],

  // Skills and technologies
  skills: [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Ruby', 'Go', 'Rust', 'Swift', 'Kotlin', 'PHP',
    'React', 'Angular', 'Vue', 'Next.js', 'Node.js', 'Express', 'Django', 'Flask', 'Spring', 'Laravel',
    'HTML', 'CSS', 'SASS', 'Tailwind', 'Bootstrap',
    'SQL', 'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Elasticsearch',
    'AWS', 'Azure', 'Google Cloud', 'GCP', 'Docker', 'Kubernetes', 'DevOps', 'CI/CD',
    'Git', 'GitHub', 'GitLab', 'Bitbucket',
    'Agile', 'Scrum', 'Kanban', 'Waterfall', 'Lean',
    'Project Management', 'Product Management', 'Program Management',
    'Leadership', 'Management', 'Team Building', 'Mentoring', 'Coaching',
    'Communication', 'Presentation', 'Public Speaking', 'Negotiation',
    'Problem Solving', 'Critical Thinking', 'Decision Making', 'Strategic Planning',
    'Sales', 'Business Development', 'Account Management', 'Customer Success',
    'Marketing', 'Digital Marketing', 'Content Marketing', 'SEO', 'SEM', 'Social Media',
    'Design', 'UI/UX', 'User Experience', 'User Interface', 'Figma', 'Sketch', 'Adobe',
    'Data Analysis', 'Data Science', 'Machine Learning', 'AI', 'Deep Learning', 'NLP',
    'Finance', 'Accounting', 'Budgeting', 'Financial Planning', 'Investment',
    'Operations', 'Supply Chain', 'Logistics', 'Procurement',
    'Human Resources', 'Recruiting', 'Talent Acquisition', 'Training', 'Development',
    'Legal', 'Compliance', 'Contracts', 'Intellectual Property',
    'Research', 'Analysis', 'Strategy', 'Planning', 'Execution',
    'Writing', 'Editing', 'Content Creation', 'Copywriting', 'Technical Writing',
    'Customer Service', 'Support', 'Help Desk', 'Client Relations',
    'Networking', 'Business Networking', 'Relationship Building',
    'Entrepreneurship', 'Innovation', 'Startup', 'Business Strategy',
    'Arabic', 'English', 'French', 'Spanish', 'German', 'Chinese', 'Hindi',
    'Microsoft Office', 'Excel', 'PowerPoint', 'Word', 'Outlook',
    'Salesforce', 'HubSpot', 'Zoho', 'SAP', 'Oracle',
  ],

  // General professional words
  general: [
    'Professional', 'Experience', 'Experienced', 'Expert', 'Expertise',
    'Passionate', 'Dedicated', 'Motivated', 'Driven', 'Ambitious',
    'Creative', 'Innovative', 'Strategic', 'Analytical', 'Technical',
    'Collaborative', 'Team', 'Independent', 'Self-motivated',
    'Results', 'Results-driven', 'Goal-oriented', 'Performance',
    'Growth', 'Development', 'Learning', 'Improvement',
    'Quality', 'Excellence', 'Standards', 'Best Practices',
    'Customer', 'Client', 'User', 'Stakeholder', 'Partner',
    'Project', 'Program', 'Portfolio', 'Initiative',
    'Process', 'Workflow', 'System', 'Framework', 'Methodology',
    'Strategy', 'Planning', 'Execution', 'Implementation',
    'Budget', 'Cost', 'Revenue', 'Profit', 'ROI',
    'Timeline', 'Deadline', 'Schedule', 'Milestone',
    'Risk', 'Issue', 'Challenge', 'Opportunity',
    'Success', 'Achievement', 'Accomplishment', 'Award',
    'Certification', 'Certified', 'Licensed', 'Accredited',
    'Bachelor', 'Master', 'MBA', 'PhD', 'Degree',
    'University', 'College', 'Institute', 'Academy',
    'Years', 'Experience', 'Background', 'History',
    'Industry', 'Sector', 'Market', 'Domain',
    'Company', 'Organization', 'Business', 'Enterprise',
    'Department', 'Division', 'Unit', 'Team',
    'Role', 'Position', 'Responsibility', 'Duty',
    'Skill', 'Ability', 'Competency', 'Capability',
    'Knowledge', 'Expertise', 'Proficiency', 'Mastery',
  ],
};

// Combine all words into a single searchable list
const ALL_WORDS = [
  ...COMMON_WORDS.jobTitles,
  ...COMMON_WORDS.business,
  ...COMMON_WORDS.skills,
  ...COMMON_WORDS.general,
];

// Remove duplicates and sort
const DICTIONARY = [...new Set(ALL_WORDS)].sort();

export type AutocompleteCategory = 'all' | 'jobTitles' | 'business' | 'skills' | 'general';

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  required?: boolean;
  category?: AutocompleteCategory;
  customWords?: string[];
  minChars?: number;
  maxSuggestions?: number;
  icon?: React.ReactNode;
  label?: string;
  error?: string;
  onBlur?: () => void;
  onFocus?: () => void;
  autoFocus?: boolean;
  name?: string;
  id?: string;
}

export function AutocompleteInput({
  value,
  onChange,
  placeholder,
  className,
  inputClassName,
  disabled = false,
  required = false,
  category = 'all',
  customWords = [],
  minChars = 2,
  maxSuggestions = 8,
  icon,
  label,
  error,
  onBlur,
  onFocus,
  autoFocus,
  name,
  id,
}: AutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Get word list based on category
  const getWordList = useCallback(() => {
    const custom = customWords.length > 0 ? customWords : [];
    switch (category) {
      case 'jobTitles':
        return [...new Set([...COMMON_WORDS.jobTitles, ...custom])];
      case 'business':
        return [...new Set([...COMMON_WORDS.business, ...custom])];
      case 'skills':
        return [...new Set([...COMMON_WORDS.skills, ...custom])];
      case 'general':
        return [...new Set([...COMMON_WORDS.general, ...custom])];
      default:
        return [...new Set([...DICTIONARY, ...custom])];
    }
  }, [category, customWords]);

  // Get current word being typed (word at cursor position)
  const getCurrentWord = useCallback((text: string, cursorPos: number) => {
    // Find word boundaries around cursor
    let start = cursorPos;
    let end = cursorPos;

    // Find start of word
    while (start > 0 && !/\s/.test(text[start - 1])) {
      start--;
    }

    // Find end of word
    while (end < text.length && !/\s/.test(text[end])) {
      end++;
    }

    return {
      word: text.slice(start, end),
      start,
      end,
    };
  }, []);

  // Update suggestions based on input
  const updateSuggestions = useCallback((text: string, cursorPos: number) => {
    const { word } = getCurrentWord(text, cursorPos);

    if (word.length < minChars) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const wordList = getWordList();
    const lowerWord = word.toLowerCase();

    // Find matching words (starts with or contains)
    const matches = wordList
      .filter(w => w.toLowerCase().startsWith(lowerWord) || w.toLowerCase().includes(lowerWord))
      .sort((a, b) => {
        // Prioritize words that start with the input
        const aStarts = a.toLowerCase().startsWith(lowerWord);
        const bStarts = b.toLowerCase().startsWith(lowerWord);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.length - b.length;
      })
      .slice(0, maxSuggestions);

    setSuggestions(matches);
    setShowSuggestions(matches.length > 0);
    setSelectedIndex(-1);
  }, [getWordList, getCurrentWord, minChars, maxSuggestions]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    setCursorPosition(cursorPos);
    onChange(newValue);
    updateSuggestions(newValue, cursorPos);
  };

  // Handle suggestion selection
  const selectSuggestion = (suggestion: string) => {
    const { start, end } = getCurrentWord(value, cursorPosition);
    const newValue = value.slice(0, start) + suggestion + value.slice(end);
    onChange(newValue);
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedIndex(-1);

    // Focus back on input and set cursor after the inserted word
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newCursorPos = start + suggestion.length;
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
        break;
      case 'Enter':
        if (selectedIndex >= 0) {
          e.preventDefault();
          selectSuggestion(suggestions[selectedIndex]);
        }
        break;
      case 'Tab':
        if (selectedIndex >= 0) {
          e.preventDefault();
          selectSuggestion(suggestions[selectedIndex]);
        } else if (suggestions.length > 0) {
          e.preventDefault();
          selectSuggestion(suggestions[0]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && suggestionsRef.current) {
      const items = suggestionsRef.current.querySelectorAll('[data-suggestion]');
      items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  return (
    <div className={cn('relative', className)}>
      {label && (
        <label className="block text-sm font-medium text-th-text mb-2">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-th-text/40">
            {icon}
          </div>
        )}

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (value.length >= minChars) {
              updateSuggestions(value, cursorPosition);
            }
            onFocus?.();
          }}
          onBlur={() => {
            // Delay hiding to allow click on suggestion
            setTimeout(() => setShowSuggestions(false), 150);
            onBlur?.();
          }}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoFocus={autoFocus}
          name={name}
          id={id}
          autoComplete="off"
          className={cn(
            'w-full px-4 py-3 bg-th-surface border border-th-border rounded-xl text-th-text placeholder:text-th-text/40',
            'focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50',
            'transition-all duration-200',
            icon && 'pl-11',
            error && 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50',
            disabled && 'opacity-50 cursor-not-allowed',
            inputClassName
          )}
        />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-th-bg-s border border-th-border rounded-xl shadow-xl overflow-hidden"
        >
          <div className="max-h-60 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion}
                data-suggestion
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectSuggestion(suggestion)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={cn(
                  'w-full px-4 py-2.5 text-left text-th-text/90 hover:bg-th-surface-h transition-colors',
                  index === selectedIndex && 'bg-emerald-500/20 text-white'
                )}
              >
                <HighlightMatch text={suggestion} query={getCurrentWord(value, cursorPosition).word} />
              </button>
            ))}
          </div>
          <div className="px-3 py-1.5 bg-th-surface border-t border-th-border text-xs text-th-text/40">
            Press Tab or Enter to select
          </div>
        </div>
      )}

      {error && (
        <p className="mt-1.5 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}

// Highlight matching text in suggestion
function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) return <>{text}</>;

  return (
    <>
      {text.slice(0, index)}
      <span className="text-emerald-400 font-medium">
        {text.slice(index, index + query.length)}
      </span>
      {text.slice(index + query.length)}
    </>
  );
}

export default AutocompleteInput;
