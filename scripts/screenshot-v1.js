// Standalone Playwright capture of the v1 prototype flow.
// Run with: node scripts/screenshot-v1.js
const path = require('path')
const fs = require('fs')
const { chromium } = require('playwright')

const BASE = 'http://localhost:3000'
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots')
let outputIndex = 1
while (fs.existsSync(path.join(SCREENSHOTS_DIR, `v1-${outputIndex}`))) {
	outputIndex += 1
}
const OUT_DIR = path.join(SCREENSHOTS_DIR, `v1-${outputIndex}`)
const IN_PROGRESS_OCID = 'ocds-b5fd17-c1a2b3c4-6666-4000-a000-000000000006'
const COMPLETED_OCID = 'ocds-b5fd17-c1a2b3c4-8888-4000-a000-000000000008'

let n = 0
async function shot (page, name) {
	n += 1
	const file = path.join(OUT_DIR, `${String(n).padStart(3, '0')}-${name}.png`)
	await page.screenshot({ path: file, fullPage: true })
	console.log('captured', file)
}

async function submit (page) {
	await page.getByRole('button', { name: /continue/i }).first().click()
	await page.waitForLoadState('load')
}

async function checkRadio (page, name, value) {
	await page.locator(`input[type="radio"][name="${name}"][value="${value}"]`).first().check({ force: true })
}

async function main () {
	fs.mkdirSync(OUT_DIR, { recursive: true })
	const browser = await chromium.launch({ channel: 'chrome', headless: true })
	const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })

	await page.goto(`${BASE}/v1/start`, { waitUntil: 'load' })
	await shot(page, 'start')
	await page.getByRole('button', { name: /log in/i }).first().click()
	await page.waitForLoadState('load')

	await shot(page, 'sign-in')
	await submit(page)

	await shot(page, 'contracts')

	// Completed contract
	await page.goto(`${BASE}/v1/calculation/${COMPLETED_OCID}`, { waitUntil: 'load' })
	await shot(page, 'calculation-completed')

	// In progress contract: cashable savings journey
	await page.goto(`${BASE}/v1/cashable-savings-category/${IN_PROGRESS_OCID}`, { waitUntil: 'load' })
	await shot(page, 'cashable-savings-category')
	await checkRadio(page, 'cashableSavings', 'yes')
	await page.locator('select[name="savingsType"]').selectOption('margin-reduction')
	await submit(page)

	await shot(page, 'baseline-information')
	await page.locator('select[name="baselineType"]').selectOption('budget')
	await page.locator('input[name="baselineValue"]').fill('100000')
	await submit(page)

	await shot(page, 'procurement-savings-summary')
	await checkRadio(page, 'addStrategicValue', 'yes')
	await submit(page)

	// Strategic value: other benefits
	await shot(page, 'non-cashable')
	await checkRadio(page, 'strategicValue', 'non-cashable')
	await page.locator('select[name="nonCashableType"]').selectOption('cost-avoidance')
	await submit(page)

	await shot(page, 'non-cashable-savings-value')
	await page.locator('input[name="savingsValue"]').fill('5000')
	await submit(page)

	await shot(page, 'strategic-value-summary')
	await checkRadio(page, 'addStrategicValue', 'no')
	await submit(page)

	await shot(page, 'calculation')

	await browser.close()
	console.log(`Done. ${n} screenshots saved to ${OUT_DIR}`)
}

main().catch(err => {
	console.error(err)
	process.exit(1)
})
