import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

async function scrapeIframeContent() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1920, height: 1080 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    console.log('Navigating to https://www.a-listme.com/tiktokroster...');
    await page.goto('https://www.a-listme.com/tiktokroster', {
      waitUntil: 'domcontentloaded',
      timeout: 90000
    });

    // Wait for content to load
    console.log('Waiting for content to load...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    const screenshotsDir = './tiktok_roster_data/iframe_screenshots';
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    // Find the iframe
    console.log('Looking for iframe...');
    const frames = page.frames();
    console.log(`Total frames found: ${frames.length}`);
    
    let targetFrame = null;
    for (const frame of frames) {
      const url = frame.url();
      console.log(`Frame URL: ${url}`);
      if (url.includes('filesusr.com')) {
        targetFrame = frame;
        console.log('Found target iframe!');
        break;
      }
    }

    if (!targetFrame) {
      console.log('Target iframe not found. Taking screenshot of main page...');
      await page.screenshot({ 
        path: path.join(screenshotsDir, 'main_page.png'),
        fullPage: true
      });
      
      // Try to wait for iframe to load
      console.log('Waiting longer for iframe to load...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      const framesRetry = page.frames();
      for (const frame of framesRetry) {
        const url = frame.url();
        console.log(`Frame URL (retry): ${url}`);
        if (url.includes('filesusr.com')) {
          targetFrame = frame;
          console.log('Found target iframe on retry!');
          break;
        }
      }
    }

    if (targetFrame) {
      console.log('\n=== IFRAME FOUND ===');
      console.log('Iframe URL:', targetFrame.url());
      
      // Wait for iframe content
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Get iframe content
      const iframeContent = await targetFrame.evaluate(() => {
        return {
          html: document.documentElement.outerHTML,
          text: document.body.innerText,
          title: document.title
        };
      });

      console.log('\n=== IFRAME TEXT CONTENT ===');
      console.log(iframeContent.text);
      console.log('=== END IFRAME TEXT ===\n');

      // Save iframe HTML
      fs.writeFileSync('./tiktok_roster_data/iframe_content.html', iframeContent.html);
      console.log('Iframe HTML saved to iframe_content.html');

      // Save iframe text
      fs.writeFileSync('./tiktok_roster_data/iframe_text.txt', iframeContent.text);
      console.log('Iframe text saved to iframe_text.txt');

      // Extract structured data from iframe
      const iframeData = await targetFrame.evaluate(() => {
        const data = {
          allText: document.body.innerText,
          images: [],
          links: [],
          tables: [],
          lists: []
        };

        // Get all images
        data.images = Array.from(document.querySelectorAll('img')).map(img => ({
          src: img.src,
          alt: img.alt,
          title: img.title
        }));

        // Get all links
        data.links = Array.from(document.querySelectorAll('a')).map(a => ({
          href: a.href,
          text: a.innerText || a.textContent
        }));

        // Get all tables
        data.tables = Array.from(document.querySelectorAll('table')).map(table => ({
          rows: table.rows.length,
          text: table.innerText
        }));

        // Get all lists
        data.lists = Array.from(document.querySelectorAll('ul, ol')).map(list => ({
          type: list.tagName,
          items: Array.from(list.querySelectorAll('li')).map(li => li.innerText)
        }));

        // Try to find any structured creator/influencer data
        const allDivs = Array.from(document.querySelectorAll('div')).map(div => ({
          class: div.className,
          id: div.id,
          text: div.innerText?.substring(0, 200)
        })).filter(div => div.text && div.text.trim().length > 0);

        data.allDivs = allDivs;

        return data;
      });

      console.log('\n=== IFRAME DATA ANALYSIS ===');
      console.log(`Images found: ${iframeData.images.length}`);
      console.log(`Links found: ${iframeData.links.length}`);
      console.log(`Tables found: ${iframeData.tables.length}`);
      console.log(`Lists found: ${iframeData.lists.length}`);
      console.log(`Divs with content: ${iframeData.allDivs.length}`);

      // Save structured data
      fs.writeFileSync('./tiktok_roster_data/iframe_structured_data.json', JSON.stringify(iframeData, null, 2));
      console.log('Structured data saved to iframe_structured_data.json');

      // Take screenshot of the page showing the iframe
      await page.screenshot({ 
        path: path.join(screenshotsDir, 'page_with_iframe.png'),
        fullPage: true
      });
      console.log('Screenshot saved.');

    } else {
      console.log('\n!!! WARNING: Could not find the iframe with roster content !!!');
      console.log('The roster may be loaded differently or require interaction.');
    }

    // Keep browser open for inspection
    console.log('\nBrowser will remain open for 20 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 20000));

    console.log('\n=== SCRAPING COMPLETED ===');

  } catch (error) {
    console.error('Error during scraping:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

scrapeIframeContent()
  .then(() => {
    console.log('\nScript completed successfully.');
    console.log('Check the tiktok_roster_data folder for all extracted information.');
  })
  .catch(error => {
    console.error('Failed to scrape:', error);
    process.exit(1);
  });
