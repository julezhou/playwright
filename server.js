import express from "express";
import { chromium } from "playwright";

const app = express();
app.use(express.text({ limit: "10mb", type: "*/*" }));

const PORT = 3000;
const BROWSER_WORKERS = parseInt(process.env.BROWSER_WORKERS || "2");
const MAX_CONTEXTS = parseInt(process.env.MAX_CONTEXTS || "4");

/**
 * Browser Pool
 */
const pool = [];

class BrowserWorker {
    constructor(browser) {
        this.browser = browser;
        this.availableContexts = MAX_CONTEXTS;
    }
}

async function initBrowserPool() {
    console.log(`🚀 Starting ${BROWSER_WORKERS} Chromium browsers...`);

    for (let i = 0; i < BROWSER_WORKERS; i++) {
        const browser = await chromium.launch({
            args: [
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu"
            ]
        });
        pool.push(new BrowserWorker(browser));
        console.log(`✅ Browser ${i} ready`);
    }
}

/**
 * Acquire a browser slot (blocking)
 */
async function acquireWorker() {
    while (true) {
        for (const worker of pool) {
            if (worker.availableContexts > 0) {
                worker.availableContexts--;
                return worker;
            }
        }
        await new Promise(r => setTimeout(r, 10));
    }
}

function releaseWorker(worker) {
    worker.availableContexts++;
}

/**
 * Render PDF
 */
app.post("/render/pdf", async (req, res) => {
    const html = req.body;
	console.log("开始生成PDF");
    if (!html) {
        return res.status(400).send("HTML content required");
    }

    const worker = await acquireWorker();
    const context = await worker.browser.newContext();
    const page = await context.newPage();

    try {
		console.log("PDF生成中");
        await page.setContent(html, { 
			waitUntil: "networkidle", 
			timeout: 3000 
		});
        const pdf = await page.pdf({ 
			format: "A4",
			printBackground: true,
			displayHeaderFooter: false,
			timeout: 6000
		});
		console.log("PDF生成成功");

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "inline; filename=result.pdf");
        res.send(pdf);
    } catch (err) {
        console.error(err);
        res.status(500).send("Render PDF failed");
    } finally {
        await page.close();
        await context.close();
        releaseWorker(worker);
    }
});

/**
 * Render PNG
 */
app.post("/render/png", async (req, res) => {
    const html = req.body;
	console.log("开始生成PNG");
    if (!html) {
        return res.status(400).send("HTML content required");
    }

    const worker = await acquireWorker();
    const context = await worker.browser.newContext({
        viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();

    try {
		console.log("PNG生成中");
        await page.setContent(html, { 
			waitUntil: "networkidle",
			timeout: 3000
		});
        const image = await page.screenshot({ 
			fullPage: true,
			quality: 100
		});
		console.log("PNG生成成功");

        res.setHeader("Content-Type", "image/png");
        res.send(image);
    } catch (err) {
        console.error(err);
        res.status(500).send("Render PNG failed");
    } finally {
        await page.close();
        await context.close();
        releaseWorker(worker);
    }
});

/**
 * Health check
 */
app.get("/health", (_, res) => {
    res.json({
        status: "UP",
        browsers: BROWSER_WORKERS,
        maxContextsPerBrowser: MAX_CONTEXTS
    });
});

/**
 * Start server
 */
(async () => {
    await initBrowserPool();
    app.listen(PORT, () => {
        console.log(`✅ Render service listening on :${PORT}`);
    });
})();
