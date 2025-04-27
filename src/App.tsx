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
import jsyaml from 'js-yaml' // Import js-yaml

// Import extracted components
import ScenarioTableRow from './ScenarioTableRow'
import ScenarioSummaryCard from './ScenarioSummaryCard'
import AddScenarioForm from './AddScenarioForm'

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

// Export types so they can be imported by other components
export interface Scenario {
	name: string
	downPayment: number // No longer optional
	downPaymentInput: number // No longer optional
	downPaymentType: 'amount' | 'percent' // No longer optional
	interestRate: number // No longer optional
	term: number // No longer optional
	monthlyPayment: number // No longer optional
	yearlyData: YearlyPaymentData[] // No longer optional
}

export interface YearlyPaymentData {
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

// Helper function to calculate actual down payment
const getActualDownPayment = (
	homePrice: number,
	downPaymentInput: number,
	downPaymentType: 'amount' | 'percent'
): number => {
	return downPaymentType === 'amount'
		? downPaymentInput
		: homePrice * (downPaymentInput / 100)
}

// Update return type
function calculateMortgageAmortization(
	principal: number,
	annualRate: number,
	termYears: number
): { yearlyData: YearlyPaymentData[]; monthlyPayment: number } | null {
	// Basic validation
	if (principal < 0 || annualRate < 0 || termYears <= 0) {
		return null // Invalid input for negative values or zero term
	}

	// Handle 0 principal (e.g., 100% down payment)
	if (principal === 0) {
		if (annualRate !== 0) {
			// Cannot have interest on a zero principal loan
			console.warn('Interest rate ignored for zero principal loan.')
			annualRate = 0
		}
		// Loan is immediately paid off
		const yearlyDataForZeroPrincipal: YearlyPaymentData[] = [
			{
				year: 1,
				beginningBalance: 0,
				interestPaidYearly: 0,
				principalPaidYearly: 0,
				endingBalance: 0,
				totalPrincipalPaid: 0,
				totalInterestPaid: 0,
				annualCost: 0,
			},
		]
		return { yearlyData: yearlyDataForZeroPrincipal, monthlyPayment: 0 }
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
		console.error('Monthly payment calculation resulted in non-finite number.')
		return null // Calculation resulted in Infinity or NaN
	}

	let balance = principal
	const yearlyData: YearlyPaymentData[] = []
	let totalPrincipalPaid = 0
	let totalInterestPaid = 0

	for (let year = 1; year <= termYears; year++) {
		const beginningBalanceYear = balance
		let interestPaidYearly = 0
		let principalPaidYearly = 0

		for (let month = 1; month <= 12; month++) {
			const currentMonth = (year - 1) * 12 + month
			// Use a small threshold for floating point comparison
			if (currentMonth > numberOfPayments || balance <= 0.005) break

			let interestForMonth: number
			let principalForMonth: number

			if (monthlyRate === 0) {
				interestForMonth = 0
				// Ensure principal payment doesn't exceed remaining balance or monthly payment
				principalForMonth = Math.min(balance, monthlyPayment)
			} else {
				interestForMonth = balance * monthlyRate
				principalForMonth = monthlyPayment - interestForMonth
			}

			// Ensure principal payment doesn't exceed remaining balance
			if (principalForMonth > balance) {
				// Adjust payment if it overshoots the balance
				principalForMonth = balance
				interestForMonth = monthlyRate === 0 ? 0 : balance * monthlyRate // Recalculate interest based on actual principal paid
				if (interestForMonth < 0) interestForMonth = 0 // Avoid negative interest
			}

			interestPaidYearly += interestForMonth
			principalPaidYearly += principalForMonth
			balance -= principalForMonth

			// Ensure balance doesn't go significantly below zero
			if (balance < 0.005) {
				balance = 0
			}
		}

		totalPrincipalPaid += principalPaidYearly
		totalInterestPaid += interestPaidYearly

		const annualCost = principalPaidYearly + interestPaidYearly

		yearlyData.push({
			year: year,
			beginningBalance: beginningBalanceYear,
			interestPaidYearly: interestPaidYearly,
			principalPaidYearly: principalPaidYearly,
			endingBalance: balance,
			totalPrincipalPaid: totalPrincipalPaid,
			totalInterestPaid: totalInterestPaid,
			annualCost: annualCost,
		})

		if (balance <= 0) break // Stop if loan is fully paid
	}

	return { yearlyData, monthlyPayment }
}

// Helper function to validate scenario inputs
const validateScenarioInputs = (
	homePrice: number,
	downPaymentInput: number,
	downPaymentType: 'amount' | 'percent',
	interestRate: number,
	term: number,
	existingScenarioNames: string[],
	newName?: string
): {
	isValid: boolean
	message: string
	actualDownPayment?: number
	principal?: number
	scenarioName?: string
} => {
	const scenarioName =
		newName?.trim() || `Scenario ${existingScenarioNames.length + 1}`
	if (newName && existingScenarioNames.includes(scenarioName)) {
		return {
			isValid: false,
			message: `Scenario name "${scenarioName}" already exists. Please choose a unique name.`,
		}
	}

	const actualDownPayment = getActualDownPayment(
		homePrice,
		downPaymentInput,
		downPaymentType
	)

	if (
		downPaymentType === 'percent' &&
		(downPaymentInput < 0 || downPaymentInput > 100)
	) {
		return {
			isValid: false,
			message: 'Down payment percentage must be between 0 and 100.',
		}
	}
	if (actualDownPayment < 0) {
		return { isValid: false, message: 'Down payment cannot be negative.' }
	}
	if (actualDownPayment > homePrice) {
		return {
			isValid: false,
			message: 'Down payment cannot be greater than the home price.',
		}
	}

	const principal = homePrice - actualDownPayment
	if (principal === 0 && interestRate !== 0) {
		return {
			isValid: false,
			message:
				'If down payment covers the full home price (0 principal), the interest rate must be 0.',
		}
	}
	if (interestRate < 0) {
		return { isValid: false, message: 'Interest rate cannot be negative.' }
	}
	if (term <= 0) {
		return { isValid: false, message: 'Term must be positive.' }
	}

	return {
		isValid: true,
		message: '',
		actualDownPayment,
		principal,
		scenarioName,
	}
}

// Helper function to create initial scenarios from config
const createInitialScenariosFromConfig = (
	homePrice: number,
	initialScenarioConfigs: ConfigData['initialScenarios']
): Scenario[] => {
	const initialScenarios: Scenario[] = []

	initialScenarioConfigs.forEach((config) => {
		// Validate inputs *without* checking for name uniqueness against the initial list
		const validation = validateScenarioInputs(
			homePrice,
			config.downPaymentInput,
			config.downPaymentType,
			config.interestRate,
			config.term,
			[], // Pass an empty array to bypass uniqueness check for initial load
			config.name // Still pass name to get it back if needed, but uniqueness won't be checked against itself
		)

		if (
			!validation.isValid ||
			validation.principal === undefined ||
			validation.actualDownPayment === undefined
		) {
			console.error(
				`Invalid configuration for scenario ${config.name}: ${validation.message}. Skipping.`
			)
			return // Skip this scenario
		}

		const calculationResult = calculateMortgageAmortization(
			validation.principal,
			config.interestRate,
			config.term
		)

		if (calculationResult) {
			initialScenarios.push({
				name: config.name, // Use original config name
				downPayment: validation.actualDownPayment,
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

// Helper function to calculate yearly updates for a single scenario
const calculateYearlyScenarioUpdate = (
	scenario: Scenario,
	year: number,
	maxAnnualCost: number,
	previousCumulativeValue: number,
	initialInvestmentValue: number,
	investmentRate: number
): Partial<YearlyPaymentData> => {
	const dataForYear = scenario.yearlyData?.find((d) => d.year === year)
	const dataForPreviousYear = scenario.yearlyData?.find(
		(d) => d.year === year - 1
	)
	const yearlyProfit = previousCumulativeValue * investmentRate

	let investmentAmount = 0
	let currentCumulativeValue = 0
	let totalNetWorth = 0
	let totalPrincipalPaid = dataForPreviousYear?.totalPrincipalPaid ?? 0 // Carry over if ended
	let totalInterestPaid = dataForPreviousYear?.totalInterestPaid ?? 0 // Carry over if ended

	if (dataForYear && scenario.term >= year) {
		// Active mortgage year
		investmentAmount =
			maxAnnualCost > 0 ? maxAnnualCost - dataForYear.annualCost : 0
		currentCumulativeValue =
			previousCumulativeValue * (1 + investmentRate) + investmentAmount
		totalPrincipalPaid = dataForYear.totalPrincipalPaid
		totalInterestPaid = dataForYear.totalInterestPaid
		totalNetWorth =
			scenario.downPayment + totalPrincipalPaid + currentCumulativeValue
	} else {
		// Scenario ended or data missing for the year (treat as ended)
		investmentAmount = 0 // No mortgage cost difference to invest
		currentCumulativeValue = previousCumulativeValue * (1 + investmentRate)
		// Use the last known principal paid if the scenario ended previously
		const lastData = scenario.yearlyData?.[scenario.yearlyData.length - 1]
		totalPrincipalPaid = lastData?.totalPrincipalPaid ?? totalPrincipalPaid // Use last known if available
		totalInterestPaid = lastData?.totalInterestPaid ?? totalInterestPaid // Use last known if available
		totalNetWorth =
			scenario.downPayment + totalPrincipalPaid + currentCumulativeValue
	}

	// Calculate Year-over-Year Change ($)
	let prevNetWorth: number
	if (year === 1) {
		prevNetWorth = scenario.downPayment + initialInvestmentValue
	} else {
		prevNetWorth = dataForPreviousYear?.totalNetWorth ?? 0
	}
	const netWorthDifference = totalNetWorth - prevNetWorth

	return {
		investmentDifference: investmentAmount,
		cumulativeInvestmentValue: currentCumulativeValue,
		investmentProfitYearly: yearlyProfit,
		totalNetWorth: totalNetWorth,
		netWorthDifference: isFinite(netWorthDifference) ? netWorthDifference : 0,
		// Ensure these are carried over correctly for placeholder data
		totalPrincipalPaid: totalPrincipalPaid,
		totalInterestPaid: totalInterestPaid,
	}
}

// Helper function to ensure yearly data exists up to maxYears
const ensureYearlyDataExists = (
	scenario: Scenario,
	year: number,
	calculatedUpdate: Partial<YearlyPaymentData>
) => {
	let dataForYear = scenario.yearlyData?.find((d) => d.year === year)
	if (!dataForYear) {
		if (!scenario.yearlyData) scenario.yearlyData = []
		// Create placeholder if it doesn't exist (scenario ended)
		dataForYear = {
			year: year,
			beginningBalance: 0,
			interestPaidYearly: 0,
			principalPaidYearly: 0,
			endingBalance: 0,
			annualCost: 0,
			// Populate from calculated update or defaults
			totalPrincipalPaid: calculatedUpdate.totalPrincipalPaid ?? 0,
			totalInterestPaid: calculatedUpdate.totalInterestPaid ?? 0,
			investmentDifference: calculatedUpdate.investmentDifference ?? 0,
			cumulativeInvestmentValue:
				calculatedUpdate.cumulativeInvestmentValue ?? 0,
			investmentProfitYearly: calculatedUpdate.investmentProfitYearly ?? 0,
			totalNetWorth: calculatedUpdate.totalNetWorth ?? 0,
			netWorthDifference: calculatedUpdate.netWorthDifference ?? 0,
		}
		scenario.yearlyData.push(dataForYear)
	} else {
		// Update existing data entry
		Object.assign(dataForYear, calculatedUpdate)
	}
	return dataForYear
}

// Helper function to calculate performance percentage for a given year
const calculatePerformancePercentage = (
	processedScenarios: Scenario[],
	year: number,
	maxNetWorthThisYear: number
) => {
	if (!isFinite(maxNetWorthThisYear) || maxNetWorthThisYear === -Infinity) {
		processedScenarios.forEach((scenario) => {
			const dataForYear = scenario.yearlyData?.find((d) => d.year === year)
			if (dataForYear) dataForYear.performancePercentage = 0
		})
		return
	}

	processedScenarios.forEach((scenario) => {
		const dataForYear = scenario.yearlyData?.find((d) => d.year === year)
		if (dataForYear && dataForYear.totalNetWorth !== undefined) {
			const denominator = Math.abs(maxNetWorthThisYear)
			const performance =
				denominator === 0
					? dataForYear.totalNetWorth === 0
						? 0
						: Infinity // Or handle as appropriate if max is 0 but current isn't
					: ((dataForYear.totalNetWorth - maxNetWorthThisYear) / denominator) *
					  100
			dataForYear.performancePercentage = isFinite(performance)
				? performance
				: performance > 0
				? 100 // Cap positive infinity
				: -100 // Cap negative infinity
		} else if (dataForYear) {
			dataForYear.performancePercentage = 0 // Default if net worth is missing
		}
	})
}

function App() {
	// State to hold the loaded config data
	const [configData, setConfigData] = useState<ConfigData | null>(null)
	const [loadingConfig, setLoadingConfig] = useState(true)
	const [configError, setConfigError] = useState<string | null>(null)

	// Fetch and parse the YAML config file on component mount
	useEffect(() => {
		fetch('/config.yaml') // Fetch from the public root
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
			// Only run if configData is not null
			setHomePrice(configData.homePrice)
			setInitialInvestments(configData.initialInvestments)
			const initialScenarios = createInitialScenariosFromConfig(
				configData.homePrice,
				configData.initialScenarios
			)
			setScenarios(initialScenarios)
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
		const validation = validateScenarioInputs(
			homePrice,
			newDownPaymentValue,
			newDownPaymentType,
			newInterestRate,
			newTerm,
			scenarios.map((s) => s.name), // Pass current scenario names
			newScenarioName // Pass the potential new name
		)

		if (
			!validation.isValid ||
			validation.principal === undefined ||
			validation.actualDownPayment === undefined ||
			validation.scenarioName === undefined
		) {
			alert(validation.message)
			return
		}

		const calculationResult = calculateMortgageAmortization(
			validation.principal,
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
			name: validation.scenarioName, // Use validated/generated name
			downPayment: validation.actualDownPayment,
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

	// Removed formatPercentage function

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

	// Calculate investment growth data using useMemo (Refactored Logic)
	const scenariosWithInvestment = useMemo(() => {
		if (!configData || scenarios.length < 1) return []

		const processedScenarios = JSON.parse(
			JSON.stringify(scenarios)
		) as Scenario[]

		const initialInvestmentValues: { [scenarioName: string]: number } = {}
		processedScenarios.forEach((scenario) => {
			initialInvestmentValues[scenario.name] = Math.max(
				0,
				initialInvestments - scenario.downPayment
			)
		})

		const currentCumulativeValues = { ...initialInvestmentValues }
		const calculationMaxYears = maxYears

		for (let year = 1; year <= calculationMaxYears; year++) {
			// --- Step 1: Find Max Annual Cost for the current year ---
			let maxAnnualCost = 0
			processedScenarios.forEach((scenario) => {
				const dataForYear = scenario.yearlyData?.find((d) => d.year === year)
				if (dataForYear && scenario.term >= year) {
					maxAnnualCost = Math.max(maxAnnualCost, dataForYear.annualCost)
				}
			})

			let maxNetWorthThisYear = -Infinity

			// --- Step 2: Calculate Investment, Net Worth for each scenario ---
			processedScenarios.forEach((scenario) => {
				const previousCumulativeValue =
					currentCumulativeValues[scenario.name] || 0
				const initialInvestment = initialInvestmentValues[scenario.name] || 0

				const calculatedUpdate = calculateYearlyScenarioUpdate(
					scenario,
					year,
					maxAnnualCost,
					previousCumulativeValue,
					initialInvestment,
					INVESTMENT_RATE
				)

				// Ensure data exists and update it
				const updatedDataForYear = ensureYearlyDataExists(
					scenario,
					year,
					calculatedUpdate
				)

				// Update cumulative value for the next iteration
				if (updatedDataForYear.cumulativeInvestmentValue !== undefined) {
					currentCumulativeValues[scenario.name] =
						updatedDataForYear.cumulativeInvestmentValue
				}

				// Track max net worth for performance calculation
				if (updatedDataForYear.totalNetWorth !== undefined) {
					maxNetWorthThisYear = Math.max(
						maxNetWorthThisYear,
						updatedDataForYear.totalNetWorth
					)
				}
			})

			// --- Step 3: Calculate Performance Percentage ---
			calculatePerformancePercentage(
				processedScenarios,
				year,
				maxNetWorthThisYear
			)
		}

		return processedScenarios
	}, [scenarios, initialInvestments, configData, maxYears, INVESTMENT_RATE]) // Added INVESTMENT_RATE

	// Define an interface for the chart data points
	interface ChartDataPoint {
		year: string // e.g., "Year 1"
		// Keys will be dynamically generated like: "ScenarioName_MetricName"
		[key: string]: number | string | null // Allow dynamic keys holding numbers or null
	}

	// Define metrics to display on the chart
	const CHART_METRICS: {
		key: keyof YearlyPaymentData
		name: string
		style: 'solid' | 'dashed' | 'dotted' | 'dash-dot' | 'short-dash'
	}[] = [
		{ key: 'totalNetWorth', name: 'Net Worth', style: 'solid' },
		{ key: 'totalPrincipalPaid', name: 'Principal Paid', style: 'dashed' },
		{ key: 'totalInterestPaid', name: 'Interest Paid', style: 'dotted' },
		{
			key: 'cumulativeInvestmentValue',
			name: 'Investment Value',
			style: 'dash-dot',
		},
		{ key: 'endingBalance', name: 'Ending Balance', style: 'short-dash' },
	]

	// Helper function to get dash style for chart lines
	const getStrokeDashArray = (
		style: 'solid' | 'dashed' | 'dotted' | 'dash-dot' | 'short-dash'
	): string | undefined => {
		switch (style) {
			case 'solid':
				return undefined
			case 'dashed':
				return '5 5'
			case 'dotted':
				return '1 3'
			case 'dash-dot':
				return '10 5 2 5'
			case 'short-dash':
				return '3 3'
			default:
				return undefined
		}
	}

	// Helper function to prepare data for the chart
	const prepareChartData = (
		scenarios: Scenario[],
		maxYears: number
	): ChartDataPoint[] => {
		if (scenarios.length === 0) return []

		const data: ChartDataPoint[] = []

		for (let year = 1; year <= maxYears; year++) {
			const yearData: ChartDataPoint = { year: `Year ${year}` }

			scenarios.forEach((scenario) => {
				const dataForYear = scenario.yearlyData?.find((d) => d.year === year)
				CHART_METRICS.forEach((metric) => {
					yearData[`${scenario.name}_${metric.key}`] =
						dataForYear?.[metric.key] ?? null
				})
			})
			data.push(yearData)
		}
		return data
	}

	// --- Prepare data for the chart ---
	const chartData = useMemo(() => {
		return prepareChartData(scenariosWithInvestment, maxYears)
	}, [scenariosWithInvestment, maxYears]) // Simplified dependencies

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
			<AddScenarioForm
				homePrice={homePrice}
				scenariosCount={scenarios.length}
				newScenarioName={newScenarioName}
				setNewScenarioName={setNewScenarioName}
				newDownPaymentType={newDownPaymentType}
				setNewDownPaymentType={setNewDownPaymentType} // Pass setter for handler
				newDownPaymentValue={newDownPaymentValue}
				setNewDownPaymentValue={setNewDownPaymentValue}
				newInterestRate={newInterestRate}
				setNewInterestRate={setNewInterestRate}
				newTerm={newTerm}
				setNewTerm={setNewTerm}
				onAddScenario={addScenario}
				formatCurrency={formatCurrency}
				handleDownPaymentTypeChange={handleDownPaymentTypeChange}
			/>
			<hr />
			{/* --- Scenario Summaries --- (Simplified) */}
			<h2>Current Scenarios</h2>
			{scenarios.length === 0 ? (
				<p>No scenarios added yet.</p>
			) : (
				<div className="scenario-summaries">
					{scenarios.map((scenario, index) => (
						<ScenarioSummaryCard
							key={`${scenario.name}-${index}`}
							scenario={scenario}
							index={index}
							onRemove={removeScenario}
							formatCurrency={formatCurrency}
						/>
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
									const displayName = props.name // Use the name prop from <Line> ("Scenario A - Net Worth")

									// Format the value as currency
									let formattedValue: string
									if (Array.isArray(value)) {
										// Handle potential arrays (less likely for Line chart values)
										formattedValue = value
											.map((v) =>
												typeof v === 'number' ? formatCurrency(v) : String(v)
											)
											.join(', ')
									} else if (typeof value === 'number') {
										formattedValue = formatCurrency(value)
									} else {
										// Handle string or null
										formattedValue = value !== null ? String(value) : 'N/A'
									}

									// Return the formatted value and the display name from the Line's name prop
									return [formattedValue, displayName]
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
								// Map over defined metrics for each scenario
								CHART_METRICS.map((metric) => (
									<Line
										key={`${scenario.name}_${metric.key}`}
										type="monotone"
										dataKey={`${scenario.name}_${metric.key}`}
										name={`${scenario.name} - ${metric.name}`}
										stroke={chartColors[scenario.name]}
										strokeDasharray={getStrokeDashArray(metric.style)}
										activeDot={{ r: 6 }}
										connectNulls
										// dot={false} // Keep commented for now
									/>
								))
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
											const isFirstScenarioOfYear = scenarioIndex === 0
											const isLastScenarioOfYear =
												scenarioIndex === scenariosWithInvestment.length - 1

											return (
												<ScenarioTableRow
													key={`${scenario.name}-${year}-${scenarioIndex}`}
													year={year}
													scenario={scenario}
													dataForYear={dataForYear}
													isFirstScenarioOfYear={isFirstScenarioOfYear}
													isLastScenarioOfYear={isLastScenarioOfYear}
													isActiveMortgageYear={isActiveMortgageYear}
													rowIndex={scenarioIndex}
													totalScenariosInYear={scenariosWithInvestment.length}
													formatCurrency={formatCurrency}
												/>
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
