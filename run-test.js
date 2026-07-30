const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(2000);
  
  // Create a dummy PDF
  // Actually we need to upload a pdf. Let's just run a script in the browser to addDoc directly.
  await page.evaluate(async () => {
    // Need to get access to addDoc, db, Timestamp.
    // They are not exposed globally. 
  });
  await browser.close();
})();
