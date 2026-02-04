/**
 * Types for Create Ads page
 */

import { User, FileVideo, Target, Newspaper, Rocket } from 'lucide-react';

export interface UploadedMedia {
  name: string;        // Facebook video ID
  title?: string;      // Video title/name for display
  path: string;        // Video source URL
  thumbnail?: string;  // Thumbnail URL (publicly accessible)
  createdAt?: string;  // ISO created_time
  size?: number;
}

export interface Beneficiary {
  id: string;
  name: string;
}

export interface ProgressStep {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'completed' | 'error';
}

export interface FormState {
  adAccountId: string;
  pageId: string;
  campaignObjective: string;
  targetCountry: string;
  placements: string[];
  dailyBudget: number;
  ageMin: number;
  ageMax: number;
  campaignCount: number;
  adSetsCount: number;
  adsCount: number;
  productContext: string;
  beneficiaryId: string;
}

export interface AdAccount {
  id: string;
  name: string;
  account_id: string;
  currency?: string;
}

export interface Page {
  id: string;
  name: string;
  picture?: { data?: { url?: string } };
}

export interface IceBreaker {
  question: string;
  payload: string;
}

export interface SavedTemplate {
  id: string;
  name: string;
  iceBreakers: IceBreaker[];
}

export const STEPS = [
  { id: 1, labelKey: 'createAds.steps.identity', label: 'บัญชีและเพจ', icon: User, iconClass: 'text-sky-500' },
  { id: 2, labelKey: 'createAds.steps.content', label: 'สื่อโฆษณา', icon: FileVideo, iconClass: 'text-violet-500' },
  { id: 3, labelKey: 'createAds.steps.strategyBudget', label: 'Strategy & Budget', icon: Target, iconClass: 'text-amber-500' },
  { id: 4, labelKey: 'createAds.steps.ads', label: 'ข้อความโฆษณา & แชท', icon: Newspaper, iconClass: 'text-emerald-500' },
  { id: 5, labelKey: 'createAds.steps.review', label: 'Review & Launch', icon: Rocket, iconClass: 'text-orange-500' },
];

export const COUNTRIES = [
  { code: 'TH', name: 'Thailand' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'SG', name: 'Singapore' },
  { code: 'PH', name: 'Philippines' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
];

export const DEFAULT_FORM_STATE: FormState = {
  adAccountId: '',
  pageId: '',
  campaignObjective: 'OUTCOME_ENGAGEMENT',
  targetCountry: 'TH',
  placements: ['facebook', 'instagram', 'messenger'],
  dailyBudget: 400,
  ageMin: 20,
  ageMax: 50,
  campaignCount: 1,
  adSetsCount: 1,
  adsCount: 1,
  productContext: '',
  beneficiaryId: '',
};
