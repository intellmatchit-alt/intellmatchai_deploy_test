/**
 * Refund Policy Page
 */

'use client';

import Link from 'next/link';
import { ArrowLeft24Regular } from '@fluentui/react-icons';

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-th-bg text-th-text">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-th-nav-header backdrop-blur-xl border-b border-th-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/register" className="p-2 hover:bg-th-surface-h rounded-lg transition-colors">
            <ArrowLeft24Regular className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-semibold">Refund Policy</h1>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="prose prose-invert prose-emerald max-w-none">
          <p className="text-th-text-t mb-8">Last updated: January 2024</p>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-th-text mb-4">Overview</h2>
            <p className="text-th-text-s leading-relaxed">
              At IntellMatch, we want you to be completely satisfied with your subscription. This Refund Policy
              outlines our guidelines for refunds and cancellations.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-th-text mb-4">Free Trial</h2>
            <p className="text-th-text-s leading-relaxed">
              We offer a 7-day free trial for new users. During this period, you have full access to all Pro features.
              No payment is required during the trial, and you can cancel at any time without any charges.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-th-text mb-4">Subscription Cancellation</h2>
            <div className="bg-th-surface border border-th-border rounded-xl p-6 mb-4">
              <h3 className="text-lg font-semibold text-th-text mb-3">Monthly Subscriptions</h3>
              <ul className="list-disc list-inside text-th-text-s space-y-2">
                <li>You may cancel your subscription at any time</li>
                <li>Access continues until the end of your current billing period</li>
                <li>No partial refunds for unused days in the current month</li>
                <li>No automatic renewal after cancellation</li>
              </ul>
            </div>
            <div className="bg-th-surface border border-th-border rounded-xl p-6">
              <h3 className="text-lg font-semibold text-th-text mb-3">Annual Subscriptions</h3>
              <ul className="list-disc list-inside text-th-text-s space-y-2">
                <li>Full refund available within 30 days of purchase</li>
                <li>Pro-rated refund available within 90 days of purchase</li>
                <li>No refunds after 90 days from purchase date</li>
                <li>Access continues until the end of your current billing period</li>
              </ul>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-th-text mb-4">Refund Eligibility</h2>
            <p className="text-th-text-s leading-relaxed mb-4">
              You may be eligible for a refund if:
            </p>
            <ul className="list-disc list-inside text-th-text-s space-y-2">
              <li>You experience technical issues that prevent you from using the Service</li>
              <li>You were charged incorrectly or multiple times</li>
              <li>You cancel within the refund period specified above</li>
              <li>The Service was significantly different from what was advertised</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-th-text mb-4">Non-Refundable Items</h2>
            <p className="text-th-text-s leading-relaxed mb-4">
              The following are not eligible for refunds:
            </p>
            <ul className="list-disc list-inside text-th-text-s space-y-2">
              <li>Subscriptions cancelled after the refund period</li>
              <li>Accounts terminated for Terms of Service violations</li>
              <li>One-time purchases or add-ons (unless defective)</li>
              <li>Services already rendered or consumed</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-th-text mb-4">How to Request a Refund</h2>
            <div className="bg-gradient-to-r from-emerald-500/10 to-emerald-500/10 border border-emerald-500/20 rounded-xl p-6">
              <p className="text-th-text-s leading-relaxed mb-4">
                To request a refund, please follow these steps:
              </p>
              <ol className="list-decimal list-inside text-th-text-s space-y-3">
                <li>
                  <span className="font-medium text-th-text">Contact Support:</span> Email us at{' '}
                  <span className="text-emerald-400">support@p2pnetwork.com</span> with your request
                </li>
                <li>
                  <span className="font-medium text-th-text">Provide Details:</span> Include your account email,
                  subscription type, and reason for refund
                </li>
                <li>
                  <span className="font-medium text-th-text">Wait for Review:</span> We will review your request
                  within 3-5 business days
                </li>
                <li>
                  <span className="font-medium text-th-text">Receive Confirmation:</span> You will receive an email
                  confirming the refund decision
                </li>
              </ol>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-th-text mb-4">Refund Processing</h2>
            <p className="text-th-text-s leading-relaxed mb-4">
              Once approved, refunds will be processed as follows:
            </p>
            <ul className="list-disc list-inside text-th-text-s space-y-2">
              <li>Refunds are issued to the original payment method</li>
              <li>Credit card refunds may take 5-10 business days to appear</li>
              <li>Bank transfers may take up to 14 business days</li>
              <li>You will receive a confirmation email when the refund is processed</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-th-text mb-4">Enterprise Plans</h2>
            <p className="text-th-text-s leading-relaxed">
              Enterprise customers with custom agreements should refer to their specific contract terms regarding
              refunds and cancellations. Please contact your account manager for assistance.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-th-text mb-4">Changes to This Policy</h2>
            <p className="text-th-text-s leading-relaxed">
              We reserve the right to modify this Refund Policy at any time. Changes will be effective immediately
              upon posting to our website. Your continued use of the Service after any changes indicates your
              acceptance of the new terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-th-text mb-4">Contact Us</h2>
            <p className="text-th-text-s leading-relaxed">
              If you have any questions about our Refund Policy, please contact us:
            </p>
            <div className="mt-4 space-y-2">
              <p className="text-th-text-s">
                <span className="text-th-text-m">Email:</span>{' '}
                <span className="text-emerald-400">support@p2pnetwork.com</span>
              </p>
              <p className="text-th-text-s">
                <span className="text-th-text-m">Response Time:</span> Within 24-48 hours
              </p>
            </div>
          </section>
        </div>

        {/* Back to Registration */}
        <div className="mt-12 pt-8 border-t border-th-border">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <ArrowLeft24Regular className="w-4 h-4" />
            Back to Registration
          </Link>
        </div>
      </main>
    </div>
  );
}
