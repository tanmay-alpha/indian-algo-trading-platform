import { test, expect } from '@playwright/test';

test('MAET Terminal Smoke Audit', async ({ page }) => {
  test.setTimeout(60000); // Increase timeout to 60s
  // 1. Navigate to http://localhost:3000
  console.log('Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000');

  // 2. Verify the page loads (wait for 'Selected' or similar text)
  // Based on typical trading apps, 'Selected' might be in a watchlist or header.
  // We'll wait for the network to be idle and look for common terminal elements.
  await page.waitForLoadState('networkidle');
  
  // Log the page title and some text to verify load
  const title = await page.title();
  console.log(`Page Title: ${title}`);
  
  // 3. Click through the workspaces in the WorkspaceRail
  const workspaces = ['Trade', 'Markets', 'Charts', 'Portfolio', 'Strategy', 'Risk', 'Journal', 'OMS'];
  
  for (const workspace of workspaces) {
    console.log(`Testing workspace: ${workspace}`);
    // Use first() to avoid strict mode violation or use a more specific selector
    // Based on the error, the rail buttons seem to have a specific class structure.
    const railButton = page.locator(`button[title^="${workspace}"], button:has-text("${workspace}")`).first();
    
    if (await railButton.isVisible()) {
      await railButton.click({ force: true });
      console.log(`Clicked workspace: ${workspace}`);
      await page.waitForTimeout(1000); // Wait for transition
      
      // Check for errors on the page
      const bodyText = await page.innerText('body');
      if (bodyText.includes('Error') || bodyText.includes('Not Found')) {
        console.error(`Potential error detected on ${workspace} page`);
      }
      
      // Check for empty states (e.g., "No data", "Empty")
      if (bodyText.includes('No data') || bodyText.includes('Empty')) {
        console.log(`Note: ${workspace} shows an empty state.`);
      }
    } else {
      console.warn(`Workspace button "${workspace}" not found`);
    }
  }

  // 4. Check FOCUS mode
  const focusModes = ['CLEAN', 'ANALYSIS', 'FOCUS'];
  for (const mode of focusModes) {
    console.log(`Testing mode: ${mode}`);
    const modeButton = page.locator(`button:has-text("${mode}")`).first();
    if (await modeButton.isVisible()) {
      await modeButton.click({ force: true });
      await page.waitForTimeout(1000);
      console.log(`Clicked ${mode} mode`);
      
      // Take note of layout changes (can check for visibility of certain elements)
      // Check for elements that might disappear in FOCUS mode
      const watchList = page.locator('aside[aria-label="Watchlist"]');
      const isWatchListVisible = await watchList.isVisible();
      console.log(`Mode ${mode}: Watchlist visible = ${isWatchListVisible}`);
      
      const drawer = page.locator('aside[aria-label="Symbol intelligence drawer"]');
      const isDrawerVisible = await drawer.isVisible();
      console.log(`Mode ${mode}: Drawer visible = ${isDrawerVisible}`);
    } else {
      console.warn(`Mode button "${mode}" not found`);
    }
  }

  console.log('Smoke audit script completed.');
});
