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

addFilter('formatNestedData', (value) => {
	if (!value) return value;

	let currentIndentLevel = 0;
	let inArray = false;

	return value
		.split('\n')
		.filter(line => line.trim().length > 0) // remove blank lines
		.map(line => {
			const trimmedLine = line.trimStart();

			// check if this line contains a colon (indicates a key value pair)
			if (trimmedLine.includes(':')) {
				// if it's a nested object (has more content after the colon)
				if (trimmedLine.split(':')[1].trim()) {
					currentIndentLevel = line.search(/\S/); // get original indentation
					inArray = false;
					return ' '.repeat(currentIndentLevel) + trimmedLine;
				} else {
					// It's the start of an array or nested object
					currentIndentLevel = line.search(/\S/) + 2; // get original indentation
					inArray = true;
					return ' '.repeat(currentIndentLevel - 2) + trimmedLine;
				}
			} else {
				// For array items, just return  with current indent level
				return ' '.repeat(currentIndentLevel) + trimmedLine
			}
		}).join('\n').trim();
})

