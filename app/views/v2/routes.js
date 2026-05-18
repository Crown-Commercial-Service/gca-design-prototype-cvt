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

	return res.render('v2/calculation', { contract })
})

router.get('/v2/calculation', (req, res) => {
	const ocid = getActiveContractOcid(req)

	if (!ocid) {
		return res.redirect('/v2/contracts')
	}

	return res.redirect(`/v2/calculation/${ocid}`)
})

// Unique: loads contract for cashable savings category page (In progress contracts)
router.get('/v2/cashable-savings-category/:ocid', (req, res) => {
	const { ocid } = req.params
	setActiveContractOcid(req, ocid)
	const contract = findContractByOcid(ocid)

	if (!contract) {
		return res.status(404).render('v2/cashable-savings-category', { contract: null, ocid })
	}

	return res.render('v2/cashable-savings-category', { contract })
})

router.get('/v2/procurement-savings-summary', (req, res) => {
	const ocid = getActiveContractOcid(req)
	const contract = ocid ? findContractByOcid(ocid) : null

	return res.render('v2/procurement-savings-summary', { contract, ocid })
})

router.post('/v2/procurement-savings-summary', (req, res) => {
	const ocid = getActiveContractOcid(req)
	const contract = ocid ? findContractByOcid(ocid) : null
	const addStrategicValue = getSessionData(req).addStrategicValue

	console.log("ocid: ", ocid)
	console.log("contract: ", contract)

	if (addStrategicValue === 'yes') {
		return res.redirect(`/v2/non-cashable`)
	}

	if (!ocid || !contract) {
		return res.redirect('/v2/contracts')
	}

	return res.redirect(`/v2/calculation/${ocid}`)
})

router.get('/v2/strategic-value-summary', (req, res) => {
	const ocid = getActiveContractOcid(req)
	const contract = ocid ? findContractByOcid(ocid) : null

	return res.render('v2/strategic-value-summary', { contract, ocid })
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
	//setActiveContractOcid(req, req.params.ocid)
	const cashableSavings = req.session.data['cashable-savings']
	if (cashableSavings === 'yes') {
		res.redirect(`/v2/cashable-savings-category`)
	}
	res.redirect(`/v2/non-cashable`)
})

router.post('/v2/cashable-savings-category/:ocid', (req, res) => {
	setActiveContractOcid(req, req.params.ocid)
	const cashableSavings = getSessionData(req)['cashable-savings']
	if (cashableSavings === 'yes') {
		return res.redirect(`/v2/baseline-information`)
	}
	res.redirect(`/v2/non-cashable`)
})

router.post('/v2/baseline-information', (req, res) => {
	persistJourneyDataToContract(req)
	res.redirect(`/v2/procurement-savings-summary`)
})

router.post('/v2/non-cashable', (req, res) => {
	//console.log("testing")
	const strategicValue = getSessionData(req)['strategic-value']
	if (strategicValue === 'non-cashable') {
		return res.redirect(`/v2/non-cashable-savings-value`)
	}
	res.redirect(`/v2/strategic-value-summary`)
})

router.post('/v2/strategic-value-summary', (req, res) => {
	persistJourneyDataToContract(req)
	const addStrategicValue = getSessionData(req)['addStrategicValue']
	if (addStrategicValue === 'yes') {
		return res.redirect(`/v2/non-cashable`)
	}

	const ocid = getActiveContractOcid(req)
	if (!ocid) {
		return res.redirect('/v2/contracts')
	}

	res.redirect(`/v2/calculation/${ocid}`)
})

router.post('/v2/non-cashable-savings-value', (req, res) => {
	persistJourneyDataToContract(req)
	res.redirect(`/v2/strategic-value-summary`)
})

router.post('/v2/calculation/:ocid', (req, res) => {
	res.redirect(`/v2/calculation/${req.params.ocid}`)
})

router.post('/v2/dashboard', (req, res) => {
	res.redirect('/v2/dashboard')
})

router.post('/v2/export', (req, res) => {
	res.redirect('/v2/export')
})

router.post('/v2/forgot-password', (req, res) => {
	res.redirect('/v2/forgot-password')
})

module.exports = router