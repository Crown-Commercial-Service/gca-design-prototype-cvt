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
			otherValueBenefits: contract.nonCashableSavings && contract.nonCashableSavings !== 'Not provided'
				? contract.nonCashableSavings
				: '',
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
	const contract = findContractByOcid(ocid)

	if (sessionData['cashable-savings'] === 'yes') {
		updates.status = 'Completed'
	}

	const cashableSavingType = sessionData['cashable-savings-type'] || sessionData['savings-type']
	if (cashableSavingType && cashableSavingType !== 'choose') {
		updates.cashableSavingType = cashableSavingType
	}

	const baselineValue = sessionData['baseline-value'] || sessionData.costPerItem
	if (baselineValue) {
		updates.baselineValue = baselineValue

		if (contract) {
			const baselineAmount = toNumber(baselineValue)
			const contractAmount = toNumber(contract.contractValueDisplay || contract.value)
			const cashableSavings = Math.max(Math.round(baselineAmount - contractAmount), 0)

			updates.cashableSavings = String(cashableSavings)
			updates.cashableSavingsPercentage = formatPercentage(getPercentage(cashableSavings, contractAmount))
		}
	}

	const nonCashableSavingsValue = sessionData['non-cashable-savings-value'] || sessionData['savings-value']
	if (nonCashableSavingsValue) {
		updates.nonCashableSavings = nonCashableSavingsValue
	}

	upsertContractData(ocid, updates)

	return updates
}

// Unique: loads contract data for the list
router.get('/v3/contracts', (req, res) => {
	res.render('v3/post-procurement/contracts', { contracts })
})

// Unique: loads contract data for the list
router.get('/v3/contracts-completed', (req, res) => {
	res.render('v3/post-procurement/contracts-completed', { contracts: getContractsByStatus('Completed') })
})

// Unique: loads contract data for the list
router.get('/v3/contracts-in-progress', (req, res) => {
	res.render('v3/post-procurement/contracts-in-progress', { contracts: getContractsByStatus('In progress') })
})

// Unique: looks up a specific contract by ocid
router.get('/v3/calculation/:ocid', (req, res) => {
	const { ocid } = req.params
	setActiveContractOcid(req, ocid)
	const contract = findContractByOcid(ocid)

	if (!contract) {
		return res.status(404).render('v3/post-procurement/calculation', { contract: null, ocid })
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
	const potentialCashSavings = Math.round(contractValue * (peerAverageSavingsPercentageValue / 100))
	const potentialOtherBenefits = Math.round(contractValue * 0.03)
	const sessionData = getSessionData(req)
	const potentialInputs = {
		region: sessionData.region || contract.region || 'North West',
		organisationType: sessionData.organisationType || contract.organisationType || 'Central government'
	}

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
		nonCashableShareOfTotalWidth: nonCashableShareOfTotal.toFixed(1),
		potentialCashSavings,
		potentialOtherBenefits,
		potentialTotalValue: potentialCashSavings + potentialOtherBenefits,
		regionalSavingsPercentageValue: 12,
		organisationTypeSavingsPercentageValue: 11,
		regionalSavingsValue: Math.round(contractValue * 0.12),
		organisationTypeSavingsValue: Math.round(contractValue * 0.11)
	}

	const calculationView = ['1', '2', '3', '4'].includes(req.query.view)
		? `v3/post-procurement/calculation-${req.query.view}`
		: 'v3/post-procurement/calculation'

	return res.render(calculationView, { contract, calculationMetrics, potentialInputs })
})

router.get('/v3/calculation-1/:ocid', (req, res) => {
	res.redirect(`/v3/calculation/${req.params.ocid}?view=1`)
})

router.get('/v3/calculation-2/:ocid', (req, res) => {
	res.redirect(`/v3/calculation/${req.params.ocid}?view=2`)
})

router.get('/v3/calculation-3/:ocid', (req, res) => {
	res.redirect(`/v3/calculation/${req.params.ocid}?view=3`)
})

router.get('/v3/calculation-4/:ocid', (req, res) => {
	res.redirect(`/v3/calculation/${req.params.ocid}?view=4`)
})

router.get('/v3/calculation', (req, res) => {
	const ocid = getActiveContractOcid(req)

	if (!ocid) {
		return res.redirect('/v3/contracts')
	}

	return res.redirect(`/v3/calculation/${ocid}`)
})

// Unique: loads contract for cashable savings page (In progress contracts)
router.get('/v3/cashable-savings/:ocid', (req, res) => {
	const { ocid } = req.params
	setActiveContractOcid(req, ocid)
	const contract = findContractByOcid(ocid)

	if (!contract) {
		return res.status(404).render('v3/post-procurement/cashable-savings', { contract: null, ocid })
	}

	return res.render('v3/post-procurement/cashable-savings', { contract, ocid })
})

router.get('/v3/cashable-savings', (req, res) => {
	const ocid = getActiveContractOcid(req)
	const contract = ocid ? findContractByOcid(ocid) : null

	if (!ocid || !contract) {
		return res.redirect('/v3/contracts-in-progress')
	}

	return res.render('v3/post-procurement/cashable-savings', { contract, ocid })
})

// Backwards compatibility for older links
router.get('/v3/cashable-savings-category/:ocid', (req, res) => {
	return res.redirect(`/v3/cashable-savings/${req.params.ocid}`)
})

router.get('/v3/procurement-savings-summary', (req, res) => {
	const ocid = getActiveContractOcid(req)
	const contract = ocid ? findContractByOcid(ocid) : null

	if (!ocid || !contract) {
		return res.redirect('/v3/contracts-in-progress')
	}

	return res.render('v3/post-procurement/procurement-savings-summary', { contract, ocid })
})

router.post('/v3/procurement-savings-summary', (req, res) => {
	const ocid = getActiveContractOcid(req)
	const contract = ocid ? findContractByOcid(ocid) : null
	const addStrategicValue = getSessionData(req).addStrategicValue

	console.log("ocid: ", ocid)
	console.log("contract: ", contract)

	if (addStrategicValue === 'yes') {
		return res.redirect(`/v3/add-a-benefit`)
	}

	if (!ocid || !contract) {
		return res.redirect('/v3/contracts')
	}

	return res.redirect(`/v3/declaration`)
})

router.get('/v3/strategic-value-summary', (req, res) => {
	const ocid = getActiveContractOcid(req)
	const contract = ocid ? findContractByOcid(ocid) : null

	if (!ocid || !contract) {
		return res.redirect('/v3/contracts-in-progress')
	}

	return res.render('v3/post-procurement/strategic-value-summary', { contract, ocid })
})

router.get('/v3/dashboard', (req, res) => {
	const completedCount = getContractsByStatus('Completed').length
	const inProgressCount = getContractsByStatus('In progress').length

	return res.render('v3/dashboard', { completedCount, inProgressCount })
})

router.get('/v3/dashboard-1', (req, res) => {
	return res.render('v3/dashboard-1')
})

router.get('/v3/dashboard-2', (req, res) => {
	return res.render('v3/dashboard-2')
})

router.get('/v3/dashboard-3', (req, res) => {
	return res.render('v3/dashboard-3')
})

router.get('/v3/dashboard-4', (req, res) => {
	return res.render('v3/dashboard-4')
})

router.get('/v3/dashboard-5', (req, res) => {
	return res.render('v3/dashboard-5')
})

router.get('/v3/dashboard-6', (req, res) => {
	return res.render('v3/dashboard-6')
})

router.get('/v3/pre-procurement/cpv-code', (req, res) => {
	res.render('v3/pre-procurement/cpv-code')
})

router.post('/v3/pre-procurement/cpv-code', (req, res) => {
	const sessionData = getSessionData(req)

	if (req.body.cpvChoice === 'no') {
		return res.redirect('/v3/pre-procurement/what-are-you-buying')
	}

	sessionData.cpvCode = req.body.cpvCode || ''
	return res.redirect('/v3/pre-procurement/enter-cpv-code')
})

router.get('/v3/pre-procurement/enter-cpv-code', (req, res) => {
	res.render('v3/pre-procurement/enter-cpv-code')
})

router.post('/v3/pre-procurement/enter-cpv-code', (req, res) => {
	const sessionData = getSessionData(req)
	sessionData.cpvCode = req.body.cpvCode || ''
	sessionData.cpvDescription = req.body.cpvDescription || 'Description to be confirmed'
	return res.redirect('/v3/pre-procurement/confirm-cpv-code')
})

router.get('/v3/pre-procurement/confirm-cpv-code', (req, res) => {
	const sessionData = getSessionData(req)
	res.render('v3/pre-procurement/confirm-cpv-code', { cpv: sessionData })
})

router.get('/v3/pre-procurement/organisation-type', (req, res) => {
	res.render('v3/pre-procurement/organisation-type')
})

router.post('/v3/pre-procurement/confirm-cpv-code', (req, res) => {
	return res.redirect('/v3/pre-procurement/organisation-type')
})

router.post('/v3/pre-procurement/organisation-type', (req, res) => {
	getSessionData(req).organisationType = req.body.organisationType
	return res.redirect('/v3/pre-procurement/country')
})

router.get('/v3/pre-procurement/country', (req, res) => {
	res.render('v3/pre-procurement/country')
})

router.post('/v3/pre-procurement/country', (req, res) => {
	getSessionData(req).country = req.body.country
	return res.redirect('/v3/pre-procurement/region')
})

router.get('/v3/pre-procurement/region', (req, res) => {
	res.render('v3/pre-procurement/region', { country: getSessionData(req).country })
})

router.post('/v3/pre-procurement/region', (req, res) => {
	getSessionData(req).region = req.body.region
	return res.redirect('/v3/pre-procurement/contract-value')
})

router.get('/v3/pre-procurement/contract-value', (req, res) => {
	res.render('v3/pre-procurement/contract-value')
})

router.post('/v3/pre-procurement/contract-value', (req, res) => {
	getSessionData(req).contractValue = req.body.contractValue
	return res.redirect('/v3/pre-procurement/contract-start-date')
})

router.get('/v3/pre-procurement/contract-start-date', (req, res) => {
	res.render('v3/pre-procurement/contract-start-date')
})

router.post('/v3/pre-procurement/contract-start-date', (req, res) => {
	const sessionData = getSessionData(req)
	sessionData.contractStartDate = [req.body.contractStartDateDay, req.body.contractStartDateMonth, req.body.contractStartDateYear].filter(Boolean).join('/')
	return res.redirect('/v3/pre-procurement/contract-length')
})

router.get('/v3/pre-procurement/contract-length', (req, res) => {
	res.render('v3/pre-procurement/contract-length')
})

router.post('/v3/pre-procurement/contract-length', (req, res) => {
	getSessionData(req).contractLength = req.body.contractLength
	return res.redirect('/v3/pre-procurement/calculation')
})

router.get('/v3/pre-procurement/calculation', (req, res) => {
	const sessionData = getSessionData(req)
	const contractValue = toNumber(sessionData.contractValue)
	const potentialCashSavings = Math.round(contractValue * 0.1)
	const potentialOtherBenefits = Math.round(contractValue * 0.03)
	const contract = {
		ocid: 'pre-procurement',
		cpvCode: sessionData.cpvCode || 'Not provided',
		cpvDescription: sessionData.cpvDescription || 'Description to be confirmed',
		startDate: sessionData.contractStartDate || 'Not provided',
		endDate: 'Not provided'
	}
	const calculationMetrics = {
		contractValue,
		potentialCashSavings,
		potentialOtherBenefits,
		potentialTotalValue: potentialCashSavings + potentialOtherBenefits,
		peerAverageSavingsPercentageValue: 10,
		peerAverageSavingsPercentage: '10.0%',
		regionalSavingsPercentageValue: 12,
		organisationTypeSavingsPercentageValue: 11,
		regionalSavingsValue: Math.round(contractValue * 0.12),
		organisationTypeSavingsValue: Math.round(contractValue * 0.11)
	}
	const potentialInputs = {
		region: sessionData.region || 'Not provided',
		organisationType: sessionData.organisationType || 'Not provided'
	}

	return res.render('v3/post-procurement/calculation-4', { contract, calculationMetrics, potentialInputs, isPreProcurement: true })
})

router.get('/v3/add-a-saving', (req, res) => {
	res.render('v3/post-procurement/add-a-saving')
})

router.get('/v3/add-a-benefit', (req, res) => {
	res.render('v3/post-procurement/add-a-benefit')
})

router.get('/v3/baseline-value', (req, res) => {
	res.render('v3/post-procurement/baseline-value')
})

router.get('/v3/bulk-upload', (req, res) => {
	res.render('v3/post-procurement/bulk-upload')
})

router.get('/v3/bulk-upload-processing', (req, res) => {
	res.render('v3/post-procurement/bulk-upload-processing')
})

router.get('/v3/cashable-savings-type', (req, res) => {
	res.render('v3/post-procurement/cashable-savings-type')
})

router.get('/v3/declaration', (req, res) => {
	res.render('v3/post-procurement/declaration')
})

router.get('/v3/declaration-bulk', (req, res) => {
	res.render('v3/post-procurement/declaration-bulk')
})

router.get('/v3/non-cashable-savings-value', (req, res) => {
	res.render('v3/post-procurement/non-cashable-savings-value')
})

router.get('/v3/non-cashable-type', (req, res) => {
	res.render('v3/post-procurement/non-cashable-type')
})

router.get('/v3/non-monetisable-type', (req, res) => {
	res.render('v3/post-procurement/non-monetisable-type')
})

// Form submissions — redirect to next page
router.post('/v3/start', (req, res) => {
	res.redirect('/v3/sign-in')
})

router.post('/v3/sign-in', (req, res) => {
	res.redirect('/v3/contracts')
})

router.post('/v3/contracts', (req, res) => {
	res.redirect('/v3/contracts')
})

router.post('/v3/cashable-savings/', (req, res) => {
	if (!getActiveContractOcid(req) && req.body && req.body.ocid) {
		setActiveContractOcid(req, req.body.ocid)
	}

	if (!getActiveContractOcid(req)) {
		return res.redirect('/v3/contracts-in-progress')
	}

	const cashableSavings = req.session.data['cashable-savings']
	if (cashableSavings === 'yes') {
		return res.redirect(`/v3/cashable-savings-type`)
	}
	return res.redirect(`/v3/add-a-benefit`)
})

router.post('/v3/cashable-savings-type', (req, res) => {
	res.redirect(`/v3/baseline-approach`)
})

router.get('/v3/baseline-approach', (req, res) => {
	const ocid = getActiveContractOcid(req)
	const contract = ocid ? findContractByOcid(ocid) : null

	if (!ocid || !contract) {
		return res.redirect('/v3/contracts-in-progress')
	}

	return res.render('v3/post-procurement/baseline-approach', { contract, ocid })
})

router.post('/v3/baseline-approach', (req, res) => {
	persistJourneyDataToContract(req)
	//res.redirect(`/v3/baseline-value`)
	res.redirect(`/v3/procurement-savings-summary`)
})

router.post('/v3/baseline-value', (req, res) => {
	persistJourneyDataToContract(req)
	res.redirect(`/v3/procurement-savings-summary`)
})

router.post('/v3/cashable-savings-category/:ocid', (req, res) => {
	setActiveContractOcid(req, req.params.ocid)
	const cashableSavings = getSessionData(req)['cashable-savings']
	if (cashableSavings === 'yes') {
		return res.redirect(`/v3/cashable-savings-type`)
	}
	return res.redirect(`/v3/add-a-benefit`)
})


router.post('/v3/strategic-value-summary', (req, res) => {
	persistJourneyDataToContract(req)
	const addStrategicValue = getSessionData(req)['addStrategicValue']
	if (addStrategicValue === 'yes') {
		return res.redirect(`/v3/add-a-benefit`)
	}

	let ocid = getActiveContractOcid(req)
	if (!ocid && req.body && req.body.ocid) {
		ocid = req.body.ocid
		setActiveContractOcid(req, ocid)
	}

	if (!ocid) {
		return res.redirect('/v3/contracts')
	}

	return res.redirect(`/v3/declaration`)
})

router.post('/v3/add-a-benefit', (req, res) => {
	//console.log("testing")
	const strategicValue = getSessionData(req)['strategic-value']
	if (strategicValue === 'non-cashable') {
		return res.redirect(`/v3/non-cashable-type`)
	}
	res.redirect(`/v3/non-monetisable-type`)
})

router.post('/v3/non-cashable-type', (req, res) => {
	res.redirect(`/v3/non-cashable-savings-value`)
})

router.post('/v3/non-monetisable-type', (req, res) => {
	res.redirect(`/v3/strategic-value-summary`)
})

router.post('/v3/non-cashable-savings-value', (req, res) => {
	persistJourneyDataToContract(req)
	res.redirect(`/v3/strategic-value-summary`)
})

router.post('/v3/declaration/', (req, res) => {
	return res.redirect(`/v3/calculation/`)
})

router.post('/v3/calculation/:ocid', (req, res) => {
	res.redirect(`/v3/calculation/${req.params.ocid}`)
})

router.post('/v3/dashboard', (req, res) => {
	res.redirect('/v3/dashboard')
})

router.post('/v3/add-a-saving', (req, res) => {
	if (req.session.data['savings-data-method'] === 'single-contract') {
		return res.redirect('/v3/contracts-in-progress')
	} else if (req.session.data['savings-data-method'] === 'bulk-upload') {
		return res.redirect('/v3/bulk-upload')
	}

	//res.redirect('/v3/dashboard')
})

router.post('/v3/bulk-upload', (req, res) => {
	const sessionData = getSessionData(req)
	sessionData.bulkUploadReviewItems = getBulkUploadReviewItems()

	res.redirect('/v3/bulk-upload-processing')
})

router.get('/v3/bulk-upload-result', (req, res) => {
	res.redirect('/v3/bulk-upload-review')
})

router.get('/v3/bulk-upload-error', (req, res) => {
	const sessionData = getSessionData(req)
	const uploadErrors = Array.isArray(sessionData.bulkUploadErrors) ? sessionData.bulkUploadErrors : []

	return res.render('v3/post-procurement/bulk-upload-error', { uploadErrors })
})

router.get('/v3/bulk-upload-review', (req, res) => {
	const sessionData = getSessionData(req)
	const reviewItems = Array.isArray(sessionData.bulkUploadReviewItems) ? sessionData.bulkUploadReviewItems : []

	if (reviewItems.length === 0) {
		return res.redirect('/v3/bulk-upload')
	}

	return res.render('v3/post-procurement/bulk-upload-review-table', { reviewItems })
})

router.get('/v3/bulk-upload-review-table', (req, res) => {
	res.redirect('/v3/bulk-upload-review')
})

router.get('/v3/bulk-upload-review-compact', (req, res) => {
	const sessionData = getSessionData(req)
	const reviewItems = Array.isArray(sessionData.bulkUploadReviewItems) ? sessionData.bulkUploadReviewItems : []

	if (reviewItems.length === 0) {
		return res.redirect('/v3/bulk-upload')
	}

	return res.render('v3/post-procurement/bulk-upload-review-table', { reviewItems })
})

router.post('/v3/bulk-upload-review-confirm', (req, res) => {
	const sessionData = getSessionData(req)
	const reviewItems = Array.isArray(sessionData.bulkUploadReviewItems) ? sessionData.bulkUploadReviewItems : []

	if (reviewItems.length === 0) {
		return res.redirect('/v3/bulk-upload')
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

	return res.redirect('/v3/declaration-bulk')
})

router.post('/v3/declaration-bulk', (req, res) => {
	return res.redirect('/v3/bulk-upload-success')
})

router.get('/v3/bulk-upload-success', (req, res) => {
	const sessionData = getSessionData(req)
	const appliedCount = Number(sessionData.bulkUploadAppliedCount || 0)
	const updatedContracts = Array.isArray(sessionData.bulkUploadUpdatedContracts)
		? sessionData.bulkUploadUpdatedContracts
		: []

	return res.render('v3/post-procurement/bulk-upload-success', { appliedCount, updatedContracts })
})

router.post('/v3/export', (req, res) => {
	res.redirect('/v3/export')
})

router.post('/v3/forgot-password', (req, res) => {
	res.redirect('/v3/forgot-password')
})

module.exports = router