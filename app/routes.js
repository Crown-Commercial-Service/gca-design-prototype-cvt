//
// For guidance on how to create routes see:
// https://prototype-kit.service.gov.uk/docs/create-routes
//

const govukPrototypeKit = require('govuk-prototype-kit')
const router = govukPrototypeKit.requests.setupRouter()


router.use('/', require('./views/v1/routes'))
router.use('/', require('./views/v2/routes'))

// sessions data

router.post('/clear-data', function (req, res) {
    // need to also clear the contract data as it's currently stored in memory and shared across sessions - in a real implementation this would be handled by a database with proper session management
    const contracts = require('./data/contracts.json')
    //contracts.length = 0
    //Array.prototype.push.apply(contracts, require('./data/contracts.json'))
    // it looks like it wipes the contracts completely so need to figure out how to put the contracts back in after

    // need to loop through all the contract.status and set them to 'In progress')
    contracts.forEach(contract => {
        if (contract.ocid === 'ocds-b5fd17-d3859370-1586-4b97-81e3-af2523769790' || contract.ocid === 'ocds-b5fd17-c1a2b3c4-2222-4000-a000-000000000002') {
            contract.status = 'In progress'
        }
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
