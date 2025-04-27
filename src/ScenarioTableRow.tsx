import React from 'react'
import { Scenario, YearlyPaymentData } from './App' // Assuming types are exported from App.tsx or a types file

interface ScenarioTableRowProps {
	year: number
	scenario: Scenario
	dataForYear: YearlyPaymentData | undefined
	isFirstScenarioOfYear: boolean
	isLastScenarioOfYear: boolean
	isActiveMortgageYear: boolean
	rowIndex: number
	totalScenariosInYear: number
	formatCurrency: (amount: number | undefined) => string
}

const ScenarioTableRow: React.FC<ScenarioTableRowProps> = ({
	year,
	scenario,
	dataForYear,
	isFirstScenarioOfYear,
	isLastScenarioOfYear,
	isActiveMortgageYear,
	rowIndex,
	totalScenariosInYear,
	formatCurrency,
}) => {
	const rowClassName = `${
		rowIndex % 2 === 0 ? 'scenario-even' : 'scenario-odd'
	} ${isLastScenarioOfYear ? 'year-separator' : ''}`
	const rowStyle = !isActiveMortgageYear ? { color: '#999' } : {}

	if (!dataForYear) {
		// Render a placeholder row if data is missing
		return (
			<tr
				key={`${scenario.name}-${year}-missing-${rowIndex}`}
				className={rowClassName}
			>
				{isFirstScenarioOfYear ? (
					<td
						rowSpan={totalScenariosInYear}
						className="sticky-col sticky-col-1 text-center"
					>
						{year}
					</td>
				) : null}
				<td className="sticky-col sticky-col-2 text-left">
					{scenario.name} (Data Missing/Error)
				</td>
				{/* Adjust colspan based on the number of data columns (13 data cols + 2 sticky = 15 total) */}
				<td colSpan={13} className="text-left">
					Data missing or error for this year
				</td>
			</tr>
		)
	}

	return (
		<tr
			key={`${scenario.name}-${year}-${rowIndex}`}
			className={rowClassName}
			style={rowStyle}
		>
			{isFirstScenarioOfYear ? (
				<td
					rowSpan={totalScenariosInYear}
					className="sticky-col sticky-col-1 text-center"
				>
					{year}
				</td>
			) : null}
			<td className="sticky-col sticky-col-2 text-left">
				{scenario.name} {!isActiveMortgageYear ? '(Ended)' : ''}
			</td>
			<td className="sticky-col sticky-col-3 text-right">
				{isActiveMortgageYear
					? formatCurrency(dataForYear.beginningBalance)
					: '-'}
			</td>
			<td className="text-right">
				{isActiveMortgageYear
					? formatCurrency(dataForYear.principalPaidYearly)
					: '-'}
			</td>
			<td className="text-right">
				{isActiveMortgageYear
					? formatCurrency(dataForYear.interestPaidYearly)
					: '-'}
			</td>
			<td className="text-right">
				{isActiveMortgageYear ? formatCurrency(dataForYear.annualCost) : '-'}
			</td>
			<td className="text-right">
				{isActiveMortgageYear ? formatCurrency(dataForYear.endingBalance) : '-'}
			</td>
			<td className="text-right">
				{formatCurrency(dataForYear.totalInterestPaid)}
			</td>
			<td className="text-right">
				{isActiveMortgageYear && dataForYear.investmentDifference !== 0
					? formatCurrency(dataForYear.investmentDifference)
					: '-'}
			</td>
			<td className="text-right">
				{formatCurrency(dataForYear.totalPrincipalPaid)}
			</td>
			<td className="text-right">
				{formatCurrency(dataForYear.investmentProfitYearly)}
			</td>
			<td className="text-right">
				{formatCurrency(dataForYear.cumulativeInvestmentValue)}
			</td>
			<td className="text-right">
				{formatCurrency(dataForYear.totalNetWorth)}
			</td>
			<td className="text-right">
				{formatCurrency(dataForYear.netWorthDifference)}
			</td>
			<td className="text-right">
				{dataForYear.performancePercentage === 0
					? '-'
					: `${dataForYear.performancePercentage?.toFixed(2)}%`}
			</td>
		</tr>
	)
}

export default ScenarioTableRow
