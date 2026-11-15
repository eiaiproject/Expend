import { expect, test, type Page } from '@playwright/test'

async function openApp(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Catat' })).toBeVisible()
}

async function addTransaction(page: Page, line: string) {
  await page.getByLabel('Baris pengeluaran').fill(line)
  await page.getByRole('button', { name: 'Buat pratinjau transaksi' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Simpan transaksi' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

test.describe('CRUD transaksi Expend', () => {
  test('create: chat menjadi transaksi dan bertahan setelah reload', async ({ page }) => {
    await openApp(page)
    await addTransaction(page, 'Indomaret 100000 Mandiri belanja bulanan')

    await expect(
      page.getByRole('status').filter({ hasText: 'Transaksi EXP-000001 disimpan.' }),
    ).toBeVisible()

    const bubble = page.locator('.chat-bubble').filter({ hasText: 'Indomaret' })
    await expect(bubble).toBeVisible()
    await expect(bubble).toContainText('Rp 100.000')
    await expect(bubble).toContainText('Mandiri')
    await expect(bubble).toContainText('EXP-000001')
    await expect(bubble).toContainText('belanja bulanan')
    await expect(page.locator('.today-strip')).toContainText('Rp 100.000')

    await page.reload()
    await expect(page.locator('.chat-bubble').filter({ hasText: 'Indomaret' })).toBeVisible()
  })

  test('read: daftar menampilkan transaksi dan pencarian menyaring', async ({ page }) => {
    await openApp(page)
    await addTransaction(page, 'Indomaret 100000 Mandiri belanja bulanan')
    await addTransaction(page, 'Kopi 25000 BCA pagi')

    const nav = page.getByRole('navigation', { name: 'Navigasi utama' })
    await nav.getByRole('button', { name: 'Daftar', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Daftar' })).toBeVisible()

    await expect(page.locator('.list-card .row')).toHaveCount(2)
    await expect(page.locator('.list-summary')).toContainText('Rp 125.000')

    await page.getByLabel('Cari transaksi').fill('Indomaret')
    await expect(page.locator('.list-card .row')).toHaveCount(1)
    await expect(page.locator('.list-card .row')).toContainText('Indomaret')
    await expect(page.locator('.list-summary')).toContainText('1 transaksi')
  })

  test('privasi: tombol menyembunyikan nominal dengan lima titik', async ({ page }) => {
    await openApp(page)
    await addTransaction(page, 'Indomaret 100000 Mandiri belanja bulanan')

    const todayAmount = page.locator('.today-amount')
    await expect(todayAmount).toContainText('Rp 100.000')

    const mobileBar = page.locator('.mobile-bar')
    await mobileBar.getByRole('button', { name: 'Sembunyikan nominal' }).click()
    await expect(todayAmount).toHaveText('•••••')
    await expect(page.locator('.chat-bubble .bubble-amount')).toHaveText('•••••')

    const nav = page.getByRole('navigation', { name: 'Navigasi utama' })
    await nav.getByRole('button', { name: 'Daftar', exact: true }).click()
    await expect(page.locator('.row-amount').first()).toHaveText('•••••')
    await expect(page.locator('.list-summary .mono')).toHaveText('•••••')

    await nav.getByRole('button', { name: 'Dasbor', exact: true }).click()
    await expect(page.locator('.stat-figure')).toHaveText('•••••')

    await nav.getByRole('button', { name: 'Catat', exact: true }).click()
    await page.reload()
    await expect(todayAmount).toHaveText('•••••')

    await mobileBar.getByRole('button', { name: 'Tampilkan nominal' }).click()
    await expect(todayAmount).toContainText('Rp 100.000')
  })

  test('update: ubah penerima, nominal, dan keterangan tanpa mengubah nomor', async ({
    page,
  }) => {
    await openApp(page)
    await addTransaction(page, 'Indomaret 100000 Mandiri belanja bulanan')

    await page.locator('.chat-bubble').filter({ hasText: 'Indomaret' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await dialog.getByLabel('Penerima').fill('Indomaret Sudirman')
    await dialog.getByLabel('Nominal').fill('125000')
    await dialog.getByLabel('Keterangan tambahan').fill('belanja mingguan')
    await dialog.getByRole('button', { name: 'Simpan perubahan' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)

    const bubble = page.locator('.chat-bubble').filter({ hasText: 'Indomaret Sudirman' })
    await expect(bubble).toBeVisible()
    await expect(bubble).toContainText('Rp 125.000')
    await expect(bubble).toContainText('belanja mingguan')
    await expect(bubble).toContainText('EXP-000001')
  })

  test('delete: hapus transaksi dan pakai ulang nomor terkecil', async ({ page }) => {
    await openApp(page)
    await addTransaction(page, 'Kopi 25000 BCA pagi')

    await page.locator('.chat-bubble').filter({ hasText: 'Kopi' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Hapus transaksi' }).click()
    await dialog.getByRole('button', { name: 'Ya, hapus' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(
      page.getByRole('status').filter({ hasText: 'Transaksi EXP-000001 dihapus.' }),
    ).toBeVisible()
    await expect(page.locator('.chat-bubble')).toHaveCount(0)

    await addTransaction(page, 'Teh 10000 Tunai')
    await expect(
      page.getByRole('status').filter({ hasText: 'Transaksi EXP-000001 disimpan.' }),
    ).toBeVisible()
    await expect(page.locator('.chat-bubble')).toContainText('EXP-000001')
  })

  test('pengaturan: versi aplikasi berasal dari package.json', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: 'Pengaturan dan data' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('Expend versi 0.1.0')
  })

  test('tutorial: tombol membuka panduan pengisian sesuai format PRD', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: 'Buka tutorial' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading', { name: 'Tutorial pengisian' })).toBeVisible()
    await expect(dialog.getByRole('heading', { name: 'Format satu baris' })).toBeVisible()
    await expect(dialog.getByRole('heading', { name: 'Angka di nama penerima' })).toBeVisible()
    await expect(
      dialog.getByText('Mitra 10 50000 BCA belanja bahan bangunan', { exact: true }),
    ).toBeVisible()
    await expect(dialog.getByText('Indomaret 100000 Mandiri belanja bulanan', { exact: true })).toBeVisible()

    await dialog.getByRole('button', { name: 'Mengerti' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('validasi: tanggal masa depan ditolak di pratinjau', async ({ page }) => {
    await openApp(page)
    await page.getByLabel('Baris pengeluaran').fill('Indomaret 100000 BCA')
    await page.getByRole('button', { name: 'Buat pratinjau transaksi' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('Tanggal').fill('2999-01-01')
    await dialog.getByRole('button', { name: 'Simpan transaksi' }).click()

    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Tanggal tidak boleh di masa depan.')).toBeVisible()
    await expect(
      page.getByRole('status').filter({ hasText: 'disimpan.' }),
    ).toHaveCount(0)
  })

  test('batal: teks composer tetap ada dan perubahan minta konfirmasi', async ({ page }) => {
    await openApp(page)
    const input = page.getByLabel('Baris pengeluaran')
    await input.fill('Kopi 25000 BCA pagi')
    await page.getByRole('button', { name: 'Buat pratinjau transaksi' }).click()

    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Batal' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(input).toHaveValue('Kopi 25000 BCA pagi')

    await page.getByRole('button', { name: 'Buat pratinjau transaksi' }).click()
    await dialog.getByLabel('Penerima').fill('Kopi Kenangan')
    await dialog.getByRole('button', { name: 'Tutup pratinjau' }).click()
    await expect(dialog.getByText('Buang perubahan yang belum disimpan?')).toBeVisible()

    await dialog.getByRole('button', { name: 'Lanjut edit' }).click()
    await expect(dialog.getByLabel('Penerima')).toHaveValue('Kopi Kenangan')
    await dialog.getByRole('button', { name: 'Batal' }).click()
    await dialog.getByRole('button', { name: 'Buang' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(input).toHaveValue('Kopi 25000 BCA pagi')
  })

  test('cari: empty state menawarkan pencarian di semua tanggal', async ({ page }) => {
    await openApp(page)
    await addTransaction(page, '12/10/2020 Toko Lama 50000 BCA')

    const nav = page.getByRole('navigation', { name: 'Navigasi utama' })
    await nav.getByRole('button', { name: 'Daftar', exact: true }).click()
    await page.getByLabel('Cari transaksi').fill('Toko Lama')

    const empty = page.locator('.empty-card')
    await expect(empty).toContainText('Tidak ada transaksi yang cocok')
    await empty.getByRole('button', { name: 'Cari di semua tanggal' }).click()

    await expect(page.locator('.list-card .row')).toContainText('Toko Lama')
    await expect(page.locator('.list-summary')).toContainText('semua tanggal')
  })

  test('navigasi: tab dan pencarian bertahan setelah reload, back menutup filter', async ({
    page,
  }) => {
    await openApp(page)
    const nav = page.getByRole('navigation', { name: 'Navigasi utama' })
    await nav.getByRole('button', { name: 'Daftar', exact: true }).click()
    await expect(page).toHaveURL(/#daftar/)

    await page.getByLabel('Cari transaksi').fill('Kopi')
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Daftar' })).toBeVisible()
    await expect(page.getByLabel('Cari transaksi')).toHaveValue('Kopi')

    await page.getByRole('button', { name: 'Buka filter' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.evaluate(() => history.back())
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Daftar' })).toBeVisible()
  })

  test('grafik: target sentuh lebar dan navigasi panah', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-15T03:00:00Z'))
    await openApp(page)
    await addTransaction(page, 'Kopi 25000 BCA pagi')
    await page
      .getByRole('navigation', { name: 'Navigasi utama' })
      .getByRole('button', { name: 'Dasbor', exact: true })
      .click()

    const slots = page.locator('.chart-slot')
    await expect(slots.first()).toBeVisible()
    const box = await slots.first().boundingBox()
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(40)
    const chart = await page.locator('.chart-bars').evaluate((element) => ({
      client: element.clientWidth,
      scroll: element.scrollWidth,
    }))
    expect(chart.scroll).toBeGreaterThan(chart.client)

    const last = slots.last()
    const before = await last.getAttribute('aria-label')
    await last.focus()
    await page.keyboard.press('ArrowLeft')
    await expect(page.locator('.chart-slot.is-selected')).toHaveCount(1)
    await expect(page.locator('.chart-slot.is-selected')).not.toHaveAttribute(
      'aria-label',
      before ?? '',
    )
  })

  test('OCR: unggah bukti transfer membuka pratinjau', async ({ page }) => {
    test.slow()
    await openApp(page)
    await page
      .locator('.dock input[type="file"]')
      .setInputFiles('e2e/fixtures/ocr/transaction_details.png')

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 90_000 })
    await expect(dialog.getByAltText('Bukti transfer yang diunggah')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Simpan transaksi' })).toBeVisible()
  })

  test('PWA: shell tetap terbuka saat offline', async ({ page, context }) => {
    await page.goto('/')
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })
    await page.reload()
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))

    await context.setOffline(true)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Catat' })).toBeVisible()
    await context.setOffline(false)
  })

  test('sumber dana: pilihan umum dan sumber lainnya', async ({ page }) => {
    await openApp(page)
    await addTransaction(page, 'Kopi 25000 Mandiri pagi')
    await page.locator('.chat-bubble').filter({ hasText: 'Kopi' }).click()

    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Sumber dana', { exact: true }).selectOption('__other')
    await dialog.getByLabel('Sumber dana lainnya').fill('Dompet')
    await dialog.getByRole('button', { name: 'Simpan perubahan' }).click()

    await expect(page.locator('.chat-bubble').filter({ hasText: 'Kopi' })).toContainText('Dompet')
  })
})
