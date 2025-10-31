
import time
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()
    for i in range(3):
        try:
            page.goto("http://localhost:9002/backoffice/orders", timeout=60000)
            break
        except Exception:
            time.sleep(5)

    # Click on the first "Settle Change" button
    page.locator("text=Settle Change").first.click()

    # Wait for the modal to appear
    page.wait_for_selector('div[role="dialog"]')

    # Enter a partial amount
    page.locator("#settle-amount").fill("5")

    # Click the "Settle Cash" button
    page.click("text=Settle Cash")

    # Take a screenshot of the updated order
    page.screenshot(path="verification.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
