export const focusTime = page => page.getByRole('button', { name: /^调整专注时长/ })

export async function prepareMinutes(page, minutes) {
  await focusTime(page).click()
  const dial = page.getByRole('dialog')
  await dial.locator('#custom-minutes').fill(String(minutes))
  await dial.getByRole('button', { name: '用这个时长', exact: true }).click()
  await dial.waitFor({ state: 'hidden' })
}
