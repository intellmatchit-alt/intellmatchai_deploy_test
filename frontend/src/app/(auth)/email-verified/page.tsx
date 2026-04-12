/**
 * Email Verification Result Page
 */

"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Checkmark24Regular,
  Dismiss24Regular,
  Mail24Regular,
} from "@fluentui/react-icons";

function EmailVerifiedContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"success" | "error" | "loading">(
    "loading",
  );
  const [errorType, setErrorType] = useState<string | null>(null);

  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (success === "true") {
      setStatus("success");
    } else {
      setStatus("error");
      setErrorType(error || "unknown");
    }
  }, [searchParams]);

  const getErrorMessage = (error: string | null) => {
    switch (error) {
      case "invalid_token":
        return "The verification link is invalid or has already been used.";
      case "token_expired":
        return "The verification link has expired. Please request a new one.";
      case "token_already_used":
        return "This verification link has already been used.";
      default:
        return "An error occurred while verifying your email.";
    }
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-10 w-10 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-emerald-500/20 rounded-3xl blur-xl" />
      <div className="relative bg-th-surface backdrop-blur-xl border border-th-border rounded-2xl p-8 shadow-2xl text-center">
        {status === "success" ? (
          <>
            {/* Success Icon */}
            <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center mb-6">
              <Checkmark24Regular className="w-10 h-10 text-th-text" />
            </div>

            <h1 className="text-3xl font-bold text-th-text mb-4">
              Email Verified!
            </h1>
            <p className="text-th-text-t mb-8">
              Your email has been successfully verified. You can now access all
              features of IntellMatch.
            </p>

            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all"
            >
              Continue to Login
            </Link>
          </>
        ) : (
          <>
            {/* Error Icon */}
            <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-r from-red-500 to-orange-500 flex items-center justify-center mb-6">
              <Dismiss24Regular className="w-10 h-10 text-th-text" />
            </div>

            <h1 className="text-3xl font-bold text-th-text mb-4">
              Verification Failed
            </h1>
            <p className="text-th-text-t mb-8">{getErrorMessage(errorType)}</p>

            <div className="space-y-4">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 w-full px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all"
              >
                Go to Login
              </Link>

              <button
                onClick={async () => {
                  // This would need to be connected to actual resend functionality
                  alert(
                    "Please login and request a new verification email from your profile settings.",
                  );
                }}
                className="inline-flex items-center justify-center gap-2 w-full px-8 py-3 border border-th-border text-th-text-s font-semibold rounded-xl hover:bg-th-surface transition-all"
              >
                <Mail24Regular className="w-5 h-5" />
                Request New Verification Email
              </button>
            </div>
          </>
        )}

        <p className="text-th-text-m text-sm mt-8">
          Need help?{" "}
          <a
            href="mailto:support@p2pnetwork.com"
            className="text-emerald-400 hover:text-emerald-300"
          >
            Contact Support
          </a>
        </p>
      </div>
    </div>
  );
}

export default function EmailVerifiedPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin h-10 w-10 border-4 border-emerald-500 border-t-transparent rounded-full" />
        </div>
      }
    >
      <EmailVerifiedContent />
    </Suspense>
  );
}
