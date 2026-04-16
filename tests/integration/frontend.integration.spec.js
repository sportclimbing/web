import { test, expect } from '@playwright/test';

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

const getNextEventHeroMatch = async (page) => {
  return page.evaluate(() => {
    const detailsButton = document.getElementById('next-event-details-button');
    const nextEventTitle = document.getElementById('next-event-title');
    const heroEventId = detailsButton instanceof HTMLElement ? (detailsButton.dataset.eventId || null) : null;
    const heroEventName = nextEventTitle instanceof HTMLElement ? nextEventTitle.textContent.trim() : null;

    if (!heroEventId) {
      return { hasHeroEvent: false, heroEventId: null, matchingCardVisible: false };
    }

    const matchingCard = document.querySelector(`#accordion .ifsc-league-card:not([hidden])[data-event-id="${heroEventId}"]`);
    const hasRoundCard = matchingCard instanceof HTMLElement
      ? Boolean(matchingCard.querySelector('.event-round-card[data-round-starts-at][data-round-ends-at]'))
      : false;

    return {
      hasHeroEvent: true,
      heroEventId,
      heroEventName,
      matchingCardVisible: matchingCard instanceof HTMLElement,
      hasRoundCard,
    };
  });
};

const openFirstEventPanel = async (page) => {
  const eventCard = page.locator('#accordion .ifsc-league-card:not([hidden])').first();
  await expect(eventCard).toBeVisible();
  await expect(eventCard.locator('.event-round-card:not([hidden])').first()).toBeVisible();
  return eventCard;
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

test('event title click opens the event page', async ({ page }) => {
  await page.goto('/season/2026');
  await waitForEventCards(page);

  const firstTitle = page.locator('#accordion .ifsc-league-card:not([hidden]) .event-name-title[href]').first();
  const eventPagePath = await firstTitle.getAttribute('href');
  expect(eventPagePath).toMatch(/^\/season\/2026\/event\/.+-\d+\/$/);

  await firstTitle.click();
  await expect.poll(() => normalizePath(new URL(page.url()).pathname)).toBe(normalizePath(eventPagePath || ''));
});

test('season page shows next event in hero section', async ({ page }) => {
  await page.goto('/season/2026');
  await waitForEventCards(page);
  await expect(page.locator('#next-event-details-button')).toBeVisible({ timeout: 20000 });

  const heroMatch = await getNextEventHeroMatch(page);

  expect(heroMatch.hasHeroEvent).toBe(true);
  expect(heroMatch.heroEventId).toBeTruthy();
  expect(heroMatch.matchingCardVisible).toBe(true);
  expect(heroMatch.hasRoundCard).toBe(true);
});

test('event page shows expanded rounds with breadcrumb-only subheader', async ({ page }) => {
  await page.goto('/season/2026');
  await waitForEventCards(page);

  const firstTitle = page.locator('#accordion .ifsc-league-card:not([hidden]) .event-name-title[href]').first();
  const eventPagePath = await firstTitle.getAttribute('href');
  expect(eventPagePath).toMatch(/^\/season\/2026\/event\/.+-\d+\/$/);

  await page.goto(eventPagePath || '/season/2026');
  await expect.poll(() => normalizePath(new URL(page.url()).pathname)).toBe(normalizePath(eventPagePath || ''));
  await expect(page.locator('nav[aria-label="Breadcrumb"]')).toHaveCount(1);
  await expect(page.locator('#season-month-nav')).toHaveCount(0);
  await expect(page.locator('#season-selector')).toHaveCount(0);
  await expect(page.locator('.filters-button')).toHaveCount(0);
  await expect(page.locator('nav[aria-label="Breadcrumb"] a')).toHaveCount(2);
  await expect(page.locator('nav[aria-label="Breadcrumb"] [aria-current="page"]')).toHaveCount(1);
  await expect(page.locator('[data-action="event-watch-toggle"]')).toHaveCount(0);
  await expect(page.locator('#accordion .event-rounds-panel.collapse')).toHaveCount(0);
  await expect(page.locator('#accordion .event-round-card:not([hidden]):not(.hidden)').first()).toBeVisible();
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
  const noStreamButton = eventPanel.locator('[data-action="round-stream"]:not([data-round-stream-url])').first();
  await expect(noStreamButton).toBeVisible();
  const hasStreamUrlAttribute = await noStreamButton.evaluate((element) => element.hasAttribute('data-round-stream-url'));

  expect(hasStreamUrlAttribute).toBe(false);

  await noStreamButton.click();
  await expectModalOpen(page, '#event-not-started-modal');
});

test('switches season and opens start list modal from pre-rendered fragment', async ({ page }) => {
  let startListFragmentRequests = 0;
  await page.route('**/modals/start-list/**', async (route) => {
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
  await page.route('**/modals/start-list/**', async (route) => {
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
  const streamButton = eventPanel.locator('.round-stream-button[data-round-stream-url]').first();
  await expect(streamButton).toHaveAttribute('data-round-stream-url', /.+/);

  await streamButton.click();
  await expectModalOpen(page, '#video-modal');
  await expect(page.locator('#youtube-video')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]+/);
});
