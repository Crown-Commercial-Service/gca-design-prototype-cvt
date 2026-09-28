// Standalone Playwright capture of the v3 prototype flow.
// Run with: node scripts/screenshot-v3.js
const path = require('path')
const { chromium } = require('playwright')

const BASE = 'http://localhost:3000'
const OUT_DIR = path.join(__dirname, '..', 'screenshots', 'v3-4')
const IN_PROGRESS_OCID = 'ocds-b5fd17-c1a2b3c4-6666-4000-a000-000000000006'

let n = 0
async function shot (page, name) {
	n += 1
	const file = path.join(OUT_DIR, `${String(n).padStart(3, '0')}-${name}.png`)
	await page.screenshot({ path: file, fullPage: true })
	console.log('captured', file)
}

async function checkRadio (page, valueOrLabel) {
	const radio = page.locator(`input[type="radio"][value="${valueOrLabel}"]`).first()
	if (await radio.count()) {
		await radio.check({ force: true })
		return
	}
	await page.getByLabel(valueOrLabel, { exact: false }).first().check({ force: true })
}

async function clickContinue (page) {
	await page.getByRole('button', { name: /continue/i }).first().click()
	await page.waitForLoadState('load')
}

async function main () {
	const browser = await chromium.launch({ channel: 'chrome', headless: true })
	const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })

	// Start
	await page.goto(`${BASE}/v3/start`, { waitUntil: 'load' })
	await shot(page, 'start')
	await page.getByRole('button', { name: /start now/i }).click()
	await page.waitForLoadState('load')

	// Sign in
	await shot(page, 'sign-in')
	await page.getByRole('button', { name: /continue/i }).click()
	await page.waitForLoadState('load')

	// Dashboard (lands here after sign in)
	await shot(page, 'dashboard')

	// Dashboard design variants (direct URL, not linked in nav)
	for (let i = 1; i <= 6; i++) {
		await page.goto(`${BASE}/v3/dashboard-${i}`, { waitUntil: 'load' })
		await shot(page, `dashboard-${i}`)
	}

	// Contracts list and views
	await page.goto(`${BASE}/v3/contracts`, { waitUntil: 'load' })
	await shot(page, 'contracts')

	await page.goto(`${BASE}/v3/contracts-completed`, { waitUntil: 'load' })
	await shot(page, 'contracts-completed')

	await page.goto(`${BASE}/v3/contracts-in-progress`, { waitUntil: 'load' })
	await shot(page, 'contracts-in-progress')

	// Add a saving flow, starting from the declaration link for an in-progress contract
	await page.goto(`${BASE}/v3/declaration/${IN_PROGRESS_OCID}`, { waitUntil: 'load' })
	await shot(page, 'declaration')
	await page.getByRole('button', { name: /agree and continue/i }).click()
	await page.waitForLoadState('load')

	// Cashable savings? choose Yes to reach the cashable savings sub-flow
	await shot(page, 'cashable-savings')
	await checkRadio(page, 'yes')
	await clickContinue(page)

	await shot(page, 'cashable-savings-type')
	await page.locator('input[type="radio"]').first().check({ force: true })
	await clickContinue(page)

	await shot(page, 'baseline-approach')
	await page.locator('input[type="radio"]').first().check({ force: true })
	// contract budget must exceed the £62,000 contract value to show a positive cashable saving
	const baselineAmount = page.locator('#baseline-value')
	if (await baselineAmount.count()) {
		await baselineAmount.fill('74400')
	}
	await clickContinue(page)

	// Baseline value is not linked from the current flow but kept for design reference
	await page.goto(`${BASE}/v3/baseline-value`, { waitUntil: 'load' })
	await shot(page, 'baseline-value')

	// Continue main flow: procurement savings summary
	await page.goto(`${BASE}/v3/procurement-savings-summary`, { waitUntil: 'load' })
	await shot(page, 'procurement-savings-summary')
	await checkRadio(page, 'no')
	await clickContinue(page)

	// Calculation result + numbered design variants
	await shot(page, 'calculation')
	for (let i = 1; i <= 4; i++) {
		await page.goto(`${BASE}/v3/calculation-${i}/${IN_PROGRESS_OCID}`, { waitUntil: 'load' })
		await shot(page, `calculation-${i}`)
	}

	// Add a benefit branch (non-cashable path) reached naturally from cashable-savings = no
	await page.goto(`${BASE}/v3/declaration/${IN_PROGRESS_OCID}`, { waitUntil: 'load' })
	await page.getByRole('button', { name: /agree and continue/i }).click()
	await page.waitForLoadState('load')
	await checkRadio(page, 'no')
	await clickContinue(page)

	await shot(page, 'add-a-benefit')
	await checkRadio(page, 'non-cashable')
	await clickContinue(page)

	await shot(page, 'non-cashable-type')
	await page.locator('input[type="radio"]').first().check({ force: true })
	await clickContinue(page)

	await shot(page, 'non-cashable-savings-value')
	const nonCashAmount = page.locator('input[type="text"], input[type="number"]').first()
	if (await nonCashAmount.count()) {
		await nonCashAmount.fill('5000')
	}
	await clickContinue(page)

	// Non-monetisable benefit type - the other branch, visited directly for design reference
	await page.goto(`${BASE}/v3/non-monetisable-type`, { waitUntil: 'load' })
	await shot(page, 'non-monetisable-type')

	await page.goto(`${BASE}/v3/strategic-value-summary`, { waitUntil: 'load' })
	await shot(page, 'strategic-value-summary')

	// Bulk upload flow
	await page.goto(`${BASE}/v3/add-a-saving`, { waitUntil: 'load' })
	await shot(page, 'add-a-saving')

	await page.goto(`${BASE}/v3/bulk-upload`, { waitUntil: 'load' })
	await shot(page, 'bulk-upload')

	await page.goto(`${BASE}/v3/bulk-upload-processing`, { waitUntil: 'load' })
	await shot(page, 'bulk-upload-processing')

	await page.goto(`${BASE}/v3/bulk-upload-review`, { waitUntil: 'load' })
	await shot(page, 'bulk-upload-review')

	await page.goto(`${BASE}/v3/bulk-upload-review-table`, { waitUntil: 'load' })
	await shot(page, 'bulk-upload-review-table')

	await page.goto(`${BASE}/v3/declaration-bulk`, { waitUntil: 'load' })
	await shot(page, 'declaration-bulk')

	await page.goto(`${BASE}/v3/bulk-upload-success`, { waitUntil: 'load' })
	await shot(page, 'bulk-upload-success')

	await page.goto(`${BASE}/v3/bulk-upload-error`, { waitUntil: 'load' })
	await shot(page, 'bulk-upload-error')

	// Pre-procurement calculation journey
	await page.goto(`${BASE}/v3/pre-procurement/cpv-code`, { waitUntil: 'load' })
	await shot(page, 'pre-procurement-cpv-code')
	await checkRadio(page, 'yes')
	const cpvInput = page.locator('input[type="text"]').first()
	if (await cpvInput.count()) {
		await cpvInput.fill('90711500')
	}
	await clickContinue(page)

	await shot(page, 'pre-procurement-enter-cpv-code')
	await clickContinue(page)

	await shot(page, 'pre-procurement-confirm-cpv-code')
	await clickContinue(page)

	await shot(page, 'pre-procurement-organisation-type')
	await page.locator('input[type="radio"]').first().check({ force: true })
	await clickContinue(page)

	await shot(page, 'pre-procurement-country')
	await page.locator('input[type="radio"]').first().check({ force: true })
	await clickContinue(page)

	await shot(page, 'pre-procurement-region')
	await page.locator('input[type="radio"]').first().check({ force: true })
	await clickContinue(page)

	await shot(page, 'pre-procurement-contract-value')
	const contractValueInput = page.locator('input[type="text"], input[type="number"]').first()
	if (await contractValueInput.count()) {
		await contractValueInput.fill('250000')
	}
	await clickContinue(page)

	await shot(page, 'pre-procurement-contract-start-date')
	const dateInputs = page.locator('input[type="text"], input[type="number"]')
	const dateCount = await dateInputs.count()
	if (dateCount >= 3) {
		await dateInputs.nth(0).fill('1')
		await dateInputs.nth(1).fill('4')
		await dateInputs.nth(2).fill('2027')
	}
	await clickContinue(page)

	await shot(page, 'pre-procurement-contract-length')
	const lengthInput = page.locator('input[type="text"], input[type="number"]').first()
	if (await lengthInput.count()) {
		await lengthInput.fill('12')
	}
	await clickContinue(page)

	await shot(page, 'pre-procurement-calculation')

	await browser.close()
	console.log(`Done. ${n} screenshots saved to ${OUT_DIR}`)
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})
