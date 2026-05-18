//
// For guidance on how to create filters see:
// https://prototype-kit.service.gov.uk/docs/filters
//

const govukPrototypeKit = require('govuk-prototype-kit')
const addFilter = govukPrototypeKit.views.addFilter

// Add your filters here

addFilter('toWholePounds', (currencyValue) => {
	if (typeof currencyValue !== 'string') return currencyValue

	const normalizedValue = currencyValue.trim()
	let numericValue

	const poundMatch = normalizedValue.match(/^£([\d,]+)(\.\d{2})?$/)
	if (poundMatch) {
		numericValue = Number(poundMatch[1].replace(/,/g, '') + (poundMatch[2] || ''))
	}

	const gbpMatch = normalizedValue.match(/^GBP\s+([\d,]+)(\.\d{2})?$/i)
	if (!poundMatch && gbpMatch) {
		numericValue = Number(gbpMatch[1].replace(/,/g, '') + (gbpMatch[2] || ''))
	}

	if (Number.isNaN(numericValue) || typeof numericValue !== 'number') {
		return currencyValue
	}

	return `£${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(Math.round(numericValue))}`
})

