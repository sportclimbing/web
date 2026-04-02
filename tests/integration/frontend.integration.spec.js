const { test, expect } = require('@playwright/test');

const waitForEventCards = async (page) => {
  await expect(page.locator('#accordion .ifsc-league-card:not([hidden])').first()).toBeVisible({ timeout: 20000 });
};

const normalizePath = (path) => path.replace(/\/+$/, '') || '/';

const switchSeason = async (page, season) => {
  await page.selectOption('#season-selector', season);
  await expect.poll(() => normalizePath(new URL(page.url()).pathname)).toBe(`/season/${season}`);

  await waitForEventCards(page);
};

const expectModalOpen = async (page, modalSelector) => {
  const modal = page.locator(modalSelector);
  await expect(modal).toHaveClass(/show/);
  await expect(page.locator('body')).toHaveClass(/modal-open/);
};

const openFirstEventPanel = async (page) => {
  const eventWatchTrigger = page.locator('#accordion .ifsc-league-card:not([hidden]) .event-watch-button').first();
  await expect(eventWatchTrigger).toBeVisible();

  const panelTarget = await eventWatchTrigger.getAttribute('data-bs-target');
  if (!panelTarget) {
    throw new Error('Missing event panel target');
  }

  const eventPanel = page.locator(panelTarget);
  await page.evaluate((selector) => {
    const panel = document.querySelector(selector);
    if (!panel || !window.bootstrap || !window.bootstrap.Collapse) {
      return;
    }

    window.bootstrap.Collapse.getOrCreateInstance(panel, { toggle: false }).show();
  }, panelTarget);
  await expect(eventPanel).toHaveClass(/show/);
  await expect(eventPanel.locator('.event-round-card:not([hidden])').first()).toBeVisible();

  return eventPanel;
};

test.beforeEach(async ({ page }) => {
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
  await page.goto('/season/2026');
  await waitForEventCards(page);

  await page.locator('.calendar-sync-tooltip').first().click();
  await expectModalOpen(page, '#calendar-modal');
});

test('opens filter modal from the filters button', async ({ page }) => {
  await page.goto('/season/2026');
  await waitForEventCards(page);

  await page.locator('.filters-button').click();
  await expectModalOpen(page, '#filter-modal');
});

test('event title click opens details in the season page', async ({ page }) => {
  await page.goto('/season/2026');
  await waitForEventCards(page);

  const firstTitle = page.locator('#accordion .ifsc-league-card:not([hidden]) .event-name').first();
  await firstTitle.click();
  await expect.poll(() => normalizePath(new URL(page.url()).pathname)).toBe('/season/2026');
  await expect(page.locator('#accordion .collapse.show .event-round-card:not([hidden])').first()).toBeVisible();
});

test('persists filter changes from the filter modal', async ({ page }) => {
  await page.goto('/season/2026');
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
  await page.goto('/season/2026');
  await waitForEventCards(page);

  const eventPanel = await openFirstEventPanel(page);
  const noStreamButton = eventPanel.locator('a.round-stream-button.js-round-stream:not([data-round-stream-url])').first();
  await expect(noStreamButton).toBeVisible();
  const hasStreamUrlAttribute = await noStreamButton.evaluate((element) => element.hasAttribute('data-round-stream-url'));

  expect(hasStreamUrlAttribute).toBe(false);

  await noStreamButton.click();
  await expectModalOpen(page, '#event-not-started-modal');
});

test('switches season and opens start list modal from pre-rendered fragment', async ({ page }) => {
  let startListFragmentRequests = 0;
  await page.route('**/start-list-modals/**/*.html', async (route) => {
    startListFragmentRequests += 1;
    await route.continue();
  });

  await page.goto('/season/2026');
  await waitForEventCards(page);

  await switchSeason(page, '2024');

  const startListTrigger = page.locator('#accordion .ifsc-league-card:not([hidden]) .event-start-list-trigger').first();
  await expect(startListTrigger).toBeVisible();
  await startListTrigger.click();
  await expectModalOpen(page, '#start-list-modal');
  await expect(page.locator('#start-list-modal-list .start-list-athlete').first()).toBeVisible();
  await expect.poll(() => startListFragmentRequests).toBe(1);

  await page.locator('#start-list-modal [data-bs-dismiss="modal"]').first().click();
  await expect(page.locator('#start-list-modal')).not.toHaveClass(/show/);

  await startListTrigger.click();
  await expectModalOpen(page, '#start-list-modal');
  await expect(page.locator('#start-list-modal-list .start-list-athlete').first()).toBeVisible();
  await expect.poll(() => startListFragmentRequests).toBe(1);
});

test('shows start list modal fallback copy when fragment load fails', async ({ page }) => {
  await page.route('**/start-list-modals/**/*.html', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'text/plain',
      body: 'error',
    });
  });

  await page.goto('/season/2026');
  await waitForEventCards(page);

  await switchSeason(page, '2024');

  const startListTrigger = page.locator('#accordion .ifsc-league-card:not([hidden]) .event-start-list-trigger').first();
  await expect(startListTrigger).toBeVisible();
  await startListTrigger.click();

  await expectModalOpen(page, '#start-list-modal');
  await expect(page.locator('#start-list-modal-list .start-list-modal-empty')).toHaveText('Start list unavailable right now.');
});

test('switches season and opens stream modal for a youtube round', async ({ page }) => {
  await page.goto('/season/2026');
  await waitForEventCards(page);

  await switchSeason(page, '2024');

  const eventPanel = await openFirstEventPanel(page);
  const streamButton = eventPanel.locator('button.youtube-play-button.js-round-stream[data-round-stream-url]').first();
  await expect(streamButton).toHaveAttribute('data-round-stream-url', /.+/);

  await streamButton.click();
  await expectModalOpen(page, '#video-modal');
  await expect(page.locator('#youtube-video')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]+/);
});
