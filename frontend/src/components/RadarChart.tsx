/**
 * RadarChart Component
 *
 * Displays a radar/spider chart for match score visualization.
 * Uses D3.js for rendering.
 */

'use client';

import { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';

interface RadarDataPoint {
  axis: string;
  value: number;
}

interface RadarChartProps {
  data: RadarDataPoint[];
  size?: number;
  maxValue?: number;
  levels?: number;
  className?: string;
  color?: string;
  showLabels?: boolean;
  animate?: boolean;
}

export default function RadarChart({
  data,
  size = 250,
  maxValue = 100,
  levels = 5,
  className = '',
  color = '#10b981', // Purple
  showLabels = true,
  animate = true,
}: RadarChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const config = useMemo(
    () => ({
      margin: { top: 30, right: 30, bottom: 30, left: 30 },
      labelFactor: 1.25,
      wrapWidth: 60,
      opacityArea: 0.35,
      dotRadius: 4,
      opacityCircles: 0.1,
      strokeWidth: 2,
      roundStrokes: true,
    }),
    []
  );

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    const width = size - config.margin.left - config.margin.right;
    const height = size - config.margin.top - config.margin.bottom;
    const radius = Math.min(width / 2, height / 2);
    const angleSlice = (Math.PI * 2) / data.length;

    // Create scales
    const rScale = d3.scaleLinear().range([0, radius]).domain([0, maxValue]);

    // Create SVG
    const svg = d3
      .select(svgRef.current)
      .attr('width', size)
      .attr('height', size)
      .append('g')
      .attr('transform', `translate(${size / 2}, ${size / 2})`);

    // Draw circular grid
    const axisGrid = svg.append('g').attr('class', 'axisWrapper');

    // Draw background circles
    axisGrid
      .selectAll('.levels')
      .data(d3.range(1, levels + 1).reverse())
      .enter()
      .append('circle')
      .attr('class', 'gridCircle')
      .attr('r', (d) => (radius / levels) * d)
      .style('fill', '#374151')
      .style('stroke', '#4b5563')
      .style('fill-opacity', config.opacityCircles);

    // Draw axis lines
    const axis = axisGrid
      .selectAll('.axis')
      .data(data)
      .enter()
      .append('g')
      .attr('class', 'axis');

    axis
      .append('line')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', (_d, i) => rScale(maxValue * 1.1) * Math.cos(angleSlice * i - Math.PI / 2))
      .attr('y2', (_d, i) => rScale(maxValue * 1.1) * Math.sin(angleSlice * i - Math.PI / 2))
      .attr('class', 'line')
      .style('stroke', '#4b5563')
      .style('stroke-width', '1px');

    // Draw axis labels
    if (showLabels) {
      axis
        .append('text')
        .attr('class', 'legend')
        .style('font-size', '11px')
        .style('fill', '#9ca3af')
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .attr(
          'x',
          (_d, i) => rScale(maxValue * config.labelFactor) * Math.cos(angleSlice * i - Math.PI / 2)
        )
        .attr(
          'y',
          (_d, i) => rScale(maxValue * config.labelFactor) * Math.sin(angleSlice * i - Math.PI / 2)
        )
        .text((d) => d.axis)
        .call(wrap, config.wrapWidth);
    }

    // Draw the radar chart blob
    const radarLine = d3
      .lineRadial<RadarDataPoint>()
      .curve(config.roundStrokes ? d3.curveCardinalClosed : d3.curveLinearClosed)
      .radius((d) => rScale(d.value))
      .angle((_d, i) => i * angleSlice);

    // Create a wrapper for the blob
    const blobWrapper = svg.append('g').attr('class', 'radarWrapper');

    // Draw the background area
    blobWrapper
      .append('path')
      .datum(data)
      .attr('class', 'radarArea')
      .attr('d', radarLine as any)
      .style('fill', color)
      .style('fill-opacity', config.opacityArea)
      .style('stroke', 'none');

    // Draw the outline
    blobWrapper
      .append('path')
      .datum(data)
      .attr('class', 'radarStroke')
      .attr('d', radarLine as any)
      .style('stroke-width', `${config.strokeWidth}px`)
      .style('stroke', color)
      .style('fill', 'none')
      .style('filter', 'url(#glow)');

    // Draw the dots
    blobWrapper
      .selectAll('.radarCircle')
      .data(data)
      .enter()
      .append('circle')
      .attr('class', 'radarCircle')
      .attr('r', config.dotRadius)
      .attr('cx', (d, i) => rScale(d.value) * Math.cos(angleSlice * i - Math.PI / 2))
      .attr('cy', (d, i) => rScale(d.value) * Math.sin(angleSlice * i - Math.PI / 2))
      .style('fill', color)
      .style('fill-opacity', 0.8);

    // Add glow filter
    const defs = svg.append('defs');
    const filter = defs.append('filter').attr('id', 'glow');
    filter.append('feGaussianBlur').attr('stdDeviation', '2').attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Animation
    if (animate) {
      const area = blobWrapper.select('.radarArea');
      const stroke = blobWrapper.select('.radarStroke');
      const circles = blobWrapper.selectAll('.radarCircle');

      // Start from center
      const zeroData = data.map((d) => ({ ...d, value: 0 }));

      area
        .datum(zeroData)
        .attr('d', radarLine as any)
        .transition()
        .duration(800)
        .ease(d3.easeElasticOut.amplitude(1).period(0.5))
        .attr('d', radarLine(data) as any);

      stroke
        .datum(zeroData)
        .attr('d', radarLine as any)
        .transition()
        .duration(800)
        .ease(d3.easeElasticOut.amplitude(1).period(0.5))
        .attr('d', radarLine(data) as any);

      circles
        .attr('cx', 0)
        .attr('cy', 0)
        .transition()
        .duration(800)
        .ease(d3.easeElasticOut.amplitude(1).period(0.5))
        .attr('cx', (d, i) => rScale((d as RadarDataPoint).value) * Math.cos(angleSlice * i - Math.PI / 2))
        .attr('cy', (d, i) => rScale((d as RadarDataPoint).value) * Math.sin(angleSlice * i - Math.PI / 2));
    }
  }, [data, size, maxValue, levels, config, color, showLabels, animate]);

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg ref={svgRef} />
    </div>
  );
}

// Helper function to wrap text
function wrap(text: d3.Selection<SVGTextElement, RadarDataPoint, SVGGElement, unknown>, width: number) {
  text.each(function () {
    const textEl = d3.select(this);
    const words = textEl.text().split(/\s+/).reverse();
    let word;
    let line: string[] = [];
    let lineNumber = 0;
    const lineHeight = 1.1;
    const y = textEl.attr('y');
    const x = textEl.attr('x');
    const dy = parseFloat(textEl.attr('dy') || '0');
    let tspan = textEl.text(null).append('tspan').attr('x', x).attr('y', y).attr('dy', `${dy}em`);

    while ((word = words.pop())) {
      line.push(word);
      tspan.text(line.join(' '));
      const node = tspan.node();
      if (node && node.getComputedTextLength() > width) {
        line.pop();
        tspan.text(line.join(' '));
        line = [word];
        tspan = textEl
          .append('tspan')
          .attr('x', x)
          .attr('y', y)
          .attr('dy', `${++lineNumber * lineHeight + dy}em`)
          .text(word);
      }
    }
  });
}
