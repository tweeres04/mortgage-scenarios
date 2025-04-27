import React from 'react'

interface AddScenarioFormProps {
	homePrice: number
	scenariosCount: number
	newScenarioName: string
	setNewScenarioName: (name: string) => void
	newDownPaymentType: 'amount' | 'percent'
	setNewDownPaymentType: (type: 'amount' | 'percent') => void
	newDownPaymentValue: number
	setNewDownPaymentValue: (value: number) => void
	newInterestRate: number
	setNewInterestRate: (rate: number) => void
	newTerm: number
	setNewTerm: (term: number) => void
	onAddScenario: () => void
	formatCurrency: (amount: number | undefined) => string
	handleDownPaymentTypeChange: (
		event: React.ChangeEvent<HTMLInputElement>
	) => void
}

const AddScenarioForm: React.FC<AddScenarioFormProps> = ({
	homePrice,
	scenariosCount,
	newScenarioName,
	setNewScenarioName,
	newDownPaymentType,
	// setNewDownPaymentType, // Handled by handleDownPaymentTypeChange
	newDownPaymentValue,
	setNewDownPaymentValue,
	newInterestRate,
	setNewInterestRate,
	newTerm,
	setNewTerm,
	onAddScenario,
	formatCurrency,
	handleDownPaymentTypeChange,
}) => {
	return (
		<>
			<h2>Add New Scenario</h2>
			<div className="add-scenario-form">
				<div>
					<label>
						Scenario Name (Optional):
						<input
							type="text"
							value={newScenarioName}
							onChange={(e) => setNewScenarioName(e.target.value)}
							placeholder={`e.g., Scenario ${scenariosCount + 1}`}
							style={{ width: '200px', marginLeft: '5px' }}
						/>
					</label>
				</div>

				<div>
					<label style={{ marginRight: '10px' }}>Down Payment Type:</label>
					<label style={{ marginRight: '10px', display: 'inline-block' }}>
						<input
							type="radio"
							value="amount"
							checked={newDownPaymentType === 'amount'}
							onChange={handleDownPaymentTypeChange}
							style={{ marginRight: '5px' }}
						/>
						Amount ($)
					</label>
					<label style={{ display: 'inline-block' }}>
						<input
							type="radio"
							value="percent"
							checked={newDownPaymentType === 'percent'}
							onChange={handleDownPaymentTypeChange}
							style={{ marginRight: '5px' }}
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
			</div>
			<button onClick={onAddScenario}>Add Scenario</button>
		</>
	)
}

export default AddScenarioForm
