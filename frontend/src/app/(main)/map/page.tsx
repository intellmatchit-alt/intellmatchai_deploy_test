/**
 * Network Map Page
 *
 * Visual network graph of contacts and relationships - mobile-friendly.
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/ui/Avatar';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { getNetwork, NetworkData } from '@/lib/api/graph';
import { getContacts, Contact } from '@/lib/api/contacts';
import { useOrganizationStore } from '@/stores/organizationStore';
import {
  ZoomIn24Regular,
  ZoomOut24Regular,
  FullScreenMaximize24Regular,
  ArrowRight24Regular,
  People24Regular,
  Link24Regular,
  Grid24Regular,
  Add24Regular,
  PeopleTeam24Regular,
  List24Regular,
  Dismiss24Regular,
  ChevronDown24Regular,
} from '@fluentui/react-icons';
import AddContactModal from '@/components/AddContactModal';

/**
 * Sector colors
 */
const sectorColors: Record<string, { fill: string; glow: string }> = {
  Technology: { fill: '#3B82F6', glow: 'rgba(59, 130, 246, 0.5)' },
  Finance: { fill: '#10B981', glow: 'rgba(16, 185, 129, 0.5)' },
  Healthcare: { fill: '#EF4444', glow: 'rgba(239, 68, 68, 0.5)' },
  Marketing: { fill: '#A855F7', glow: 'rgba(168, 85, 247, 0.5)' },
  Consulting: { fill: '#F59E0B', glow: 'rgba(245, 158, 11, 0.5)' },
  Education: { fill: '#06B6D4', glow: 'rgba(6, 182, 212, 0.5)' },
  default: { fill: '#6B7280', glow: 'rgba(107, 114, 128, 0.5)' },
};

const sectorBgColors: Record<string, string> = {
  Technology: 'bg-blue-500',
  Finance: 'bg-green-500',
  Healthcare: 'bg-red-500',
  Marketing: 'bg-emerald-500',
  Consulting: 'bg-yellow-500',
  Education: 'bg-cyan-500',
  default: 'bg-white/[0.03]0',
};

interface NetworkNode {
  id: string;
  name: string;
  type: 'self' | 'contact';
  sector?: string;
  x: number;
  y: number;
  contact?: Contact;
}

interface NetworkEdge {
  from: string;
  to: string;
  strength: number;
}

export default function NetworkMapPage() {
  const { t } = useI18n();
  const router = useRouter();
  const organization = useOrganizationStore((s) => s.organization);
  const isTeamPlan = organization !== null;
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [nodes, setNodes] = useState<NetworkNode[]>([]);
  const [edges, setEdges] = useState<NetworkEdge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'graph' | 'list'>('graph');
  const [showLegend, setShowLegend] = useState(false);

  // Touch/drag state
  const svgRef = useRef<SVGSVGElement>(null);
  const isDragging = useRef(false);
  const lastTouch = useRef<{ x: number; y: number } | null>(null);
  const lastPinchDist = useRef<number | null>(null);

  const sectorTranslations: Record<string, string> = {
    Technology: t.networkMap.sectors.technology,
    Finance: t.networkMap.sectors.finance,
    Healthcare: t.networkMap.sectors.healthcare,
    Marketing: t.networkMap.sectors.marketing,
  };

  // Fetch network data
  useEffect(() => {
    async function fetchNetworkData() {
      setIsLoading(true);
      try {
        const contactsData = await getContacts({ limit: 50 });

        if (contactsData.contacts.length === 0) {
          setNodes([{ id: 'user', name: t.networkMap.node.you, type: 'self', x: 50, y: 50 }]);
          setEdges([]);
          return;
        }

        const contactNodes: NetworkNode[] = contactsData.contacts.map((contact, index) => {
          const angle = (index / contactsData.contacts.length) * Math.PI * 2;
          const radius = 30 + (index % 3) * 10;
          const x = 50 + Math.cos(angle) * radius;
          const y = 50 + Math.sin(angle) * radius;

          return {
            id: contact.id,
            name: contact.name,
            type: 'contact',
            sector: contact.sectors?.[0]?.name || 'default',
            x: Math.max(10, Math.min(90, x)),
            y: Math.max(10, Math.min(90, y)),
            contact,
          };
        });

        const allNodes: NetworkNode[] = [
          { id: 'user', name: t.networkMap.node.you, type: 'self', x: 50, y: 50 },
          ...contactNodes,
        ];

        const allEdges: NetworkEdge[] = contactNodes.map(node => ({
          from: 'user',
          to: node.id,
          strength: node.contact?.matchScore ? node.contact.matchScore / 100 : 0.5,
        }));

        contactNodes.forEach((node, i) => {
          contactNodes.slice(i + 1).forEach(otherNode => {
            if (node.sector === otherNode.sector && node.sector !== 'default') {
              allEdges.push({ from: node.id, to: otherNode.id, strength: 0.3 });
            }
          });
        });

        setNodes(allNodes);
        setEdges(allEdges);
      } catch (error) {
        console.error('Failed to fetch network data:', error);
        setNodes([{ id: 'user', name: t.networkMap.node.you, type: 'self', x: 50, y: 50 }]);
        setEdges([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchNetworkData();
  }, [t.networkMap.node.you]);

  // Touch handlers for pan/zoom
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      isDragging.current = true;
      lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDist.current = Math.sqrt(dx * dx + dy * dy);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging.current && lastTouch.current) {
      const dx = e.touches[0].clientX - lastTouch.current.x;
      const dy = e.touches[0].clientY - lastTouch.current.y;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2 && lastPinchDist.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const scale = dist / lastPinchDist.current;
      setZoom(prev => Math.min(3, Math.max(0.5, prev * scale)));
      lastPinchDist.current = dist;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;
    lastTouch.current = null;
    lastPinchDist.current = null;
  }, []);

  const sectors = [...new Set(nodes.filter(n => n.type === 'contact').map(n => n.sector).filter((s): s is string => !!s && s !== 'default'))];

  const filteredNodes = filter
    ? nodes.filter(n => n.type === 'self' || n.sector === filter)
    : nodes;

  const filteredEdges = edges.filter(e =>
    filteredNodes.some(n => n.id === e.from) && filteredNodes.some(n => n.id === e.to)
  );

  const selectedNodeData = selectedNode ? nodes.find(n => n.id === selectedNode) : null;

  const contactNodes = nodes.filter(n => n.type === 'contact');
  const filteredContactList = filter
    ? contactNodes.filter(n => n.sector === filter)
    : contactNodes;

  return (
    <div className="animate-fade-in pb-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-th-text">{t.networkMap.title}</h1>
          <p className="text-th-text-t text-sm">{t.networkMap.subtitle}</p>
        </div>
        {/* View toggle */}
        <div className="flex bg-th-surface border border-th-border rounded-xl overflow-hidden">
          <button
            onClick={() => setViewMode('graph')}
            className={`p-2.5 transition-colors ${viewMode === 'graph' ? 'bg-emerald-500/20 text-emerald-400' : 'text-th-text-m hover:text-th-text-s'}`}
          >
            <Grid24Regular className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2.5 transition-colors ${viewMode === 'list' ? 'bg-emerald-500/20 text-emerald-400' : 'text-th-text-m hover:text-th-text-s'}`}
          >
            <List24Regular className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Team Graph Tab */}
      {isTeamPlan && (
        <div className="flex gap-2 mb-4">
          <div className="flex-1 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3">
            <span className="text-sm text-th-text font-medium">{t.networkMap?.title || 'My Network'}</span>
          </div>
          <button
            onClick={() => router.push('/map/team')}
            className="flex items-center gap-2 px-4 py-3 bg-th-surface border border-th-border rounded-xl hover:bg-th-surface-h transition-all"
          >
            <PeopleTeam24Regular className="w-5 h-5 text-emerald-400" />
            <span className="text-sm text-th-text-s font-medium">{t.organization?.teamGraph?.title || 'Team Graph'}</span>
          </button>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-th-surface border border-th-border rounded-xl p-2.5 text-center">
          <div className="w-7 h-7 mx-auto mb-1 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
            <People24Regular className="w-3.5 h-3.5 text-white" />
          </div>
          <p className="text-lg font-bold text-th-text">{contactNodes.length}</p>
          <p className="text-[10px] text-th-text-m">{t.networkMap.stats.contacts}</p>
        </div>
        <div className="bg-th-surface border border-th-border rounded-xl p-2.5 text-center">
          <div className="w-7 h-7 mx-auto mb-1 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <Link24Regular className="w-3.5 h-3.5 text-white" />
          </div>
          <p className="text-lg font-bold text-th-text">{edges.length}</p>
          <p className="text-[10px] text-th-text-m">{t.networkMap.stats.connections}</p>
        </div>
        <div className="bg-th-surface border border-th-border rounded-xl p-2.5 text-center">
          <div className="w-7 h-7 mx-auto mb-1 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
            <Grid24Regular className="w-3.5 h-3.5 text-white" />
          </div>
          <p className="text-lg font-bold text-th-text">{sectors.length}</p>
          <p className="text-[10px] text-th-text-m">{t.networkMap.stats.sectors}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-4" style={{ scrollbarWidth: 'none' }}>
        <button
          type="button"
          onClick={() => setFilter(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
            filter === null
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25'
              : 'bg-th-surface border border-th-border text-th-text-s hover:bg-th-surface-h'
          }`}
        >
          {t.networkMap.filters.all} ({contactNodes.length})
        </button>
        {sectors.map(sector => (
          <button
            type="button"
            key={sector}
            onClick={() => setFilter(sector === filter ? null : sector)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
              filter === sector
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25'
                : 'bg-th-surface border border-th-border text-th-text-s hover:bg-th-surface-h'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${sectorBgColors[sector] || sectorBgColors.default}`} />
            {sectorTranslations[sector] || sector}
          </button>
        ))}
      </div>

      {/* === GRAPH VIEW === */}
      {viewMode === 'graph' && (
        <>
          {/* Graph container - uses viewport height on mobile */}
          <div
            className="relative bg-th-surface border border-th-border rounded-2xl overflow-hidden touch-none"
            style={{ height: 'calc(100svh - 340px)', minHeight: '280px', maxHeight: '500px' }}
          >
            {/* Gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-emerald-500/5" />
            {/* Grid pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px]" />

            {/* Loading */}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center z-20">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-500" />
              </div>
            )}

            {/* Empty */}
            {!isLoading && nodes.length <= 1 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-20 px-6">
                <People24Regular className="w-12 h-12 text-white/70 mb-3" />
                <p className="text-th-text-t text-center">{t.contacts?.noContacts || 'No contacts yet'}</p>
                <Link href="/contacts">
                  <button className="mt-4 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium rounded-xl">
                    {t.contacts?.addContact || 'Add Contact'}
                  </button>
                </Link>
              </div>
            )}

            {/* SVG Graph with touch pan/zoom */}
            {!isLoading && nodes.length > 1 && (
              <svg
                ref={svgRef}
                className="w-full h-full relative z-10"
                viewBox="0 0 100 100"
                style={{
                  transform: `scale(${zoom}) translate(${pan.x / zoom / 4}px, ${pan.y / zoom / 4}px)`,
                  transformOrigin: 'center',
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <defs>
                  <filter id="glow-purple" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                  <linearGradient id="edge-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#A855F7" />
                    <stop offset="100%" stopColor="#EC4899" />
                  </linearGradient>
                </defs>

                {/* Edges */}
                {filteredEdges.map((edge, i) => {
                  const fromNode = filteredNodes.find(n => n.id === edge.from);
                  const toNode = filteredNodes.find(n => n.id === edge.to);
                  if (!fromNode || !toNode) return null;
                  return (
                    <line
                      key={i}
                      x1={`${fromNode.x}%`}
                      y1={`${fromNode.y}%`}
                      x2={`${toNode.x}%`}
                      y2={`${toNode.y}%`}
                      stroke="url(#edge-gradient)"
                      strokeWidth={edge.strength * 1.5}
                      strokeOpacity={0.4}
                    />
                  );
                })}

                {/* Nodes - larger hit areas for mobile */}
                {filteredNodes.map(node => {
                  const colors = sectorColors[node.sector || 'default'] || sectorColors.default;
                  const isSelected = selectedNode === node.id;
                  const isSelf = node.type === 'self';

                  return (
                    <g
                      key={node.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedNode(node.id === selectedNode ? null : node.id)}
                    >
                      {/* Invisible larger hit area for touch */}
                      <circle
                        cx={`${node.x}%`}
                        cy={`${node.y}%`}
                        r={isSelf ? 10 : 7}
                        fill="transparent"
                      />
                      {/* Glow */}
                      <circle
                        cx={`${node.x}%`}
                        cy={`${node.y}%`}
                        r={isSelf ? 8 : 5}
                        fill={isSelf ? 'rgba(168, 85, 247, 0.3)' : colors.glow}
                        filter="url(#glow-purple)"
                      />
                      {/* Main circle */}
                      <circle
                        cx={`${node.x}%`}
                        cy={`${node.y}%`}
                        r={isSelf ? 5 : 3.5}
                        fill={isSelf ? '#A855F7' : colors.fill}
                        stroke={isSelected ? '#ffffff' : 'transparent'}
                        strokeWidth={isSelected ? 0.8 : 0}
                        className="transition-all duration-200"
                      />
                      {isSelf && (
                        <circle cx={`${node.x}%`} cy={`${node.y}%`} r={2} fill="#EC4899" />
                      )}
                      {/* Label */}
                      <text
                        x={`${node.x}%`}
                        y={`${node.y + (isSelf ? 8 : 6)}%`}
                        textAnchor="middle"
                        className="text-[2.5px] fill-neutral-300 font-medium select-none pointer-events-none"
                      >
                        {isSelf ? node.name : node.name.split(' ')[0]}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}

            {/* Zoom controls */}
            <div className="absolute bottom-3 end-3 flex flex-col gap-1.5 z-20">
              <button
                type="button"
                onClick={() => setZoom(z => Math.min(z + 0.3, 3))}
                className="w-9 h-9 bg-th-bg-s/90 backdrop-blur-sm border border-th-border rounded-lg flex items-center justify-center text-th-text active:scale-90 transition-transform"
              >
                <ZoomIn24Regular className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(z => Math.max(z - 0.3, 0.5))}
                className="w-9 h-9 bg-th-bg-s/90 backdrop-blur-sm border border-th-border rounded-lg flex items-center justify-center text-th-text active:scale-90 transition-transform"
              >
                <ZoomOut24Regular className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
                className="w-9 h-9 bg-th-bg-s/90 backdrop-blur-sm border border-th-border rounded-lg flex items-center justify-center text-th-text active:scale-90 transition-transform"
              >
                <FullScreenMaximize24Regular className="w-4 h-4" />
              </button>
            </div>

            {/* Legend toggle */}
            {sectors.length > 0 && (
              <div className="absolute top-3 start-3 z-20">
                <button
                  onClick={() => setShowLegend(!showLegend)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-th-bg-s/90 backdrop-blur-sm border border-th-border rounded-lg text-xs text-th-text-s"
                >
                  <span>{t.networkMap.legend.title}</span>
                  <ChevronDown24Regular className={`w-3.5 h-3.5 transition-transform ${showLegend ? 'rotate-180' : ''}`} />
                </button>
                {showLegend && (
                  <div className="mt-1 bg-th-bg-s/95 backdrop-blur-sm border border-th-border rounded-lg p-2.5 space-y-1.5">
                    {sectors.map(sector => (
                      <button
                        key={sector}
                        onClick={() => { setFilter(sector === filter ? null : sector); setShowLegend(false); }}
                        className="flex items-center gap-2 text-xs w-full text-left hover:text-th-text-s"
                      >
                        <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${sectorBgColors[sector] || sectorBgColors.default}`} />
                        <span className={`text-th-text-t ${filter === sector ? 'text-emerald-400 font-medium' : ''}`}>
                          {sectorTranslations[sector] || sector}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Selected node detail - slide up card */}
          {selectedNodeData && selectedNodeData.type !== 'self' && (
            <div className="mt-3 animate-slide-up-fade">
              <div className="bg-th-surface border border-th-border rounded-xl p-3">
                <div className="flex items-center gap-3">
                  <Avatar name={selectedNodeData.name} src={selectedNodeData.contact?.avatarUrl} size="lg" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-th-text truncate">{selectedNodeData.name}</h3>
                    {selectedNodeData.contact?.jobTitle && (
                      <p className="text-xs text-th-text-t truncate">{selectedNodeData.contact.jobTitle}</p>
                    )}
                    {selectedNodeData.contact?.company && (
                      <p className="text-xs text-th-text-m truncate">{selectedNodeData.contact.company}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link href={`/contacts/${selectedNodeData.id}`}>
                      <button type="button" className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-medium rounded-lg active:scale-95 transition-transform">
                        {t.networkMap.node.view}
                        <ArrowRight24Regular className="w-3.5 h-3.5 rtl:rotate-180" />
                      </button>
                    </Link>
                    <button
                      onClick={() => setSelectedNode(null)}
                      className="p-1.5 text-th-text-m hover:text-th-text-s"
                    >
                      <Dismiss24Regular className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Hint */}
          <p className="text-[10px] text-th-text-m text-center mt-3">
            {t.networkMap.tips}
          </p>
        </>
      )}

      {/* === LIST VIEW === */}
      {viewMode === 'list' && (
        <div className="space-y-2">
          {filteredContactList.length > 0 ? (
            filteredContactList.map(node => {
              const sectorName = node.sector || 'default';
              return (
                <Link key={node.id} href={`/contacts/${node.id}`} className="block">
                  <div className="bg-th-surface border border-th-border rounded-xl p-3 flex items-center gap-3 hover:bg-th-surface-h active:scale-[0.98] transition-all">
                    <Avatar name={node.name} src={node.contact?.avatarUrl} size="md" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-th-text text-sm truncate">{node.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        {node.contact?.jobTitle && (
                          <p className="text-xs text-th-text-t truncate">{node.contact.jobTitle}</p>
                        )}
                        {node.contact?.company && (
                          <p className="text-xs text-th-text-m truncate">· {node.contact.company}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {sectorName !== 'default' && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] ${sectorBgColors[sectorName] || sectorBgColors.default} text-white`}>
                          {sectorTranslations[sectorName] || sectorName}
                        </span>
                      )}
                      <ArrowRight24Regular className="w-4 h-4 text-th-text-m rtl:rotate-180" />
                    </div>
                  </div>
                </Link>
              );
            })
          ) : (
            <div className="bg-th-surface border border-th-border rounded-xl p-8 text-center">
              <People24Regular className="w-10 h-10 text-white/70 mx-auto mb-2" />
              <p className="text-th-text-t text-sm">
                {filter ? 'No contacts in this sector' : (t.contacts?.noContacts || 'No contacts yet')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* FAB - Add Contact */}
      <button
        onClick={() => setIsAddModalOpen(true)}
        className="fixed bottom-24 end-6 z-40 group"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-full blur-lg opacity-60 group-hover:opacity-80 transition-opacity" />
        <div className="relative flex items-center justify-center h-14 w-14 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25 active:scale-90 transition-transform">
          <Add24Regular className="w-6 h-6" />
        </div>
      </button>

      {/* Add Contact Modal */}
      <AddContactModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onContactAdded={() => {
          setIsLoading(true);
          getContacts({ limit: 100 }).then(response => {
            if (response.contacts) {
              const newNodes: NetworkNode[] = [
                { id: 'user', name: t.networkMap.node.you, type: 'self', x: 50, y: 50 },
              ];
              const newEdges: NetworkEdge[] = [];

              response.contacts.forEach((contact, index) => {
                const angle = (2 * Math.PI * index) / response.contacts.length;
                const radius = 30 + (index % 3) * 10;
                newNodes.push({
                  id: contact.id,
                  name: contact.name,
                  type: 'contact',
                  sector: contact.sectors?.[0]?.name || 'default',
                  x: Math.max(10, Math.min(90, 50 + radius * Math.cos(angle))),
                  y: Math.max(10, Math.min(90, 50 + radius * Math.sin(angle))),
                  contact,
                });
                newEdges.push({
                  from: 'user',
                  to: contact.id,
                  strength: contact.matchScore ? contact.matchScore / 100 : 0.5,
                });
              });

              setNodes(newNodes);
              setEdges(newEdges);
            }
            setIsLoading(false);
          });
        }}
      />
    </div>
  );
}
