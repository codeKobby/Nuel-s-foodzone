
import time
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()
    for i in range(3):
        try:
            page.goto("http://localhost:9002/backoffice/orders", timeout=60000)
            page.wait_for_load_state("networkidle")
            break
        except Exception:
            time.sleep(5)

    # Click on the "Change Due" button
    page.locator("button:has-text('Change Due')").first.hover()
    page.locator("button:has-text('Change Due')").first.click()

    # Verify the date range is set to "All Time"
    page.screenshot(path="verification-change-due.png")

    # Click on the "Unpaid Orders" button
    page.locator("button:has-text('Unpaid Orders')").first.hover()
    page.locator("button:has-text('Unpaid Orders')").first.click()

    # Verify the date range is set to "All Time"
    page.screenshot(path="verification-unpaid-orders.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
