'use client';

import React, { useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import axios from 'axios';
import { useAuth } from '@/hooks/useAuth';

export default function LinkedInCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-gray-500">Loading system...</div>
      </div>
    }>
      <LinkedInCallbackHandler />
    </Suspense>
  );
}

function LinkedInCallbackHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setTokens } = useAuth();
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const linkedInError = searchParams.get('error');
  // setTokens from useAuth is a fresh reference on every render; without a guard,
  // the effect re-fires after the first run consumes sessionStorage state, and the
  // second run falls into the state-mismatch branch.
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    const handleLinkedInLogin = async () => {
      // LinkedIn returned an error (user denied, etc.)
      if (linkedInError) {
        router.push(`/login?error=linkedin_${linkedInError}`);
        return;
      }

      if (!code) {
        router.push('/login?error=linkedin_no_code');
        return;
      }

      // Validate state to prevent CSRF
      const expectedState = sessionStorage.getItem('linkedin_oauth_state');
      if (!expectedState || expectedState !== state) {
        sessionStorage.removeItem('linkedin_oauth_state');
        router.push('/login?error=linkedin_state_mismatch');
        return;
      }
      sessionStorage.removeItem('linkedin_oauth_state');

      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
      const redirectUri = window.location.origin + window.location.pathname;

      try {
        // Step 1: exchange code for LinkedIn profile
        const profileResp = await axios.post(`${apiBase}/auth/linkedin`, {
          code,
          redirectUri,
          state,
        });

        if (!profileResp.data?.success || !profileResp.data?.data) {
          throw new Error('LinkedIn profile fetch failed');
        }

        const profile = profileResp.data.data as {
          linkedinId: string;
          email: string;
          name: string;
          firstName?: string;
          lastName?: string;
          picture?: string;
        };

        // Step 2: register-or-login with LinkedIn profile, receive JWT pair
        const sessionResp = await axios.post(`${apiBase}/auth/linkedin/register`, {
          linkedinId: profile.linkedinId,
          email: profile.email,
          name: profile.name,
          picture: profile.picture,
        });

        if (!sessionResp.data?.success || !sessionResp.data?.data?.accessToken) {
          throw new Error('LinkedIn session creation failed');
        }

        const { accessToken, refreshToken, user } = sessionResp.data.data;

        // Step 3: persist tokens and hydrate auth store
        await setTokens(accessToken, refreshToken);

        // Step 4: route based on onboarding state and any returnTo
        const returnTo = sessionStorage.getItem('linkedin_oauth_returnTo');
        sessionStorage.removeItem('linkedin_oauth_returnTo');

        if (!user?.hasCompletedOnboarding) {
          const path = returnTo
            ? `/onboarding?returnTo=${encodeURIComponent(returnTo)}`
            : '/onboarding';
          router.push(path);
        } else {
          router.push(returnTo || '/dashboard');
        }
      } catch (error: any) {
        console.error('LinkedIn auth error:', error?.response?.data || error?.message);
        router.push('/login?error=linkedin_auth_failed');
      }
    };

    handleLinkedInLogin();
  }, [code, state, linkedInError, router, setTokens]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="p-10 bg-white shadow-xl rounded-2xl text-center border border-gray-100">
        <div className="mb-6 flex justify-center">
          <div className="relative">
            <div className="h-16 w-16 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin"></div>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Authenticating</h2>
        <p className="text-gray-500 max-w-xs mx-auto">
          We&apos;re finalizing your secure sign-in with LinkedIn. Please don&apos;t close this window.
        </p>
      </div>
    </div>
  );
}
