/**
 * D3 Charts Components
 *
 * Interactive charts for dashboard visualizations.
 *
 * @module components/charts/D3Charts
 */

'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

function isRtl() {
  if (typeof document === 'undefined') return false;
  return document.documentElement.dir === 'rtl';
}

interface ChartDataPoint {
  date: string;
  label: string;
  value: number;
}

interface PieDataPoint {
  label: string;
  value: number;
}

interface BaseChartProps {
  className?: string;
  height?: number;
}

/**
 * Line Chart Component
 */
interface LineChartProps extends BaseChartProps {
  data: ChartDataPoint[];
  color?: string;
  showArea?: boolean;
  showDots?: boolean;
  showGrid?: boolean;
  animate?: boolean;
}

export function LineChart({
  data,
  color = '#10b981',
  showArea = true,
  showDots = true,
  showGrid = true,
  animate = true,
  height = 200,
  className = '',
}: LineChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || data.length === 0) return;

    const rtl = isRtl();
    const container = containerRef.current;
    const width = container.clientWidth;
    const margin = { top: 20, right: rtl ? 40 : 20, bottom: 30, left: rtl ? 20 : 40 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3
      .select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales — in RTL, reverse x-axis direction
    const xScale = d3
      .scalePoint()
      .domain(data.map((d) => d.label))
      .range(rtl ? [innerWidth, 0] : [0, innerWidth])
      .padding(0.5);

    const yScale = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.value) || 0])
      .nice()
      .range([innerHeight, 0]);

    // Grid lines
    if (showGrid) {
      g.append('g')
        .attr('class', 'grid')
        .selectAll('line')
        .data(yScale.ticks(5))
        .join('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', (d) => yScale(d))
        .attr('y2', (d) => yScale(d))
        .attr('stroke', 'rgba(255,255,255,0.05)');
    }

    // Area
    if (showArea) {
      const area = d3
        .area<ChartDataPoint>()
        .x((d) => xScale(d.label) || 0)
        .y0(innerHeight)
        .y1((d) => yScale(d.value))
        .curve(d3.curveMonotoneX);

      const areaPath = g
        .append('path')
        .datum(data)
        .attr('fill', `url(#gradient-${color.replace('#', '')})`)
        .attr('d', area);

      // Gradient
      const gradient = svg
        .append('defs')
        .append('linearGradient')
        .attr('id', `gradient-${color.replace('#', '')}`)
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '0%')
        .attr('y2', '100%');

      gradient.append('stop').attr('offset', '0%').attr('stop-color', color).attr('stop-opacity', 0.3);
      gradient.append('stop').attr('offset', '100%').attr('stop-color', color).attr('stop-opacity', 0);

      if (animate) {
        areaPath
          .attr('opacity', 0)
          .transition()
          .duration(1000)
          .attr('opacity', 1);
      }
    }

    // Line
    const line = d3
      .line<ChartDataPoint>()
      .x((d) => xScale(d.label) || 0)
      .y((d) => yScale(d.value))
      .curve(d3.curveMonotoneX);

    const linePath = g
      .append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 2)
      .attr('d', line);

    if (animate) {
      const totalLength = linePath.node()?.getTotalLength() || 0;
      linePath
        .attr('stroke-dasharray', totalLength)
        .attr('stroke-dashoffset', totalLength)
        .transition()
        .duration(1500)
        .attr('stroke-dashoffset', 0);
    }

    // Dots
    if (showDots) {
      g.selectAll('.dot')
        .data(data)
        .join('circle')
        .attr('class', 'dot')
        .attr('cx', (d) => xScale(d.label) || 0)
        .attr('cy', (d) => yScale(d.value))
        .attr('r', animate ? 0 : 4)
        .attr('fill', color)
        .attr('stroke', '#1a1a1a')
        .attr('stroke-width', 2)
        .transition()
        .delay(animate ? 1500 : 0)
        .duration(300)
        .attr('r', 4);
    }

    // X-axis
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(
        d3.axisBottom(xScale).tickValues(
          data.filter((_, i) => i % Math.ceil(data.length / 6) === 0).map((d) => d.label)
        )
      )
      .attr('color', 'rgba(255,255,255,0.4)')
      .selectAll('text')
      .attr('font-size', '10px');

    // Y-axis (right side in RTL)
    const yAxisG = g.append('g')
      .attr('color', 'rgba(255,255,255,0.4)');
    if (rtl) {
      yAxisG.attr('transform', `translate(${innerWidth},0)`).call(d3.axisRight(yScale).ticks(5));
    } else {
      yAxisG.call(d3.axisLeft(yScale).ticks(5));
    }
    yAxisG.selectAll('text').attr('font-size', '10px');
  }, [data, color, showArea, showDots, showGrid, animate, height]);

  return (
    <div ref={containerRef} className={`w-full ${className}`} style={{ direction: 'ltr' }}>
      <svg ref={svgRef} className="w-full" />
    </div>
  );
}

/**
 * Bar Chart Component
 */
interface BarChartProps extends BaseChartProps {
  data: PieDataPoint[];
  color?: string;
  colors?: string[];
  horizontal?: boolean;
  animate?: boolean;
}

export function BarChart({
  data,
  color = '#10b981',
  colors,
  horizontal = false,
  animate = true,
  height = 200,
  className = '',
}: BarChartProps) {
  const getBarColor = (i: number) => colors && colors[i] ? colors[i] : color;
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || data.length === 0) return;

    const rtl = isRtl();
    const container = containerRef.current;
    const width = container.clientWidth;
    const margin = { top: 10, right: rtl ? 60 : 20, bottom: 50, left: rtl ? 20 : 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3
      .select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Tooltip
    const tooltip = d3
      .select(container)
      .selectAll('.chart-tooltip')
      .data([null])
      .join('div')
      .attr('class', 'chart-tooltip')
      .style('position', 'absolute')
      .style('pointer-events', 'none')
      .style('background', 'rgba(0,0,0,0.85)')
      .style('color', 'white')
      .style('padding', '8px 12px')
      .style('border-radius', '8px')
      .style('font-size', '13px')
      .style('font-weight', '600')
      .style('white-space', 'nowrap')
      .style('opacity', '0')
      .style('z-index', '50')
      .style('box-shadow', '0 4px 12px rgba(0,0,0,0.3)')
      .style('border', '1px solid rgba(255,255,255,0.15)')
      .style('transition', 'opacity 0.15s');

    const barTotal = data.reduce((s, d) => s + d.value, 0);

    if (horizontal) {
      // Horizontal bar chart
      const yScale = d3
        .scaleBand()
        .domain(data.map((d) => d.label))
        .range([0, innerHeight])
        .padding(0.3);

      const xScale = d3
        .scaleLinear()
        .domain([0, d3.max(data, (d) => d.value) || 0])
        .nice()
        .range(rtl ? [innerWidth, 0] : [0, innerWidth]);

      // Bars
      const bars = rtl
        ? g.selectAll('.bar')
            .data(data)
            .join('rect')
            .attr('class', 'bar')
            .attr('y', (d) => yScale(d.label) || 0)
            .attr('height', yScale.bandwidth())
            .attr('x', (d) => xScale(d.value))
            .attr('width', animate ? 0 : (d) => innerWidth - xScale(d.value))
            .attr('fill', (_d, i) => getBarColor(i))
            .attr('rx', 4)
        : g.selectAll('.bar')
            .data(data)
            .join('rect')
            .attr('class', 'bar')
            .attr('y', (d) => yScale(d.label) || 0)
            .attr('height', yScale.bandwidth())
            .attr('x', 0)
            .attr('width', animate ? 0 : (d) => xScale(d.value))
            .attr('fill', (_d, i) => getBarColor(i))
            .attr('rx', 4);

      if (animate) {
        if (rtl) {
          bars.transition().duration(1000).attr('width', (d) => innerWidth - xScale(d.value));
        } else {
          bars.transition().duration(1000).attr('width', (d) => xScale(d.value));
        }
      }

      // Hover
      bars
        .style('cursor', 'default')
        .on('mouseover', function(_event, d) {
          d3.select(this).attr('opacity', 0.8);
          const pct = barTotal > 0 ? Math.round((d.value / barTotal) * 100) : 0;
          tooltip
            .html(`${d.label}: <strong>${d.value}</strong> (${pct}%)`)
            .style('opacity', '1');
        })
        .on('mousemove', function(event) {
          const [mx, my] = d3.pointer(event, container);
          tooltip.style('left', `${mx + 12}px`).style('top', `${my - 10}px`);
        })
        .on('mouseout', function() {
          d3.select(this).attr('opacity', 1);
          tooltip.style('opacity', '0');
        });

      // Y-axis (right side in RTL)
      const yAxisG = g.append('g')
        .attr('color', 'rgba(255,255,255,0.6)');
      if (rtl) {
        yAxisG.attr('transform', `translate(${innerWidth},0)`).call(d3.axisRight(yScale));
      } else {
        yAxisG.call(d3.axisLeft(yScale));
      }
      yAxisG.selectAll('text').attr('font-size', '11px').attr('fill', 'white').attr('font-weight', '600');

      // X-axis
      g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale).ticks(5))
        .attr('color', 'rgba(255,255,255,0.6)')
        .selectAll('text')
        .attr('font-size', '11px')
        .attr('fill', 'white')
        .attr('font-weight', '600');
    } else {
      // Vertical bar chart
      const xScale = d3
        .scaleBand()
        .domain(rtl ? [...data.map((d) => d.label)].reverse() : data.map((d) => d.label))
        .range([0, innerWidth])
        .padding(0.3);

      const yScale = d3
        .scaleLinear()
        .domain([0, d3.max(data, (d) => d.value) || 0])
        .nice()
        .range([innerHeight, 0]);

      // Bars
      const bars = g.selectAll('.bar')
        .data(data)
        .join('rect')
        .attr('class', 'bar')
        .attr('x', (d) => xScale(d.label) || 0)
        .attr('width', xScale.bandwidth())
        .attr('y', animate ? innerHeight : (d) => yScale(d.value))
        .attr('height', animate ? 0 : (d) => innerHeight - yScale(d.value))
        .attr('fill', (_d, i) => getBarColor(i))
        .attr('rx', 4);

      if (animate) {
        bars.transition().duration(1000)
          .attr('y', (d) => yScale(d.value))
          .attr('height', (d) => innerHeight - yScale(d.value));
      }

      // Hover
      bars
        .style('cursor', 'default')
        .on('mouseover', function(_event, d) {
          d3.select(this).attr('opacity', 0.8);
          const pct = barTotal > 0 ? Math.round((d.value / barTotal) * 100) : 0;
          tooltip
            .html(`${d.label}: <strong>${d.value}</strong> (${pct}%)`)
            .style('opacity', '1');
        })
        .on('mousemove', function(event) {
          const [mx, my] = d3.pointer(event, container);
          tooltip.style('left', `${mx + 12}px`).style('top', `${my - 10}px`);
        })
        .on('mouseout', function() {
          d3.select(this).attr('opacity', 1);
          tooltip.style('opacity', '0');
        });

      // X-axis
      g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale))
        .attr('color', 'rgba(255,255,255,0.6)')
        .selectAll('text')
        .attr('font-size', '11px')
        .attr('fill', 'white')
        .attr('font-weight', '600')
        .attr('transform', rtl ? 'rotate(45)' : 'rotate(-45)')
        .attr('text-anchor', rtl ? 'start' : 'end');

      // Y-axis (right side in RTL)
      const yAxisG = g.append('g')
        .attr('color', 'rgba(255,255,255,0.6)');
      if (rtl) {
        yAxisG.attr('transform', `translate(${innerWidth},0)`).call(d3.axisRight(yScale).ticks(5));
      } else {
        yAxisG.call(d3.axisLeft(yScale).ticks(5));
      }
      yAxisG.selectAll('text').attr('font-size', '11px').attr('fill', 'white').attr('font-weight', '600');
    }
  }, [data, color, colors, horizontal, animate, height]);

  return (
    <div ref={containerRef} className={`w-full relative ${className}`} style={{ direction: 'ltr' }}>
      <svg ref={svgRef} className="w-full" />
    </div>
  );
}

/**
 * Donut Chart Component
 */
interface DonutChartProps extends BaseChartProps {
  data: PieDataPoint[];
  colors?: string[];
  innerRadius?: number;
  showLabels?: boolean;
  showLegend?: boolean;
  animate?: boolean;
  onSegmentClick?: (label: string, value: number) => void;
  totalLabel?: string;
}

export function DonutChart({
  data,
  colors = ['#10b981', '#3b82f6', '#f97316', '#10b981', '#10b981', '#f59e0b'],
  innerRadius = 0.6,
  showLabels = false,
  showLegend = true,
  animate = true,
  height = 200,
  className = '',
  onSegmentClick,
  totalLabel,
}: DonutChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || data.length === 0) return;

    const rtl = isRtl();
    const container = containerRef.current;
    const containerWidth = container.clientWidth;
    // In RTL, legend is rendered as HTML outside SVG, so SVG gets less width
    const svgWidth = (showLegend && rtl) ? Math.min(containerWidth * 0.5, height) : containerWidth;
    const chartSize = (showLegend && !rtl) ? Math.min(containerWidth * 0.6, height) : Math.min(svgWidth, height);
    const radius = Math.min(chartSize, height) / 2 - 10;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3
      .select(svgRef.current)
      .attr('width', svgWidth)
      .attr('height', height);

    // In LTR with legend, donut is on the left; in RTL, donut is centered in its SVG area
    const donutCenterX = (showLegend && !rtl) ? chartSize / 2 : svgWidth / 2;

    const g = svg
      .append('g')
      .attr('transform', `translate(${donutCenterX},${height / 2})`);

    // Color scale
    const colorScale = d3.scaleOrdinal<string>().domain(data.map((d) => d.label)).range(colors);

    // Pie generator
    const pie = d3.pie<PieDataPoint>().value((d) => d.value).sort(null);

    // Arc generator
    const arc = d3
      .arc<d3.PieArcDatum<PieDataPoint>>()
      .innerRadius(radius * innerRadius)
      .outerRadius(radius);

    // Draw arcs
    const arcs = g
      .selectAll('.arc')
      .data(pie(data))
      .join('path')
      .attr('class', 'arc')
      .attr('fill', (d) => colorScale(d.data.label))
      .attr('stroke', '#1a1a1a')
      .attr('stroke-width', 2);

    if (animate) {
      arcs
        .attr('d', d3.arc<d3.PieArcDatum<PieDataPoint>>().innerRadius(radius * innerRadius).outerRadius(radius * innerRadius))
        .transition()
        .duration(1000)
        .attrTween('d', function(d) {
          const interpolate = d3.interpolate({ startAngle: d.startAngle, endAngle: d.startAngle }, d);
          return (t) => arc(interpolate(t)) || '';
        });
    } else {
      arcs.attr('d', arc);
    }

    // Tooltip
    const tooltip = d3
      .select(container)
      .selectAll('.chart-tooltip')
      .data([null])
      .join('div')
      .attr('class', 'chart-tooltip')
      .style('position', 'absolute')
      .style('pointer-events', 'none')
      .style('background', 'rgba(0,0,0,0.85)')
      .style('color', 'white')
      .style('padding', '8px 12px')
      .style('border-radius', '8px')
      .style('font-size', '13px')
      .style('font-weight', '600')
      .style('white-space', 'nowrap')
      .style('opacity', '0')
      .style('z-index', '50')
      .style('box-shadow', '0 4px 12px rgba(0,0,0,0.3)')
      .style('border', '1px solid rgba(255,255,255,0.15)')
      .style('transition', 'opacity 0.15s');

    // Click + hover on arcs
    arcs
      .style('cursor', onSegmentClick ? 'pointer' : 'default')
      .on('mouseover', function(_event, d) {
        d3.select(this).attr('opacity', 0.8);
        const pct = total > 0 ? Math.round((d.data.value / total) * 100) : 0;
        tooltip
          .html(`<span style="color:${colorScale(d.data.label)}">&#9679;</span> ${d.data.label}: <strong>${d.data.value}</strong> (${pct}%)`)
          .style('opacity', '1');
      })
      .on('mousemove', function(event) {
        const [mx, my] = d3.pointer(event, container);
        tooltip
          .style('left', `${mx + 12}px`)
          .style('top', `${my - 10}px`);
      })
      .on('mouseout', function() {
        d3.select(this).attr('opacity', 1);
        tooltip.style('opacity', '0');
      });

    if (onSegmentClick) {
      arcs.on('click', (_event, d) => { onSegmentClick(d.data.label, d.data.value); });
    }

    // Labels
    if (showLabels) {
      const labelArc = d3
        .arc<d3.PieArcDatum<PieDataPoint>>()
        .innerRadius(radius * 0.8)
        .outerRadius(radius * 0.8);

      g.selectAll('.label')
        .data(pie(data))
        .join('text')
        .attr('class', 'label')
        .attr('transform', (d) => `translate(${labelArc.centroid(d)})`)
        .attr('text-anchor', 'middle')
        .attr('fill', 'white')
        .attr('font-size', '11px')
        .text((d) => (d.endAngle - d.startAngle > 0.3 ? d.data.label : ''));
    }

    // Center text (total)
    const total = data.reduce((sum, d) => sum + d.value, 0);
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.2em')
      .attr('fill', 'white')
      .attr('font-size', '24px')
      .attr('font-weight', 'bold')
      .text(total);

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1.2em')
      .attr('fill', 'rgba(255,255,255,0.5)')
      .attr('font-size', '12px')
      .text(totalLabel || 'Total');

    // Legend (skip SVG legend for RTL — HTML legend is used instead)
    if (showLegend && !rtl) {
      const legendX = chartSize + 20;
      const legend = svg
        .append('g')
        .attr('transform', `translate(${legendX}, 20)`);

      data.forEach((d, i) => {
        const legendItem = legend.append('g').attr('transform', `translate(0, ${i * 24})`);

        if (onSegmentClick) {
          legendItem
            .style('cursor', 'pointer')
            .on('mouseover', function() { d3.select(this).attr('opacity', 0.7); })
            .on('mouseout', function() { d3.select(this).attr('opacity', 1); })
            .on('click', () => { onSegmentClick(d.label, d.value); });
        }

        legendItem
          .append('rect')
          .attr('width', 12)
          .attr('height', 12)
          .attr('rx', 2)
          .attr('fill', colorScale(d.label));

        legendItem
          .append('text')
          .attr('x', 18)
          .attr('y', 10)
          .attr('fill', 'white')
          .attr('font-size', '12px')
          .attr('font-weight', '600')
          .text(`${d.label} (${d.value})`);
      });
    }
  }, [data, colors, innerRadius, showLabels, showLegend, animate, height, totalLabel]);

  // Use HTML legend for RTL since SVG <text> doesn't render Arabic properly
  const rtlMode = isRtl();
  const useHtmlLegend = showLegend && rtlMode;

  return (
    <div ref={containerRef} className={`w-full relative ${className}`} style={{ direction: 'ltr' }}>
      <div className={useHtmlLegend ? 'flex items-start gap-2' : ''} style={useHtmlLegend ? { direction: 'rtl' } : undefined}>
        {useHtmlLegend && (
          <div className="flex flex-col gap-1.5 pt-2 min-w-0 flex-1" style={{ direction: 'rtl' }}>
            {data.map((d, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 text-xs font-semibold text-white ${onSegmentClick ? 'cursor-pointer hover:opacity-70' : ''}`}
                onClick={onSegmentClick ? () => onSegmentClick(d.label, d.value) : undefined}
              >
                <span
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: colors[i % colors.length] }}
                />
                <span className="truncate">{d.label}</span>
                <span className="text-white/70 flex-shrink-0">({d.value})</span>
              </div>
            ))}
          </div>
        )}
        <svg ref={svgRef} className={useHtmlLegend ? 'flex-shrink-0' : 'w-full'} />
      </div>
    </div>
  );
}

/**
 * Multi-Line Chart Component
 */
interface MultiLineChartProps extends BaseChartProps {
  datasets: Array<{
    data: ChartDataPoint[];
    color: string;
    label: string;
  }>;
  showLegend?: boolean;
  animate?: boolean;
}

export function MultiLineChart({
  datasets,
  showLegend = true,
  animate = true,
  height = 200,
  className = '',
}: MultiLineChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || datasets.length === 0) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const margin = { top: showLegend ? 40 : 20, right: 20, bottom: 30, left: 40 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3
      .select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Get all unique labels
    const allLabels = datasets[0]?.data.map((d) => d.label) || [];
    const allValues = datasets.flatMap((ds) => ds.data.map((d) => d.value));

    // Scales
    const xScale = d3.scalePoint().domain(allLabels).range([0, innerWidth]).padding(0.5);
    const yScale = d3.scaleLinear().domain([0, d3.max(allValues) || 0]).nice().range([innerHeight, 0]);

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .selectAll('line')
      .data(yScale.ticks(5))
      .join('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', 'rgba(255,255,255,0.05)');

    // Draw each dataset
    datasets.forEach((dataset, index) => {
      const line = d3
        .line<ChartDataPoint>()
        .x((d) => xScale(d.label) || 0)
        .y((d) => yScale(d.value))
        .curve(d3.curveMonotoneX);

      const linePath = g
        .append('path')
        .datum(dataset.data)
        .attr('fill', 'none')
        .attr('stroke', dataset.color)
        .attr('stroke-width', 2)
        .attr('d', line);

      if (animate) {
        const totalLength = linePath.node()?.getTotalLength() || 0;
        linePath
          .attr('stroke-dasharray', totalLength)
          .attr('stroke-dashoffset', totalLength)
          .transition()
          .delay(index * 300)
          .duration(1500)
          .attr('stroke-dashoffset', 0);
      }
    });

    // X-axis
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(
        d3.axisBottom(xScale).tickValues(
          allLabels.filter((_, i) => i % Math.ceil(allLabels.length / 6) === 0)
        )
      )
      .attr('color', 'rgba(255,255,255,0.4)')
      .selectAll('text')
      .attr('font-size', '10px');

    // Y-axis
    g.append('g')
      .call(d3.axisLeft(yScale).ticks(5))
      .attr('color', 'rgba(255,255,255,0.4)')
      .selectAll('text')
      .attr('font-size', '10px');

    // Legend
    if (showLegend) {
      const legend = svg.append('g').attr('transform', `translate(${margin.left}, 10)`);

      datasets.forEach((dataset, i) => {
        const legendItem = legend.append('g').attr('transform', `translate(${i * 100}, 0)`);

        legendItem.append('line').attr('x1', 0).attr('x2', 16).attr('y1', 6).attr('y2', 6).attr('stroke', dataset.color).attr('stroke-width', 2);

        legendItem.append('text').attr('x', 22).attr('y', 10).attr('fill', 'rgba(255,255,255,0.8)').attr('font-size', '11px').text(dataset.label);
      });
    }
  }, [datasets, showLegend, animate, height]);

  return (
    <div ref={containerRef} className={`w-full ${className}`} style={{ direction: 'ltr' }}>
      <svg ref={svgRef} className="w-full" />
    </div>
  );
}

/**
 * Mini Sparkline Chart
 */
interface SparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  className?: string;
}

export function Sparkline({
  data,
  color = '#10b981',
  width = 80,
  height = 24,
  className = '',
}: SparklineProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current).attr('width', width).attr('height', height);

    const xScale = d3.scaleLinear().domain([0, data.length - 1]).range([2, width - 2]);
    const yScale = d3.scaleLinear().domain([Math.min(...data), Math.max(...data)]).range([height - 2, 2]);

    const line = d3
      .line<number>()
      .x((_, i) => xScale(i))
      .y((d) => yScale(d))
      .curve(d3.curveMonotoneX);

    svg
      .append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 1.5)
      .attr('d', line);

    // End dot
    svg
      .append('circle')
      .attr('cx', xScale(data.length - 1))
      .attr('cy', yScale(data[data.length - 1]))
      .attr('r', 2)
      .attr('fill', color);
  }, [data, color, width, height]);

  return <svg ref={svgRef} className={className} />;
}
