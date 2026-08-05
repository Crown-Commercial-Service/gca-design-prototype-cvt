const govukPrototypeKit = require('govuk-prototype-kit')
const router = govukPrototypeKit.requests.setupRouter()
const contracts = require('../../data/contracts.json')

const getSessionData = (req) => {
	if (!req.session.data) {
		req.session.data = {}
	}

	return req.session.data
}

const findContractByOcid = (ocid) => contracts.find((item) => item.ocid === ocid)

const getContractsByStatus = (status) => contracts.filter((item) => item.status === status)

const toNumber = (value) => {
	if (typeof value === 'number') {
		return Number.isFinite(value) ? value : 0
	}

	if (typeof value === 'string') {
		const trimmed = value.trim()

		if (trimmed.toLowerCase() === 'not provided') {
			return 0
		}

		const parsed = Number(trimmed.replace(/[£,\s]/g, ''))
		return Number.isFinite(parsed) ? parsed : 0
	}

	return 0
}

const getPercentage = (amount, total) => {
	if (!total) {
		return 0
	}

	return (amount / total) * 100
}

const formatPercentage = (value) => `${value.toFixed(1)}%`

const setActiveContractOcid = (req, ocid) => {
	if (!findContractByOcid(ocid)) {
		return false
	}

	const sessionData = getSessionData(req)
	sessionData.activeContractOcid = ocid
	return true
}

const getActiveContractOcid = (req) => getSessionData(req).activeContractOcid

const upsertContractData = (ocid, updates) => {
	if (!ocid || !updates || Object.keys(updates).length === 0) {
		return
	}

	const contract = findContractByOcid(ocid)

	if (contract) {
		Object.assign(contract, updates)
	}
}

const getBulkUploadReviewItems = () => {
	const inProgressContracts = getContractsByStatus('In progress').slice(0, 3)

	return inProgressContracts.map((contract, index) => {
		const baselineValue = Number(contract.value) + 15000 + (index * 2500)
		const cashableSavings = Math.max(Math.round(Number(contract.value) * 0.08), 3000)

		return {
			ocid: contract.ocid,
			title: contract.title,
			cashableSavings: String(cashableSavings),
			baselineApproach: contract.baselineApproach || 'Budget',
			baselineValue: String(baselineValue),
			cashableSavingType: contract.cashableSavingType || 'Negotiated discount'
		}
	})
}

const persistJourneyDataToContract = (req) => {
	const sessionData = getSessionData(req)
	const ocid = getActiveContractOcid(req)

	if (!ocid) {
		return null
	}

	const updates = {}

	if (sessionData['cashable-savings'] === 'yes') {
		updates.status = 'Completed'
	}

	if (sessionData['savings-type'] && sessionData['savings-type'] !== 'choose') {
		updates.cashableSavingType = sessionData['savings-type']
	}

	if (sessionData.costPerItem) {
		updates.baselineValue = sessionData.costPerItem
	}

	if (sessionData['savings-value']) {
		updates.nonCashableSavings = sessionData['savings-value']
	}

	upsertContractData(ocid, updates)

	return updates
}

// Unique: loads contract data for the list
router.get('/v2/contracts', (req, res) => {
	res.render('v2/contracts', { contracts })
})

// Unique: loads contract data for the list
router.get('/v2/contracts-completed', (req, res) => {
	res.render('v2/contracts-completed', { contracts: getContractsByStatus('Completed') })
})

// Unique: loads contract data for the list
router.get('/v2/contracts-in-progress', (req, res) => {
	res.render('v2/contracts-in-progress', { contracts: getContractsByStatus('In progress') })
})

// Unique: looks up a specific contract by ocid
router.get('/v2/calculation/:ocid', (req, res) => {
	const { ocid } = req.params
	setActiveContractOcid(req, ocid)
	const contract = findContractByOcid(ocid)

	if (!contract) {
		return res.status(404).render('v2/calculation', { contract: null, ocid })
	}

	const contractValue = toNumber(contract.contractValueDisplay || contract.value)
	const cashableSavings = toNumber(contract.cashableSavings)
	const nonCashableSavings = toNumber(contract.nonCashableSavings)
	const totalSavings = cashableSavings + nonCashableSavings
	const peerAverageSavingsPercentageValue = 10

	const cashablePercentageOfContract = getPercentage(cashableSavings, contractValue)
	const nonCashablePercentageOfContract = getPercentage(nonCashableSavings, contractValue)
	const totalSavingsPercentageOfContract = getPercentage(totalSavings, contractValue)
	const savingsPercentageDifferenceValue = cashablePercentageOfContract - peerAverageSavingsPercentageValue
	const peerAverageSavingsValue = Math.round(contractValue * (peerAverageSavingsPercentageValue / 100))
	const savingsDifferenceValue = Math.round(contractValue * (savingsPercentageDifferenceValue / 100))

	const cashableShareOfTotal = getPercentage(cashableSavings, totalSavings)
	const nonCashableShareOfTotal = getPercentage(nonCashableSavings, totalSavings)

	const calculationMetrics = {
		contractValue,
		cashableSavings,
		nonCashableSavings,
		totalSavings,
		peerAverageSavingsPercentageValue,
		peerAverageSavingsPercentageWidthValue: peerAverageSavingsPercentageValue.toFixed(1),
		peerAverageSavingsPercentage: formatPercentage(peerAverageSavingsPercentageValue),
		cashablePercentageOfContract: formatPercentage(cashablePercentageOfContract),
		cashablePercentageOfContractValue: cashablePercentageOfContract,
		cashablePercentageOfContractWidthValue: cashablePercentageOfContract.toFixed(1),
		nonCashablePercentageOfContract: formatPercentage(nonCashablePercentageOfContract),
		totalSavingsPercentageOfContract: formatPercentage(totalSavingsPercentageOfContract),
		totalSavingsPercentageOfContractValue: totalSavingsPercentageOfContract,
		savingsPercentageDifferenceValue,
		savingsPercentageDifference: formatPercentage(savingsPercentageDifferenceValue),
		peerAverageSavingsValue,
		savingsDifferenceValue,
		cashableShareOfTotal: formatPercentage(cashableShareOfTotal),
		nonCashableShareOfTotal: formatPercentage(nonCashableShareOfTotal),
		cashableShareOfTotalWidth: cashableShareOfTotal.toFixed(1),
		nonCashableShareOfTotalWidth: nonCashableShareOfTotal.toFixed(1)
	}

	return res.render('v2/calculation', { contract, calculationMetrics })
})

router.get('/v2/calculation', (req, res) => {
	const ocid = getActiveContractOcid(req)

	if (!ocid) {
		return res.redirect('/v2/contracts')
	}

	return res.redirect(`/v2/calculation/${ocid}`)
})

// Unique: loads contract for cashable savings page (In progress contracts)
router.get('/v2/cashable-savings/:ocid', (req, res) => {
	const { ocid } = req.params
	setActiveContractOcid(req, ocid)
	const contract = findContractByOcid(ocid)

	if (!contract) {
		return res.status(404).render('v2/cashable-savings', { contract: null, ocid })
	}

	return res.render('v2/cashable-savings', { contract, ocid })
})

router.get('/v2/cashable-savings', (req, res) => {
	const ocid = getActiveContractOcid(req)
	const contract = ocid ? findContractByOcid(ocid) : null

	if (!ocid || !contract) {
		return res.redirect('/v2/contracts-in-progress')
	}

	return res.render('v2/cashable-savings', { contract, ocid })
})

// Backwards compatibility for older links
router.get('/v2/cashable-savings-category/:ocid', (req, res) => {
	return res.redirect(`/v2/cashable-savings/${req.params.ocid}`)
})

router.get('/v2/procurement-savings-summary', (req, res) => {
	const ocid = getActiveContractOcid(req)
	const contract = ocid ? findContractByOcid(ocid) : null

	if (!ocid || !contract) {
		return res.redirect('/v2/contracts-in-progress')
	}

	return res.render('v2/procurement-savings-summary', { contract, ocid })
})

router.post('/v2/procurement-savings-summary', (req, res) => {
	const ocid = getActiveContractOcid(req)
	const contract = ocid ? findContractByOcid(ocid) : null
	const addStrategicValue = getSessionData(req).addStrategicValue

	console.log("ocid: ", ocid)
	console.log("contract: ", contract)

	if (addStrategicValue === 'yes') {
		return res.redirect(`/v2/add-a-benefit`)
	}

	if (!ocid || !contract) {
		return res.redirect('/v2/contracts')
	}

	return res.redirect(`/v2/declaration`)
})

router.get('/v2/strategic-value-summary', (req, res) => {
	const ocid = getActiveContractOcid(req)
	const contract = ocid ? findContractByOcid(ocid) : null

	if (!ocid || !contract) {
		return res.redirect('/v2/contracts-in-progress')
	}

	return res.render('v2/strategic-value-summary', { contract, ocid })
})

router.get('/v2/dashboard', (req, res) => {
	const completedCount = getContractsByStatus('Completed').length
	const inProgressCount = getContractsByStatus('In progress').length

	return res.render('v2/dashboard', { completedCount, inProgressCount })
})

// Form submissions — redirect to next page
router.post('/v2/start', (req, res) => {
	res.redirect('/v2/sign-in')
})

router.post('/v2/sign-in', (req, res) => {
	res.redirect('/v2/contracts')
})

router.post('/v2/contracts', (req, res) => {
	res.redirect('/v2/contracts')
})

router.post('/v2/cashable-savings/', (req, res) => {
	if (!getActiveContractOcid(req) && req.body && req.body.ocid) {
		setActiveContractOcid(req, req.body.ocid)
	}

	if (!getActiveContractOcid(req)) {
		return res.redirect('/v2/contracts-in-progress')
	}

	const cashableSavings = req.session.data['cashable-savings']
	if (cashableSavings === 'yes') {
		return res.redirect(`/v2/cashable-savings-type`)
	}
	return res.redirect(`/v2/add-a-benefit`)
})

router.post('/v2/cashable-savings-type', (req, res) => {
	res.redirect(`/v2/baseline-approach`)
})

router.post('/v2/baseline-approach', (req, res) => {
	persistJourneyDataToContract(req)
	//res.redirect(`/v2/baseline-value`)
	res.redirect(`/v2/procurement-savings-summary`)
})

router.post('/v2/baseline-value', (req, res) => {
	persistJourneyDataToContract(req)
	res.redirect(`/v2/procurement-savings-summary`)
})

router.post('/v2/cashable-savings-category/:ocid', (req, res) => {
	setActiveContractOcid(req, req.params.ocid)
	const cashableSavings = getSessionData(req)['cashable-savings']
	if (cashableSavings === 'yes') {
		return res.redirect(`/v2/cashable-savings-type`)
	}
	return res.redirect(`/v2/add-a-benefit`)
})


router.post('/v2/strategic-value-summary', (req, res) => {
	persistJourneyDataToContract(req)
	const addStrategicValue = getSessionData(req)['addStrategicValue']
	if (addStrategicValue === 'yes') {
		return res.redirect(`/v2/add-a-benefit`)
	}

	let ocid = getActiveContractOcid(req)
	if (!ocid && req.body && req.body.ocid) {
		ocid = req.body.ocid
		setActiveContractOcid(req, ocid)
	}

	if (!ocid) {
		return res.redirect('/v2/contracts')
	}

	return res.redirect(`/v2/declaration`)
})

router.post('/v2/add-a-benefit', (req, res) => {
	//console.log("testing")
	const strategicValue = getSessionData(req)['strategic-value']
	if (strategicValue === 'non-cashable') {
		return res.redirect(`/v2/non-cashable-type`)
	}
	res.redirect(`/v2/non-monetisable-type`)
})

router.post('/v2/non-cashable-type', (req, res) => {
	res.redirect(`/v2/non-cashable-savings-value`)
})

router.post('/v2/non-monetisable-type', (req, res) => {
	res.redirect(`/v2/strategic-value-summary`)
})

router.post('/v2/non-cashable-savings-value', (req, res) => {
	persistJourneyDataToContract(req)
	res.redirect(`/v2/strategic-value-summary`)
})

router.post('/v2/declaration/', (req, res) => {
	return res.redirect(`/v2/calculation/`)
})

router.post('/v2/calculation/:ocid', (req, res) => {
	res.redirect(`/v2/calculation/${req.params.ocid}`)
})

router.post('/v2/dashboard', (req, res) => {
	res.redirect('/v2/dashboard')
})

router.post('/v2/add-a-saving', (req, res) => {
	if (req.session.data['savings-data-method'] === 'single-contract') {
		return res.redirect('/v2/contracts-in-progress')
	} else if (req.session.data['savings-data-method'] === 'bulk-upload') {
		return res.redirect('/v2/bulk-upload')
	}

	//res.redirect('/v2/dashboard')
})

router.post('/v2/bulk-upload', (req, res) => {
	const sessionData = getSessionData(req)
	const attemptCount = Number(sessionData.bulkUploadAttemptCount || 0) + 1

	sessionData.bulkUploadAttemptCount = attemptCount
	sessionData.bulkUploadPendingOutcome = attemptCount === 1 ? 'error' : 'success'

	if (attemptCount === 1) {
		sessionData.bulkUploadErrors = [
			'Row 2: Missing OCID. Enter a valid 42-character identifier',
			"Row 5: Cashable saving must be either 'Yes' or 'No'.",
			"Row 12: Must match an approved calculation method: 'Budget', 'Market rates', or 'Benchmarking'.",
			"Row 19: Negative value not allowed. Must be £0 or greater."
		]
	} else {
		sessionData.bulkUploadReviewItems = getBulkUploadReviewItems()
	}

	res.redirect('/v2/bulk-upload-processing')
})

router.get('/v2/bulk-upload-result', (req, res) => {
	const sessionData = getSessionData(req)
	const outcome = sessionData.bulkUploadPendingOutcome

	if (!outcome) {
		return res.redirect('/v2/bulk-upload')
	}

	delete sessionData.bulkUploadPendingOutcome

	if (outcome === 'error') {
		return res.redirect('/v2/bulk-upload-error')
	}

	return res.redirect('/v2/bulk-upload-review')
})

router.get('/v2/bulk-upload-error', (req, res) => {
	const sessionData = getSessionData(req)
	const uploadErrors = Array.isArray(sessionData.bulkUploadErrors) ? sessionData.bulkUploadErrors : []

	return res.render('v2/bulk-upload-error', { uploadErrors })
})

router.get('/v2/bulk-upload-review', (req, res) => {
	const sessionData = getSessionData(req)
	const reviewItems = Array.isArray(sessionData.bulkUploadReviewItems) ? sessionData.bulkUploadReviewItems : []

	if (reviewItems.length === 0) {
		return res.redirect('/v2/bulk-upload')
	}

	return res.render('v2/bulk-upload-review', { reviewItems })
})

router.post('/v2/bulk-upload-review-confirm', (req, res) => {
	const sessionData = getSessionData(req)
	const reviewItems = Array.isArray(sessionData.bulkUploadReviewItems) ? sessionData.bulkUploadReviewItems : []

	if (reviewItems.length === 0) {
		return res.redirect('/v2/bulk-upload')
	}

	reviewItems.forEach((item) => {
		upsertContractData(item.ocid, {
			status: 'Completed',
			cashableSavingType: item.cashableSavingType,
			baselineApproach: item.baselineApproach,
			baselineValue: item.baselineValue,
			cashableSavings: item.cashableSavings
		})
	})

	sessionData.bulkUploadAppliedCount = reviewItems.length
	sessionData.bulkUploadUpdatedContracts = reviewItems.map((item) => ({
		ocid: item.ocid,
		title: item.title
	}))
	delete sessionData.bulkUploadReviewItems

	return res.redirect('/v2/declaration-bulk')
})

router.post('/v2/declaration-bulk', (req, res) => {
	return res.redirect('/v2/bulk-upload-success')
})

router.get('/v2/bulk-upload-success', (req, res) => {
	const sessionData = getSessionData(req)
	const appliedCount = Number(sessionData.bulkUploadAppliedCount || 0)
	const updatedContracts = Array.isArray(sessionData.bulkUploadUpdatedContracts)
		? sessionData.bulkUploadUpdatedContracts
		: []

	return res.render('v2/bulk-upload-success', { appliedCount, updatedContracts })
})

router.post('/v2/export', (req, res) => {
	res.redirect('/v2/export')
})

router.post('/v2/forgot-password', (req, res) => {
	res.redirect('/v2/forgot-password')
})

module.exports = router