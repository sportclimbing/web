import { test, expect } from '@playwright/test';

const waitForEventCards = async (page) => {
  await expect(page.locator('#accordion .ifsc-league-card:not([hidden])').first()).toBeVisible({ timeout: 20000 });
};

const openFilters = async (page) => {
  await page.locator('.filters-button').click();
  await expect(page.locator('#filter-modal')).toHaveClass(/show/);
};

const applyFilters = async (page) => {
  await page.locator('#save-filters').click();
};

const getVisibleEventNames = async (page) => {
  return page.locator('#accordion .ifsc-league-card:not([hidden]) .event-name').allTextContents();
};

const getVisibleEventDisciplines = async (page) => {
  return page.locator('#accordion .ifsc-league-card:not([hidden]) .event-disciplines').allTextContents();
};

const setDisciplineFilters = async (page, selectedDiscipline) => {
  await openFilters(page);

  const boulder = page.locator('input[name="discipline[boulder]"]');
  const lead = page.locator('input[name="discipline[lead]"]');
  const speed = page.locator('input[name="discipline[speed]"]');

  if (selectedDiscipline === 'boulder') {
    await boulder.check();
    await lead.uncheck();
    await speed.uncheck();
  } else if (selectedDiscipline === 'lead') {
    await boulder.uncheck();
    await lead.check();
    await speed.uncheck();
  } else {
    await boulder.uncheck();
    await lead.uncheck();
    await speed.check();
  }

  await applyFilters(page);
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

test('league filters change the displayed results', async ({ page }) => {
  await page.goto('/season/2026');
  await waitForEventCards(page);

  const initialEventNames = await getVisibleEventNames(page);
  expect(initialEventNames.length).toBeGreaterThan(0);

  await openFilters(page);
  await page.locator('input[name="league[cups]"]').uncheck();
  await page.locator('input[name="league[games]"]').uncheck();
  await page.locator('input[name="league[paraclimbing]"]').uncheck();
  await applyFilters(page);

  await expect(page.locator('#accordion .ifsc-league-card:not([hidden])')).toHaveCount(0);
  await expect(page.locator('.no-results-text')).toBeVisible();

  await openFilters(page);
  await page.locator('input[name="league[cups]"]').check();
  await page.locator('input[name="league[games]"]').check();
  await applyFilters(page);

  await waitForEventCards(page);
  await expect(page.locator('#accordion .ifsc-league-card:not([hidden])')).not.toHaveCount(0);
});

test('category filters change the displayed results', async ({ page }) => {
  await page.goto('/season/2026');
  await waitForEventCards(page);

  await openFilters(page);
  await page.locator('input[name="category[women]"]').uncheck();
  await page.locator('input[name="category[men]"]').uncheck();
  await applyFilters(page);

  await expect(page.locator('#accordion .ifsc-league-card:not([hidden])')).toHaveCount(0);
  await expect(page.locator('.no-results-text')).toBeVisible();

  await openFilters(page);
  await page.locator('input[name="category[women]"]').check();
  await page.locator('input[name="category[men]"]').check();
  await applyFilters(page);

  await waitForEventCards(page);
  await expect(page.locator('#accordion .ifsc-league-card:not([hidden])')).not.toHaveCount(0);
});

test('discipline filters enforce visible event discipline labels', async ({ page }) => {
  await page.goto('/season/2026');
  await waitForEventCards(page);

  for (const selectedDiscipline of ['boulder', 'lead', 'speed']) {
    await setDisciplineFilters(page, selectedDiscipline);
    await expect(page.locator('#accordion .ifsc-league-card:not([hidden]) .event-disciplines').first()).toBeVisible({ timeout: 20000 });

    const disciplineLabels = await getVisibleEventDisciplines(page);
    expect(disciplineLabels.length).toBeGreaterThan(0);

    for (const label of disciplineLabels) {
      expect(label.toLowerCase()).toContain(selectedDiscipline);
    }
  }
});
