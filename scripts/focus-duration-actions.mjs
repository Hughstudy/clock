export const focusTime = page => page.getByRole('button', { name: /^调整专注时长/ })

export async function prepareMinutes(page, minutes) {
  await focusTime(page).click()
  const picker = page.getByRole('dialog')
  await picker.locator('#custom-minutes').fill(String(minutes))
  await picker.getByRole('button', { name: '用这个时长', exact: true }).click()
  await picker.waitFor({ state: 'hidden' })
}
