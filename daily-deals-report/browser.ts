import puppeteer from 'puppeteer';
import type { Browser, Page } from 'puppeteer';
import type { ChildProcess } from 'node:child_process';

let browserPromise: Promise<Browser> | null = null;
let browserProcess: ChildProcess | null = null;

export const getBrowser = (): Promise<Browser> => {
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({ headless: 'shell', args: ['--no-sandbox'] })
      .then((browser) => {
        browserProcess = browser.process();
        return browser;
      })
      .catch((error) => {
        browserPromise = null;
        throw error;
      });
  }
  return browserPromise;
};

export const newPage = async (): Promise<Page> => {
  const browser = await getBrowser();
  return browser.newPage();
};

export const closeBrowser = async (): Promise<void> => {
  if (browserPromise) {
    const browser = await browserPromise.catch(() => null);
    browserPromise = null;
    browserProcess = null;
    if (browser) {
      await browser.close();
    }
  }
};

process.on('exit', () => {
  browserProcess?.kill();
});
