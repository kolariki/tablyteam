import { useMemo } from 'react'

/**
 * The team at work, as a blurred looping scene behind the landing and the login: six roles (one colour each) around
 * a stage, the word passing between them as travelling dots, files and screens appearing as the product gets built,
 * and the app's screen lighting up in the middle. Pure SVG + SMIL, no JavaScript per frame, so it costs nothing.
 */
const ROLES = [
  { name: 'CEO', color: '#C0603F' },
  { name: 'CTO', color: '#17896A' },
  { name: 'Eng', color: '#3D5CC4' },
  { name: 'Product', color: '#AD7D1A' },
  { name: 'Diseño', color: '#9A57B8' },
  { name: 'QA', color: '#6E8226' },
]
const W = 1600
const H = 900
const CX = W / 2
const CY = H / 2 + 20
const RX = 560
const RY = 300

export default function TeamBackdrop({ blur = 7, opacity = 0.5, className = '', fixed = false }: { blur?: number; opacity?: number; className?: string; fixed?: boolean }) {
  const nodes = useMemo(() => ROLES.map((r, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / ROLES.length
    return { ...r, x: CX + Math.cos(a) * RX, y: CY + Math.sin(a) * RY }
  }), [])
  // the word goes around the table, then crosses to whoever is relevant: a loop of handoffs
  const passes = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [1, 4], [2, 5], [0, 3]]
  const files = ['package.json', 'app/page.tsx', 'lib/weather.ts', 'components/Umbrella.tsx', 'styles/tokens.css', 'tests/forecast.test.ts']
  return (
    <div className={`pointer-events-none ${fixed ? 'fixed' : 'absolute'} inset-0 overflow-hidden ${className}`} aria-hidden style={{ filter: `blur(${blur}px)`, opacity }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="h-full w-full">
        <defs>
          <radialGradient id="tb-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#2F6B5D" stopOpacity="0.25" />
            <stop offset="1" stopColor="#2F6B5D" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* the stage */}
        <ellipse cx={CX} cy={CY + 40} rx={RX + 60} ry={RY + 40} fill="url(#tb-glow)" />
        <ellipse cx={CX} cy={CY} rx={RX} ry={RY} fill="none" stroke="#2F6B5D" strokeOpacity="0.25" strokeWidth="2" strokeDasharray="4 10" />
        {/* the screen being built in the middle: a phone whose content appears piece by piece */}
        <g transform={`translate(${CX - 110} ${CY - 170})`}>
          <rect width="220" height="340" rx="30" fill="#FFFFFF" stroke="#1E2622" strokeOpacity="0.5" strokeWidth="6" />
          <rect x="18" y="26" width="120" height="14" rx="7" fill="#DCE2DE"><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="12s" repeatCount="indefinite" /></rect>
          <text x="20" y="100" fontFamily="ui-monospace, monospace" fontSize="54" fontWeight="700" fill="#1E2622">17°<animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.2;0.3;0.9;1" dur="12s" repeatCount="indefinite" /></text>
          <rect x="18" y="120" width="184" height="36" rx="12" fill="#2F6B5D"><animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.35;0.45;0.9;1" dur="12s" repeatCount="indefinite" /></rect>
          {[20, 36, 52, 70, 64, 40, 26, 18].map((h, i) => (
            <rect key={i} x={20 + i * 23} y={240 - h} width="16" height={h} rx="4" fill={h > 50 ? '#3D5CC4' : '#8FB7D3'}>
              <animate attributeName="opacity" values="0;0;1;1;0" keyTimes={`0;${0.5 + i * 0.03};${0.56 + i * 0.03};0.9;1`} dur="12s" repeatCount="indefinite" />
            </rect>
          ))}
          <rect x="18" y="262" width="184" height="30" rx="8" fill="#FDECEA" stroke="#E6A19A"><animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.75;0.82;0.9;1" dur="12s" repeatCount="indefinite" /></rect>
        </g>
        {/* files landing on the desk as the builder writes them */}
        {files.map((f, i) => {
          const x = i < 3 ? CX - 420 : CX + 250
          const y = CY - 120 + (i % 3) * 64
          const begin = `${(i * 1.6).toFixed(1)}s`
          return (
            <g key={f} opacity="0">
              <rect x={x} y={y} width="170" height="44" rx="10" fill="#FFFFFF" stroke="#DCE2DE" />
              <rect x={x + 14} y={y + 14} width="16" height="16" rx="4" fill="#2F6B5D" fillOpacity="0.35" />
              <text x={x + 40} y={y + 28} fontFamily="ui-monospace, monospace" fontSize="14" fill="#46514B">{f}</text>
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.08;0.85;1" dur="12s" begin={begin} repeatCount="indefinite" />
            </g>
          )
        })}
        {/* handoffs: the word travelling from role to role */}
        {passes.map(([a, b], i) => {
          const A = nodes[a]
          const B = nodes[b]
          const mx = (A.x + B.x) / 2 + (B.y - A.y) * 0.12
          const my = (A.y + B.y) / 2 - (B.x - A.x) * 0.12
          const path = `M${A.x},${A.y} Q${mx},${my} ${B.x},${B.y}`
          const begin = `${(i * 1.35).toFixed(2)}s`
          return (
            <g key={i}>
              <path d={path} fill="none" stroke={A.color} strokeOpacity="0.18" strokeWidth="2" />
              <circle r="9" fill={A.color} stroke="#FFFFFF" strokeWidth="3">
                <animateMotion dur="1.3s" begin={begin} repeatCount="indefinite" path={path} />
                <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="1.3s" begin={begin} repeatCount="indefinite" />
              </circle>
            </g>
          )
        })}
        {/* the roles */}
        {nodes.map((n, i) => (
          <g key={n.name} transform={`translate(${n.x} ${n.y})`}>
            <circle r="62" fill={n.color} fillOpacity="0.12">
              <animate attributeName="r" values="62;78;62" dur="3.6s" begin={`${i * 0.6}s`} repeatCount="indefinite" />
              <animate attributeName="fill-opacity" values="0.12;0.26;0.12" dur="3.6s" begin={`${i * 0.6}s`} repeatCount="indefinite" />
            </circle>
            <circle r="50" fill="#FFFFFF" stroke={n.color} strokeWidth="4" />
            <text y="8" textAnchor="middle" fontFamily="Newsreader, Georgia, serif" fontSize="22" fill="#1E2622">{n.name}</text>
            {/* speech: three bars that bounce while the role talks */}
            {[0, 1, 2].map((k) => (
              <rect key={k} x={-14 + k * 11} y={-92} width="7" height="18" rx="3" fill={n.color}>
                <animate attributeName="height" values="6;22;6" dur="0.7s" begin={`${i * 1.35 + k * 0.12}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.5;1" dur="8.1s" begin={`${i * 1.35}s`} repeatCount="indefinite" />
              </rect>
            ))}
          </g>
        ))}
      </svg>
    </div>
  )
}
