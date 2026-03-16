import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

async function scrapeTikTokRoster() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: false, // Set to false to see what's happening
    defaultViewport: { width: 1920, height: 1080 }
  });

  try {
    const page = await browser.newPage();
    
    // Navigate to the TikTok roster page
    console.log('Navigating to https://www.a-listme.com/tiktokroster...');
    await page.goto('https://www.a-listme.com/tiktokroster', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Wait a bit for dynamic content to load
    console.log('Waiting for content to load...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Take initial screenshot
    const screenshotsDir = './tiktok_roster_data/screenshots';
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'initial_view.png'),
      fullPage: false
    });
    console.log('Initial screenshot saved.');

    // Get page height for scrolling
    const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
    console.log(`Page height: ${bodyHeight}px`);

    // Scroll through the page gradually to load all content
    console.log('Scrolling through page...');
    let currentPosition = 0;
    const scrollStep = 800;
    let screenshotCount = 1;

    while (currentPosition < bodyHeight) {
      await page.evaluate((scrollTo) => {
        window.scrollTo(0, scrollTo);
      }, currentPosition);
      
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for content to load
      
      // Take screenshot at this position
      await page.screenshot({ 
        path: path.join(screenshotsDir, `scroll_${screenshotCount}.png`),
        fullPage: false
      });
      console.log(`Screenshot ${screenshotCount} saved at position ${currentPosition}px`);
      
      currentPosition += scrollStep;
      screenshotCount++;
      
      // Update body height in case new content loaded
      const newHeight = await page.evaluate(() => document.body.scrollHeight);
      if (newHeight > bodyHeight) {
        console.log(`Page height increased to ${newHeight}px`);
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

    // Try to extract influencer data from various possible selectors
    console.log('Extracting influencer data...');
    
    const influencerData = await page.evaluate(() => {
      const data = [];
      
      // Try multiple selector strategies
      const selectors = [
        // Common card/profile selectors
        '[class*="creator"]',
        '[class*="influencer"]',
        '[class*="profile"]',
        '[class*="card"]',
        '[class*="roster"]',
        '[data-testid*="creator"]',
        '[data-testid*="influencer"]',
        // Wix-specific selectors
        '[data-mesh-id]',
        '[id*="comp-"]',
        'article',
        '.member-item',
        '.profile-card'
      ];

      let elements = [];
      for (const selector of selectors) {
        const found = document.querySelectorAll(selector);
        if (found.length > 0) {
          console.log(`Found ${found.length} elements with selector: ${selector}`);
          elements = Array.from(found);
          break;
        }
      }

      // If no specific elements found, try to get all text content
      if (elements.length === 0) {
        console.log('No specific elements found, extracting all visible text...');
        const allText = document.body.innerText;
        return { rawText: allText, elements: [] };
      }

      // Extract data from found elements
      elements.forEach((element, index) => {
        const text = element.innerText || element.textContent;
        const images = Array.from(element.querySelectorAll('img')).map(img => ({
          src: img.src,
          alt: img.alt
        }));
        
        const links = Array.from(element.querySelectorAll('a')).map(a => ({
          href: a.href,
          text: a.innerText
        }));

        if (text && text.trim().length > 0) {
          data.push({
            index: index + 1,
            text: text.trim(),
            images,
            links,
            html: element.outerHTML.substring(0, 500) // First 500 chars of HTML
          });
        }
      });

      return { elements: data, rawText: document.body.innerText };
    });

    // Save the extracted data
    const dataFile = './tiktok_roster_data/influencer_data.json';
    fs.writeFileSync(dataFile, JSON.stringify(influencerData, null, 2));
    console.log(`Data saved to ${dataFile}`);

    // Get all images on the page
    console.log('Extracting all images...');
    const images = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img')).map(img => ({
        src: img.src,
        alt: img.alt,
        width: img.width,
        height: img.height
      }));
    });

    fs.writeFileSync('./tiktok_roster_data/images.json', JSON.stringify(images, null, 2));
    console.log(`Found ${images.length} images`);

    // Get all links
    console.log('Extracting all links...');
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a')).map(a => ({
        href: a.href,
        text: a.innerText || a.textContent,
        title: a.title
      }));
    });

    fs.writeFileSync('./tiktok_roster_data/links.json', JSON.stringify(links, null, 2));
    console.log(`Found ${links.length} links`);

    // Get page HTML
    const html = await page.content();
    fs.writeFileSync('./tiktok_roster_data/page.html', html);
    console.log('Page HTML saved');

    console.log('\nScraping completed successfully!');
    console.log(`Total screenshots: ${screenshotCount}`);
    console.log(`Data saved in: ./tiktok_roster_data/`);

    return influencerData;

  } catch (error) {
    console.error('Error during scraping:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// Run the scraper
scrapeTikTokRoster()
  .then(data => {
    console.log('\n=== EXTRACTION SUMMARY ===');
    if (data.elements && data.elements.length > 0) {
      console.log(`Found ${data.elements.length} potential influencer elements`);
    } else {
      console.log('No structured elements found, check rawText in influencer_data.json');
    }
  })
  .catch(error => {
    console.error('Failed to scrape:', error);
    process.exit(1);
  });
