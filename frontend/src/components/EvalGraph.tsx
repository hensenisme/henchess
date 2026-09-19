import React from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'
import type { MoveAnalysis } from '../hooks/useChessGame'

interface EvalGraphProps {
  analysis: MoveAnalysis[]
}

export const EvalGraph: React.FC<EvalGraphProps> = ({ analysis }) => {
  if (!analysis || analysis.length === 0) return null

  // Process data for the chart
  const data = analysis.map((move, index) => {
    // Eval is from white's perspective. 
    // Convert centipawns to decimal pawns and cap between -10 and +10 to keep the graph readable
    let val = move.eval_after / 100
    if (val > 10) val = 10
    if (val < -10) val = -10

    return {
      moveNum: Math.floor(index / 2) + 1,
      turn: index % 2 === 0 ? 'W' : 'B',
      eval: val,
      san: move.san,
      rawEval: move.eval_after,
      badge: move.classification.label
    }
  })

  // Add the initial 0.0 starting position to the front of data
  const chartData = [
    { moveNum: 0, turn: 'Start', eval: 0, san: 'Start', rawEval: 0, badge: '' },
    ...data
  ]

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const p = payload[0].payload
      if (p.moveNum === 0) return null

      return (
        <div style={{
          backgroundColor: '#2b2d31',
          padding: '8px',
          border: '1px solid #4a4d55',
          borderRadius: '4px',
          color: '#fff',
          fontSize: '12px'
        }}>
          <div>{p.moveNum}{p.turn === 'W' ? '.' : '...'} {p.san}</div>
          <div style={{ color: p.eval > 0 ? '#fff' : '#aaa' }}>
            Eval: {(p.rawEval / 100).toFixed(1)}
          </div>
          {p.badge && (
            <div style={{ marginTop: '4px', fontWeight: 'bold' }}>
              {p.badge}
            </div>
          )}
        </div>
      )
    }
    return null
  }

  // To color the area above and below zero differently in recharts, we use a gradient
  return (
    <div style={{ width: '100%', height: '150px', marginBottom: '16px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="50%" stopColor="#f8f9fa" stopOpacity={0.8} />
              <stop offset="50%" stopColor="#343a40" stopOpacity={0.8} />
            </linearGradient>
          </defs>
          <XAxis dataKey="moveNum" hide />
          <YAxis domain={[-10, 10]} hide />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
          <Area
            type="monotone"
            dataKey="eval"
            stroke="#8884d8"
            strokeWidth={2}
            fill="url(#splitColor)"
            isAnimationActive={true}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
