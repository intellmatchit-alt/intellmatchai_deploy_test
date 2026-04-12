'use client';

import React, { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import axios from 'axios';

export default function LinkedInCallbackPage() {
  return (
    // Suspense is required by Next.js when using useSearchParams in a Client Component
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
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  useEffect(() => {
    console.log(code);
    
    const handleLinkedInLogin = async () => {
      // 1. If no code is present, redirect to login immediately
      if (!code) {
        console.error("No authorization code found in URL");
        router.push('/login');
        return;
      }

      try {
        // 2. Define your Backend API Endpoint
        const BACKEND_URL = 'http://10.200.56.22:3001/api/v1/auth/linkedin'; 

        // 3. Construct the exact redirectUri that LinkedIn expects
        const redirectUri = window.location.origin + window.location.pathname;
        

        // 4. Call your Backend
        const response = await axios.post(BACKEND_URL, {
          code,
          redirectUri,
          state // Sending state is good practice for security
        });
        console.log("response",response);
        
        if (response.data.success) {
          // 5. MATCHING YOUR BACKEND DATA:
          // Your backend returns: { success: true, data: { linkedinId, email, name, ... } }
          const profileData = response.data.data;
          
          // Save profile info to local storage for use in the dashboard
          localStorage.setItem('user_name', profileData.name);
          localStorage.setItem('user_email', profileData.email);
          localStorage.setItem('user_avatar', profileData.picture);
          
          // Note: If your backend later generates a JWT, save it here:
          // localStorage.setItem('auth_token', response.data.token);

          console.log("LinkedIn Login Successful:", profileData);
          
          // 6. Final Redirect
          router.push('/dashboard');
        } else {
          throw new Error("Backend verification failed");
        }
      } catch (error: any) {
        console.error("LinkedIn Auth Error:", error.response?.data || error.message);
        // Redirect to login with a query param to show an error message to the user
        router.push('/login?error=linkedin_auth_failed');
      }
    };

    handleLinkedInLogin();
  }, [code, state, router]);

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
          We're finalizing your secure sign-in with LinkedIn. Please don't close this window.
        </p>
      </div>
    </div>
  );
}