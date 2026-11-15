import React from 'react';

interface RadarChartProps {
  scores: { [key: string]: number };
  feedbackCount: number;
  size?: number;
}

export const SKILL_LABELS = [
  { key: 'technical_ability_score', label: 'Technical' },
  { key: 'research_ability_score', label: 'Research' },
  { key: 'demo_output_score', label: 'Demo Output' },
  { key: 'ownership_score', label: 'Ownership' },
  { key: 'communication_score', label: 'Communication' },
  { key: 'leadership_score', label: 'Leadership' },
  { key: 'product_thinking_score', label: 'Product' },
  { key: 'reliability_score', label: 'Reliability' },
  { key: 'self_reflection_score', label: 'Self Reflection' }
];

export const RadarChart: React.FC<RadarChartProps> = ({ scores, feedbackCount, size = 320 }) => {
  const numAxes = SKILL_LABELS.length;
  const center = size / 2;
  const maxRadius = (size / 2) * 0.65;

  // Calculate coordinates for a given score (0-5) at a specific index
  const getCoordinates = (index: number, score: number) => {
    const angle = (index * 2 * Math.PI) / numAxes - Math.PI / 2;
    const radius = (score / 5) * maxRadius;
    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle);
    return { x, y, angle };
  };

  // Generate background grid concentric polygons (levels 1 to 5)
  const gridLevels = [1, 2, 3, 4, 5];
  const gridPaths = gridLevels.map((level) => {
    const points = Array.from({ length: numAxes }).map((_, i) => {
      const { x, y } = getCoordinates(i, level);
      return `${x},${y}`;
    });
    return points.join(' ');
  });

  // Calculate the path of the actual scores
  const scorePoints = SKILL_LABELS.map((s, i) => {
    const scoreVal = scores[s.key] || 0;
    const { x, y } = getCoordinates(i, scoreVal);
    return { x, y, label: s.label, value: scoreVal };
  });
  const scorePath = scorePoints.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div className="flex flex-col items-center gap-4 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm w-full">
      <div className="flex justify-between items-center w-full border-b border-gray-50 pb-2">
        <h4 className="font-extrabold text-xs text-gray-700 uppercase tracking-wider">Skill Growth Radar</h4>
        <span className="text-[10px] bg-magenta/5 border border-magenta/10 text-magenta font-bold px-2 py-0.5 rounded-lg">
          {feedbackCount === 0 ? 'No Reviews' : `${feedbackCount} ${feedbackCount === 1 ? 'Review' : 'Reviews'}`}
        </span>
      </div>

      {feedbackCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center text-gray-400 gap-2">
          <svg className="w-12 h-12 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-xs font-semibold">No evaluation scorecards submitted yet.</p>
        </div>
      ) : (
        <div className="relative w-full flex justify-center">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
            {/* Concentric grid lines */}
            {gridPaths.map((path, i) => (
              <polygon
                key={i}
                points={path}
                fill="none"
                stroke="#e2e8f0"
                className="dark:stroke-[#2d323b]"
                strokeWidth="1"
                strokeDasharray="2,2"
              />
            ))}

            {/* Concentric label helper rings (level circles for score markers 1..5) */}
            {gridLevels.map((level) => {
              const { y } = getCoordinates(0, level);
              return (
                <text
                  key={level}
                  x={center + 4}
                  y={y + 3}
                  className="fill-gray-300 font-extrabold text-[8px] select-none"
                >
                  {level}
                </text>
              );
            })}

            {/* Axis lines and labels */}
            {SKILL_LABELS.map((s, i) => {
              const outerPoint = getCoordinates(i, 5);
              const angle = outerPoint.angle;
              
              // Position labels slightly further out than maxRadius
              const labelRadius = maxRadius + 14;
              const lx = center + labelRadius * Math.cos(angle);
              const ly = center + labelRadius * Math.sin(angle);

              // Smart text positioning based on quadrant
              let textAnchor: "end" | "inherit" | "middle" | "start" | undefined = 'middle';
              const cosVal = Math.cos(angle);
              if (cosVal > 0.1) textAnchor = 'start';
              else if (cosVal < -0.1) textAnchor = 'end';

              let dy = '0.35em';
              const sinVal = Math.sin(angle);
              if (sinVal < -0.9) dy = '-0.2em';
              else if (sinVal > 0.9) dy = '0.9em';

              return (
                <g key={i}>
                  {/* Axis Line */}
                  <line
                    x1={center}
                    y1={center}
                    x2={outerPoint.x}
                    y2={outerPoint.y}
                    stroke="#f1f5f9"
                    className="dark:stroke-[#23272f]"
                    strokeWidth="1.5"
                  />
                  {/* Axis Label */}
                  <text
                    x={lx}
                    y={ly}
                    dy={dy}
                    textAnchor={textAnchor}
                    className="fill-gray-500 dark:fill-[#a0a7b2] font-extrabold text-[9px] tracking-tight select-none"
                  >
                    {s.label}
                  </text>
                </g>
              );
            })}

            {/* Score Area Path */}
            <polygon
              points={scorePath}
              fill="rgba(219, 39, 119, 0.12)"
              stroke="rgb(219, 39, 119)"
              strokeWidth="2"
              className="transition-all duration-500 ease-out"
            />

            {/* Score vertices markers */}
            {scorePoints.map((p, i) => (
              <g key={i} className="group cursor-pointer">
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="3.5"
                  className="fill-white dark:fill-[#15181e] stroke-magenta stroke-2 transition-all duration-300 hover:r-5 hover:fill-magenta"
                />
                <title>{p.label}: {p.value}</title>
              </g>
            ))}
          </svg>
        </div>
      )}

      {feedbackCount > 0 && (
        <div className="grid grid-cols-3 gap-2 w-full mt-2 border-t border-gray-50 pt-3">
          {SKILL_LABELS.map((s) => (
            <div key={s.key} className="bg-slate-50 border border-slate-100 rounded-lg p-2 flex flex-col items-center gap-0.5 justify-center">
              <span className="text-[8px] font-extrabold text-gray-400 uppercase tracking-tight text-center leading-none">
                {s.label}
              </span>
              <span className="text-xs font-bold text-gray-800">
                {scores[s.key] || 0}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
