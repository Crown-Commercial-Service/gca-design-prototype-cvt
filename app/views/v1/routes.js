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

	if (sessionData.cashableSavings === 'yes') {
		updates.status = 'Completed'
	}

	if (sessionData.savingsType && sessionData.savingsType !== 'choose') {
		updates.cashableSavingType = sessionData.savingsType
	}

	if (sessionData.baselineType && sessionData.baselineType !== 'choose') {
		updates.baselineApproach = sessionData.baselineType
	}

	if (sessionData.baselineValue) {
		updates.baselineValue = sessionData.baselineValue
	}

	if (sessionData.savingsValue) {
		updates.nonCashableSavings = sessionData.savingsValue
	}

	upsertContractData(ocid, updates)

	return updates
}

// Unique: loads contract data for the list
router.get('/v1/contracts', (req, res) => {
	res.render('v1/contracts', { contracts })
})

// Unique: looks up a specific contract by ocid
router.get('/v1/calculation/:ocid', (req, res) => {
	const { ocid } = req.params
	setActiveContractOcid(req, ocid)
	const contract = findContractByOcid(ocid)

	if (!contract) {
		return res.status(404).render('v1/calculation', { contract: null, ocid })
	}

	return res.render('v1/calculation', { contract })
})

router.get('/v1/calculation', (req, res) => {
	const ocid = getActiveContractOcid(req)

	if (!ocid) {
		return res.redirect('/v1/contracts')
	}

	return res.redirect(`/v1/calculation/${ocid}`)
})

// Unique: loads contract for cashable savings category page (In progress contracts)
router.get('/v1/cashable-savings-category/:ocid', (req, res) => {
	const { ocid } = req.params
	setActiveContractOcid(req, ocid)
	const contract = findContractByOcid(ocid)

	if (!contract) {
		return res.status(404).render('v1/cashable-savings-category', { contract: null, ocid })
	}

	return res.render('v1/cashable-savings-category', { contract })
})

router.get('/v1/procurement-savings-summary', (req, res) => {
	const ocid = getActiveContractOcid(req)
	const contract = ocid ? findContractByOcid(ocid) : null

	return res.render('v1/procurement-savings-summary', { contract, ocid })
})

router.post('/v1/procurement-savings-summary', (req, res) => {
	const ocid = getActiveContractOcid(req)
	const contract = ocid ? findContractByOcid(ocid) : null
	const addStrategicValue = getSessionData(req).addStrategicValue

	console.log("ocid: ", ocid)
	console.log("contract: ", contract)

	if (addStrategicValue === 'yes') {
		return res.redirect(`/v1/non-cashable`)
	}

	if (!ocid || !contract) {
		return res.redirect('/v1/contracts')
	}

	return res.redirect(`/v1/calculation/${ocid}`)
})

router.get('/v1/strategic-value-summary', (req, res) => {
	const ocid = getActiveContractOcid(req)
	const contract = ocid ? findContractByOcid(ocid) : null

	return res.render('v1/strategic-value-summary', { contract, ocid })
})

// Form submissions — redirect to next page
router.post('/v1/start', (req, res) => {
	res.redirect('/v1/sign-in')
})

router.post('/v1/sign-in', (req, res) => {
	res.redirect('/v1/contracts')
})

router.post('/v1/contracts', (req, res) => {
	res.redirect('/v1/contracts')
})

router.post('/v1/cashable-savings-category/:ocid', (req, res) => {
	setActiveContractOcid(req, req.params.ocid)
	const cashableSavings = getSessionData(req).cashableSavings
	if (cashableSavings === 'yes') {
		return res.redirect(`/v1/baseline-information`)
	}
	res.redirect(`/v1/non-cashable`)
})

router.post('/v1/baseline-information', (req, res) => {
	persistJourneyDataToContract(req)
	res.redirect(`/v1/procurement-savings-summary`)
})

router.post('/v1/non-cashable', (req, res) => {
	//console.log("testing")
	const strategicValue = getSessionData(req).strategicValue
	if (strategicValue === 'non-cashable') {
		return res.redirect(`/v1/non-cashable-savings-value`)
	}
	res.redirect(`/v1/strategic-value-summary`)
})

router.post('/v1/strategic-value-summary', (req, res) => {
	persistJourneyDataToContract(req)
	const addStrategicValue = getSessionData(req)['addStrategicValue']
	if (addStrategicValue === 'yes') {
		return res.redirect(`/v1/non-cashable`)
	}

	const ocid = getActiveContractOcid(req)
	if (!ocid) {
		return res.redirect('/v1/contracts')
	}

	res.redirect(`/v1/calculation/${ocid}`)
})

router.post('/v1/non-cashable-savings-value', (req, res) => {
	persistJourneyDataToContract(req)
	res.redirect(`/v1/strategic-value-summary`)
})

router.post('/v1/calculation/:ocid', (req, res) => {
	res.redirect(`/v1/calculation/${req.params.ocid}`)
})

router.post('/v1/dashboard', (req, res) => {
	res.redirect('/v1/dashboard')
})

router.post('/v1/export', (req, res) => {
	res.redirect('/v1/export')
})

router.post('/v1/forgot-password', (req, res) => {
	res.redirect('/v1/forgot-password')
})

module.exports = router