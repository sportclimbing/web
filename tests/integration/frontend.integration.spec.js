const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const jqueryFilePath = path.resolve(__dirname, '../../public/js/jquery-3.2.1.slim.min.js');
const jqueryBody = fs.readFileSync(jqueryFilePath, 'utf8');

const waitForEventCards = async (page) => {
  await expect(page.locator('#accordion .ifsc-league-card').first()).toBeVisible({ timeout: 20000 });
};

const switchSeason = async (page, season) => {
  const firstWatchButton = page.locator('#accordion .ifsc-league-card .event-watch-button').first();
  await expect(firstWatchButton).toBeVisible();
  const previousTarget = await firstWatchButton.getAttribute('data-target');

  await page.selectOption('#season-selector', season);
  await expect.poll(() => new URL(page.url()).hash).toContain(`/season/${season}`);

  if (previousTarget) {
    await expect(
      page.locator(`#accordion .ifsc-league-card .event-watch-button[data-target="${previousTarget}"]`)
    ).toHaveCount(0, { timeout: 20000 });
  }

  await waitForEventCards(page);
};

const expectModalOpen = async (page, modalSelector) => {
  const modal = page.locator(modalSelector);
  await expect(modal).toHaveClass(/show/);
  await expect(page.locator('body')).toHaveClass(/modal-open/);
};

const openFirstEventPanel = async (page) => {
  const eventWatchTrigger = page.locator('#accordion .ifsc-league-card .event-watch-button').first();
  await expect(eventWatchTrigger).toBeVisible();

  const panelTarget = await eventWatchTrigger.getAttribute('data-target');
  if (!panelTarget) {
    throw new Error('Missing event panel target');
  }

  const eventPanel = page.locator(panelTarget);
  await page.evaluate((selector) => {
    window.$(selector).collapse('show');
  }, panelTarget);
  await expect(eventPanel).toHaveClass(/show/);
  await expect(eventPanel.locator('.event-round-card').first()).toBeVisible();

  return eventPanel;
};

test.beforeEach(async ({ page }) => {
  await page.route('**/ajax.googleapis.com/ajax/libs/jquery/3.7.0/jquery.min.js', (route) => {
    return route.fulfill({
      body: jqueryBody,
      contentType: 'application/javascript'
    });
  });

  await page.route('**/cdn.jsdelivr.net/npm/@widgetbot/html-embed', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: ''
    });
  });

  await page.route('**/buttons.github.io/buttons.js', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: ''
    });
  });
});

test('opens calendar modal from the add-to-calendar button', async ({ page }) => {
  await page.goto('/#/season/2026');
  await waitForEventCards(page);

  await page.locator('.calendar-sync-tooltip').first().click();
  await expectModalOpen(page, '#calendar-modal');
});

test('opens filter modal from the filters button', async ({ page }) => {
  await page.goto('/#/season/2026');
  await waitForEventCards(page);

  await page.locator('.filters-button').click();
  await expectModalOpen(page, '#filter-modal');
});

test('persists filter changes from the filter modal', async ({ page }) => {
  await page.goto('/#/season/2026');
  await waitForEventCards(page);

  await page.locator('.filters-button').click();
  await expectModalOpen(page, '#filter-modal');

  const womenCategoryCheckbox = page.locator('input[name="category[women]"]');
  await womenCategoryCheckbox.uncheck();
  await page.locator('#save-filters').click();
  await expect(page.locator('#filter-modal')).not.toHaveClass(/show/);

  const storedConfig = await page.evaluate(() => window.localStorage.getItem('config'));
  expect(storedConfig).not.toBeNull();
  expect(JSON.parse(storedConfig).category.women).toBe(false);
});

test('shows event-not-started modal when clicking a stream button with no stream URL', async ({ page }) => {
  await page.goto('/#/season/2026');
  await waitForEventCards(page);

  const eventPanel = await openFirstEventPanel(page);
  const noStreamButton = eventPanel.locator('button.youtube-play-button.js-round-stream[data-round-has-stream-url="0"]').first();

  await noStreamButton.click();
  await expectModalOpen(page, '#event-not-started-modal');
});

test('switches season and opens start list modal', async ({ page }) => {
  await page.goto('/#/season/2026');
  await waitForEventCards(page);

  await switchSeason(page, '2024');

  const startListTrigger = page.locator('#accordion .event-start-list-trigger').first();
  await expect(startListTrigger).toBeVisible();
  await startListTrigger.click();
  await expectModalOpen(page, '#start-list-modal');
  await expect(page.locator('#start-list-modal-list .start-list-athlete').first()).toBeVisible();
});

test('switches season and opens stream modal for a youtube round', async ({ page }) => {
  await page.goto('/#/season/2026');
  await waitForEventCards(page);

  await switchSeason(page, '2024');

  const eventPanel = await openFirstEventPanel(page);
  const streamButton = eventPanel.locator('button.youtube-play-button.js-round-stream[data-round-has-stream-url="1"]').first();

  await streamButton.click();
  await expectModalOpen(page, '#video-modal');
  await expect(page.locator('#youtube-video')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]+/);
});
