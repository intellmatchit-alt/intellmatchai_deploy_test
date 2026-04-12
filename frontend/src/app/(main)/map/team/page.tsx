/**
 * Team Network Graph Page
 *
 * Visual network graph showing all team members' contacts combined.
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/ui/Avatar';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { useOrganizationStore } from '@/stores/organizationStore';
import {
  getTeamNetwork,
  getTeamStats,
  TeamNetworkData,
  TeamNetworkStats,
  TeamGraphNode,
} from '@/lib/api/graph';
import {
  ZoomIn24Regular,
  ZoomOut24Regular,
  FullScreenMaximize24Regular,
  ArrowLeft24Regular,
  People24Regular,
  Link24Regular,
  Grid24Regular,
  PeopleTeam24Regular,
  Eye24Regular,
  EyeOff24Regular,
} from '@fluentui/react-icons';

/**
 * Member colors for graph visualization
 */
const memberColors = [
  { fill: '#A855F7', glow: 'rgba(168, 85, 247, 0.4)', ring: 'ring-emerald-500', bg: 'bg-emerald-500' },
  { fill: '#3B82F6', glow: 'rgba(59, 130, 246, 0.4)', ring: 'ring-blue-500', bg: 'bg-blue-500' },
  { fill: '#10B981', glow: 'rgba(16, 185, 129, 0.4)', ring: 'ring-emerald-500', bg: 'bg-emerald-500' },
  { fill: '#F59E0B', glow: 'rgba(245, 158, 11, 0.4)', ring: 'ring-amber-500', bg: 'bg-amber-500' },
  { fill: '#EF4444', glow: 'rgba(239, 68, 68, 0.4)', ring: 'ring-red-500', bg: 'bg-red-500' },
  { fill: '#EC4899', glow: 'rgba(236, 72, 153, 0.4)', ring: 'ring-emerald-500', bg: 'bg-emerald-500' },
  { fill: '#06B6D4', glow: 'rgba(6, 182, 212, 0.4)', ring: 'ring-cyan-500', bg: 'bg-cyan-500' },
  { fill: '#8B5CF6', glow: 'rgba(139, 92, 246, 0.4)', ring: 'ring-emerald-500', bg: 'bg-emerald-500' },
];

export default function TeamGraphPage() {
  const { t } = useI18n();
  const router = useRouter();
  const organization = useOrganizationStore((s) => s.organization);
  const [networkData, setNetworkData] = useState<TeamNetworkData | null>(null);
  const [statsData, setStatsData] = useState<TeamNetworkStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hiddenMembers, setHiddenMembers] = useState<Set<string>>(new Set());

  // Redirect if not team plan
  useEffect(() => {
    if (organization === null) {
      // Wait for store to load, don't redirect immediately
    }
  }, [organization]);

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [network, stats] = await Promise.all([
          getTeamNetwork({ limit: 200 }),
          getTeamStats(),
        ]);
        setNetworkData(network);
        setStatsData(stats);
      } catch (error) {
        console.error('Failed to fetch team graph data:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  // Build color map for members
  const memberColorMap = useMemo(() => {
    const map = new Map<string, typeof memberColors[0]>();
    networkData?.members.forEach((member, index) => {
      map.set(member.userId, memberColors[index % memberColors.length]);
    });
    return map;
  }, [networkData]);

  // Calculate node positions
  const positionedNodes = useMemo(() => {
    if (!networkData) return [];

    const members = networkData.nodes.filter((n) => n.type === 'User');
    const contacts = networkData.nodes.filter((n) => n.type === 'Contact');
    const positioned: Array<TeamGraphNode & { x: number; y: number }> = [];

    // Position members in an inner ring
    const memberCount = members.length;
    members.forEach((member, i) => {
      const angle = (i / memberCount) * Math.PI * 2 - Math.PI / 2;
      const radius = 20;
      positioned.push({
        ...member,
        x: 50 + Math.cos(angle) * radius,
        y: 50 + Math.sin(angle) * radius,
      });
    });

    // Position contacts around their owners
    const contactsByOwner = new Map<string, typeof contacts>();
    contacts.forEach((c) => {
      const ownerId = c.ownerId || '';
      const existing = contactsByOwner.get(ownerId) || [];
      existing.push(c);
      contactsByOwner.set(ownerId, existing);
    });

    contactsByOwner.forEach((ownerContacts, ownerId) => {
      const ownerNode = positioned.find((n) => n.id === ownerId);
      if (!ownerNode) return;

      ownerContacts.forEach((contact, i) => {
        const angle = (i / ownerContacts.length) * Math.PI * 2;
        const radius = 15 + (i % 3) * 5;
        const x = ownerNode.x + Math.cos(angle) * radius;
        const y = ownerNode.y + Math.sin(angle) * radius;
        positioned.push({
          ...contact,
          x: Math.max(5, Math.min(95, x)),
          y: Math.max(5, Math.min(95, y)),
        });
      });
    });

    return positioned;
  }, [networkData]);

  // Filter nodes based on hidden members
  const visibleNodes = positionedNodes.filter((node) => {
    if (node.type === 'User') return !hiddenMembers.has(node.id);
    return !hiddenMembers.has(node.ownerId || '');
  });

  const visibleEdges = (networkData?.edges || []).filter((edge) => {
    const sourceVisible = visibleNodes.some((n) => n.id === edge.source);
    const targetVisible = visibleNodes.some((n) => n.id === edge.target);
    return sourceVisible && targetVisible;
  });

  const selectedNodeData = selectedNode ? positionedNodes.find((n) => n.id === selectedNode) : null;

  const toggleMember = (userId: string) => {
    setHiddenMembers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  return (
    <div className="animate-fade-in pb-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.push('/map')} className="p-2 rounded-lg hover:bg-th-surface-h text-th-text-t hover:text-th-text transition-colors">
          <ArrowLeft24Regular className="w-5 h-5 rtl:rotate-180" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-th-text">
            {t.organization?.teamGraph?.title || 'Team Network'}
          </h1>
          <p className="text-th-text-t text-sm">
            {t.organization?.teamGraph?.subtitle || 'Combined relationship graph of your team'}
          </p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-3 text-center">
          <div className="w-7 h-7 mx-auto mb-1 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
            <PeopleTeam24Regular className="w-3.5 h-3.5 text-th-text" />
          </div>
          <p className="text-lg font-bold text-th-text">{statsData?.memberCount || 0}</p>
          <p className="text-[10px] text-th-text-m">{t.organization?.teamGraph?.members || 'Members'}</p>
        </div>
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-3 text-center">
          <div className="w-7 h-7 mx-auto mb-1 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <People24Regular className="w-3.5 h-3.5 text-th-text" />
          </div>
          <p className="text-lg font-bold text-th-text">{statsData?.totalUniqueContacts || 0}</p>
          <p className="text-[10px] text-th-text-m">{t.organization?.teamGraph?.contacts || 'Contacts'}</p>
        </div>
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-3 text-center">
          <div className="w-7 h-7 mx-auto mb-1 rounded-lg bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center">
            <Grid24Regular className="w-3.5 h-3.5 text-th-text" />
          </div>
          <p className="text-lg font-bold text-th-text">{statsData?.sectorsReached || 0}</p>
          <p className="text-[10px] text-th-text-m">{t.organization?.teamGraph?.sectors || 'Sectors'}</p>
        </div>
        <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-3 text-center">
          <div className="w-7 h-7 mx-auto mb-1 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <Link24Regular className="w-3.5 h-3.5 text-th-text" />
          </div>
          <p className="text-lg font-bold text-th-text">{networkData?.stats.totalEdges || 0}</p>
          <p className="text-[10px] text-th-text-m">{t.organization?.teamGraph?.connections || 'Links'}</p>
        </div>
      </div>

      {/* Member Toggle */}
      {networkData && networkData.members.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-4">
          {networkData.members.map((member) => {
            const color = memberColorMap.get(member.userId);
            const isHidden = hiddenMembers.has(member.userId);
            return (
              <button
                key={member.userId}
                onClick={() => toggleMember(member.userId)}
                className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border ${
                  isHidden
                    ? 'bg-th-surface border-th-border text-th-text-m'
                    : 'bg-th-surface-h border-white/20 text-th-text'
                }`}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: isHidden ? '#6B7280' : color?.fill }}
                />
                <span>{member.fullName.split(' ')[0]}</span>
                {isHidden ? (
                  <EyeOff24Regular className="w-3.5 h-3.5" />
                ) : (
                  <Eye24Regular className="w-3.5 h-3.5" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Graph Container */}
      <div className="relative bg-th-surface backdrop-blur-sm border border-th-border rounded-2xl overflow-hidden" style={{ height: '420px' }}>
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-emerald-500/5" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px]" />

        {/* Loading */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && visibleNodes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
            <PeopleTeam24Regular className="w-12 h-12 text-white/70 mb-3" />
            <p className="text-th-text-t">{t.organization?.teamGraph?.noData || 'No team data yet'}</p>
          </div>
        )}

        {/* SVG Graph */}
        {!isLoading && visibleNodes.length > 0 && (
          <svg
            className="w-full h-full relative z-10"
            viewBox="0 0 100 100"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
          >
            <defs>
              <filter id="team-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Edges */}
            {visibleEdges.map((edge, i) => {
              const from = visibleNodes.find((n) => n.id === edge.source);
              const to = visibleNodes.find((n) => n.id === edge.target);
              if (!from || !to) return null;

              const isTeammate = edge.type === 'TEAMMATE';
              return (
                <line
                  key={i}
                  x1={`${from.x}%`}
                  y1={`${from.y}%`}
                  x2={`${to.x}%`}
                  y2={`${to.y}%`}
                  stroke={isTeammate ? '#A855F7' : memberColorMap.get(from.type === 'User' ? from.id : from.ownerId || '')?.fill || '#6B7280'}
                  strokeWidth={isTeammate ? 0.8 : 0.3}
                  strokeOpacity={isTeammate ? 0.6 : 0.3}
                  strokeDasharray={isTeammate ? '2 2' : 'none'}
                />
              );
            })}

            {/* Nodes */}
            {visibleNodes.map((node) => {
              const isUser = node.type === 'User';
              const color = isUser
                ? memberColorMap.get(node.id)
                : memberColorMap.get(node.ownerId || '');
              const isSelected = selectedNode === node.id;

              return (
                <g
                  key={node.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedNode(node.id === selectedNode ? null : node.id)}
                >
                  {/* Glow */}
                  <circle
                    cx={`${node.x}%`}
                    cy={`${node.y}%`}
                    r={isUser ? 6 : 3}
                    fill={color?.glow || 'rgba(107, 114, 128, 0.3)'}
                    filter="url(#team-glow)"
                  />
                  {/* Ring for members */}
                  {isUser && (
                    <circle
                      cx={`${node.x}%`}
                      cy={`${node.y}%`}
                      r={5}
                      fill="none"
                      stroke={color?.fill || '#6B7280'}
                      strokeWidth={0.5}
                      strokeOpacity={0.5}
                    />
                  )}
                  {/* Main circle */}
                  <circle
                    cx={`${node.x}%`}
                    cy={`${node.y}%`}
                    r={isUser ? 4 : 2}
                    fill={color?.fill || '#6B7280'}
                    stroke={isSelected ? '#ffffff' : 'transparent'}
                    strokeWidth={isSelected ? 0.6 : 0}
                    opacity={isUser ? 1 : 0.8}
                  />
                  {/* Label for members */}
                  {isUser && (
                    <text
                      x={`${node.x}%`}
                      y={`${node.y + 8}%`}
                      textAnchor="middle"
                      className="text-[2.5px] fill-white font-semibold"
                    >
                      {node.name.split(' ')[0]}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}

        {/* Controls */}
        <div className="absolute bottom-4 end-4 flex flex-col gap-2">
          <button
            onClick={() => setZoom((z) => Math.min(z + 0.2, 2))}
            className="w-10 h-10 bg-th-surface-h backdrop-blur-sm border border-th-border rounded-xl flex items-center justify-center text-th-text hover:bg-th-surface-h transition-colors"
          >
            <ZoomIn24Regular className="w-5 h-5" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(z - 0.2, 0.5))}
            className="w-10 h-10 bg-th-surface-h backdrop-blur-sm border border-th-border rounded-xl flex items-center justify-center text-th-text hover:bg-th-surface-h transition-colors"
          >
            <ZoomOut24Regular className="w-5 h-5" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="w-10 h-10 bg-th-surface-h backdrop-blur-sm border border-th-border rounded-xl flex items-center justify-center text-th-text hover:bg-th-surface-h transition-colors"
          >
            <FullScreenMaximize24Regular className="w-5 h-5" />
          </button>
        </div>

        {/* Legend */}
        {networkData && networkData.members.length > 0 && (
          <div className="absolute top-4 start-4 bg-th-bg-s/80 backdrop-blur-sm border border-th-border rounded-xl p-3">
            <p className="text-xs font-medium text-th-text-s mb-2">
              {t.organization?.teamGraph?.legend || 'Team Members'}
            </p>
            <div className="space-y-1.5">
              {networkData.members.map((member) => {
                const color = memberColorMap.get(member.userId);
                const stat = statsData?.memberStats.find((s) => s.userId === member.userId);
                return (
                  <div key={member.userId} className="flex items-center gap-2 text-xs">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color?.fill }} />
                    <span className="text-th-text-t">
                      {member.fullName.split(' ')[0]}
                    </span>
                    {stat && (
                      <span className="text-white/70">({stat.contactCount})</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Selected Node Details */}
      {selectedNodeData && (
        <div className="mt-4">
          <div className="bg-th-surface backdrop-blur-sm border border-th-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Avatar name={selectedNodeData.name} src={selectedNodeData.properties.avatarUrl} size="lg" />
              <div className="flex-1">
                <h3 className="font-semibold text-th-text">{selectedNodeData.name}</h3>
                {selectedNodeData.properties.jobTitle && (
                  <p className="text-sm text-th-text-t">{selectedNodeData.properties.jobTitle}</p>
                )}
                {selectedNodeData.properties.company && (
                  <p className="text-sm text-th-text-m">{selectedNodeData.properties.company}</p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: memberColorMap.get(
                        selectedNodeData.type === 'User' ? selectedNodeData.id : selectedNodeData.ownerId || ''
                      )?.fill,
                    }}
                  />
                  <span className="text-xs text-th-text-m">
                    {selectedNodeData.type === 'User'
                      ? (t.organization?.teamGraph?.teamMember || 'Team Member')
                      : `${t.organization?.teamGraph?.ownedBy || 'Contact of'} ${networkData?.members.find((m) => m.userId === selectedNodeData.ownerId)?.fullName || ''}`}
                  </span>
                </div>
              </div>
              {selectedNodeData.type === 'Contact' && (
                <Link href={`/contacts/${selectedNodeData.id}`}>
                  <button className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-medium rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all">
                    {t.networkMap?.node?.view || 'View'}
                  </button>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Member Stats */}
      {statsData && statsData.memberStats.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-th-text-t mb-2">
            {t.organization?.teamGraph?.teamReach || 'Team Reach'}
          </h3>
          <div className="space-y-2">
            {statsData.memberStats.map((member) => {
              const color = memberColorMap.get(member.userId);
              const maxContacts = Math.max(...statsData.memberStats.map((m) => m.contactCount), 1);
              const percentage = (member.contactCount / maxContacts) * 100;
              return (
                <div key={member.userId} className="bg-th-surface border border-th-border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Avatar name={member.fullName} src={member.avatarUrl} size="sm" />
                    <span className="text-sm text-th-text font-medium">{member.fullName}</span>
                    <span className="ms-auto text-xs text-th-text-t">{member.contactCount} contacts</span>
                  </div>
                  <div className="w-full h-1.5 bg-th-surface-h rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: color?.fill,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
