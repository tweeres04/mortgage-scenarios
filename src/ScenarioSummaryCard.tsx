import React from 'react'
import { Scenario } from './App' // Assuming types are exported from App.tsx or a types file

interface ScenarioSummaryCardProps {
	scenario: Scenario
	index: number
	onRemove: (index: number) => void
	formatCurrency: (amount: number | undefined) => string
}

const ScenarioSummaryCard: React.FC<ScenarioSummaryCardProps> = ({
	scenario,
	index,
	onRemove,
	formatCurrency,
}) => {
	return (
		<div key={`${scenario.name}-${index}`} className="scenario-summary-card">
			<h3>{scenario.name}</h3>
			<p>
				Down Payment: {formatCurrency(scenario.downPayment)} (
				{scenario.downPaymentType === 'percent'
					? `${scenario.downPaymentInput}%`
					: formatCurrency(scenario.downPaymentInput)}
				)
			</p>
			<p>Interest Rate: {scenario.interestRate}%</p>
			<p>Term: {scenario.term} Years</p>
			<p>Monthly P&I: {formatCurrency(scenario.monthlyPayment)}</p>
			<button
				onClick={() => onRemove(index)}
				className="remove-button-small"
				style={{ marginTop: '5px' }}
			>
				Remove
			</button>
		</div>
	)
}

export default ScenarioSummaryCard
