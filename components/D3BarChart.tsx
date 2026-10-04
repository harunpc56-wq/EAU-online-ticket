import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

export interface ExamTktStat {
  examId: string;
  examName: string;
  issued: number;
  pending: number;
  total: number;
}

interface D3BarChartProps {
  stats: ExamTktStat[];
  overall: {
    examName: string;
    issued: number;
    pending: number;
    total: number;
  };
}

export const D3BarChart: React.FC<D3BarChartProps> = ({ stats, overall }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });
  const [chartMode, setChartMode] = useState<'grouped' | 'overall'>('grouped');
  const [hoveredBar, setHoveredBar] = useState<{
    examName: string;
    type: 'Issued' | 'Pending';
    count: number;
    percentage: number;
    x: number;
    y: number;
  } | null>(null);

  // Responsive container observer
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width } = entries[0].contentRect;
      setDimensions({
        width: Math.max(width, 300),
        height: 380
      });
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Draw chart inside useEffect whenever stats, chartMode, or dimensions change
  useEffect(() => {
    if (!svgRef.current) return;

    // Clear previous drawing
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;
    const margin = { top: 40, right: 30, bottom: 85, left: 60 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Prepare data
    let chartData: Array<{ name: string; issued: number; pending: number }> = [];
    if (chartMode === 'overall') {
      chartData = [{
        name: 'All Exams Total',
        issued: overall.issued,
        pending: overall.pending
      }];
    } else {
      chartData = stats.map(s => ({
        name: s.examName.length > 25 ? s.examName.substring(0, 22) + '...' : s.examName,
        issued: s.issued,
        pending: s.pending
      }));
    }

    if (chartData.length === 0) {
      // Draw a fallback empty state inside the SVG
      svg.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('class', 'font-black uppercase tracking-widest text-xs fill-slate-300')
        .text('No active exam ticket allocations found');
      return;
    }

    // Main group
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // X0 Scale (Exams)
    const x0 = d3.scaleBand()
      .domain(chartData.map(d => d.name))
      .rangeRound([0, chartWidth])
      .paddingInner(0.2);

    // X1 Scale (Sub-groups: Issued vs Pending)
    const keys = ['issued', 'pending'];
    const x1 = d3.scaleBand()
      .domain(keys)
      .rangeRound([0, x0.bandwidth()])
      .padding(0.05);

    // Y Scale
    const maxVal = d3.max(chartData, d => Math.max(d.issued, d.pending)) || 1;
    const y = d3.scaleLinear()
      .domain([0, Math.ceil(maxVal * 1.15)]) // Add 15% headroom for aesthetic spacing
      .nice()
      .rangeRound([chartHeight, 0]);

    // Colors
    const color = d3.scaleOrdinal<string>()
      .domain(keys)
      .range(['#10B981', '#F59E0B']); // Emerald-500, Amber-500

    // Grid lines (horizontal)
    g.append('g')
      .attr('class', 'grid-lines')
      .attr('stroke', '#F1F5F9')
      .attr('stroke-width', 1)
      .selectAll('line')
      .data(y.ticks(5))
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', chartWidth)
      .attr('y1', d => y(d))
      .attr('y2', d => y(d));

    // X-Axis
    const xAxis = g.append('g')
      .attr('transform', `translate(0,${chartHeight})`)
      .call(d3.axisBottom(x0));

    // Customize X-Axis lines and text
    xAxis.select('.domain').attr('stroke', '#E2E8F0');
    xAxis.selectAll('line').attr('stroke', '#E2E8F0');
    xAxis.selectAll('text')
      .attr('class', 'font-bold uppercase text-[9px] fill-slate-500 tracking-wider')
      .attr('text-anchor', chartMode === 'overall' ? 'middle' : 'end')
      .attr('dx', chartMode === 'overall' ? '0em' : '-.8em')
      .attr('dy', chartMode === 'overall' ? '.75em' : '.15em')
      .attr('transform', chartMode === 'overall' ? 'none' : 'rotate(-30)');

    // Y-Axis
    const yAxis = g.append('g')
      .call(d3.axisLeft(y).ticks(Math.min(5, maxVal)).tickFormat(d3.format('d')));

    yAxis.select('.domain').attr('stroke', '#E2E8F0');
    yAxis.selectAll('line').attr('stroke', '#E2E8F0');
    yAxis.selectAll('text')
      .attr('class', 'font-mono text-[10px] fill-slate-400 font-bold');

    // Drawing Bars
    const examGroups = g.selectAll('.exam-group')
      .data(chartData)
      .enter()
      .append('g')
      .attr('class', 'exam-group')
      .attr('transform', d => `translate(${x0(d.name)},0)`);

    examGroups.selectAll('rect')
      .data(d => keys.map(key => ({ key, value: d[key as 'issued' | 'pending'], examName: d.name, total: d.issued + d.pending })))
      .enter()
      .append('rect')
      .attr('x', d => x1(d.key) || 0)
      .attr('y', chartHeight)
      .attr('width', x1.bandwidth())
      .attr('height', 0)
      .attr('fill', d => color(d.key))
      .attr('rx', 4)
      .attr('ry', 4)
      .on('mouseenter', function (event, d) {
        d3.select(this)
          .transition()
          .duration(150)
          .attr('opacity', 0.85);

        const [mx, my] = d3.pointer(event, svgRef.current);
        const percentage = d.total > 0 ? Math.round((d.value / d.total) * 100) : 0;

        setHoveredBar({
          examName: d.examName,
          type: d.key === 'issued' ? 'Issued' : 'Pending',
          count: d.value,
          percentage,
          x: mx,
          y: my - 15
        });
      })
      .on('mousemove', function (event) {
        const [mx, my] = d3.pointer(event, svgRef.current);
        setHoveredBar(prev => prev ? { ...prev, x: mx, y: my - 15 } : null);
      })
      .on('mouseleave', function () {
        d3.select(this)
          .transition()
          .duration(150)
          .attr('opacity', 1);

        setHoveredBar(null);
      })
      .transition()
      .duration(800)
      .delay((_, i) => i * 100)
      .attr('y', d => y(d.value))
      .attr('height', d => chartHeight - y(d.value));

  }, [dimensions, chartMode, stats, overall]);

  return (
    <div className="relative flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h4 className="text-xs font-black uppercase text-slate-400 tracking-[0.25em]">Hall Ticket Distribution</h4>
          <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Real-time D3 Visual Pipeline</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
          <button
            onClick={() => setChartMode('grouped')}
            className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${chartMode === 'grouped' ? 'bg-white text-blue-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            By Exam
          </button>
          <button
            onClick={() => setChartMode('overall')}
            className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${chartMode === 'overall' ? 'bg-white text-blue-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Overall Total
          </button>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 w-full bg-slate-50/50 rounded-3xl p-4 border border-slate-100 min-h-[380px] relative select-none">
        <svg ref={svgRef} className="w-full h-full overflow-visible" />

        {hoveredBar && (
          <div
            className="absolute z-10 pointer-events-none bg-slate-900 text-white rounded-2xl p-4 shadow-xl border border-slate-800 flex flex-col gap-1 text-left min-w-[150px] animate-in fade-in duration-150"
            style={{
              left: `${hoveredBar.x + 10}px`,
              top: `${hoveredBar.y - 15}px`,
              transform: 'translate(-50%, -100%)'
            }}
          >
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{hoveredBar.examName}</span>
            <div className="flex justify-between items-baseline gap-4 mt-1 border-t border-slate-800 pt-2">
              <span className="text-[10px] font-bold text-slate-300 uppercase">{hoveredBar.type}</span>
              <span className="text-lg font-mono font-black">{hoveredBar.count}</span>
            </div>
            {hoveredBar.percentage > 0 && (
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider mt-0.5">
                {hoveredBar.percentage}% of exam total
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-6 justify-center mt-6">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-emerald-500 rounded-lg"></div>
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Issued Tickets ({chartMode === 'overall' ? overall.issued : stats.reduce((acc, s) => acc + s.issued, 0)})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-amber-500 rounded-lg"></div>
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Pending Tickets ({chartMode === 'overall' ? overall.pending : stats.reduce((acc, s) => acc + s.pending, 0)})</span>
        </div>
      </div>
    </div>
  );
};
