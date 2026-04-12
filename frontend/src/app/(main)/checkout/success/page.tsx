'use client';

/**
 * Checkout Success Page
 *
 * Displayed after successful payment completion.
 * Verifies payment status and shows confirmation.
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { paymentsApi, Payment } from '@/lib/api/payments';
import {
  Checkmark24Filled,
  ArrowRight24Regular,
  Clock24Regular,
  Dismiss24Filled,
  Receipt24Regular,
} from '@fluentui/react-icons';

type PageState = 'loading' | 'success' | 'pending' | 'failed' | 'error';

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const cartId = searchParams.get('cart_id');

  const [pageState, setPageState] = useState<PageState>('loading');
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (cartId) {
      fetchPayment();
    } else {
      setError('No payment reference found');
      setPageState('error');
    }
  }, [cartId]);

  // Retry fetching payment if pending (PayTabs callback might not have arrived yet)
  useEffect(() => {
    if (pageState === 'pending' && retryCount < 5) {
      const timer = setTimeout(() => {
        setRetryCount((prev) => prev + 1);
        fetchPayment();
      }, 3000); // Retry every 3 seconds

      return () => clearTimeout(timer);
    }
  }, [pageState, retryCount]);

  const fetchPayment = async () => {
    try {
      const data = await paymentsApi.getPayment(cartId!);
      setPayment(data);

      switch (data.status) {
        case 'APPROVED':
          setPageState('success');
          break;
        case 'PENDING':
          setPageState('pending');
          break;
        case 'DECLINED':
        case 'CANCELLED':
        case 'EXPIRED':
          setPageState('failed');
          break;
        default:
          setPageState('pending');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify payment');
      setPageState('error');
    }
  };

  // Loading state
  if (pageState === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-th-text-t">Verifying your payment...</p>
        </div>
      </div>
    );
  }

  // Success state
  if (pageState === 'success' && payment) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Checkmark24Filled className="w-10 h-10 text-green-400" />
        </div>

        <h1 className="text-3xl font-bold text-th-text mb-4">Payment Successful!</h1>
        <p className="text-th-text-t mb-8">
          Welcome to IntellMatch {payment.plan}! Your subscription is now active.
        </p>

        <div className="bg-th-surface border border-th-border rounded-2xl p-6 mb-8 text-left">
          <div className="flex items-center gap-2 mb-4">
            <Receipt24Regular className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-th-text">Payment Details</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-th-text-t">Plan</span>
              <span className="text-th-text font-medium">{payment.plan}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-th-text-t">Amount</span>
              <span className="text-th-text">
                ${payment.amount} {payment.currency}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-th-text-t">Billing</span>
              <span className="text-th-text">{payment.billingInterval}</span>
            </div>
            {payment.seats > 1 && (
              <div className="flex justify-between">
                <span className="text-th-text-t">Seats</span>
                <span className="text-th-text">{payment.seats}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-th-text-t">Reference</span>
              <span className="text-th-text-s text-xs font-mono">
                {payment.cartId}
              </span>
            </div>
          </div>
        </div>

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-emerald-500/25 transition-all"
        >
          Go to Dashboard
          <ArrowRight24Regular className="w-5 h-5" />
        </Link>

        <p className="text-th-text-m text-sm mt-6">
          A receipt has been sent to your email.
        </p>
      </div>
    );
  }

  // Pending state
  if (pageState === 'pending') {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Clock24Regular className="w-10 h-10 text-yellow-400" />
        </div>

        <h1 className="text-3xl font-bold text-th-text mb-4">Payment Processing</h1>
        <p className="text-th-text-t mb-8">
          Your payment is being verified. This usually takes a few moments.
          {retryCount > 0 && (
            <span className="block mt-2 text-sm">
              Checking status... ({retryCount}/5)
            </span>
          )}
        </p>

        {retryCount >= 5 && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-8">
            <p className="text-yellow-300 text-sm">
              Payment verification is taking longer than expected.
              If you were charged, your subscription will be activated automatically.
              You can also check your subscription status in settings.
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={fetchPayment}
            className="px-6 py-3 bg-th-surface-h text-th-text rounded-xl font-medium hover:bg-th-surface-h transition-colors"
          >
            Check Status
          </button>
          <Link
            href="/dashboard"
            className="px-6 py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Failed state
  if (pageState === 'failed' && payment) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Dismiss24Filled className="w-10 h-10 text-red-400" />
        </div>

        <h1 className="text-3xl font-bold text-th-text mb-4">Payment Failed</h1>
        <p className="text-th-text-t mb-8">
          Unfortunately, your payment could not be processed.
          {payment.status === 'DECLINED' && ' The payment was declined by your bank.'}
          {payment.status === 'CANCELLED' && ' The payment was cancelled.'}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/checkout"
            className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-emerald-500/25 transition-all"
          >
            Try Again
          </Link>
          <Link
            href="/"
            className="px-6 py-3 bg-th-surface-h text-th-text rounded-xl font-medium hover:bg-th-surface-h transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // Error state
  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
        <Dismiss24Filled className="w-10 h-10 text-red-400" />
      </div>

      <h1 className="text-2xl font-bold text-th-text mb-4">Something went wrong</h1>
      <p className="text-th-text-t mb-8">{error || 'Unable to verify payment status'}</p>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link
          href="/dashboard"
          className="px-6 py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors"
        >
          Go to Dashboard
        </Link>
        <Link
          href="mailto:support@intellmatch.com"
          className="px-6 py-3 bg-th-surface-h text-th-text rounded-xl font-medium hover:bg-th-surface-h transition-colors"
        >
          Contact Support
        </Link>
      </div>
    </div>
  );
}
