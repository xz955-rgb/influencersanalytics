import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

async function scrapeTikTokRosterV2() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1920, height: 1080 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // Enable console logging from the page
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    
    // Navigate to the TikTok roster page
    console.log('Navigating to https://www.a-listme.com/tiktokroster...');
    await page.goto('https://www.a-listme.com/tiktokroster', {
      waitUntil: 'domcontentloaded',
      timeout: 90000
    });

    // Wait longer for dynamic content
    console.log('Waiting 10 seconds for all content to load...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    const screenshotsDir = './tiktok_roster_data/screenshots_v2';
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    
    // Take initial screenshot
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'initial_view.png'),
      fullPage: false
    });
    console.log('Initial screenshot saved.');

    // Check for iframes
    const frames = page.frames();
    console.log(`Found ${frames.length} frames on the page`);
    
    // Get all text content
    const allText = await page.evaluate(() => document.body.innerText);
    console.log('\n=== PAGE TEXT CONTENT ===');
    console.log(allText);
    console.log('=== END PAGE TEXT ===\n');

    // Look for any Wix data collections or repeaters
    const wixData = await page.evaluate(() => {
      const results = {
        repeaters: [],
        collections: [],
        allDivs: [],
        allSections: []
      };

      // Look for Wix repeater elements
      const repeaters = document.querySelectorAll('[data-repeater]');
      results.repeaters = Array.from(repeaters).map(el => ({
        id: el.id,
        class: el.className,
        innerHTML: el.innerHTML.substring(0, 500)
      }));

      // Look for all divs with data attributes
      const divsWithData = document.querySelectorAll('div[data-mesh-id], div[id^="comp-"]');
      results.allDivs = Array.from(divsWithData).map(el => ({
        id: el.id,
        meshId: el.getAttribute('data-mesh-id'),
        text: el.innerText?.substring(0, 200),
        childCount: el.children.length
      }));

      // Look for sections
      const sections = document.querySelectorAll('section');
      results.allSections = Array.from(sections).map(el => ({
        id: el.id,
        text: el.innerText?.substring(0, 200),
        childCount: el.children.length
      }));

      return results;
    });

    console.log('\n=== WIX DATA ANALYSIS ===');
    console.log('Repeaters found:', wixData.repeaters.length);
    console.log('Divs with data:', wixData.allDivs.length);
    console.log('Sections found:', wixData.allSections.length);
    
    // Save Wix data
    fs.writeFileSync('./tiktok_roster_data/wix_data_analysis.json', JSON.stringify(wixData, null, 2));

    // Scroll through the page more slowly
    console.log('\nScrolling through page slowly...');
    const scrollSteps = 20;
    const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
    const stepSize = Math.ceil(bodyHeight / scrollSteps);

    for (let i = 0; i < scrollSteps; i++) {
      const scrollPosition = i * stepSize;
      await page.evaluate((pos) => window.scrollTo(0, pos), scrollPosition);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (i % 5 === 0) {
        await page.screenshot({ 
          path: path.join(screenshotsDir, `scroll_step_${i}.png`),
          fullPage: false
        });
        console.log(`Screenshot at scroll position ${scrollPosition}px`);
      }
    }

    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Take full page screenshot
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'full_page.png'),
      fullPage: true
    });
    console.log('Full page screenshot saved.');

    // Try to find any embedded content or apps
    const embeddedContent = await page.evaluate(() => {
      const iframes = Array.from(document.querySelectorAll('iframe')).map(iframe => ({
        src: iframe.src,
        id: iframe.id,
        class: iframe.className
      }));

      const embeds = Array.from(document.querySelectorAll('[data-embed], [class*="embed"]')).map(el => ({
        tag: el.tagName,
        id: el.id,
        class: el.className,
        text: el.innerText?.substring(0, 100)
      }));

      return { iframes, embeds };
    });

    console.log('\n=== EMBEDDED CONTENT ===');
    console.log('Iframes:', embeddedContent.iframes);
    console.log('Embeds:', embeddedContent.embeds);

    fs.writeFileSync('./tiktok_roster_data/embedded_content.json', JSON.stringify(embeddedContent, null, 2));

    // Check if there's a "load more" button or similar
    const buttons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button, a[role="button"]')).map(btn => ({
        text: btn.innerText || btn.textContent,
        id: btn.id,
        class: btn.className,
        href: btn.href
      }));
    });

    console.log('\n=== BUTTONS FOUND ===');
    console.log(JSON.stringify(buttons, null, 2));
    fs.writeFileSync('./tiktok_roster_data/buttons.json', JSON.stringify(buttons, null, 2));

    console.log('\n=== SCRAPING COMPLETED ===');
    console.log('Check the tiktok_roster_data folder for all extracted information.');

    // Keep browser open for manual inspection
    console.log('\nBrowser will remain open for 30 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('Error during scraping:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

scrapeTikTokRosterV2()
  .then(() => {
    console.log('\nScript completed successfully.');
  })
  .catch(error => {
    console.error('Failed to scrape:', error);
    process.exit(1);
  });
