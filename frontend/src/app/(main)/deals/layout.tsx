/**
 * Deals Layout
 *
 * Force dynamic rendering for all deals pages to prevent caching issues.
 */

// Force dynamic rendering for all child routes
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DealsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
