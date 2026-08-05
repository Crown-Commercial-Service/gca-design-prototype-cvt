//
// For guidance on how to create routes see:
// https://prototype-kit.service.gov.uk/docs/create-routes
//

const govukPrototypeKit = require('govuk-prototype-kit')
const router = govukPrototypeKit.requests.setupRouter()
const contracts = require('./data/contracts.json')

// Keep a pristine snapshot so clear-data can restore every contract state.
const originalContracts = JSON.parse(JSON.stringify(contracts))


router.use('/', require('./views/v1/routes'))
router.use('/', require('./views/v2/routes'))

// sessions data

router.post('/clear-data', function (req, res) {
    contracts.length = 0
    originalContracts.forEach((contract) => {
        contracts.push(JSON.parse(JSON.stringify(contract)))
    })

    req.session.data = {}
    res.redirect('/index')
})


// need a way to reset the contract data as it's currently stored in memory and shared across sessions - this is a simple implementation that clears all contract data back to the original state from the JSON file - in a real implementation this would be handled by a database with proper session management
//router.post('/reset-contracts', (req, res) => {
//    contracts.length = 0
//    Array.prototype.push.apply(contracts, require('../../data/contracts.json'))
//    res.redirect('/v1/contracts')
//})
