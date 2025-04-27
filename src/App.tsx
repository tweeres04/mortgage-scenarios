import React, { useState, useMemo, useEffect } from 'react' // Import useEffect
// Add recharts imports
import {
	LineChart,
	Line,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer,
} from 'recharts'
import './App.css'
// import configData from './config.json'; // Remove JSON import
import jsyaml from 'js-yaml' // Import js-yaml

// Define an interface for the expected structure of config.yaml
interface ConfigData {
	homePrice: number
	initialInvestments: number
	initialScenarios: Array<{
		name: string
		downPaymentInput: number
		downPaymentType: 'amount' | 'percent'
		interestRate: number
		term: number
	}>
}

interface Scenario {
	name: string
	downPayment: number // No longer optional
	downPaymentInput: number // No longer optional
	downPaymentType: 'amount' | 'percent' // No longer optional
	interestRate: number // No longer optional
	term: number // No longer optional
	monthlyPayment: number // No longer optional
	yearlyData: YearlyPaymentData[] // No longer optional
}

interface YearlyPaymentData {
	year: number
	beginningBalance: number
	interestPaidYearly: number
	principalPaidYearly: number
	endingBalance: number
	totalPrincipalPaid: number
	totalInterestPaid: number
	annualCost: number // Added: Principal + Interest for the year
	investmentDifference?: number // Added: Difference vs lowest annual cost scenario
	cumulativeInvestmentValue?: number // Added: Total value of invested differences
	investmentProfitYearly?: number // Added: Investment gain, for the year
	totalNetWorth?: number // Added: Down Payment + Total Principal Paid + Cumulative Investment Value
	performancePercentage?: number // Added: % difference vs max net worth for the year
	netWorthDifference?: number // Now represents Year-over-Year change for the scenario
}

// Update return type
function calculateMortgageAmortization(
	principal: number,
	annualRate: number,
	termYears: number
): { yearlyData: YearlyPaymentData[]; monthlyPayment: number } | null {
	// Ensure principal = 0 is handled correctly, especially if rate is also 0
	if (principal < 0 || annualRate < 0 || termYears <= 0) {
		return null // Invalid input for negative values or zero term
	}
	if (principal === 0) {
		if (annualRate === 0) {
			// 100% down payment, 0% interest - loan is immediately paid off
			const yearlyDataForZeroPrincipal = [
				{
					year: 1, // Representing the state at the start/end of year 1
					beginningBalance: 0,
					interestPaidYearly: 0,
					principalPaidYearly: 0, // No principal paid via loan payments
					endingBalance: 0,
					totalPrincipalPaid: 0,
					totalInterestPaid: 0,
					annualCost: 0, // Add annual cost
				},
			]
			return { yearlyData: yearlyDataForZeroPrincipal, monthlyPayment: 0 }
		} else {
			// Cannot have interest on a zero principal loan
			return null
		}
	}

	const monthlyRate = annualRate / 12 / 100
	const numberOfPayments = termYears * 12

	// Handle zero interest rate case for non-zero principal
	const monthlyPayment =
		monthlyRate === 0
			? principal / numberOfPayments
			: (principal *
					(monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments))) /
			  (Math.pow(1 + monthlyRate, numberOfPayments) - 1)

	if (!isFinite(monthlyPayment)) {
		return null // Calculation resulted in Infinity or NaN
	}

	let balance = principal
	const yearlyData: YearlyPaymentData[] = []
	let totalPrincipalPaid = 0
	let totalInterestPaid = 0

	for (let year = 1; year <= termYears; year++) {
		const beginningBalanceYear = balance // Use const as it's not reassigned
		let interestPaidYearly = 0
		let principalPaidYearly = 0

		for (let month = 1; month <= 12; month++) {
			const currentMonth = (year - 1) * 12 + month
			if (currentMonth > numberOfPayments || balance <= 0.005) break // Stop if paid off early or term ends (use threshold)

			let interestForMonth: number
			let principalForMonth: number

			if (monthlyRate === 0) {
				interestForMonth = 0
				principalForMonth = monthlyPayment
			} else {
				interestForMonth = balance * monthlyRate
				principalForMonth = monthlyPayment - interestForMonth
			}

			// Ensure principal payment doesn't exceed remaining balance
			if (principalForMonth > balance) {
				interestForMonth = balance * monthlyRate // Recalculate interest based on actual principal paid
				if (interestForMonth < 0) interestForMonth = 0 // Avoid negative interest
				principalForMonth = balance
			}

			interestPaidYearly += interestForMonth
			principalPaidYearly += principalForMonth
			balance -= principalForMonth

			// Ensure balance doesn't go below zero due to floating point inaccuracies
			if (balance < 0.005) {
				// Use a small threshold for floating point comparison
				balance = 0
			}
		}

		totalPrincipalPaid += principalPaidYearly
		totalInterestPaid += interestPaidYearly

		// Calculate annual cost
		const annualCost = principalPaidYearly + interestPaidYearly

		yearlyData.push({
			year: year,
			beginningBalance: beginningBalanceYear,
			interestPaidYearly: interestPaidYearly,
			principalPaidYearly: principalPaidYearly,
			endingBalance: balance,
			totalPrincipalPaid: totalPrincipalPaid,
			totalInterestPaid: totalInterestPaid,
			annualCost: annualCost, // Add annual cost
			// Investment fields will be calculated later
		})

		if (balance <= 0) break // Stop if loan is fully paid
	}

	// Return object with yearlyData and monthlyPayment
	return { yearlyData, monthlyPayment }
}

// Helper function to create initial scenarios from config
const createInitialScenariosFromConfig = (
	homePrice: number,
	initialScenarioConfigs: ConfigData['initialScenarios']
): Scenario[] => {
	const initialScenarios: Scenario[] = []

	initialScenarioConfigs.forEach((config) => {
		let actualDownPayment: number
		if (config.downPaymentType === 'amount') {
			actualDownPayment = config.downPaymentInput
		} else {
			actualDownPayment = homePrice * (config.downPaymentInput / 100)
		}

		const principal = homePrice - actualDownPayment

		// Basic validation (can be enhanced)
		if (principal < 0 || config.interestRate < 0 || config.term <= 0) {
			console.error(
				`Invalid configuration for scenario ${config.name}. Skipping.`
			)
			return // Skip this scenario
		}
		if (principal === 0 && config.interestRate !== 0) {
			console.error(
				`Scenario ${config.name} has 0 principal but non-zero interest. Skipping.`
			)
			return // Skip this scenario
		}

		const calculationResult = calculateMortgageAmortization(
			principal,
			config.interestRate,
			config.term
		)

		if (calculationResult) {
			initialScenarios.push({
				name: config.name,
				downPayment: actualDownPayment,
				downPaymentInput: config.downPaymentInput,
				downPaymentType: config.downPaymentType,
				interestRate: config.interestRate,
				term: config.term,
				yearlyData: calculationResult.yearlyData,
				monthlyPayment: calculationResult.monthlyPayment,
			})
		} else {
			console.error(
				`Failed to calculate amortization for scenario ${config.name}. Skipping.`
			)
		}
	})

	return initialScenarios
}

function App() {
	// State to hold the loaded config data
	const [configData, setConfigData] = useState<ConfigData | null>(null)
	const [loadingConfig, setLoadingConfig] = useState(true)
	const [configError, setConfigError] = useState<string | null>(null)

	// Fetch and parse the YAML config file on component mount
	useEffect(() => {
		fetch('/src/config.yaml') // Fetch from the public path Vite serves
			.then((response) => {
				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`)
				}
				return response.text()
			})
			.then((yamlText) => {
				try {
					const loadedConfig = jsyaml.load(yamlText) as ConfigData
					// Basic validation of loaded config structure
					if (
						!loadedConfig ||
						typeof loadedConfig !== 'object' ||
						!loadedConfig.initialScenarios
					) {
						throw new Error('Invalid YAML structure')
					}
					setConfigData(loadedConfig)
				} catch (e: unknown) {
					// Changed 'any' to 'unknown'
					console.error('Error parsing YAML:', e)
					// Type assertion or check needed if accessing specific properties of e
					const errorMessage = e instanceof Error ? e.message : String(e)
					setConfigError(`Error parsing config.yaml: ${errorMessage}`)
				}
			})
			.catch((error) => {
				console.error('Error fetching config.yaml:', error)
				setConfigError(`Error fetching config.yaml: ${error.message}`)
			})
			.finally(() => {
				setLoadingConfig(false)
			})
	}, []) // Empty dependency array ensures this runs only once on mount

	// Initialize state *after* config is loaded
	// We use default values initially or while loading
	const [homePrice, setHomePrice] = useState<number>(configData?.homePrice ?? 0)
	const [initialInvestments, setInitialInvestments] = useState<number>(
		configData?.initialInvestments ?? 0
	)
	const [scenarios, setScenarios] = useState<Scenario[]>([])

	// Effect to update state once config is loaded
	useEffect(() => {
		if (configData) {
			setHomePrice(configData.homePrice)
			setInitialInvestments(configData.initialInvestments)
			setScenarios(
				createInitialScenariosFromConfig(
					configData.homePrice,
					configData.initialScenarios
				)
			)
		}
	}, [configData]) // Re-run when configData changes

	// State for the new scenario form
	// Removed newScenarioType, newInitialMonthlyRent, newAnnualRentIncrease
	const [newScenarioName, setNewScenarioName] = useState<string>('')
	const [newDownPaymentType, setNewDownPaymentType] = useState<
		'amount' | 'percent'
	>('percent')
	const [newDownPaymentValue, setNewDownPaymentValue] = useState<number>(20)
	const [newInterestRate, setNewInterestRate] = useState<number>(4.19)
	const [newTerm, setNewTerm] = useState<number>(30)

	// Find the maximum term across scenarios
	const maxYears = Math.max(30, ...scenarios.map((s) => s.term)) // Simplified maxYears
	const INVESTMENT_RATE = 0.07 // 7% annual growth

	const addScenario = () => {
		// Use index or a generated name if empty
		const scenarioName =
			newScenarioName.trim() || `Scenario ${scenarios.length + 1}`
		// Check if name already exists
		if (scenarios.some((s) => s.name === scenarioName)) {
			alert(
				`Scenario name "${scenarioName}" already exists. Please choose a unique name.`
			)
			return
		}

		let actualDownPayment: number
		if (newDownPaymentType === 'amount') {
			actualDownPayment = newDownPaymentValue
		} else {
			if (newDownPaymentValue < 0 || newDownPaymentValue > 100) {
				alert('Down payment percentage must be between 0 and 100.')
				return
			}
			actualDownPayment = homePrice * (newDownPaymentValue / 100)
		}

		if (actualDownPayment < 0) {
			alert('Down payment cannot be negative.')
			return
		}
		if (actualDownPayment > homePrice) {
			alert('Down payment cannot be greater than the home price.')
			return
		}

		const principal = homePrice - actualDownPayment
		if (principal < 0) {
			alert('Calculated loan principal is negative.')
			return
		}
		if (principal === 0 && newInterestRate !== 0) {
			alert(
				'If down payment covers the full home price (0 principal), the interest rate must be 0.'
			)
			return
		}
		if (newInterestRate < 0) {
			alert('Interest rate cannot be negative.')
			return
		}
		if (newTerm <= 0) {
			alert('Term must be positive.')
			return
		}

		const calculationResult = calculateMortgageAmortization(
			principal,
			newInterestRate,
			newTerm
		)

		if (!calculationResult) {
			alert(
				'Could not calculate mortgage amortization. Please check input values.'
			)
			return
		}

		const newScenario: Scenario = {
			name: scenarioName,
			downPayment: actualDownPayment,
			downPaymentInput: newDownPaymentValue,
			downPaymentType: newDownPaymentType,
			interestRate: newInterestRate,
			term: newTerm,
			yearlyData: calculationResult.yearlyData,
			monthlyPayment: calculationResult.monthlyPayment,
		}

		setScenarios([...scenarios, newScenario])

		// Reset form defaults
		setNewScenarioName('') // Reset name field
		setNewDownPaymentType('percent')
		setNewDownPaymentValue(20)
		setNewInterestRate(4.19)
		setNewTerm(30)
		// Removed rental input resets
	}

	const removeScenario = (indexToRemove: number) => {
		setScenarios(scenarios.filter((_, index) => index !== indexToRemove))
	}

	const formatCurrency = (amount: number | undefined) => {
		// Handle undefined, potential NaN or Infinity before formatting
		if (amount === undefined || !isFinite(amount)) {
			return 'N/A' // Or some other indicator
		}
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
		}).format(amount)
	}

	// Helper function to format currency for chart tooltips/axis
	const formatCurrencyForChart = (value: number | undefined) => {
		if (value === undefined || !isFinite(value)) {
			return 'N/A'
		}
		// Use compact notation for large numbers on the axis/tooltip
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			notation: 'compact', // e.g., $1.2M
			maximumFractionDigits: 1,
		}).format(value)
	}

	// Helper function to format percentage
	// const formatPercentage = (value: number | undefined) => { // Comment out unused function for now
	// 	if (value === undefined || !isFinite(value)) {
	// 		return 'N/A'
	// 	}
	// 	// Add check for exactly 0
	// 	if (value === 0) {
	// 		return '-'
	// 	}
	// 	const formatted = value.toFixed(2)
	// 	return value > 0 ? `+${formatted}%` : `${formatted}%`
	// }

	const handleDownPaymentTypeChange = (
		event: React.ChangeEvent<HTMLInputElement>
	) => {
		const type = event.target.value as 'amount' | 'percent'
		setNewDownPaymentType(type)
		// Optional: Reset or adjust the value when type changes
		if (type === 'percent') {
			// Maybe default to 20% if switching to percent?
			setNewDownPaymentValue(20)
		} else {
			// Maybe default to 20% of home price if switching to amount?
			setNewDownPaymentValue(homePrice * 0.2)
		}
	}

	// Calculate investment growth data using useMemo (Simplified Logic)
	const scenariosWithInvestment = useMemo(() => {
		if (!configData || scenarios.length < 1) return [] // Guard against running before config is loaded

		const processedScenarios = JSON.parse(
			JSON.stringify(scenarios)
		) as Scenario[]

		// Store the initial investment amount for each scenario using index or name as key
		const initialInvestmentValues: { [scenarioName: string]: number } = {} // Use name as key
		processedScenarios.forEach((scenario) => {
			// Simplified initial investment calculation (mortgage only)
			initialInvestmentValues[scenario.name] = Math.max(
				// Use name as key
				0,
				initialInvestments - scenario.downPayment
			)
		})

		const currentCumulativeValues = { ...initialInvestmentValues }

		// Use simplified maxYears
		const calculationMaxYears = maxYears

		for (let year = 1; year <= calculationMaxYears; year++) {
			// --- Step 1: Find Max Annual Cost for the current year (mortgage only) ---
			let maxAnnualCost = 0
			processedScenarios.forEach((scenario) => {
				const dataForYear = scenario.yearlyData?.find((d) => d.year === year)
				if (dataForYear && scenario.term >= year) {
					maxAnnualCost = Math.max(maxAnnualCost, dataForYear.annualCost)
				}
			})

			let maxNetWorthThisYear = -Infinity

			// --- Step 2: Calculate Investment, Net Worth for each scenario (mortgage only) ---
			processedScenarios.forEach((scenario) => {
				const dataForYear = scenario.yearlyData?.find((d) => d.year === year)
				// Use scenario.name as the key
				const previousCumulativeValue =
					currentCumulativeValues[scenario.name] || 0
				const dataForPreviousYear = scenario.yearlyData?.find(
					(d) => d.year === year - 1
				)
				const yearlyProfit = previousCumulativeValue * INVESTMENT_RATE

				// --- Handle scenarios that ended previously --- (Simplified)
				if (!dataForYear && scenario.term < year) {
					const lastData = scenario.yearlyData?.[scenario.yearlyData.length - 1]
					const lastTotalPrincipalPaid = lastData?.totalPrincipalPaid || 0

					const currentCumulativeValue =
						previousCumulativeValue * (1 + INVESTMENT_RATE)
					currentCumulativeValues[scenario.name] = currentCumulativeValue

					// Simplified Net Worth Calculation (mortgage only)
					const netWorthForEndedYear =
						scenario.downPayment +
						lastTotalPrincipalPaid +
						currentCumulativeValue

					// Ensure placeholder data exists
					let placeholderData = scenario.yearlyData?.find(
						(d) => d.year === year
					)
					if (!placeholderData) {
						if (!scenario.yearlyData) scenario.yearlyData = []
						placeholderData = {
							year: year,
							beginningBalance: 0,
							interestPaidYearly: 0,
							principalPaidYearly: 0,
							endingBalance: 0,
							totalPrincipalPaid: lastTotalPrincipalPaid,
							totalInterestPaid: lastData?.totalInterestPaid || 0,
							annualCost: 0,
							investmentDifference: 0,
							cumulativeInvestmentValue: 0,
							investmentProfitYearly: 0,
							totalNetWorth: 0,
						}
						scenario.yearlyData.push(placeholderData)
					}
					// Populate placeholder data
					placeholderData.investmentDifference = 0
					placeholderData.cumulativeInvestmentValue = currentCumulativeValue
					placeholderData.investmentProfitYearly = yearlyProfit
					placeholderData.totalNetWorth = netWorthForEndedYear
					placeholderData.totalPrincipalPaid = lastTotalPrincipalPaid

					// Calculate Year-over-Year Change ($) (Simplified base case)
					let prevNetWorth: number
					if (year === 1) {
						prevNetWorth =
							scenario.downPayment + initialInvestmentValues[scenario.name]
					} else {
						prevNetWorth = dataForPreviousYear?.totalNetWorth ?? 0
					}
					const difference = netWorthForEndedYear - prevNetWorth
					placeholderData.netWorthDifference = isFinite(difference)
						? difference
						: 0

					maxNetWorthThisYear = Math.max(
						maxNetWorthThisYear,
						netWorthForEndedYear
					)

					// --- Handle active scenarios --- (Simplified)
				} else if (dataForYear) {
					const investmentAmount =
						scenario.term >= year && maxAnnualCost > 0
							? maxAnnualCost - dataForYear.annualCost
							: 0

					const currentCumulativeValue =
						previousCumulativeValue * (1 + INVESTMENT_RATE) + investmentAmount
					currentCumulativeValues[scenario.name] = currentCumulativeValue

					dataForYear.investmentDifference = investmentAmount
					dataForYear.cumulativeInvestmentValue = currentCumulativeValue
					dataForYear.investmentProfitYearly = yearlyProfit

					// Simplified Net Worth Calculation (mortgage only)
					dataForYear.totalNetWorth =
						scenario.downPayment +
						dataForYear.totalPrincipalPaid +
						currentCumulativeValue

					// Calculate Year-over-Year Change ($) (Simplified base case)
					let prevNetWorth: number
					if (year === 1) {
						prevNetWorth =
							scenario.downPayment + initialInvestmentValues[scenario.name]
					} else {
						prevNetWorth = dataForPreviousYear?.totalNetWorth ?? 0
					}
					const difference = dataForYear.totalNetWorth - prevNetWorth
					dataForYear.netWorthDifference = isFinite(difference) ? difference : 0

					maxNetWorthThisYear = Math.max(
						maxNetWorthThisYear,
						dataForYear.totalNetWorth
					)
				}
			})

			// --- Step 3: Calculate Performance Percentage (no changes needed here) ---
			if (isFinite(maxNetWorthThisYear) && maxNetWorthThisYear !== -Infinity) {
				processedScenarios.forEach((scenario) => {
					const dataForYear = scenario.yearlyData?.find((d) => d.year === year)
					if (dataForYear && dataForYear.totalNetWorth !== undefined) {
						const denominator = Math.abs(maxNetWorthThisYear)
						const performance =
							denominator === 0
								? dataForYear.totalNetWorth === 0
									? 0
									: Infinity
								: ((dataForYear.totalNetWorth - maxNetWorthThisYear) /
										denominator) *
								  100
						dataForYear.performancePercentage = isFinite(performance)
							? performance
							: performance > 0
							? 100
							: -100
					} else if (dataForYear) {
						dataForYear.performancePercentage = 0
					}
				})
			} else {
				processedScenarios.forEach((scenario) => {
					const dataForYear = scenario.yearlyData?.find((d) => d.year === year)
					if (dataForYear) {
						dataForYear.performancePercentage = 0
					}
				})
			}
		}

		return processedScenarios
	}, [scenarios, initialInvestments, configData, maxYears]) // Add configData and maxYears as dependencies

	// Define an interface for the chart data points
	interface ChartDataPoint {
		year: string // e.g., "Year 1"
		// Keys will be dynamically generated like: "ScenarioName_MetricName"
		[key: string]: number | string | null // Allow dynamic keys holding numbers or null
	}

	// --- Prepare data for the chart ---
	const chartData = useMemo(() => {
		if (scenariosWithInvestment.length === 0) return []

		const data: ChartDataPoint[] = [] // Use the defined interface

		for (let year = 1; year <= maxYears; year++) {
			const yearData: ChartDataPoint = { year: `Year ${year}` } // Use string for XAxis label

			scenariosWithInvestment.forEach((scenario) => {
				const dataForYear = scenario.yearlyData?.find((d) => d.year === year)
				// Add data for each metric, prefixing with scenario name
				yearData[`${scenario.name}_totalNetWorth`] =
					dataForYear?.totalNetWorth ?? null
				yearData[`${scenario.name}_totalPrincipalPaid`] =
					dataForYear?.totalPrincipalPaid ?? null
				yearData[`${scenario.name}_totalInterestPaid`] =
					dataForYear?.totalInterestPaid ?? null
				yearData[`${scenario.name}_cumulativeInvestmentValue`] =
					dataForYear?.cumulativeInvestmentValue ?? null
				yearData[`${scenario.name}_endingBalance`] =
					dataForYear?.endingBalance ?? null
			})
			data.push(yearData)
		}
		return data
	}, [scenariosWithInvestment, maxYears]) // Keep chartData definition

	// Define colors for the chart lines
	const chartColors = useMemo(() => {
		// Basic color palette, can be expanded or made dynamic
		const colors = [
			'#8884d8',
			'#82ca9d',
			'#ffc658',
			'#ff7300',
			'#00C49F',
			'#FFBB28',
			'#FF8042',
		]
		const colorMap: { [key: string]: string } = {}
		scenariosWithInvestment.forEach((scenario, index) => {
			colorMap[scenario.name] = colors[index % colors.length]
		})
		return colorMap
	}, [scenariosWithInvestment])

	// --- Render Logic ---
	if (loadingConfig) {
		return <div>Loading configuration...</div>
	}

	if (configError) {
		return <div>Error loading configuration: {configError}</div>
	}

	if (!configData) {
		// Should ideally not happen if error handling is correct, but good practice
		return <div>Configuration not available.</div>
	}

	return (
		<div className="App">
			<h1>Mortgage Scenario Comparison</h1> {/* Reverted Title */}
			{/* --- Global Inputs --- */}
			<div style={{ display: 'flex', gap: '20px', marginBottom: '10px' }}>
				<div>
					<label>
						Home Price:
						<input
							type="number"
							value={homePrice}
							onChange={(e) => {
								const newPrice = Number(e.target.value)
								setHomePrice(newPrice)
								// Optional: Adjust default down payment amount when home price changes
								if (newDownPaymentType === 'amount') {
									setNewDownPaymentValue(newPrice * 0.2) // Adjust default amount to 20%
								}
							}}
							min="0"
						/>
					</label>
				</div>
				<div>
					<label>
						Initial Investments:
						<input
							type="number"
							value={initialInvestments}
							onChange={(e) => setInitialInvestments(Number(e.target.value))}
							min="0"
						/>
					</label>
				</div>
			</div>
			<hr />
			{/* --- Add New Scenario Form --- (Simplified) */}
			<h2>Add New Scenario</h2>
			{/* Removed Scenario Type Selection */}
			{/* Wrap form inputs in a div for styling */}
			<div className="add-scenario-form">
				{/* Scenario Name Input */}
				<div>
					<label>
						Scenario Name (Optional):
						<input
							type="text"
							value={newScenarioName}
							onChange={(e) => setNewScenarioName(e.target.value)}
							placeholder={`e.g., Scenario ${scenarios.length + 1}`} // Updated placeholder
							style={{ width: '200px', marginLeft: '5px' }}
						/>
					</label>
				</div>

				{/* Mortgage Inputs Only */}
				<div>
					<label style={{ marginRight: '10px' }}>Down Payment Type:</label>
					<label style={{ marginRight: '10px', display: 'inline-block' }}>
						<input
							type="radio"
							value="amount"
							checked={newDownPaymentType === 'amount'}
							onChange={handleDownPaymentTypeChange}
							style={{ marginRight: '5px' }} // Added margin
						/>
						Amount ($)
					</label>
					<label style={{ display: 'inline-block' }}>
						<input
							type="radio"
							value="percent"
							checked={newDownPaymentType === 'percent'}
							onChange={handleDownPaymentTypeChange}
							style={{ marginRight: '5px' }} // Added margin
						/>
						Percent (%)
					</label>
				</div>
				<div>
					<label>
						Down Payment ({newDownPaymentType === 'amount' ? '$' : '%'}):
						<input
							type="number"
							value={newDownPaymentValue}
							onChange={(e) => setNewDownPaymentValue(Number(e.target.value))}
							min="0"
							step={newDownPaymentType === 'percent' ? '0.1' : '1'}
						/>
						{newDownPaymentType === 'percent' && (
							<span style={{ marginLeft: '10px', color: '#555' }}>
								({formatCurrency(homePrice * (newDownPaymentValue / 100))})
							</span>
						)}
					</label>
				</div>
				<div>
					<label>
						Interest Rate:{' '}
						<input
							type="number"
							value={newInterestRate}
							onChange={(e) => setNewInterestRate(Number(e.target.value))}
							step="0.01"
							min="0"
						/>
					</label>
				</div>
				<div>
					<label>
						Term:{' '}
						<input
							type="number"
							value={newTerm}
							onChange={(e) => setNewTerm(Number(e.target.value))}
							min="1"
						/>
					</label>
				</div>
			</div>{' '}
			{/* End of add-scenario-form wrapper */}
			{/* Removed Conditional Inputs and Rental Inputs */}
			<button onClick={addScenario}>Add Scenario</button>
			<hr />
			{/* --- Scenario Summaries --- (Simplified) */}
			<h2>Current Scenarios</h2>
			{scenarios.length === 0 ? (
				<p>No scenarios added yet.</p>
			) : (
				<div className="scenario-summaries">
					{/* Use index for key and remove function */}
					{scenarios.map((scenario, index) => (
						<div
							key={`${scenario.name}-${index}`}
							className="scenario-summary-card"
						>
							<h3>{scenario.name}</h3> {/* Removed type indicator */}
							{/* Simplified to only show mortgage details */}
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
							{/* Removed rental details block */}
							<button
								onClick={() => removeScenario(index)}
								className="remove-button-small"
								style={{ marginTop: '5px' }}
							>
								Remove
							</button>
						</div>
					))}
				</div>
			)}
			<hr /> {/* Ensure hr is outside the conditional block */}
			{/* --- Net Worth Chart --- */}
			<h2>Scenario Comparison Chart</h2> {/* Updated Title */}
			{scenariosWithInvestment.length > 0 ? (
				<div style={{ width: '100%', height: 500, marginBottom: '20px' }}>
					<ResponsiveContainer>
						<LineChart
							data={chartData} // Use prepared chartData
							margin={{
								top: 5,
								right: 30,
								left: 30, // Increased left margin for Y-axis label
								bottom: 5,
							}}
						>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis dataKey="year" />
							<YAxis tickFormatter={formatCurrencyForChart} />{' '}
							{/* Re-add formatter */}
							<Tooltip
								// Adjust formatter to use the Line's 'name' prop for clarity
								formatter={(
									value: number | string | (number | string)[] | null,
									_dataKey: string, // The internal key like "Scenario A_totalNetWorth"
									props // Contains payload, name, color etc.
								) => {
									const displayName = props.name; // Use the name prop from <Line> ("Scenario A - Net Worth")

									// Format the value as currency
									let formattedValue: string;
									if (Array.isArray(value)) {
										// Handle potential arrays (less likely for Line chart values)
										formattedValue = value.map(v => typeof v === 'number' ? formatCurrency(v) : String(v)).join(', ');
									} else if (typeof value === 'number') {
										formattedValue = formatCurrency(value);
									} else {
										// Handle string or null
										formattedValue = value !== null ? String(value) : 'N/A';
									}

									// Return the formatted value and the display name from the Line's name prop
									return [formattedValue, displayName];
								}}
								// Custom label formatter to show scenario name clearly
								labelFormatter={(label) =>
									`Year: ${label.replace('Year ', '')}`
								}
								// Custom item sorter if needed
								itemSorter={(item) => {
									// Sort by scenario name first, then metric
									const parts = item.dataKey?.toString().split('_') ?? []
									const scenarioName = parts[0]
									const metric = parts.slice(1).join('_')
									// Define an order for metrics
									const metricOrder: { [key: string]: number } = {
										totalNetWorth: 1,
										cumulativeInvestmentValue: 2,
										totalPrincipalPaid: 3,
										endingBalance: 4,
										totalInterestPaid: 5,
									}
									return `${scenarioName}_${metricOrder[metric] ?? 99}`
								}}
							/>
							<Legend />
							{/* Map scenarios and metrics to Line components using flatMap */}
							{scenariosWithInvestment.flatMap((scenario) =>
								// Return an array of all Line components for this scenario
								[
									// Total Net Worth (Solid)
									<Line
										key={`${scenario.name}_totalNetWorth`}
										type="monotone"
										dataKey={`${scenario.name}_totalNetWorth`}
										name={`${scenario.name} - Net Worth`}
										stroke={chartColors[scenario.name]}
										activeDot={{ r: 6 }}
										connectNulls
										// dot={false} // Keep commented for now
									/>,
									// Total Principal Paid (Dashed)
									<Line
										key={`${scenario.name}_totalPrincipalPaid`}
										type="monotone"
										dataKey={`${scenario.name}_totalPrincipalPaid`}
										name={`${scenario.name} - Principal Paid`}
										stroke={chartColors[scenario.name]}
										strokeDasharray="5 5"
										activeDot={{ r: 6 }}
										connectNulls
										// dot={false} // Keep commented for now
									/>,
									// Total Interest Paid (Dotted)
									<Line
										key={`${scenario.name}_totalInterestPaid`}
										type="monotone"
										dataKey={`${scenario.name}_totalInterestPaid`}
										name={`${scenario.name} - Interest Paid`}
										stroke={chartColors[scenario.name]}
										strokeDasharray="1 3"
										activeDot={{ r: 6 }}
										connectNulls
										// dot={false} // Keep commented for now
									/>,
									// Cumulative Investment Value (Dash-Dot)
									<Line
										key={`${scenario.name}_cumulativeInvestmentValue`}
										type="monotone"
										dataKey={`${scenario.name}_cumulativeInvestmentValue`}
										name={`${scenario.name} - Investment Value`}
										stroke={chartColors[scenario.name]}
										strokeDasharray="10 5 2 5"
										activeDot={{ r: 6 }}
										connectNulls
										// dot={false} // Keep commented for now
									/>,
									// Ending Balance (Short Dashes)
									<Line
										key={`${scenario.name}_endingBalance`}
										type="monotone"
										dataKey={`${scenario.name}_endingBalance`}
										name={`${scenario.name} - Ending Balance`}
										stroke={chartColors[scenario.name]}
										strokeDasharray="3 3"
										activeDot={{ r: 6 }}
										connectNulls
										// dot={false} // Keep commented for now
									/>,
								]
							)}
						</LineChart>
					</ResponsiveContainer>
				</div>
			) : (
				<p>Add scenarios to see the comparison chart.</p> // Updated message
			)}
			{/* --- Combined Scenario Table --- (Simplified) */}
			<h2>Comparison Table</h2>
			{scenariosWithInvestment.length === 0 ? (
				<p>No scenarios added yet.</p>
			) : (
				<div className="table-container">
					<table>
						<thead>
							<tr>
								{/* Apply sticky and alignment classes to headers */}
								<th className="sticky-col sticky-col-1 text-center">Year</th>
								<th className="sticky-col sticky-col-2 text-left">Name</th>
								<th className="sticky-col sticky-col-3 text-right">
									Beginning Balance
								</th>
								<th className="text-right">Principal Paid</th>
								<th className="text-right">Interest Paid</th>
								<th className="text-right">Annual Cost</th>
								<th className="text-right">Ending Balance</th>
								<th className="text-right">Total Interest</th>
								<th className="text-right">Invested Diff. This Year</th>
								<th className="text-right">Total Principal</th>
								<th className="text-right">Investment Profit (Year)</th>
								<th className="text-right">Total Investment Value</th>
								<th className="text-right">Total Net Worth</th>
								<th className="text-right">Change ($)</th>
								<th className="text-right">Performance (%)</th>
							</tr>
						</thead>
						<tbody>
							{/* Correctly map years and scenarios for table body */}
							{Array.from({ length: maxYears }, (_, i) => i + 1).map((year) => (
								<React.Fragment key={`year-${year}`}>
									{scenariosWithInvestment.map(
										(scenario: Scenario, scenarioIndex: number) => {
											const dataForYear = scenario.yearlyData?.find(
												(d: YearlyPaymentData) => d.year === year
											)
											const isActiveMortgageYear = scenario.term >= year
											const isLastScenarioOfYear =
												scenarioIndex === scenariosWithInvestment.length - 1
											const rowKey = `${scenario.name}-${year}-${scenarioIndex}`
											const missingRowKey = `${scenario.name}-${year}-missing-${scenarioIndex}`

											return dataForYear ? (
												<tr
													key={rowKey}
													// Apply alternating row class
													className={`${
														scenarioIndex % 2 === 0
															? 'scenario-even'
															: 'scenario-odd'
													} ${isLastScenarioOfYear ? 'year-separator' : ''}`}
													style={!isActiveMortgageYear ? { color: '#999' } : {}}
												>
													{/* Apply sticky and alignment classes to cells */}
													{scenarioIndex === 0 ? (
														<td
															rowSpan={scenariosWithInvestment.length}
															className="sticky-col sticky-col-1 text-center"
														>
															{year}
														</td>
													) : null}
													<td className="sticky-col sticky-col-2 text-left">
														{scenario.name}{' '}
														{!isActiveMortgageYear ? '(Ended)' : ''}
													</td>
													<td className="sticky-col sticky-col-3 text-right">
														{isActiveMortgageYear
															? formatCurrency(dataForYear.beginningBalance)
															: '-'}
													</td>
													{/* Remaining cells default to text-right from CSS */}
													<td className="text-right"> {/* Add className here */}
														{isActiveMortgageYear
															? formatCurrency(dataForYear.principalPaidYearly)
															: '-'}
													</td>
													<td className="text-right"> {/* Add className here */}
														{isActiveMortgageYear
															? formatCurrency(dataForYear.interestPaidYearly)
															: '-'}
													</td>
													<td className="text-right"> {/* Add className here */}
														{isActiveMortgageYear
															? formatCurrency(dataForYear.annualCost)
															: '-'}
													</td>
													<td className="text-right"> {/* Add className here */}
														{isActiveMortgageYear
															? formatCurrency(dataForYear.endingBalance)
															: '-'}
													</td>
													<td className="text-right"> {/* Add className here */}
														{formatCurrency(dataForYear.totalInterestPaid)}
													</td>
													<td className="text-right"> {/* Add className here */}
														{isActiveMortgageYear &&
														dataForYear.investmentDifference !== 0
															? formatCurrency(dataForYear.investmentDifference)
															: '-'}
													</td>
													<td className="text-right"> {/* Add className here */}
														{formatCurrency(dataForYear.totalPrincipalPaid)}
													</td>
													<td className="text-right"> {/* Add className here */}
														{formatCurrency(dataForYear.investmentProfitYearly)}
													</td>
													<td className="text-right"> {/* Add className here */}
														{formatCurrency(
															dataForYear.cumulativeInvestmentValue
														)}
													</td>
													<td className="text-right">{formatCurrency(dataForYear.totalNetWorth)}</td> {/* Add className here */}
													<td className="text-right"> {/* Add className here */}
														{formatCurrency(dataForYear.netWorthDifference)}
													</td>
													<td className="text-right"> {/* Add className here */}
														{/* Display '-' if performance is exactly 0, otherwise format */}
														{dataForYear.performancePercentage === 0
															? '-'
															: `${dataForYear.performancePercentage?.toFixed(
																	2
															  )}%`}
													</td>
												</tr>
											) : (
												<tr
													key={missingRowKey}
													className={
														isLastScenarioOfYear ? 'year-separator' : ''
													}
												>
													{/* Apply sticky and alignment classes to missing data row cells */}
													{scenarioIndex === 0 ? (
														<td
															rowSpan={scenariosWithInvestment.length}
															className="sticky-col sticky-col-1 text-center"
														>
															{year}
														</td>
													) : null}
													<td className="sticky-col sticky-col-2 text-left">
														{scenario.name} (Data Missing/Error)
													</td>
													{/* Make sure colSpan accounts for the sticky columns */}
													<td colSpan={13} className="text-left">
														Data missing or error for this year
													</td>
												</tr>
											)
										}
									)}
								</React.Fragment>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	)
}

export default App
